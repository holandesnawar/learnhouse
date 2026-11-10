"""
El middleware del «Estado de la escuela» (10/11/2026). Qué se apunta y por
qué, en `src/services/estado/estado.py`: leerlo antes de tocar esto.

Es ASGI puro (no `BaseHTTPMiddleware`): no toca el cuerpo de la petición ni
el de la respuesta, vale igual para respuestas en streaming y lo único que
añade a una petición normal es mirar el reloj dos veces y sumar uno a un
histograma en memoria. Nada de aquí espera a la base de datos.

Todo lo que apunta va dentro de un try: si algo de esto falla, la petición
sale exactamente igual que si este archivo no existiera.

Se apaga con `LEARNHOUSE_ESTADO=off`.
"""

from __future__ import annotations

import logging
import time

from src.services.estado import estado as E

logger = logging.getLogger(__name__)

# Errores que no son fallos de la escuela: el navegador cerró la conexión.
_NO_SON_FALLOS = ("ClientDisconnect", "CancelledError", "BrokenPipeError", "ConnectionResetError")


def _cabecera(scope, nombre: bytes) -> str:
    for clave, valor in scope.get("headers") or ():
        if clave == nombre:
            try:
                return valor.decode("latin-1")
            except Exception:  # noqa: BLE001
                return ""
    return ""


def _plantilla(scope) -> str:
    """La ruta como está escrita en el código (`/tareas/course/{course_uuid}`), o vacía."""
    ruta = getattr(scope.get("route"), "path", "") or ""
    return ruta if isinstance(ruta, str) else ""


def _token(scope) -> str:
    try:
        from starlette.requests import Request

        from src.security.auth import extract_jwt_from_request

        return extract_jwt_from_request(Request(scope)) or ""
    except Exception:  # noqa: BLE001
        return ""


def _detalle(cuerpo: bytes) -> str:
    """El «detail» de una respuesta de error, si se puede leer."""
    if not cuerpo or cuerpo[:2] == b"\x1f\x8b":
        return ""
    try:
        import json

        dato = json.loads(cuerpo.decode("utf-8", "ignore"))
        if isinstance(dato, dict):
            dato = dato.get("detail", dato.get("message", ""))
        return dato if isinstance(dato, str) else json.dumps(dato, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        return cuerpo[:200].decode("utf-8", "ignore")


def _apuntar(scope, tipo: str, status: int, ms: float, mensaje: str) -> None:
    plantilla = _plantilla(scope)
    E.apuntar({
        "tipo": tipo,
        "ruta": plantilla or E.limpiar_ruta(scope.get("path") or ""),
        "metodo": str(scope.get("method") or "")[:8],
        "status": int(status or 0),
        "ms": int(ms),
        "mensaje": E.limpiar_texto(mensaje, 300),
        "pagina": E.limpiar_ruta(_cabecera(scope, b"referer")) if _cabecera(scope, b"referer") else "",
        "ua": _cabecera(scope, b"user-agent")[:300],
        "token": _token(scope),
    })


class EstadoMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or not E.activo():
            await self.app(scope, receive, send)
            return

        E.asegurar_tarea()
        t0 = time.perf_counter()
        status = 0
        cuerpo = b""

        async def enviar(message):
            nonlocal status, cuerpo
            tipo = message.get("type")
            if tipo == "http.response.start":
                status = int(message.get("status") or 0)
            elif tipo == "http.response.body" and status >= 500 and len(cuerpo) < 600:
                cuerpo += (message.get("body") or b"")[:600]
            await send(message)

        try:
            await self.app(scope, receive, enviar)
        except Exception as exc:
            try:
                if type(exc).__name__ not in _NO_SON_FALLOS:
                    primera = (str(exc).strip().splitlines() or [""])[0]
                    _apuntar(scope, "error-api", 500, (time.perf_counter() - t0) * 1000, f"{type(exc).__name__}: {primera}")
            except Exception:  # noqa: BLE001
                pass
            raise

        try:
            ms = (time.perf_counter() - t0) * 1000
            plantilla = _plantilla(scope)
            metodo = str(scope.get("method") or "")
            if plantilla and metodo != "OPTIONS":
                E.apuntar_tiempo(metodo, plantilla, ms)
            if status >= 500:
                _apuntar(scope, "error-api", status, ms, _detalle(cuerpo) or f"Respuesta {status}")
            elif ms >= E.UMBRAL_LENTA_MS and E.cuenta_como_lenta(
                plantilla or scope.get("path") or "", metodo, _cabecera(scope, b"content-type"), ms
            ):
                _apuntar(scope, "lenta", status, ms, "")
        except Exception:  # noqa: BLE001
            pass


def registrar_estado(app) -> None:
    """Pone el middleware. Si algo falla al ponerlo, la aplicación arranca igual."""
    try:
        if E.activo():
            app.add_middleware(EstadoMiddleware)
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo poner el middleware de estado: la escuela sigue sin él", exc_info=True)

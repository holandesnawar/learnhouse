"""
Estado de la escuela (10/11/2026): enterarse de los fallos antes que los
alumnos, y medir qué va lento.

POR QUÉ. Hasta hoy un fallo se descubría cuando un alumno mandaba la captura
de «¡Algo salió mal!», y desde fuera no se puede mirar producción. Antes de
«optimizar» a ciegas hace falta VER: qué peticiones fallan, cuáles tardan,
qué pantallas se rompen y en qué navegador.

QUÉ SE APUNTA (tabla `estado_evento`, `src/db/estado.py`):

- `error-api`: una petición que acabó en 5xx o en una excepción sin capturar.
- `lenta`: una petición que tardó más de `UMBRAL_LENTA_MS` (2 s). No cuentan
  las subidas, las descargas, los webhooks ni lo que va en streaming
  (`cuenta_como_lenta`).
- `error-pantalla`: el navegador avisa de que una pantalla se rompió
  (`POST /estado/pantalla`, desde `global-error.tsx` y `SafeArea`).
- `arranque`: la API ha arrancado (un despliegue o un reinicio).
- `tiempos`: lo que tardaron TODAS las peticiones de cada ruta, por horas, en
  un histograma (`CUBOS`). De ahí salen la mediana y el p95 de cada ruta.

LAS TRES REGLAS, que no se pueden romper:

1. **Todo en blando.** Nada de aquí puede tumbar una petición ni el arranque:
   si la tabla no existe o la base de datos está caída, se pierde el apunte y
   la escuela sigue igual. Cada función que toca la base va en su try.
2. **Fuera de la petición.** La petición solo deja el apunte en una cola en
   memoria (`apuntar`, microsegundos). Una tarea de fondo (`_bucle`) la vacía
   cada 15 segundos, agrupa los repetidos y escribe. Con tope: como mucho
   `TOPE_POR_MINUTO` filas por minuto, para que una avalancha de errores no
   llene la base de datos (lo que sobra se cuenta y se tira).
3. **Sin datos personales.** La ruta se guarda como plantilla
   (`/tareas/course/{course_uuid}/semanas`) o pasada por `limpiar_ruta`; el
   mensaje, por `limpiar_texto` (fuera correos, teléfonos y claves). De la
   persona solo se guarda su id y su rol.

Se apaga entero con `LEARNHOUSE_ESTADO=off` (y en los tests, solo).

La API corre en UN proceso (`uv run app.py` bajo pm2), así que la cola y los
histogramas en memoria valen. Si algún día hay varios procesos, cada uno
escribe lo suyo: los errores se suman bien; los `tiempos` de la misma ruta y
hora podrían pisarse (se perdería parte de la cuenta, no se rompe nada).

Lo de más de 30 días se borra solo (`DIAS_GUARDADOS`), cada 6 horas.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)

UMBRAL_LENTA_MS = 2000
TOPE_POR_MINUTO = 60
DIAS_GUARDADOS = 30
CADA_SEG = 15
# Cada cuántas vueltas del bucle se vuelcan los tiempos (20 × 15 s = 5 min).
VUELTAS_TIEMPOS = 20
MAX_RUTAS = 400

TIPOS = ("error-api", "lenta", "error-pantalla", "arranque", "tiempos")

# Histograma de tiempos: cuántas peticiones tardaron menos de cada tope (ms).
# El último cubo es «más de 8 s».
CUBOS = (50, 100, 250, 500, 1000, 2000, 4000, 8000)

# El nombre de la comprobación del disco (no es «no responde»: es «se llena»).
ESPACIO = "Espacio para archivos"

ARRANQUE = datetime.now(timezone.utc)


# ── Puras ────────────────────────────────────────────────────────────────────

_CORREO = re.compile(r"[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+")
_JWT = re.compile(r"eyJ[\w-]{6,}(?:\.[\w-]+){0,2}")
_CLAVE = re.compile(r"\b(?:sk|pk|rk|whsec|lh|re|cs|pi|price|cus|sub|in|seti|tok)_[A-Za-z0-9_]{8,}")
_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_TEL = re.compile(r"\+?\d[\d ().-]{7,}\d")
_LARGO = re.compile(r"\b[A-Za-z0-9_\-]{28,}\b")
_ESPACIOS = re.compile(r"\s+")


def limpiar_texto(texto: Any, tope: int = 300) -> str:
    """Un mensaje de error sin correos, teléfonos, claves ni identificadores."""
    t = str(texto or "")
    t = _CORREO.sub("«correo»", t)
    t = _JWT.sub("«clave»", t)
    t = _CLAVE.sub("«clave»", t)
    t = _UUID.sub("«id»", t)
    t = _TEL.sub("«número»", t)
    t = _LARGO.sub("«clave»", t)
    t = _ESPACIOS.sub(" ", t).strip()
    return t[:tope]


def _es_id(segmento: str) -> bool:
    s = segmento
    if not s:
        return False
    if s.isdigit():
        return True
    if "@" in s or "%40" in s.lower():
        return True
    if _UUID.search(s):
        return True
    if len(s) >= 24:
        return True
    # «cs_test_a1B2…», «lh_…»: claves cortas con prefijo.
    if _CLAVE.fullmatch(s) or s.startswith("eyJ"):
        return True
    return False


def limpiar_ruta(ruta: Any, tope: int = 200) -> str:
    """Una ruta sin ids, correos ni claves: `/course/{id}/activity/{id}`."""
    r = str(ruta or "").split("?", 1)[0].split("#", 1)[0]
    if "://" in r:
        # Una dirección entera: solo interesa el camino, no el dominio.
        resto = r.split("://", 1)[1]
        r = "/" + resto.split("/", 1)[1] if "/" in resto else "/"
    partes = [("{id}" if _es_id(p) else p) for p in r.split("/")]
    return "/".join(partes)[:tope] or "/"


def _version_de(ua: str, marca: str) -> str:
    m = re.search(re.escape(marca) + r"[/ ](\d+)", ua)
    return m.group(1) if m else ""


def navegador_de(user_agent: Any) -> str:
    """«iPhone · Safari 17», «Android · Chrome 126», «iPhone · Instagram»."""
    ua = str(user_agent or "")
    if not ua:
        return ""
    if "iPhone" in ua:
        sistema = "iPhone"
    elif "iPad" in ua:
        sistema = "iPad"
    elif "Android" in ua:
        sistema = "Android"
    elif "Macintosh" in ua or "Mac OS X" in ua:
        sistema = "Mac"
    elif "Windows" in ua:
        sistema = "Windows"
    elif "Linux" in ua or "X11" in ua:
        sistema = "Linux"
    else:
        sistema = "Otro"

    # El navegador de dentro de una app no deja instalar ni se comporta igual.
    if "Instagram" in ua:
        return f"{sistema} · Instagram"
    if "FBAN" in ua or "FBAV" in ua:
        return f"{sistema} · Facebook"
    if "TikTok" in ua or "musical_ly" in ua or "Bytedance" in ua:
        return f"{sistema} · TikTok"

    for marca, nombre in (
        ("Edg", "Edge"), ("EdgiOS", "Edge"), ("OPR", "Opera"), ("SamsungBrowser", "Samsung"),
        ("CriOS", "Chrome"), ("FxiOS", "Firefox"), ("Firefox", "Firefox"), ("Chrome", "Chrome"),
    ):
        if marca + "/" in ua:
            v = _version_de(ua, marca)
            return f"{sistema} · {nombre}{(' ' + v) if v else ''}"
    if "Safari/" in ua:
        v = _version_de(ua, "Version")
        return f"{sistema} · Safari{(' ' + v) if v else ''}"
    if "python" in ua.lower() or "curl" in ua.lower() or "bot" in ua.lower():
        return "Programa"
    return sistema


# Trozos de ruta que tardan por lo que son, no porque algo vaya mal.
_NO_LENTAS = (
    "webhook", "/backup", "upload", "/archivo", "/audio", "/video", "descarga", "download",
    "/content", "/pdf", "export", "stream", "/tts", "/sse", "/import", "/migration", "/collab",
    "/thumbnail", "/avatar", "/logo", "/grabacion", "/adjunto", "/attachment", "/calendly/aviso",
)


def cuenta_como_lenta(ruta: str, metodo: str, tipo_contenido: str, ms: float, umbral: int = UMBRAL_LENTA_MS) -> bool:
    """¿Esta petición cuenta como lenta? Subidas, descargas y webhooks, no."""
    if ms < umbral:
        return False
    if (metodo or "").upper() in ("OPTIONS", "HEAD"):
        return False
    if "multipart/" in (tipo_contenido or "").lower():
        return False
    r = (ruta or "").lower()
    return not any(t in r for t in _NO_LENTAS)


def clave_de(*partes: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in partes).encode("utf-8", "ignore")).hexdigest()[:40]


def _minuto(iso: str) -> str:
    return (iso or "")[:16]


def agrupar(eventos: Iterable[dict]) -> list[dict]:
    """
    Junta los repetidos del mismo minuto: mismo tipo, ruta, método, status,
    mensaje y persona. Se queda con el primero, cuenta las `veces`, guarda el
    tiempo del más lento y la hora del último.
    """
    grupos: dict[str, dict] = {}
    for e in eventos:
        cuando = e.get("cuando") or ""
        clave = clave_de(
            e.get("tipo"), e.get("ruta"), e.get("metodo"), e.get("status"), e.get("mensaje"),
            e.get("user_id") or "", e.get("pagina") or "", _minuto(cuando),
        )
        g = grupos.get(clave)
        if g is None:
            g = dict(e)
            g["clave"] = clave
            g["veces"] = int(e.get("veces") or 1)
            g["ultima"] = cuando
            grupos[clave] = g
            continue
        g["veces"] += int(e.get("veces") or 1)
        g["ms"] = max(int(g.get("ms") or 0), int(e.get("ms") or 0))
        if cuando > g["ultima"]:
            g["ultima"] = cuando
    return list(grupos.values())


def cubo_de(ms: float) -> int:
    for i, tope in enumerate(CUBOS):
        if ms < tope:
            return i
    return len(CUBOS)


def hist_vacio() -> list[int]:
    return [0] * (len(CUBOS) + 1)


def leer_hist(texto: Any) -> list[int]:
    try:
        h = json.loads(texto or "[]")
        if isinstance(h, list) and len(h) == len(CUBOS) + 1:
            return [max(0, int(x)) for x in h]
    except Exception:  # noqa: BLE001
        pass
    return hist_vacio()


def sumar_hist(a: list[int], b: list[int]) -> list[int]:
    return [x + y for x, y in zip(a, b)]


def percentil(hist: list[int], p: float) -> int:
    """
    El tiempo (ms) por debajo del cual queda la fracción `p` de las
    peticiones. Aproximado: dentro de cada cubo se reparte en línea recta. El
    último cubo (más de 8 s) se cuenta como de 8 a 16 s.
    """
    total = sum(hist)
    if total <= 0:
        return 0
    objetivo = p * total
    acumulado = 0.0
    for i, n in enumerate(hist):
        if n <= 0:
            continue
        if acumulado + n >= objetivo:
            abajo = CUBOS[i - 1] if i > 0 else 0
            arriba = CUBOS[i] if i < len(CUBOS) else CUBOS[-1] * 2
            dentro = (objetivo - acumulado) / n
            return int(round(abajo + (arriba - abajo) * dentro))
        acumulado += n
    return CUBOS[-1] * 2


ROLES = {1: "admin", 2: "admin", 3: "profe", 4: "alumno", 5: "profe", 6: "closer"}


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def ahora_iso() -> str:
    return _iso(datetime.now(timezone.utc))


def resumir(filas: Iterable[dict], ahora: datetime, dias: int = 7) -> dict:
    """
    El resumen del panel a partir de las filas de `estado_evento` (como
    diccionarios). Puro: no toca la base de datos.

    - `errores`: por ruta y mensaje, cuántas veces, a cuántas personas, la
      última vez y cuántas de ellas hoy.
    - `lentas`: las peticiones que pasaron del umbral, por ruta.
    - `rutas`: de los `tiempos`, cada ruta con sus peticiones, mediana y p95.
    - `pantallas`: las que se rompieron en el navegador, por página y mensaje.
    - `arranques`: los reinicios.
    """
    hoy = _iso(ahora)[:10]
    desde = _iso(ahora - timedelta(days=dias))
    errores: dict[tuple, dict] = {}
    lentas: dict[tuple, dict] = {}
    pantallas: dict[tuple, dict] = {}
    rutas: dict[tuple, dict] = {}
    arranques: list[dict] = []

    def _suma(mapa: dict, clave: tuple, f: dict, base: dict) -> dict:
        g = mapa.get(clave)
        if g is None:
            g = {**base, "veces": 0, "hoy": 0, "personas": set(), "anonimas": 0, "ultima": "", "navegadores": {}, "versiones": set()}
            mapa[clave] = g
        veces = int(f.get("veces") or 1)
        g["veces"] += veces
        if (f.get("cuando") or "")[:10] == hoy or (f.get("ultima") or "")[:10] == hoy:
            g["hoy"] += veces
        if f.get("user_id"):
            g["personas"].add(f["user_id"])
        else:
            g["anonimas"] += 1
        ultima = f.get("ultima") or f.get("cuando") or ""
        if ultima > g["ultima"]:
            g["ultima"] = ultima
        nav = f.get("navegador") or ""
        if nav:
            g["navegadores"][nav] = g["navegadores"].get(nav, 0) + veces
        if f.get("version"):
            g["versiones"].add(f["version"])
        return g

    for f in filas:
        cuando = f.get("cuando") or ""
        if cuando < desde:
            continue
        tipo = f.get("tipo")
        if tipo == "error-api":
            _suma(
                errores, (f.get("metodo"), f.get("ruta"), f.get("status"), f.get("mensaje")), f,
                {"metodo": f.get("metodo") or "", "ruta": f.get("ruta") or "", "status": int(f.get("status") or 0),
                 "mensaje": f.get("mensaje") or "", "pagina": f.get("pagina") or ""},
            )
        elif tipo == "lenta":
            g = _suma(
                lentas, (f.get("metodo"), f.get("ruta")), f,
                {"metodo": f.get("metodo") or "", "ruta": f.get("ruta") or "", "peor_ms": 0},
            )
            g["peor_ms"] = max(g["peor_ms"], int(f.get("ms") or 0))
        elif tipo == "error-pantalla":
            g = _suma(
                pantallas, (f.get("pagina"), f.get("mensaje")), f,
                {"pagina": f.get("pagina") or "", "mensaje": f.get("mensaje") or "", "traducida": 0, "app": 0, "trozo": 0},
            )
            extra = (f.get("extra") or "").split(",")
            veces = int(f.get("veces") or 1)
            for marca in ("traducida", "app", "trozo"):
                if marca in extra:
                    g[marca] += veces
        elif tipo == "tiempos":
            clave = (f.get("metodo"), f.get("ruta"))
            r = rutas.get(clave)
            if r is None:
                r = {"metodo": f.get("metodo") or "", "ruta": f.get("ruta") or "", "hist": hist_vacio(), "suma_ms": 0, "peor_ms": 0}
                rutas[clave] = r
            r["hist"] = sumar_hist(r["hist"], leer_hist(f.get("mensaje")))
            r["suma_ms"] += int(f.get("ms") or 0)
            r["peor_ms"] = max(r["peor_ms"], int(f.get("status") or 0))
        elif tipo == "arranque":
            arranques.append({"cuando": cuando, "version": f.get("version") or ""})

    def _cerrar(g: dict) -> dict:
        navs = sorted(g.pop("navegadores").items(), key=lambda x: -x[1])
        g["personas"] = len(g["personas"])
        g["navegadores"] = [{"nombre": n, "veces": v} for n, v in navs[:5]]
        g["versiones"] = sorted(g["versiones"])
        return g

    # Lo de hoy arriba y, dentro, lo más reciente.
    lista_errores = sorted((_cerrar(g) for g in errores.values()), key=lambda g: g["ultima"], reverse=True)
    lista_errores.sort(key=lambda g: g["hoy"], reverse=True)
    lista_lentas = sorted((_cerrar(g) for g in lentas.values()), key=lambda g: g["veces"], reverse=True)
    lista_pantallas = sorted((_cerrar(g) for g in pantallas.values()), key=lambda g: g["ultima"], reverse=True)
    lista_pantallas.sort(key=lambda g: g["hoy"], reverse=True)

    lista_rutas = []
    for r in rutas.values():
        n = sum(r["hist"])
        if n <= 0:
            continue
        lista_rutas.append({
            "metodo": r["metodo"], "ruta": r["ruta"], "peticiones": n,
            "mediana_ms": percentil(r["hist"], 0.5), "p95_ms": percentil(r["hist"], 0.95),
            "media_ms": int(round(r["suma_ms"] / n)), "peor_ms": r["peor_ms"],
            # Lo que más pesa de verdad: tiempo total gastado en esa ruta.
            "total_s": int(round(r["suma_ms"] / 1000)),
        })
    # Las más lentas primero, pero solo las que se piden de verdad (5 o más).
    lista_rutas.sort(key=lambda r: (r["peticiones"] >= 5, r["p95_ms"]), reverse=True)

    arranques.sort(key=lambda a: a["cuando"], reverse=True)

    errores_hoy = sum(g["hoy"] for g in lista_errores)
    pantallas_hoy = sum(g["hoy"] for g in lista_pantallas)
    return {
        "dias": dias,
        "errores": lista_errores[:60],
        "lentas": lista_lentas[:40],
        "rutas": lista_rutas[:40],
        "pantallas": lista_pantallas[:60],
        "arranques": arranques[:20],
        "hoy": {
            "errores": errores_hoy,
            "rutas_con_error": sum(1 for g in lista_errores if g["hoy"]),
            "pantallas": pantallas_hoy,
            "paginas_rotas": len({g["pagina"] for g in lista_pantallas if g["hoy"]}),
            "lentas": sum(g["hoy"] for g in lista_lentas),
            "arranques": sum(1 for a in arranques if a["cuando"][:10] == hoy),
        },
        "semana": {
            "errores": sum(g["veces"] for g in lista_errores),
            "pantallas": sum(g["veces"] for g in lista_pantallas),
            "lentas": sum(g["veces"] for g in lista_lentas),
        },
    }


def _plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def semaforo(resumen: dict, vivo: Optional[dict] = None) -> dict:
    """La frase de arriba del panel: verde, ámbar o rojo, y por qué."""
    hoy = resumen.get("hoy") or {}
    fallan = [c for c in (vivo or {}).get("comprobaciones", []) if c.get("ok") is False]
    caidas = [c["nombre"] for c in fallan if c["nombre"] != ESPACIO]
    if caidas:
        return {"color": "rojo", "frase": "Ahora mismo no responde: " + ", ".join(caidas) + "."}
    if fallan:
        return {"color": "rojo", "frase": "Queda poco espacio para archivos: " + (fallan[0].get("detalle") or "") + "."}
    errores = int(hoy.get("errores") or 0)
    pantallas = int(hoy.get("pantallas") or 0)
    if not errores and not pantallas:
        lentas = int(hoy.get("lentas") or 0)
        if lentas >= 20:
            return {"color": "ambar", "frase": f"Sin errores hoy, pero {_plural(lentas, 'petición ha ido lenta', 'peticiones han ido lentas')}."}
        return {"color": "verde", "frase": "Todo bien: hoy no ha fallado nada."}
    trozos = []
    if errores:
        trozos.append(
            f"{_plural(errores, 'error', 'errores')} hoy en "
            f"{_plural(int(hoy.get('rutas_con_error') or 0), 'acción', 'acciones')}"
        )
    if pantallas:
        trozos.append(
            f"{_plural(pantallas, 'pantalla rota', 'pantallas rotas')} en "
            f"{_plural(int(hoy.get('paginas_rotas') or 0), 'página', 'páginas')}"
        )
    color = "rojo" if errores + pantallas >= 10 else "ambar"
    return {"color": color, "frase": " y ".join(trozos) + "."}


# ── La cola en memoria ───────────────────────────────────────────────────────

_cola: deque = deque(maxlen=400)
# (hora ISO, método, ruta) -> [histograma, suma de ms, el peor ms]
_tiempos: dict[tuple[str, str, str], list] = {}
_tarea: Optional[asyncio.Task] = None
_arranque_apuntado = False
_minuto_actual = ""
_escritas_este_minuto = 0
_tiradas = 0
_activo: Optional[bool] = None


def activo() -> bool:
    global _activo
    if _activo is None:
        apagado = os.getenv("LEARNHOUSE_ESTADO", "").strip().lower() in ("off", "0", "no", "false")
        pruebas = os.getenv("TESTING", "false").lower() == "true"
        _activo = not (apagado or pruebas)
    return _activo


def version() -> str:
    for nombre in ("RAILWAY_GIT_COMMIT_SHA", "RAILWAY_DEPLOYMENT_ID", "GIT_COMMIT", "SOURCE_COMMIT"):
        v = os.getenv(nombre, "").strip()
        if v:
            return v[:12]
    return ""


def apuntar(evento: dict) -> None:
    """Deja un apunte en la cola. No espera, no falla, no toca la base."""
    try:
        if not activo():
            return
        evento.setdefault("cuando", ahora_iso())
        _cola.append(evento)
    except Exception:  # noqa: BLE001
        pass


def apuntar_tiempo(metodo: str, ruta: str, ms: float) -> None:
    """Suma una petición al histograma de su ruta. Microsegundos."""
    try:
        hora = time.strftime("%Y-%m-%dT%H:00:00", time.gmtime())
        clave = (hora, metodo, ruta)
        t = _tiempos.get(clave)
        if t is None:
            if len(_tiempos) >= MAX_RUTAS:
                return
            t = [hist_vacio(), 0.0, 0.0]
            _tiempos[clave] = t
        t[0][cubo_de(ms)] += 1
        t[1] += ms
        if ms > t[2]:
            t[2] = ms
    except Exception:  # noqa: BLE001
        pass


def asegurar_tarea() -> None:
    """
    Arranca la tarea de fondo la primera vez que llega una petición (y la
    vuelve a arrancar si se murió). Se llama desde el middleware: sin tocar el
    arranque de la aplicación.
    """
    global _tarea, _arranque_apuntado
    if _tarea is not None and not _tarea.done():
        return
    try:
        if not activo():
            return
        if not _arranque_apuntado:
            _arranque_apuntado = True
            apuntar({"tipo": "arranque", "cuando": _iso(ARRANQUE), "mensaje": "La API ha arrancado"})
        _tarea = asyncio.get_running_loop().create_task(_bucle())
    except Exception:  # noqa: BLE001
        _tarea = None


async def _bucle() -> None:
    vuelta = 0
    while True:
        await asyncio.sleep(CADA_SEG)
        vuelta += 1
        try:
            await vaciar()
            if vuelta % VUELTAS_TIEMPOS == 0:
                await volcar_tiempos()
            # Cada 6 horas (y a los 5 minutos de arrancar), fuera lo viejo.
            if vuelta == VUELTAS_TIEMPOS or vuelta % (6 * 3600 // CADA_SEG) == 0:
                await borrar_viejos()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.warning("Estado: no se pudo escribir lo apuntado", exc_info=True)


def _cupo(n: int, ahora: str) -> int:
    """Cuántas de `n` filas caben todavía en este minuto."""
    global _minuto_actual, _escritas_este_minuto
    minuto = _minuto(ahora)
    if minuto != _minuto_actual:
        _minuto_actual = minuto
        _escritas_este_minuto = 0
    caben = max(0, TOPE_POR_MINUTO - _escritas_este_minuto)
    toma = min(n, caben)
    _escritas_este_minuto += toma
    return toma


def _fabrica():
    from src.core.events.database import _async_session_factory

    return _async_session_factory


async def _personas(eventos: list[dict], db_session) -> None:
    """Cambia la sesión de cada apunte por el id y el rol de la persona."""
    correos: dict[str, list[dict]] = {}
    for e in eventos:
        token = e.pop("token", None)
        e["navegador"] = navegador_de(e.pop("ua", "")) or e.get("navegador") or ""
        if not token or e.get("user_id"):
            continue
        try:
            from src.security.auth import decode_jwt

            sub = (decode_jwt(token) or {}).get("sub")
            if sub:
                correos.setdefault(str(sub).lower(), []).append(e)
        except Exception:  # noqa: BLE001
            continue
    if not correos:
        return
    try:
        from sqlalchemy import func
        from sqlmodel import select

        from src.db.user_organizations import UserOrganization
        from src.db.users import User

        filas = (await db_session.execute(
            select(User.id, User.email).where(func.lower(User.email).in_(list(correos)))
        )).all()
        ids = {str(correo).lower(): uid for uid, correo in filas}
        roles: dict[int, int] = {}
        if ids:
            for uid, rol in (await db_session.execute(
                select(UserOrganization.user_id, UserOrganization.role_id).where(UserOrganization.user_id.in_(list(ids.values())))
            )).all():
                roles.setdefault(uid, rol)
        for correo, lista in correos.items():
            uid = ids.get(correo)
            for e in lista:
                e["user_id"] = uid
                e["rol"] = ROLES.get(roles.get(uid or 0, 0), "")
    except Exception:  # noqa: BLE001
        logger.debug("Estado: no se pudo saber de quién era un apunte", exc_info=True)


def _fila(g: dict):
    from src.db.estado import EstadoEvento

    return EstadoEvento(
        tipo=str(g.get("tipo") or "")[:20],
        cuando=str(g.get("cuando") or ahora_iso())[:32],
        ultima=str(g.get("ultima") or g.get("cuando") or "")[:32],
        clave=str(g.get("clave") or "")[:40],
        ruta=str(g.get("ruta") or "")[:200],
        metodo=str(g.get("metodo") or "")[:8],
        status=int(g.get("status") or 0),
        ms=int(g.get("ms") or 0),
        mensaje=str(g.get("mensaje") or "")[:600],
        user_id=g.get("user_id") or None,
        rol=str(g.get("rol") or "")[:20],
        navegador=str(g.get("navegador") or "")[:60],
        pagina=str(g.get("pagina") or "")[:200],
        extra=str(g.get("extra") or "")[:80],
        version=str(g.get("version") or version())[:40],
        veces=int(g.get("veces") or 1),
    )


async def vaciar() -> int:
    """Escribe lo que haya en la cola, agrupado y con tope. Devuelve las filas."""
    global _tiradas
    if not _cola:
        return 0
    eventos: list[dict] = []
    while _cola:
        eventos.append(_cola.popleft())
    escritas = 0
    try:
        from sqlmodel import select

        from src.db.estado import EstadoEvento

        async with _fabrica()() as db_session:
            await _personas(eventos, db_session)
            grupos = agrupar(eventos)
            caben = _cupo(len(grupos), ahora_iso())
            _tiradas += len(grupos) - caben
            grupos = grupos[:caben]
            if not grupos:
                return 0
            # Si el mismo fallo ya tiene fila de este minuto, se le suma.
            ya = {}
            claves = [g["clave"] for g in grupos]
            for f in (await db_session.execute(select(EstadoEvento).where(EstadoEvento.clave.in_(claves)))).scalars().all():
                ya[f.clave] = f
            for g in grupos:
                f = ya.get(g["clave"])
                if f is not None:
                    f.veces = int(f.veces or 1) + int(g["veces"])
                    f.ms = max(int(f.ms or 0), int(g.get("ms") or 0))
                    f.ultima = max(f.ultima or "", g.get("ultima") or "")
                    db_session.add(f)
                else:
                    db_session.add(_fila(g))
                escritas += 1
            await db_session.commit()
    except Exception:  # noqa: BLE001
        logger.warning("Estado: no se pudieron guardar %s apuntes", len(eventos), exc_info=True)
        return 0
    return escritas


async def volcar_tiempos() -> int:
    """Pasa los histogramas en memoria a sus filas `tiempos` (una por ruta y hora)."""
    global _tiempos
    if not _tiempos:
        return 0
    pendientes, _tiempos = _tiempos, {}
    try:
        from sqlmodel import select

        from src.db.estado import EstadoEvento

        claves = {k: clave_de("tiempos", k[0], k[1], k[2]) for k in pendientes}
        async with _fabrica()() as db_session:
            ya = {
                f.clave: f
                for f in (await db_session.execute(
                    select(EstadoEvento).where(EstadoEvento.tipo == "tiempos", EstadoEvento.clave.in_(list(claves.values())))
                )).scalars().all()
            }
            for (hora, metodo, ruta), (hist, suma, peor) in pendientes.items():
                clave = claves[(hora, metodo, ruta)]
                f = ya.get(clave)
                if f is None:
                    db_session.add(EstadoEvento(
                        tipo="tiempos", cuando=hora, ultima=ahora_iso(), clave=clave, ruta=ruta[:200], metodo=metodo[:8],
                        # En `tiempos`, `status` guarda el peor tiempo y `ms` la suma.
                        status=int(peor), ms=int(suma), mensaje=json.dumps(hist), version=version(), veces=sum(hist),
                    ))
                else:
                    f.mensaje = json.dumps(sumar_hist(leer_hist(f.mensaje), hist))
                    f.ms = int(f.ms or 0) + int(suma)
                    f.status = max(int(f.status or 0), int(peor))
                    f.veces = int(f.veces or 0) + sum(hist)
                    f.ultima = ahora_iso()
                    db_session.add(f)
            await db_session.commit()
        return len(pendientes)
    except Exception:  # noqa: BLE001
        logger.warning("Estado: no se pudieron guardar los tiempos", exc_info=True)
        return 0


async def borrar_viejos() -> None:
    try:
        from sqlalchemy import delete

        from src.db.estado import EstadoEvento

        limite = _iso(datetime.now(timezone.utc) - timedelta(days=DIAS_GUARDADOS))
        async with _fabrica()() as db_session:
            await db_session.execute(delete(EstadoEvento).where(EstadoEvento.cuando < limite))
            await db_session.commit()
    except Exception:  # noqa: BLE001
        logger.debug("Estado: no se pudo borrar lo viejo", exc_info=True)


# ── La pantalla rota que avisa el navegador ──────────────────────────────────

def evento_de_pantalla(datos: dict, user_agent: str = "") -> Optional[dict]:
    """
    El aviso del navegador, limpio. `datos`: {m: mensaje, p: primera línea de
    la pila, u: página, t: traducida, a: app instalada, d: «global» o «trozo»,
    n: nombre del trozo}.
    """
    if not isinstance(datos, dict):
        return None
    mensaje = limpiar_texto(datos.get("m"), 240)
    if not mensaje:
        return None
    pila = limpiar_texto(datos.get("p"), 200)
    extra = []
    if datos.get("t"):
        extra.append("traducida")
    if datos.get("a"):
        extra.append("app")
    if str(datos.get("d") or "") == "trozo":
        extra.append("trozo")
    nombre = limpiar_texto(datos.get("n"), 40)
    return {
        "tipo": "error-pantalla",
        "mensaje": (mensaje + (f" · {pila}" if pila and pila not in mensaje else ""))[:600],
        "pagina": limpiar_ruta(datos.get("u")),
        "extra": ",".join(extra),
        "ruta": nombre,
        "ua": user_agent,
    }


# ── Lo que se lee en el panel ────────────────────────────────────────────────

CLAVES = (
    ("Stripe (cobros)", ("LEARNHOUSE_STRIPE_SECRET_KEY",)),
    ("Stripe (avisos de pago)", ("LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET",)),
    ("Resend (correos)", ("LEARNHOUSE_RESEND_API_KEY",)),
    ("Daily (salas)", ("LEARNHOUSE_DAILY_API_KEY",)),
    ("Calendly (llamadas)", ("LEARNHOUSE_CALENDLY_TOKEN",)),
    ("systeme.io", ("SYSTEME_API_KEY",)),
    ("ElevenLabs (audio)", ("ELEVENLABS_API_KEY",)),
    ("Copias de seguridad", ("LEARNHOUSE_BACKUP_TOKEN",)),
    ("Tarea diaria", ("LEARNHOUSE_CRON_TOKEN",)),
)


def claves_puestas(entorno: Optional[dict] = None) -> list[dict]:
    """Solo si cada clave está puesta o no. NUNCA su valor."""
    e = os.environ if entorno is None else entorno
    return [{"nombre": nombre, "puesta": any(bool(str(e.get(v) or "").strip()) for v in variables)} for nombre, variables in CLAVES]


def _carpeta_content() -> str:
    for ruta in ("content", "/app/api/content"):
        if os.path.isdir(ruta):
            return ruta
    return "."


async def _cronometrar(nombre: str, corrutina) -> dict:
    t0 = time.perf_counter()
    try:
        detalle = await asyncio.wait_for(corrutina, timeout=5)
        return {"nombre": nombre, "ok": True, "ms": int((time.perf_counter() - t0) * 1000), "detalle": detalle or ""}
    except Exception as exc:  # noqa: BLE001
        return {
            "nombre": nombre, "ok": False, "ms": int((time.perf_counter() - t0) * 1000),
            "detalle": limpiar_texto(f"{type(exc).__name__}: {exc}", 160),
        }


async def en_vivo(db_session) -> dict:
    """Las comprobaciones de ahora mismo, cada una con lo que tarda."""
    from sqlalchemy import text

    async def _base():
        await db_session.execute(text("SELECT 1"))
        return ""

    async def _redis():
        from src.services.security.rate_limiting import _get_redis_pool_client

        r = _get_redis_pool_client()
        if r is None:
            raise RuntimeError("Redis no está configurado")
        await asyncio.to_thread(r.ping)
        return ""

    comprobaciones = [
        await _cronometrar("Base de datos", _base()),
        await _cronometrar("Redis", _redis()),
    ]
    disco: dict = {}
    try:
        uso = shutil.disk_usage(_carpeta_content())
        disco = {
            "total_mb": int(uso.total / 1_048_576), "usado_mb": int(uso.used / 1_048_576),
            "libre_mb": int(uso.free / 1_048_576),
            # Sobre lo usado + lo libre: con cupo, «total» puede ser el disco entero.
            "pct": int(round(uso.used * 100 / (uso.used + uso.free))) if (uso.used + uso.free) else 0,
        }
        comprobaciones.append({
            "nombre": ESPACIO, "ok": disco["pct"] < 90, "ms": 0,
            "detalle": f"{disco['pct']} % usado · quedan {disco['libre_mb']} MB",
        })
    except Exception:  # noqa: BLE001
        pass
    ahora = datetime.now(timezone.utc)
    return {
        "comprobaciones": comprobaciones,
        "disco": disco,
        "claves": claves_puestas(),
        "version": version(),
        "arrancado": _iso(ARRANQUE),
        "arrancado_hace_s": int((ahora - ARRANQUE).total_seconds()),
        "apuntando": activo(),
        "sin_guardar": {"cola": len(_cola), "tiradas_por_tope": _tiradas},
        "umbral_lenta_ms": UMBRAL_LENTA_MS,
    }


async def panel(db_session, dias: int = 7) -> dict:
    """Todo lo del panel: comprobaciones en vivo + resumen de la semana."""
    vivo = await en_vivo(db_session)
    filas: list[dict] = []
    aviso = ""
    try:
        # Lo que aún está en memoria, a la base antes de leer.
        await vaciar()
        await volcar_tiempos()
        from sqlmodel import select

        from src.db.estado import EstadoEvento

        desde = _iso(datetime.now(timezone.utc) - timedelta(days=dias))
        for f in (await db_session.execute(
            select(EstadoEvento).where(EstadoEvento.cuando >= desde).order_by(EstadoEvento.id.desc()).limit(20000)  # type: ignore[union-attr]
        )).scalars().all():
            filas.append({
                "tipo": f.tipo, "cuando": f.cuando, "ultima": f.ultima, "ruta": f.ruta, "metodo": f.metodo,
                "status": f.status, "ms": f.ms, "mensaje": f.mensaje, "user_id": f.user_id, "rol": f.rol,
                "navegador": f.navegador, "pagina": f.pagina, "extra": f.extra, "version": f.version, "veces": f.veces,
            })
    except Exception as exc:  # noqa: BLE001
        aviso = limpiar_texto(f"No se pudo leer lo apuntado: {type(exc).__name__}: {exc}", 200)
        try:
            await db_session.rollback()
        except Exception:  # noqa: BLE001
            pass
    resumen = resumir(filas, datetime.now(timezone.utc), dias)
    return {"vivo": vivo, "resumen": resumen, "semaforo": semaforo(resumen, vivo), "aviso": aviso}

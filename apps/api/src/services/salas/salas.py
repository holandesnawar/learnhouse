"""
Salas en directo DENTRO de la escuela, con Daily (27/10/2026).

Pedido del usuario: "el Spreekclub estilo YouTalk, con las salas integradas:
la gente se une y ya está en la sala, dentro de la escuela, sin otra pestaña y
con su nombre puesto". Se empieza solo con el Spreekclub, para probar.

Por qué Daily y no Zoom dentro de la web: Daily está hecho para meterlo en una
página (un iframe con su pantalla, «Daily Prebuilt»), va en el navegador del
móvil sin instalar nada y se paga por minuto usado. El SDK de Zoom pesa, va
peor en el iPhone, pide cabeceras de seguridad que romperían la caja de pago y
los vídeos de Bunny, y cada profe a la vez necesita su licencia.

Cómo va
-------
- **Una sala fija por curso** (`nombre_sala`: `nawar-` + el principio del
  uuid del curso). Se crea en Daily la primera vez que alguien entra y luego se
  reutiliza. Es PRIVADA: sin una entrada firmada por la escuela no se entra,
  así que el enlace no sirve para un amigo (con Zoom, sí).
- **La entrada** (un «meeting token» de Daily) la fabrica la escuela al pulsar
  «Entrar a la sala», solo a quien puede ver ese curso (la misma comprobación
  que la página del curso). Lleva su nombre (`user_name`), así que nadie lo
  escribe, y caduca a las 4 h con expulsión (`eject_at_token_exp`): una
  pestaña olvidada no se queda gastando minutos toda la noche.
- **El equipo** (administradores, moderadores y profes, `STAFF_ROLE_IDS`) entra
  como anfitrión (`is_owner`): silencia, saca a alguien, comparte pantalla.
- **Grabar**: si el curso lo tiene puesto, la entrada del EQUIPO lleva
  `start_cloud_recording`, así que la grabación arranca sola cuando entra el
  profe (no cuando entra un alumno a esperar) y se para cuando se vacía la
  sala. Se paga aparte en Daily. Si Daily no deja grabar (plan, cuenta…), la
  entrada se repite SIN grabar y la pantalla enseña el motivo tal cual: la
  clase no se queda sin sala por la grabación.
- Las grabaciones se quedan en Daily y el administrador las ve en la página
  del curso con «Descargar» (`grabaciones`, `enlace_descarga`). Subirlas solas
  a Bunny es el paso siguiente, sin hacer.

Ajustes: org_config `salas` = {uuid del curso (sin `course_`): {activo,
grabar}}. Sin nada guardado, la sala está apagada: se enciende curso a curso
desde la propia página del curso (solo administradores).

La clave es `LEARNHOUSE_DAILY_API_KEY` (Railway). Sin ella, la pantalla dice
que falta y el resto de la escuela sigue igual. Los errores de Daily se
enseñan con SU texto: lo primero cuando algo falla es leer el motivo.
"""

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig

logger = logging.getLogger(__name__)

API = "https://api.daily.co/v1"
CLAVE = "salas"
HORAS_ENTRADA = 4
# La URL de cada sala, para no preguntársela a Daily en cada entrada.
_salas: dict[str, str] = {}


class SalaError(Exception):
    """Un fallo que se le enseña tal cual a quien entra (con el texto de Daily)."""

    def __init__(self, mensaje: str, status: int = 502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def clave_api() -> str:
    return (os.environ.get("LEARNHOUSE_DAILY_API_KEY") or "").strip()


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def uuid_curso(course_uuid: str) -> str:
    """El uuid sin el prefijo `course_` de la base de datos."""
    return re.sub(r"^course_", "", str(course_uuid or "").strip())


def nombre_sala(course_uuid: str) -> str:
    """`nawar-` + 16 letras del uuid: fijo para cada curso y válido en Daily
    (letras, números y guiones)."""
    limpio = re.sub(r"[^a-z0-9]", "", uuid_curso(course_uuid).lower())
    return f"nawar-{limpio[:16]}"


def leer_config(config: Any, course_uuid: str) -> dict:
    """Los ajustes de la sala de un curso. Apagada si no hay nada guardado."""
    todas = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid_curso(course_uuid)) if isinstance(todas, dict) else None
    propia = propia if isinstance(propia, dict) else {}
    return {"activo": bool(propia.get("activo")), "grabar": bool(propia.get("grabar"))}


def nombre_visible(first_name: str, last_name: str, username: str) -> str:
    """El nombre con el que se entra: nombre y apellido; si no hay, el usuario."""
    nombre = " ".join(p.strip() for p in (first_name or "", last_name or "") if p and p.strip())
    return (nombre or (username or "").strip() or "Alumno")[:60]


def propiedades_entrada(sala: str, nombre: str, user_id: int, anfitrion: bool, grabar: bool, ahora: float) -> dict:
    """Lo que lleva la entrada de Daily. Graba solo el anfitrión: así la
    grabación empieza cuando entra el profe, no cuando un alumno espera."""
    props: dict = {
        "room_name": sala,
        "user_name": nombre,
        "user_id": str(user_id),
        "is_owner": bool(anfitrion),
        "lang": "es",
        "exp": int(ahora) + HORAS_ENTRADA * 3600,
        "eject_at_token_exp": True,
    }
    if anfitrion and grabar:
        props["enable_recording"] = "cloud"
        props["start_cloud_recording"] = True
    return props


def presentes_de(respuesta: Any) -> list[str]:
    """Los nombres de quien está ahora en la sala (respuesta de `/presence`)."""
    filas = (respuesta or {}).get("data") if isinstance(respuesta, dict) else None
    nombres = []
    for f in filas or []:
        if isinstance(f, dict):
            n = str(f.get("userName") or f.get("user_name") or "").strip()
            nombres.append(n or "Alguien")
    return nombres


def grabacion_de(r: dict) -> dict:
    """Una grabación de Daily en lo que enseña la pantalla."""
    inicio = r.get("start_ts")
    try:
        cuando = datetime.fromtimestamp(int(inicio), tz=timezone.utc).isoformat() if inicio else ""
    except (TypeError, ValueError):
        cuando = ""
    return {
        "id": str(r.get("id") or ""),
        "inicio": cuando,
        "duracion_seg": int(r.get("duration") or 0),
        "estado": str(r.get("status") or ""),
        "personas": int(r.get("max_participants") or 0),
    }


def motivo_daily(cuerpo: Any, status: int) -> str:
    """El texto que da Daily cuando algo falla, para enseñarlo tal cual."""
    if isinstance(cuerpo, dict):
        partes = [str(cuerpo.get(k)) for k in ("error", "info") if cuerpo.get(k)]
        if partes:
            return f"Daily ({status}): " + " · ".join(partes)
    return f"Daily ({status}): {str(cuerpo)[:300]}" if cuerpo else f"Daily respondió {status}"


# ── Hablar con Daily ────────────────────────────────────────────────────────


async def _daily(metodo: str, ruta: str, cuerpo: Optional[dict] = None, params: Optional[dict] = None) -> dict:
    clave = clave_api()
    if not clave:
        raise SalaError("Falta la clave de Daily: LEARNHOUSE_DAILY_API_KEY en Railway.", 503)
    try:
        async with httpx.AsyncClient(timeout=12) as cliente:
            r = await cliente.request(
                metodo,
                f"{API}{ruta}",
                json=cuerpo,
                params=params,
                headers={"Authorization": f"Bearer {clave}"},
            )
    except httpx.HTTPError as exc:
        raise SalaError(f"No se pudo hablar con Daily: {exc.__class__.__name__}", 502) from exc
    try:
        datos = r.json()
    except ValueError:
        datos = r.text
    if r.status_code >= 400:
        raise SalaError(motivo_daily(datos, r.status_code), r.status_code)
    return datos if isinstance(datos, dict) else {}


async def asegurar_sala(sala: str) -> str:
    """La dirección de la sala; la crea en Daily si aún no existe."""
    if sala in _salas:
        return _salas[sala]
    try:
        datos = await _daily("GET", f"/rooms/{sala}")
    except SalaError as exc:
        if exc.status != 404:
            raise
        datos = await _daily(
            "POST",
            "/rooms",
            {
                "name": sala,
                "privacy": "private",
                "properties": {
                    "lang": "es",
                    "enable_prejoin_ui": True,
                    "enable_screenshare": True,
                    "enable_chat": True,
                },
            },
        )
    url = str(datos.get("url") or "")
    if not url:
        raise SalaError("Daily no devolvió la dirección de la sala.")
    _salas[sala] = url
    return url


async def entrar(course_uuid: str, user, anfitrion: bool, grabar: bool) -> dict:
    """La dirección y la entrada para meter a esta persona en la sala."""
    sala = nombre_sala(course_uuid)
    url = await asegurar_sala(sala)
    nombre = nombre_visible(getattr(user, "first_name", ""), getattr(user, "last_name", ""), getattr(user, "username", ""))
    props = propiedades_entrada(sala, nombre, user.id, anfitrion, grabar, time.time())
    aviso = ""
    try:
        datos = await _daily("POST", "/meeting-tokens", {"properties": props})
    except SalaError as exc:
        if not props.get("start_cloud_recording") or exc.status >= 500:
            raise
        # Daily no deja grabar (plan, cuenta…): se entra igual, sin grabar, y
        # se dice por qué. La clase no se queda sin sala por la grabación.
        logger.warning("Daily no dejó grabar: %s", exc.mensaje)
        aviso = f"No se está grabando. {exc.mensaje}"
        props = {k: v for k, v in props.items() if k not in ("enable_recording", "start_cloud_recording")}
        datos = await _daily("POST", "/meeting-tokens", {"properties": props})
    token = str(datos.get("token") or "")
    if not token:
        raise SalaError("Daily no devolvió la entrada a la sala.")
    return {
        "url": url,
        "token": token,
        "nombre": nombre,
        "anfitrion": bool(anfitrion),
        "grabando": bool(props.get("start_cloud_recording")),
        "aviso": aviso,
    }


async def presentes(course_uuid: str) -> list[str]:
    """Quién está ahora dentro. En blando: si Daily falla, lista vacía."""
    try:
        return presentes_de(await _daily("GET", f"/rooms/{nombre_sala(course_uuid)}/presence"))
    except SalaError as exc:
        if exc.status != 404:
            logger.info("Presencia de la sala: %s", exc.mensaje)
        return []


async def grabaciones(course_uuid: str) -> list[dict]:
    datos = await _daily("GET", "/recordings", params={"room_name": nombre_sala(course_uuid), "limit": 50})
    filas = [grabacion_de(r) for r in (datos.get("data") or []) if isinstance(r, dict)]
    return sorted(filas, key=lambda g: g["inicio"], reverse=True)


async def enlace_descarga(course_uuid: str, grabacion_id: str) -> str:
    """Enlace de descarga (caduca en Daily al rato). Solo de una grabación de
    ESTA sala."""
    if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", grabacion_id or ""):
        raise SalaError("Grabación no válida.", 400)
    info = await _daily("GET", f"/recordings/{grabacion_id}")
    if str(info.get("room_name") or "") != nombre_sala(course_uuid):
        raise SalaError("Esa grabación no es de este curso.", 404)
    datos = await _daily("GET", f"/recordings/{grabacion_id}/access-link")
    enlace = str(datos.get("download_link") or "")
    if not enlace:
        raise SalaError("Daily no dio el enlace de descarga (¿la grabación aún se está procesando?).", 409)
    return enlace


# ── Ajustes (org_config) ────────────────────────────────────────────────────


async def _fila_config(org_id: int, db_session: AsyncSession) -> Optional[OrganizationConfig]:
    return (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()


async def config_de(org_id: int, course_uuid: str, db_session: AsyncSession) -> dict:
    fila = await _fila_config(org_id, db_session)
    return leer_config(fila.config if fila else {}, course_uuid)


async def _escribir(org_id: int, course_uuid: str, cambios: dict, db_session: AsyncSession) -> dict:
    """Mezcla `cambios` en lo guardado de ese curso (sin perder lo demás:
    el recuadro, `directo`…) y devuelve lo que queda guardado."""
    fila = await _fila_config(org_id, db_session)
    if fila is None:
        raise SalaError("La escuela no tiene configuración.", 500)
    config = json.loads(json.dumps(fila.config or {}))
    todas = config.get(CLAVE) if isinstance(config.get(CLAVE), dict) else {}
    uuid = uuid_curso(course_uuid)
    propia = todas.get(uuid) if isinstance(todas.get(uuid), dict) else {}
    propia = {**propia, **cambios}
    todas[uuid] = propia
    config[CLAVE] = todas
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    await _olvidar_cache(org_id, db_session)
    return propia


async def _olvidar_cache(org_id: int, db_session: AsyncSession) -> None:
    """El navegador lee estos ajustes de la configuración de la escuela, que
    Redis guarda 2 minutos: se borra para que el cambio se vea al recargar."""
    try:
        from src.db.organizations import Organization
        from src.services.orgs.cache import invalidate_org_cache, invalidate_org_config_cache

        invalidate_org_config_cache(org_id)
        org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
        if org is not None:
            invalidate_org_cache(org.slug)
    except Exception:  # noqa: BLE001 — sin caché, se ve a los 2 minutos igual
        logger.debug("No se pudo borrar la caché de la escuela", exc_info=True)


async def guardar_config(
    org_id: int, course_uuid: str, activo: Optional[bool], grabar: Optional[bool], db_session: AsyncSession
) -> dict:
    """Encender/apagar la sala y la grabación. Encenderla marca además el curso
    como de clases en directo (`directo`), y eso se queda al apagarla: así el
    curso no vuelve a pintarse como una formación con «Empezar curso»
    (`esCursoEnDirecto` en apps/web/lib/nawar/cursos.ts)."""
    cambios: dict = {}
    if activo is not None:
        cambios["activo"] = bool(activo)
        if activo:
            cambios["directo"] = True
    if grabar is not None:
        cambios["grabar"] = bool(grabar)
    guardado = await _escribir(org_id, course_uuid, cambios, db_session)
    return {"activo": bool(guardado.get("activo")), "grabar": bool(guardado.get("grabar"))}


# El recuadro de arriba de cada clase en directo (día, hora, profe…). Antes
# había UNO para toda la escuela (`weekly_class_banner`), que sigue valiendo
# para la clase semanal de siempre mientras no se guarde el suyo.
CAMPOS_RECUADRO = ("subtitle", "live_url", "next_day", "next_weekday", "next_date", "schedule", "teacher", "duration")


def limpiar_recuadro(datos: Any) -> dict:
    """Solo los campos conocidos, como texto y con un tope (función pura)."""
    datos = datos if isinstance(datos, dict) else {}
    return {k: str(datos.get(k) or "").strip()[:600] for k in CAMPOS_RECUADRO}


async def guardar_recuadro(org_id: int, course_uuid: str, datos: dict, db_session: AsyncSession) -> dict:
    guardado = await _escribir(org_id, course_uuid, {"banner": limpiar_recuadro(datos)}, db_session)
    return guardado["banner"]

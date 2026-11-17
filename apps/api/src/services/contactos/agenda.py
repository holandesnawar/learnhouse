"""
Agenda: las llamadas reservadas en Calendly, con día, hora y persona.

Para qué
--------
Hasta ahora la escuela solo sabía QUE alguien había reservado (la página de
/agendar avisa con un evento `reunion`), pero no CUÁNDO: el día y la hora solo
estaban en Calendly. El closer tenía que tener las dos pantallas abiertas.
Aquí se le pide a Calendly la lista de citas y se enseña dentro del panel, al
lado de las respuestas de cada persona.

Cómo
----
Con un **token personal de Calendly** (Integraciones → API y webhooks →
Tokens de acceso personal), puesto en Railway como `LEARNHOUSE_CALENDLY_TOKEN`.
Solo se LEE: la lista de citas y quién las reservó. Nada se escribe en
Calendly. Sin la variable, la agenda dice que no está configurada y el resto
del panel sigue igual.

Salen también las citas que se reservaron directamente en Calendly, sin pasar
por /agendar: la lista es la de Calendly, no la nuestra.

Desde el 29/09 trae también las **pasadas** (45 días) y las **canceladas o
reprogramadas**, para que el closer vea en la escuela el calendario entero y
apunte qué pasó en cada llamada (`resultado_llamada.py`). Sigue sin escribir
nada en Calendly.

Desde el 31/10 (Calendly Teams, un usuario por closer y un evento «por turnos»)
lee las citas de TODA la organización de Calendly, no solo las del usuario del
token, y cada cita trae su anfitrión (`anfitrion_email`): el closer que
Calendly le asignó. Con eso la escuela le pone ese closer a la tarjeta
(`reparto.asignar_por_anfitrion`). Si el token no es de un administrador de la
organización (o el plan no tiene organización con más gente), se queda en las
del usuario, como antes.

Falla en blando: si Calendly no contesta, la agenda dice por qué y el panel
sigue funcionando. Caché de un minuto en memoria para no pedirle lo mismo a
Calendly cada vez que alguien abre la pestaña.
"""

import asyncio
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

API = "https://api.calendly.com"
_CACHE_SEG = 60
_cache: dict = {"hasta": 0.0, "datos": None}
# Calendly corta con «429 Too Many Requests» si se le piden muchas cosas
# seguidas. Cada lectura de la agenda pedía los invitados de TODAS las citas
# (cien o más) a la vez, cada minuto y por cada pantalla abierta. Ahora:
# - los invitados de una cita se guardan mientras la cita no cambie
#   (`updated_at`): en cada lectura solo se piden los de las citas nuevas o
#   cambiadas;
# - «quién soy» se guarda una hora;
# - como mucho 4 peticiones a la vez;
# - si Calendly falla (429 u otra cosa) y ya había una agenda leída, se
#   enseña esa en vez del aviso rojo, y no se le vuelve a preguntar durante
#   un rato.
_invitados: dict = {}
_yo: dict = {"hasta": 0.0, "datos": None}
_ESPERA_TRAS_FALLO = 90
_A_LA_VEZ = 4
# Páginas de 100 citas como mucho (16/11: eran 5, y con más de 500 citas en la
# ventana de 165 días se perdían las futuras lejanas, que van al final).
_PAGINAS_MAX = 20
# La última agenda buena también en Redis (16/11): tras un despliegue la de
# memoria está vacía y, si Calendly falla justo entonces, el tablero se quedaba
# sin citas y las tarjetas de Agendado saltaban de columna.
_CLAVE_ULTIMA = "calendly:agenda-ultima-buena"
_TTL_ULTIMA = 3 * 86400
# Una sola petición a Calendly a la vez (16/11): al caducar la copia, varias
# pantallas abiertas pedían la agenda entera a la vez. Uno por bucle de eventos.
_cerrojos: dict[int, asyncio.Lock] = {}


def _cerrojo() -> asyncio.Lock:
    clave = id(asyncio.get_running_loop())
    if clave not in _cerrojos:
        _cerrojos[clave] = asyncio.Lock()
    return _cerrojos[clave]


def _redis():
    try:
        from src.core.redis import get_redis_client

        return get_redis_client()
    except Exception:  # noqa: BLE001
        return None


def _guardar_ultima(datos: dict) -> None:
    r = _redis()
    if r is None:
        return
    try:
        import json

        r.set(_CLAVE_ULTIMA, json.dumps(datos, ensure_ascii=False), ex=_TTL_ULTIMA)
    except Exception:  # noqa: BLE001
        logger.debug("No se pudo guardar la última agenda en Redis", exc_info=True)


def _leer_ultima() -> Optional[dict]:
    r = _redis()
    if r is None:
        return None
    try:
        import json

        crudo = r.get(_CLAVE_ULTIMA)
        if not crudo:
            return None
        datos = json.loads(crudo)
        return datos if isinstance(datos, dict) and isinstance(datos.get("citas"), list) else None
    except Exception:  # noqa: BLE001
        return None


def _token() -> str:
    return (os.environ.get("LEARNHOUSE_CALENDLY_TOKEN") or "").strip()


#: Cómo empieza el motivo de cancelación cuando el EQUIPO cambia la hora desde
#: la escuela (31/10, `reservar.cambiar_hora`). La persona lo lee en el correo
#: de Calendly; la agenda lo usa para saber que esa cita no se canceló: se movió.
MOTIVO_CAMBIO = "Hemos cambiado la hora de tu llamada"
#: Hasta cuántos días por delante se leen las citas. Eran 60; con «Cambiar
#: hora» un closer puede moverla más lejos y no debe desaparecer de la agenda.
DIAS_ADELANTE = 120


def es_cambio_de_hora(motivo: str) -> bool:
    """¿La cancelación es la de un cambio de hora hecho desde la escuela?"""
    return str(motivo or "").strip().lower().startswith(MOTIVO_CAMBIO.lower())


def anfitrion_de(evento: dict) -> tuple[str, str]:
    """(correo, nombre) de quien atiende la cita en Calendly: con un evento
    «por turnos» (round robin), el closer que le tocó. Función pura."""
    for m in evento.get("event_memberships") or []:
        if isinstance(m, dict) and m.get("user_email"):
            return str(m["user_email"]).strip().lower(), str(m.get("user_name") or "")
    return "", ""


#: El nombre de la videollamada por el tipo de ubicación de Calendly (04/11,
#: «un closer con Meet y otro con Zoom»): el WhatsApp dice el que toca.
_PLATAFORMAS = {
    "google_conference": "Google Meet",
    "zoom_conference": "Zoom",
    "microsoft_teams_conference": "Microsoft Teams",
    "webex_conference": "Webex",
    "gotomeeting_conference": "GoToMeeting",
}


def plataforma_de(ubicacion: dict) -> str:
    """«Google Meet», «Zoom»… de la ubicación de una cita de Calendly; vacío si
    no se sabe. Por el tipo y, si no, por el enlace. Función pura (con test)."""
    u = ubicacion if isinstance(ubicacion, dict) else {}
    tipo = str(u.get("type") or "")
    if tipo in _PLATAFORMAS:
        return _PLATAFORMAS[tipo]
    enlace = str(u.get("join_url") or u.get("location") or "").lower()
    if "meet.google." in enlace:
        return "Google Meet"
    if "zoom.us" in enlace:
        return "Zoom"
    if "teams.microsoft." in enlace or "teams.live." in enlace:
        return "Microsoft Teams"
    return ""


_ENLACE = re.compile(r"(https?://\S+|(?:meet\.google\.com|[\w-]+\.zoom\.us|zoom\.us|teams\.microsoft\.com|teams\.live\.com)/\S+)", re.I)


def enlace_en_texto(texto) -> str:
    """El enlace de una ubicación escrita a mano en Calendly («Personalizada»):
    la sala fija de un closer («meet.google.com/abc-defg-hij», con o sin
    https, con texto alrededor). Así el enlace no cambia al reprogramar.
    Función pura (con test)."""
    if not isinstance(texto, str):
        return ""
    m = _ENLACE.search(texto)
    if not m:
        return ""
    enlace = m.group(1).rstrip(".,;)")
    return enlace if enlace.lower().startswith("http") else "https://" + enlace


def cita_desde_calendly(evento: dict, invitados: list[dict]) -> list[dict]:
    """Una cita del panel por invitado. Función pura (con test): recibe lo
    que devuelve Calendly y lo deja en lo que el panel necesita."""
    ubicacion = evento.get("location") or {}
    anfitrion_email, anfitrion = anfitrion_de(evento)
    enlace = ubicacion.get("join_url") or enlace_en_texto(ubicacion.get("location"))
    salida = []
    uuid = str(evento.get("uri", "")).rstrip("/").rsplit("/", 1)[-1]
    evento_cancelado = (evento.get("status") or "active") != "active"
    for inv in invitados:
        cancelada = evento_cancelado or (inv.get("status") or "active") != "active"
        cancelacion = inv.get("cancellation") or evento.get("cancellation") or {}
        # El teléfono solo viene si el evento lo pide (tipo "llamada
        # telefónica") o si hay una pregunta que lo recoja.
        telefono = ubicacion.get("location") if ubicacion.get("type") == "outbound_call" else ""
        for qa in inv.get("questions_and_answers") or []:
            if "tel" in str(qa.get("question", "")).lower() and qa.get("answer"):
                telefono = telefono or qa["answer"]
        salida.append(
            {
                "inicio": evento.get("start_time") or "",
                "fin": evento.get("end_time") or "",
                "titulo": evento.get("name") or "",
                "nombre": inv.get("name") or "",
                "email": (inv.get("email") or "").strip().lower(),
                "telefono": telefono or "",
                "enlace": enlace,
                "plataforma": plataforma_de(ubicacion),
                "cancelar_url": inv.get("cancel_url") or "",
                "cambiar_url": inv.get("reschedule_url") or "",
                # Una por persona y cita: el id sirve para colgarle el resultado.
                "id": f"{uuid}:{(inv.get('email') or '').strip().lower()}" if uuid else "",
                "estado": "cancelada" if cancelada else "activa",
                # Reprogramada = se canceló para coger otra hora; la nueva sale
                # aparte. La cambia la persona en Calendly (`rescheduled`) o el
                # equipo desde la escuela (el motivo empieza por MOTIVO_CAMBIO).
                "reprogramada": bool(inv.get("rescheduled")) or (cancelada and es_cambio_de_hora(cancelacion.get("reason") or "")),
                # Cuándo la reservó (no cuándo es): el tablero la compara con
                # el último movimiento a mano para ponerla en Agendado.
                "reservada": inv.get("created_at") or evento.get("created_at") or "",
                "motivo_cancelacion": str(cancelacion.get("reason") or "")[:300] if cancelada else "",
                # Quién la atiende en Calendly (31/10): con el evento por
                # turnos, el closer que le asignó Calendly.
                "anfitrion_email": anfitrion_email,
                "anfitrion": anfitrion,
                # La campaña con la que se abrió el enlace de Calendly (17/11):
                # Calendly guarda los `utm_*` de la dirección de reserva en
                # `tracking`. Es lo único que dice de dónde viene quien reserva
                # directo en Calendly (el enlace de un setter), sin pasar por la
                # web. La lee la analítica (services/stats/analitica.py).
                "utm": {
                    k: str((inv.get("tracking") or {}).get(k) or "")[:120]
                    for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")
                },
            }
        )
    return salida


async def _get(cliente: httpx.AsyncClient, url: str, params: Optional[dict] = None) -> dict:
    r = await cliente.get(url, params=params)
    if r.status_code == 401:
        raise PermissionError("Calendly rechaza el token (401). Revisa LEARNHOUSE_CALENDLY_TOKEN.")
    r.raise_for_status()
    return r.json()


async def agenda(forzar: bool = False) -> dict:
    """Las citas desde hace 45 días hasta dentro de DIAS_ADELANTE (120),
    activas y canceladas, por fecha."""
    token = _token()
    if not token:
        return {"configurado": False, "citas": []}

    ahora = time.time()
    if not forzar and _cache["datos"] is not None and _cache["hasta"] > ahora:
        return _cache["datos"]
    pedida_a = _cache.get("pedida", 0.0)
    async with _cerrojo():
        # Si mientras esperaba otra pantalla ya la ha pedido, se usa esa.
        if _cache["datos"] is not None and _cache.get("pedida", 0.0) > pedida_a and (
            not forzar or _cache["hasta"] > time.time()
        ):
            return _cache["datos"]
        return await _pedir_agenda(token, ahora)


async def _pedir_agenda(token: str, ahora: float) -> dict:
    desde = (datetime.now(timezone.utc) - timedelta(days=45)).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
    hasta = (datetime.now(timezone.utc) + timedelta(days=DIAS_ADELANTE)).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
    try:
        async with httpx.AsyncClient(
            timeout=10.0, headers={"Authorization": f"Bearer {token}"}
        ) as cliente:
            if _yo["datos"] is not None and _yo["hasta"] > ahora:
                yo = _yo["datos"]
            else:
                yo = (await _get(cliente, f"{API}/users/me")).get("resource") or {}
                _yo["datos"], _yo["hasta"] = yo, ahora + 3600
            # Sin filtro de estado: salen también las canceladas. Se pagina
            # (100 por página) con tope, por si algún día hay muchas.
            eventos: list[dict] = []
            filtro = {"min_start_time": desde, "max_start_time": hasta, "sort": "start_time:asc", "count": 100}
            # Las de toda la organización (los dos closers); si el token no
            # puede (no es administrador de la organización), las suyas.
            pagina = None
            if yo.get("current_organization"):
                try:
                    pagina = await _get(cliente, f"{API}/scheduled_events", {**filtro, "organization": yo["current_organization"]})
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code not in (400, 403, 404):
                        raise
                    logger.info("Calendly no deja leer la organización (%s): solo las del usuario", exc.response.status_code)
            if pagina is None:
                pagina = await _get(cliente, f"{API}/scheduled_events", {**filtro, "user": yo.get("uri", "")})
            for n in range(_PAGINAS_MAX):
                eventos.extend(pagina.get("collection") or [])
                siguiente = (pagina.get("pagination") or {}).get("next_page")
                if not siguiente:
                    break
                if n == _PAGINAS_MAX - 1:
                    logger.warning(
                        "La agenda de Calendly tiene más de %s citas: faltan las más lejanas", _PAGINAS_MAX * 100
                    )
                    break
                pagina = await _get(cliente, siguiente)

            turno = asyncio.Semaphore(_A_LA_VEZ)

            async def invitados(ev: dict) -> list[dict]:
                uuid = str(ev.get("uri", "")).rstrip("/").rsplit("/", 1)[-1]
                clave = (uuid, str(ev.get("updated_at") or ""), str(ev.get("status") or ""))
                guardados = _invitados.get(uuid)
                if guardados is None or guardados[0] != clave:
                    async with turno:
                        datos = await _get(cliente, f"{API}/scheduled_events/{uuid}/invitees", {"count": 20})
                    guardados = (clave, datos.get("collection") or [])
                    _invitados[uuid] = guardados
                return cita_desde_calendly(ev, guardados[1])

            listas = await asyncio.gather(*(invitados(e) for e in eventos))
    except PermissionError as exc:
        return {"configurado": True, "citas": [], "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo leer la agenda de Calendly: %s", exc)
        if _cache["datos"] is None:
            # Tras un despliegue no hay copia en memoria: la de Redis.
            guardada = _leer_ultima()
            if guardada is not None:
                _cache["datos"] = guardada
        if _cache["datos"] is not None:
            # La última agenda buena, y no volver a preguntar en un rato.
            _cache["hasta"] = ahora + _ESPERA_TRAS_FALLO
            _cache["pedida"] = time.time()
            return _cache["datos"]
        if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
            return {"configurado": True, "citas": [], "error": "Calendly pide esperar un momento (demasiadas consultas seguidas). Vuelve a cargar en un minuto."}
        return {"configurado": True, "citas": [], "error": f"Calendly no contesta: {exc}"}

    vivas = {str(e.get("uri", "")).rstrip("/").rsplit("/", 1)[-1] for e in eventos}
    for uuid in list(_invitados):
        if uuid not in vivas:
            del _invitados[uuid]
    citas = sorted((c for lista in listas for c in lista), key=lambda c: c["inicio"])
    datos = {"configurado": True, "citas": citas}
    _cache["datos"] = datos
    _cache["hasta"] = ahora + _CACHE_SEG
    _cache["pedida"] = time.time()
    _guardar_ultima(datos)
    return datos

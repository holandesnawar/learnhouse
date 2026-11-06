"""
Agendar una llamada desde la escuela (15/10/2026).

Pedido del usuario: "desde el calendario de llamadas, un botón o clic en un
sitio vacío para crear una llamada con una persona: meter nombre y mail y que
agende automáticamente. Ahora tengo que ir a Calendly, abrir esa fecha y hora,
meter nombre y mail a mano…".

Cómo
----
- **Las horas libres las da Calendly** (`event_type_available_times`): se
  enseñan las del día elegido y solo se puede coger una de ellas. Así la
  escuela nunca agenda encima de otra cosa ni fuera del horario que se puso en
  Calendly.
- **Reservar**: `POST /invitees` de la API de Calendly. Calendly hace lo de
  siempre, como si la persona hubiera reservado ella: el correo con el enlace
  de la videollamada, el evento en el calendario y sus recordatorios.
- ⚠️ **Esa llamada de la API es de los planes de PAGO de Calendly.** En el
  gratis contesta 403. Entonces, en vez de fallar, se devuelve la página de
  Calendly de ESA hora con el nombre y el correo ya puestos
  (`modo: "enlace"`): un clic en «Programar evento» y listo. Lo mismo si
  Calendly falla por cualquier otro motivo: el motivo se enseña tal cual.
- La persona queda en la escuela: un evento `llamada-equipo` (quién la agendó
  y para cuándo) y, si estaba pendiente en Llamadas, se marca hecha. En el
  tablero pasa sola a Agendado en cuanto la cita sale en la agenda
  (`cita_que_manda`). No es `reunion` a propósito: esa la manda la web cuando
  alguien reserva solo, y cuenta en los números de /agendar.

Desde el 31/10, también **cambiar la hora** y **cancelar** una llamada desde
la escuela (`cambiar_hora`, `cancelar_llamada`): ver su bloque más abajo.

Desde el 02/11, si en Calendly hay una copia SECRETA del evento de las
llamadas (del mismo tipo, con el nombre del público delante y más días por
delante que el público, que deja solo 2), la escuela agenda y cambia horas en
esa (`copia_del_equipo`, `evento_elegido`). La web sigue con el público. Los
avisos de Calendly de la copia cuentan como la llamada (`tipos_de_llamada`) y
la agenda lee todas las citas de la organización: la escuela se entera igual.

`api.calendly.com` no se alcanza desde el entorno donde se escribió esto: la
forma de las respuestas está sacada de la documentación, y lo puro tiene test.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import httpx
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.contactos import agenda as A

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
#: El evento de Calendly que se agenda (su `slug`, lo último de su dirección).
EVENTO_POR_DEFECTO = "llamada-de-consultoria"
#: Las ubicaciones que Calendly crea sola (videollamada): no piden nada más.
_VIDEO = {"google_conference", "zoom_conference", "microsoft_teams_conference", "webex_conference", "gotomeeting_conference"}


# ── lógica pura (con test) ─────────────────────────────────────────────────


def _clave(texto: str) -> str:
    return (texto or "").strip().rstrip("/").rsplit("/", 1)[-1].lower()


def _es_el_preferido(t: dict, clave: str) -> bool:
    slug = str(t.get("slug") or "").lower()
    url = _clave(str(t.get("scheduling_url") or ""))
    return bool(clave) and clave in (slug, url)


def es_por_turnos(t: dict) -> bool:
    """¿Es un evento «por turnos» (round robin) de Calendly Teams?"""
    return str(t.get("pooling_type") or "").lower() == "round_robin"


def es_secreto(t: dict) -> bool:
    """¿Es un evento secreto de Calendly (no sale en la página pública)?"""
    return bool(t.get("secret"))


def _normal(texto: str) -> str:
    """Sin mayúsculas, tildes ni espacios de más: «Consultoría» = «consultoria»."""
    import unicodedata

    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    return " ".join(t.split())


def evento_publico(tipos: list[dict], preferido: str = EVENTO_POR_DEFECTO) -> Optional[dict]:
    """El evento de las llamadas que reserva la gente (el de la web). Desde el
    31/10, con Calendly Teams, gana el «por turnos» (round robin: Calendly
    elige closer): primero el por turnos con el slug preferido, luego
    cualquier por turnos, luego el del slug (o dirección) preferido, y si no,
    el primero activo. Los secretos van detrás: son la copia del equipo."""
    activos = [t for t in tipos if t.get("active", True)]
    clave = _clave(preferido)
    reglas = (
        lambda t: es_por_turnos(t) and _es_el_preferido(t, clave),
        es_por_turnos,
        lambda t: _es_el_preferido(t, clave),
    )
    for grupo in ([t for t in activos if not es_secreto(t)], activos):
        for elegir in reglas:
            for t in grupo:
                if elegir(t):
                    return t
    no_secretos = [t for t in activos if not es_secreto(t)]
    return (no_secretos or activos or [None])[0]


def copia_del_equipo(tipos: list[dict], base: Optional[dict]) -> Optional[dict]:
    """La copia SECRETA del evento de las llamadas que usa el equipo (02/11):
    el público deja reservar 2 días y la copia, más. Es la copia si está
    activa, es secreta, es del MISMO tipo que el público (individual con
    individual, por turnos con por turnos: así nadie le pasa la llamada a otro
    closer sin querer) y su nombre empieza por el del público («Llamada de
    Consultoría HN (equipo)»). Con un público por turnos vale además cualquier
    por turnos secreto. Función pura."""
    if not base:
        return None
    nombre = _normal(base.get("name") or "")
    tipo = str(base.get("pooling_type") or "").lower()
    candidatas = [
        t for t in tipos
        if t.get("active", True)
        and es_secreto(t)
        and str(t.get("uri") or "") != str(base.get("uri") or "")
        and str(t.get("pooling_type") or "").lower() == tipo
    ]
    slug = str(base.get("slug") or "").lower()
    for t in candidatas:
        if nombre and _normal(t.get("name") or "").startswith(nombre):
            return t
        if slug and str(t.get("slug") or "").lower().startswith(slug):
            return t
    if es_por_turnos(base) and candidatas:
        return candidatas[0]
    return None


def evento_elegido(tipos: list[dict], preferido: str = EVENTO_POR_DEFECTO) -> Optional[dict]:
    """El evento en el que agenda y cambia horas la escuela: la copia secreta
    del equipo si existe (más días por delante) y si no, el público."""
    base = evento_publico(tipos, preferido)
    return copia_del_equipo(tipos, base) or base


def tipos_de_llamada(tipos: list[dict], preferido: str = EVENTO_POR_DEFECTO) -> set[str]:
    """Las direcciones de los eventos que son «la llamada de admisión»: el
    público, su copia del equipo, los por turnos y los que llevan el slug
    preferido (el enlace personal de cada closer, si lo crea con el mismo
    slug, y el viejo durante el cambio). Lo usa el aviso de Calendly para no
    tratar como llamada una reunión cualquiera. Función pura."""
    clave = _clave(preferido)
    base = evento_publico(tipos, preferido)
    # Y el evento 1 a 1 de las llamadas de cada closer (05/11): lo que se
    # agenda eligiendo closer en la escuela también es la llamada.
    salida = {
        str(t.get("uri") or "")
        for t in tipos
        if es_por_turnos(t) or _es_el_preferido(t, clave) or _rango_de_llamada(t, base, preferido) is not None
    }
    for t in (base, copia_del_equipo(tipos, base)):
        if t:
            salida.add(str(t.get("uri") or ""))
    return {u for u in salida if u}


# ── quién la lleva y por dónde (05/11/2026) ─────────────────────────────────
#
# Pedido: "para crear una llamada manual, tenemos que poder elegir dónde
# quieres que salga, si Zoom o Meet, y quién lleva la llamada". En el evento
# por turnos eso no se puede: la API de Calendly (`POST /invitees`) no tiene
# ningún campo para elegir anfitrión, lo elige Calendly; y con «ubicación por
# anfitrión», la herramienta va con el closer.
#
# La salida, sin crear nada en Calendly desde la escuela (eso fue la «Agenda
# del equipo» del 02/11 y se quitó): cada closer tiene en SU Calendly un
# evento 1 a 1 de las llamadas, con el nombre del evento por turnos delante
# («Llamada de Consultoría HN (equipo)»; lo más cómodo, un «evento gestionado»
# del administrador asignado a cada closer) y con las ubicaciones que quiera
# ofrecer (Zoom, Google Meet). La escuela lo encuentra sola (`eventos_de_closers`)
# y, al agendar, se elige «Por turnos» (Calendly decide, como siempre) o el
# closer; y, en el suyo, la herramienta entre las que tenga el evento. Las
# horas que salen son las de ESE closer: Calendly ya quita las que tiene ocupadas.
#
# Quién puede elegir a quién (`opciones_para`): un administrador, cualquiera;
# un closer, él mismo o el closer que ya lleva a esa persona (nadie le quita la
# llamada al otro).

#: El nombre de cada videollamada de Calendly, para la pantalla.
NOMBRE_VIDEO = {
    "zoom_conference": "Zoom",
    "google_conference": "Google Meet",
    "microsoft_teams_conference": "Microsoft Teams",
    "webex_conference": "Webex",
    "gotomeeting_conference": "GoToMeeting",
}


def videollamadas(tipo: dict) -> list[dict]:
    """Las videollamadas que ofrece un evento: [{kind, nombre}], sin repetir.
    Función pura."""
    salida: list[dict] = []
    for lugar in (tipo or {}).get("locations") or []:
        kind = str((lugar or {}).get("kind") or "")
        if kind in NOMBRE_VIDEO and all(v["kind"] != kind for v in salida):
            salida.append({"kind": kind, "nombre": NOMBRE_VIDEO[kind]})
    return salida


def _rango_de_llamada(t: dict, base: Optional[dict], preferido: str) -> Optional[int]:
    """¿Es un evento 1 a 1 de las llamadas? 0 = su nombre empieza por el del
    evento de las llamadas (el bueno), 1 = lleva el slug de siempre (el viejo),
    None = no lo es. Función pura."""
    if es_por_turnos(t) or not t.get("active", True):
        return None
    if str((t.get("profile") or {}).get("type") or "User") != "User":
        return None
    nombre = _normal((base or {}).get("name") or "")
    otro = str((base or {}).get("uri") or "") != str(t.get("uri") or "")
    if nombre and otro and _normal(t.get("name") or "").startswith(nombre):
        return 0
    # Un duplicado de Calendly lleva el slug del original con algo detrás
    # («llamada-de-consultoria-hn-clon», 05/11).
    slug = str((base or {}).get("slug") or "").lower()
    if slug and otro and str(t.get("slug") or "").lower().startswith(slug):
        return 0
    if _es_el_preferido(t, _clave(preferido)):
        return 1
    return None


def eventos_de_closers(
    tipos: list[dict], miembros: dict[str, dict], preferido: str = EVENTO_POR_DEFECTO
) -> list[dict]:
    """El evento 1 a 1 de las llamadas de cada persona de Calendly: [{email,
    nombre, uri, evento, ubicaciones, tipo}], uno por dueño (`profile.owner`
    → `miembros`). Si tiene varios, el de nombre bueno antes que el del slug
    viejo, y el secreto antes que el público. Sin dueño conocido, no sale.
    Función pura, con test."""
    base = evento_publico(tipos, preferido)
    mejor: dict[str, tuple[tuple[int, int], dict]] = {}
    for t in tipos:
        rango = _rango_de_llamada(t, base, preferido)
        if rango is None:
            continue
        dueno = miembros.get(str((t.get("profile") or {}).get("owner") or "")) or {}
        email = str(dueno.get("email") or "").strip().lower()
        if "@" not in email:
            continue
        # Con varios: el de nombre bueno, el que deja elegir más videollamadas
        # (el clon con Zoom y Meet antes que la copia solo con Meet) y el
        # secreto antes que el público.
        orden = (rango, -len(videollamadas(t)), 0 if es_secreto(t) else 1)
        if email not in mejor or orden < mejor[email][0]:
            mejor[email] = (orden, t)
    salida = []
    for email, (_, t) in mejor.items():
        dueno = next((m for m in miembros.values() if str(m.get("email") or "").strip().lower() == email), {})
        salida.append({
            "email": email,
            "nombre": str(dueno.get("nombre") or (t.get("profile") or {}).get("name") or email.split("@")[0]),
            "uri": str(t.get("uri") or ""),
            "evento": str(t.get("name") or ""),
            "ubicaciones": videollamadas(t),
            "tipo": t,
        })
    return sorted(salida, key=lambda e: e["nombre"].lower())


def opciones_para(
    base: Optional[dict],
    de_closers: list[dict],
    lleva: int,
    actor_id: int,
    es_admin: bool,
) -> dict:
    """Lo que puede elegir quien agenda (ver arriba). `de_closers` lleva ya
    `closer_id` y `closer` (el nombre en la escuela) o 0 si su dueño no es un
    closer. Devuelve {"opciones": [...], "propuesta": id}: la opción «turnos»
    (el evento de siempre) y una por closer permitido. Se propone la del closer
    que lleva a la persona; si no la lleva nadie, la de quien agenda si tiene;
    si no, «turnos». Función pura, con test."""
    opciones: list[dict] = []
    if base:
        opciones.append({
            "id": "turnos",
            "closer_id": 0,
            "quien": "Por turnos" if es_por_turnos(base) else (base.get("name") or "El evento de siempre"),
            "evento": str(base.get("name") or ""),
            "uri": str(base.get("uri") or ""),
            "por_turnos": es_por_turnos(base),
            # En el por turnos, solo si el evento deja elegir entre varias
            # (con una sola, va la del closer que le toque; la pantalla añade
            # «La de quien le toque» y es lo de serie).
            "ubicaciones": videollamadas(base) if (not es_por_turnos(base) or len(videollamadas(base)) > 1) else [],
        })
    for e in de_closers:
        cid = int(e.get("closer_id") or 0)
        if not cid:
            continue
        if not es_admin and cid not in {actor_id, lleva} - {0}:
            continue
        opciones.append({
            "id": e["uri"],
            "closer_id": cid,
            "quien": (e.get("closer") or e.get("nombre") or "").split(" ")[0],
            "evento": e.get("evento") or "",
            "uri": e["uri"],
            "por_turnos": False,
            "ubicaciones": e.get("ubicaciones") or [],
        })
    propuesta = "turnos" if base else ""
    for quien in ([lleva] if lleva else [actor_id]):
        for o in opciones:
            if quien and o["closer_id"] == quien:
                propuesta = o["id"]
    return {"opciones": opciones, "propuesta": propuesta}


def telefono_e164(telefono: str) -> str:
    """«+31 6 1234 5678» o «0031…» → «+31612345678». Calendly pide los
    teléfonos así. Sin prefijo no se inventa ninguno: va tal cual, con +."""
    texto = (telefono or "").strip()
    cifras = re.sub(r"\D", "", texto)
    if texto.startswith("00"):
        cifras = cifras[2:]
    return f"+{cifras}" if cifras else ""


def _una_ubicacion(lugar: dict, telefono: str) -> Optional[dict]:
    kind = str((lugar or {}).get("kind") or "")
    if not kind:
        return None
    salida: dict[str, Any] = {"kind": kind}
    if kind == "outbound_call":
        # «Te llamamos nosotros»: el número es el de la persona.
        if telefono:
            salida["location"] = telefono_e164(telefono)
    elif kind not in _VIDEO and lugar.get("location"):
        salida["location"] = lugar["location"]
    return salida


def ubicaciones_para(tipo: dict, telefono: str = "") -> list[Optional[dict]]:
    """Las `location` que se pueden probar con `POST /invitees`, por orden: cada
    una de las del tipo de evento y, al final, ninguna. Si Calendly rechaza una
    ubicación (`invalid_location_choice`), se prueba la siguiente en vez de
    rendirse. Sin ubicaciones en el evento, solo «ninguna»: Calendly rechaza
    una que el evento no tiene.

    ⚠️ En el evento POR TURNOS se prueba primero SIN ubicación (05/11, "Diego
    tiene Zoom y le salió Meet"): ahí cada closer tiene la suya («ubicación por
    anfitrión» en Calendly) y la escuela no sabe a quién le va a tocar. Mandar
    la primera de la lista la imponía a todos: la llamada de Diego salía con
    el Meet que era de Belén. Sin ubicación, Calendly pone la del closer que
    le toque; si la pide sí o sí, se prueban las del evento como antes."""
    salida: list[Optional[dict]] = []
    if es_por_turnos(tipo):
        salida.append(None)
    for lugar in tipo.get("locations") or []:
        u = _una_ubicacion(lugar, telefono)
        if u and u not in salida:
            salida.append(u)
    if None not in salida:
        salida.append(None)
    return salida


def ubicacion_para(tipo: dict, telefono: str = "") -> Optional[dict]:
    """La primera que se prueba (ver `ubicaciones_para`)."""
    return ubicaciones_para(tipo, telefono)[0]


#: Lo que se contesta en una pregunta OBLIGATORIA de texto del evento, cuando
#: agenda el equipo (la persona no está delante para contestarla).
RESPUESTA_DEL_EQUIPO = "Agendada por el equipo de Holandés Nawar"


def respuestas_obligatorias(tipo: dict, telefono: str = "") -> list[dict]:
    """`questions_and_answers` para las preguntas OBLIGATORIAS del evento de
    Calendly: sin ellas, Calendly no deja reservar. Teléfono → el suyo; de
    elegir → la primera opción; de texto → `RESPUESTA_DEL_EQUIPO`. Las que no
    son obligatorias no se tocan."""
    salida = []
    for q in tipo.get("custom_questions") or []:
        if not q.get("required") or q.get("enabled") is False:
            continue
        tipo_q = str(q.get("type") or "")
        if tipo_q == "phone_number":
            respuesta = telefono_e164(telefono)
        elif tipo_q in ("single_select", "multi_select"):
            opciones = q.get("answer_choices") or []
            respuesta = str(opciones[0]) if opciones else RESPUESTA_DEL_EQUIPO
        else:
            respuesta = RESPUESTA_DEL_EQUIPO
        if respuesta:
            salida.append({"question": str(q.get("name") or ""), "answer": respuesta, "position": int(q.get("position") or 0)})
    return salida


def con_datos(url: str, nombre: str, email: str) -> str:
    """La página de Calendly con nombre y correo puestos (Calendly los lee de
    `name` y `email`)."""
    partes = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(partes.query, keep_blank_values=True) if k not in ("name", "email")]
    if nombre:
        query.append(("name", nombre))
    if email:
        query.append(("email", email))
    return urlunsplit((partes.scheme, partes.netloc, partes.path, urlencode(query), partes.fragment))


def enlace_de_hora(scheduling_url: str, inicio_utc: datetime) -> str:
    """La página de Calendly de una hora concreta, como la que abre Calendly
    al elegirla: `.../2026-10-16T18:00:00+02:00?month=2026-10&date=2026-10-16`."""
    local = inicio_utc.astimezone(ZONA)
    base = scheduling_url.rstrip("/")
    return f"{base}/{local.isoformat(timespec='seconds')}?month={local:%Y-%m}&date={local:%Y-%m-%d}"


def limites_del_dia(dia: str, ahora: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """De las 00:00 a las 24:00 de ese día en Países Bajos, en UTC. Calendly
    no deja pedir horas en el pasado: si el día es hoy, empieza ahora."""
    d = datetime.strptime(dia, "%Y-%m-%d").replace(tzinfo=ZONA)
    desde, hasta = d.astimezone(timezone.utc), (d + timedelta(days=1)).astimezone(timezone.utc)
    ya = (ahora or datetime.now(timezone.utc)) + timedelta(minutes=1)
    return max(desde, ya), hasta


def _utc(texto: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def _z(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000000Z")


# ── Calendly ───────────────────────────────────────────────────────────────


class FalloCalendly(Exception):
    def __init__(self, motivo: str, codigo: int = 0):
        super().__init__(motivo)
        self.motivo = motivo
        self.codigo = codigo


def _motivo(r: httpx.Response) -> str:
    try:
        cuerpo = r.json()
    except Exception:  # noqa: BLE001
        return f"Calendly contestó {r.status_code}"
    detalles = cuerpo.get("details") or []
    # «parámetro: mensaje»: sin el nombre del parámetro, un «is invalid» no
    # dice qué falta (15/10: la reserva fallaba y no se sabía por qué).
    extra = "; ".join(
        f"{d.get('parameter')}: {d.get('message')}" if d.get("parameter") else str(d.get("message") or "")
        for d in detalles
        if isinstance(d, dict) and d.get("message")
    )
    texto = str(cuerpo.get("message") or cuerpo.get("title") or f"Calendly contestó {r.status_code}")
    return f"{texto}{' (' + extra + ')' if extra else ''}"


async def _pedir(cliente: httpx.AsyncClient, metodo: str, url: str, **kw) -> dict:
    r = await cliente.request(metodo, url, **kw)
    if r.status_code >= 400:
        raise FalloCalendly(_motivo(r), r.status_code)
    return r.json() if r.content else {}


def _cliente() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=15.0, headers={"Authorization": f"Bearer {A._token()}"})


def _preferido() -> str:
    import os

    return os.environ.get("LEARNHOUSE_CALENDLY_EVENTO") or EVENTO_POR_DEFECTO


async def _tipos(cliente: httpx.AsyncClient) -> list[dict]:
    """Los tipos de evento activos de la organización de Calendly (los del
    equipo y los de cada closer); si el token no puede verla, los suyos."""
    yo = (await _pedir(cliente, "GET", f"{A.API}/users/me")).get("resource") or {}
    if yo.get("current_organization"):
        try:
            tipos = (
                await _pedir(
                    cliente, "GET", f"{A.API}/event_types",
                    params={"organization": yo["current_organization"], "active": "true", "count": 100},
                )
            ).get("collection") or []
            if tipos:
                _eventos_cache["fuente"] = "organizacion"
                return tipos + await _tipos_de_las_citas(cliente, yo["current_organization"], tipos)
        except FalloCalendly as exc:
            if exc.codigo not in (400, 403, 404):
                raise
    _eventos_cache["fuente"] = "usuario"
    return (
        await _pedir(cliente, "GET", f"{A.API}/event_types", params={"user": yo.get("uri", ""), "active": "true", "count": 100})
    ).get("collection") or []


async def _tipos_de_las_citas(cliente: httpx.AsyncClient, organizacion: str, conocidos: list[dict]) -> list[dict]:
    """Los tipos de evento de las citas de la organización que NO salen al
    listar sus eventos (06/11/2026, con la captura de «¿Por qué no sale?»):
    Calendly no devuelve en `event_types?organization=` el evento «por turnos»
    del equipo. Sin él, la escuela tomaba como evento de las llamadas el
    primero que encontraba (el gestionado de Belén) y como «Por turnos» la
    copia morada de Diego: por eso «Cambiar hora» mandaba las llamadas a su
    calendario. Aquí se piden por su dirección los eventos de las citas
    recientes. En blando: si algo falla, la lista de siempre."""
    vistos = {str(t.get("uri") or "") for t in conocidos}
    try:
        citas = (
            await _pedir(
                cliente, "GET", f"{A.API}/scheduled_events",
                params={"organization": organizacion, "count": 100, "sort": "start_time:desc"},
            )
        ).get("collection") or []
    except Exception as exc:  # noqa: BLE001
        logger.info("No se pudieron leer las citas para buscar sus eventos: %s", exc)
        return []
    nuevos: list[str] = []
    for ev in citas:
        uri = str((ev or {}).get("event_type") or "")
        if uri.startswith("http") and uri not in vistos and uri not in nuevos:
            nuevos.append(uri)
    salida: list[dict] = []
    for uri in nuevos[:10]:
        try:
            t = (await _pedir(cliente, "GET", uri)).get("resource") or {}
        except Exception as exc:  # noqa: BLE001
            logger.info("Calendly no deja leer el evento %s: %s", uri, exc)
            continue
        if t.get("uri") and t.get("active", True):
            salida.append(t)
    return salida


async def _tipo(cliente: httpx.AsyncClient) -> dict:
    tipo = evento_elegido(await _tipos(cliente), _preferido())
    if not tipo:
        raise FalloCalendly("No hay ningún tipo de evento activo en Calendly")
    return tipo


async def _miembros(cliente: httpx.AsyncClient) -> dict[str, dict]:
    """{uri del usuario de Calendly: {email, nombre}} de la organización. Si el
    token no puede listarla, al menos él."""
    yo = (await _pedir(cliente, "GET", f"{A.API}/users/me")).get("resource") or {}
    salida: dict[str, dict] = {}
    if yo.get("uri"):
        salida[str(yo["uri"])] = {"email": str(yo.get("email") or ""), "nombre": str(yo.get("name") or "")}
    if yo.get("current_organization"):
        try:
            datos = await _pedir(
                cliente, "GET", f"{A.API}/organization_memberships",
                params={"organization": yo["current_organization"], "count": 100},
            )
            for m in datos.get("collection") or []:
                u = (m or {}).get("user") or {}
                if u.get("uri"):
                    salida[str(u["uri"])] = {"email": str(u.get("email") or ""), "nombre": str(u.get("name") or "")}
        except FalloCalendly as exc:
            logger.info("Calendly no deja listar la organización (%s): %s", exc.codigo, exc.motivo)
    return salida


#: Los eventos y las personas de Calendly, 5 minutos (se piden al abrir la
#: ventana de agendar y en cada día que se mira).
_eventos_cache: dict = {"hasta": 0.0, "datos": None, "fuente": ""}


async def _eventos(cliente: httpx.AsyncClient, forzar: bool = False) -> tuple[list[dict], list[dict]]:
    """(todos los tipos de evento, el de cada closer)."""
    import time

    if not forzar and _eventos_cache["datos"] is not None and _eventos_cache["hasta"] > time.time():
        return _eventos_cache["datos"]
    tipos = await _tipos(cliente)
    preferido = _preferido()
    base = evento_publico(tipos, preferido)
    de_closers: list[dict] = []
    if any(_rango_de_llamada(t, base, preferido) is not None for t in tipos):
        de_closers = eventos_de_closers(tipos, await _miembros(cliente), preferido)
    _eventos_cache.update(datos=(tipos, de_closers), hasta=time.time() + 300)
    return tipos, de_closers


async def _tipo_para(cliente: httpx.AsyncClient, evento: str = "") -> dict:
    """El evento en el que se agenda: sin `evento` (o «turnos»), el de siempre
    (`_tipo`); si no, el de ese closer, que tiene que ser uno de los suyos."""
    evento = (evento or "").strip()
    if not evento or evento == "turnos":
        return await _tipo(cliente)
    _, de_closers = await _eventos(cliente)
    for e in de_closers:
        if e["uri"] == evento:
            return e["tipo"]
    raise FalloCalendly("No encuentro en Calendly el evento de ese closer. Vuelve a abrir la ventana.", 404)


async def opciones(lleva: int, actor_id: int, es_admin: bool, db_session: AsyncSession) -> dict:
    """Para la ventana de agendar: quién puede llevar la llamada (por turnos o
    cada closer con su evento) y por dónde. `faltan`: los closers de la
    escuela sin evento propio en Calendly (para decirlo en la pantalla)."""
    if not A._token():
        return {"configurado": False, "opciones": [], "propuesta": "", "faltan": []}
    try:
        async with _cliente() as cliente:
            tipos, de_closers = await _eventos(cliente)
    except FalloCalendly as exc:
        return {"configurado": True, "opciones": [], "propuesta": "", "faltan": [], "error": exc.motivo}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudieron leer los eventos de Calendly")
        return {"configurado": True, "opciones": [], "propuesta": "", "faltan": [], "error": f"Calendly no contesta: {exc}"}
    from src.services.panel.reparto import _equipo_de_la_escuela, closer_del_anfitrion, leer

    org_id, eq = await _equipo_de_la_escuela(db_session)
    mapa = (await leer(db_session, org_id or None))["calendly"]
    marcados = []
    for e in de_closers:
        closer = closer_del_anfitrion(e["email"], eq, mapa)
        marcados.append({**e, "closer_id": int((closer or {}).get("id") or 0), "closer": (closer or {}).get("nombre") or ""})
    base = evento_elegido(tipos, _preferido())
    r = opciones_para(base, marcados, lleva, actor_id, es_admin)
    con_evento = {m["closer_id"] for m in marcados if m["closer_id"]}
    r["faltan"] = [m["nombre"].split(" ")[0] for m in eq if m.get("rol") == "Closer" and m["id"] not in con_evento]
    r["configurado"] = True
    return r


async def anfitrion_del_evento(cliente: httpx.AsyncClient, uri: str) -> str:
    """El correo de quien atiende ese evento en Calendly (el closer que le tocó
    por turnos). Vacío si no se sabe: en blando."""
    if not str(uri).startswith("http"):
        return ""
    try:
        ev = (await _pedir(cliente, "GET", uri)).get("resource") or {}
    except Exception:  # noqa: BLE001
        return ""
    return A.anfitrion_de(ev)[0]


async def _crear_invitado(
    cliente: httpx.AsyncClient, tipo: dict, nombre: str, email: str, telefono: str, cuando: datetime, ubicacion: str = ""
) -> dict:
    """`POST /invitees`: la reserva en Calendly, como si la hubiera hecho la
    persona. Devuelve el invitado creado; lanza FalloCalendly si no se puede."""
    base: dict[str, Any] = {
        "event_type": tipo.get("uri", ""),
        "start_time": _z(cuando),
        "invitee": {"name": nombre, "email": email, "timezone": str(ZONA)},
        # SIN `tracking`, a propósito (15/10): si se manda, Calendly exige
        # TODOS sus campos (utm_content, utm_term, salesforce_uuid…) y
        # rechazaba la reserva entera con «The supplied parameters are
        # invalid». Quién la agendó ya queda en la escuela.
    }
    respuestas = respuestas_obligatorias(tipo, telefono)
    if respuestas:
        base["questions_and_answers"] = respuestas
    # Se prueba cada ubicación del evento y, al final, sin ninguna: solo se
    # pasa a la siguiente si lo que Calendly rechaza es ESO. Si el equipo ha
    # ELEGIDO Zoom o Meet (05/11), solo esa: con otra, la llamada saldría por
    # donde no se quería.
    ultimo: Optional[FalloCalendly] = None
    if ubicacion:
        if ubicacion not in {v["kind"] for v in videollamadas(tipo)}:
            raise FalloCalendly(f"El evento «{tipo.get('name') or ''}» no ofrece {NOMBRE_VIDEO.get(ubicacion, ubicacion)}", 400)
        lugares: list[Optional[dict]] = [{"kind": ubicacion}]
    else:
        lugares = ubicaciones_para(tipo, telefono)
    for lugar in lugares:
        cuerpo = {**base, **({"location": lugar} if lugar else {})}
        try:
            return (await _pedir(cliente, "POST", f"{A.API}/invitees", json=cuerpo)).get("resource") or {}
        except FalloCalendly as exc:
            if exc.codigo == 400 and "location" in exc.motivo.lower():
                logger.warning("Calendly rechaza la ubicación %s: se prueba otra", (lugar or {}).get("kind"))
                ultimo = exc
                continue
            raise
    # Todas las ubicaciones rechazadas.
    raise ultimo or FalloCalendly("Calendly no aceptó ninguna ubicación", 400)


async def huecos(dia: str, evento: str = "") -> dict:
    """Las horas libres de ese día en el evento de las llamadas (o en el de
    ese closer, `evento`)."""
    if not A._token():
        return {"configurado": False, "huecos": []}
    try:
        desde, hasta = limites_del_dia(dia)
    except ValueError:
        return {"configurado": True, "huecos": [], "error": "Fecha no válida"}
    if desde >= hasta:
        return {"configurado": True, "huecos": [], "duracion": 0}
    try:
        async with _cliente() as cliente:
            tipo = await _tipo_para(cliente, evento)
            datos = await _pedir(
                cliente, "GET", f"{A.API}/event_type_available_times",
                params={"event_type": tipo.get("uri", ""), "start_time": _z(desde), "end_time": _z(hasta)},
            )
    except FalloCalendly as exc:
        return {"configurado": True, "huecos": [], "error": exc.motivo}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudieron leer las horas libres de Calendly")
        return {"configurado": True, "huecos": [], "error": f"Calendly no contesta: {exc}"}
    salida = [
        {"inicio": h.get("start_time") or "", "url": h.get("scheduling_url") or ""}
        for h in datos.get("collection") or []
        if (h.get("status") or "available") == "available" and h.get("start_time")
    ]
    salida.sort(key=lambda h: h["inicio"])
    return {
        "configurado": True,
        "huecos": salida,
        "evento": tipo.get("name") or "",
        "duracion": int(tipo.get("duration") or 0),
    }


async def reservar(
    *, nombre: str, email: str, telefono: str, inicio: str, url_hueco: str, autor: str, db_session: AsyncSession,
    evento: str = "", ubicacion: str = "",
) -> dict:
    """Agenda la llamada. `modo`: "reservada" (Calendly ya la tiene y le ha
    escrito a la persona) o "enlace" (hay que confirmar en Calendly con la
    página que se devuelve, ya rellenada)."""
    nombre, email, telefono = nombre.strip()[:120], email.strip().lower()[:255], telefono.strip()[:40]
    if not nombre or "@" not in email:
        return {"ok": False, "motivo": "Hacen falta el nombre y un correo válido"}
    cuando = _utc(inicio)
    if cuando is None:
        return {"ok": False, "motivo": "Falta la hora de la llamada"}
    if cuando <= datetime.now(timezone.utc):
        return {"ok": False, "motivo": "Esa hora ya ha pasado"}
    if not A._token():
        return {"ok": False, "motivo": "Calendly no está conectado (falta LEARNHOUSE_CALENDLY_TOKEN)"}

    plan_b = url_hueco or ""
    try:
        async with _cliente() as cliente:
            tipo = await _tipo_para(cliente, evento)
            plan_b = plan_b or enlace_de_hora(str(tipo.get("scheduling_url") or ""), cuando)
            creada = await _crear_invitado(cliente, tipo, nombre, email, telefono, cuando, ubicacion)
            # Con el evento por turnos, a quién se la dio Calendly (31/10).
            anfitrion = await anfitrion_del_evento(cliente, str(creada.get("event") or ""))
    except FalloCalendly as exc:
        logger.warning("Calendly no dejó agendar por la API (%s): %s", exc.codigo, exc.motivo)
        await _apuntar(email, nombre, telefono, cuando, autor, False, db_session)
        return {
            "ok": True,
            "modo": "enlace",
            "url": con_datos(plan_b, nombre, email) if plan_b else "",
            "motivo": exc.motivo,
            "codigo": exc.codigo,
            # 403: lo de reservar desde fuera es de los planes de pago de Calendly.
            "plan": exc.codigo in (401, 403),
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo agendar en Calendly")
        return {"ok": False, "motivo": f"Calendly no contesta: {exc}"}

    A._cache["hasta"] = 0.0  # que la agenda la enseñe ya
    await _apuntar(email, nombre, telefono, cuando, autor, True, db_session)
    return {
        "ok": True,
        "modo": "reservada",
        "evento": str(creada.get("event") or ""),
        "anfitrion_email": anfitrion,
        "cancelar_url": str(creada.get("cancel_url") or ""),
        "cambiar_url": str(creada.get("reschedule_url") or ""),
    }


# ── cambiar la hora y cancelar (31/10/2026) ─────────────────────────────────
#
# Pedido: "los closers deben poder cambiar horas de llamadas agendadas, para
# cualquier fecha… ellos pueden editar todo". Antes «Cambiar hora» abría la
# página de Calendly de la PERSONA (su enlace de cambiar), fuera de la escuela.
#
# La API de Calendly NO tiene «mover una cita». Se hace en dos pasos, en este
# orden: (1) se reserva la hora nueva con `POST /invitees`, igual que «Nueva
# llamada», y (2) SOLO si eso sale bien, se cancela la vieja con
# `POST /scheduled_events/{uuid}/cancellation`. Así, si Calendly no deja la
# nueva, la persona sigue con su hora de antes: nunca se queda sin ninguna.
#
# Lo que recibe la persona: el correo de cancelación de Calendly con el motivo
# (empieza por `A.MOTIVO_CAMBIO`, «Hemos cambiado la hora de tu llamada…») y la
# invitación con la hora nueva. La agenda lee ese motivo y enseña la vieja
# como «Reprogramada», no como cancelada (tampoco cuenta como cancelada en
# KPIs).
#
# Lo que NO se repite: el aviso de Calendly de la reserva nueva llega a la
# escuela como una reserva cualquiera (no trae `old_invitee`). Para que no
# salgan otra vez el correo de Rida ni el «llamada nueva, repártela», el
# cambio se apunta en la ficha (`llamada-cambiada`) ANTES de reservar, y
# `correo_reserva.atender_aviso` lo busca (`es_el_cambio`). Si la reserva
# falla, la marca se borra.
#
# El closer que la lleva no cambia (va por correo, no por cita). La
# confirmación sí es de la cita: la nueva sale «Sin confirmar», salvo que el
# closer marque que ya lo ha hablado con la persona.
#
# «Cualquier fecha», con un límite que no es de la escuela: las horas las da
# Calendly, así que solo salen las de la disponibilidad del evento y dentro de
# sus «Límites de reserva» (hasta cuántos días por delante, aviso mínimo).

TIPO_CAMBIO = "llamada-cambiada"
TIPO_CANCELADA = "llamada-cancelada"
#: Lo que lee la persona en el correo de Calendly al cancelar la vieja.
MOTIVO_CAMBIO_ENTERO = f"{A.MOTIVO_CAMBIO}. Te llega aparte la invitación con la hora nueva."
#: Al cancelar sin escribir nada.
MOTIVO_CANCELAR = "Tu llamada con Holandés Nawar se ha cancelado."
#: Cuánto tiempo después de un cambio se reconoce su aviso de Calendly.
_VENTANA_AVISO = timedelta(hours=2)


def uuid_de_cita(cita_id: str) -> str:
    """El id de cita del panel es «<uuid del evento>:<correo>»."""
    return str(cita_id or "").split(":", 1)[0].strip()


def uuid_de_evento(uri: str) -> str:
    return str(uri or "").rstrip("/").rsplit("/", 1)[-1]


def es_el_cambio(cambios: list[dict], inicio: str, ahora: Optional[datetime] = None) -> bool:
    """¿Esta reserva (su hora de inicio) es la de un cambio de hora hecho desde
    la escuela? `cambios`: los eventos `llamada-cambiada` de esa persona
    ({created_at, extra}). Cuenta el cambio de las últimas 2 horas con la misma
    hora nueva (un minuto de margen). Función pura, con test."""
    nueva = _utc(inicio)
    if nueva is None:
        return False
    ahora = ahora or datetime.now(timezone.utc)
    for c in cambios:
        hecho = _utc(c.get("created_at") or "")
        hora = _utc((c.get("extra") or {}).get("inicio") or "")
        if hecho and hora and ahora - hecho <= _VENTANA_AVISO and abs((hora - nueva).total_seconds()) <= 60:
            return True
    return False


async def lo_cambio_el_equipo(email: str, inicio: str, db_session: AsyncSession) -> bool:
    """Para el aviso de Calendly: si esta reserva es un cambio de hora del
    equipo, no se manda ni el correo de Rida ni el de «repártela». En blando."""
    import json

    from sqlmodel import select

    from src.db.contact_event import ContactEvent

    try:
        filas = (
            await db_session.execute(
                select(ContactEvent.created_at, ContactEvent.extra).where(
                    ContactEvent.email == (email or "").strip().lower(), ContactEvent.kind == TIPO_CAMBIO
                )
            )
        ).all()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo mirar si la reserva era un cambio de hora")
        return False
    cambios = []
    for creado, extra in filas:
        try:
            datos = json.loads(extra) if isinstance(extra, str) and extra else (extra or {})
        except ValueError:
            datos = {}
        cambios.append({"created_at": str(creado or ""), "extra": datos if isinstance(datos, dict) else {}})
    return es_el_cambio(cambios, inicio)


#: Los eventos de la ficha que dejan las llamadas agendadas o movidas desde la
#: escuela, con quién lo hizo y la hora (en `extra`).
TIPOS_DESDE_LA_ESCUELA = ("llamada-equipo", TIPO_CAMBIO)


def quien_la_agendo(eventos: list[dict], inicio: str) -> Optional[dict]:
    """¿Esta cita (su hora de inicio) la agendó o la movió alguien desde la
    escuela? `eventos`: los `llamada-equipo` y `llamada-cambiada` de esa
    persona ({kind, created_at, extra}). Devuelve {autor, cuando, como}
    (`como` = "agendo" o "cambio") del último que coincide con la hora (un
    minuto de margen), o None: entonces la reservaron en Calendly (la persona
    desde la web, o alguien en Calendly). Para saber, al mirar una llamada,
    si la ubicación la puso la escuela (05/11). Función pura, con test."""
    hora = _utc(inicio)
    if hora is None:
        return None
    mejor: Optional[dict] = None
    for e in eventos:
        extra = e.get("extra") or {}
        suya = _utc(str(extra.get("inicio") or ""))
        if suya is None or abs((suya - hora).total_seconds()) > 60:
            continue
        cuando = str(e.get("created_at") or "")
        if mejor is None or cuando > mejor["cuando"]:
            mejor = {
                "autor": str(extra.get("autor") or "").strip(),
                "cuando": cuando,
                "como": "cambio" if e.get("kind") == TIPO_CAMBIO else "agendo",
            }
    return mejor


async def agendadas_desde_la_escuela(emails: set[str], db_session: AsyncSession) -> dict[str, list[dict]]:
    """Los eventos «agendada / movida desde la escuela» de esos correos, por
    correo, para `quien_la_agendo`. En blando: si falla, vacío."""
    import json

    from sqlmodel import select

    from src.db.contact_event import ContactEvent

    limpios = {(e or "").strip().lower() for e in emails if e}
    if not limpios:
        return {}
    try:
        filas = (
            await db_session.execute(
                select(ContactEvent.email, ContactEvent.kind, ContactEvent.created_at, ContactEvent.extra).where(
                    ContactEvent.email.in_(limpios), ContactEvent.kind.in_(TIPOS_DESDE_LA_ESCUELA)
                )
            )
        ).all()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo mirar qué llamadas se agendaron desde la escuela")
        await db_session.rollback()
        return {}
    salida: dict[str, list[dict]] = {}
    for email, kind, creado, extra in filas:
        try:
            datos = json.loads(extra) if isinstance(extra, str) and extra else (extra or {})
        except ValueError:
            datos = {}
        salida.setdefault((email or "").lower(), []).append(
            {"kind": kind, "created_at": str(creado or ""), "extra": datos if isinstance(datos, dict) else {}}
        )
    return salida


def _evento_de_ficha(email: str, nombre: str, telefono: str, kind: str, extra: dict):
    import json

    from src.db.contact_event import ContactEvent

    partes = (nombre or "").split(" ", 1)
    return ContactEvent(
        email=email,
        kind=kind,
        first_name=partes[0][:120],
        last_name=(partes[1] if len(partes) > 1 else "")[:120],
        phone=(telefono or "")[:40],
        source="equipo",
        extra=json.dumps(extra, ensure_ascii=False),
        created_at=datetime.now(timezone.utc).isoformat(),
    )


async def cambiar_hora(
    *,
    cita_id: str,
    nombre: str,
    email: str,
    telefono: str,
    antes: str,
    inicio: str,
    autor: str,
    confirmada: bool,
    db_session: AsyncSession,
    evento: str = "",
    ubicacion: str = "",
) -> dict:
    """Mueve una llamada a otra hora (ver arriba). Devuelve `ok`, la cita
    nueva (`cita_id`) y, si la vieja no se pudo cancelar, `aviso`."""
    import json

    nombre, email, telefono = (nombre or "").strip()[:120], (email or "").strip().lower()[:255], (telefono or "").strip()[:40]
    uuid_viejo = uuid_de_cita(cita_id)
    if not uuid_viejo or "@" not in email:
        return {"ok": False, "motivo": "Falta la llamada que se cambia"}
    nombre = nombre or email.split("@")[0]
    cuando = _utc(inicio)
    if cuando is None:
        return {"ok": False, "motivo": "Falta la hora nueva"}
    ahora = datetime.now(timezone.utc)
    if cuando <= ahora:
        return {"ok": False, "motivo": "Esa hora ya ha pasado"}
    viejo = _utc(antes)
    if viejo is not None and abs((cuando - viejo).total_seconds()) < 60:
        return {"ok": False, "motivo": "Es la misma hora que ya tiene"}
    if not A._token():
        return {"ok": False, "motivo": "Calendly no está conectado (falta LEARNHOUSE_CALENDLY_TOKEN)"}

    extra = {"autor": autor, "antes": viejo.isoformat() if viejo else "", "inicio": cuando.isoformat(), "cita_vieja": cita_id}
    # La marca va ANTES de reservar: el aviso de Calendly de la reserva nueva
    # puede llegar antes de que esto termine (ver `lo_cambio_el_equipo`).
    marca = _evento_de_ficha(email, nombre, telefono, TIPO_CAMBIO, extra)
    db_session.add(marca)
    await db_session.commit()
    await db_session.refresh(marca)

    aviso = ""
    try:
        async with _cliente() as cliente:
            tipo = await _tipo_para(cliente, evento)
            creada = await _crear_invitado(cliente, tipo, nombre, email, telefono, cuando, ubicacion)
            # La vieja solo se cancela si aún no ha empezado: Calendly no deja
            # cancelar lo que ya pasó (y entonces solo se agenda la nueva).
            if viejo is None or viejo > ahora:
                try:
                    await _pedir(
                        cliente, "POST", f"{A.API}/scheduled_events/{uuid_viejo}/cancellation",
                        json={"reason": MOTIVO_CAMBIO_ENTERO},
                    )
                except FalloCalendly as exc:
                    logger.warning("Calendly no dejó cancelar la hora vieja (%s): %s", exc.codigo, exc.motivo)
                    aviso = (
                        "La hora nueva ya está agendada, pero Calendly no dejó cancelar la de antes "
                        f"(dijo: {exc.motivo}). Cancélala en Calendly para que no tenga las dos."
                    )
    except FalloCalendly as exc:
        logger.warning("Calendly no dejó cambiar la hora (%s): %s", exc.codigo, exc.motivo)
        await _quitar_marca(marca, db_session)
        return {"ok": False, "motivo": exc.motivo, "codigo": exc.codigo}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo cambiar la hora en Calendly")
        await _quitar_marca(marca, db_session)
        return {"ok": False, "motivo": f"Calendly no contesta: {exc}"}

    A._cache["hasta"] = 0.0  # que la agenda la enseñe ya
    cita_nueva = f"{uuid_de_evento(creada.get('event') or '')}:{email}" if creada.get("event") else ""
    try:
        marca.extra = json.dumps({**extra, "cita_nueva": cita_nueva, "sin_cancelar": bool(aviso)}, ensure_ascii=False)
        db_session.add(marca)
        await db_session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo completar la marca del cambio de hora")
        await db_session.rollback()
    if confirmada and cita_nueva:
        try:
            from src.services.contactos.confirmar_llamada import confirmar

            await confirmar(cita_nueva, email, nombre, cuando.isoformat(), autor, db_session)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo marcar como confirmada la hora nueva")
            await db_session.rollback()
    return {
        "ok": True,
        "cita_id": cita_nueva,
        "inicio": cuando.isoformat(),
        "aviso": aviso,
        "cancelar_url": str(creada.get("cancel_url") or ""),
        "cambiar_url": str(creada.get("reschedule_url") or ""),
    }


async def _quitar_marca(marca, db_session: AsyncSession) -> None:
    try:
        await db_session.delete(marca)
        await db_session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo quitar la marca del cambio de hora")
        await db_session.rollback()


async def cancelar_llamada(
    *, cita_id: str, nombre: str, email: str, inicio: str, mensaje: str, autor: str, db_session: AsyncSession
) -> dict:
    """Cancela la llamada en Calendly (a la persona le llega su correo de
    cancelación, con `mensaje` como motivo) y lo deja en su ficha."""
    email = (email or "").strip().lower()[:255]
    uuid = uuid_de_cita(cita_id)
    if not uuid:
        return {"ok": False, "motivo": "Falta la llamada que se cancela"}
    cuando = _utc(inicio)
    if cuando is not None and cuando <= datetime.now(timezone.utc):
        return {"ok": False, "motivo": "Esa llamada ya ha pasado: apunta en «¿Qué pasó?» lo que fue"}
    if not A._token():
        return {"ok": False, "motivo": "Calendly no está conectado (falta LEARNHOUSE_CALENDLY_TOKEN)"}
    mensaje = (mensaje or "").strip()[:500]
    try:
        async with _cliente() as cliente:
            await _pedir(
                cliente, "POST", f"{A.API}/scheduled_events/{uuid}/cancellation",
                json={"reason": mensaje or MOTIVO_CANCELAR},
            )
    except FalloCalendly as exc:
        logger.warning("Calendly no dejó cancelar la llamada (%s): %s", exc.codigo, exc.motivo)
        return {"ok": False, "motivo": exc.motivo, "codigo": exc.codigo}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo cancelar la llamada en Calendly")
        return {"ok": False, "motivo": f"Calendly no contesta: {exc}"}

    A._cache["hasta"] = 0.0
    if email:
        try:
            db_session.add(
                _evento_de_ficha(
                    email, nombre, "", TIPO_CANCELADA,
                    {"autor": autor, "inicio": cuando.isoformat() if cuando else "", "mensaje": mensaje, "cita": cita_id},
                )
            )
            await db_session.commit()
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo apuntar la cancelación de %s", email)
            await db_session.rollback()
    return {"ok": True}


async def _apuntar(email: str, nombre: str, telefono: str, cuando: datetime, autor: str, hecha: bool, db_session: AsyncSession) -> None:
    """La persona, en la escuela: el evento con quién la agendó y para cuándo,
    y su llamada pendiente en Llamadas, hecha. En blando. Y en systeme.io, la
    etiqueta que la saca de las campañas de correo."""
    from src.services.crm.systeme import marcar_llamada_reservada

    marcar_llamada_reservada(email, nombre)
    try:
        from src.db.contact_event import ContactEventCreate
        from src.services.contactos.contactos import registrar_evento

        partes = nombre.split(" ", 1)
        await registrar_evento(
            ContactEventCreate(
                email=email, kind="llamada-equipo", first_name=partes[0], last_name=partes[1] if len(partes) > 1 else "",
                phone=telefono, source="equipo",
                extra={"autor": autor, "inicio": cuando.isoformat(), "confirmada": hecha},
            ),
            db_session,
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo apuntar la llamada agendada de %s", email)
        await db_session.rollback()
    try:
        from src.services.contactos.templadas import cerrar_pendientes_de

        await cerrar_pendientes_de(email, "hecha", db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo cerrar la llamada pendiente de %s", email)
        await db_session.rollback()


async def telefonos_por_email(emails: set[str], db_session: AsyncSession) -> dict[str, str]:
    """El último teléfono que dejó cada correo (formularios, matrícula,
    solicitudes): para el WhatsApp de las citas, que Calendly no siempre trae."""
    from sqlmodel import func, select

    from src.db.contact_event import ContactEvent
    from src.db.enrollment import Enrollment
    from src.db.enrollment_request import EnrollmentRequest

    claves = {e.strip().lower() for e in emails if e}
    if not claves:
        return {}
    salida: dict[str, tuple[str, str]] = {}
    for modelo in (ContactEvent, EnrollmentRequest, Enrollment):
        filas = (
            await db_session.execute(
                select(modelo.email, modelo.phone, modelo.created_at).where(func.lower(modelo.email).in_(claves))  # type: ignore[attr-defined]
            )
        ).all()
        for email, tel, cuando in filas:
            tel = (tel or "").strip()
            if not tel:
                continue
            k = (email or "").strip().lower()
            if k not in salida or str(cuando or "") > salida[k][1]:
                salida[k] = (tel, str(cuando or ""))
    return {k: v[0] for k, v in salida.items()}


# ── por qué no sale un closer en «Quién la lleva» (06/11/2026) ─────────────
#
# "No sale lo de Belén, y el evento gestionado lo tengo bien". Desde aquí no se
# puede ver Calendly, así que la ventana enseña qué eventos ve la escuela y
# por qué cuenta o descarta cada uno. Solo lee.

_TIPO_LEGIBLE = {"round_robin": "por turnos", "collective": "colectivo"}


def por_que_cada_evento(
    tipos: list[dict], miembros: dict[str, dict], equipo: list[dict], mapa: dict[str, str],
    preferido: str = EVENTO_POR_DEFECTO,
) -> list[dict]:
    """Una fila por tipo de evento de Calendly: {evento, como, de, gestionado,
    secreto, vale, motivo}. Mismas reglas que `eventos_de_closers` y
    `opciones`. Función pura, con test."""
    from src.services.panel.reparto import closer_del_anfitrion

    base = evento_publico(tipos, preferido)
    nombre_base = str((base or {}).get("name") or "Llamada de Consultoría HN")
    filas = []
    for t in tipos:
        perfil = t.get("profile") or {}
        dueno = miembros.get(str(perfil.get("owner") or "")) or {}
        email = str(dueno.get("email") or "").strip().lower()
        fila = {
            "evento": str(t.get("name") or ""),
            "como": _TIPO_LEGIBLE.get(str(t.get("pooling_type") or "").lower(), "1 a 1"),
            "de": email or str(perfil.get("name") or ""),
            "gestionado": bool(t.get("admin_managed")),
            "secreto": es_secreto(t),
            "vale": False,
            "motivo": "",
        }
        if base and t.get("uri") == base.get("uri"):
            fila["motivo"] = "Es el evento de las llamadas de la web («Por turnos»)."
        elif not t.get("active", True):
            fila["motivo"] = "Está apagado en Calendly."
        elif es_por_turnos(t):
            fila["motivo"] = "Es por turnos: no es el evento de un closer."
        elif str(perfil.get("type") or "User") != "User":
            fila["motivo"] = f"Calendly lo da como de «{perfil.get('type')}», no de una persona."
        elif _rango_de_llamada(t, base, preferido) is None:
            fila["motivo"] = f"Su nombre no empieza por «{nombre_base}»."
        elif "@" not in email:
            fila["motivo"] = "Calendly no dice de quién es (su dueño no sale en la organización)."
        else:
            closer = closer_del_anfitrion(email, equipo, mapa)
            if not closer:
                fila["motivo"] = (
                    f"Es de {email}, que no es ningún closer de la escuela: apunta ese correo junto a su closer "
                    "en Ventas → «Correos de Calendly»."
                )
            else:
                fila["vale"] = True
                fila["motivo"] = f"Vale: es el evento propio de {(closer.get('nombre') or '').split(' ')[0]}."
        filas.append(fila)
    return filas


async def revisar_eventos(db_session: AsyncSession) -> dict:
    """Para la ventana: {fuente, filas} con lo que ve la escuela AHORA (sin la
    copia de 5 minutos, por si se acaba de crear el evento)."""
    if not A._token():
        return {"configurado": False, "fuente": "", "filas": []}
    from src.services.panel.reparto import _equipo_de_la_escuela, leer

    try:
        async with _cliente() as cliente:
            tipos, _ = await _eventos(cliente, forzar=True)
            miembros = await _miembros(cliente)
    except FalloCalendly as exc:
        return {"configurado": True, "fuente": "", "filas": [], "error": exc.motivo}
    org_id, eq = await _equipo_de_la_escuela(db_session)
    mapa = (await leer(db_session, org_id or None))["calendly"]
    return {
        "configurado": True,
        "fuente": _eventos_cache.get("fuente") or "",
        "filas": por_que_cada_evento(tipos, miembros, eq, mapa, _preferido()),
    }


# ── por qué no salen más horas (06/11/2026) ────────────────────────────────
#
# "Puse el evento de Belén de 9 a 20 y con poca antelación, y la escuela sigue
# enseñando desde las 14:30". La escuela enseña tal cual lo que da Calendly,
# así que esto le pregunta a Calendly por qué: el horario del evento (con su
# zona horaria: un 9:00 de otra zona es otra hora aquí), el horario por
# defecto de su dueño y lo que tiene ocupado ese día en sus calendarios. Solo
# lee y todo en blando: lo que Calendly no deje leer sale como aviso.

_DIAS_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
_DIAS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _hora_nl(iso: str) -> str:
    d = _utc(iso)
    return d.astimezone(ZONA).strftime("%H:%M") if d else ""


def _intervalos_del_dia(horario: dict, dia: str) -> Optional[list[tuple[str, str]]]:
    """Las franjas de ese día en un horario de Calendly (`rules`: por día de
    la semana o por fecha concreta, que gana). None si no dice nada. Pura."""
    reglas = horario.get("rules") or []
    d = datetime.strptime(dia, "%Y-%m-%d")
    por_fecha = [r for r in reglas if (r or {}).get("type") == "date" and (r or {}).get("date") == dia]
    por_dia = [r for r in reglas if (r or {}).get("type") == "wday" and (r or {}).get("wday") == _DIAS_EN[d.weekday()]]
    elegidas = por_fecha or por_dia
    if not elegidas:
        return None
    return [
        (str(i.get("from") or ""), str(i.get("to") or ""))
        for r in elegidas for i in (r.get("intervals") or []) if isinstance(i, dict)
    ]


def _en_hora_nl(dia: str, hhmm: str, zona: str) -> str:
    try:
        z = ZoneInfo(zona) if zona else ZONA
        h, m = (int(x) for x in hhmm.split(":")[:2])
        d = datetime.strptime(dia, "%Y-%m-%d").replace(hour=h % 24, minute=m, tzinfo=z)
        return d.astimezone(ZONA).strftime("%H:%M")
    except Exception:  # noqa: BLE001
        return hhmm


def explicar_horas(dia: str, horarios: list[dict], ocupado: list[dict], libres: list[str], ahora: Optional[datetime] = None) -> list[str]:
    """Frases para la pantalla. `horarios`: [{nombre, timezone, rules}],
    `ocupado`: [{start_time, end_time, type}], `libres`: inicios ISO. Pura."""
    d = datetime.strptime(dia, "%Y-%m-%d")
    nombre_dia = _DIAS_ES[d.weekday()]
    frases: list[str] = []
    for h in horarios:
        zona = str(h.get("timezone") or "")
        franjas = _intervalos_del_dia(h, dia)
        que = f"Horario «{h.get('nombre') or 'del evento'}»"
        if zona:
            que += f" (zona horaria {zona})"
        if any((r or {}).get("type") == "date" and (r or {}).get("date") == dia for r in h.get("rules") or []):
            que += ", con horas puestas solo para ese día («horas para una fecha concreta»)"
        if franjas is None:
            frases.append(f"{que}: no tiene horas el {nombre_dia}.")
        elif not franjas:
            frases.append(f"{que}: el {nombre_dia} está marcado como no disponible.")
        else:
            texto = ", ".join(f"{a}–{b}" for a, b in franjas)
            try:
                otra_zona = bool(zona) and ZoneInfo(zona).utcoffset(d) != ZONA.utcoffset(d)
            except Exception:  # noqa: BLE001
                otra_zona = False
            if otra_zona:
                nl = ", ".join(f"{_en_hora_nl(dia, a, zona)}–{_en_hora_nl(dia, b, zona)}" for a, b in franjas)
                frases.append(f"{que}: {texto} en su zona, que en Países Bajos son {nl}.")
            else:
                frases.append(f"{que}: {texto}.")
    for o in ocupado:
        a, b = _hora_nl(str(o.get("start_time") or "")), _hora_nl(str(o.get("end_time") or ""))
        if not a:
            continue
        origen = "otra llamada de Calendly" if o.get("type") == "calendly" else "algo en su calendario"
        frases.append(f"Ocupado de {a} a {b}: {origen}.")
    if libres:
        primera = _utc(sorted(libres)[0])
        frases.append(f"Calendly da {len(libres)} horas libres, la primera a las {_hora_nl(sorted(libres)[0])}.")
        ahora = ahora or datetime.now(timezone.utc)
        ocupado_antes = any((_utc(str(o.get("start_time") or "")) or primera) < primera for o in ocupado)
        if primera and not ocupado_antes and primera - ahora < timedelta(hours=48):
            horas = (primera - ahora).total_seconds() / 3600
            frases.append(
                f"La primera hora libre cae a {horas:.0f} h de ahora: si antes no hay nada ocupado y el horario empieza "
                "antes, lo que la corta es el «aviso mínimo» del evento."
            )
    else:
        frases.append("Calendly no da ninguna hora libre ese día.")
    return frases


async def por_que_estas_horas(dia: str, evento: str = "") -> dict:
    """Para la ventana: {evento, frases, avisos} del día y evento elegidos."""
    if not A._token():
        return {"configurado": False, "frases": [], "avisos": []}
    try:
        desde, hasta = limites_del_dia(dia)
    except ValueError:
        return {"configurado": True, "frases": [], "avisos": ["Fecha no válida"]}
    avisos: list[str] = []
    horarios: list[dict] = []
    ocupado: list[dict] = []
    libres: list[str] = []
    try:
        async with _cliente() as cliente:
            tipo = await _tipo_para(cliente, evento)
            uri = str(tipo.get("uri") or "")
            dueno = str((tipo.get("profile") or {}).get("owner") or "")
            try:
                datos = await _pedir(cliente, "GET", f"{A.API}/event_type_available_times",
                                     params={"event_type": uri, "start_time": _z(desde), "end_time": _z(hasta)})
                libres = [str(h.get("start_time")) for h in datos.get("collection") or [] if h.get("start_time")]
            except FalloCalendly as exc:
                avisos.append(f"Horas libres: {exc.motivo}")
            try:
                datos = await _pedir(cliente, "GET", f"{A.API}/event_type_availability_schedules", params={"event_type": uri})
                for s in datos.get("collection") or []:
                    regla = (s or {}).get("availability_rule") or s or {}
                    horarios.append({"nombre": "del evento", "timezone": regla.get("timezone") or s.get("timezone"),
                                     "rules": regla.get("rules") or []})
            except FalloCalendly as exc:
                avisos.append(f"Horario del evento: {exc.motivo}")
            if dueno.startswith("http") and "/users/" in dueno:
                if not horarios:
                    try:
                        datos = await _pedir(cliente, "GET", f"{A.API}/user_availability_schedules", params={"user": dueno})
                        for s in datos.get("collection") or []:
                            if s.get("default"):
                                horarios.append({"nombre": f"{s.get('name') or 'por defecto'} (el de su cuenta)",
                                                 "timezone": s.get("timezone"), "rules": s.get("rules") or []})
                    except FalloCalendly as exc:
                        avisos.append(f"Horario de su cuenta: {exc.motivo}")
                try:
                    datos = await _pedir(cliente, "GET", f"{A.API}/user_busy_times",
                                         params={"user": dueno, "start_time": _z(desde), "end_time": _z(hasta)})
                    ocupado = list(datos.get("collection") or [])
                except FalloCalendly as exc:
                    avisos.append(f"Ocupado en su calendario: {exc.motivo}")
    except FalloCalendly as exc:
        return {"configurado": True, "frases": [], "avisos": [exc.motivo]}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo explicar las horas de Calendly")
        return {"configurado": True, "frases": [], "avisos": [f"Calendly no contesta: {exc}"]}
    return {
        "configurado": True,
        "evento": str(tipo.get("name") or ""),
        "frases": explicar_horas(dia, horarios, ocupado, libres),
        "avisos": avisos,
    }

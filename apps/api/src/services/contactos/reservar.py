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

`api.calendly.com` no se alcanza desde el entorno donde se escribió esto: la
forma de las respuestas está sacada de la documentación, y lo puro tiene test.
"""

from __future__ import annotations

import logging
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


def evento_elegido(tipos: list[dict], preferido: str = EVENTO_POR_DEFECTO) -> Optional[dict]:
    """El tipo de evento a agendar: el del slug (o dirección) preferido si está
    activo; si no, el primero activo."""
    activos = [t for t in tipos if t.get("active", True)]
    clave = (preferido or "").strip().rstrip("/").rsplit("/", 1)[-1].lower()
    for t in activos:
        slug = str(t.get("slug") or "").lower()
        url = str(t.get("scheduling_url") or "").rstrip("/").rsplit("/", 1)[-1].lower()
        if clave and clave in (slug, url):
            return t
    return activos[0] if activos else None


def ubicacion_para(tipo: dict, telefono: str = "") -> Optional[dict]:
    """El objeto `location` que pide `POST /invitees`: el primero que tenga el
    tipo de evento. Sin ubicaciones en el evento, no se manda (Calendly lo
    rechaza si se manda de más)."""
    lugares = tipo.get("locations") or []
    if not lugares:
        return None
    lugar = lugares[0] or {}
    kind = str(lugar.get("kind") or "")
    if not kind:
        return None
    salida: dict[str, Any] = {"kind": kind}
    if kind == "outbound_call":
        # «Te llamamos nosotros»: el número es el de la persona.
        if telefono:
            salida["location"] = telefono
    elif kind not in _VIDEO and lugar.get("location"):
        salida["location"] = lugar["location"]
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
    extra = "; ".join(str(d.get("message") or "") for d in detalles if isinstance(d, dict) and d.get("message"))
    texto = str(cuerpo.get("message") or cuerpo.get("title") or f"Calendly contestó {r.status_code}")
    return f"{texto}{' (' + extra + ')' if extra else ''}"


async def _pedir(cliente: httpx.AsyncClient, metodo: str, url: str, **kw) -> dict:
    r = await cliente.request(metodo, url, **kw)
    if r.status_code >= 400:
        raise FalloCalendly(_motivo(r), r.status_code)
    return r.json() if r.content else {}


def _cliente() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=15.0, headers={"Authorization": f"Bearer {A._token()}"})


async def _tipo(cliente: httpx.AsyncClient) -> dict:
    import os

    yo = (await _pedir(cliente, "GET", f"{A.API}/users/me")).get("resource") or {}
    tipos = (
        await _pedir(cliente, "GET", f"{A.API}/event_types", params={"user": yo.get("uri", ""), "active": "true", "count": 100})
    ).get("collection") or []
    tipo = evento_elegido(tipos, os.environ.get("LEARNHOUSE_CALENDLY_EVENTO") or EVENTO_POR_DEFECTO)
    if not tipo:
        raise FalloCalendly("No hay ningún tipo de evento activo en Calendly")
    return tipo


async def huecos(dia: str) -> dict:
    """Las horas libres de ese día en el evento de las llamadas."""
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
            tipo = await _tipo(cliente)
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
    *, nombre: str, email: str, telefono: str, inicio: str, url_hueco: str, autor: str, db_session: AsyncSession
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
            tipo = await _tipo(cliente)
            plan_b = plan_b or enlace_de_hora(str(tipo.get("scheduling_url") or ""), cuando)
            cuerpo: dict[str, Any] = {
                "event_type": tipo.get("uri", ""),
                "start_time": _z(cuando),
                "invitee": {"name": nombre, "email": email, "timezone": str(ZONA)},
                "tracking": {"utm_source": "escuela", "utm_medium": "panel", "utm_campaign": "agendada-por-el-equipo"},
            }
            lugar = ubicacion_para(tipo, telefono)
            if lugar:
                cuerpo["location"] = lugar
            creada = (await _pedir(cliente, "POST", f"{A.API}/invitees", json=cuerpo)).get("resource") or {}
    except FalloCalendly as exc:
        logger.warning("Calendly no dejó agendar por la API (%s): se manda a su página", exc.codigo)
        plan = " En el plan gratis de Calendly esto no se puede hacer desde fuera." if exc.codigo in (401, 403) else ""
        await _apuntar(email, nombre, telefono, cuando, autor, False, db_session)
        return {
            "ok": True,
            "modo": "enlace",
            "url": con_datos(plan_b, nombre, email) if plan_b else "",
            "motivo": f"{exc.motivo}.{plan}".replace("..", "."),
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
        "cancelar_url": str(creada.get("cancel_url") or ""),
        "cambiar_url": str(creada.get("reschedule_url") or ""),
    }


async def _apuntar(email: str, nombre: str, telefono: str, cuando: datetime, autor: str, hecha: bool, db_session: AsyncSession) -> None:
    """La persona, en la escuela: el evento con quién la agendó y para cuándo,
    y su llamada pendiente en Llamadas, hecha. En blando."""
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

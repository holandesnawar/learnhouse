"""
Llamadas: quién ha terminado la cualificación de /agendar y qué contestó.

Para qué
--------
La cualificación se guardaba como un evento más en el historial del contacto,
y para leerla había que ir a Contactos, buscar a la persona, abrir su ficha y
bajar hasta el evento. Con tres o cuatro llamadas a la semana eso es perder
una: nadie abre fichas "por si acaso". Aquí salen todas seguidas, la más
reciente arriba, con la nota y si ya se le ha atendido. Se abre una y están
todas sus respuestas.

Además, **cada cualificación nueva avisa por correo a los administradores**.
El panel es para trabajar; el correo es para enterarse.

De dónde sale
-------------
- `contact_event` con `kind == "cualificacion"` → la persona, la nota
  (`extra.puntuacion`, `extra.apto`) y las respuestas (`extra.respuestas`).
- `contact_event` con `kind == "agendar-empezado"` → la web lo manda en
  cuanto la persona pasa la pantalla de datos. Si después no llega su
  cualificación, sale aquí como **"No terminó"**: dejó nombre, correo y
  teléfono y se fue a mitad. Es el lead que más se perdía con un formulario
  largo, y justo al que conviene escribir.
- `enrollment_request` con `source == "llamada"` → el mismo formulario crea
  también una solicitud, y esa fila es la que lleva la marca de "atendida"
  (`contacted_at`). La lista une las dos por correo, así el botón de "ya le he
  llamado" es el mismo que en Matrículas nuevas y no hay dos marcas distintas.
"""

import json
import logging
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent
from src.db.enrollment_request import EnrollmentRequest
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.payments.solicitudes import resumen_del_lead

logger = logging.getLogger(__name__)

#: Administrador. Mismo número que `security/rbac/constants.py`.
_ROL_ADMIN = 1

#: Hasta dónde se guarda el JSON de `extra`. Antes se cortaba a 2000
#: caracteres con un `[:2000]` a secas: un JSON cortado por la mitad no es
#: JSON, así que al leerlo fallaba y la ficha se quedaba SIN respuestas.
#: Con once preguntas y una abierta, 2000 no llegaba.
TOPE_EXTRA = 8000


def extra_serializado(extra: dict, tope: int = TOPE_EXTRA) -> str:
    """JSON de `extra` que cabe en el tope y sigue siendo JSON válido.

    Si no cabe, se acortan primero los textos largos (la respuesta abierta),
    y si aun así no cabe, se quitan las respuestas y se deja constancia. Lo
    que nunca se hace es cortar la cadena por la mitad.
    """
    texto = json.dumps(extra or {}, ensure_ascii=False)
    if len(texto) <= tope:
        return texto

    recortado = dict(extra)
    respuestas = recortado.get("respuestas")
    if isinstance(respuestas, list):
        recortado["respuestas"] = [
            {**r, "respuesta": str(r.get("respuesta", ""))[:600]} if isinstance(r, dict) else r
            for r in respuestas
        ]
    texto = json.dumps(recortado, ensure_ascii=False)
    if len(texto) <= tope:
        return texto

    recortado.pop("respuestas", None)
    recortado["_truncado"] = True
    return json.dumps(recortado, ensure_ascii=False)[:tope]


def fila_llamada(evento: dict, solicitud: Optional[dict]) -> dict:
    """Una llamada para el panel. Función pura: `evento` es la fila de
    `contact_event` como dict y `solicitud` la de `enrollment_request` (o
    None si no la hay)."""
    extra = evento.get("extra") or {}
    if isinstance(extra, str):
        try:
            extra = json.loads(extra) if extra else {}
        except Exception:  # noqa: BLE001
            extra = {}
    respuestas = extra.get("respuestas")
    if not isinstance(respuestas, list):
        respuestas = []

    nombre = f"{evento.get('first_name') or ''} {evento.get('last_name') or ''}".strip()
    terminado = evento.get("kind", "cualificacion") != "agendar-empezado"
    return {
        "id": evento.get("id"),
        "terminado": terminado,
        "name": nombre,
        "email": evento.get("email") or "",
        "phone": evento.get("phone") or "",
        "created_at": evento.get("created_at") or "",
        "apto": bool(extra.get("apto")),
        "puntuacion": int(extra.get("puntuacion") or 0),
        # Por qué se quedó fuera (una de las líneas rojas de la web). Vacío si
        # encaja, y también en las llamadas de antes del 23/09, que decidía
        # una suma con corte y no guardaba motivo.
        "motivo_fuera": str(extra.get("motivo_fuera") or ""),
        "respuestas": [
            {
                "pregunta": str(r.get("pregunta", "")),
                "respuesta": str(r.get("respuesta", "")),
                "puntos": r.get("puntos", 0),
            }
            for r in respuestas
            if isinstance(r, dict)
        ],
        "sin_respuestas": terminado and (bool(extra.get("_truncado")) or not respuestas),
        # Solo en los que no terminaron: en qué pregunta se quedaron.
        "ultima_pregunta": "" if terminado else str(extra.get("ultima") or ""),
        **resumen_del_lead(
            evento.get("recorrido") or "", evento.get("referrer") or "", evento.get("source") or "llamada"
        ),
        "utm_campaign": evento.get("utm_campaign") or "",
        # Cuándo reservó hora en el calendario (vacío si todavía no).
        "reservada_at": evento.get("reservada_at") or "",
        "solicitud_id": (solicitud or {}).get("id"),
        # Atendida: la marca de la solicitud (la misma de Matrículas nuevas)
        # o, si no hay solicitud (los que no terminaron, o si la escuela
        # rechazó la solicitud por el tope), la que se guarda en el evento.
        "contacted_at": (solicitud or {}).get("contacted_at") or str(extra.get("atendida_at") or ""),
    }


def elegir_eventos(eventos: list) -> list:
    """De todos los eventos de llamada (ya en orden, el más nuevo primero),
    los que salen en la lista. Función pura, para probarla sin base de datos.

    - De las cualificaciones terminadas sale solo la última de cada correo:
      desde /agendar se puede volver atrás, cambiar una respuesta y enviar
      otra vez, y eso es la misma persona, no dos llamadas.
    - Un "agendar-empezado" sale solo si ese correo no ha terminado nunca, y
      una sola vez por correo: si empezó tres veces sin acabar, es una
      persona, no tres. Si terminó alguna vez, ya tiene su línea con las
      respuestas y el "empezado" sobra.
    """
    terminaron = {e.email for e in eventos if e.kind == "cualificacion"}
    salida = []
    vistos: set[str] = set()
    terminadas_vistas: set[str] = set()
    for e in eventos:
        if e.kind == "cualificacion":
            if e.email in terminadas_vistas:
                continue
            terminadas_vistas.add(e.email)
            salida.append(e)
        elif e.kind == "agendar-empezado" and e.email not in terminaron and e.email not in vistos:
            vistos.add(e.email)
            salida.append(e)
    return salida


async def listar_llamadas(db_session: AsyncSession, limite: int = 200) -> list[dict]:
    """Las cualificaciones y los que empezaron sin terminar, la más reciente
    arriba, con la marca de atendida."""
    todos = (
        await db_session.execute(
            select(ContactEvent)
            .where(ContactEvent.kind.in_(["cualificacion", "agendar-empezado"]))  # type: ignore[attr-defined]
            .order_by(ContactEvent.id.desc())  # type: ignore[attr-defined]
            .limit(limite * 3)
        )
    ).scalars().all()
    eventos = elegir_eventos(list(todos))[:limite]
    if not eventos:
        return []

    emails = {e.email for e in eventos if e.email}
    solicitudes: dict[str, dict] = {}
    filas = (
        await db_session.execute(
            select(EnrollmentRequest)
            .where(EnrollmentRequest.email.in_(emails))  # type: ignore[attr-defined]
            .where(EnrollmentRequest.source == "llamada")
            .order_by(EnrollmentRequest.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().all()
    for f in filas:
        # La más reciente de cada correo manda (van en orden descendente).
        solicitudes.setdefault(f.email, {"id": f.id, "contacted_at": f.contacted_at or ""})

    # Quién ya reservó hora en el calendario de /agendar (evento "reunion",
    # lo manda la web cuando Calendly avisa). Solo cuenta si es posterior a su
    # cualificación: una reunión vieja no dice nada de la petición de hoy.
    reservas: dict[str, tuple[int, str]] = {}
    for r in (
        await db_session.execute(
            select(ContactEvent)
            .where(ContactEvent.kind == "reunion")
            .where(ContactEvent.email.in_(emails))  # type: ignore[attr-defined]
        )
    ).scalars().all():
        previa = reservas.get(r.email)
        if previa is None or (r.id or 0) > previa[0]:
            reservas[r.email] = (r.id or 0, r.created_at or "")

    def _reserva(e) -> str:
        r = reservas.get(e.email)
        return r[1] if r and r[0] > (e.id or 0) else ""

    return [
        fila_llamada(
            {
                "id": e.id,
                "kind": e.kind,
                "email": e.email,
                "first_name": e.first_name,
                "last_name": e.last_name,
                "phone": e.phone,
                "source": e.source,
                "recorrido": e.recorrido,
                "referrer": e.referrer,
                "utm_campaign": e.utm_campaign,
                "created_at": e.created_at,
                "extra": e.extra,
                "reservada_at": _reserva(e),
            },
            solicitudes.get(e.email),
        )
        for e in eventos
    ]


async def emails_de_administradores(db_session: AsyncSession) -> list[str]:
    """A quién avisar: los administradores de la escuela (rol 1)."""
    filas = (
        await db_session.execute(
            select(User.email)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(UserOrganization.role_id == _ROL_ADMIN)
        )
    ).all()
    vistos: list[str] = []
    for (email,) in filas:
        e = (email or "").strip().lower()
        if e and e not in vistos:
            vistos.append(e)
    return vistos


async def avisar_equipo_llamada(fila: ContactEvent, db_session: AsyncSession) -> int:
    """Manda a cada administrador el correo de "alguien ha pedido una llamada"
    con las respuestas dentro. Devuelve cuántos correos salieron. Nunca lanza:
    el evento ya está guardado y un fallo del correo no debe devolverle un
    error a la web."""
    from src.services.users.emails import send_llamada_pedida_email

    llamada = fila_llamada(
        {
            "id": fila.id,
            "email": fila.email,
            "first_name": fila.first_name,
            "last_name": fila.last_name,
            "phone": fila.phone,
            "source": fila.source,
            "recorrido": fila.recorrido,
            "referrer": fila.referrer,
            "utm_campaign": fila.utm_campaign,
            "created_at": fila.created_at,
            "extra": fila.extra,
        },
        None,
    )
    enviados = 0
    try:
        destinatarios = await emails_de_administradores(db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada")
        return 0
    for destino in destinatarios:
        try:
            send_llamada_pedida_email(destino, llamada)
            enviados += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar a %s de la llamada de %s", destino, fila.email)
    return enviados


async def marcar_llamada(event_id: int, atendida: bool, db_session: AsyncSession) -> Optional[dict]:
    """Marca como atendida una llamada que no tiene solicitud (la marca va en
    el propio evento, dentro de `extra`)."""
    from datetime import datetime, timezone

    fila = (
        await db_session.execute(select(ContactEvent).where(ContactEvent.id == event_id))
    ).scalars().first()
    if fila is None or fila.kind not in ("cualificacion", "agendar-empezado"):
        return None
    try:
        extra = json.loads(fila.extra) if fila.extra else {}
    except Exception:  # noqa: BLE001
        extra = {}
    if atendida:
        extra["atendida_at"] = datetime.now(timezone.utc).isoformat()
    else:
        extra.pop("atendida_at", None)
    fila.extra = extra_serializado(extra)
    db_session.add(fila)
    await db_session.commit()
    return {"id": fila.id, "contacted_at": extra.get("atendida_at", "")}

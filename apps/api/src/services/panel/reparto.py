"""
El reparto de las llamadas entre los closers (22/10/2026).

Pedido: "cada llamada que se agende le llegue a Diego, el closer principal, con
la opción de quedársela o pasársela al otro closer". Así funciona:

1. Alguien reserva una llamada (la web avisa con el evento `reunion`). A quien
   reparte (`reparto_llamadas.repartidor_id` en la configuración de la escuela;
   si no hay nadie puesto, a los administradores) le llega un correo y la
   tarjeta sale en el tablero de Ventas, en «Por asignar».
2. Desde ahí, «Para mí» o «Para <otro closer>» (`pipeline.asignar`). Al closer
   que la recibe le llega otro correo, salvo que se la quede quien reparte.
3. Si el equipo reserva la llamada desde el panel, se la queda quien la
   reserva si es closer (`reservar.py`), sin pasar por «Por asignar».
4. Si quien reserva YA tenía closer (volvió a reservar tras un No show, o se
   la agendó un closer desde el panel), el aviso le llega a ESE closer
   («Ha reservado una llamada contigo») y no a quien reparte: su tarjeta no
   pasa por «Por asignar» y el aviso de repartir confundía (28/10, al entrar
   la segunda closer).

Mientras la agenda siga en Calendly, el enlace de la videollamada es el del
evento de Calendly (el de Diego): el otro closer entra con ese mismo enlace.
Para eso, en Zoom, "permitir que los participantes entren antes que el
anfitrión". Lo bueno vendrá con la agenda propia: un enlace de la escuela por
llamada que lleva a la sala de quien la tenga asignada.

Los correos no lanzan nunca: el reparto ya está guardado y un fallo del correo
no puede devolver un error a la pantalla ni a la web.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

CLAVE = "reparto_llamadas"


async def _fila_config(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    q = select(OrganizationConfig)
    if org_id is not None:
        q = q.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


async def leer(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    """{"repartidor_id": int} (0 = nadie: avisa a los administradores). Sin
    `org_id`, la de la escuela (single-tenancy): así lo puede leer el aviso
    que llega de la web, que no sabe de escuelas."""
    fila = await _fila_config(db_session, org_id)
    guardado = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    if not isinstance(guardado, dict):
        return {"repartidor_id": 0}
    try:
        return {"repartidor_id": int(guardado.get("repartidor_id") or 0)}
    except (TypeError, ValueError):
        return {"repartidor_id": 0}


async def guardar(org_id: int, repartidor_id: int, db_session: AsyncSession) -> dict:
    fila = await _fila_config(db_session, org_id)
    if fila is None:
        return {"ok": False, "motivo": "La escuela no tiene configuración"}
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = {"repartidor_id": int(repartidor_id or 0)}
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "repartidor_id": int(repartidor_id or 0)}


def destinos(repartidor_id: int, equipo: list[dict], administradores: list[str]) -> list[str]:
    """A quién avisar de una llamada nueva: quien reparte, si está puesto y
    sigue en el equipo del panel; si no, los administradores. Función pura."""
    for m in equipo:
        if repartidor_id and m.get("id") == repartidor_id and m.get("email"):
            return [m["email"].strip().lower()]
    return administradores


async def _equipo_de_la_escuela(db_session: AsyncSession) -> tuple[int, list[dict]]:
    from src.services.panel.tareas import equipo

    fila = await _fila_config(db_session)
    org_id = int(getattr(fila, "org_id", 0) or 0)
    return org_id, (await equipo(org_id, db_session) if org_id else [])


async def avisar_llamada_nueva(datos: dict, db_session: AsyncSession) -> int:
    """Correo de «llamada nueva, repártela». datos: nombre, email, telefono,
    cuando. Devuelve cuántos salieron."""
    from src.services.contactos.llamadas import emails_de_administradores
    from src.services.users.emails import send_llamada_agendada_email

    # Desde el 27/10 avisan de una reserva la web (evento `reunion`) y
    # Calendly (`correo_reserva.py`): la misma reserva, un solo correo. En
    # Redis y en blando: sin Redis, puede salir dos veces, nunca ninguna.
    email = str(datos.get("email") or "").strip().lower()
    r = None
    if email:
        try:
            from src.core.redis import get_redis_client

            r = get_redis_client()
            if r is not None and not r.set(f"llamada-nueva:{email}", "1", nx=True, ex=1800):
                return 0
        except Exception:  # noqa: BLE001
            r = None

    try:
        _, eq = await _equipo_de_la_escuela(db_session)
        suyo = await _closer_que_la_lleva(email, eq, db_session)
        a_quien = (
            [suyo["email"].strip().lower()] if suyo
            else destinos((await leer(db_session))["repartidor_id"], eq, await emails_de_administradores(db_session))
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada nueva")
        return 0
    enviados = 0
    for destino in a_quien:
        try:
            if suyo:
                from src.services.users.emails import send_llamada_asignada_email

                send_llamada_asignada_email(destino, {**datos, "vuelve": True})
            else:
                send_llamada_agendada_email(destino, datos)
            enviados += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar de la llamada nueva")
    if not enviados and r is not None:
        # No salió ninguno: que el siguiente aviso de esta reserva lo intente.
        try:
            r.delete(f"llamada-nueva:{email}")
        except Exception:  # noqa: BLE001
            pass
    return enviados


async def _closer_que_la_lleva(email: str, equipo: list[dict], db_session: AsyncSession) -> Optional[dict]:
    """El closer que ya lleva a esa persona (del equipo del panel y con correo),
    o None."""
    if not email:
        return None
    from src.services.panel.pipeline import _la_asignada, filas_de

    # En blando: si no se puede saber, avisa a quien reparte, como siempre.
    try:
        filas = await filas_de(email, db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer si esa persona ya tenía closer")
        return None
    closer_id = int(getattr(_la_asignada(filas), "closer_id", 0) or 0) if filas else 0
    if not closer_id:
        return None
    return next((m for m in equipo if m.get("id") == closer_id and m.get("email")), None)


def avisar_asignada(closer_email: str, datos: dict) -> bool:
    """Correo al closer al que le han pasado una llamada."""
    from src.services.users.emails import send_llamada_asignada_email

    if not closer_email:
        return False
    try:
        send_llamada_asignada_email(closer_email, datos)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar al closer de su llamada")
        return False

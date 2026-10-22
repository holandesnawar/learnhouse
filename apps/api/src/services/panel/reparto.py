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

    try:
        _, eq = await _equipo_de_la_escuela(db_session)
        a_quien = destinos((await leer(db_session))["repartidor_id"], eq, await emails_de_administradores(db_session))
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada nueva")
        return 0
    enviados = 0
    for destino in a_quien:
        try:
            send_llamada_agendada_email(destino, datos)
            enviados += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar de la llamada nueva")
    return enviados


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

"""
Avisos por email a los alumnos de la academia.

Un aviso es algo que el equipo decide mandar: el horario de la clase semanal ya
confirmado, o una novedad importante publicada en la comunidad. NO son
notificaciones automáticas de cada mensaje: eso satura y acaba en spam.

El envío va SIEMPRE en segundo plano (BackgroundTasks): mandar 40 correos
tarda, y quien pulsa el botón no tiene por qué esperar. Cada correo se manda en
su propio try: si falla el de un alumno, los demás salen igual.
"""

import logging
from typing import List, Tuple

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.services.orgs.orgs import rbac_check

logger = logging.getLogger(__name__)


async def _org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def list_org_recipients(
    org_id: int, db_session: AsyncSession
) -> List[Tuple[str, str]]:
    """(email, nombre) de cada miembro de la organización."""
    rows = (
        await db_session.execute(
            select(User.email, User.first_name, User.username)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(UserOrganization.org_id == org_id)
        )
    ).all()

    recipients: List[Tuple[str, str]] = []
    seen = set()
    for email, first_name, username in rows:
        if not email or email in seen:
            continue
        seen.add(email)
        recipients.append((email, (first_name or username or "alumno/a")))
    return recipients


def _send_many(kind: str, recipients: List[Tuple[str, str]], payload: dict) -> None:
    """Se ejecuta en segundo plano. Nunca lanza: un fallo no puede tumbar nada."""
    from src.services.users.emails import (
        send_announcement_email,
        send_class_scheduled_email,
    )

    sent = 0
    for email, name in recipients:
        try:
            if kind == "class":
                send_class_scheduled_email(
                    email=email,
                    name=name,
                    title=payload.get("title") or "Clase en vivo",
                    when_text=payload.get("when_text") or "",
                    join_url=payload.get("url") or "",
                    # Sin enlace de reunión, el botón lleva al evento concreto
                    # del calendario, no a la portada.
                    event_url=payload.get("event_url") or "",
                )
            else:
                send_announcement_email(
                    email=email,
                    name=name,
                    title=payload.get("title") or "Novedad en la academia",
                    excerpt=payload.get("body") or "",
                    url=payload.get("url") or "",
                )
            sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("Aviso no enviado a %s: %s", email, e)
    logger.info("Aviso '%s' enviado a %s/%s alumnos", kind, sent, len(recipients))


async def broadcast(
    request: Request,
    org_id: int,
    kind: str,
    payload: dict,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> dict:
    """Prepara el envío. Solo administradores de la organización."""
    org = await _org_or_404(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    if kind not in ("announcement", "class"):
        raise HTTPException(status_code=400, detail="Unknown notification kind")
    if not (payload.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="A title is required")

    recipients = await list_org_recipients(org_id, db_session)
    return {"recipients": recipients, "count": len(recipients)}

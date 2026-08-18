"""Borrado de consultas desde el panel. Solo administradores."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.consultas.admin import delete_consulta
from src.services.orgs.orgs import rbac_check

logger = logging.getLogger(__name__)

router = APIRouter()


async def _admin_or_403(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Mismo permiso que mandar un aviso o ver las estadísticas.
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


@router.delete(
    "/org/{org_id}/{consulta_id}",
    summary="Borra cualquier consulta del tablón. Solo administradores.",
)
async def api_delete_consulta(
    request: Request,
    org_id: int,
    consulta_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_or_403(request, org_id, current_user, db_session)
    return await delete_consulta(consulta_id)

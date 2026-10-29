"""
Panel → Correos (29/10/2026): qué pasa con el email marketing. Solo
administradores, comprobado en cada ruta. La explicación entera está en
`src/services/correos/correos.py`.
"""

from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.panel import _solo_admin
from src.security.auth import get_current_user
from src.services.correos import correos

router = APIRouter()


@router.get("/org/{org_id}", summary="El resumen, el recorrido de la campaña, las personas y los últimos envíos.")
async def api_correos(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    return await correos.panel(org_id, db_session)


@router.get("/org/{org_id}/persona", summary="Lo que le ha llegado a una persona y lo que ha hecho, del más nuevo al más viejo.")
async def api_persona(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    return await correos.persona(org_id, email, db_session)

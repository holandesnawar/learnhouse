"""
El tablón de consultas visto desde el panel de la escuela.

Quién puede hacer qué, y por qué:

· **Leer el tablón y responder** — el equipo: administradores, moderadores y
  **profes**. Un profe entra al panel y atiende alumnos (mensajes, comunidad,
  fichas); contestar una consulta es exactamente lo mismo, así que va con el
  mismo grupo de roles que ya decide quién ve la bandeja del equipo
  (`STAFF_ROLE_IDS`). Antes esto no se podía: la pantalla de responder vivía
  fuera, con su propia contraseña.

· **Borrar cualquier consulta** — solo administradores y moderadores, con el
  mismo permiso que mandar un aviso o ver las estadísticas. Borrar lo que ha
  escrito otra persona es moderación, no atención, y el rol de profe deja
  fuera a propósito los permisos sobre la organización.

Un alumno no pasa por aquí para lo suyo: edita y borra sus consultas con el
permiso que su navegador guarda por consulta.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.security.rbac.constants import STAFF_ROLE_IDS
from src.security.superadmin import is_user_superadmin
from src.services.consultas.admin import (
    answer_consulta,
    delete_consulta,
    list_consultas,
)
from src.services.orgs.orgs import rbac_check

logger = logging.getLogger(__name__)

router = APIRouter()


class RespuestaBody(BaseModel):
    respuesta: str = Field(..., min_length=1, max_length=20000)


async def _org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _staff_or_403(
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    """El equipo de la escuela: administrador, moderador o profe."""
    await _org_or_404(org_id, db_session)

    # El router se monta con `require_authenticated_user`, así que aquí ya solo
    # llegan sesiones de verdad. Se comprueba igualmente: el `id` de un token de
    # API es el del TOKEN, y buscar una membresía con él acabaría mirando la de
    # otra persona con ese mismo número. Si algún día se cambia el montaje, esto
    # se cae del lado seguro.
    if not isinstance(current_user, PublicUser):
        raise HTTPException(status_code=401, detail="Tienes que iniciar sesión")

    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Tienes que iniciar sesión")

    if await is_user_superadmin(user_id, db_session):
        return

    membership = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()

    if not membership or membership.role_id not in STAFF_ROLE_IDS:
        raise HTTPException(
            status_code=403,
            detail="Solo el equipo de la escuela puede atender las consultas",
        )


async def _admin_or_403(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _org_or_404(org_id, db_session)
    # Mismo permiso que mandar un aviso o ver las estadísticas.
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


@router.get(
    "/org/{org_id}",
    summary="El tablón de consultas para el panel. Equipo de la escuela.",
)
async def api_list_consultas(
    org_id: int,
    status: str | None = Query(
        default=None,
        description="'pending', 'resolved' o nada para traerlas todas.",
    ),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _staff_or_403(org_id, current_user, db_session)
    return await list_consultas(status)


@router.put(
    "/org/{org_id}/{consulta_id}/respuesta",
    summary="Responde una consulta y la da por resuelta. Equipo de la escuela.",
)
async def api_answer_consulta(
    org_id: int,
    consulta_id: str,
    body: RespuestaBody,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _staff_or_403(org_id, current_user, db_session)
    # Queda apuntado quién contestó, que es lo que enseñaba la pantalla vieja.
    quien = getattr(current_user, "email", "") or getattr(current_user, "username", "")
    return await answer_consulta(consulta_id, body.respuesta, quien)


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

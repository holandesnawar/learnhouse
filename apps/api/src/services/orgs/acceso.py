"""
Quién puede ver qué en el panel, cuando el permiso no es "dirige la escuela".

`rbac_check(..., "update")` deja pasar solo a administradores y moderadores.
Para el closer hace falta una puerta distinta: ve Contactos y las solicitudes
de plaza, y los Números solo si el administrador se lo abre. Esa puerta es
`exigir_acceso`. Se usa en las rutas de contactos y estadísticas; para todo lo
demás del panel sigue mandando `rbac_check`.
"""

from typing import Literal, Optional

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.constants import (
    ADMIN_OR_MAINTAINER_ROLE_IDS,
    CLOSER_ROLE_ID,
    CONTACTOS_ROLE_IDS,
)
from src.security.rbac.rbac import is_user_superadmin
from src.services.orgs.orgs import get_org_acceso_closer_config

Seccion = Literal["contactos", "numeros"]


async def rol_en_la_escuela(user_id: int, org_id: int, db_session: AsyncSession) -> Optional[int]:
    link = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    return link.role_id if link else None


def puede_ver(rol: Optional[int], seccion: Seccion, closer_ve_numeros: bool) -> bool:
    """Función pura, con test. Quién ve cada sección:
    - contactos: administradores, moderadores y el closer.
    - numeros:   administradores y moderadores; el closer solo si se lo abren.
    """
    if rol is None:
        return False
    if rol in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return True
    if rol == CLOSER_ROLE_ID:
        if seccion == "contactos":
            return rol in CONTACTOS_ROLE_IDS
        return closer_ve_numeros
    return False


async def exigir_acceso(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    seccion: Seccion,
    db_session: AsyncSession,
) -> Organization:
    """Devuelve la escuela si esta persona puede ver esa sección; si no, 403."""
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_id = getattr(current_user, "id", None)
    if not user_id or isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Hay que entrar para ver esto")

    if await is_user_superadmin(user_id, db_session):
        return org

    rol = await rol_en_la_escuela(user_id, org_id, db_session)
    ve_numeros = (await get_org_acceso_closer_config(org_id, db_session)).get("numeros", False)
    if not puede_ver(rol, seccion, bool(ve_numeros)):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta sección")
    return org

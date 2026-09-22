"""
Webs — enlaces cortos y redirecciones de holandesnawar.com, desde el panel.

- `GET /resolver/{slug}`: lo llama la web (público, sin sesión) cuando le
  piden una ruta que no tiene. 200 con el destino, o 404.
- `/org/{org_id}/enlaces…`: gestión, solo administradores.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.db.web_link import WebLinkWrite
from src.security.auth import get_current_user
from src.services.orgs.orgs import rbac_check
from src.services.webs.webs import borrar, crear, editar, listar, resolver

router = APIRouter()


async def _admin(request: Request, org_id: int, current_user: PublicUser | AnonymousUser, db_session: AsyncSession) -> None:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


@router.get("/resolver/{slug:path}", summary="A dónde va este atajo. Lo llama la web.")
async def api_resolver(slug: str, db_session: AsyncSession = Depends(get_db_session)):
    r = await resolver(slug, db_session)
    if r is None:
        raise HTTPException(status_code=404, detail="No hay ningún enlace con ese nombre")
    return r


@router.get("/org/{org_id}/enlaces", summary="Todos los enlaces y redirecciones.")
async def api_listar(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await listar(org_id, db_session)


@router.post("/org/{org_id}/enlaces", summary="Crear un enlace o redirección.")
async def api_crear(
    request: Request,
    org_id: int,
    data: WebLinkWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await crear(org_id, data, db_session)


@router.put("/org/{org_id}/enlaces/{link_id}", summary="Cambiar un enlace.")
async def api_editar(
    request: Request,
    org_id: int,
    link_id: int,
    data: WebLinkWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await editar(org_id, link_id, data, db_session)


@router.delete("/org/{org_id}/enlaces/{link_id}", summary="Borrar un enlace.")
async def api_borrar(
    request: Request,
    org_id: int,
    link_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await borrar(org_id, link_id, db_session)

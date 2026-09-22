"""
Recursos — carpetas con archivos y enlaces para los alumnos.

Leer: cualquiera que esté dentro de la escuela (su propia organización).
Gestionar: administradores (`rbac_check … "update"`), con el `org_id` en la
ruta como en el resto del panel.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.recursos import FolderWrite, LinkWrite, OrderWrite
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.orgs.orgs import rbac_check
from src.services.recursos.recursos import (
    anadir_enlace,
    borrar_carpeta,
    borrar_item,
    crear_carpeta,
    editar_carpeta,
    listar,
    ordenar_carpetas,
    ordenar_items,
    org_del_usuario,
    subir_archivo,
)

router = APIRouter()


async def _admin(request: Request, org_id: int, current_user: PublicUser | AnonymousUser, db_session: AsyncSession) -> None:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Organization not found")
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


@router.get("/", summary="Las carpetas de recursos de mi escuela, con sus archivos y enlaces.")
async def api_listar(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    org_id = await org_del_usuario(current_user, db_session)
    return await listar(org_id, db_session)


@router.get("/org/{org_id}", summary="Lo mismo, para el panel (administradores).")
async def api_listar_admin(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await listar(org_id, db_session, con_privadas=True)


@router.post("/org/{org_id}/carpetas", summary="Crear una carpeta.")
async def api_crear_carpeta(
    request: Request,
    org_id: int,
    data: FolderWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await crear_carpeta(org_id, data, db_session)


@router.put("/org/{org_id}/carpetas/orden", summary="Ordenar las carpetas.")
async def api_ordenar_carpetas(
    request: Request,
    org_id: int,
    data: OrderWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await ordenar_carpetas(org_id, data.ids, db_session)


@router.put("/org/{org_id}/carpetas/{folder_id}", summary="Renombrar una carpeta.")
async def api_editar_carpeta(
    request: Request,
    org_id: int,
    folder_id: int,
    data: FolderWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await editar_carpeta(org_id, folder_id, data, db_session)


@router.delete("/org/{org_id}/carpetas/{folder_id}", summary="Borrar una carpeta con todo lo que tiene.")
async def api_borrar_carpeta(
    request: Request,
    org_id: int,
    folder_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await borrar_carpeta(org_id, folder_id, db_session)


@router.post("/org/{org_id}/carpetas/{folder_id}/enlace", summary="Añadir un enlace (Drive, web…).")
async def api_enlace(
    request: Request,
    org_id: int,
    folder_id: int,
    data: LinkWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await anadir_enlace(org_id, folder_id, data, db_session)


@router.post("/org/{org_id}/carpetas/{folder_id}/archivo", summary="Subir un archivo (hasta 25 MB).")
async def api_archivo(
    request: Request,
    org_id: int,
    folder_id: int,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await subir_archivo(org_id, folder_id, file, title, db_session)


@router.put("/org/{org_id}/carpetas/{folder_id}/orden", summary="Ordenar lo que hay dentro de una carpeta.")
async def api_ordenar_items(
    request: Request,
    org_id: int,
    folder_id: int,
    data: OrderWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await ordenar_items(org_id, folder_id, data.ids, db_session)


@router.delete("/org/{org_id}/items/{item_id}", summary="Quitar un archivo o enlace.")
async def api_borrar_item(
    request: Request,
    org_id: int,
    item_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await borrar_item(org_id, item_id, db_session)

"""
El Estudio (10/11/2026): la pizarra y el banco de ideas. La explicación
entera, en `src/services/estudio/estudio.py`.

Puerta: la de contactos (administradores y closer). El closer ve y escribe
solo en el área de ventas; se decide en el servicio.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.contactos import _es_admin
from src.security.auth import get_current_user
from src.services.estudio import estudio as E
from src.services.orgs.acceso import exigir_acceso

router = APIRouter()


def _error(exc: E.EstudioError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


async def _puerta(request: Request, org_id: int, current_user, db_session: AsyncSession) -> bool:
    """Pasa quien entra al panel de ventas. Devuelve si es administrador."""
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await _es_admin(current_user, org_id, db_session)


class ItemIn(BaseModel):
    tipo: Optional[str] = None
    area: Optional[str] = None
    titulo: Optional[str] = None
    texto: Optional[str] = None
    formato: Optional[str] = None
    objetivo: Optional[str] = None
    estado: Optional[str] = None
    fijada: Optional[bool] = None
    fecha: Optional[str] = None
    canales: Optional[dict] = None


class VariasIn(BaseModel):
    texto: str = ""
    area: Optional[str] = None
    formato: Optional[str] = None
    objetivo: Optional[str] = None


@router.get("/org/{org_id}", summary="El Estudio: las notas de la pizarra y las ideas de contenido.")
async def api_estudio(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _puerta(request, org_id, current_user, db_session)
    return {"items": await E.listar(org_id, admin, db_session), "admin": admin, "yo": current_user.id, **E.catalogo(admin)}


@router.post("/org/{org_id}/items", summary="Apuntar una nota o una idea.")
async def api_crear(
    request: Request,
    org_id: int,
    body: ItemIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _puerta(request, org_id, current_user, db_session)
    try:
        return await E.crear(org_id, body.model_dump(exclude_none=True), current_user, admin, db_session)
    except E.EstudioError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/items/varias", summary="Pegar varias ideas de golpe, una por línea.")
async def api_varias(
    request: Request,
    org_id: int,
    body: VariasIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _puerta(request, org_id, current_user, db_session)
    try:
        datos = body.model_dump(exclude_none=True)
        texto = datos.pop("texto", "")
        return {"items": await E.crear_varias(org_id, texto, datos, current_user, admin, db_session)}
    except E.EstudioError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/items/{item_id}", summary="Cambiar una nota o una idea (también marcar dónde se publicó).")
async def api_cambiar(
    request: Request,
    org_id: int,
    item_id: int,
    body: ItemIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _puerta(request, org_id, current_user, db_session)
    try:
        return await E.cambiar(org_id, item_id, body.model_dump(exclude_none=True), current_user.id, admin, db_session)
    except E.EstudioError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/items/{item_id}", summary="Borrar una nota o una idea.")
async def api_borrar(
    request: Request,
    org_id: int,
    item_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _puerta(request, org_id, current_user, db_session)
    try:
        await E.borrar(org_id, item_id, current_user.id, admin, db_session)
    except E.EstudioError as exc:
        raise _error(exc)
    return {"ok": True}

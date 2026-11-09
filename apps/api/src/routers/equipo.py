"""
La sala de profes (08/11/2026): el tablero de tareas del equipo y su manual.
La explicación entera está en `src/services/equipo/equipo.py`.

- Ver el equipo, las tareas y el manual; crear, mover y cambiar tareas: el
  equipo de clases (administradores, moderadores y profes, `STAFF_ROLE_IDS`).
- Borrar una tarea: quien la creó o un administrador.
- Escribir el manual: administradores.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.routers.salas import _roles
from src.security.auth import get_current_user
from src.services.equipo import equipo as E

router = APIRouter()


def _error(exc: E.EquipoError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


async def _equipo(current_user, org_id: int, db_session: AsyncSession) -> bool:
    """El equipo de clases (o 403). Devuelve si además es administrador."""
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela")
    equipo, admin = await _roles(current_user, org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return admin


@router.get("/org/{org_id}/yo", summary="Quién soy en el equipo: administrador, profe o monitor.")
async def api_yo(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    """Para la barra de la escuela: a un monitor solo se le enseña la sala de
    profes (con su Spreekclub dentro)."""
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        return {"equipo": False, "admin": False, "monitor": False}
    equipo, admin = await _roles(current_user, org_id, db_session)
    from src.services.equipo.monitores import es_monitor

    return {"equipo": equipo, "admin": admin, "monitor": bool(equipo and await es_monitor(current_user.id, org_id, db_session))}


class TareaIn(BaseModel):
    titulo: Optional[str] = None
    notas: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    fecha: Optional[str] = None
    asignado_id: Optional[int] = None
    course_uuid: Optional[str] = None
    orden: Optional[float] = None


class DocIn(BaseModel):
    titulo: Optional[str] = None
    seccion: Optional[str] = None
    texto: Optional[str] = None
    orden: Optional[float] = None


@router.get("/org/{org_id}", summary="La sala de profes: el equipo, sus tareas y el manual.")
async def api_sala_profes(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _equipo(current_user, org_id, db_session)
    from src.services.equipo.monitores import es_monitor

    monitor = await es_monitor(current_user.id, org_id, db_session)
    yo = {"id": current_user.id, "admin": admin, "monitor": monitor, "nombre": E.nombre_de(current_user)}
    if monitor:
        # El monitor solo tiene el Spreekclub: ni el manual ni las tareas.
        return {"yo": yo, "miembros": await E.miembros(org_id, db_session), "tareas": [], "manual": []}
    return {
        "yo": yo,
        "miembros": await E.miembros(org_id, db_session),
        "tareas": await E.listar_tareas(org_id, db_session),
        "manual": await E.listar_docs(org_id, db_session),
    }


@router.post("/org/{org_id}/tareas", summary="Nueva tarea del equipo.")
async def api_crear_tarea(
    org_id: int,
    datos: TareaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await E.crear_tarea(org_id, datos.model_dump(exclude_none=True), current_user, db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/tareas/{tarea_id}", summary="Cambiar o mover una tarea del equipo.")
async def api_cambiar_tarea(
    org_id: int,
    tarea_id: int,
    datos: TareaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await E.cambiar_tarea(org_id, tarea_id, datos.model_dump(exclude_unset=True), db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/tareas/{tarea_id}", summary="Borrar una tarea (quien la creó o un administrador).")
async def api_borrar_tarea(
    org_id: int,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _equipo(current_user, org_id, db_session)
    try:
        await E.borrar_tarea(org_id, tarea_id, current_user.id, admin, db_session)
    except E.EquipoError as exc:
        raise _error(exc)
    return {"ok": True}


async def _admin(current_user, org_id: int, db_session: AsyncSession) -> None:
    if not await _equipo(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="El manual lo escriben los administradores")


@router.post("/org/{org_id}/manual", summary="Nueva página del manual (administradores).")
async def api_crear_doc(
    org_id: int,
    datos: DocIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(current_user, org_id, db_session)
    try:
        return await E.crear_doc(org_id, datos.model_dump(exclude_none=True), current_user, db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/manual/plantilla", summary="Empezar el manual con la plantilla (solo si está vacío).")
async def api_plantilla(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(current_user, org_id, db_session)
    try:
        return {"manual": await E.sembrar_plantilla(org_id, current_user, db_session)}
    except E.EquipoError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/manual/{doc_id}", summary="Cambiar una página del manual (administradores).")
async def api_cambiar_doc(
    org_id: int,
    doc_id: int,
    datos: DocIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(current_user, org_id, db_session)
    try:
        return await E.cambiar_doc(org_id, doc_id, datos.model_dump(exclude_unset=True), current_user, db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/manual/{doc_id}", summary="Borrar una página del manual (administradores).")
async def api_borrar_doc(
    org_id: int,
    doc_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(current_user, org_id, db_session)
    try:
        await E.borrar_doc(org_id, doc_id, db_session)
    except E.EquipoError as exc:
        raise _error(exc)
    return {"ok": True}

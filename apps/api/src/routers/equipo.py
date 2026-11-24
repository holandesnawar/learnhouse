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
    # Procesos del equipo (24/11/2026).
    resumen: Optional[str] = None
    visible: Optional[str] = None
    asignados: Optional[list[int]] = None


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
    from src.services.equipo import procesos as P

    gente = await P.miembros(org_id, db_session)
    # El manual son ya los procesos de todo el equipo (24/11/2026): también
    # el monitor ve los suyos y los que son para todos.
    manual = await P.listar(org_id, current_user.id, admin, db_session, gente)
    if monitor:
        return {"yo": yo, "miembros": await E.miembros(org_id, db_session), "tareas": [], "manual": manual, "todo_el_equipo": gente}
    return {
        "yo": yo,
        "miembros": await E.miembros(org_id, db_session),
        "tareas": await E.listar_tareas(org_id, db_session),
        "manual": manual,
        "todo_el_equipo": gente,
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
    """Escribir los procesos: administradores (24/11/2026: también los ve el
    closer, así que la puerta ya no es la del equipo de clases)."""
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela")
    from src.services.equipo import procesos as P

    if not (await P.quien_soy(current_user, org_id, db_session))["admin"]:
        raise HTTPException(status_code=403, detail="Los procesos los escriben los administradores")


# ── Procesos del equipo (24/11/2026): todo el equipo, closers incluidos ──


async def _ve_procesos(current_user, org_id: int, db_session: AsyncSession) -> dict:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela")
    from src.services.equipo import procesos as P

    yo = await P.quien_soy(current_user, org_id, db_session)
    if not yo["equipo"]:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return yo


@router.get("/org/{org_id}/procesos", summary="Los procesos del equipo (SOP) que ve esta persona.")
async def api_procesos(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.equipo import procesos as P

    yo = await _ve_procesos(current_user, org_id, db_session)
    gente = await P.miembros(org_id, db_session)
    return {
        "yo": {"id": current_user.id, "admin": yo["admin"], "closer": yo["closer"], "nombre": E.nombre_de(current_user)},
        "miembros": gente,
        "procesos": await P.listar(org_id, current_user.id, yo["admin"], db_session, gente),
    }


@router.post("/org/{org_id}/procesos/{doc_id}/leido", summary="«Lo he leído».")
async def api_leido(
    org_id: int,
    doc_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.equipo import procesos as P

    yo = await _ve_procesos(current_user, org_id, db_session)
    try:
        return await P.marcar_leido(org_id, doc_id, current_user, yo["admin"], True, db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/procesos/{doc_id}/leido", summary="Quitar «Lo he leído».")
async def api_no_leido(
    org_id: int,
    doc_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.equipo import procesos as P

    yo = await _ve_procesos(current_user, org_id, db_session)
    try:
        return await P.marcar_leido(org_id, doc_id, current_user, yo["admin"], False, db_session)
    except E.EquipoError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/manual", summary="Nueva página del manual (administradores).")
async def api_crear_doc(
    org_id: int,
    datos: DocIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(current_user, org_id, db_session)
    from src.services.equipo import procesos as P

    try:
        return await P.guardar(org_id, None, datos.model_dump(exclude_none=True), current_user, db_session)
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
        await E.sembrar_plantilla(org_id, current_user, db_session)
        from src.services.equipo import procesos as P

        return {"manual": await P.listar(org_id, current_user.id, True, db_session)}
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
    from src.services.equipo import procesos as P

    try:
        return await P.guardar(org_id, doc_id, datos.model_dump(exclude_unset=True), current_user, db_session)
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

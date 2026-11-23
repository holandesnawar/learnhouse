"""
«¿Ves un fallo? Avísanos» (ver `src/services/ejercicios/avisos.py`).

- Avisar: cualquiera que esté dentro de la escuela (lo hace el alumno desde
  el ejercicio).
- Ver la lista: el equipo de clases (`STAFF_ROLE_IDS`: administradores,
  moderadores y profes).
- Cerrar o reabrir: administradores.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.ejercicios import avisos as A

router = APIRouter()


class AvisoIn(BaseModel):
    lesson_id: str = ""
    exercise_id: str
    motivo: str = "otra"
    comentario: str = ""
    datos: Optional[dict] = None


class CerrarIn(BaseModel):
    lesson_id: str = ""
    exercise_id: str
    estado: str


def _con_sesion(current_user) -> None:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela")


async def _rol(user_id: int, org_id: int, db_session: AsyncSession) -> Optional[int]:
    return (
        await db_session.execute(
            select(UserOrganization.role_id).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()


async def _roles(current_user, org_id: int, db_session: AsyncSession) -> tuple[bool, bool]:
    """(es del equipo, es administrador)."""
    from src.services.courses.locks import is_org_admin, is_org_staff
    from src.security.superadmin import is_user_superadmin

    superadmin = await is_user_superadmin(current_user.id, db_session)
    admin = superadmin or await is_org_admin(current_user.id, org_id, db_session)
    equipo = admin or await is_org_staff(current_user.id, org_id, db_session)
    return equipo, admin


def _error(exc: A.AvisoError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


@router.post("/org/{org_id}", summary="Avisar de un fallo en un ejercicio (quien esté dentro de la escuela).")
async def api_avisar(
    org_id: int,
    data: AvisoIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    if await _rol(int(current_user.id), org_id, db_session) is None:
        equipo, _ = await _roles(current_user, org_id, db_session)
        if not equipo:
            raise HTTPException(status_code=403, detail="No estás dentro de la escuela")
    try:
        return await A.avisar(org_id, current_user, data.model_dump(), db_session)
    except A.AvisoError as exc:
        raise _error(exc) from exc


@router.get("/org/{org_id}", summary="Los fallos avisados, por ejercicio (equipo).")
async def api_listar(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    equipo, admin = await _roles(current_user, org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return {**await A.listar(org_id, db_session), "admin": admin}


@router.put("/org/{org_id}/cerrar", summary="Dar un ejercicio por arreglado, por «no era un fallo», o reabrirlo (administradores).")
async def api_cerrar(
    org_id: int,
    data: CerrarIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    _, admin = await _roles(current_user, org_id, db_session)
    if not admin:
        raise HTTPException(status_code=403, detail="Solo un administrador cierra los avisos")
    nombre = f"{getattr(current_user, 'first_name', '') or ''} {getattr(current_user, 'last_name', '') or ''}".strip() or "Administración"
    try:
        return await A.cerrar(org_id, data.lesson_id, data.exercise_id, data.estado, nombre, db_session)
    except A.AvisoError as exc:
        raise _error(exc) from exc

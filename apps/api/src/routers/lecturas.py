"""
La lectura semanal (ver `src/services/lecturas/lecturas.py`).

Leer: cualquiera que esté dentro de la escuela (la actual y el archivo; las
de semanas que aún no han llegado, solo el equipo).
Crear, cambiar y borrar: el equipo de clases (administradores y profes,
`STAFF_ROLE_IDS`), para poder dejárselo a un profe.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.lecturas import lecturas as L
from src.services.recursos.recursos import org_del_usuario

router = APIRouter()


async def _es_equipo(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    from src.security.rbac.constants import STAFF_ROLE_IDS
    from src.security.rbac.rbac import is_user_superadmin

    rol = (
        await db_session.execute(
            select(UserOrganization.role_id).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    if rol in STAFF_ROLE_IDS:
        return True
    try:
        return bool(await is_user_superadmin(user_id, db_session))
    except Exception:  # noqa: BLE001
        return False


async def _equipo(org_id: int, current_user: PublicUser, db_session: AsyncSession) -> None:
    mia = await org_del_usuario(current_user, db_session)
    if mia != org_id or not await _es_equipo(int(current_user.id), org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo el equipo puede cambiar las lecturas")


def _autor(u: PublicUser) -> str:
    return (getattr(u, "first_name", "") or getattr(u, "username", "") or "").strip()


@router.get("/", summary="La lectura de esta semana y el archivo.")
async def api_mias(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    org_id = await org_del_usuario(current_user, db_session)
    equipo = await _es_equipo(int(current_user.id), org_id, db_session)
    return {**await L.para_mi(org_id, equipo, db_session), "equipo": equipo, "org_id": org_id}


@router.post("/org/{org_id}", summary="Crear una lectura.")
async def api_crear(
    org_id: int,
    datos: dict,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(org_id, current_user, db_session)
    return await L.crear(org_id, datos, _autor(current_user), db_session)


@router.put("/org/{org_id}/{lectura_id}", summary="Cambiar una lectura.")
async def api_editar(
    org_id: int,
    lectura_id: str,
    datos: dict,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(org_id, current_user, db_session)
    return await L.editar(org_id, lectura_id, datos, db_session)


@router.delete("/org/{org_id}/{lectura_id}", summary="Quitar una lectura.")
async def api_borrar(
    org_id: int,
    lectura_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(org_id, current_user, db_session)
    return await L.borrar(org_id, lectura_id, db_session)


@router.post("/org/{org_id}/{lectura_id}/hoja", summary="Subir la hoja en PDF.")
async def api_hoja(
    org_id: int,
    lectura_id: str,
    file: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(org_id, current_user, db_session)
    return await L.subir_hoja(org_id, lectura_id, file, db_session)


@router.delete("/org/{org_id}/{lectura_id}/hoja", summary="Quitar la hoja.")
async def api_quitar_hoja(
    org_id: int,
    lectura_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(org_id, current_user, db_session)
    return await L.quitar_hoja(org_id, lectura_id, db_session)

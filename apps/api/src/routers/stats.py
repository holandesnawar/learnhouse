"""Estadísticas de la escuela — solo para administradores de la organización."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.school_stats import ManualEntryWrite
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.orgs.acceso import exigir_acceso
from src.services.orgs.orgs import rbac_check
from src.services.payments.solicitudes import (
    borrar_solicitud,
    descartar_matricula,
    marcar_contactada,
)
from src.services.stats.school import (
    delete_manual_entry,
    save_manual_entry,
    school_stats,
)

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_KINDS = {"cost", "delivery", "attendance"}


class SolicitudWrite(BaseModel):
    """Si ya se ha escrito a esa persona o no."""

    contacted: bool = True


async def _admin_org(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Los números del negocio no son para los alumnos: hace falta permiso de
    # edición sobre la organización, el mismo que para mandar un aviso.
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)
    return org


@router.get(
    "/org/{org_id}",
    summary="Números de la escuela: ventas, embudo, alumnos y avance por módulo.",
)
async def api_school_stats(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # Administradores siempre; el closer solo si el administrador le abrió
    # los Números (Panel → Estadísticas → Contactos → "Qué ve el closer").
    await exigir_acceso(request, org_id, current_user, "numeros", db_session)
    return await school_stats(org_id, db_session)


@router.put(
    "/org/{org_id}/manual",
    summary="Guarda un dato que no se puede deducir solo (gasto del mes, asistencia).",
)
async def api_save_manual(
    request: Request,
    org_id: int,
    data: ManualEntryWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_org(request, org_id, current_user, db_session)

    if data.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de dato desconocido")
    period = (data.period or "").strip()
    if not period:
        raise HTTPException(status_code=400, detail="Falta el periodo")
    if data.value < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    entry = await save_manual_entry(
        org_id, data.kind, period, float(data.value),
        (data.label or "").strip(), (data.note or "").strip(), db_session,
    )
    return {
        "id": entry.id,
        "kind": entry.kind,
        "period": entry.period,
        "label": entry.label,
        "value": entry.value,
        "note": entry.note,
        "updated_at": entry.updated_at,
    }


@router.put(
    "/org/{org_id}/solicitudes/{request_id}",
    summary="Marca una solicitud de plaza como ya contactada (o la devuelve a pendiente).",
)
async def api_marcar_solicitud(
    request: Request,
    org_id: int,
    request_id: int,
    data: SolicitudWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # Marcar "ya le he escrito" es trabajo del closer: pasa con la puerta de
    # contactos, no con la de administrador.
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    resultado = await marcar_contactada(request_id, bool(data.contacted), db_session)
    if resultado is None:
        raise HTTPException(status_code=404, detail="No existe esa solicitud")
    return resultado


@router.delete(
    "/org/{org_id}/solicitudes/{request_id}",
    summary="Borra una solicitud de plaza (para las de prueba).",
)
async def api_borrar_solicitud(
    request: Request,
    org_id: int,
    request_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # Borrar es de administradores; el closer solo marca "Hecho".
    await _admin_org(request, org_id, current_user, db_session)
    if not await borrar_solicitud(request_id, db_session):
        raise HTTPException(status_code=404, detail="No existe esa solicitud")
    return {"detail": "ok"}


class Descarte(BaseModel):
    email: str


@router.post(
    "/org/{org_id}/matriculas/descartar",
    summary="Quita de las listas a quien llegó al pago y no pagó (pruebas).",
)
async def api_descartar_matricula(
    request: Request,
    org_id: int,
    data: Descarte,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_org(request, org_id, current_user, db_session)
    return {"descartadas": await descartar_matricula(data.email, db_session)}


@router.delete(
    "/org/{org_id}/manual/{entry_id}",
    summary="Borra un dato manual.",
)
async def api_delete_manual(
    request: Request,
    org_id: int,
    entry_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_org(request, org_id, current_user, db_session)
    ok = await delete_manual_entry(org_id, entry_id, db_session)
    if not ok:
        raise HTTPException(status_code=404, detail="No existe ese dato")
    return {"detail": "ok"}

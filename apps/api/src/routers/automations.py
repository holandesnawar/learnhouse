"""
Automatizaciones de la escuela. Solo administradores.

Un profe no entra aquí: esto manda correos a todo el mundo y cambia lo que la
escuela hace sola.
"""

import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.automations import (
    Automation,
    AutomationCreate,
    AutomationRead,
    AutomationUpdate,
)
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.automations.builtin import BUILTIN_FLOWS
from src.services.automations.engine import (
    ACTIONS,
    TRIGGERS,
    build_context,
    run_one,
    valid_action,
    valid_trigger,
)
from src.services.orgs.orgs import rbac_check

logger = logging.getLogger(__name__)

router = APIRouter()


async def _admin_or_403(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Mismo permiso que mandar un aviso o ver las estadísticas.
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


def _read(row: Automation) -> AutomationRead:
    return AutomationRead(
        id=row.id or 0,
        name=row.name or "",
        trigger=row.trigger or "",
        action=row.action or "",
        config=row.config or {},
        enabled=bool(row.enabled),
        run_count=row.run_count or 0,
        last_run_at=row.last_run_at or "",
        last_error=row.last_error or "",
        created_at=row.created_at or "",
    )


@router.get(
    "/org/{org_id}/catalog",
    summary="Lo que la escuela hace sola, y las piezas para crear automatizaciones nuevas.",
)
async def api_catalog(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    await _admin_or_403(request, org_id, current_user, db_session)
    return {"builtin": BUILTIN_FLOWS, "triggers": TRIGGERS, "actions": ACTIONS}


@router.get("/org/{org_id}", summary="Mis automatizaciones.")
async def api_list(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[AutomationRead]:
    await _admin_or_403(request, org_id, current_user, db_session)
    rows = (
        await db_session.execute(
            select(Automation)
            .where(Automation.org_id == org_id)
            .order_by(Automation.id.desc())  # type: ignore
        )
    ).scalars().all()
    return [_read(r) for r in rows]


def _validate(trigger: str, action: str) -> None:
    if not valid_trigger(trigger):
        raise HTTPException(status_code=400, detail="Ese momento no existe")
    if not valid_action(action):
        raise HTTPException(status_code=400, detail="Esa acción no existe")


@router.post("/org/{org_id}", summary="Crear una automatización.")
async def api_create(
    request: Request,
    org_id: int,
    payload: AutomationCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> AutomationRead:
    await _admin_or_403(request, org_id, current_user, db_session)
    _validate(payload.trigger, payload.action)

    row = Automation(
        org_id=org_id,
        name=(payload.name or "").strip()[:160] or "Sin nombre",
        trigger=payload.trigger,
        action=payload.action,
        config=payload.config or {},
        enabled=bool(payload.enabled),
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by=getattr(current_user, "id", None),
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _read(row)


async def _own_row(automation_id: int, org_id: int, db_session: AsyncSession) -> Automation:
    row = (
        await db_session.execute(select(Automation).where(Automation.id == automation_id))
    ).scalars().first()
    if not row or row.org_id != org_id:
        raise HTTPException(status_code=404, detail="No existe esa automatización")
    return row


@router.put("/org/{org_id}/{automation_id}", summary="Cambiar una automatización.")
async def api_update(
    request: Request,
    org_id: int,
    automation_id: int,
    payload: AutomationUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> AutomationRead:
    await _admin_or_403(request, org_id, current_user, db_session)
    row = await _own_row(automation_id, org_id, db_session)

    if payload.name is not None:
        row.name = payload.name.strip()[:160] or "Sin nombre"
    if payload.trigger is not None:
        if not valid_trigger(payload.trigger):
            raise HTTPException(status_code=400, detail="Ese momento no existe")
        row.trigger = payload.trigger
    if payload.action is not None:
        if not valid_action(payload.action):
            raise HTTPException(status_code=400, detail="Esa acción no existe")
        row.action = payload.action
    if payload.config is not None:
        row.config = payload.config
    if payload.enabled is not None:
        row.enabled = payload.enabled

    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _read(row)


@router.delete("/org/{org_id}/{automation_id}", summary="Borrar una automatización.")
async def api_delete(
    request: Request,
    org_id: int,
    automation_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    await _admin_or_403(request, org_id, current_user, db_session)
    row = await _own_row(automation_id, org_id, db_session)
    await db_session.delete(row)
    await db_session.commit()
    return {"deleted": True}


@router.post(
    "/org/{org_id}/{automation_id}/test",
    summary="Probarla conmigo mismo, sin esperar a que le pase a nadie.",
)
async def api_test(
    request: Request,
    org_id: int,
    automation_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    await _admin_or_403(request, org_id, current_user, db_session)
    row = await _own_row(automation_id, org_id, db_session)

    # Se ejecuta contra la cuenta de quien lo prueba: el correo o el mensaje
    # llegan a su propio buzón, no al de un alumno.
    context = await build_context(getattr(current_user, "id", 0) or 0, org_id, db_session)
    error = await run_one(row, context, db_session)
    return {"ok": error is None, "error": error or ""}

"""Avisos por email a los alumnos (solo administradores)."""

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.notifications.broadcast import _send_many, broadcast

router = APIRouter()


class BroadcastPayload(BaseModel):
    org_id: int
    # "announcement" = novedad importante · "class" = clase confirmada
    kind: str = "announcement"
    title: str
    body: str = ""
    when_text: str = ""
    url: str = ""


@router.post(
    "/broadcast",
    summary="Avisar por email a los alumnos de la organización.",
)
async def api_broadcast(
    request: Request,
    payload: BroadcastPayload,
    background_tasks: BackgroundTasks,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    data = payload.model_dump()
    prepared = await broadcast(
        request, payload.org_id, payload.kind, data, current_user, db_session
    )
    # El envío no bloquea la respuesta: quien pulsa el botón no espera 40 correos.
    background_tasks.add_task(
        _send_many, payload.kind, prepared["recipients"], data
    )
    return {"queued": prepared["count"]}

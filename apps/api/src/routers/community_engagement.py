"""No leídos, menciones y encuestas de la comunidad."""

from typing import List

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.community_engagement import NotificationFeed, PollResults, UnreadCount
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.communities.engagement import (
    dismiss_notification,
    get_read_states,
    get_unread,
    list_notifications,
    mark_channel_read,
    mark_notifications_seen,
    poll_results,
    vote_poll,
)

router = APIRouter()


@router.get("/unread", summary="Mensajes sin leer por canal.")
async def api_unread(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[UnreadCount]:
    return await get_unread(request, current_user, db_session)


@router.get("/read-states", summary="Última lectura de cada canal.")
async def api_read_states(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await get_read_states(current_user, db_session)


@router.put("/read/{community_uuid}", summary="Marcar un canal como leído.")
async def api_mark_read(
    community_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await mark_channel_read(community_uuid, current_user, db_session)


@router.get("/notifications", summary="Menciones del alumno en la comunidad.")
async def api_notifications(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> NotificationFeed:
    return await list_notifications(current_user, db_session)


class DismissPayload(BaseModel):
    # Clave de la notificación tal cual la devuelve el listado.
    id: str


@router.post("/notifications/dismiss", summary="Quitar una notificación de la campana.")
async def api_dismiss_notification(
    payload: DismissPayload,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await dismiss_notification(payload.id, current_user, db_session)


@router.put("/notifications/seen", summary="Marcar las notificaciones como vistas.")
async def api_notifications_seen(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await mark_notifications_seen(current_user, db_session)


class VotePayload(BaseModel):
    option_index: int


@router.post("/polls/{discussion_uuid}/vote", summary="Votar en una encuesta.")
async def api_vote(
    discussion_uuid: str,
    payload: VotePayload,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> PollResults:
    return await vote_poll(discussion_uuid, payload.option_index, current_user, db_session)


@router.get("/polls/{discussion_uuid}", summary="Resultados de una encuesta.")
async def api_poll_results(
    discussion_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> PollResults:
    return await poll_results(discussion_uuid, current_user, db_session)

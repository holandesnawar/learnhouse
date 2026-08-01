"""Mensajes directos entre el alumno y el equipo de la academia."""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.direct_messages import (
    DirectMessageRead,
    DirectThreadDetail,
    DirectThreadRead,
    DirectoryEntry,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.messages.direct import (
    directory,
    get_thread,
    list_threads,
    mark_read,
    open_thread_with,
    post_message,
    unread_total,
)

router = APIRouter()


@router.get("/threads", summary="Conversaciones (el equipo las ve todas).")
async def api_threads(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[DirectThreadRead]:
    return await list_threads(current_user, db_session)


@router.get("/unread", summary="Mensajes sin leer (enciende el sobre del menú).")
async def api_unread(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await unread_total(current_user, db_session)


@router.get("/thread", summary="Mi conversación con el equipo.")
async def api_my_thread(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DirectThreadDetail:
    return await get_thread(None, current_user, db_session)


@router.get("/thread/{thread_id}", summary="Una conversación concreta.")
async def api_thread(
    thread_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DirectThreadDetail:
    return await get_thread(thread_id, current_user, db_session)


@router.post("/thread/{thread_id}/read", summary="Marcar la conversación como leída.")
async def api_mark_read(
    thread_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    return await mark_read(thread_id, current_user, db_session)


@router.post(
    "/send",
    summary="Escribir un mensaje (texto y/o nota de voz).",
    description=(
        "Va como multipart para poder adjuntar el audio. Sin thread_id, el "
        "alumno escribe en su propia conversación."
    ),
)
async def api_send(
    thread_id: Optional[int] = Form(None),
    body: str = Form(""),
    audio_seconds: int = Form(0),
    audio: Optional[UploadFile] = File(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DirectMessageRead:
    return await post_message(
        thread_id, body, audio, audio_seconds, current_user, db_session
    )


@router.get(
    "/directory",
    summary="A quién puedo escribir (el alumno ve al equipo; el equipo, a los alumnos).",
)
async def api_directory(
    q: str = "",
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[DirectoryEntry]:
    return await directory(q, current_user, db_session)


@router.post("/open/{peer_id}", summary="Abrir la conversación con esa persona.")
async def api_open(
    peer_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DirectThreadDetail:
    return await open_thread_with(peer_id, current_user, db_session)

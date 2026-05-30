"""Public endpoints for the per-user exercise attempt memory."""

from typing import List

from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.exercise_attempts import ExerciseAttemptCreate
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.exercise_attempts.exercise_attempts import (
    get_attempt,
    list_attempts,
    save_attempt,
)


router = APIRouter()


@router.get(
    "/all",
    summary="List every saved attempt for the current student.",
)
async def api_list_attempts(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[dict]:
    return await list_attempts(current_user, db_session)


@router.get(
    "/{section_key}",
    summary="Get the student's last attempt at a practice section.",
)
async def api_get_attempt(
    section_key: str,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await get_attempt(section_key, current_user, db_session)


@router.put(
    "/{section_key}",
    summary="Save (upsert) the student's most recent attempt at a section.",
)
async def api_save_attempt(
    section_key: str,
    data: ExerciseAttemptCreate,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await save_attempt(section_key, data, current_user, db_session)

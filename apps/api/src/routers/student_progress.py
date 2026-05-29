"""Endpoints for per-student progress, streak, lesson completions, weak words."""

from typing import List

from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.student_progress import (
    LessonCompletionCreate,
    LessonCompletionRead,
    StudentProgressPatch,
    StudentProgressRead,
    StudentVisitResponse,
    WeakWord,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.student_progress.student_progress import (
    get_progress,
    get_weak_words,
    list_lesson_completions,
    mark_lesson_completed,
    patch_progress,
    register_visit,
)


router = APIRouter()


# ── progress ────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=StudentProgressRead,
    summary="Get the current student's progress signals.",
)
async def api_get_progress(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await get_progress(current_user, db_session)


@router.put(
    "/me",
    response_model=StudentProgressRead,
    summary="Patch any subset of the student's progress fields (theme, position, onboarding).",
)
async def api_patch_progress(
    data: StudentProgressPatch,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await patch_progress(data, current_user, db_session)


# ── visit / streak ──────────────────────────────────────────────────────────

@router.post(
    "/visit",
    response_model=StudentVisitResponse,
    summary="Register today's visit and recompute the streak.",
)
async def api_register_visit(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await register_visit(current_user, db_session)


# ── lesson completions ─────────────────────────────────────────────────────

@router.put(
    "/lesson-completions/{lesson_id}",
    response_model=LessonCompletionRead,
    summary="Mark a lesson as completed (idempotent; accumulates time_seconds).",
)
async def api_mark_lesson_completed(
    lesson_id: str,
    data: LessonCompletionCreate,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await mark_lesson_completed(lesson_id, data, current_user, db_session)


@router.get(
    "/lesson-completions",
    response_model=List[LessonCompletionRead],
    summary="List every lesson the current student has completed.",
)
async def api_list_lesson_completions(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await list_lesson_completions(current_user, db_session)


# ── weak words ──────────────────────────────────────────────────────────────

@router.get(
    "/weak-words",
    response_model=List[WeakWord],
    summary="Top labels the student has failed the most, aggregated across attempts.",
)
async def api_weak_words(
    request: Request,
    limit: int = 20,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await get_weak_words(current_user, db_session, limit=limit)

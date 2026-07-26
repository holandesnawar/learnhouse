"""Endpoints for per-student progress, streak, lesson completions, weak words."""

from typing import List

from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.student_progress import (
    LessonCompletionCreate,
    LessonCompletionRead,
    StudentInsightsRead,
    StudentProgressPatch,
    StudentProgressRead,
    StudentVisitResponse,
    WeakWord,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.db.lesson_highlights import (
    LessonHighlightCreate,
    LessonHighlightPatch,
    LessonHighlightRead,
)
from src.services.lesson_highlights.lesson_highlights import (
    create_highlight,
    delete_highlight,
    list_all_highlights,
    list_highlights_for_activity,
    patch_highlight,
)
from src.services.student_progress.student_progress import (
    get_progress,
    get_student_insights,
    get_weak_words,
    list_lesson_completions,
    mark_lesson_completed,
    patch_progress,
    register_visit,
    reset_user_progress,
)


router = APIRouter()


# ── admin: zona de peligro ───────────────────────────────────────────────────

@router.post(
    "/admin/reset/{user_id}",
    summary="(Admin) Reiniciar todo el progreso de un usuario en la organización.",
)
async def api_admin_reset_progress(
    user_id: int,
    org_id: int,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await reset_user_progress(request, db_session, current_user, user_id, org_id)


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


@router.get(
    "/insights",
    response_model=StudentInsightsRead,
    summary="Progress + completions + attempts + weak words in one round trip.",
)
async def api_get_insights(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await get_student_insights(current_user, db_session)


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


# ── lesson highlights / notes ────────────────────────────────────────────────

@router.get(
    "/highlights",
    response_model=List[LessonHighlightRead],
    summary="List the student's highlights for one lesson (by activity_uuid).",
)
async def api_list_highlights(
    activity_uuid: str,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await list_highlights_for_activity(activity_uuid, current_user, db_session)


@router.get(
    "/highlights/all",
    response_model=List[LessonHighlightRead],
    summary="List every highlight/note the student has saved (for 'Mis notas').",
)
async def api_list_all_highlights(
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await list_all_highlights(current_user, db_session)


@router.post(
    "/highlights",
    response_model=LessonHighlightRead,
    summary="Create a highlight (optionally with a note) on a lesson.",
)
async def api_create_highlight(
    data: LessonHighlightCreate,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await create_highlight(data, current_user, db_session)


@router.put(
    "/highlights/{highlight_id}",
    response_model=LessonHighlightRead,
    summary="Update a highlight's colour or note.",
)
async def api_patch_highlight(
    highlight_id: int,
    data: LessonHighlightPatch,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await patch_highlight(highlight_id, data, current_user, db_session)


@router.delete(
    "/highlights/{highlight_id}",
    summary="Delete a highlight.",
)
async def api_delete_highlight(
    highlight_id: int,
    request: Request,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await delete_highlight(highlight_id, current_user, db_session)

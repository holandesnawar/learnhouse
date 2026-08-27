"""CRUD for per-student lesson highlights / notes."""

from typing import List, Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.lesson_highlights import (
    LessonHighlight,
    LessonHighlightCreate,
    LessonHighlightPatch,
    now_iso,
)
from src.db.users import AnonymousUser

ALLOWED_COLORS = {"yellow", "pink", "blue", "green"}


def _user_id_or_401(current_user) -> int:
    if current_user is None or isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def _as_dict(h: LessonHighlight) -> dict:
    return {
        "id": h.id,
        "activity_uuid": h.activity_uuid,
        "activity_name": h.activity_name or "",
        "course_uuid": h.course_uuid or "",
        "block_key": h.block_key or "",
        "color": h.color or "yellow",
        "quote": h.quote or "",
        "note": h.note or "",
        "pm_from": h.pm_from or 0,
        "pm_to": h.pm_to or 0,
        "created_at": h.created_at or "",
        "updated_at": h.updated_at or "",
    }


async def list_highlights_for_activity(
    activity_uuid: str, current_user, db_session: AsyncSession
) -> List[dict]:
    user_id = _user_id_or_401(current_user)
    statement = select(LessonHighlight).where(
        LessonHighlight.user_id == user_id,
        LessonHighlight.activity_uuid == activity_uuid,
    )
    rows = (await db_session.execute(statement)).scalars().all()
    return [_as_dict(r) for r in rows]


async def list_all_highlights(current_user, db_session: AsyncSession) -> List[dict]:
    user_id = _user_id_or_401(current_user)
    statement = (
        select(LessonHighlight)
        .where(LessonHighlight.user_id == user_id)
        .order_by(LessonHighlight.created_at.desc())  # type: ignore
    )
    rows = (await db_session.execute(statement)).scalars().all()
    return [_as_dict(r) for r in rows]


async def create_highlight(
    data: LessonHighlightCreate, current_user, db_session: AsyncSession
) -> dict:
    user_id = _user_id_or_401(current_user)
    color = data.color if data.color in ALLOWED_COLORS else "yellow"
    org_id = getattr(current_user, "org_id", 0) or 0
    now = now_iso()
    h = LessonHighlight(
        user_id=user_id,
        org_id=org_id,
        activity_uuid=data.activity_uuid,
        activity_name=(data.activity_name or "")[:500],
        course_uuid=data.course_uuid or "",
        block_key=(data.block_key or "")[:120],
        color=color,
        quote=(data.quote or "")[:2000],
        note=(data.note or "")[:5000],
        pm_from=data.pm_from or 0,
        pm_to=data.pm_to or 0,
        created_at=now,
        updated_at=now,
    )
    db_session.add(h)
    await db_session.commit()
    await db_session.refresh(h)
    return _as_dict(h)


async def _get_owned(
    highlight_id: int, user_id: int, db_session: AsyncSession
) -> Optional[LessonHighlight]:
    statement = select(LessonHighlight).where(
        LessonHighlight.id == highlight_id,
        LessonHighlight.user_id == user_id,
    )
    return (await db_session.execute(statement)).scalars().first()


async def patch_highlight(
    highlight_id: int,
    data: LessonHighlightPatch,
    current_user,
    db_session: AsyncSession,
) -> dict:
    user_id = _user_id_or_401(current_user)
    h = await _get_owned(highlight_id, user_id, db_session)
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    if data.color is not None and data.color in ALLOWED_COLORS:
        h.color = data.color
    if data.note is not None:
        h.note = data.note[:5000]
    h.updated_at = now_iso()
    db_session.add(h)
    await db_session.commit()
    await db_session.refresh(h)
    return _as_dict(h)


async def delete_highlight(
    highlight_id: int, current_user, db_session: AsyncSession
) -> dict:
    user_id = _user_id_or_401(current_user)
    h = await _get_owned(highlight_id, user_id, db_session)
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db_session.delete(h)
    await db_session.commit()
    return {"ok": True}

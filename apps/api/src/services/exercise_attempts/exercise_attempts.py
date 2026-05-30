"""Get / upsert the student's most recent attempt at an exercise practice."""

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.exercise_attempts import ExerciseAttempt, ExerciseAttemptCreate
from src.db.users import AnonymousUser


def _user_id_or_401(current_user) -> int:
    if current_user is None or isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def _as_dict(attempt: ExerciseAttempt) -> dict:
    return {
        "score": attempt.score,
        "total": attempt.total,
        "failed_labels": attempt.failed_labels or [],
        "date": attempt.date,
    }


async def get_attempt(
    section_key: str,
    current_user,
    db_session: AsyncSession,
) -> Optional[dict]:
    user_id = _user_id_or_401(current_user)

    statement = select(ExerciseAttempt).where(
        ExerciseAttempt.user_id == user_id,
        ExerciseAttempt.section_key == section_key,
    )
    attempt = (await db_session.execute(statement)).scalars().first()
    if not attempt:
        return None
    return _as_dict(attempt)


async def list_attempts(
    current_user,
    db_session: AsyncSession,
) -> list:
    user_id = _user_id_or_401(current_user)
    statement = select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
    rows = (await db_session.execute(statement)).scalars().all()
    return [{"section_key": r.section_key, **_as_dict(r)} for r in rows]


async def save_attempt(
    section_key: str,
    data: ExerciseAttemptCreate,
    current_user,
    db_session: AsyncSession,
) -> dict:
    user_id = _user_id_or_401(current_user)

    statement = select(ExerciseAttempt).where(
        ExerciseAttempt.user_id == user_id,
        ExerciseAttempt.section_key == section_key,
    )
    attempt = (await db_session.execute(statement)).scalars().first()
    now = datetime.now().isoformat()

    if attempt:
        attempt.score = data.score
        attempt.total = data.total
        attempt.failed_labels = data.failed_labels
        attempt.date = now
    else:
        attempt = ExerciseAttempt(
            user_id=user_id,
            section_key=section_key,
            score=data.score,
            total=data.total,
            failed_labels=data.failed_labels,
            date=now,
        )

    db_session.add(attempt)
    await db_session.commit()
    await db_session.refresh(attempt)
    return _as_dict(attempt)

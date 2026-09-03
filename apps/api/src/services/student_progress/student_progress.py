"""Per-student progress, streak, lesson completions and weak-words logic."""

import logging
import re
from collections import Counter
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException, Request
from sqlalchemy import delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.chapters import Chapter
from src.db.exercise_attempts import ExerciseAttempt
from src.db.organizations import Organization
from src.db.trails import Trail
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.student_progress import (
    AttemptWithKey,
    LessonCompletion,
    LessonCompletionCreate,
    LessonCompletionRead,
    StudentProgress,
    StudentInsightsRead,
    StudentProgressPatch,
    StudentProgressRead,
    StudentVisitResponse,
    WeakWord,
)
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id


# ── helpers ─────────────────────────────────────────────────────────────────

def _user_id_or_401(current_user) -> int:
    if current_user is None or isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def _now_iso() -> str:
    return datetime.now().isoformat()


def _today_iso() -> str:
    return date.today().isoformat()


async def _get_or_create(user_id: int, db_session: AsyncSession) -> StudentProgress:
    statement = select(StudentProgress).where(StudentProgress.user_id == user_id)
    row = (await db_session.execute(statement)).scalars().first()
    if row:
        return row
    row = StudentProgress(
        user_id=user_id,
        creation_date=_now_iso(),
        update_date=_now_iso(),
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return row


def _to_read(row: StudentProgress) -> StudentProgressRead:
    return StudentProgressRead(
        last_visit_date=row.last_visit_date or "",
        current_streak=row.current_streak or 0,
        longest_streak=row.longest_streak or 0,
        current_position=row.current_position or {},
        onboarding_state=row.onboarding_state or {},
        theme=row.theme or "light",
        time_seconds_total=row.time_seconds_total or 0,
    )


# ── progress (get / patch) ──────────────────────────────────────────────────

async def get_progress(current_user, db_session: AsyncSession) -> StudentProgressRead:
    user_id = _user_id_or_401(current_user)
    row = await _get_or_create(user_id, db_session)
    return _to_read(row)


async def patch_progress(
    data: StudentProgressPatch,
    current_user,
    db_session: AsyncSession,
) -> StudentProgressRead:
    user_id = _user_id_or_401(current_user)
    row = await _get_or_create(user_id, db_session)

    if data.current_position is not None:
        row.current_position = data.current_position
    if data.onboarding_state is not None:
        row.onboarding_state = data.onboarding_state
    if data.theme is not None:
        if data.theme not in {"light", "dark", "system"}:
            raise HTTPException(status_code=400, detail="Unsupported theme")
        row.theme = data.theme
    if data.time_seconds_total is not None and data.time_seconds_total >= 0:
        # Monotonic: never let a stale client roll back the counter.
        row.time_seconds_total = max(row.time_seconds_total or 0, data.time_seconds_total)

    row.update_date = _now_iso()
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row)


# ── visit / streak ──────────────────────────────────────────────────────────

async def register_visit(current_user, db_session: AsyncSession) -> StudentVisitResponse:
    """Update last_visit_date and recompute the streak.

    Streak rules: consecutive days → +1. Same day → no change. Gap of more
    than one day → reset to 1.
    """
    user_id = _user_id_or_401(current_user)
    row = await _get_or_create(user_id, db_session)

    today = date.today()
    today_str = today.isoformat()
    last = row.last_visit_date or ""

    if last == today_str:
        # already registered today
        return StudentVisitResponse(
            last_visit_date=row.last_visit_date,
            current_streak=row.current_streak,
            longest_streak=row.longest_streak,
        )

    new_streak = 1
    if last:
        try:
            last_date = date.fromisoformat(last)
            if today - last_date == timedelta(days=1):
                new_streak = (row.current_streak or 0) + 1
        except ValueError:
            new_streak = 1

    row.last_visit_date = today_str
    row.current_streak = new_streak
    row.longest_streak = max(row.longest_streak or 0, new_streak)
    row.update_date = _now_iso()

    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)

    # Historial de días para la retención por cohortes. Best-effort: si esto
    # falla, la visita y la racha ya están guardadas y no se pierde nada
    # importante. Solo se llega aquí una vez al día por alumno.
    try:
        from src.db.student_progress import StudentVisitDay

        db_session.add(StudentVisitDay(user_id=user_id, day=today_str))
        await db_session.commit()
    except Exception:
        await db_session.rollback()
        logging.debug("No se pudo guardar el día de visita de %s", user_id, exc_info=True)

    return StudentVisitResponse(
        last_visit_date=row.last_visit_date,
        current_streak=row.current_streak,
        longest_streak=row.longest_streak,
    )


# ── lesson completions ─────────────────────────────────────────────────────

async def mark_lesson_completed(
    lesson_id: str,
    data: LessonCompletionCreate,
    current_user,
    db_session: AsyncSession,
) -> LessonCompletionRead:
    user_id = _user_id_or_401(current_user)
    statement = select(LessonCompletion).where(
        LessonCompletion.user_id == user_id,
        LessonCompletion.lesson_id == lesson_id,
    )
    row = (await db_session.execute(statement)).scalars().first()
    now = _now_iso()
    if row:
        # keep the original completed_at; just accumulate time.
        if data.time_seconds and data.time_seconds > 0:
            row.time_seconds = (row.time_seconds or 0) + data.time_seconds
        if data.module_id and not row.module_id:
            row.module_id = data.module_id
    else:
        row = LessonCompletion(
            user_id=user_id,
            lesson_id=lesson_id,
            module_id=data.module_id or "",
            completed_at=now,
            time_seconds=max(0, data.time_seconds or 0),
        )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return LessonCompletionRead(
        lesson_id=row.lesson_id,
        module_id=row.module_id or "",
        completed_at=row.completed_at,
        time_seconds=row.time_seconds or 0,
    )


async def list_lesson_completions(
    current_user, db_session: AsyncSession
) -> List[LessonCompletionRead]:
    user_id = _user_id_or_401(current_user)
    statement = select(LessonCompletion).where(LessonCompletion.user_id == user_id)
    rows = (await db_session.execute(statement)).scalars().all()
    return [
        LessonCompletionRead(
            lesson_id=r.lesson_id,
            module_id=r.module_id or "",
            completed_at=r.completed_at,
            time_seconds=r.time_seconds or 0,
        )
        for r in rows
    ]


# ── insights (todo en un viaje) ───────────────────────────────────────────

async def get_student_insights(
    current_user,
    db_session: AsyncSession,
    weak_limit: int = 12,
) -> StudentInsightsRead:
    """Progress + completions + attempts + weak words in ONE response.

    The Home used to make four authenticated round trips for this; the
    attempts rows are also reused to aggregate the weak words, so the
    whole payload costs three small indexed queries server-side.
    """
    user_id = _user_id_or_401(current_user)

    progress = await get_progress(current_user, db_session)
    completions = await list_lesson_completions(current_user, db_session)

    statement = select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
    rows = (await db_session.execute(statement)).scalars().all()

    attempts = [
        AttemptWithKey(
            section_key=r.section_key,
            score=r.score or 0,
            total=r.total or 0,
            failed_labels=[l for l in (r.failed_labels or []) if isinstance(l, str)],
            date=r.date or "",
        )
        for r in rows
    ]

    counter: Counter = Counter()
    for r in rows:
        for label in r.failed_labels or []:
            if isinstance(label, str) and label.strip():
                counter[label.strip()] += 1
    weak_words = [
        WeakWord(label=k, fails=v)
        for k, v in counter.most_common(max(1, int(weak_limit)))
    ]

    return StudentInsightsRead(
        progress=progress,
        completions=completions,
        attempts=attempts,
        weak_words=weak_words,
    )


# ── weak words ──────────────────────────────────────────────────────────────

async def get_weak_words(
    current_user,
    db_session: AsyncSession,
    limit: int = 20,
) -> List[WeakWord]:
    """Aggregate failed_labels from every attempt the student has saved.

    Returns up to `limit` items sorted by failure count desc.
    """
    user_id = _user_id_or_401(current_user)
    statement = select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
    rows = (await db_session.execute(statement)).scalars().all()
    counter: Counter = Counter()
    for r in rows:
        labels = r.failed_labels or []
        for label in labels:
            if isinstance(label, str) and label.strip():
                counter[label.strip()] += 1
    most_common = counter.most_common(max(1, int(limit)))
    return [WeakWord(label=k, fails=v) for k, v in most_common]


async def reset_user_progress(
    request: Request,
    db_session: AsyncSession,
    current_user,
    target_user_id: int,
    org_id: int,
) -> dict:
    """Zona de peligro (solo admin): borra TODO el progreso de un usuario en esta
    organización — recorrido del curso (trail), racha/posición, lecciones
    completadas e intentos de ejercicios. NO toca sus notas/resaltados.

    Pensado para reiniciar cuentas de prueba. Verifica que quien lo ejecuta es
    admin (o superadmin) de la organización indicada.
    """
    # Import local para evitar ciclos de importación.
    from src.security.rbac.rbac import authorization_verify_based_on_org_admin_status

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    allowed = await authorization_verify_based_on_org_admin_status(
        request, current_user.id, "delete", org.org_uuid, db_session
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede reiniciar el progreso de un usuario",
        )

    # Recorrido del curso (orden hijo→padre por las claves foráneas).
    await db_session.execute(
        delete(TrailStep).where(
            TrailStep.user_id == target_user_id, TrailStep.org_id == org_id
        )
    )
    await db_session.execute(
        delete(TrailRun).where(
            TrailRun.user_id == target_user_id, TrailRun.org_id == org_id
        )
    )
    await db_session.execute(
        delete(Trail).where(
            Trail.user_id == target_user_id, Trail.org_id == org_id
        )
    )
    # Tablas Nawar (una org → indexadas por usuario).
    await db_session.execute(
        delete(StudentProgress).where(StudentProgress.user_id == target_user_id)
    )
    await db_session.execute(
        delete(LessonCompletion).where(LessonCompletion.user_id == target_user_id)
    )
    await db_session.execute(
        delete(ExerciseAttempt).where(ExerciseAttempt.user_id == target_user_id)
    )
    await db_session.commit()
    return {"detail": "Progreso reiniciado correctamente"}


# ── Qué módulos están cerrados por el goteo ──────────────────────────────────

_NUM_MODULO = re.compile(r"^\s*(?:m[oó]dulo|module)\s*(\d+)", re.IGNORECASE)


async def modulos_bloqueados(
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> list[int]:
    """Los NÚMEROS de módulo que este alumno todavía no puede abrir.

    Existe para que la pantalla de Repasar respete el goteo. Repasar vive en
    `courseData.ts`, no en el curso, así que por su cuenta enseñaba los cuatro
    módulos abiertos: se podía hacer en septiembre el contenido del módulo 4
    entrando por ahí, saltándose el calendario.

    El puente entre los dos mundos es el NÚMERO: los capítulos del curso se
    llaman "MODULE 3 - ETEN EN DRINKEN" y en Repasar ese mismo módulo es el
    tercero de la lista. Se saca el número del nombre del capítulo, que es lo
    único que comparten. Un capítulo sin número —la Introducción— se ignora.
    """
    from src.services.courses.locks import drip_locked_chapters, is_org_admin, is_org_staff

    if isinstance(current_user, AnonymousUser):
        return []

    user_id = resolve_acting_user_id(current_user)
    # El equipo no tiene goteo, ni aquí ni en la formación.
    if await is_org_admin(user_id, org_id, db_session) or await is_org_staff(
        user_id, org_id, db_session
    ):
        return []

    filas = (
        await db_session.execute(
            select(Chapter.chapter_uuid, Chapter.name).where(Chapter.org_id == org_id)
        )
    ).all()
    if not filas:
        return []

    por_uuid: dict[str, int] = {}
    for chapter_uuid, nombre in filas:
        m = _NUM_MODULO.match(str(nombre or ""))
        if m:
            por_uuid[chapter_uuid] = int(m.group(1))
    if not por_uuid:
        return []

    cerrados = await drip_locked_chapters(
        list(por_uuid.keys()), org_id, current_user, db_session
    )
    return sorted({por_uuid[cu] for cu in cerrados if cu in por_uuid})

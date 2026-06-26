"""Read-only aggregate KPIs for the private admin dashboard (Nextcloud).

Single secure endpoint consumed by the external dashboard (Vercel). It is NOT
protected by the regular auth/superadmin flow because the dashboard is a
separate service with no LearnHouse user session. Instead it uses a shared
secret sent in the ``X-Dashboard-Key`` header, compared against the
``LEARNHOUSE_DASHBOARD_API_KEY`` environment variable.

Set the same random value in Railway (this API) and in Vercel (the dashboard).
If the env var is unset, the endpoint is disabled (503) so it can never be
left open by accident.

Everything here is aggregate and read-only: counts, rates and sums. No PII of
individual students is returned.
"""

import hmac
import logging
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.enrollment import Enrollment
from src.db.exercise_attempts import ExerciseAttempt
from src.db.student_progress import LessonCompletion, StudentProgress
from src.db.users import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Nombres legibles de los módulos de la formación (slugs en courseData.ts).
MODULE_NAMES = {
    "over-jou": "Over jou · Sobre ti",
    "familie-vrienden": "Familie & vrienden · Familia",
    "boodschappen": "Boodschappen · Compras",
    "het-werk": "Het werk · El trabajo",
}
SECTION_NAMES = {
    "vocabulary": "Vocabulario",
    "lezen": "Lezen (lectura)",
    "luisteren": "Luisteren (escucha)",
    "flashcards": "Flashcards",
    "resumen": "Resumen",
}
# section_key = "nawar:<moduleId>/<lessonId>/<section>"
_SECTION_KEY_RE = re.compile(r"^nawar:([^/]+)/([^/]+)(?:/([^/]+))?")


def _require_dashboard_key(x_dashboard_key: str | None) -> None:
    """Constant-time check of the shared secret. 503 if unconfigured."""
    expected = os.environ.get("LEARNHOUSE_DASHBOARD_API_KEY", "")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dashboard endpoint not configured.",
        )
    if not hmac.compare_digest(x_dashboard_key or "", expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid dashboard key.",
        )


def _date_prefix(value: str) -> str:
    """First 10 chars of an ISO date/datetime string → 'YYYY-MM-DD'."""
    return (value or "")[:10]


def _module_label(module_id: str) -> str:
    return MODULE_NAMES.get(module_id, module_id or "—")


@router.get(
    "/overview",
    summary="Aggregate KPIs for the private admin dashboard (read-only).",
)
async def dashboard_overview(
    x_dashboard_key: str | None = Header(default=None),
    db_session: AsyncSession = Depends(get_db_session),
):
    _require_dashboard_key(x_dashboard_key)

    today = date.today()
    cutoff_7d = (today - timedelta(days=7)).isoformat()
    cutoff_30d = (today - timedelta(days=30)).isoformat()
    cutoff_24h = (datetime.now() - timedelta(hours=24)).isoformat()

    # ── Cargas (volúmenes pequeños → agregamos en Python) ─────────────────────
    enrollments = (await db_session.execute(select(Enrollment))).scalars().all()
    progress = (await db_session.execute(select(StudentProgress))).scalars().all()
    completions = (await db_session.execute(select(LessonCompletion))).scalars().all()
    attempts = (await db_session.execute(select(ExerciseAttempt))).scalars().all()
    users = (await db_session.execute(select(User))).scalars().all()

    # ── Matrículas / Embudo / Carritos abandonados ────────────────────────────
    enr_total = len(enrollments)
    enr_pending = sum(1 for e in enrollments if e.status == "pending")
    enr_paid = sum(1 for e in enrollments if e.status == "paid")
    enr_abandoned = sum(1 for e in enrollments if e.status == "abandoned")
    enr_paid_30d = sum(
        1 for e in enrollments
        if e.status == "paid" and _date_prefix(e.updated_at or e.created_at) >= cutoff_30d
    )
    enr_new_7d = sum(1 for e in enrollments if _date_prefix(e.created_at) >= cutoff_7d)
    # Carrito abandonado: se matriculó (pending) y lleva >24h sin pagar.
    carts_abandoned = sum(
        1 for e in enrollments
        if e.status == "pending" and (e.created_at or "") < cutoff_24h
    )
    conversion_rate = round((enr_paid / enr_total) * 100, 1) if enr_total else 0.0

    # ── Alumnos / Actividad ───────────────────────────────────────────────────
    stu_total = len(progress)
    stu_active_7d = sum(1 for p in progress if (p.last_visit_date or "") >= cutoff_7d)
    stu_active_30d = sum(1 for p in progress if (p.last_visit_date or "") >= cutoff_30d)
    streaks = [p.current_streak or 0 for p in progress]
    max_streak = max(streaks) if streaks else 0
    avg_streak = round(sum(streaks) / len(streaks), 1) if streaks else 0.0
    total_time_hours = round(sum((p.time_seconds_total or 0) for p in progress) / 3600, 1)
    onboarding_started = sum(
        1 for p in progress
        if isinstance(p.onboarding_state, dict) and any(bool(v) for v in p.onboarding_state.values())
    )

    # ── Activación (pagó → empezó de verdad) ──────────────────────────────────
    users_with_lesson = {c.user_id for c in completions}
    started_course = len(users_with_lesson)
    activation_rate = round((started_course / enr_paid) * 100, 1) if enr_paid else 0.0

    # ── Lecciones ─────────────────────────────────────────────────────────────
    comp_total = len(completions)
    comp_7d = sum(1 for c in completions if _date_prefix(c.completed_at) >= cutoff_7d)
    comp_time_hours = round(sum((c.time_seconds or 0) for c in completions) / 3600, 1)

    # ── Contenido: por módulo ─────────────────────────────────────────────────
    mod_completions: Counter = Counter()
    mod_students: defaultdict[str, set] = defaultdict(set)
    mod_time: Counter = Counter()
    for c in completions:
        mid = c.module_id or "—"
        mod_completions[mid] += 1
        mod_students[mid].add(c.user_id)
        mod_time[mid] += c.time_seconds or 0
    modules = [
        {
            "module_id": mid,
            "title": _module_label(mid),
            "completions": cnt,
            "students": len(mod_students[mid]),
            "time_hours": round(mod_time[mid] / 3600, 1),
        }
        for mid, cnt in mod_completions.most_common()
    ]

    # ── Contenido: lecciones más completadas ──────────────────────────────────
    lesson_counts: Counter = Counter(c.lesson_id for c in completions if c.lesson_id)
    top_lessons = [
        {"lesson_id": lid, "completions": cnt} for lid, cnt in lesson_counts.most_common(10)
    ]

    # ── Ejercicios: nota media por sección + participación ─────────────────────
    sec_score: defaultdict[str, int] = defaultdict(int)
    sec_total: defaultdict[str, int] = defaultdict(int)
    sec_attempts: Counter = Counter()
    failed_words: Counter = Counter()
    for a in attempts:
        m = _SECTION_KEY_RE.match(a.section_key or "")
        section = (m.group(3) if m and m.group(3) else "otros")
        sec_score[section] += a.score or 0
        sec_total[section] += a.total or 0
        sec_attempts[section] += 1
        for label in (a.failed_labels or []):
            failed_words[str(label)] += 1
    exercise_sections = [
        {
            "section": sec,
            "label": SECTION_NAMES.get(sec, sec),
            "attempts": sec_attempts[sec],
            "avg_score_pct": round((sec_score[sec] / sec_total[sec]) * 100, 1) if sec_total[sec] else 0.0,
        }
        for sec in sorted(sec_attempts, key=lambda s: -sec_attempts[s])
    ]
    weak_words = [{"label": w, "fails": n} for w, n in failed_words.most_common(15)]

    # ── "Dónde se atascan": posición actual de los alumnos activos ─────────────
    stuck_module: Counter = Counter()
    stuck_lesson: Counter = Counter()
    for p in progress:
        pos = p.current_position if isinstance(p.current_position, dict) else None
        if not pos:
            continue
        mid = pos.get("module_id") or pos.get("moduleId")
        if mid:
            stuck_module[_module_label(mid)] += 1
        title = pos.get("lesson_title") or pos.get("lesson_id") or pos.get("lessonId")
        if title:
            stuck_lesson[str(title)] += 1
    stuck = {
        "by_module": [{"label": k, "students": v} for k, v in stuck_module.most_common()],
        "by_lesson": [{"label": k, "students": v} for k, v in stuck_lesson.most_common(8)],
    }

    # ── Usuarios ──────────────────────────────────────────────────────────────
    usr_total = len(users)
    usr_verified = sum(1 for u in users if getattr(u, "email_verified", False))

    return {
        "generated_at": datetime.now().isoformat(),
        "enrollments": {
            "total": enr_total,
            "pending": enr_pending,
            "paid": enr_paid,
            "abandoned": enr_abandoned,
            "paid_last_30d": enr_paid_30d,
            "new_last_7d": enr_new_7d,
            "carts_abandoned_24h": carts_abandoned,
            "conversion_rate_pct": conversion_rate,
        },
        "funnel": {
            # 'leads' lo añade el dashboard desde systeme.io; aquí desde matrícula.
            "matriculas": enr_total,
            "pagadas": enr_paid,
            "conversion_matricula_pago_pct": conversion_rate,
        },
        "activation": {
            "paid": enr_paid,
            "created_account": stu_total,
            "onboarding_started": onboarding_started,
            "started_course": started_course,
            "activation_rate_pct": activation_rate,
        },
        "students": {
            "total": stu_total,
            "active_last_7d": stu_active_7d,
            "active_last_30d": stu_active_30d,
            "max_streak": max_streak,
            "avg_streak": avg_streak,
            "total_time_hours": total_time_hours,
            "onboarding_started": onboarding_started,
        },
        "lessons": {
            "completions_total": comp_total,
            "completions_last_7d": comp_7d,
            "time_hours": comp_time_hours,
        },
        "content": {
            "modules": modules,
            "top_lessons": top_lessons,
            "exercise_sections": exercise_sections,
            "weak_words": weak_words,
            "stuck": stuck,
        },
        "users": {"total": usr_total, "verified": usr_verified},
        # Encuestas / NPS: se rellenará cuando exista la recogida en la academia.
        "surveys": {"available": False, "note": "Encuestas de alumnos aún no implementadas."},
    }

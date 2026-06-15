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
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Header, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import Depends

from src.core.events.database import get_db_session
from src.db.enrollment import Enrollment
from src.db.student_progress import LessonCompletion, StudentProgress
from src.db.users import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_dashboard_key(x_dashboard_key: str | None) -> None:
    """Constant-time check of the shared secret. 503 if unconfigured."""
    expected = os.environ.get("LEARNHOUSE_DASHBOARD_API_KEY", "")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dashboard endpoint not configured.",
        )
    provided = x_dashboard_key or ""
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid dashboard key.",
        )


def _date_prefix(value: str) -> str:
    """First 10 chars of an ISO date/datetime string → 'YYYY-MM-DD'."""
    return (value or "")[:10]


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

    # ── Enrollments (matrículas: pending / paid / abandoned) ──────────────────
    enrollments = (await db_session.execute(select(Enrollment))).scalars().all()
    enr_total = len(enrollments)
    enr_pending = sum(1 for e in enrollments if e.status == "pending")
    enr_paid = sum(1 for e in enrollments if e.status == "paid")
    enr_abandoned = sum(1 for e in enrollments if e.status == "abandoned")
    enr_paid_30d = sum(
        1
        for e in enrollments
        if e.status == "paid" and _date_prefix(e.updated_at or e.created_at) >= cutoff_30d
    )
    enr_new_7d = sum(1 for e in enrollments if _date_prefix(e.created_at) >= cutoff_7d)
    conversion_rate = round((enr_paid / enr_total) * 100, 1) if enr_total else 0.0

    # ── Students (progress signals) ───────────────────────────────────────────
    progress = (await db_session.execute(select(StudentProgress))).scalars().all()
    stu_total = len(progress)
    stu_active_7d = sum(1 for p in progress if (p.last_visit_date or "") >= cutoff_7d)
    stu_active_30d = sum(1 for p in progress if (p.last_visit_date or "") >= cutoff_30d)
    streaks = [p.current_streak or 0 for p in progress]
    max_streak = max(streaks) if streaks else 0
    avg_streak = round(sum(streaks) / len(streaks), 1) if streaks else 0.0
    total_time_hours = round(sum((p.time_seconds_total or 0) for p in progress) / 3600, 1)
    onboarding_done = sum(
        1
        for p in progress
        if isinstance(p.onboarding_state, dict)
        and any(bool(v) for v in p.onboarding_state.values())
    )

    # ── Lesson completions ────────────────────────────────────────────────────
    completions = (await db_session.execute(select(LessonCompletion))).scalars().all()
    comp_total = len(completions)
    comp_7d = sum(1 for c in completions if _date_prefix(c.completed_at) >= cutoff_7d)
    comp_time_hours = round(sum((c.time_seconds or 0) for c in completions) / 3600, 1)

    # ── Users ─────────────────────────────────────────────────────────────────
    users = (await db_session.execute(select(User))).scalars().all()
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
            "conversion_rate_pct": conversion_rate,
        },
        "students": {
            "total": stu_total,
            "active_last_7d": stu_active_7d,
            "active_last_30d": stu_active_30d,
            "max_streak": max_streak,
            "avg_streak": avg_streak,
            "total_time_hours": total_time_hours,
            "onboarding_started": onboarding_done,
        },
        "lessons": {
            "completions_total": comp_total,
            "completions_last_7d": comp_7d,
            "time_hours": comp_time_hours,
        },
        "users": {
            "total": usr_total,
            "verified": usr_verified,
        },
        # Placeholder section: surveys / academic-quality not yet captured in
        # LearnHouse. The dashboard renders this as "coming soon" so the card
        # exists and we wire real numbers once surveys ship.
        "surveys": {
            "available": False,
            "note": "Encuestas de alumnos aún no implementadas.",
        },
    }

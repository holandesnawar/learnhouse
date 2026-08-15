"""
Estadísticas de la escuela — se calculan de lo que ya guardamos.

Nada de servicios externos: matrículas, progreso y alumnos salen de nuestro
Postgres, así que el panel funciona aunque Stripe o el CRM estén caídos. Lo
único que no puede deducirse solo (gasto del mes, asistencia a los directos)
lo escribe una persona y vive en `school_manual_entry`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.enrollment import Enrollment
from src.db.school_stats import ManualEntry
from src.db.student_progress import StudentProgress
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.services.stats.periods import (
    group_sales,
    month_key,
    month_label,
    pct,
    undated_sales,
)

logger = logging.getLogger(__name__)

STUDENT_ROLE_ID = 4


def _sale_date(row: Enrollment) -> str:
    """Cuándo se cobró. Las filas viejas no tienen `paid_at`, así que se cae a
    la última actualización y, en último caso, al alta."""
    return row.paid_at or row.updated_at or row.created_at or ""


async def _sales_block(org_id: int, db_session: AsyncSession) -> dict:
    rows = (await db_session.execute(select(Enrollment))).scalars().all()

    paid = [r for r in rows if r.status == "paid"]
    sales = [
        {
            "date": _sale_date(r),
            "amount_cents": int(r.amount_cents or 0),
            "product": r.product or "formacion-a0-a1",
        }
        for r in paid
    ]

    by_product: dict[str, dict] = {}
    for s in sales:
        entry = by_product.setdefault(s["product"], {"product": s["product"], "sales": 0, "revenue_cents": 0})
        entry["sales"] += 1
        entry["revenue_cents"] += s["amount_cents"]

    total_revenue = sum(s["amount_cents"] for s in sales)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent = [s for s in sales if s["date"] and s["date"] >= cutoff]

    started = len(rows)
    return {
        "total_sales": len(paid),
        "total_revenue_cents": total_revenue,
        "avg_ticket_cents": round(total_revenue / len(paid)) if paid else 0,
        "by_month": group_sales(sales, "month"),
        "by_quarter": group_sales(sales, "quarter"),
        "by_product": sorted(by_product.values(), key=lambda p: p["revenue_cents"], reverse=True),
        "undated": undated_sales(sales),
        "last_30_days": {
            "sales": len(recent),
            "revenue_cents": sum(s["amount_cents"] for s in recent),
        },
        # Embudo del checkout: cada fila es alguien que rellenó el formulario.
        "funnel": {
            "started": started,
            "paid": len(paid),
            "conversion_pct": pct(len(paid), started),
            "abandoned": started - len(paid),
        },
        # Matrículas iniciadas por mes: es el denominador del coste por lead.
        "leads_by_month": _count_by_month([r.created_at for r in rows]),
    }


def _count_by_month(dates: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for d in dates:
        key = month_key(d or "")
        if key:
            out[key] = out.get(key, 0) + 1
    return out


async def _students_block(org_id: int, db_session: AsyncSession) -> dict:
    members = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == STUDENT_ROLE_ID,
            )
        )
    ).scalars().all()

    new_by_month = _count_by_month([m.creation_date for m in members])

    today = datetime.now(timezone.utc).date()
    since_7 = (today - timedelta(days=7)).isoformat()
    since_30 = (today - timedelta(days=30)).isoformat()
    visits = (
        await db_session.execute(select(StudentProgress.last_visit_date))
    ).scalars().all()
    active_7 = sum(1 for v in visits if v and v >= since_7)
    active_30 = sum(1 for v in visits if v and v >= since_30)

    return {
        "total": len(members),
        "active_7d": active_7,
        "active_30d": active_30,
        "active_30d_pct": pct(active_30, len(members)),
        "new_by_month": [
            {"key": k, "label": month_label(k), "count": v}
            for k, v in sorted(new_by_month.items(), reverse=True)
        ],
    }


async def _course_block(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Por curso y por módulo: cuánta gente lo termina y dónde se cae."""
    courses = (
        await db_session.execute(select(Course).where(Course.org_id == org_id))
    ).scalars().all()

    out: list[dict] = []
    for course in courses:
        if course.id is None:
            continue

        started = (
            await db_session.execute(
                select(func.count(func.distinct(TrailRun.user_id))).where(
                    TrailRun.course_id == course.id
                )
            )
        ).scalar() or 0

        # Qué ha completado cada alumno. Se traen los pares (alumno, clase) y
        # se cuenta en memoria: con esto se puede saber quién terminó un módulo
        # ENTERO, que agregando por clase no se puede (dos alumnos que hagan
        # media clase cada uno no son "un alumno que terminó el módulo").
        step_rows = (
            await db_session.execute(
                select(TrailStep.user_id, TrailStep.activity_id).where(
                    TrailStep.course_id == course.id,
                    TrailStep.complete == True,  # noqa: E712
                )
            )
        ).all()
        done_by_user: dict[int, set[int]] = {}
        for user_id, activity_id in step_rows:
            done_by_user.setdefault(int(user_id), set()).add(int(activity_id))

        # Se cuenta desde los conjuntos por alumno: si algún día hubiera dos
        # filas del mismo alumno y la misma clase, no contaría dos veces.
        completed_by_activity: dict[int, int] = {}
        for activities in done_by_user.values():
            for activity_id in activities:
                completed_by_activity[activity_id] = completed_by_activity.get(activity_id, 0) + 1

        # Módulos con sus clases, en orden.
        chapter_rows = (
            await db_session.execute(
                select(Chapter, ChapterActivity, Activity)
                .join(ChapterActivity, ChapterActivity.chapter_id == Chapter.id)
                .join(Activity, Activity.id == ChapterActivity.activity_id)
                .where(ChapterActivity.course_id == course.id)
                .order_by(Chapter.id, ChapterActivity.order)
            )
        ).all()

        modules: dict[int, dict] = {}
        ordered: list[tuple[str, int]] = []
        for chapter, link, activity in chapter_rows:
            mod = modules.setdefault(
                chapter.id,
                {"name": chapter.name, "activity_ids": set(), "total_activities": 0},
            )
            done = completed_by_activity.get(activity.id or 0, 0)
            mod["activity_ids"].add(activity.id or 0)
            mod["total_activities"] += 1
            ordered.append((activity.name, done))

        module_list = []
        for mod in modules.values():
            # "Completó el módulo" = ese alumno terminó TODAS sus clases.
            ids: set[int] = mod["activity_ids"]
            finished = sum(1 for done in done_by_user.values() if ids and ids <= done)
            module_list.append(
                {
                    "name": mod["name"],
                    "total_activities": mod["total_activities"],
                    "students_completed": finished,
                    "pct": pct(finished, started),
                }
            )

        # Dónde se cae más gente: la mayor bajada entre una clase y la siguiente.
        drop = None
        for i in range(1, len(ordered)):
            before, after = ordered[i - 1], ordered[i]
            lost = before[1] - after[1]
            if lost > 0 and (drop is None or lost > drop["lost"]):
                drop = {
                    "after": before[0],
                    "activity": after[0],
                    "reached": after[1],
                    "lost": lost,
                }

        out.append(
            {
                "course_uuid": course.course_uuid,
                "name": course.name,
                "students_started": int(started),
                "modules": module_list,
                "biggest_drop": drop,
            }
        )

    return out


async def _manual_block(org_id: int, db_session: AsyncSession, leads_by_month: dict) -> dict:
    entries = (
        await db_session.execute(
            select(ManualEntry).where(ManualEntry.org_id == org_id)
        )
    ).scalars().all()

    costs = []
    for e in sorted([x for x in entries if x.kind == "cost"], key=lambda x: x.period, reverse=True):
        leads = leads_by_month.get(e.period, 0)
        costs.append(
            {
                "id": e.id,
                "period": e.period,
                "label": month_label(e.period),
                "cost_cents": int(round(e.value * 100)),
                "leads": leads,
                # Coste por matrícula iniciada: es lo que podemos medir sin
                # tocar el CRM. Sin matrículas ese mes, no hay coste por lead
                # que valga (y dividir por cero mentiría).
                "cost_per_lead_cents": int(round(e.value * 100 / leads)) if leads else None,
                "note": e.note,
            }
        )

    attendance = [
        {
            "id": e.id,
            "period": e.period,
            "label": e.label or e.period,
            "value": int(e.value),
            "note": e.note,
        }
        for e in sorted(
            [x for x in entries if x.kind == "attendance"], key=lambda x: x.period, reverse=True
        )
    ]

    return {"costs": costs, "attendance": attendance}


async def school_stats(org_id: int, db_session: AsyncSession) -> dict:
    """Todo el panel en una llamada. Cada bloque va en su propio try: si uno
    falla, el resto de la pantalla sigue enseñando sus números."""
    out: dict = {"generated_at": datetime.now(timezone.utc).isoformat()}

    try:
        out["sales"] = await _sales_block(org_id, db_session)
    except Exception:
        logger.exception("Estadísticas: fallo calculando ventas")
        out["sales"] = None

    try:
        out["students"] = await _students_block(org_id, db_session)
    except Exception:
        logger.exception("Estadísticas: fallo calculando alumnos")
        out["students"] = None

    try:
        out["courses"] = await _course_block(org_id, db_session)
    except Exception:
        logger.exception("Estadísticas: fallo calculando cursos")
        out["courses"] = None

    try:
        leads = (out.get("sales") or {}).get("leads_by_month") or {}
        out["manual"] = await _manual_block(org_id, db_session, leads)
    except Exception:
        logger.exception("Estadísticas: fallo leyendo los datos manuales")
        out["manual"] = None

    return out


async def save_manual_entry(
    org_id: int, kind: str, period: str, value: float, label: str, note: str,
    db_session: AsyncSession,
) -> ManualEntry:
    """Un dato por tipo y periodo: volver a guardar el mismo mes lo actualiza."""
    now = datetime.now(timezone.utc).isoformat()
    existing: Optional[ManualEntry] = (
        await db_session.execute(
            select(ManualEntry).where(
                ManualEntry.org_id == org_id,
                ManualEntry.kind == kind,
                ManualEntry.period == period,
            )
        )
    ).scalars().first()

    if existing:
        existing.value = value
        existing.label = label
        existing.note = note
        existing.updated_at = now
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)
        return existing

    entry = ManualEntry(
        org_id=org_id, kind=kind, period=period, value=value,
        label=label, note=note, created_at=now, updated_at=now,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


async def delete_manual_entry(org_id: int, entry_id: int, db_session: AsyncSession) -> bool:
    entry = (
        await db_session.execute(
            select(ManualEntry).where(ManualEntry.id == entry_id, ManualEntry.org_id == org_id)
        )
    ).scalars().first()
    if not entry:
        return False
    await db_session.delete(entry)
    await db_session.commit()
    return True

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

import stripe
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
from src.services.payments.payments import _stripe_secret
from src.services.stats.periods import (
    group_sales,
    month_key,
    month_label,
    pct,
    undated_sales,
)

logger = logging.getLogger(__name__)

STUDENT_ROLE_ID = 4

# Días desde el alta para considerar que alguien "arrancó".
ACTIVATION_DAYS = 7
# Días sin entrar a partir de los cuales el alumno sale en la lista de riesgo.
INACTIVE_DAYS = 7
# Semanas que se dibujan en la retención por cohorte.
RETENTION_WEEKS = 6


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


async def _people_blocks(org_id: int, db_session: AsyncSession) -> dict:
    """Alumnos uno a uno: quién está en riesgo, quién arrancó y quién repite.

    Se hace en un solo sitio porque las tres cosas necesitan los mismos datos
    (alta, última visita y qué ha completado cada uno) y así se piden una vez.
    """
    from src.db.student_progress import StudentVisitDay
    from src.db.users import User

    rows = (
        await db_session.execute(
            select(UserOrganization, User)
            .join(User, User.id == UserOrganization.user_id)
            .where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == STUDENT_ROLE_ID,
            )
        )
    ).all()

    user_ids = [int(m.user_id) for m, _ in rows]
    if not user_ids:
        return {
            "at_risk": [],
            "activation": {"window_days": ACTIVATION_DAYS, "eligible": 0, "activated": 0, "pct": 0.0},
            "retention": {"weeks": [], "cohorts": [], "tracking_since": None},
        }

    progress_rows = (
        await db_session.execute(
            select(StudentProgress.user_id, StudentProgress.last_visit_date).where(
                StudentProgress.user_id.in_(user_ids)  # type: ignore[attr-defined]
            )
        )
    ).all()
    last_visit = {int(u): (d or "") for u, d in progress_rows}

    # Primera clase completada por alumno: sirve para "arrancó o no" y para
    # medir la activación desde su alta.
    step_rows = (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.creation_date).where(
                TrailStep.org_id == org_id,
                TrailStep.complete == True,  # noqa: E712
            )
        )
    ).all()
    first_step: dict[int, str] = {}
    steps_done: dict[int, int] = {}
    for user_id, created in step_rows:
        uid = int(user_id)
        steps_done[uid] = steps_done.get(uid, 0) + 1
        stamp = (created or "")[:10]
        if stamp and (uid not in first_step or stamp < first_step[uid]):
            first_step[uid] = stamp

    today = datetime.now(timezone.utc).date()

    def _days_since(value: str) -> Optional[int]:
        stamp = (value or "")[:10]
        if not stamp:
            return None
        try:
            return (today - datetime.fromisoformat(stamp).date()).days
        except ValueError:
            return None

    # ── En riesgo ──
    at_risk: list[dict] = []
    activation_eligible = 0
    activation_ok = 0

    for member, user in rows:
        uid = int(member.user_id)
        joined_days = _days_since(member.creation_date)
        inactive_days = _days_since(last_visit.get(uid, ""))
        done = steps_done.get(uid, 0)

        name = " ".join(x for x in [user.first_name, user.last_name] if x).strip() or user.username

        # Activación: de los que ya han tenido tiempo de arrancar, ¿cuántos
        # completaron algo en su primera semana? Los de alta reciente no
        # cuentan todavía: si no, el número baja solo por ser nuevos.
        if joined_days is not None and joined_days >= ACTIVATION_DAYS:
            activation_eligible += 1
            first = first_step.get(uid)
            if first:
                try:
                    delta = (
                        datetime.fromisoformat(first).date()
                        - datetime.fromisoformat(member.creation_date[:10]).date()
                    ).days
                    if 0 <= delta <= ACTIVATION_DAYS:
                        activation_ok += 1
                except ValueError:
                    pass

        reason = None
        if done == 0 and (joined_days or 0) >= 3:
            reason = "no ha empezado"
        elif inactive_days is None and done > 0:
            reason = "sin registro de visitas"
        elif inactive_days is not None and inactive_days >= INACTIVE_DAYS:
            reason = f"{inactive_days} días sin entrar"

        if reason:
            at_risk.append(
                {
                    "user_id": uid,
                    "name": name,
                    "email": user.email,
                    "days_since_join": joined_days,
                    "days_inactive": inactive_days,
                    "activities_done": done,
                    "reason": reason,
                }
            )

    # Primero los que nunca arrancaron, luego por días sin entrar.
    at_risk.sort(key=lambda a: (a["activities_done"] > 0, -(a["days_inactive"] or 999)))

    # ── Retención por cohorte ──
    visit_rows = (
        await db_session.execute(
            select(StudentVisitDay.user_id, StudentVisitDay.day).where(
                StudentVisitDay.user_id.in_(user_ids)  # type: ignore[attr-defined]
            )
        )
    ).all()
    visits_by_user: dict[int, set[str]] = {}
    for user_id, day in visit_rows:
        visits_by_user.setdefault(int(user_id), set()).add(day)

    joined_at = {int(m.user_id): (m.creation_date or "")[:10] for m, _ in rows}
    # Desde cuándo hay historial de visitas: antes de esta fecha la retención
    # no se puede saber, y conviene decirlo en vez de enseñar un 0%.
    all_days = [d for days in visits_by_user.values() for d in days]
    retention = _retention(joined_at, visits_by_user, today, min(all_days) if all_days else None)

    return {
        "at_risk": at_risk[:50],
        "activation": {
            "window_days": ACTIVATION_DAYS,
            "eligible": activation_eligible,
            "activated": activation_ok,
            "pct": pct(activation_ok, activation_eligible),
        },
        "retention": retention,
    }


def _retention(
    joined_at: dict[int, str],
    visits_by_user: dict[int, set[str]],
    today,
    tracking_since: Optional[str] = None,
) -> dict:
    """% de cada cohorte que seguía entrando en su semana 1, 2, 3…

    Se cuenta desde el alta de cada alumno, no por calendario: así se comparan
    entre sí cohortes que empezaron en meses distintos.
    """
    from datetime import date as _date, timedelta

    cohorts: dict[str, dict] = {}
    weeks_total = [0] * RETENTION_WEEKS
    weeks_active = [0] * RETENTION_WEEKS

    for user_id, joined in joined_at.items():
        if not joined:
            continue
        try:
            start = _date.fromisoformat(joined)
        except ValueError:
            continue

        cohort_key = joined[:7]
        cohort = cohorts.setdefault(
            cohort_key,
            {"key": cohort_key, "label": month_label(cohort_key), "size": 0, "weeks": [None] * RETENTION_WEEKS,
             "_total": [0] * RETENTION_WEEKS, "_active": [0] * RETENTION_WEEKS},
        )
        cohort["size"] += 1

        days = visits_by_user.get(user_id, set())
        for week in range(RETENTION_WEEKS):
            window_start = start + timedelta(days=7 * week)
            window_end = window_start + timedelta(days=6)
            # Una semana solo cuenta si ya ha terminado o si el alumno ya
            # estuvo activo en ella: si no, un alumno de ayer hundiría la media.
            if window_start > today:
                continue
            active = any(window_start.isoformat() <= d <= window_end.isoformat() for d in days)
            if not active and window_end > today:
                continue
            cohort["_total"][week] += 1
            weeks_total[week] += 1
            if active:
                cohort["_active"][week] += 1
                weeks_active[week] += 1

    cohort_list = []
    for cohort in sorted(cohorts.values(), key=lambda c: c["key"], reverse=True):
        cohort["weeks"] = [
            pct(cohort["_active"][w], cohort["_total"][w]) if cohort["_total"][w] else None
            for w in range(RETENTION_WEEKS)
        ]
        cohort.pop("_total")
        cohort.pop("_active")
        cohort_list.append(cohort)

    return {
        "weeks": [
            pct(weeks_active[w], weeks_total[w]) if weeks_total[w] else None
            for w in range(RETENTION_WEEKS)
        ],
        "cohorts": cohort_list,
        "tracking_since": tracking_since,
    }


async def _support_block(org_id: int, db_session: AsyncSession) -> dict:
    """Cuánto tardáis en contestar un mensaje directo de un alumno.

    Solo mide los mensajes directos de la escuela. Las consultas viven en otra
    aplicación (Supabase) y desde aquí no se ven.
    """
    from src.db.direct_messages import DirectMessage, DirectThread

    rows = (
        await db_session.execute(
            select(DirectMessage, DirectThread)
            .join(DirectThread, DirectThread.id == DirectMessage.thread_id)
            .where(DirectThread.org_id == org_id)
            .order_by(DirectMessage.thread_id, DirectMessage.id)
        )
    ).all()

    waits: list[float] = []
    pending = 0
    open_question: dict[int, str] = {}  # hilo → fecha del mensaje del alumno

    for message, thread in rows:
        from_student = message.author_id is not None and int(message.author_id) == int(thread.student_id)
        if from_student:
            # Solo cuenta la PRIMERA pregunta sin responder de cada tanda.
            open_question.setdefault(int(thread.id), message.created_at or "")
            continue
        asked = open_question.pop(int(thread.id), None)
        if not asked or not message.created_at:
            continue
        try:
            delta = datetime.fromisoformat(message.created_at) - datetime.fromisoformat(asked)
        except ValueError:
            continue
        hours = delta.total_seconds() / 3600
        if hours >= 0:
            waits.append(hours)

    pending = len(open_question)
    waits.sort()
    median = waits[len(waits) // 2] if waits else None
    under_24 = sum(1 for w in waits if w <= 24)

    return {
        "answered": len(waits),
        "pending": pending,
        "median_hours": round(median, 1) if median is not None else None,
        "under_24h_pct": pct(under_24, len(waits)),
    }


def _refunds_block() -> dict:
    """Devoluciones y disputas, de Stripe. Best-effort: si Stripe no contesta
    (o no hay clave), la pantalla enseña el resto igual."""
    try:
        stripe.api_key = _stripe_secret()
    except Exception:
        return {"available": False, "refunds": 0, "refunded_cents": 0, "disputes": 0}

    refunds = 0
    refunded_cents = 0
    disputes = 0
    try:
        listing = stripe.Refund.list(limit=100)
        for item in listing.get("data", []) if hasattr(listing, "get") else listing.data:
            refunds += 1
            refunded_cents += int(item.get("amount") or 0)
    except Exception:
        logger.warning("Estadísticas: no se pudieron leer las devoluciones de Stripe", exc_info=True)
        return {"available": False, "refunds": 0, "refunded_cents": 0, "disputes": 0}

    try:
        dispute_list = stripe.Dispute.list(limit=100)
        data = dispute_list.get("data", []) if hasattr(dispute_list, "get") else dispute_list.data
        disputes = len(data)
    except Exception:
        logger.warning("Estadísticas: no se pudieron leer las disputas de Stripe", exc_info=True)

    return {
        "available": True,
        "refunds": refunds,
        "refunded_cents": refunded_cents,
        "disputes": disputes,
    }


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

    delivery = [
        {"id": e.id, "period": e.period, "label": month_label(e.period),
         "cost_cents": int(round(e.value * 100)), "note": e.note}
        for e in sorted(
            [x for x in entries if x.kind == "delivery"], key=lambda x: x.period, reverse=True
        )
    ]

    return {"costs": costs, "delivery": delivery, "attendance": attendance}


def _margin_block(sales: Optional[dict], manual: Optional[dict]) -> list[dict]:
    """Margen por mes: ingresos − (captar + entregar), y cuántas ventas hacen
    falta para cubrir el gasto de ese mes.

    Los profes NO son coste de captación: van en "entregar", que escala con
    los alumnos, no con los leads. Por eso van en cubos separados.
    """
    if not sales or not manual:
        return []

    revenue_by_month = {row["key"]: row for row in sales.get("by_month", [])}
    marketing = {c["period"]: c["cost_cents"] for c in manual.get("costs", [])}
    delivery = {d["period"]: d["cost_cents"] for d in manual.get("delivery", [])}

    out = []
    for key in sorted(set(revenue_by_month) | set(marketing) | set(delivery), reverse=True):
        row = revenue_by_month.get(key)
        revenue = int(row["revenue_cents"]) if row else 0
        units = int(row["sales"]) if row else 0
        ticket = int(row["avg_ticket_cents"]) if row else 0
        spend = int(marketing.get(key, 0)) + int(delivery.get(key, 0))
        margin = revenue - spend
        out.append(
            {
                "key": key,
                "label": month_label(key),
                "revenue_cents": revenue,
                "marketing_cents": int(marketing.get(key, 0)),
                "delivery_cents": int(delivery.get(key, 0)),
                "margin_cents": margin,
                "sales": units,
                "margin_per_student_cents": round(margin / units) if units else None,
                # Con el ticket medio de ese mes: cuántas ventas cubren el gasto.
                "breakeven_sales": (spend + ticket - 1) // ticket if ticket else None,
            }
        )
    return out


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

    try:
        out["margin"] = _margin_block(out.get("sales"), out.get("manual"))
    except Exception:
        logger.exception("Estadísticas: fallo calculando el margen")
        out["margin"] = None

    try:
        people = await _people_blocks(org_id, db_session)
        out["at_risk"] = people["at_risk"]
        out["activation"] = people["activation"]
        out["retention"] = people["retention"]
    except Exception:
        logger.exception("Estadísticas: fallo calculando alumnos en riesgo/activación")
        out["at_risk"] = None
        out["activation"] = None
        out["retention"] = None

    try:
        out["support"] = await _support_block(org_id, db_session)
    except Exception:
        logger.exception("Estadísticas: fallo calculando el tiempo de respuesta")
        out["support"] = None

    try:
        out["refunds"] = _refunds_block()
    except Exception:
        logger.exception("Estadísticas: fallo leyendo Stripe")
        out["refunds"] = None

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

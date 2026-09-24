"""
Gastos y lo que dicen: cuánto cuesta cada matrícula, qué margen deja la
cohorte y cuánto cuesta cada alumno al mes.

Cuadro de mando, no contabilidad: ver src/db/school_expense.py. La lógica que
cruza gastos con ventas es pura (`resumen_gastos`, con test); lo de alrededor
solo lee la base de datos.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.school_expense import SchoolExpense
from src.db.user_organizations import UserOrganization
from src.security.rbac.constants import STUDENT_ROLE_ID
from src.services.stats.periods import month_label

CATEGORIAS = {
    "publicidad": "Publicidad",
    "profes": "Profes",
    "herramientas": "Herramientas",
    "otros": "Otros",
}


def _pct(a: int, b: int) -> Optional[int]:
    return round(a * 100 / b) if b else None


def resumen_gastos(
    ventas: list[tuple[str, int]],
    gastos: list[tuple[str, str, int]],
    alumnos: int,
) -> dict:
    """
    ventas: (fecha ISO, céntimos) de cada venta cobrada.
    gastos: (fecha AAAA-MM-DD, categoría, céntimos).
    alumnos: cuántos alumnos hay ahora (para el coste por alumno al mes).

    Devuelve los totales y una fila por mes (el más reciente primero), cada una
    con ingresos, gastos por categoría, margen, coste por matrícula (solo la
    publicidad entre las ventas: es lo que cuesta TRAER a alguien) y coste por
    alumno (todo el gasto del mes entre los alumnos).
    """
    meses: dict[str, dict] = {}

    def mes(clave: str) -> dict:
        return meses.setdefault(
            clave,
            {"ventas": 0, "ingresos_cents": 0, "gastos_cents": 0, "por_categoria": {c: 0 for c in CATEGORIAS}},
        )

    for fecha, cents in ventas:
        if len(fecha) >= 7:
            m = mes(fecha[:7])
            m["ventas"] += 1
            m["ingresos_cents"] += int(cents or 0)
    for fecha, cat, cents in gastos:
        if len(fecha) >= 7:
            m = mes(fecha[:7])
            cat = cat if cat in CATEGORIAS else "otros"
            m["gastos_cents"] += int(cents or 0)
            m["por_categoria"][cat] += int(cents or 0)

    filas = []
    for clave in sorted(meses, reverse=True):
        m = meses[clave]
        publicidad = m["por_categoria"]["publicidad"]
        filas.append(
            {
                "mes": clave,
                "label": month_label(clave),
                **m,
                "margen_cents": m["ingresos_cents"] - m["gastos_cents"],
                "coste_por_matricula_cents": round(publicidad / m["ventas"]) if m["ventas"] and publicidad else None,
                "coste_por_alumno_cents": round(m["gastos_cents"] / alumnos) if alumnos and m["gastos_cents"] else None,
            }
        )

    ingresos = sum(f["ingresos_cents"] for f in filas)
    total_gastos = sum(f["gastos_cents"] for f in filas)
    total_ventas = sum(f["ventas"] for f in filas)
    publicidad_total = sum(f["por_categoria"]["publicidad"] for f in filas)
    por_categoria = {c: sum(f["por_categoria"][c] for f in filas) for c in CATEGORIAS}
    return {
        "total": {
            "ventas": total_ventas,
            "ingresos_cents": ingresos,
            "gastos_cents": total_gastos,
            "margen_cents": ingresos - total_gastos,
            "margen_pct": _pct(ingresos - total_gastos, ingresos),
            "por_categoria": por_categoria,
            "coste_por_matricula_cents": round(publicidad_total / total_ventas) if total_ventas and publicidad_total else None,
        },
        "meses": filas,
        "alumnos": alumnos,
    }


async def panel_gastos(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.payments.payments import _desde_cuando

    desde = _desde_cuando()
    pagadas = (
        await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))
    ).scalars().all()
    from src.services.contactos.metricas import emails_excluidos, ids_excluidos

    fuera = await emails_excluidos(db_session)
    ventas = []
    for r in pagadas:
        if (r.email or "").strip().lower() in fuera:
            continue
        fecha = r.paid_at or r.updated_at or r.created_at or ""
        # Misma fecha de corte que las ventas y las plazas: las pruebas no cuentan.
        if desde and (r.paid_at or "") < desde:
            continue
        ventas.append((fecha, int(r.amount_cents or 0)))

    filas = (
        await db_session.execute(
            select(SchoolExpense).where(SchoolExpense.org_id == org_id).order_by(SchoolExpense.fecha.desc(), SchoolExpense.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().all()
    fuera_ids = await ids_excluidos(db_session)
    alumnos = len(
        [
            u
            for u in (
                await db_session.execute(
                    select(UserOrganization.user_id).where(
                        UserOrganization.org_id == org_id, UserOrganization.role_id == STUDENT_ROLE_ID
                    )
                )
            ).scalars().all()
            if u not in fuera_ids
        ]
    )

    # Lo que se apuntaba antes en Estadísticas → "Lo que escribes tú" (gasto
    # del mes para captar y coste de entregar). Esa pantalla ya no lo pide:
    # un solo sitio para los gastos. Lo antiguo se enseña aquí y cuenta igual,
    # marcado como tal, para no perder nada de lo ya apuntado.
    from src.db.school_stats import ManualEntry

    antiguos = (
        await db_session.execute(
            select(ManualEntry).where(ManualEntry.org_id == org_id, ManualEntry.kind.in_(("cost", "delivery")))  # type: ignore[attr-defined]
        )
    ).scalars().all()
    lista = [
        {
            "id": g.id,
            "fecha": g.fecha,
            "categoria": g.categoria,
            "concepto": g.concepto,
            "importe_cents": g.importe_cents,
            "nota": g.nota,
            "antiguo_id": None,
        }
        for g in filas
    ] + [
        {
            "id": None,
            "fecha": f"{m.period}-01" if len(m.period) == 7 else m.period,
            "categoria": "publicidad" if m.kind == "cost" else "profes",
            "concepto": (m.label or m.note or ("Gasto del mes para captar" if m.kind == "cost" else "Coste de entregar el curso")),
            "importe_cents": int(round((m.value or 0) * 100)),
            "nota": "Apuntado antes en Estadísticas",
            "antiguo_id": m.id,
        }
        for m in antiguos
        if (m.value or 0) > 0
    ]
    lista.sort(key=lambda g: g["fecha"], reverse=True)

    datos = resumen_gastos(ventas, [(g["fecha"], g["categoria"], g["importe_cents"]) for g in lista], int(alumnos))
    datos["gastos"] = lista[:500]
    datos["categorias"] = CATEGORIAS
    datos["desde"] = desde
    return datos


async def guardar_gasto(org_id: int, fecha: str, categoria: str, concepto: str, importe: float, nota: str, db_session: AsyncSession, gasto_id: Optional[int] = None) -> Optional[SchoolExpense]:
    if gasto_id is not None:
        g = (
            await db_session.execute(
                select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id)
            )
        ).scalars().first()
        if g is None:
            return None
    else:
        g = SchoolExpense(org_id=org_id, created_at=datetime.now(timezone.utc).isoformat())
    g.fecha = fecha
    g.categoria = categoria if categoria in CATEGORIAS else "otros"
    g.concepto = (concepto or "").strip()[:200]
    g.importe_cents = int(round(float(importe) * 100))
    g.nota = (nota or "").strip()[:500]
    db_session.add(g)
    await db_session.commit()
    await db_session.refresh(g)
    return g


async def borrar_gasto(org_id: int, gasto_id: int, db_session: AsyncSession) -> bool:
    g = (
        await db_session.execute(
            select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id)
        )
    ).scalars().first()
    if g is None:
        return False
    await db_session.delete(g)
    await db_session.commit()
    return True

"""
Clientes: quien ha pagado, ordenado por el último pago, con lo que pagó y si
sigue entrando a la escuela. Para abrir su ficha y ver todo lo demás.

Se junta por CORREO como el resto del panel. Las pruebas quitadas de los
números no salen (`metric_exclusion`), igual que en las ventas.
"""

import logging
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.student_progress import StudentProgress
from src.db.users import User
from src.services.contactos.metricas import emails_excluidos
from src.services.panel.avance import avance_formacion

logger = logging.getLogger(__name__)


def agrupar_pagos(filas: list[dict]) -> list[dict]:
    """Un cliente por correo: total pagado, número de pagos y el último.
    Función pura, con test. El más reciente arriba."""
    por: dict[str, dict] = {}
    for f in filas:
        email = (f.get("email") or "").strip().lower()
        if not email:
            continue
        c = por.setdefault(
            email,
            {"email": email, "nombre": "", "telefono": "", "total_cents": 0, "pagos": 0, "ultimo_pago": "", "primer_pago": "", "productos": []},
        )
        c["total_cents"] += int(f.get("importe_cents") or 0)
        c["pagos"] += 1
        fecha = f.get("fecha") or ""
        if fecha > c["ultimo_pago"]:
            c["ultimo_pago"] = fecha
            c["nombre"] = f.get("nombre") or c["nombre"]
            c["telefono"] = f.get("telefono") or c["telefono"]
        if not c["primer_pago"] or (fecha and fecha < c["primer_pago"]):
            c["primer_pago"] = fecha
        prod = f.get("producto") or ""
        if prod and prod not in c["productos"]:
            c["productos"].append(prod)
    return sorted(por.values(), key=lambda c: c["ultimo_pago"], reverse=True)


async def listar_clientes(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    fuera = await emails_excluidos(db_session)
    filas = [
        {
            "email": r.email,
            "nombre": f"{r.first_name or ''} {r.last_name or ''}".strip(),
            "telefono": r.phone or "",
            "importe_cents": r.amount_cents or 0,
            "fecha": r.paid_at or r.updated_at or r.created_at or "",
            "producto": r.product or "",
        }
        for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all()
        if (r.email or "").strip().lower() not in fuera
    ]
    clientes = agrupar_pagos(filas)

    # Si sigue entrando: última visita y por dónde va en la formación.
    # El avance sale de las CLASES hechas (trail_step), no de
    # lesson_completion: ver el porqué en services/panel/avance.py.
    correos = [c["email"] for c in clientes]
    usuarios = {}
    if correos:
        for u in (
            await db_session.execute(select(User).where(func.lower(User.email).in_(correos)))  # type: ignore[attr-defined]
        ).scalars().all():
            usuarios[u.email.strip().lower()] = u.id
    ids = list(usuarios.values())
    visitas: dict[int, str] = {}
    if ids:
        for p in (await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(ids)))).scalars().all():  # type: ignore[attr-defined]
            visitas[p.user_id] = p.last_visit_date or ""
    avances = await avance_formacion(db_session, ids)
    # Quien paga en 3 plazos: cuántos lleva y si alguno no entró (14/10).
    from src.services.payments.plazos import planes_por_email

    planes = await planes_por_email(db_session)
    for c in clientes:
        p = planes.get((c["email"] or "").strip().lower())
        c["plazos"] = (
            {k: p[k] for k in ("estado", "estado_nombre", "cuotas", "cuotas_pagadas", "total_cents", "pendiente_cents", "proximo_cobro", "fallo")}
            if p
            else None
        )
        uid = usuarios.get(c["email"])
        c["tiene_cuenta"] = uid is not None
        c["ultima_visita"] = visitas.get(uid, "") if uid else ""
        a = avances.get(uid) if uid else None
        c["avance"] = {k: v for k, v in a.items() if k != "modulos"} if a else None

    # La comisión del closer de cada venta (27/10, `comisiones.py`): solo la
    # piden los administradores, que son los únicos que ven Clientes.
    comisiones: list[dict] = []
    porcentajes: list[float] = []
    if org_id is not None:
        from src.services.panel.comisiones import para_clientes

        try:
            comisiones, porcentajes = await para_clientes(clientes, org_id, db_session)
        except Exception:  # noqa: BLE001
            logger.warning("No se pudo calcular la comisión del closer", exc_info=True)

    return {
        "clientes": clientes,
        "total_cents": sum(c["total_cents"] for c in clientes),
        "n": len(clientes),
        "comisiones": comisiones,
        "porcentajes_comision": porcentajes,
    }

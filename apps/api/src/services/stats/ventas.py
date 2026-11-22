"""
Vendido no es lo mismo que cobrado (22/11/2026).

El usuario: «cuando alguien compra, estadísticas solo cobra 200 euros como
analítica en venta, pero no es eso: es un producto vendido de 597 en 3 plazos;
que no esté cobrado no es que no esté vendido».

Hasta hoy cada pantalla del panel sumaba `enrollment.amount_cents`, que con un
plan de pagos es SOLO lo que ha entrado (lo va subiendo `plazos._guardar` con
cada cuota). Una venta de 597 € en 3 plazos salía como 199 € el primer mes.

Aquí vive la ÚNICA cuenta de «cuánto vale cada venta». Cualquier pantalla que
sume dinero de ventas tiene que salir de este módulo:

- **vendido**  = lo que la persona se comprometió a pagar. Con plan de pagos,
  el total del plan (como `comisiones.base_de`); sin plan, lo cobrado.
- **cobrado**  = lo que ha entrado de verdad (`enrollment.amount_cents`).
- **por cobrar** = vendido − cobrado, nunca negativo.

Casos que se han pensado:

- **Plan cancelado** (Stripe dejó de intentar el cobro sin completarlo): lo
  que falta ya no se va a cobrar, así que lo vendido se queda en lo cobrado y
  la diferencia sale aparte como `perdido_cents`. No se enseña como «por
  cobrar» un dinero que no va a llegar.
- **Cobro fallido** (Stripe sigue reintentando): sigue vendido entero; el plan
  lleva `fallido: True` para que la pantalla lo avise.
- **Señal sin completar**: NO es una venta (no hay matrícula `paid` hasta que
  se paga todo; ver `reservas.py`). No pasa por aquí.
- La venta cuenta en la fecha del PRIMER pago (`paid_at` de la matrícula), no
  repartida por los meses de las cuotas.

`venta_de`, `totales` y `por_email` son puras y tienen test
(`test_ventas_vendido.py`), igual que `emparejar`. `leer_ventas` solo lee la
base de datos.
"""

from __future__ import annotations

from typing import Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

# Estados de un plan en los que lo que falta todavía se espera cobrar.
_SE_ESPERA = ("activo", "fallido")


def venta_de(matricula: dict, plan: Optional[dict] = None) -> dict:
    """Una matrícula pagada convertida en venta. Función pura.

    matricula: {id, email, amount_cents, fecha, product, nombre, recorrido}
    plan: el de `plazos.resumen` (o un dict con estado, cuotas, cuotas_pagadas,
          total_cents, pagado_cents, proximo_cobro, fallo), si paga a plazos.
    """
    cobrado = max(0, int(matricula.get("amount_cents") or 0))
    plazos = None
    vendido = cobrado
    perdido = 0
    if plan:
        total = max(0, int(plan.get("total_cents") or 0))
        estado = plan.get("estado") or "activo"
        # La matrícula es la que manda; si aún no se le ha llevado el primer
        # cobro (aviso de Stripe a medias), vale lo que diga el plan.
        if not cobrado:
            cobrado = max(0, int(plan.get("pagado_cents") or 0))
        if estado in _SE_ESPERA or estado == "completado":
            vendido = max(total, cobrado)
        else:  # cancelado: lo que falta ya no se espera
            vendido = cobrado
            perdido = max(0, total - cobrado)
        plazos = {
            "estado": estado,
            "cuotas": int(plan.get("cuotas") or 0),
            "pagadas": int(plan.get("cuotas_pagadas") or 0),
            "total_cents": total,
            "fallido": estado == "fallido",
            "cancelado": estado == "cancelado",
            "proximo_cobro": plan.get("proximo_cobro") or "",
            "fallo": plan.get("fallo") or "",
        }
    return {
        "id": matricula.get("id"),
        "email": (matricula.get("email") or "").strip().lower(),
        "nombre": matricula.get("nombre") or "",
        "fecha": matricula.get("fecha") or "",
        "paid_at": matricula.get("paid_at") or "",
        "producto": matricula.get("product") or "formacion-a0-a1",
        "recorrido": matricula.get("recorrido") or "",
        "vendido_cents": vendido,
        "cobrado_cents": cobrado,
        "por_cobrar_cents": max(0, vendido - cobrado),
        "perdido_cents": perdido,
        "plazos": plazos,
    }


def totales(ventas: Iterable[dict]) -> dict:
    """La suma de un grupo de ventas. Función pura. El ticket medio va sobre
    lo VENDIDO: es lo que vale cada venta, no lo que ha entrado hasta hoy."""
    lista = list(ventas)
    vendido = sum(int(v.get("vendido_cents") or 0) for v in lista)
    cobrado = sum(int(v.get("cobrado_cents") or 0) for v in lista)
    return {
        "ventas": len(lista),
        "vendido_cents": vendido,
        "cobrado_cents": cobrado,
        "por_cobrar_cents": sum(int(v.get("por_cobrar_cents") or 0) for v in lista),
        "perdido_cents": sum(int(v.get("perdido_cents") or 0) for v in lista),
        "ticket_medio_cents": round(vendido / len(lista)) if lista else 0,
        "a_plazos": sum(1 for v in lista if v.get("plazos")),
        "con_fallo": sum(1 for v in lista if (v.get("plazos") or {}).get("fallido")),
    }


def por_email(ventas: Iterable[dict]) -> dict[str, dict]:
    """Lo de cada persona (por correo), sumando si tiene más de una venta.
    Función pura. {email: {vendido_cents, cobrado_cents, por_cobrar_cents}}"""
    salida: dict[str, dict] = {}
    for v in ventas:
        email = v.get("email") or ""
        if not email:
            continue
        s = salida.setdefault(email, {"vendido_cents": 0, "cobrado_cents": 0, "por_cobrar_cents": 0})
        for k in s:
            s[k] += int(v.get(k) or 0)
    return salida


def emparejar(matriculas: list[dict], planes: list[dict]) -> list[dict]:
    """Cada matrícula pagada con su plan, si lo tiene. Función pura.

    Un plan es de la matrícula que apunta (`enrollment_id`). Un plan sin
    matrícula apuntada (o que apunta a una que ya no está entre las pagadas)
    se le da a la primera matrícula de ese correo que no tenga otro plan: así
    un plan nunca cuenta dos veces."""
    por_id = {int(p["enrollment_id"]): p for p in planes if p.get("enrollment_id")}
    ids = {m.get("id") for m in matriculas}
    sueltos: dict[str, list[dict]] = {}
    for p in planes:
        if p.get("enrollment_id") and int(p["enrollment_id"]) in ids:
            continue
        sueltos.setdefault((p.get("email") or "").strip().lower(), []).append(p)
    ventas = []
    for m in sorted(matriculas, key=lambda m: m.get("fecha") or ""):
        plan = por_id.get(m.get("id")) if m.get("id") is not None else None
        if plan is None:
            cola = sueltos.get((m.get("email") or "").strip().lower()) or []
            plan = cola.pop(0) if cola else None
        ventas.append(venta_de(m, plan))
    return ventas


async def leer_ventas(
    db_session: AsyncSession,
    *,
    con_corte: bool = True,
    con_excluidos: bool = False,
) -> list[dict]:
    """Todas las ventas (matrículas `paid`) con lo vendido, lo cobrado y lo que
    falta. `con_corte`: aplica `LEARNHOUSE_FORMACION_DESDE` (las pruebas de
    antes de abrir no cuentan). `con_excluidos=False`: quien está fuera de los
    números no sale."""
    from src.db.enrollment import Enrollment
    from src.db.plan_pagos import PlanPagos
    from src.services.contactos.metricas import emails_excluidos
    from src.services.payments.payments import _desde_cuando
    from src.services.payments.plazos import resumen

    fuera = set() if con_excluidos else await emails_excluidos(db_session)
    desde = _desde_cuando() if con_corte else ""
    matriculas = []
    for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all():
        email = (r.email or "").strip().lower()
        if email in fuera:
            continue
        if desde and (r.paid_at or "") < desde:
            continue
        matriculas.append(
            {
                "id": r.id,
                "email": email,
                "nombre": f"{r.first_name or ''} {r.last_name or ''}".strip(),
                "amount_cents": int(r.amount_cents or 0),
                # Las filas viejas no tienen `paid_at`: la última actualización
                # y, en último caso, el alta (igual que hacía `school.py`).
                "fecha": r.paid_at or r.updated_at or r.created_at or "",
                "paid_at": r.paid_at or "",
                "product": r.product or "formacion-a0-a1",
                "recorrido": getattr(r, "recorrido", "") or "",
            }
        )
    planes = []
    for p in (await db_session.execute(select(PlanPagos).order_by(PlanPagos.id))).scalars().all():  # type: ignore[arg-type]
        planes.append({**resumen(p), "email": (p.email or "").strip().lower(), "enrollment_id": p.enrollment_id})
    return emparejar(matriculas, planes)

"""
Los números que la escuela YA sabe de cada campaña, para no teclearlos
(17/10/2026, "que esté conectada con los números de la escuela").

Una campaña de Visión se une a la escuela por su `utm_campaign`, el mismo
valor que lleva el enlace del anuncio (igual que Panel → Anuncios). De cada
persona que llegó por ese enlace se sabe:

- **Lead**: dejó sus datos (el primer evento con esa campaña).
- **Agendada**: reservó una llamada. Cuenta cualquiera de estas: el evento
  `reunion` (reservó en el Calendly de la web), `llamada-equipo` (se la agendó
  el equipo), una cita de Calendly no cancelada o un «¿Qué pasó?» apuntado.
  Se miran todas porque la agenda de Calendly solo trae 45 días hacia atrás.
- **Presentada**: el «¿Qué pasó?» de su llamada dice que sí vino (Pagó, Va a
  pagar, Lo piensa o No encaja; no «No vino»).
- **Venta**: matrícula pagada (desde `LEARNHOUSE_FORMACION_DESDE`, sin las
  cuentas fuera de los números), con lo cobrado y el día. El método es
  «plazos» si tiene plan de pagos propio; si no, «único» (Klarna no se sabe
  todavía: se marca a mano en los pagos de la campaña; Fase 2).
  `con_llamada` = esa persona tuvo una llamada agendada (comisión del closer).

`agrupar` es pura (con test); `numeros_de_la_escuela` la alimenta.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

#: Resultados de «¿Qué pasó?» que dicen que la persona vino a la llamada.
VINO = {"pagado", "compra", "piensa", "no-encaja"}
_AGENDA = {"reunion", "llamada-equipo"}


def _clave(t: str) -> str:
    return (t or "").strip().lower()


def _min(a: str, b: str) -> str:
    if not a:
        return b
    if not b:
        return a
    return min(a, b)


def agrupar(
    fichas: list[dict],
    citas: list[dict],
    resultados: list[dict],
    ventas: list[dict],
    con_plan: set[str],
) -> dict:
    """
    fichas: las de Contactos (con `eventos`).
    citas: las de Calendly {email, estado, reservada, inicio}.
    resultados: los «¿Qué pasó?» {email, resultado, inicio, updated_at}.
    ventas: matrículas pagadas {email, importe_cents, fecha}.
    con_plan: correos con plan de pagos propio.

    Devuelve {"por_utm": {utm: {leads, agendadas, presentadas, ventas}},
    "ventas": todas las ventas}. Cada lista es de {email, fecha} (las ventas,
    además, importe, método y si pasó por llamada).
    """
    agendada: dict[str, str] = {}
    for f in fichas:
        for e in f.get("eventos") or []:
            if e.get("kind") in _AGENDA:
                em = _clave(f.get("email", ""))
                agendada[em] = _min(agendada.get(em, ""), (e.get("when") or "")[:10])
    for c in citas:
        if (c.get("estado") or "") == "cancelada":
            continue
        em = _clave(c.get("email", ""))
        if em:
            agendada[em] = _min(agendada.get(em, ""), (c.get("reservada") or c.get("inicio") or "")[:10])
    presentada: dict[str, str] = {}
    for r in resultados:
        em = _clave(r.get("email", ""))
        if not em or r.get("resultado") == "quitada":
            continue
        cuando = (r.get("inicio") or r.get("updated_at") or "")[:10]
        agendada[em] = _min(agendada.get(em, ""), cuando)
        if r.get("resultado") in VINO:
            presentada[em] = _min(presentada.get(em, ""), cuando)

    todas = []
    for v in ventas:
        em = _clave(v.get("email", ""))
        todas.append(
            {
                "email": em,
                "importe_cents": int(v.get("importe_cents") or 0),
                "fecha": (v.get("fecha") or "")[:10],
                "metodo": "plazos" if em in con_plan else "unico",
                "con_llamada": em in agendada,
            }
        )
    ventas_de: dict[str, list[dict]] = defaultdict(list)
    for v in todas:
        ventas_de[v["email"]].append(v)

    por_utm: dict[str, dict] = defaultdict(lambda: {"leads": [], "agendadas": [], "presentadas": [], "ventas": []})
    for f in fichas:
        em = _clave(f.get("email", ""))
        if not em:
            continue
        # Cuándo llegó por cada campaña: su primer evento con ese utm.
        llego: dict[str, str] = {}
        for e in f.get("eventos") or []:
            u = _clave(e.get("utm_campaign", ""))
            if u:
                llego[u] = _min(llego.get(u, ""), (e.get("when") or "")[:10])
        u_ficha = _clave(f.get("utm_campaign", ""))
        if u_ficha and u_ficha not in llego:
            llego[u_ficha] = ((f.get("primer_contacto") or {}).get("when") or "")[:10]
        for u, cuando in llego.items():
            g = por_utm[u]
            g["leads"].append({"email": em, "fecha": cuando})
            if em in agendada:
                g["agendadas"].append({"email": em, "fecha": agendada[em]})
            if em in presentada:
                g["presentadas"].append({"email": em, "fecha": presentada[em]})
            g["ventas"].extend(ventas_de.get(em, []))
    return {"por_utm": dict(por_utm), "ventas": todas}


async def numeros_de_la_escuela(org_id: int, db_session: AsyncSession) -> dict:
    """`agrupar` con los datos de verdad. Lo que falle (Calendly sin token o
    sin red) se queda vacío y lo dice en `avisos`."""
    from src.db.contact_seguimiento import CallOutcome
    from src.db.enrollment import Enrollment
    from src.db.plan_pagos import PlanPagos
    from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
    from src.services.contactos.metricas import emails_excluidos
    from src.services.payments.payments import _desde_cuando

    avisos: list[str] = []
    fuera = await emails_excluidos(db_session)
    fichas = [
        f
        for f in fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
        if f["email"] not in fuera
    ]

    citas: list[dict] = []
    try:
        from src.services.contactos.agenda import agenda

        a = await agenda()
        if a.get("configurado"):
            citas = list(a.get("citas") or [])
            if a.get("error"):
                avisos.append("Calendly no ha contestado: las llamadas agendadas salen de lo apuntado en la escuela.")
    except Exception:  # noqa: BLE001
        avisos.append("Calendly no ha contestado: las llamadas agendadas salen de lo apuntado en la escuela.")

    resultados = [
        {"email": r.email, "resultado": r.resultado, "inicio": r.inicio, "updated_at": r.updated_at}
        for r in (await db_session.execute(select(CallOutcome))).scalars().all()
    ]

    desde = _desde_cuando()
    ventas = []
    for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all():
        em = _clave(r.email)
        if em in fuera or (desde and (r.paid_at or "") < desde):
            continue
        ventas.append({"email": em, "importe_cents": int(r.amount_cents or 0), "fecha": r.paid_at or r.updated_at or r.created_at or ""})

    con_plan: set[str] = set()
    try:
        con_plan = {_clave(p.email) for p in (await db_session.execute(select(PlanPagos))).scalars().all() if p.email}
    except Exception:  # noqa: BLE001
        await db_session.rollback()

    datos = agrupar(fichas, citas, resultados, ventas, con_plan)
    datos["avisos"] = avisos
    datos["desde"] = desde
    return datos


def de_la_campana(datos: dict, utm: str) -> Optional[dict]:
    """Los números de la escuela de un utm, o None si la campaña no lleva utm."""
    u = _clave(utm)
    if not u:
        return None
    return (datos.get("por_utm") or {}).get(u) or {"leads": [], "agendadas": [], "presentadas": [], "ventas": []}

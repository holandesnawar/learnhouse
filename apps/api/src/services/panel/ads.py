"""
Anuncios: qué trajo cada campaña. Leads, matrículas, ventas e ingresos, y lo
que costó cada uno.

Cómo se sabe qué persona vino de qué anuncio: por el `utm_campaign` del
enlace. La web lo guarda en cada alta (guías, formularios, matrícula), así que
una campaña apuntada aquí con el MISMO utm_campaign que su enlace se queda con
todas las personas que llegaron por él. Cuenta cualquier contacto por ese
enlace, no solo el primero: quien bajó la guía por un anuncio y compró semanas
después cuenta como venta de ese anuncio.

Los utm_campaign que aparecen en los leads sin campaña apuntada salen aparte,
para que no se pierdan ("hay 12 leads de 'reels-oct' y no sé qué es").

El cálculo es una función pura (`metricas`), con test.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.panel_negocio import AdCampaign

PLATAFORMAS = {"meta": "Meta (Instagram y Facebook)", "google": "Google", "tiktok": "TikTok", "youtube": "YouTube", "otro": "Otra"}


def _clave(texto: str) -> str:
    return (texto or "").strip().lower()


def campanas_de(ficha: dict) -> set[str]:
    """Todos los utm_campaign por los que ha llegado esta persona."""
    vistas = {_clave(e.get("utm_campaign", "")) for e in ficha.get("eventos") or []}
    vistas.add(_clave(ficha.get("utm_campaign", "")))
    vistas.discard("")
    return vistas


def metricas(campanas: list[dict], fichas: list[dict], ingresos_por_email: dict[str, int]) -> dict:
    """Cruza las campañas apuntadas con las fichas de Contactos.

    campanas: {id, nombre, utm_campaign, gasto_cents, …}
    fichas: las de `fusionar_contactos` (con `eventos` y `etapa`).
    ingresos_por_email: lo cobrado a cada persona, en céntimos.
    """
    por_utm: dict[str, list[dict]] = {}
    for f in fichas:
        for c in campanas_de(f):
            por_utm.setdefault(c, []).append(f)

    filas = []
    conocidas = set()
    for c in campanas:
        clave = _clave(c.get("utm_campaign", ""))
        conocidas.add(clave)
        gente = por_utm.get(clave, []) if clave else []
        leads = len(gente)
        matriculas = sum(1 for f in gente if f.get("etapa") in ("pidio", "en-pago", "alumno"))
        ventas = [f for f in gente if f.get("etapa") == "alumno"]
        ingresos = sum(ingresos_por_email.get(f["email"], 0) for f in ventas)
        gasto = int(c.get("gasto_cents") or 0)
        filas.append(
            {
                **c,
                "leads": leads,
                "matriculas": matriculas,
                "ventas": len(ventas),
                "ingresos_cents": ingresos,
                "coste_por_lead_cents": round(gasto / leads) if gasto and leads else None,
                "coste_por_venta_cents": round(gasto / len(ventas)) if gasto and ventas else None,
                # Por cada euro gastado, cuántos entraron.
                "retorno": round(ingresos / gasto, 2) if gasto else None,
                "personas": [
                    {"email": f["email"], "nombre": f.get("nombre", ""), "etapa": f.get("etapa", ""), "when": (f.get("primer_contacto") or {}).get("when", "")}
                    for f in sorted(gente, key=lambda f: (f.get("primer_contacto") or {}).get("when", ""), reverse=True)
                ],
            }
        )

    sueltas = [
        {"utm_campaign": utm, "leads": len(gente), "ventas": sum(1 for f in gente if f.get("etapa") == "alumno")}
        for utm, gente in por_utm.items()
        if utm not in conocidas
    ]
    sueltas.sort(key=lambda s: s["leads"], reverse=True)

    gasto_total = sum(int(c.get("gasto_cents") or 0) for c in campanas)
    ingresos_total = sum(f["ingresos_cents"] for f in filas)
    return {
        "campanas": filas,
        "sin_apuntar": sueltas,
        "total": {
            "gasto_cents": gasto_total,
            "leads": sum(f["leads"] for f in filas),
            "ventas": sum(f["ventas"] for f in filas),
            "ingresos_cents": ingresos_total,
            "retorno": round(ingresos_total / gasto_total, 2) if gasto_total else None,
        },
    }


def a_dict(c: AdCampaign) -> dict:
    return {
        "id": c.id,
        "nombre": c.nombre,
        "plataforma": c.plataforma,
        "utm_campaign": c.utm_campaign,
        "inicio": c.inicio,
        "fin": c.fin,
        "gasto_cents": c.gasto_cents,
        "notas": c.notas,
    }


async def listar(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (
        await db_session.execute(select(AdCampaign).where(AdCampaign.org_id == org_id).order_by(AdCampaign.inicio.desc(), AdCampaign.id.desc()))  # type: ignore[attr-defined]
    ).scalars().all()
    return [a_dict(c) for c in filas]


async def panel_ads(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
    from src.services.contactos.metricas import emails_excluidos

    fuera = await emails_excluidos(db_session)
    fichas = [
        f
        for f in fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
        if f["email"] not in fuera
    ]
    ingresos: dict[str, int] = {}
    for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all():
        e = _clave(r.email)
        ingresos[e] = ingresos.get(e, 0) + int(r.amount_cents or 0)
    datos = metricas(await listar(org_id, db_session), fichas, ingresos)
    datos["plataformas"] = PLATAFORMAS
    return datos


def _fecha(texto: str) -> str:
    texto = (texto or "").strip()[:10]
    try:
        datetime.strptime(texto, "%Y-%m-%d")
        return texto
    except ValueError:
        return ""


async def guardar(org_id: int, data: dict, db_session: AsyncSession, campana_id: Optional[int] = None) -> dict:
    if campana_id is not None:
        c = (
            await db_session.execute(select(AdCampaign).where(AdCampaign.id == campana_id, AdCampaign.org_id == org_id))
        ).scalars().first()
        if c is None:
            return {"ok": False, "motivo": "No existe esa campaña"}
    else:
        c = AdCampaign(org_id=org_id, created_at=datetime.now(timezone.utc).isoformat())
    if "nombre" in data:
        c.nombre = (data.get("nombre") or "").strip()[:200]
    if "plataforma" in data:
        c.plataforma = data.get("plataforma") if data.get("plataforma") in PLATAFORMAS else "otro"
    if "utm_campaign" in data:
        c.utm_campaign = (data.get("utm_campaign") or "").strip()[:120]
    if "inicio" in data:
        c.inicio = _fecha(data.get("inicio") or "")
    if "fin" in data:
        c.fin = _fecha(data.get("fin") or "")
    if "gasto" in data and data.get("gasto") is not None:
        c.gasto_cents = max(0, int(round(float(data["gasto"]) * 100)))
    if "notas" in data:
        c.notas = (data.get("notas") or "").strip()[:1000]
    if not c.nombre:
        return {"ok": False, "motivo": "La campaña necesita un nombre"}
    if not c.utm_campaign:
        return {"ok": False, "motivo": "Falta el utm_campaign: es lo que une la campaña con sus leads"}
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return {"ok": True, "campana": a_dict(c)}


async def borrar(org_id: int, campana_id: int, db_session: AsyncSession) -> bool:
    c = (
        await db_session.execute(select(AdCampaign).where(AdCampaign.id == campana_id, AdCampaign.org_id == org_id))
    ).scalars().first()
    if c is None:
        return False
    await db_session.delete(c)
    await db_session.commit()
    return True

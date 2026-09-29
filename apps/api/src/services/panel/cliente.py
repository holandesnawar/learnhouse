"""
La ficha completa de una persona, para indagar sin saltar de pantalla en
pantalla: quién es, en qué columna del tablero está, qué páginas vio, qué
correos le mandó la escuela, qué pagó, qué ha apuntado el equipo y qué tareas
hay pendientes con ella. Todo en una sola llamada.

La línea de tiempo se monta con una función pura (`linea_de_tiempo`), con test.
"""

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.panel_negocio import EmailLog, LeadPipeline
from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
from src.services.contactos.seguimiento import seguimiento_de
from src.services.panel import tareas as tareas_srv
from src.services.panel.pipeline import colocar
from src.services.payments.solicitudes import _NOMBRES as NOMBRES_PAGINA


def paginas_vistas(ficha: dict) -> list[dict]:
    """Las páginas de la web por las que pasó, en orden y sin repetir, con su
    nombre en cristiano y si enseñan el precio."""
    vistas: list[str] = []
    for ev in ficha.get("eventos") or []:
        for p in (ev.get("recorrido") or "").split(","):
            p = p.strip()
            if p and p not in vistas:
                vistas.append(p)
    return [{"id": p, "nombre": NOMBRES_PAGINA.get(p, p), "precio": p == "landing-precio"} for p in vistas]


def linea_de_tiempo(eventos: list[dict], correos: list[dict], notas: list[dict], tareas: list[dict]) -> list[dict]:
    """Todo lo que ha pasado con esta persona, lo más reciente arriba."""
    items: list[dict] = []
    for e in eventos:
        items.append({"tipo": "evento", "cuando": e.get("when", ""), "texto": e.get("que", ""), "kind": e.get("kind", "")})
    for c in correos:
        items.append({"tipo": "correo", "cuando": c.get("created_at", ""), "texto": c.get("asunto", ""), "ok": c.get("ok", True)})
    for n in notas:
        items.append({"tipo": "nota", "cuando": n.get("created_at", ""), "texto": n.get("texto", ""), "autor": n.get("autor", "")})
    for t in tareas:
        items.append({"tipo": "tarea", "cuando": t.get("created_at", ""), "texto": t.get("titulo", ""), "estado": t.get("estado", ""), "autor": t.get("asignado", "")})
    items.sort(key=lambda i: str(i.get("cuando") or ""), reverse=True)
    return items


async def ficha_cliente(email: str, user_id: int, es_admin: bool, db_session: AsyncSession) -> dict | None:
    clave = (email or "").strip().lower()
    if not clave:
        return None
    eventos = [e for e in await _todos_los_eventos(db_session) if e["email"] == clave]
    if not eventos:
        return None
    ficha = fusionar_contactos(eventos, await _emails_con_cuenta(db_session))[0]

    from src.services.contactos.metricas import emails_excluidos

    ficha["fuera_de_metricas"] = clave in await emails_excluidos(db_session)

    guardada = (
        await db_session.execute(select(LeadPipeline).where(LeadPipeline.email == clave))
    ).scalars().first()
    tablero = colocar(
        ficha,
        {"etapa": guardada.etapa, "canal": guardada.canal, "motivo": guardada.motivo, "updated_at": guardada.updated_at, "updated_by": guardada.updated_by}
        if guardada
        else None,
    )

    pagos = [
        {
            "fecha": r.paid_at or r.updated_at or r.created_at,
            "importe_cents": r.amount_cents or 0,
            "moneda": r.currency or "eur",
            "producto": r.product or "",
        }
        for r in (
            await db_session.execute(select(Enrollment).where(func.lower(Enrollment.email) == clave))
        ).scalars().all()
        if r.status == "paid"
    ]
    pagos.sort(key=lambda p: str(p["fecha"] or ""), reverse=True)

    correos = [
        {"asunto": c.asunto, "ok": c.ok, "created_at": c.created_at}
        for c in (
            await db_session.execute(
                select(EmailLog).where(EmailLog.email == clave).order_by(EmailLog.id.desc()).limit(100)  # type: ignore[attr-defined]
            )
        ).scalars().all()
    ]

    # Las etiquetas de systeme.io (en qué campaña de correos está), solo para
    # administradores: al closer no le sirven y es una llamada de fuera.
    crm = None
    if es_admin:
        from src.services.contactos.contactos import etiquetas_en_systeme

        crm = await etiquetas_en_systeme(clave)

    seg = await seguimiento_de(clave, db_session)
    tareas = await tareas_srv.listar(db_session, user_id, es_admin, email=clave)

    # Sus llamadas de Calendly (pasadas y próximas) con lo que pasó en cada
    # una. En blando: si Calendly no contesta, la ficha sale igual.
    llamadas: list[dict] = []
    try:
        from src.services.contactos.agenda import agenda
        from src.services.contactos.resultado_llamada import resultados

        hechos = await resultados(db_session)
        llamadas = [
            {**c, "resultado": hechos.get(c.get("id") or "")}
            for c in (await agenda()).get("citas") or []
            if c.get("email") == clave
        ]
    except Exception:  # noqa: BLE001
        llamadas = []

    return {
        "email": clave,
        "nombre": ficha["nombre"],
        "telefono": ficha["telefono"],
        "etapa_contacto": ficha["etapa"],
        "tablero": tablero,
        "vio_precio": ficha["vio_precio"],
        "vino_de": ficha["vino_de"],
        "utm": {"source": ficha["utm_source"], "medium": ficha["utm_medium"], "campaign": ficha["utm_campaign"]},
        "etiquetas": ficha["etiquetas"],
        "fuera_de_metricas": ficha["fuera_de_metricas"],
        "primer_contacto": ficha["primer_contacto"],
        "paginas": paginas_vistas(ficha),
        "pagos": pagos,
        "total_pagado_cents": sum(p["importe_cents"] for p in pagos),
        "correos": correos,
        "notas": seg.get("notas", []),
        "volver_a_llamar": seg.get("volver_a_llamar"),
        "tareas": tareas,
        "llamadas": llamadas,
        "systeme": crm,
        "linea": linea_de_tiempo(ficha["eventos"], correos, seg.get("notas", []), tareas),
    }

"""
El tablero de Matrículas con todo lo que enseña cada tarjeta.

Sale de `routers/panel.py::api_tablero` (26/11/2026) para que lo usen dos
puertas sin contarlo dos veces: la pantalla del equipo y el asistente de
ventas (`routers/asistente_ventas.py`). Lo que decide quién ve qué (el
alcance de cada closer) NO va aquí: lo aplica cada puerta después.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
from src.services.contactos.metricas import emails_excluidos
from src.services.panel import ads, pipeline, tareas


async def datos_tablero(org_id: int, user_id: int, db_session: AsyncSession) -> dict:
    """Columnas y tarjetas, con notas, volver a llamar, señal y tareas.

    `user_id`: de quién se cuentan las tareas pendientes de cada persona
    (las que ve esa cuenta, como en la pantalla)."""
    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    fuera = await emails_excluidos(db_session)
    for f in fichas:
        f["fuera_de_metricas"] = f["email"] in fuera
    datos = await pipeline.tablero(fichas, db_session, await ads.leer_nombres(org_id, db_session))
    # Volver a llamar: la fecha y el motivo, para «Llamar hoy» en la tarjeta.
    from src.services.contactos.seguimiento import todos_los_recordatorios

    recordatorios = await todos_los_recordatorios(db_session)
    # Cuántas tareas pendientes tiene cada persona, para la tarjeta.
    pendientes: dict[str, int] = {}
    for t in await tareas.listar(db_session, user_id, True, solo_pendientes=True):
        if t["email"]:
            pendientes[t["email"]] = pendientes.get(t["email"], 0) + 1
    # Notas del equipo: cuántas y la última (28/09).
    from src.db.contact_seguimiento import ContactNota

    notas: dict[str, dict] = {}
    for n in (await db_session.execute(select(ContactNota).order_by(ContactNota.created_at))).scalars().all():
        clave = (n.email or "").strip().lower()
        d = notas.setdefault(clave, {"n": 0, "ultima": ""})
        d["n"] += 1
        d["ultima"] = (n.texto or "")[:160]
    # Plaza reservada con señal: cuánto lleva y cuánto le falta (06/10).
    from src.services.payments.reservas import reservas_abiertas

    reservas = {r["email"]: r for r in await reservas_abiertas(db_session)}
    for c in datos["tarjetas"]:
        r = reservas.get(c["email"])
        c["reserva"] = (
            {"pagado_cents": r["pagado_cents"], "total_cents": r["total_cents"], "pendiente_cents": r["pendiente_cents"]}
            if r
            else None
        )
        c["tareas"] = pendientes.get(c["email"], 0)
        if c.get("suelta") and not c["email"]:
            # Sin correo, las notas viven en su fila de Llamadas.
            c["notas"] = (c.get("llamada") or {}).get("n_notas", 0)
            c["ultima_nota"] = ((c.get("llamada") or {}).get("ultima_nota") or "")[:160]
        else:
            c["notas"] = notas.get(c["email"], {}).get("n", 0)
            c["ultima_nota"] = notas.get(c["email"], {}).get("ultima", "")
        r = recordatorios.get(c["email"]) if c["email"] else None
        c["volver_a_llamar"] = r if r and c["etapa"] != "alumno" else None
    return datos

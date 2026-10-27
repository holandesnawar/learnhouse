"""«Confirmada» (27/10/2026): la persona ha dicho que viene a su llamada. Se
guarda una vez por cita, se quita, sale en su ficha y los KPIs comparan el
no-show de las confirmadas con el de las que no."""

from datetime import datetime, timezone

from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.services.contactos import confirmar_llamada as C
from src.services.contactos.contactos import _evento, _que, fusionar_contactos
from src.services.stats.kpis import calcular


async def test_confirmar_una_vez_por_cita_y_quitar(db):
    r = await C.confirmar("ev1:ana@x.com", "Ana@x.com", "Ana López", "2026-10-29T17:00:00Z", "Diego", db)
    assert r["ok"] and r["confirmada"]["autor"] == "Diego"
    # Otra vez la misma cita (otro del equipo): no se duplica.
    await C.confirmar("ev1:ana@x.com", "ana@x.com", "Ana López", "2026-10-29T17:00:00Z", "Rida", db)
    filas = (await db.execute(select(ContactEvent).where(ContactEvent.kind == C.KIND))).scalars().all()
    assert len(filas) == 1 and filas[0].email == "ana@x.com" and filas[0].first_name == "Ana"
    assert await C.confirmadas(db) == {"ev1:ana@x.com": {"autor": "Rida", "cuando": filas[0].created_at}}

    await C.confirmar("ev2:luis@x.com", "luis@x.com", "", "", "Diego", db)
    assert set(await C.confirmadas(db)) == {"ev1:ana@x.com", "ev2:luis@x.com"}
    assert (await C.quitar("ev1:ana@x.com", db))["quitadas"] == 1
    assert set(await C.confirmadas(db)) == {"ev2:luis@x.com"}

    assert not (await C.confirmar("", "ana@x.com", "", "", "Diego", db))["ok"]
    assert not (await C.confirmar("ev3", "sin-arroba", "", "", "Diego", db))["ok"]


def test_en_la_ficha():
    ev = _evento("llamada-confirmada", "2026-10-28T10:00:00+00:00", "ana@x.com",
                 extra={"cita_id": "ev1", "inicio": "2026-10-29T17:00:00Z", "autor": "Diego"})
    texto = _que("llamada-confirmada", {"extra": ev["extra"]})
    assert texto.startswith("Confirmó que viene a su llamada del ") and "18:00" in texto
    assert texto.endswith("(lo apuntó Diego)")
    assert C.ids_confirmadas(fusionar_contactos([ev], set())) == {"ev1"}


def test_kpis_no_show_con_y_sin_confirmar():
    def cita(email, inicio, cid):
        return {"id": cid, "email": email, "inicio": inicio, "reservada": "2026-10-26T10:00:00Z", "estado": "activa"}

    citas = [
        cita("a@x.com", "2026-10-28T16:00:00Z", "c-a"),  # confirmada, vino
        cita("b@x.com", "2026-10-28T17:00:00Z", "c-b"),  # confirmada, no vino
        cita("c@x.com", "2026-10-29T16:00:00Z", "c-c"),  # sin confirmar, no vino
        cita("d@x.com", "2026-10-29T17:00:00Z", "c-d"),  # sin confirmar, no vino
        cita("e@x.com", "2026-10-29T18:00:00Z", "c-e"),  # sin confirmar, vino
        cita("f@x.com", "2026-10-20T16:00:00Z", "c-f"),  # antes de poder confirmar: no compara
    ]
    resultados = [
        {"cita_id": "c-a", "email": "a@x.com", "resultado": "compra", "inicio": citas[0]["inicio"]},
        {"cita_id": "c-b", "email": "b@x.com", "resultado": "no-vino", "inicio": citas[1]["inicio"]},
        {"cita_id": "c-c", "email": "c@x.com", "resultado": "no-vino", "inicio": citas[2]["inicio"]},
        {"cita_id": "c-d", "email": "d@x.com", "resultado": "no-vino", "inicio": citas[3]["inicio"]},
        {"cita_id": "c-e", "email": "e@x.com", "resultado": "piensa", "inicio": citas[4]["inicio"]},
        {"cita_id": "c-f", "email": "f@x.com", "resultado": "no-vino", "inicio": citas[5]["inicio"]},
    ]
    ev = [_evento("reunion", "2026-10-26T10:00:00+00:00", c["email"]) for c in citas]
    ev += [
        _evento("llamada-confirmada", "2026-10-27T10:00:00+00:00", "a@x.com", extra={"cita_id": "c-a"}),
        _evento("llamada-confirmada", "2026-10-27T10:00:00+00:00", "b@x.com", extra={"cita_id": "c-b"}),
    ]
    k = calcular(
        fichas=fusionar_contactos(ev, set()), citas=citas, resultados=resultados, pagaron=set(), fuera=set(),
        visitas=[], ventas=[], plazos_emails=set(), desde="2026-10-15", hasta="2026-10-30",
        ahora=datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc),
    )
    conf = k["llamadas"]["confirmacion"]
    assert conf["confirmadas"] == 2
    assert conf["si"] == {"con_resultado": 2, "no_vino": 1, "pct_no_show": 50.0}
    assert conf["no"] == {"con_resultado": 3, "no_vino": 2, "pct_no_show": 66.7}

"""La comisión del closer, pagada o pendiente (27/10/2026): lo que le toca a
cada venta, el resumen por closer, marcar y desmarcar, y que en Clientes solo
cuenten como pendientes las ventas que pasaron por una llamada."""

from sqlmodel import select

from src.db.comision_closer import ComisionCloser
from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment
from src.db.plan_pagos import PlanPagos
from src.services.panel import comisiones as K

TRAMOS = [{"desde": "", "pct": 10.0}, {"desde": "2026-10-16", "pct": 15.0}]


def test_lo_que_le_toca_va_por_el_dia_en_que_se_cobro():
    assert K.estimada(43500, "2026-10-20T10:00:00", TRAMOS) == 6525  # 15 %
    assert K.estimada(39700, "2026-10-10", TRAMOS) == 3970  # 10 %
    assert K.estimada(0, "2026-10-20", TRAMOS) == 0
    assert K.estimada(43500, "2026-10-20", []) == 0


def test_sobre_el_total_de_la_venta_tambien_a_plazos():
    # Pago único: lo cobrado. A plazos: el total del plan, aunque falten pagos.
    assert K.base_de({"total_cents": 43500}) == 43500
    assert K.base_de({"total_cents": 16567, "plazos": {"total_cents": 49700}}) == 49700
    assert K.base_de({"total_cents": 54000, "plazos": {"total_cents": 54000}}) == 54000
    por, _ = K.estado_de(
        [{"email": "pl@x.com", "total_cents": 16567, "primer_pago": "2026-10-20", "plazos": {"total_cents": 49700}}],
        {},
        {"pl@x.com"},
        {},
        TRAMOS,
    )
    assert por["pl@x.com"]["base_cents"] == 49700
    assert por["pl@x.com"]["pct"] == 15.0
    assert por["pl@x.com"]["estimada_cents"] == 7455  # 15 % de 497 €, no de 165,67 €


def test_los_porcentajes_para_elegir():
    assert K.porcentajes(TRAMOS) == [10.0, 15.0]
    assert K.porcentajes([]) == [10.0, 15.0]
    assert K.porcentajes([{"desde": "", "pct": 12}]) == [12.0]


def test_resumen_por_closer_solo_con_las_de_llamada():
    clientes = [
        {"email": "ana@x.com", "total_cents": 43500, "primer_pago": "2026-10-20"},
        {"email": "bea@x.com", "total_cents": 43500, "primer_pago": "2026-10-21"},
        {"email": "luis@x.com", "total_cents": 43500, "primer_pago": "2026-10-21"},  # compró sin llamada
        {"email": "eva@x.com", "total_cents": 39700, "primer_pago": "2026-10-01"},
    ]
    pagadas = {"bea@x.com": {"importe_cents": 6000, "cuando": "2026-10-25T10:00:00", "por": "Rida"}}
    por, resumen = K.estado_de(clientes, pagadas, {"ana@x.com", "eva@x.com"}, {"bea@x.com": "Diego Ruiz"}, TRAMOS)
    assert por["ana@x.com"]["pagada"] is None and por["ana@x.com"]["estimada_cents"] == 6525
    assert por["luis@x.com"]["con_llamada"] is False
    assert por["bea@x.com"]["con_llamada"] is True  # tiene closer asignado
    sin = next(r for r in resumen if r["closer"] == K.SIN_CLOSER)
    assert sin["pendientes"] == 2 and sin["pendiente_cents"] == 6525 + 3970 and sorted(sin["emails"]) == ["ana@x.com", "eva@x.com"]
    diego = next(r for r in resumen if r["closer"] == "Diego Ruiz")
    assert diego["pendientes"] == 0 and diego["pagadas"] == 1 and diego["pagado_cents"] == 6000
    # El de más pendientes, arriba.
    assert resumen[0]["closer"] == K.SIN_CLOSER


async def test_marcar_y_desmarcar(db):
    r = await K.marcar("Ana@x.com", 6525, "Rida", db)
    assert r["ok"] and r["pagada"]["importe_cents"] == 6525 and r["pagada"]["por"] == "Rida"
    # Otra vez: se reescribe, no se duplica.
    await K.marcar("ana@x.com", 6000, "Rida", db, nota="Bizum")
    filas = (await db.execute(select(ComisionCloser))).scalars().all()
    assert len(filas) == 1 and filas[0].importe_cents == 6000 and filas[0].nota == "Bizum"
    assert (await K.pagadas(db))["ana@x.com"]["importe_cents"] == 6000
    assert (await K.desmarcar("ana@x.com", db))["quitadas"] == 1
    assert await K.pagadas(db) == {}
    assert not (await K.marcar("sin-arroba", 100, "Rida", db))["ok"]


async def test_en_clientes(db, org):
    from src.services.panel.clientes import listar_clientes

    for email, importe, dia in (("ana@x.com", 43500, "2026-10-20"), ("luis@x.com", 43500, "2026-10-21")):
        db.add(Enrollment(email=email, first_name=email[:3], status="paid", amount_cents=importe, paid_at=f"{dia}T10:00:00"))
    db.add(ContactEvent(email="ana@x.com", kind="reunion", created_at="2026-10-18T10:00:00"))
    await db.commit()

    datos = await listar_clientes(db, org.id)
    por = {c["email"]: c["comision"] for c in datos["clientes"]}
    assert por["ana@x.com"]["con_llamada"] is True and por["ana@x.com"]["estimada_cents"] == 6525
    assert por["luis@x.com"]["con_llamada"] is False
    assert datos["comisiones"][0]["pendientes"] == 1
    assert datos["porcentajes_comision"]  # los de Visión, o 10 y 15

    # A plazos: sobre el total del plan, no sobre el primer pago.
    db.add(Enrollment(email="pl@x.com", first_name="Pl", status="paid", amount_cents=16567, paid_at="2026-10-22T10:00:00"))
    db.add(PlanPagos(email="pl@x.com", stripe_subscription_id="sub_1", cuotas=3, cuota_cents=16567, total_cents=49700, cuotas_pagadas=1, pagado_cents=16567))
    await db.commit()
    datos = await listar_clientes(db, org.id)
    pl = next(c for c in datos["clientes"] if c["email"] == "pl@x.com")["comision"]
    assert pl["base_cents"] == 49700 and pl["estimada_cents"] == round(49700 * pl["pct"] / 100)

    await K.marcar("ana@x.com", 6525, "Rida", db)
    datos = await listar_clientes(db, org.id)
    assert next(c for c in datos["clientes"] if c["email"] == "ana@x.com")["comision"]["pagada"]["importe_cents"] == 6525
    assert datos["comisiones"][0]["pendientes"] == 0 and datos["comisiones"][0]["pagado_cents"] == 6525
    # Sin org_id (otras llamadas internas), sin comisión.
    assert "comision" not in (await listar_clientes(db))["clientes"][0]

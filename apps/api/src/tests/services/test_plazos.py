"""Plan de pagos propio en 3 plazos (14/10/2026): acceso con el primer pago,
cada cobro cuenta una vez, la suscripción se corta sola al tercero y un cobro
fallido avisa al equipo una sola vez. Stripe es de mentira: no se toca nada."""

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.enrollment import Enrollment, EnrollmentCreate
from src.db.plan_pagos import PlanPagos
from src.services.payments import payments as P
from src.services.payments import plazos as Z


# ── lógica pura ────────────────────────────────────────────────────────────


def test_un_cobro_cuenta_una_sola_vez():
    f = Z.anotar_cobro({}, "in_1", 14500, "2026-10-14")
    f = Z.anotar_cobro(f, "in_1", 14500, "2026-10-15")  # el mismo, por otro aviso
    f = Z.anotar_cobro(f, "in_2", 14500, "2026-11-14")
    f = Z.anotar_cobro(f, "", 14500, "x")  # sin factura no se apunta
    f = Z.anotar_cobro(f, "in_3", 0, "x")  # sin importe tampoco
    assert Z.cifras(f) == (2, 29000)


def test_estado_del_plan():
    assert Z.estado_del_plan(pagadas=1, cuotas=3) == "activo"
    assert Z.estado_del_plan(pagadas=1, cuotas=3, estado_stripe="past_due") == "fallido"
    assert Z.estado_del_plan(pagadas=1, cuotas=3, fallida=True) == "fallido"
    assert Z.estado_del_plan(pagadas=2, cuotas=3, estado_stripe="canceled") == "cancelado"
    # Pagado entero gana a todo (al terminar Stripe la cancela, y eso está bien).
    assert Z.estado_del_plan(pagadas=3, cuotas=3, estado_stripe="canceled") == "completado"


def test_la_suscripcion_de_una_factura_en_las_dos_formas_de_la_api():
    assert Z.suscripcion_de_factura({"subscription": "sub_viejo"}) == "sub_viejo"
    nueva = {"parent": {"subscription_details": {"subscription": "sub_nuevo"}}}
    assert Z.suscripcion_de_factura(nueva) == "sub_nuevo"
    assert Z.suscripcion_de_factura({}) == ""


def test_texto_del_fallo():
    t = Z.texto_fallo(2, 3, 14500, 1794787200)  # 16/11/2026
    assert "pago 2 de 3 (145 €)" in t and "16/11/2026" in t
    assert "ya no lo va a reintentar" in Z.texto_fallo(3, 3, 14500, None)


def test_condiciones_de_serie():
    assert Z.condiciones() == {"cuotas": 3, "cuota_cents": 14500, "ultima_cents": 14500, "total_cents": 43500, "moneda": "eur"}


def test_497_en_tres_cuotas_sin_perder_un_centimo():
    # 19/10: "en pago a plazos elegir el total, 435 o 497 €".
    assert Z.reparto(49700, 3) == [16567, 16567, 16566] and sum(Z.reparto(49700, 3)) == 49700
    assert Z.reparto(43500, 3) == [14500, 14500, 14500]
    assert Z.tramos([16567, 16567, 16566]) == [(16567, 2), (16566, 1)]
    assert Z.tramos([14500, 14500, 14500]) == [(14500, 3)]
    assert Z.totales() == [43500, 49700]
    # Solo los totales ofrecidos: otro cualquiera (o ninguno) es el de serie.
    assert Z.total_valido(49700) == 49700
    assert Z.total_valido(12345) == Z.total_valido(None) == Z.total_valido("x") == 43500
    assert Z.condiciones(49700) == {"cuotas": 3, "cuota_cents": 16567, "ultima_cents": 16566, "total_cents": 49700, "moneda": "eur"}


# ── un Stripe de mentira ───────────────────────────────────────────────────


class StripeFalso:
    def __init__(self, *, precio_existe=False, ideal_falla=False):
        self.precios_creados, self.sesiones, self.calendarios, self.modificados = [], [], [], []
        self.suscripcion = {"id": "sub_1", "status": "active", "schedule": None, "items": {"data": [{"current_period_end": 1794787200}]}}
        self.facturas = []
        precio_existe_ = precio_existe

        def _id_de(clave):
            # 145 € es "price_plazos" (el de siempre); otro importe, el suyo.
            return "price_plazos" if clave.endswith("-14500-mes") else "price_" + clave.split("-")[-2]

        def listar_precios(lookup_keys=(), **kw):
            clave = list(lookup_keys)[0]
            hay = any(p["lookup_key"] == clave for p in self.precios_creados) or (precio_existe_ and clave.endswith("-14500-mes"))
            return {"data": [{"id": _id_de(clave)}]} if hay else {"data": []}

        def crear_precio(**kw):
            self.precios_creados.append(kw)
            return {"id": _id_de(kw["lookup_key"])}

        def crear_sesion(**kw):
            if ideal_falla and "ideal" in kw["payment_method_types"]:
                raise RuntimeError("ideal no vale en suscripciones")
            self.sesiones.append(kw)
            return {"id": "cs_plazos", "client_secret": "cs_plazos_secret"}

        def crear_calendario(from_subscription):
            self.suscripcion["schedule"] = "sub_sched_1"
            # La fase de ahora lleva el precio con el que se pagó el primero.
            precio = self.sesiones[-1]["line_items"][0]["price"] if self.sesiones else "price_plazos"
            return {"id": "sub_sched_1", "phases": [{"start_date": 1792108800, "items": [{"price": precio, "quantity": 1}]}]}

        self.Price = SimpleNamespace(
            list=listar_precios, create=crear_precio,
            retrieve=lambda pid: {"id": pid, "product": "prod_formacion", "currency": "eur", "unit_amount": 39700},
        )
        self.Customer = SimpleNamespace(create=lambda **kw: {"id": "cus_1"})
        self.checkout = SimpleNamespace(Session=SimpleNamespace(create=crear_sesion, expire=lambda sid: None))
        self.Subscription = SimpleNamespace(
            retrieve=lambda sid: self.suscripcion,
            modify=lambda sid, **kw: self.modificados.append(kw),
        )
        self.SubscriptionSchedule = SimpleNamespace(
            create=crear_calendario,
            modify=lambda sid, **kw: self.calendarios.append(kw),
        )
        self.Invoice = SimpleNamespace(list=lambda **kw: {"data": self.facturas})
        self.PaymentIntent = SimpleNamespace(retrieve=lambda pid: {"status": "succeeded"}, cancel=lambda pid: None)


def _con_stripe(falso):
    async def abierta(_db):
        return None

    return [
        patch.dict("sys.modules", {"stripe": falso}),
        patch.object(P, "_usar_stripe", lambda: None),
        patch.object(P, "_stripe_publishable", lambda: "pk_test"),
        patch.object(P, "_formacion_price_id", lambda: "price_formacion"),
        patch.object(P, "ensure_matricula_abierta", abierta),
        patch.object(P, "_academy_url", lambda: "https://escuela.test"),
        patch.object(Z, "_PRECIO", {}),
    ]


class _Varios:
    def __init__(self, parches):
        self.parches = parches

    def __enter__(self):
        for p in self.parches:
            p.__enter__()

    def __exit__(self, *a):
        for p in reversed(self.parches):
            p.__exit__(*a)


def _pedido(email="ana@x.com"):
    return EnrollmentCreate(email=email, first_name="Ana", last_name="Gil", phone="+31 6 1",
                            utm_source="equipo", utm_medium="enlace-pago", recorrido=["enlace-pago"])


# ── abrir el enlace ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_abrir_crea_el_precio_en_el_mismo_producto_y_una_suscripcion(db, org):
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "Zulay", db)

    precio = falso.precios_creados[0]
    assert precio["product"] == "prod_formacion" and precio["unit_amount"] == 14500
    assert precio["recurring"] == {"interval": "month"}
    sesion = falso.sesiones[0]
    assert sesion["mode"] == "subscription" and sesion["line_items"] == [{"price": "price_plazos", "quantity": 1}]
    assert "klarna" not in sesion["payment_method_types"]
    assert sesion["metadata"]["plan"] == "plazos" and sesion["metadata"]["autor"] == "Zulay"
    assert "cuotas=3" in r["payment_url"] and "amt=14500" in r["payment_url"]
    fila = (await db.execute(select(Enrollment))).scalars().one()
    assert fila.status == "pending" and fila.stripe_session_id == "cs_plazos"
    assert sesion["metadata"]["enrollment_id"] == str(fila.id)

    # El segundo enlace ya no crea otro precio: lo encuentra.
    with _Varios(_con_stripe(falso)):
        await Z.abrir_plazos(_pedido(), "Zulay", db)
    assert len(falso.precios_creados) == 1


@pytest.mark.asyncio
async def test_si_ideal_no_vale_en_suscripciones_queda_la_tarjeta(db, org):
    falso = StripeFalso(precio_existe=True, ideal_falla=True)
    with _Varios(_con_stripe(falso)):
        await Z.abrir_plazos(_pedido(), "", db)
    assert falso.sesiones[0]["payment_method_types"] == ["card"]


@pytest.mark.asyncio
async def test_a_un_alumno_o_a_quien_ya_tiene_plan_no_se_le_abre_otro(db, org):
    db.add(Enrollment(email="ya@x.com", status="paid", created_at="2026-10-01"))
    db.add(PlanPagos(email="plan@x.com", stripe_subscription_id="sub_9", estado="activo"))
    await db.commit()
    falso = StripeFalso(precio_existe=True)
    with _Varios(_con_stripe(falso)):
        for correo in ("ya@x.com", "plan@x.com"):
            with pytest.raises(HTTPException) as e:
                await Z.abrir_plazos(_pedido(correo), "", db)
            assert e.value.status_code == 409
    assert falso.sesiones == []


# ── el primer cobro ────────────────────────────────────────────────────────


async def _primer_pago(db, falso, veces=1, total=None, n=None, medida=None):
    with _Varios(_con_stripe(falso)):
        await Z.abrir_plazos(_pedido(), "Zulay", db, total_cents=total, n_cuotas=n, medida=medida)
    fila = (await db.execute(select(Enrollment))).scalars().one()
    meta = falso.sesiones[-1]["metadata"]
    if medida:
        primera = Z.condiciones_de(*medida)["cuota_cents"]
    elif n:
        primera = Z.condiciones_de(n, Z.OPCIONES[n])["cuota_cents"]
    else:
        primera = Z.condiciones(total)["cuota_cents"]
    sesion = {
        "id": "cs_plazos", "mode": "subscription", "payment_status": "paid", "amount_total": primera,
        "currency": "eur", "subscription": "sub_1", "invoice": "in_1", "customer": "cus_1",
        # Los metadatos que se pusieron al abrir (con el total desde el 19/10).
        "metadata": {**meta, "enrollment_id": str(fila.id)},
    }
    altas = []

    async def provision(email, name, db_session, ya_atendida=False):
        if not ya_atendida:
            altas.append(email)
        return {"atendida_ahora": not ya_atendida}

    with _Varios(_con_stripe(falso)), patch.object(P, "_provision_after_payment", provision):
        for _ in range(veces):
            await P._handle_checkout_session(sesion, db)
    return fila, altas


@pytest.mark.asyncio
async def test_con_el_primer_pago_entra_y_stripe_corta_al_tercero(db, org):
    falso = StripeFalso()
    fila, altas = await _primer_pago(db, falso, veces=2)  # el aviso, entregado dos veces

    assert altas == ["ana@x.com"]  # acceso desde el primer pago, una vez
    await db.refresh(fila)
    assert fila.status == "paid" and fila.amount_cents == 14500
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.cuotas_pagadas == 1 and plan.pagado_cents == 14500 and plan.estado == "activo"
    assert plan.enrollment_id == fila.id and plan.creado_por == "Zulay"
    # El calendario: 3 meses y se cancela al acabar.
    assert len(falso.calendarios) == 1
    cal = falso.calendarios[0]
    assert cal["end_behavior"] == "cancel"
    assert cal["phases"][0]["duration"] == {"interval": "month", "interval_count": 3}
    assert cal["phases"][0]["items"] == [{"price": "price_plazos", "quantity": 1}]
    assert plan.stripe_schedule_id == "sub_sched_1"
    # Ocupa plaza como cualquier alumno.
    assert (await P.get_seat_status(db))["ocupadas"] == 1


@pytest.mark.asyncio
async def test_los_cobros_dos_y_tres_y_el_fin(db, org):
    falso = StripeFalso()
    fila, _ = await _primer_pago(db, falso)
    factura = lambda i: {"id": f"in_{i}", "amount_paid": 14500, "status_transitions": {"paid_at": 1794787200},
                         "parent": {"subscription_details": {"subscription": "sub_1"}}}

    await Z.atender_factura(factura(1), True, db)  # la primera otra vez: no suma
    await Z.atender_factura(factura(2), True, db)
    await Z.atender_factura(factura(2), True, db)  # invoice.paid + invoice.payment_succeeded
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.cuotas_pagadas == 2 and plan.estado == "activo"
    await db.refresh(fila)
    assert fila.amount_cents == 29000  # las estadísticas ven lo cobrado

    await Z.atender_factura(factura(3), True, db)
    await db.refresh(plan)
    await db.refresh(fila)
    assert plan.estado == "completado" and plan.pagado_cents == 43500 and plan.completado_at
    assert fila.amount_cents == 43500


@pytest.mark.asyncio
async def test_un_cobro_fallido_avisa_una_vez_y_no_quita_el_acceso(db, org):
    falso = StripeFalso()
    fila, _ = await _primer_pago(db, falso)
    avisos = []

    al_alumno = []

    def correo(destino, datos):
        avisos.append((destino, datos["numero"], datos["alumno_avisado"]))

    def correo_alumno(destino, datos):
        al_alumno.append((destino, datos))

    async def admins(_db):
        return ["jefa@x.com"]

    fallo = {"id": "in_2", "amount_due": 14500, "next_payment_attempt": 1794787200, "subscription": "sub_1",
             "hosted_invoice_url": "https://invoice.stripe.com/i/in_2"}
    with patch("src.services.users.emails.send_plazo_fallido_email", correo), patch(
        "src.services.users.emails.send_plazo_fallido_alumno_email", correo_alumno
    ), patch("src.services.contactos.llamadas.emails_de_administradores", admins):
        await Z.atender_factura(fallo, False, db)
        await Z.atender_factura(fallo, False, db)  # Stripe reintenta: no se repite el aviso
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.estado == "fallido" and "pago 2 de 3" in plan.fallo
    assert avisos == [("jefa@x.com", 2, True)]
    # A la persona, un correo con el botón para pagar esa cuota (20/10).
    assert len(al_alumno) == 1 and al_alumno[0][0] == "ana@x.com"
    datos = al_alumno[0][1]
    assert datos["pagar_url"] == "https://invoice.stripe.com/i/in_2" and datos["importe_cents"] == 14500
    assert datos["numero"] == 2 and datos["cuotas"] == 3 and datos["reintento"] == "16/11/2026"
    await db.refresh(fila)
    assert fila.status == "paid"  # sigue siendo alumno: lo decide el equipo

    # Al final entra: vuelve a estar al día.
    await Z.atender_factura({**fallo, "amount_paid": 14500}, True, db)
    await db.refresh(plan)
    assert plan.estado == "activo" and plan.fallo == "" and plan.cuotas_pagadas == 2


@pytest.mark.asyncio
async def test_una_factura_que_no_es_de_un_plan_se_ignora(db, org):
    r = await Z.atender_factura({"id": "in_x", "amount_paid": 39700}, True, db)
    assert r["detail"] == "factura sin plan de pagos"


# ── la tarea diaria ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_la_tarea_diaria_apunta_los_cobros_y_no_deja_un_cuarto(db, org):
    falso = StripeFalso()
    await _primer_pago(db, falso)
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    # Como si el calendario no se hubiera podido poner.
    plan.stripe_schedule_id = ""
    db.add(plan)
    await db.commit()
    falso.suscripcion["schedule"] = None
    falso.SubscriptionSchedule.create = lambda **kw: (_ for _ in ()).throw(RuntimeError("Stripe caído"))
    falso.facturas = [
        {"id": f"in_{i}", "status": "paid", "amount_paid": 14500, "status_transitions": {"paid_at": 1792108800 + i}}
        for i in (1, 2, 3)
    ]
    with _Varios(_con_stripe(falso)):
        r = await Z.sincronizar_planes(db)
    assert r == {"revisados": 1, "al_dia": 0, "fallidos": 0, "completados": 1, "errores": 0}
    await db.refresh(plan)
    assert plan.estado == "completado" and plan.cuotas_pagadas == 3
    assert falso.modificados == [{"cancel_at_period_end": True}]
    # En el registro público solo hay números.
    assert all(isinstance(v, int) for v in r.values())


@pytest.mark.asyncio
async def test_la_tarea_diaria_ve_un_cobro_fallido(db, org):
    falso = StripeFalso()
    await _primer_pago(db, falso)
    falso.suscripcion["status"] = "past_due"
    falso.facturas = [
        {"id": "in_1", "status": "paid", "amount_paid": 14500, "status_transitions": {"paid_at": 1792108800}},
        {"id": "in_2", "status": "open", "attempt_count": 2, "amount_due": 14500, "next_payment_attempt": None},
    ]
    avisos = []

    async def avisar(plan, numero, _db, factura=None):
        avisos.append(numero)
        return 1

    with _Varios(_con_stripe(falso)), patch.object(Z, "_avisar_fallo", avisar):
        await Z.sincronizar_planes(db)
        await Z.sincronizar_planes(db)
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.estado == "fallido" and avisos == [2]
    assert "ya no lo va a reintentar" in plan.fallo


# ── la ficha ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_la_ficha_enseña_cada_pago_y_el_plan(db, org):
    from src.services.panel.cliente import ficha_cliente

    falso = StripeFalso()
    await _primer_pago(db, falso)
    await Z.atender_factura({"id": "in_2", "amount_paid": 14500, "subscription": "sub_1"}, True, db)

    ficha = await ficha_cliente("ana@x.com", 1, False, db)
    assert sorted(p["producto"] for p in ficha["pagos"]) == ["Pago 1 de 3 (plazos)", "Pago 2 de 3 (plazos)"]
    assert ficha["total_pagado_cents"] == 29000  # no 29000 + la suma de la matrícula
    assert ficha["plan_pagos"]["cuotas_pagadas"] == 2 and ficha["plan_pagos"]["pendiente_cents"] == 14500

    from src.services.panel.clientes import listar_clientes

    clientes = (await listar_clientes(db))["clientes"]
    assert clientes[0]["plazos"]["cuotas_pagadas"] == 2 and clientes[0]["total_cents"] == 29000


def test_las_facturas_se_guardan_como_json():
    plan = PlanPagos(facturas=json.dumps({"in_1": {"c": 14500, "f": "2026-10-14"}}), cuotas=3, cuota_cents=14500)
    r = Z.resumen(plan)
    assert r["pagos"] == [{"factura": "in_1", "importe_cents": 14500, "fecha": "2026-10-14", "numero": 1}]


# ── 497 € en 3 plazos (19/10) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_el_enlace_de_497_cobra_165_67_y_lo_dice(db, org):
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "Zulay", db, total_cents=49700)
    assert falso.precios_creados[0]["unit_amount"] == 16567
    assert falso.precios_creados[0]["product"] == "prod_formacion"
    sesion = falso.sesiones[0]
    assert sesion["line_items"] == [{"price": "price_16567", "quantity": 1}]
    assert sesion["metadata"]["total_cents"] == "49700"
    assert "497 € en total" in sesion["subscription_data"]["description"]
    assert "amt=16567" in r["payment_url"] and "tot=49700" in r["payment_url"] and "cuotas=3" in r["payment_url"]
    assert r["amount"] == 16567


@pytest.mark.asyncio
async def test_un_total_que_no_se_ofrece_es_el_de_serie(db, org):
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "", db, total_cents=1)
    assert falso.precios_creados[0]["unit_amount"] == 14500 and "tot=43500" in r["payment_url"]


@pytest.mark.asyncio
async def test_497_stripe_cobra_dos_de_165_67_y_uno_de_165_66_y_corta(db, org):
    falso = StripeFalso()
    fila, altas = await _primer_pago(db, falso, total=49700)
    assert altas == ["ana@x.com"]
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.total_cents == 49700 and plan.cuota_cents == 16567 and plan.pagado_cents == 16567
    # El calendario: 2 meses con el precio del primer pago y 1 con el de 165,66.
    cal = falso.calendarios[0]
    assert cal["end_behavior"] == "cancel"
    uno, dos = cal["phases"]
    assert uno["items"] == [{"price": "price_16567", "quantity": 1}] and uno["start_date"] == 1792108800
    assert uno["duration"] == {"interval": "month", "interval_count": 2}
    assert dos["items"] == [{"price": "price_16566", "quantity": 1}]
    assert dos["duration"] == {"interval": "month", "interval_count": 1} and dos["proration_behavior"] == "none"
    assert {p["unit_amount"] for p in falso.precios_creados} == {16567, 16566}
    # La ficha: 497 € en total y lo que falta.
    r = Z.resumen(plan)
    assert r["total_cents"] == 49700 and r["pendiente_cents"] == 49700 - 16567
    # Los cobros 2 y 3 lo completan.
    for i, c in ((2, 16567), (3, 16566)):
        await Z.atender_factura({"id": f"in_{i}", "amount_paid": c, "status_transitions": {"paid_at": 1794787200},
                                 "parent": {"subscription_details": {"subscription": "sub_1"}}}, True, db)
    await db.refresh(plan)
    assert plan.estado == "completado" and plan.pagado_cents == 49700
    await db.refresh(fila)
    assert fila.amount_cents == 49700


def test_un_plan_de_antes_sin_total_guardado_sigue_contando_3_por_145():
    viejo = PlanPagos(email="a@x.com", cuotas=3, cuota_cents=14500, total_cents=0)
    assert Z.total_del_plan(viejo) == 43500 and Z.resumen(viejo)["total_cents"] == 43500


# ── 3 o 4 pagos, a elegir por la persona (20/10) ───────────────────────────


def test_las_dos_opciones_de_la_pagina_de_pago():
    assert Z.opciones() == [
        {"cuotas": 3, "cuota_cents": 16567, "ultima_cents": 16566, "total_cents": 49700, "moneda": "eur"},
        {"cuotas": 4, "cuota_cents": 13500, "ultima_cents": 13500, "total_cents": 54000, "moneda": "eur"},
    ]


@pytest.mark.asyncio
async def test_4_pagos_de_135_entra_con_el_primero_y_stripe_corta_al_cuarto(db, org):
    falso = StripeFalso()
    fila, altas = await _primer_pago(db, falso, n=4)
    assert altas == ["ana@x.com"]
    sesion = falso.sesiones[0]
    assert sesion["line_items"] == [{"price": "price_13500", "quantity": 1}]
    assert sesion["metadata"]["cuotas"] == "4" and sesion["metadata"]["total_cents"] == "54000"
    assert "4 pagos, 540 € en total" in sesion["subscription_data"]["description"]
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.cuotas == 4 and plan.total_cents == 54000 and plan.cuota_cents == 13500 and plan.estado == "activo"
    # Un solo tramo de 4 meses y se cancela al acabar.
    cal = falso.calendarios[0]
    assert cal["end_behavior"] == "cancel" and len(cal["phases"]) == 1
    assert cal["phases"][0]["duration"] == {"interval": "month", "interval_count": 4}
    for i in (2, 3):
        await Z.atender_factura({"id": f"in_{i}", "amount_paid": 13500, "status_transitions": {"paid_at": 1794787200},
                                 "parent": {"subscription_details": {"subscription": "sub_1"}}}, True, db)
    await db.refresh(plan)
    assert plan.estado == "activo" and plan.cuotas_pagadas == 3  # aún falta el cuarto
    await Z.atender_factura({"id": "in_4", "amount_paid": 13500, "status_transitions": {"paid_at": 1797379200},
                             "parent": {"subscription_details": {"subscription": "sub_1"}}}, True, db)
    await db.refresh(plan)
    assert plan.estado == "completado" and plan.pagado_cents == 54000
    await db.refresh(fila)
    assert fila.amount_cents == 54000


@pytest.mark.asyncio
async def test_3_pagos_elegidos_son_los_de_497(db, org):
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "", db, n_cuotas=3)
    assert "amt=16567" in r["payment_url"] and "tot=49700" in r["payment_url"] and "cuotas=3" in r["payment_url"]


@pytest.mark.asyncio
async def test_un_enlace_de_antes_sigue_con_lo_que_decia(db, org):
    # Sin número elegido (enlace de antes del 20/10): 3 pagos con su total.
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "", db, total_cents=43500)
    assert "amt=14500" in r["payment_url"] and "tot=43500" in r["payment_url"] and "cuotas=3" in r["payment_url"]


# ── a medida: el equipo pone el total y los pagos (22/10/2026) ────────────


@pytest.mark.asyncio
async def test_435_en_3_a_medida_son_3_de_145(db, org):
    falso = StripeFalso()
    with _Varios(_con_stripe(falso)):
        r = await Z.abrir_plazos(_pedido(), "Diego", db, medida=(3, 43500))
    assert "amt=14500" in r["payment_url"] and "tot=43500" in r["payment_url"] and "cuotas=3" in r["payment_url"]
    sesion = falso.sesiones[0]
    assert sesion["metadata"]["cuotas"] == "3" and sesion["metadata"]["total_cents"] == "43500"
    assert "3 pagos, 435 € en total" in sesion["subscription_data"]["description"]


@pytest.mark.asyncio
async def test_a_medida_en_2_pagos_que_no_se_dividen_y_corta_al_segundo(db, org):
    falso = StripeFalso()
    fila, altas = await _primer_pago(db, falso, medida=(2, 60001))
    assert altas == ["ana@x.com"]
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    assert plan.cuotas == 2 and plan.total_cents == 60001 and plan.cuota_cents == 30001
    # Un mes a 300,01 y otro a 300,00; se cancela al acabar.
    cal = falso.calendarios[0]
    assert cal["end_behavior"] == "cancel"
    uno, dos = cal["phases"]
    assert uno["items"] == [{"price": "price_30001", "quantity": 1}]
    assert uno["duration"] == {"interval": "month", "interval_count": 1}
    assert dos["items"] == [{"price": "price_30000", "quantity": 1}]
    assert dos["duration"] == {"interval": "month", "interval_count": 1}
    await Z.atender_factura({"id": "in_2", "amount_paid": 30000, "status_transitions": {"paid_at": 1794787200},
                             "parent": {"subscription_details": {"subscription": "sub_1"}}}, True, db)
    await db.refresh(plan)
    assert plan.estado == "completado" and plan.pagado_cents == 60001

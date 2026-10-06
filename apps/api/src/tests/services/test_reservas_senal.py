"""Reservar plaza con señal (06/10/2026): la señal guarda la plaza pero NO da
acceso; el acceso llega solo cuando lo pagado llega al total."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.enrollment import Enrollment
from src.db.reservas import ReservaPago, ReservaPlaza
from src.services.contactos.contactos import _todos_los_eventos, etapa_de
from src.services.payments import payments as P
from src.services.payments import reservas as R


# ── lógica pura ────────────────────────────────────────────────────────────


def test_tipo_de_pago():
    assert R.tipo_de_pago(39700, 0, 5000) == "senal"
    assert R.tipo_de_pago(39700, 5000, 10000) == "parcial"
    assert R.tipo_de_pago(39700, 5000, 34700) == "resto"
    assert R.tipo_de_pago(39700, 0, 39700) == "resto"


def test_nunca_se_cobra_mas_de_lo_pendiente():
    assert R.importe_a_cobrar(5000, 39700, 0) == 5000
    # Un enlace viejo de 34.700 cuando ya solo faltan 30.000: se cobra lo que falta.
    assert R.importe_a_cobrar(34700, 39700, 9700) == 30000
    assert R.importe_a_cobrar(5000, 39700, 39700) == 0
    with pytest.raises(HTTPException):
        R.importe_a_cobrar(10, 39700, 0)


# ── crear el enlace ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_el_enlace_crea_la_reserva_una_vez_y_no_cobra_de_mas(db, org):
    datos = dict(
        email="Manuel@x.com", first_name="Manuel", last_name="Ruiz", phone="+31 6 1",
        total_cents=39700, autor="Zulay", es_admin=True, db_session=db,
    )
    with patch("src.services.payments.payments._academy_url", lambda: "https://escuela.test"):
        a = await R.crear_enlace(importe_cents=5000, **datos)
        assert a["tipo"] == "senal" and "/api/v1/payments/reserva/" in a["url"]
        assert a["reserva"]["total_cents"] == 39700 and a["reserva"]["pendiente_cents"] == 39700
        # Un segundo enlace cobra a cuenta de la MISMA reserva.
        b = await R.crear_enlace(importe_cents=39700, **datos)
        assert b["reserva"]["id"] == a["reserva"]["id"] and b["tipo"] == "resto"
        with pytest.raises(HTTPException):
            await R.crear_enlace(importe_cents=40000, **datos)
    filas = (await db.execute(select(ReservaPlaza))).scalars().all()
    assert len(filas) == 1 and filas[0].email == "manuel@x.com"


@pytest.mark.asyncio
async def test_el_closer_no_fija_el_total(db, org):
    async def precio():
        return 39700, "eur"

    with patch.object(R, "precio_formacion", precio), patch(
        "src.services.payments.payments._academy_url", lambda: "https://escuela.test"
    ):
        a = await R.crear_enlace(
            email="m@x.com", first_name="M", last_name="", phone="", importe_cents=5000,
            total_cents=100, autor="Closer", es_admin=False, db_session=db,
        )
    assert a["reserva"]["total_cents"] == 39700


@pytest.mark.asyncio
async def test_a_un_alumno_no_se_le_crea_reserva(db, org):
    db.add(Enrollment(email="ya@x.com", status="paid", created_at="2026-10-01"))
    await db.commit()
    with pytest.raises(HTTPException):
        await R.crear_enlace(
            email="ya@x.com", first_name="Ya", last_name="", phone="", importe_cents=5000,
            total_cents=39700, autor="X", es_admin=True, db_session=db,
        )


# ── el aviso de Stripe ─────────────────────────────────────────────────────


async def _reserva_con_pago(db, importe, tipo="senal", total=39700, pagado=0):
    r = ReservaPlaza(email="manuel@x.com", first_name="Manuel", last_name="Ruiz", total_cents=total,
                     pagado_cents=pagado, created_at="2026-10-06")
    db.add(r)
    await db.commit()
    await db.refresh(r)
    p = ReservaPago(reserva_id=r.id, tipo=tipo, importe_cents=importe, estado="pendiente",
                    stripe_session_id="cs_x", created_at="2026-10-06")
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return r, p


def _avisos(pago_id, importe):
    meta = {"reserva_pago_id": str(pago_id), "factura_stripe": "1"}
    sesion = {"id": "cs_x", "payment_status": "paid", "metadata": meta, "amount_total": importe}
    intento = {"id": "pi_x", "metadata": meta, "amount_received": importe}
    return sesion, intento


@pytest.mark.asyncio
async def test_la_senal_guarda_plaza_pero_no_da_acceso(db, org):
    r, p = await _reserva_con_pago(db, 5000)
    altas = []

    async def provision(email, name, db_session, ya_atendida=False):
        altas.append(email)
        return {"atendida_ahora": True}

    sesion, intento = _avisos(p.id, 5000)
    with patch.object(P, "_provision_after_payment", provision):
        await P._handle_checkout_session(sesion, db)
        await P._handle_payment_intent(intento, db)  # el segundo aviso del mismo cobro

    await db.refresh(r)
    assert r.pagado_cents == 5000 and r.estado == "abierta"
    assert altas == []  # sin cuenta ni correo de bienvenida
    assert (await db.execute(select(Enrollment))).scalars().all() == []  # no es una venta todavía
    assert await R.emails_con_plaza_reservada(db) == {"manuel@x.com"}  # pero ocupa plaza

    plazas = await P.get_seat_status(db)
    assert plazas["ocupadas"] == 1


@pytest.mark.asyncio
async def test_al_completar_se_da_el_acceso_una_sola_vez(db, org):
    r, senal = await _reserva_con_pago(db, 5000)
    altas = []

    async def provision(email, name, db_session, ya_atendida=False):
        if not ya_atendida:
            altas.append(email)
        return {"atendida_ahora": not ya_atendida}

    with patch.object(P, "_provision_after_payment", provision):
        for aviso in _avisos(senal.id, 5000):
            await (P._handle_checkout_session if "payment_status" in aviso else P._handle_payment_intent)(aviso, db)
        resto = ReservaPago(reserva_id=r.id, tipo="resto", importe_cents=34700, estado="pendiente", created_at="x")
        db.add(resto)
        await db.commit()
        await db.refresh(resto)
        sesion, intento = _avisos(resto.id, 34700)
        await P._handle_checkout_session(sesion, db)
        await P._handle_payment_intent(intento, db)

    await db.refresh(r)
    assert r.estado == "completada" and r.pagado_cents == 39700
    ventas = (await db.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all()
    assert len(ventas) == 1 and ventas[0].amount_cents == 39700 and ventas[0].id == r.enrollment_id
    assert altas == ["manuel@x.com"]
    # Ya es alumno: deja de ocupar plaza "reservada" (la ocupa como pagada).
    assert await R.emails_con_plaza_reservada(db) == set()
    assert (await P.get_seat_status(db))["ocupadas"] == 1


@pytest.mark.asyncio
async def test_en_la_ficha_se_ve_lo_pagado_y_lo_que_falta(db, org):
    r, p = await _reserva_con_pago(db, 5000)
    with patch.object(P, "_provision_after_payment", None):
        await R.atender_pago(p.id, 5000, db)
    ficha = await R.reserva_de("Manuel@x.com", db)
    assert ficha["pagado_cents"] == 5000 and ficha["pendiente_cents"] == 34700
    assert [x["tipo"] for x in ficha["pagos"]] == ["senal"]

    eventos = [e for e in await _todos_los_eventos(db) if e["email"] == "manuel@x.com"]
    assert any(e["kind"] == "senal" and "plaza reservada" in e["que"] and "50 €" in e["que"] for e in eventos)
    assert etapa_de({e["kind"] for e in eventos}, tiene_cuenta=False) == "en-pago"


# ── abrir el enlace ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_abrir_el_enlace_cierra_la_sesion_vieja_y_recorta_el_importe(db, org):
    r, viejo = await _reserva_con_pago(db, 5000, pagado=0)
    viejo.estado = "pendiente"
    db.add(viejo)
    await db.commit()

    creadas, caducadas = [], []

    def crear_sesion(**kw):
        creadas.append(kw)
        return SimpleNamespace(id="cs_nueva", client_secret="cs_nueva_secret")

    fake_stripe = SimpleNamespace(
        Customer=SimpleNamespace(create=lambda **kw: SimpleNamespace(id="cus_1")),
        checkout=SimpleNamespace(Session=SimpleNamespace(create=crear_sesion, expire=lambda sid: caducadas.append(sid))),
    )
    from src.services.payments.enlace import firmar

    secreto = "s" * 40
    token = firmar({"r": r.id, "i": 50000, "e": r.email}, secreto)

    async def abierta(_db):
        return None

    cfg = SimpleNamespace(security_config=SimpleNamespace(auth_jwt_secret_key=secreto))
    with patch.dict("sys.modules", {"stripe": fake_stripe}), patch(
        "config.config.get_learnhouse_config", lambda: cfg
    ), patch.object(P, "_usar_stripe", lambda: None), patch.object(
        P, "_stripe_publishable", lambda: "pk_test"
    ), patch.object(P, "ensure_matricula_abierta", abierta), patch.object(
        P, "_academy_url", lambda: "https://escuela.test"
    ):
        url = await R.abrir_pago(token, db)

    assert caducadas == ["cs_x"]
    # Pedía 500 € y solo faltan 397: se cobran 397.
    assert creadas[0]["line_items"][0]["price_data"]["unit_amount"] == 39700
    assert "tipo=resto" in url and "tot=39700" in url and "prev=0" in url
    pagos = (await db.execute(select(ReservaPago).where(ReservaPago.reserva_id == r.id))).scalars().all()
    assert sorted(p.estado for p in pagos) == ["caducado", "pendiente"]


@pytest.mark.asyncio
async def test_la_ficha_enseña_cada_pago_y_no_cuenta_dos_veces(db, org):
    from src.services.panel.cliente import ficha_cliente

    r, senal = await _reserva_con_pago(db, 5000)

    async def provision(email, name, db_session, ya_atendida=False):
        return {"atendida_ahora": not ya_atendida}

    with patch.object(P, "_provision_after_payment", provision):
        await R.atender_pago(senal.id, 5000, db)
        resto = ReservaPago(reserva_id=r.id, tipo="resto", importe_cents=34700, estado="pendiente", created_at="x")
        db.add(resto)
        await db.commit()
        await db.refresh(resto)
        await R.atender_pago(resto.id, 34700, db)

    ficha = await ficha_cliente("manuel@x.com", 1, False, db)
    assert sorted(p["importe_cents"] for p in ficha["pagos"]) == [5000, 34700]
    assert ficha["total_pagado_cents"] == 39700
    assert ficha["reserva"]["estado"] == "completada"

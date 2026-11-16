"""Un solo correo de bienvenida por compra (03/10: llegaron dos «Welkom»).

Stripe manda a la vez `checkout.session.completed` y `payment_intent.succeeded`.
Aquí se simulan los dos avisos para la misma matrícula y se cuenta cuántas
veces sale el correo.
"""

import asyncio
from unittest.mock import patch

import pytest

from src.db.enrollment import Enrollment
from src.services.payments import payments as P


@pytest.mark.asyncio
async def test_reclamar_solo_gana_uno(db):
    m = Enrollment(email="z@x.com", first_name="Zulay", last_name="Garcia", status="paid", created_at="2026-10-03")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    primero = await P._reclamar_matricula(m, db)
    segundo = await P._reclamar_matricula(m, db)
    assert primero is True and segundo is False


@pytest.mark.asyncio
async def test_los_dos_avisos_de_stripe_mandan_un_solo_correo(db):
    m = Enrollment(email="z@x.com", first_name="Zulay", last_name="Garcia", status="pending", created_at="2026-10-03")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    enviados = []

    async def provision(email, name, db_session, ya_atendida=False):
        if not ya_atendida:
            enviados.append(email)
        return {"atendida_ahora": not ya_atendida}

    sesion = {"id": "cs_1", "payment_status": "paid", "metadata": {"enrollment_id": str(m.id)}, "amount_total": 39700}
    intento = {"id": "pi_1", "metadata": {"enrollment_id": str(m.id), "factura_stripe": "1"}, "amount_received": 39700}
    with patch.object(P, "_provision_after_payment", provision):
        await P._handle_checkout_session(sesion, db)
        await P._handle_payment_intent(intento, db)
    assert enviados == ["z@x.com"]


@pytest.mark.asyncio
async def test_si_el_correo_falla_se_suelta_para_reintentar(db):
    m = Enrollment(email="z@x.com", first_name="Z", last_name="G", status="paid", created_at="2026-10-03")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    async def falla(email, name, db_session, ya_atendida=False):
        return {"atendida_ahora": False}

    intento = {"id": "pi_1", "metadata": {"enrollment_id": str(m.id), "factura_stripe": "1"}}
    with patch.object(P, "_provision_after_payment", falla):
        await P._handle_payment_intent(intento, db)
    await db.refresh(m)
    assert (m.provisioned_at or "") == ""


# ── 16/11: si el correo falla, Stripe tiene que reintentar ────────────────


@pytest.mark.asyncio
async def test_si_el_correo_falla_stripe_reintenta_y_luego_sale(db):
    from fastapi import HTTPException

    m = Enrollment(email="z@x.com", first_name="Z", last_name="G", status="pending", created_at="2026-11-16")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    intentos = []

    async def provision(email, name, db_session, ya_atendida=False):
        intentos.append(ya_atendida)
        if len(intentos) == 1:
            return {"atendida_ahora": False, "reintentar": True, "detail": "resend caído"}
        return {"atendida_ahora": not ya_atendida}

    sesion = {"id": "cs_1", "payment_status": "paid", "metadata": {"enrollment_id": str(m.id)}, "amount_total": 43500}
    with patch.object(P, "_provision_after_payment", provision):
        with pytest.raises(HTTPException) as e:
            await P._handle_checkout_session(sesion, db)
        assert e.value.status_code == 503
        await db.refresh(m)
        assert (m.provisioned_at or "") == ""
        # Stripe vuelve a avisar: esta vez sale.
        r = await P._handle_checkout_session(sesion, db)
    assert r["atendida_ahora"] is True
    assert intentos == [False, False]


@pytest.mark.asyncio
async def test_provision_dice_reintentar_si_el_envio_falla():
    from types import SimpleNamespace

    from fastapi import HTTPException

    usuario = SimpleNamespace(id=7, first_name="Z", email="z@x.com")

    async def crear(email, name, db_session):
        return usuario, False

    class Sesion:
        async def execute(self, *a, **k):
            class R:
                def scalars(self):
                    return self

                def first(self):
                    return 1

            return R()

    async def org(db_session):
        return SimpleNamespace(org_uuid="org_1")

    def envio(**k):
        raise HTTPException(status_code=503, detail="Email service temporarily unavailable")

    with patch.object(P, "_create_paid_user", crear), patch.object(P, "_get_default_org", org), patch.object(
        P, "_store_reset_code", lambda u, o: "codigo"
    ), patch.object(P, "send_payment_welcome_email", envio), patch.object(
        P.UserRead, "model_validate", lambda u: SimpleNamespace(email=u.email)
    ):
        r = await P._provision_after_payment("z@x.com", "Z", Sesion())
    assert r["atendida_ahora"] is False and r["reintentar"] is True
    assert "Email service" in r["detail"]


@pytest.mark.asyncio
async def test_las_automatizaciones_salen_una_vez_por_pago(db):
    m = Enrollment(email="z@x.com", first_name="Z", last_name="G", status="pending", created_at="2026-11-16")
    db.add(m)
    await db.commit()
    await db.refresh(m)

    async def provision(email, name, db_session, ya_atendida=False):
        return {"atendida_ahora": not ya_atendida, "user_id": 3, "org_id": 1}

    lanzadas = []

    async def trigger(*a, **k):
        lanzadas.append(a[0])

    sesion = {"id": "cs_1", "payment_status": "paid", "metadata": {"enrollment_id": str(m.id)}, "amount_total": 43500}
    intento = {"id": "pi_1", "metadata": {"enrollment_id": str(m.id), "factura_stripe": "1"}, "amount_received": 43500}
    with patch.object(P, "_provision_after_payment", provision), patch(
        "src.services.automations.engine.run_trigger", trigger
    ):
        await P._handle_checkout_session(sesion, db)
        await P._handle_payment_intent(intento, db)
    assert lanzadas == ["payment_completed"]

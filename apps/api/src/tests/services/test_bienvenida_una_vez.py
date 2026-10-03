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

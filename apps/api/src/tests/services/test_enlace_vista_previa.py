"""El enlace de pago y los robots de vista previa (16/11/2026).

Al pegar el enlace en WhatsApp, WhatsApp lo abre solo para pintar la vista
previa. Eso no debe crear matrícula ni cliente de Stripe. Y al abrirlo dos
veces la persona, se reutiliza su cliente de Stripe.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.db.enrollment import Enrollment, EnrollmentCreate
from src.routers import payments as R
from src.services.payments import enlace as E
from src.services.payments import payments as P


def test_reconoce_los_robots_de_vista_previa():
    assert R.es_robot_de_vista_previa("WhatsApp/2.23.20.0 A")
    assert R.es_robot_de_vista_previa("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")
    assert R.es_robot_de_vista_previa("TelegramBot (like TwitterBot)")
    assert R.es_robot_de_vista_previa("Mozilla/5.0 (compatible; Googlebot/2.1)")
    assert not R.es_robot_de_vista_previa(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1"
    )
    assert not R.es_robot_de_vista_previa(None)
    assert not R.es_robot_de_vista_previa("")


@pytest.mark.asyncio
async def test_el_robot_no_crea_nada():
    llamado = []

    def verificar(*a, **k):
        llamado.append("verificar")
        return {"e": "ana@x.com"}

    with patch.object(E, "verificar", verificar):
        r = await R.api_pagar_enlace("tok", cuotas=None, db_session=None, user_agent="WhatsApp/2.24")
        assert r.status_code == 200 and "Pago de la Formación Nawar" in r.body.decode()
        r = await R.api_pagar_reserva("tok", db_session=None, user_agent="facebookexternalhit/1.1")
        assert r.status_code == 200 and "Pago de la Formación Nawar" in r.body.decode()
    assert llamado == []


class _StripeFalso:
    def __init__(self):
        self.creados = []
        self.cambiados = []
        outer = self

        class Customer:
            @staticmethod
            def create(**kw):
                outer.creados.append(kw)
                return SimpleNamespace(id=f"cus_{len(outer.creados)}")

            @staticmethod
            def modify(cid, **kw):
                outer.cambiados.append(cid)
                return SimpleNamespace(id=cid)

        class Price:
            @staticmethod
            def retrieve(pid):
                return {"unit_amount": 59700, "currency": "eur"}

        self.Customer = Customer
        self.Price = Price


@pytest.mark.asyncio
async def test_abrir_dos_veces_reutiliza_el_cliente_de_stripe(db):
    falso = _StripeFalso()

    async def abierta(_db):
        return None

    def sesion(*a, **k):
        return SimpleNamespace(id="cs_1", client_secret="cs_1_secret")

    pedido = EnrollmentCreate(email="ana@x.com", first_name="Ana", last_name="Gil", phone="+316")
    with patch.object(P, "stripe", falso), patch.object(P, "_usar_stripe", lambda: None), patch.object(
        P, "ensure_matricula_abierta", abierta
    ), patch.object(P, "crear_sesion_de_pago", sesion), patch.object(P, "_precio_base_id", lambda c=None: "price_x"), patch.object(
        P, "_academy_url", lambda: "https://escuela.test"
    ), patch.object(P, "_stripe_publishable", lambda: "pk_test"), patch.object(
        P, "_cerrar_sesion_anterior", lambda s: None
    ), patch.object(P, "_cancelar_intento_anterior", lambda s: None):
        await P.enroll_and_checkout_session(pedido, db, precio_cents=59700)
        await P.enroll_and_checkout_session(pedido, db, precio_cents=59700)
    assert len(falso.creados) == 1 and falso.cambiados == ["cus_1"]
    from sqlmodel import select

    filas = (await db.execute(select(Enrollment).where(Enrollment.email == "ana@x.com"))).scalars().all()
    assert len(filas) == 1 and filas[0].stripe_customer_id == "cus_1"


# ── el tipo de cada enlace firmado (16/11) ─────────────────────────────────


def test_tipo_vale_acepta_los_viejos_y_rechaza_otros_tipos():
    assert E.tipo_vale({"e": "a@x.com"}, E.TIPO_PAGAR)  # enlace de antes, sin tipo
    assert E.tipo_vale({"e": "a@x.com", "t": "pagar"}, E.TIPO_PAGAR)
    assert not E.tipo_vale({"e": "a@x.com", "t": "baja"}, E.TIPO_PAGAR)
    assert not E.tipo_vale({"e": "a@x.com", "t": "ebook"}, E.TIPO_PAGAR)
    assert not E.tipo_vale({"r": 1, "t": "reserva"}, E.TIPO_PAGAR)
    assert E.tipo_vale({"r": 1, "t": "reserva"}, E.TIPO_RESERVA)
    assert not E.tipo_vale({"r": 1, "t": "pagar"}, E.TIPO_RESERVA)


@pytest.mark.asyncio
async def test_un_enlace_de_baja_no_abre_la_caja():
    secreto = "s" * 40
    baja = E.firmar({"e": "ana@x.com", "t": "baja"}, secreto, dias=365)
    cfg = SimpleNamespace(security_config=SimpleNamespace(auth_jwt_secret_key=secreto))
    with patch("config.config.get_learnhouse_config", lambda: cfg):
        r = await R.api_pagar_enlace(baja, cuotas=None, db_session=None, user_agent="Mozilla/5.0")
    assert r.status_code == 410 and "ya no vale" in r.body.decode()

    from fastapi import HTTPException

    from src.services.payments import reservas as RS

    with patch("config.config.get_learnhouse_config", lambda: cfg):
        with pytest.raises(HTTPException) as e:
            await RS.abrir_pago(E.firmar({"r": 1, "i": 5000, "e": "a@x.com", "t": "pagar"}, secreto), None)
    assert e.value.status_code == 410

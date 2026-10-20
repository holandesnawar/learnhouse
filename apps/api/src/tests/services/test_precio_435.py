"""El precio de 435 € y los enlaces de pago (20/10/2026).

- El pago único cobra un precio de 435 € creado desde la escuela, en el mismo
  producto de Stripe, sin tocar el panel de Stripe.
- Los enlaces de pago creados antes del cambio (sin `pu`) respetan el precio de
  entonces (397 €, `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID`) hasta caducar.
- El enlace «A plazos» nuevo (`pv: 2`) lleva primero a elegir 3 o 4 pagos.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.routers import payments as R
from src.services.payments import enlace as E
from src.services.payments import payments as P
from src.services.payments import plazos as Z


class _StripePrecios:
    def __init__(self):
        self.creados = []

        def listar(lookup_keys=(), **kw):
            clave = list(lookup_keys)[0]
            return {"data": [{"id": "price_" + c["lookup_key"]} for c in self.creados if c["lookup_key"] == clave]}

        def crear(**kw):
            self.creados.append(kw)
            return {"id": "price_" + kw["lookup_key"]}

        self.Price = SimpleNamespace(
            list=listar, create=crear,
            retrieve=lambda pid: {"id": pid, "product": "prod_formacion", "currency": "eur", "unit_amount": 39700},
        )


def test_el_pago_unico_es_de_435_en_el_mismo_producto_y_se_crea_una_vez(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_FORMACION_PRECIO_CENTS", raising=False)
    falso = _StripePrecios()
    with patch.object(P, "stripe", falso), patch.object(P, "_formacion_price_id", lambda: "price_397"), patch.object(P, "_PRECIOS", {}):
        assert P._precio_base_id() == "price_nawar-formacion-unico-43500"
        assert P._precio_base_id() == "price_nawar-formacion-unico-43500"
    assert len(falso.creados) == 1
    precio = falso.creados[0]
    assert precio["product"] == "prod_formacion" and precio["unit_amount"] == 43500 and "recurring" not in precio


def test_el_precio_se_cambia_con_una_variable(monkeypatch):
    monkeypatch.setenv("LEARNHOUSE_FORMACION_PRECIO_CENTS", "45900")
    assert P.precio_base_cents() == 45900
    monkeypatch.setenv("LEARNHOUSE_FORMACION_PRECIO_CENTS", "no")
    assert P.precio_base_cents() == 43500


# ── abrir un enlace ────────────────────────────────────────────────────────


async def _abrir(datos: dict, cuotas=None):
    llamadas = {}

    async def checkout(pedido, db, precio_id=""):
        llamadas["unico"] = precio_id
        return {"payment_url": "https://escuela.test/pago-unico"}

    async def plazos(pedido, autor, db, total_cents=None, n_cuotas=None):
        llamadas["plazos"] = (total_cents, n_cuotas)
        return {"payment_url": "https://escuela.test/pago-plazos"}

    parches = [
        patch.object(E, "verificar", lambda token, secreto: {"e": "ana@x.com", "f": "Ana", "l": "Gil", "p": "+31 6", **datos}),
        patch.object(R, "enroll_and_checkout_session", checkout),
        patch.object(Z, "abrir_plazos", plazos),
        patch.object(P, "_academy_url", lambda: "https://escuela.test"),
        patch.object(P, "_formacion_price_id", lambda: "price_397"),
    ]
    for p in parches:
        p.start()
    try:
        respuesta = await R.api_pagar_enlace("tok.firma", cuotas=cuotas, db_session=None)
    finally:
        for p in reversed(parches):
            p.stop()
    return respuesta, llamadas


@pytest.mark.asyncio
async def test_un_enlace_de_antes_cobra_397_y_uno_nuevo_435():
    r, ll = await _abrir({})
    assert ll["unico"] == "price_397" and r.headers["location"] == "https://escuela.test/pago-unico"
    r, ll = await _abrir({"pu": 43500})
    assert ll["unico"] == ""  # vacío = el precio de hoy


@pytest.mark.asyncio
async def test_a_plazos_primero_se_elige_y_luego_se_paga():
    r, ll = await _abrir({"pl": "plazos", "pv": 2})
    assert "plazos" not in ll and r.status_code == 303
    destino = r.headers["location"]
    assert destino.startswith("https://escuela.test/auth/matricula-formacion-nawar-a0-a1?elegir=plazos")
    assert "op=3x49700%2C4x54000" in destino and "em=ana%40x.com" in destino and "nm=Ana%20Gil" in destino
    # Un número que no se ofrece vuelve a la elección.
    r, ll = await _abrir({"pl": "plazos", "pv": 2}, cuotas=6)
    assert "plazos" not in ll and "elegir=plazos" in r.headers["location"]
    r, ll = await _abrir({"pl": "plazos", "pv": 2}, cuotas=4)
    assert ll["plazos"] == (None, 4) and r.headers["location"] == "https://escuela.test/pago-plazos"


@pytest.mark.asyncio
async def test_un_enlace_a_plazos_de_antes_no_pregunta():
    r, ll = await _abrir({"pl": "plazos", "pt": 49700}, cuotas=4)
    assert ll["plazos"] == (49700, None)

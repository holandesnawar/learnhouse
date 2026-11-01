"""El precio de 435 € y los enlaces de pago (20/10/2026).

- El pago único cobra un precio de 435 € creado desde la escuela, en el mismo
  producto de Stripe, sin tocar el panel de Stripe.
- Los enlaces de pago creados antes del cambio (sin `pu`) respetan el precio de
  entonces (397 €, `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID`) hasta caducar.
- El enlace «A plazos» nuevo (`pv: 2`) lleva primero a elegir 3 o 4 pagos.
- El enlace a plazos «a medida» (`pv: 3`, 22/10) va directo a la caja con el
  total y los pagos que puso el equipo.
- Desde el 01/11/2026 los enlaces del PANEL cobran 597 € en un pago y sus
  plazos son 3 pagos de 230 € (690 €); la caja de la web sigue en 435 €.
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

    async def checkout(pedido, db, precio_id="", precio_cents=0):
        llamadas["unico"] = precio_id
        llamadas["precio_cents"] = precio_cents
        return {"payment_url": "https://escuela.test/pago-unico"}

    async def plazos(pedido, autor, db, total_cents=None, n_cuotas=None, medida=None):
        llamadas["plazos"] = (total_cents, n_cuotas)
        llamadas["medida"] = medida
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
    # Cobra el que lleva firmado: los enlaces de 435 € creados antes del 01/11
    # siguen cobrando 435 € hasta caducar.
    assert ll["unico"] == "" and ll["precio_cents"] == 43500


# ── el precio del panel (01/11/2026) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_un_enlace_del_panel_cobra_597():
    r, ll = await _abrir({"pu": 59700})
    assert ll["unico"] == "" and ll["precio_cents"] == 59700
    assert r.headers["location"] == "https://escuela.test/pago-unico"


def test_el_precio_del_panel_es_otro_price_del_mismo_producto(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_FORMACION_PRECIO_CENTS", raising=False)
    monkeypatch.delenv("LEARNHOUSE_PRECIO_PANEL_CENTS", raising=False)
    assert P.precio_panel_cents() == 59700 and P.precio_base_cents() == 43500
    falso = _StripePrecios()
    with patch.object(P, "stripe", falso), patch.object(P, "_formacion_price_id", lambda: "price_397"), patch.object(P, "_PRECIOS", {}):
        assert P._precio_base_id(59700) == "price_nawar-formacion-unico-59700"
        # Sin importe, el de la web: no se mezclan.
        assert P._precio_base_id() == "price_nawar-formacion-unico-43500"
    assert [c["unit_amount"] for c in falso.creados] == [59700, 43500]
    assert all(c["product"] == "prod_formacion" for c in falso.creados)
    monkeypatch.setenv("LEARNHOUSE_PRECIO_PANEL_CENTS", "64900")
    assert P.precio_panel_cents() == 64900


async def _crear_enlace(pedido: dict):
    from src.routers import contactos as RC

    firmado = {}

    def firmar(datos, secreto, **kw):
        firmado.update(datos)
        return "tok"

    async def acceso(*a, **kw):
        return None

    usuario = SimpleNamespace(first_name="Diego", last_name="", username="diego", email="diego@x.com")
    config = SimpleNamespace(security_config=SimpleNamespace(auth_jwt_secret_key="s" * 40))
    with patch.object(RC, "exigir_acceso", acceso), patch.object(E, "firmar", firmar), patch(
        "config.config.get_learnhouse_config", lambda: config
    ), patch.object(P, "_academy_url", lambda: "https://escuela.test"):
        respuesta = await RC.api_enlace_pago(
            None, 1, RC.PedidoEnlace(email="ana@x.com", first_name="Ana", **pedido), current_user=usuario, db_session=None
        )
    return respuesta, firmado


@pytest.mark.asyncio
async def test_el_boton_azul_del_panel_firma_597():
    r, firmado = await _crear_enlace({})
    assert firmado["pu"] == 59700 and r["precio_cents"] == 59700
    assert "pl" not in firmado


@pytest.mark.asyncio
async def test_el_boton_a_plazos_del_panel_son_3_pagos_de_230():
    r, firmado = await _crear_enlace({"plan": "plazos"})
    assert (firmado["pl"], firmado["pv"], firmado["pn"], firmado["pt"]) == ("plazos", 3, 3, 69000)
    assert r["opciones"] == [Z.condiciones_de(3, 69000)]
    assert r["opciones"][0]["cuota_cents"] == 23000
    # «Otro importe» a plazos sigue mandando lo que pone el equipo.
    r, firmado = await _crear_enlace({"plan": "plazos", "total_cents": 43500, "cuotas": 3})
    assert (firmado["pn"], firmado["pt"]) == (3, 43500) and r["a_medida"] is True


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


# ── a plazos a medida (22/10/2026) ─────────────────────────────────────────


def test_los_limites_de_un_plan_a_medida():
    assert Z.a_medida(43500, 3) == (3, 43500)
    assert Z.a_medida("43500", "2") == (2, 43500)
    assert Z.a_medida(43500, 6) == (6, 43500)
    # Un solo pago no es un plan; más de 6, tampoco.
    assert Z.a_medida(43500, 1) is None and Z.a_medida(43500, 7) is None
    # Menos de 0,50 € por cobro (el mínimo de Stripe), o más de 3.000 €.
    assert Z.a_medida(140, 3) is None and Z.a_medida(150, 3) == (3, 150)
    assert Z.a_medida(300001, 3) is None
    assert Z.a_medida(None, 3) is None and Z.a_medida("no", 3) is None


@pytest.mark.asyncio
async def test_un_enlace_a_medida_va_directo_a_la_caja():
    r, ll = await _abrir({"pl": "plazos", "pv": 3, "pt": 43500, "pn": 3})
    assert ll["medida"] == (3, 43500)
    assert r.status_code == 303 and r.headers["location"] == "https://escuela.test/pago-plazos"
    # El número de pagos lo puso el equipo: un `?cuotas=` en la dirección no lo cambia.
    r, ll = await _abrir({"pl": "plazos", "pv": 3, "pt": 43500, "pn": 3}, cuotas=4)
    assert ll["medida"] == (3, 43500)


@pytest.mark.asyncio
async def test_un_enlace_a_medida_mal_hecho_no_cobra():
    r, ll = await _abrir({"pl": "plazos", "pv": 3, "pt": 43500, "pn": 9})
    assert "plazos" not in ll and r.status_code == 400
    assert "no está bien hecho" in r.body.decode()

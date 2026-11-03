"""Scalapay en la caja de pago (03/11/2026).

"Está activado en Stripe y no aparece": la caja lleva la lista de métodos
escrita a mano y Scalapay no estaba. Además solo existe desde la versión de la
API 2026-05-27.dahlia, más nueva que la de la librería de la escuela.
"""

import stripe

from src.services.payments import payments
from src.services.payments.payments import crear_sesion_de_pago, metodos_de_pago


def test_scalapay_sale_en_la_formacion_y_no_en_el_ebook():
    assert metodos_de_pago(59700) == ["card", "ideal", "klarna", "bancontact", "scalapay"]
    assert metodos_de_pago(43500)[-1] == "scalapay"
    assert metodos_de_pago(5000)[-1] == "scalapay"  # una señal de 50 €
    # Por debajo de 5 € o por encima de 4.999,99 €, Scalapay no cobra.
    assert "scalapay" not in metodos_de_pago(100)
    assert "scalapay" not in metodos_de_pago(499)
    assert "scalapay" in metodos_de_pago(500)
    assert "scalapay" not in metodos_de_pago(500_000)
    # Solo euros.
    assert "scalapay" not in metodos_de_pago(59700, "usd")


class _Sesiones:
    def __init__(self, rechazar_scalapay=False):
        self.llamadas = []
        self.rechazar_scalapay = rechazar_scalapay

    def create(self, **kw):
        self.llamadas.append(kw)
        if self.rechazar_scalapay and "scalapay" in kw["payment_method_types"]:
            raise stripe.InvalidRequestError("Invalid payment_method_types: scalapay", "payment_method_types")
        return {"id": "cs_test_123"}


def test_la_sesion_con_scalapay_va_con_la_version_de_la_api_que_lo_conoce(monkeypatch):
    falso = _Sesiones()
    monkeypatch.setattr(payments.stripe.checkout, "Session", falso)
    crear_sesion_de_pago(59700, "eur", mode="payment")
    assert len(falso.llamadas) == 1
    assert "scalapay" in falso.llamadas[0]["payment_method_types"]
    assert falso.llamadas[0]["stripe_version"] == "2026-05-27.dahlia"
    assert falso.llamadas[0]["mode"] == "payment"


def test_sin_scalapay_no_cambia_la_version(monkeypatch):
    falso = _Sesiones()
    monkeypatch.setattr(payments.stripe.checkout, "Session", falso)
    crear_sesion_de_pago(100, "eur", mode="payment")
    assert falso.llamadas[0]["payment_method_types"] == ["card", "ideal", "klarna", "bancontact"]
    assert "stripe_version" not in falso.llamadas[0]


def test_si_stripe_rechaza_scalapay_la_caja_abre_sin_el(monkeypatch):
    falso = _Sesiones(rechazar_scalapay=True)
    monkeypatch.setattr(payments.stripe.checkout, "Session", falso)
    sesion = crear_sesion_de_pago(59700, "eur", mode="payment")
    assert sesion == {"id": "cs_test_123"}
    assert len(falso.llamadas) == 2
    assert falso.llamadas[1]["payment_method_types"] == ["card", "ideal", "klarna", "bancontact"]
    assert "stripe_version" not in falso.llamadas[1]

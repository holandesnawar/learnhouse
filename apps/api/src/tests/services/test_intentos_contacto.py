"""Los intentos de contacto de «Contactado» (08/11/2026)."""

from src.services.panel.intentos import resumen, texto_linea_de_tiempo


def ev(intento, que, autor="Diego", nota=""):
    return {"kind": "intento-contacto", "when": "2026-11-08T10:00:00+00:00", "extra": {"intento": intento, "que": que, "autor": autor, "nota": nota}}


def test_sin_intentos_nivel_cero():
    r = resumen([{"kind": "solicitud", "extra": {}}])
    assert r["nivel"] == 0
    assert [i["intento"] for i in r["intentos"]] == [1, 2, 3]
    assert r["intentos"][0]["llamada"] is None


def test_el_nivel_es_el_intento_mas_alto():
    r = resumen([ev(1, "llamada"), ev(1, "whatsapp"), ev(2, "llamada")])
    assert r["nivel"] == 2
    assert r["intentos"][0]["whatsapp"]["autor"] == "Diego"
    assert r["intentos"][1]["whatsapp"] is None


def test_lo_raro_no_cuenta():
    r = resumen([ev(4, "llamada"), ev(1, "correo"), {"kind": "intento-contacto", "extra": "no-json"}])
    assert r["nivel"] == 0


def test_texto_de_la_linea_de_tiempo():
    assert texto_linea_de_tiempo({"intento": 2, "que": "whatsapp", "autor": "Belén", "nota": "no contesta"}) == "Belén le escribió por WhatsApp (intento 2): no contesta"

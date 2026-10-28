"""El ebook de Black Friday a 1 € y su campaña (services/ebook/ebook.py).

- Qué correo toca cada día (uno al día, los de fecha fija ganan, nada después
  del final, los muy atrasados se saltan).
- La compra se atiende una sola vez, venga del webhook o de la página de
  vuelta, y si el correo falla no queda marcada.
- La campaña se para al reservar la llamada, al pagar la formación y al darse
  de baja.
- Los enlaces de descarga y de baja van firmados y no se confunden.
"""

import json
from unittest.mock import patch

import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.services.ebook import ebook as E
from src.services.panel import tandas
from src.services.users import emails as M

CORREOS = E.DE_FABRICA["correos"]


def test_que_correo_toca_cada_dia():
    hasta = "2026-11-30"
    # El día de la compra, nada (ya le llegó el ebook).
    assert E.que_toca("2026-11-02", "2026-11-02", CORREOS, set(), hasta) is None
    assert E.que_toca("2026-11-02", "2026-11-03", CORREOS, set(), hasta)["id"] == "c1"
    # El día 2 no toca nada: el siguiente es el día 3.
    assert E.que_toca("2026-11-02", "2026-11-04", CORREOS, {"c1"}, hasta) is None
    assert E.que_toca("2026-11-02", "2026-11-05", CORREOS, {"c1"}, hasta)["id"] == "c2"
    # Uno al día como mucho.
    assert E.que_toca("2026-11-02", "2026-11-05", CORREOS, {"c1"}, hasta, ultimo_envio="2026-11-05") is None
    # El de fecha fija gana ese día, aunque toque uno de días (c4: el 27).
    assert E.que_toca("2026-11-20", "2026-11-27", CORREOS, {"c1", "c2", "c3"}, hasta)["id"] == "bf"
    # Al día siguiente sale el de días que esperaba.
    assert E.que_toca("2026-11-20", "2026-11-28", CORREOS, {"c1", "c2", "c3", "bf"}, hasta)["id"] == "c4"
    # Muy atrasado (más de 2 días): se salta y va al siguiente que toque.
    assert E.que_toca("2026-11-02", "2026-11-08", CORREOS, set(), hasta)["id"] == "c3"
    # Después del final, nada.
    assert E.que_toca("2026-11-02", "2026-12-01", CORREOS, set(), hasta) is None
    # Quien compra el último día no recibe el «Último día» (llega el ebook).
    assert E.que_toca("2026-11-30", "2026-11-30", CORREOS, set(), hasta) is None


def test_ventas_y_vuelta():
    cfg = E.config_limpia(None)
    assert E.ventas_abiertas(cfg, "2026-10-28") == (True, "")  # se puede probar antes de empezar
    assert E.ventas_abiertas(cfg, "2026-11-30")[0]
    assert not E.ventas_abiertas(cfg, "2026-12-01")[0]
    assert not E.ventas_abiertas({**cfg, "activo": False}, "2026-11-01")[0]
    defecto = "https://blackfriday.holandesnawar.com/"
    assert E.vuelta_segura("https://blackfriday.holandesnawar.com/", defecto) == defecto
    assert E.vuelta_segura("http://localhost:4321/black-friday/", defecto) == "http://localhost:4321/black-friday/"
    assert E.vuelta_segura("https://malo.com/?x=holandesnawar.com", defecto) == defecto
    assert E.vuelta_segura("javascript:alert(1)", defecto) == defecto
    assert E.con_compra("https://a.holandesnawar.com/") == "https://a.holandesnawar.com/?compra={CHECKOUT_SESSION_ID}"
    assert E.con_compra("https://a.holandesnawar.com/?x=1").endswith("&compra={CHECKOUT_SESSION_ID}")


def test_textos():
    assert E.dia_largo("2026-11-30") == "lunes 30 de noviembre"
    assert E.dia_largo("2026-11-27") == "viernes 27 de noviembre"
    assert E.rellenar("¡Hola, {nombre}! Hasta el {hasta}.", {"nombre": "Ana", "hasta": "lunes 30"}) == "¡Hola, Ana! Hasta el lunes 30."
    assert E.rellenar("¡Hola, {nombre}!", {}) == "¡Hola!"
    assert E.huecos_que_no_valen("{nombre} {precio}") == ["precio"]
    assert E.nombre_pila("ANA lópez") == "Ana"
    # Lo cambiado en el panel se pone encima de lo de fábrica, por id.
    c = E.correos_limpios([{"id": "c2", "asunto": "Otro asunto", "dia": 999}, {"id": "nuevo", "asunto": "x"}])
    assert [x["id"] for x in c] == [x["id"] for x in CORREOS]
    c2 = next(x for x in c if x["id"] == "c2")
    assert c2["asunto"] == "Otro asunto" and c2["dia"] == 60 and c2["texto"]


def test_enlaces_firmados():
    with patch.object(E, "_secreto", return_value="secreto-de-prueba"), patch.object(
        E, "_api_url", return_value="https://app.holandesnawar.com/api/v1/ebook"
    ):
        descarga = E.enlace_descarga("ana@x.com")
        baja = E.enlace_baja("ana@x.com")
        assert E.leer_token(descarga.rsplit("/", 1)[1], "ebook") == "ana@x.com"
        # El de baja no sirve para descargar ni al revés.
        assert E.leer_token(baja.rsplit("/", 1)[1], "ebook") == ""
        assert E.leer_token(baja.rsplit("/", 1)[1], "baja") == "ana@x.com"
        assert E.leer_token("token-roto", "ebook") == ""


def _sesion(cs="cs_test_1", email="ana@x.com", pagado=True, canal="ads"):
    return {
        "id": cs,
        "payment_status": "paid" if pagado else "unpaid",
        "amount_total": 100,
        "currency": "eur",
        "customer_details": {"email": email, "name": "Ana López"},
        "metadata": {
            "producto": E.PRODUCTO,
            "nombre": "Ana López",
            "email": email,
            "canal": canal,
            "recorrido": "bf-ebook-ads",
            "utm_source": "facebook",
            "utm_medium": "paid",
            "utm_campaign": "ebook-bf",
        },
    }


@pytest.fixture
def sin_redis_ni_crm(monkeypatch):
    monkeypatch.setattr(E, "_redis", lambda: None)
    monkeypatch.setattr(E, "_secreto", lambda: "secreto-de-prueba")

    async def nada(*a, **k):
        return None

    import src.services.crm.systeme as S

    monkeypatch.setattr(S, "etiquetar", nada)


async def test_la_compra_se_atiende_una_vez(db, org, sin_redis_ni_crm):
    mandados = []
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        assert await E.al_pagar(_sesion(), db) == "enviado"
        assert await E.al_pagar(_sesion(), db) == "ya-atendida"  # el webhook y la página de vuelta
        assert await E.al_pagar(_sesion(pagado=False, cs="cs_otra"), db) == "sin-pagar"
        assert await E.al_pagar({**_sesion(cs="cs_x"), "metadata": {"producto": "formacion"}}, db) == "no-es-ebook"
    assert len(mandados) == 1 and mandados[0]["to"] == "ana@x.com"
    assert "Descargar el ebook" in mandados[0]["body"] and "/ebook/descarga/" in mandados[0]["body"]
    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_COMPRA))).scalars().all()
    assert len(ev) == 1 and ev[0].utm_medium == "paid" and ev[0].recorrido == "bf-ebook-ads"
    assert json.loads(ev[0].extra)["session_id"] == "cs_test_1"


async def test_si_el_correo_falla_no_queda_marcada(db, org, sin_redis_ni_crm):
    with patch.object(M, "send_email", side_effect=RuntimeError("Resend caído")):
        with pytest.raises(RuntimeError):
            await E.al_pagar(_sesion(cs="cs_falla"), db)
    assert not (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_COMPRA))).scalars().all()


async def test_la_campana_y_cuando_se_para(db, org, sin_redis_ni_crm, monkeypatch):
    with patch.object(M, "send_email", side_effect=lambda **k: None):
        for i, email in enumerate(["ana@x.com", "luis@x.com", "eva@x.com", "leo@x.com"]):
            await E.al_pagar(_sesion(cs=f"cs_{i}", email=email), db)
    # Todos compraron «hoy» (UTC): se ponen en el 02/11 para la prueba.
    for ev in (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_COMPRA))).scalars().all():
        ev.created_at = "2026-11-02T10:00:00+00:00"
        db.add(ev)
    # Luis reservó su llamada, Eva se dio de baja y Leo ya es alumno.
    db.add(ContactEvent(email="luis@x.com", kind="reunion", created_at="2026-11-02T12:00:00+00:00"))
    await E.baja("eva@x.com", db)
    await db.commit()

    async def pagaron(_db):
        return {"leo@x.com"}

    import src.services.contactos.contactos as Cc

    monkeypatch.setattr(Cc, "emails_que_pagaron", pagaron)
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-03")
    mandados = []
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        r = await E.enviar_campana(db)
        assert r["enviados"] == 1 and r["parados"] == 3
        # Repetir el mismo día no manda nada más.
        assert (await E.enviar_campana(db))["enviados"] == 0
    assert [m["to"] for m in mandados] == ["ana@x.com"]
    assert "Cómo sacarle partido" in mandados[0]["subject"]
    assert "/ebook/baja/" in mandados[0]["body"]  # siempre con la baja al pie
    n = await E.resumen(1, db)
    assert n["compradores"] == 4 and n["en_campana"] == 1 and n["reservaron"] == 1 and n["bajas"] == 1
    assert n["pagaron"] == 1 and n["por_correo"] == {"c1": 1}

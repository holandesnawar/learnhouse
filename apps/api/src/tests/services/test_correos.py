"""Panel → Correos (services/correos/correos.py) y el próximo correo de cada
persona (`ebook.que_le_toca` / `ebook.proximo`).

- Cada persona sale con su situación, el último correo y el próximo: el MISMO
  que mandaría la tarea diaria.
- Cada correo del recorrido cuenta a cuántos les llegó, cuántos lo tienen como
  próximo, quién volvió por él y quién reservó o pagó después.
- Las pruebas (fuera de los números) no cuentan.
- La línea de tiempo de una persona junta sus correos y lo que hizo.
"""

import json
from unittest.mock import patch

import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment
from src.db.panel_negocio import EmailLog
from src.services.correos import correos as C
from src.services.ebook import ebook as E
from src.services.panel import tandas
from src.services.users import emails as M

_ = (EmailLog, Enrollment)  # las tablas tienen que existir en la base de pruebas


def _sesion(cs, email):
    return {
        "id": cs, "payment_status": "paid", "amount_total": 100, "currency": "eur",
        "customer_details": {"email": email, "name": email.split("@")[0].title()},
        "metadata": {"producto": E.PRODUCTO, "nombre": email.split("@")[0].title(), "email": email, "canal": "ads"},
    }


@pytest.fixture
def sin_redis_ni_crm(monkeypatch):
    monkeypatch.setattr(E, "_redis", lambda: None)
    monkeypatch.setattr(E, "_secreto", lambda: "secreto-de-prueba")

    async def nada(*a, **k):
        return None

    import src.services.crm.systeme as S

    monkeypatch.setattr(S, "etiquetar", nada)


def test_el_proximo_correo_es_el_que_mandaria_la_tarea():
    cfg = E.config_limpia({"hasta": "2026-11-30"})
    vacio = {"compras": {}, "listas": {}, "a_medias": {}, "gente": {}, "formulario": {}, "enviados": {}, "ultimo": {},
             "bajas": set(), "reservaron": set()}
    p = {**vacio, "compras": {"ana@x.com": {"creado": "2026-11-02T10:00:00+00:00", "dia": "2026-11-02", "nombre": "Ana"}},
         "enviados": {"ana@x.com": {"c1"}}, "ultimo": {"ana@x.com": "2026-11-03"}}
    # Recibió el c1 el día 3: el c2 toca el 5 (3 días después de comprar).
    assert E.proximo("ana@x.com", "2026-11-03", p, cfg, set()) == {"id": "c2", "asunto": CORREO["c2"], "dia": "2026-11-05"}
    # El mismo día que la tarea manda uno, el próximo no es «hoy».
    assert E.que_le_toca("ana@x.com", "2026-11-03", p, cfg, set()) is None
    # Si reserva o paga, nada más.
    assert E.proximo("ana@x.com", "2026-11-03", {**p, "reservaron": {"ana@x.com"}}, cfg, set()) is None
    assert E.proximo("ana@x.com", "2026-11-03", p, cfg, {"ana@x.com"}) is None
    # Con la campaña apagada, tampoco.
    assert E.proximo("ana@x.com", "2026-11-03", p, {**cfg, "campana": False}, set()) is None
    # Quien solo desbloqueó: el recordatorio al día siguiente y luego el del Black Friday.
    q = {**vacio, "a_medias": {"leo@x.com": {"creado": "2026-11-20T10:00:00+00:00", "dia": "2026-11-20", "nombre": "Leo"}},
         "enviados": {"leo@x.com": {"acceso"}}, "ultimo": {"leo@x.com": "2026-11-20"}}
    assert E.proximo("leo@x.com", "2026-11-20", q, cfg, set())["id"] == E.ID_PENDIENTE
    q2 = {**q, "enviados": {"leo@x.com": {"acceso", E.ID_PENDIENTE}}, "ultimo": {"leo@x.com": "2026-11-21"}}
    assert E.proximo("leo@x.com", "2026-11-21", q2, cfg, set()) == {"id": "e-bf", "asunto": CORREO["e-bf"], "dia": "2026-11-27"}


CORREO = {c["id"]: c["asunto"] for c in E.DE_FABRICA["correos"]}


async def test_el_panel_de_correos(db, org, sin_redis_ni_crm, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-02")
    with patch.object(M, "send_email", side_effect=lambda **k: None):
        for i, email in enumerate(["ana@x.com", "eva@x.com", "luis@x.com"]):
            await E.al_pagar(_sesion(f"cs_{i}", email), db)
        await E.apuntar_lista({"nombre": "Leo", "email": "leo@x.com"}, db)
        await E.apuntar_lista({"nombre": "Prueba", "email": "prueba@x.com"}, db)
    for ev in (await db.execute(select(ContactEvent))).scalars().all():
        ev.created_at = "2026-11-02T10:00:00+00:00"
        db.add(ev)
    await db.commit()

    import src.services.contactos.contactos as Cc
    import src.services.contactos.metricas as Mt

    async def nadie(_db):
        return set()

    async def pruebas(_db):
        return {"prueba@x.com"}

    monkeypatch.setattr(Cc, "emails_que_pagaron", nadie)
    monkeypatch.setattr(Mt, "emails_excluidos", pruebas)
    # El día 3 sale el c1 a los tres compradores y el recordatorio a Leo (y a
    # la prueba: quitar de los números no para los correos, solo las cuentas).
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-03")
    with patch.object(M, "send_email", side_effect=lambda **k: None):
        assert (await E.enviar_campana(db))["enviados"] == 5
    for ev in (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_CORREO))).scalars().all():
        if not ev.created_at.startswith("2026-11-02"):  # los que acaba de mandar la tarea
            ev.created_at = "2026-11-03T08:00:00+00:00"
            db.add(ev)
    # Eva vuelve por el c1 y reserva; Luis empieza la llamada.
    db.add(ContactEvent(email="eva@x.com", kind="reunion", created_at="2026-11-03T12:00:00+00:00",
                        utm_source="email", utm_campaign="black-friday", utm_content="c1"))
    db.add(ContactEvent(email="luis@x.com", kind="agendar-empezado", created_at="2026-11-03T13:00:00+00:00",
                        utm_source="email", utm_campaign="black-friday", utm_content="c1",
                        extra=json.dumps({"embudo": "black-friday"})))
    await db.commit()

    d = await C.panel(org.id, db)
    r = d["resumen"]
    assert r["entraron"] == 4 and r["compraron"] == 3  # la prueba no cuenta
    assert r["reservaron"] == 1 and r["por_situacion"]["llamada"] == 1
    personas = {x["email"]: x for x in d["personas"]}
    assert "prueba@x.com" not in personas
    assert personas["eva@x.com"]["etiqueta"] == "reservó" and personas["eva@x.com"]["proximo"] is None
    assert personas["ana@x.com"]["ultimo"]["id"] == "c1" and personas["ana@x.com"]["recibidos"] == 2  # entrega + c1
    assert personas["ana@x.com"]["proximo"] == {"id": "c2", "asunto": CORREO["c2"], "dia": "2026-11-05"}
    # Luis empezó la llamada: lo próximo es «te quedaste a un paso», mañana.
    assert personas["luis@x.com"]["proximo"]["id"] == E.ID_FORMULARIO and personas["luis@x.com"]["proximo"]["dia"] == "2026-11-04"
    assert personas["leo@x.com"]["etiqueta"] == "sin comprar" and personas["leo@x.com"]["ultimo"]["id"] == E.ID_PENDIENTE

    pasos = {x["id"]: x for x in d["pasos"]}
    assert pasos["entrega"]["enviados"] == 3
    c1 = pasos["c1"]
    assert c1["enviados"] == 3 and c1["volvieron"] == 2 and c1["reservaron_despues"] == 1
    assert pasos["c2"]["esperando"] == 1 and pasos[E.ID_FORMULARIO]["esperando"] == 1
    assert pasos[E.ID_PENDIENTE]["enviados"] == 1 and pasos[E.ID_PENDIENTE]["grupo"] == E.PARA_SIN_COMPRAR
    assert pasos[E.ID_FORMULARIO]["lateral"] is True
    # Orden: primero la rama de quien no compró, luego la de quien compró.
    assert [x["grupo"] for x in d["pasos"]][:2] == [E.PARA_SIN_COMPRAR, E.PARA_SIN_COMPRAR]


def test_linea_de_tiempo():
    linea = C.linea_de_tiempo(
        [{"kind": "ebook", "cuando": "2026-11-02T10:00:00+00:00"},
         {"kind": "reunion", "cuando": "2026-11-05T10:00:00+00:00", "desde": "Por qué el neerlandés se atasca"},
         {"kind": "otra-cosa", "cuando": "2026-11-06T10:00:00+00:00"}],
        [{"email": "a@x.com", "asunto": "Por qué el neerlandés se atasca (y no es culpa tuya)", "ok": True, "cuando": "2026-11-05T08:00:00+00:00"},
         {"email": "a@x.com", "asunto": "Bienvenido a la escuela", "ok": False, "cuando": "2026-11-01T08:00:00+00:00"}],
        {"por qué el neerlandés se atasca (y no es culpa tuya)": "c2"},
    )
    assert [x["texto"][:18] for x in linea] == ["Reservó la llamada", "Por qué el neerlan", "Compró el ebook", "Bienvenido a la es"]
    assert linea[0]["texto"].endswith("(desde el correo «Por qué el neerlandés se atasca»)")
    assert linea[1]["campana"] == "Black Friday" and linea[1]["correo"] == "c2"
    assert linea[3]["ok"] is False and linea[3]["campana"] == ""


def test_con_los_correos_en_systeme_el_panel_los_calcula():
    """29/10: con la campaña de la escuela apagada, los correos los manda
    systeme.io. El recorrido son sus pasos y newsletters; a quién le llegó
    cada uno se calcula con su calendario desde que se encendieron; quién
    volvió por un botón, se mide."""
    from datetime import datetime, timezone

    cfg = {**E.config_limpia({"hasta": "2026-11-30"}), "campana": False, "systeme_desde": "2026-11-01"}
    ahora = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)

    def ev(kind, when, **k):
        return {"kind": kind, "when": when, "phone": "", "recorrido": "", "utm_source": "", "utm_medium": "",
                "utm_campaign": "", "utm_content": "", "extra": {}, **k}

    fichas = [
        # Leo se apuntó el 2 y no compra: n0, n1 y n3 ya; el n5, el 7.
        {"email": "leo@x.com", "nombre": "Leo", "pasos": [], "etapa": "",
         "eventos": [ev("bf-lista", "2026-11-02T10:00:00+00:00")]},
        # Ana se apuntó por la newsletter, compró el 3 y volvió por el c1 a pedir la llamada.
        {"email": "ana@x.com", "nombre": "Ana", "pasos": [], "etapa": "",
         "eventos": [
             ev("bf-lista", "2026-11-02T09:00:00+00:00", utm_source="email", utm_campaign="black-friday", utm_content="nl-abrimos-2"),
             ev("ebook", "2026-11-03T10:00:00+00:00"),
             ev("reunion", "2026-11-04T15:00:00+00:00", utm_source="email", utm_campaign="black-friday", utm_content="sys-c1"),
         ]},
        # Una prueba: no cuenta.
        {"email": "prueba@x.com", "nombre": "Prueba", "pasos": [], "etapa": "",
         "eventos": [ev("bf-lista", "2026-11-02T10:00:00+00:00")]},
    ]
    d = C.armar_panel_systeme(cfg=cfg, fichas=fichas, pagaron=set(), fuera={"prueba@x.com"}, hoy="2026-11-06",
                              ahora=ahora, pagos={}, envios=[])
    assert d["campana"]["fuente"] == "systeme" and d["campana"]["activa"] is True
    personas = {x["email"]: x for x in d["personas"]}
    assert set(personas) == {"leo@x.com", "ana@x.com"}
    assert personas["leo@x.com"]["ultimo"]["id"] == "sys-n3" and personas["leo@x.com"]["proximo"]["id"] == "sys-n5"
    assert personas["leo@x.com"]["proximo"]["dia"] == "2026-11-07"
    assert personas["ana@x.com"]["situacion"] == "reservo" and personas["ana@x.com"]["proximo"] is None
    pasos = {x["id"]: x for x in d["pasos"]}
    assert pasos["sys-n0"]["enviados"] == 2 and pasos["sys-n5"]["esperando"] == 1
    assert pasos["sys-c1"]["enviados"] == 1 and pasos["sys-c1"]["volvieron"] == 1 and pasos["sys-c1"]["reservaron_despues"] == 1
    assert pasos["entrega"]["enviados"] == 1 and pasos["entrega"]["enlace"] == ""
    assert pasos["sys-n0"]["enlace"].startswith("https://systeme.io/dashboard/campaigns/1222373/")
    news = {x["id"]: x for x in d["newsletters"]}
    assert news["nl-abrimos"]["volvieron"] == 1 and news["nl-abrimos"]["reservaron_despues"] == 1
    assert news["nl-lista"]["volvieron"] == 0

    # Sin el día en que se encendieron, nadie está en ninguna campaña.
    d2 = C.armar_panel_systeme(cfg={**cfg, "systeme_desde": ""}, fichas=fichas, pagaron=set(), fuera=set(), hoy="2026-11-06",
                               ahora=ahora, pagos={}, envios=[])
    assert d2["campana"]["activa"] is False and d2["resumen"]["enviados"] == 1  # solo la entrega del ebook

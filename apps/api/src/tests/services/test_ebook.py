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


def test_recordatorio_a_quien_no_termino_de_pagar():
    hasta = "2026-11-30"
    assert not E.toca_pendiente("2026-11-02", "2026-11-02", set(), hasta)  # el mismo día, no
    assert E.toca_pendiente("2026-11-02", "2026-11-03", set(), hasta)  # al día siguiente
    assert E.toca_pendiente("2026-11-02", "2026-11-05", set(), hasta)  # si la tarea falló, hasta 2 días tarde
    assert not E.toca_pendiente("2026-11-02", "2026-11-06", set(), hasta)  # más tarde ya no pinta nada
    assert not E.toca_pendiente("2026-11-02", "2026-11-03", {E.ID_PENDIENTE}, hasta)  # uno solo
    assert not E.toca_pendiente("2026-11-02", "2026-11-03", set(), hasta, ultimo_envio="2026-11-03")
    assert not E.toca_pendiente("2026-11-30", "2026-12-01", set(), hasta)  # nada después del final


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


def test_la_web_manda_el_recorrido_como_lista():
    from src.routers.ebook import PagoIn

    p = PagoIn(nombre="Ana", email="a@x.com", recorrido=["home", "bf-ebook-ads", "<script>"], utm_source=None)
    assert p.recorrido == "home,bf-ebook-ads" and p.utm_source == ""
    assert PagoIn(recorrido="bf-ebook").recorrido == "bf-ebook"


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


async def test_quien_no_termina_de_pagar_queda_y_recibe_un_recordatorio(db, org, sin_redis_ni_crm, monkeypatch):
    meta = {"utm_source": "facebook", "utm_medium": "paid", "recorrido": "bf-ebook-ads"}
    # Ana abre la caja dos veces el mismo día: una sola línea en su ficha.
    await E._apuntar_empezado("ana@x.com", "Ana López", "ads", meta, "cs_a1", db)
    await E._apuntar_empezado("ana@x.com", "Ana López", "ads", {}, "cs_a2", db)
    filas = (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_EMPEZADO))).scalars().all()
    assert len(filas) == 1 and filas[0].utm_medium == "paid" and json.loads(filas[0].extra)["session_id"] == "cs_a2"
    # Luis también la abre, pero paga.
    await E._apuntar_empezado("luis@x.com", "Luis", "organico", {}, "cs_l1", db)
    with patch.object(M, "send_email", side_effect=lambda **k: None):
        await E.al_pagar(_sesion(cs="cs_l1", email="luis@x.com"), db)
    for ev in (await db.execute(select(ContactEvent).where(ContactEvent.kind.in_([E.TIPO_EMPEZADO, E.TIPO_COMPRA])))).scalars().all():
        ev.created_at = "2026-11-02T10:00:00+00:00"
        db.add(ev)
    await db.commit()

    async def nadie(_db):
        return set()

    import src.services.contactos.contactos as Cc

    monkeypatch.setattr(Cc, "emails_que_pagaron", nadie)
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-03")
    mandados = []
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        r = await E.enviar_campana(db)
        assert r["recordatorios"] == 1 and r["a_medias"] == 1
        assert (await E.enviar_campana(db))["enviados"] == 0  # no se repite
    para_ana = [m for m in mandados if m["to"] == "ana@x.com"]
    assert len(para_ana) == 1 and para_ana[0]["subject"] == E.DE_FABRICA["pendiente"]["asunto"]
    assert "/ebook?" in para_ana[0]["body"] and "utm_content=pendiente" in para_ana[0]["body"]
    assert "/ebook/baja/" in para_ana[0]["body"]
    # Luis (que pagó) recibe su campaña, no el recordatorio.
    assert [m["subject"] for m in mandados if m["to"] == "luis@x.com"] == ["Cómo sacarle partido a tu ebook"]
    n = await E.resumen(1, db)
    assert n["a_medias"] == 1 and n["por_correo"].get(E.ID_PENDIENTE) == 1


async def test_la_portada_desbloquea_el_ebook_y_la_campana_es_para_quien_lo_compra(db, org, sin_redis_ni_crm, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-02")
    mandados = []
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        r = await E.apuntar_lista({"nombre": "Ana López", "email": "ANA@x.com", "telefono": "0031 6 1234 5678",
                                   "utm_source": "instagram", "recorrido": "bf-desbloquear"}, db)
        assert r == {"ok": True, "nuevo": True}
        # Repetirlo no duplica ni vuelve a mandar el correo.
        assert (await E.apuntar_lista({"nombre": "Ana", "email": "ana@x.com"}, db))["nuevo"] is False
        # Luis también se apunta, y compra el ebook ese mismo día.
        await E.apuntar_lista({"nombre": "Luis", "email": "luis@x.com"}, db)
    filas = (await db.execute(select(ContactEvent).where(ContactEvent.kind == E.TIPO_LISTA))).scalars().all()
    ana = next(f for f in filas if f.email == "ana@x.com")
    assert len(filas) == 2 and ana.phone == "+31612345678" and ana.utm_source == "instagram"
    # El correo de acceso: la oferta desbloqueada es el ebook, con sus datos puestos.
    acceso = [m for m in mandados if m["to"] == "ana@x.com"]
    assert len(acceso) == 1 and acceso[0]["subject"] == E.DE_FABRICA["acceso"]["asunto"]
    assert "/ebook?" in acceso[0]["body"] and "/oferta" not in acceso[0]["body"] and "/ebook/baja/" in acceso[0]["body"]
    with pytest.raises(E.EbookError):
        await E.apuntar_lista({"nombre": "", "email": "x@x.com"}, db)

    with patch.object(M, "send_email", side_effect=lambda **k: None):
        await E.al_pagar(_sesion(cs="cs_luis", email="luis@x.com"), db)

    import src.services.contactos.contactos as Cc

    async def nadie(_db):
        return set()

    monkeypatch.setattr(Cc, "emails_que_pagaron", nadie)
    for ev in (await db.execute(select(ContactEvent).where(ContactEvent.kind.in_([E.TIPO_LISTA, E.TIPO_COMPRA, E.TIPO_CORREO])))).scalars().all():
        ev.created_at = "2026-11-02T10:00:00+00:00"
        db.add(ev)
    await db.commit()
    mandados.clear()
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        # Al día siguiente: Ana (no compró) recibe el recordatorio del ebook;
        # Luis (compró) empieza la campaña.
        monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-03")
        assert (await E.enviar_campana(db))["enviados"] == 2
        # Y Ana no recibe nada más de la campaña de la formación.
        for dia in ("2026-11-05", "2026-11-07", "2026-11-09"):
            monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None, d=dia: d)
            await E.enviar_campana(db)
    a_ana = [m["subject"] for m in mandados if m["to"] == "ana@x.com"]
    assert a_ana == [E.DE_FABRICA["pendiente"]["asunto"]]
    a_luis = [m["subject"] for m in mandados if m["to"] == "luis@x.com"]
    assert a_luis[:2] == [E.DE_FABRICA["correos"][0]["asunto"], E.DE_FABRICA["correos"][1]["asunto"]]
    n = await E.resumen(1, db)
    assert n["lista"] == 2 and n["compradores"] == 1 and n["a_medias"] == 1 and n["en_campana"] == 1
    por_quien = {u["email"]: (u["via"], u["estado"]) for u in n["ultimos"]}
    assert por_quien == {"ana@x.com": ("desbloqueó", "sin comprar"), "luis@x.com": ("desbloqueó y compró", "en campaña")}
    # Pasado el final, ya no se desbloquea nada.
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-12-01")
    with pytest.raises(E.EbookError):
        await E.apuntar_lista({"nombre": "Eva", "email": "eva@x.com"}, db)


def test_los_textos_de_fabrica_de_antes_no_se_quedan():
    """El panel guarda las cartas enteras: el acceso de antes (que llevaba a la
    formación) vuelve al de ahora si nadie lo tocó; uno retocado se respeta."""
    viejo = {"asunto": "Tu acceso a la oferta de Black Friday", "texto": E._FABRICA_ANTERIOR["acceso"], "boton": "Ver mi oferta",
             "destino": "landing", "apagado": False}
    cfg = E.config_limpia({"acceso": viejo})
    assert cfg["acceso"]["destino"] == "ebook" and cfg["acceso"]["asunto"] == E.DE_FABRICA["acceso"]["asunto"]
    retocado = {**viejo, "texto": viejo["texto"].replace("Aquí tienes", "Mira")}
    assert E.config_limpia({"acceso": retocado})["acceso"]["destino"] == "landing"
    assert E.config_limpia({"acceso": {**viejo, "apagado": True}})["acceso"]["apagado"] is True


def test_los_botones_de_los_correos_llevan_a_la_oferta():
    with patch.object(E, "bf_url", return_value="https://blackfriday.holandesnawar.com"):
        assert E.url_destino("landing", "a@x.com", "Ana", "c1").startswith("https://blackfriday.holandesnawar.com/oferta?")
        assert E.url_destino("admision", "a@x.com", "Ana", "c1").startswith("https://blackfriday.holandesnawar.com/admision?")
        assert E.url_destino("ebook", "a@x.com", "Ana", "acceso").startswith("https://blackfriday.holandesnawar.com/ebook?")


async def test_la_campana_segmentada(db, org, sin_redis_ni_crm, monkeypatch):
    """Quien compró y empezó a pedir la llamada sin reservar recibe «te
    quedaste a un paso»; quien terminó y no encaja sale de la campaña; quien no
    compró recibe los del ebook de fecha fija, nunca los de la formación."""
    with patch.object(M, "send_email", side_effect=lambda **k: None):
        for i, email in enumerate(["ana@x.com", "luis@x.com", "eva@x.com"]):
            await E.al_pagar(_sesion(cs=f"cs_{i}", email=email), db)
        await E.apuntar_lista({"nombre": "Leo", "email": "leo@x.com"}, db)
    for ev in (await db.execute(select(ContactEvent))).scalars().all():
        ev.created_at = "2026-11-20T10:00:00+00:00"
        db.add(ev)
    # Ana empieza el formulario de la llamada el 21 y no reserva; Luis lo
    # termina el 21 y no encaja.
    db.add(ContactEvent(email="ana@x.com", kind="agendar-empezado", created_at="2026-11-21T18:00:00+00:00",
                        extra=json.dumps({"embudo": "black-friday"})))
    db.add(ContactEvent(email="luis@x.com", kind="cualificacion", created_at="2026-11-21T18:00:00+00:00",
                        extra=json.dumps({"embudo": "black-friday", "apto": False})))
    await db.commit()

    import src.services.contactos.contactos as Cc

    async def nadie(_db):
        return set()

    monkeypatch.setattr(Cc, "emails_que_pagaron", nadie)
    mandados = []
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-22")
        r = await E.enviar_campana(db)
        assert r["formulario"] == 1 and r["no_encajan"] == 1
    a = {m["to"]: m["subject"] for m in mandados}
    assert a["ana@x.com"] == E.DE_FABRICA[E.ID_FORMULARIO]["asunto"]
    assert "luis@x.com" not in a  # no encaja: fuera de la campaña
    # Eva sigue la campaña normal: el c1 (tocaba el 21 y la tarea no pasó; va con un día de margen).
    assert a["eva@x.com"] == E.DE_FABRICA["correos"][0]["asunto"]
    # Leo no compró: el recordatorio del ebook, nunca uno de la formación.
    assert a["leo@x.com"] == E.DE_FABRICA["pendiente"]["asunto"]
    ana = next(m for m in mandados if m["to"] == "ana@x.com")
    assert "/admision?" in ana["body"] and "utm_content=formulario" in ana["body"]

    # El Black Friday: Leo (no compró) recibe el del ebook; Eva, el de la formación.
    mandados.clear()
    with patch.object(M, "send_email", side_effect=lambda **k: mandados.append(k)):
        monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-27")
        await E.enviar_campana(db)
    a = {m["to"]: m for m in mandados}
    assert a["leo@x.com"]["subject"] == "Hoy es Black Friday: tu ebook sigue a 1 €" and "/ebook?" in a["leo@x.com"]["body"]
    assert a["eva@x.com"]["subject"] == "Hoy es Black Friday"
    assert "luis@x.com" not in a
    n = await E.resumen(1, db)
    assert n["sin_reservar"] == 1 and n["no_encajan"] == 1
    estados = {u["email"]: u["estado"] for u in n["ultimos"]}
    assert estados == {"ana@x.com": "empezó la llamada", "luis@x.com": "no encaja", "eva@x.com": "en campaña", "leo@x.com": "sin comprar"}


def test_el_pie_dice_por_que_le_escribimos():
    """A quien solo desbloqueó la oferta no se le dice que compró (29/10)."""
    cfg = E.config_limpia({})
    acceso = E.armar_acceso(cfg, "a@x.com", "Ana", preview=True)["html"]
    pendiente = E.armar_pendiente(cfg, "a@x.com", "Ana", preview=True)["html"]
    por_correo = {c["id"]: c for c in cfg["correos"]}
    e_bf = E.armar_correo(cfg, por_correo["e-bf"], "a@x.com", "Ana", preview=True)["html"]
    c1 = E.armar_correo(cfg, por_correo["c1"], "a@x.com", "Ana", preview=True)["html"]
    for html in (acceso, pendiente, e_bf):
        assert "desbloqueaste la oferta" in html and "compraste" not in html
    assert "porque compraste el ebook" in c1

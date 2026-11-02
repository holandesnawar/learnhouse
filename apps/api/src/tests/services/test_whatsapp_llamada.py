"""Los tres WhatsApp de cada llamada (02/11/2026): presentarte, el método en
PDF y el enlace. La escuela guarda los textos (iguales para todo el equipo),
el PDF que va en el segundo y qué se le ha mandado a cada cita."""

from datetime import datetime

import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.organization_config import OrganizationConfig
from src.services.contactos import whatsapp_llamada as W
from src.services.contactos.contactos import _evento, _que, fusionar_contactos


async def _con_config(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0"},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()


def test_los_textos_de_fabrica_llevan_lo_que_pidio_el_usuario():
    assert [p["id"] for p in W.PASOS] == ["presentacion", "recurso", "enlace"]
    uno, dos, tres = (W.DE_FABRICA[i] for i in W.IDS)
    # 1: quién es, «vi que tienes una llamada agendada mañana», qué se hace y que es por Meet.
    assert "soy {yo}" in uno and "agendada" in uno and "{dia}" in uno and "Google Meet" in uno
    # 2: «soy yo otra vez» y el PDF del método.
    assert "otra vez" in dos and "{pdf}" in dos
    # 3: «nuestra llamada es en 3 horas» y el enlace.
    assert "{falta}" in tres and "{enlace}" in tres
    for t in W.DE_FABRICA.values():
        assert W.huecos_que_no_valen(t) == []


def test_config_limpia_no_guarda_lo_de_fabrica():
    c = W.config_limpia({"textos": {"presentacion": W.DE_FABRICA["presentacion"], "enlace": " Hola {nombre} "}, "horas_antes": 40})
    assert c["textos"] == {"enlace": "Hola {nombre}"}
    assert c["horas_antes"] == 12
    assert W.config_limpia(None)["horas_antes"] == W.HORAS_ANTES


async def test_guardar_textos_enlace_y_volver_al_de_fabrica(db, org):
    await _con_config(db, org)
    r = W.para_la_pantalla(org.id, await W.leer(org.id, db))
    assert all(p["de_fabrica"] for p in r["pasos"]) and r["pdf"] == "" and r["horas_antes"] == 3

    r = await W.guardar(org.id, {"textos": {"enlace": "Hola {nombre}, es {falta}: {enlace}"}, "horas_antes": 2}, db)
    paso3 = next(p for p in r["pasos"] if p["id"] == "enlace")
    assert paso3["texto"] == "Hola {nombre}, es {falta}: {enlace}" and not paso3["de_fabrica"]
    assert r["horas_antes"] == 2

    # Un hueco mal escrito no deja guardar.
    with pytest.raises(W.WhatsAppError, match=r"\{Nombre\}"):
        await W.guardar(org.id, {"textos": {"presentacion": "Hola {Nombre}"}}, db)
    with pytest.raises(W.WhatsAppError, match="https"):
        await W.guardar(org.id, {"pdf_enlace": "drive.google.com/x"}, db)

    r = await W.guardar(org.id, {"pdf_enlace": "https://drive.google.com/metodo"}, db)
    assert r["pdf"] == "https://drive.google.com/metodo" and not r["pdf_subido"]
    # Vacío = el de fábrica; lo demás no se toca.
    r = await W.guardar(org.id, {"textos": {"enlace": ""}}, db)
    assert all(p["de_fabrica"] for p in r["pasos"]) and r["horas_antes"] == 2


async def test_el_pdf_subido_se_sirve_en_una_direccion_publica(db, org, tmp_path, monkeypatch):
    await _con_config(db, org)
    monkeypatch.setattr(W, "CONTENT_DIR", tmp_path)
    monkeypatch.setattr(W, "url_publica", lambda org_id: f"https://app.x/api/v1/contactos/metodo/{org_id}/{W.NOMBRE_PUBLICO}")
    with pytest.raises(W.WhatsAppError, match="no es un PDF"):
        await W.guardar_pdf(org.id, "metodo.pdf", b"hola", db)

    await W.guardar(org.id, {"pdf_enlace": "https://drive.google.com/metodo"}, db)
    r = await W.guardar_pdf(org.id, "Método.pdf", b"%PDF-1.4 uno", db)
    # El subido manda sobre el pegado.
    assert r["pdf_subido"] and r["pdf"].endswith(f"/metodo/{org.id}/{W.NOMBRE_PUBLICO}") and r["pdf_nombre"] == "Método.pdf"
    primero = await W.pdf_publico(org.id, db)
    assert primero and primero.read_bytes() == b"%PDF-1.4 uno"

    # Otro PDF: el viejo se borra del disco.
    await W.guardar_pdf(org.id, "v2.pdf", b"%PDF-1.4 dos", db)
    assert not primero.exists() and (await W.pdf_publico(org.id, db)).read_bytes() == b"%PDF-1.4 dos"

    r = await W.quitar_pdf(org.id, db)
    assert not r["pdf_subido"] and r["pdf"] == "https://drive.google.com/metodo"
    assert await W.pdf_publico(org.id, db) is None
    # Nada fuera de su carpeta.
    assert W.ruta_pdf("privado/ebook/1/x.pdf") is None and W.ruta_pdf("privado/whatsapp/../../x") is None


async def test_marcar_una_vez_por_cita_y_paso_y_desmarcar(db):
    r = await W.marcar("ev1:ana@x.com", "Ana@x.com", "presentacion", "2026-11-04T17:00:00Z", "Diego", db)
    assert r["ok"] and r["enviado"]["autor"] == "Diego"
    # El mismo paso otra vez (lo reenvía otro): no se duplica.
    await W.marcar("ev1:ana@x.com", "ana@x.com", "presentacion", "2026-11-04T17:00:00Z", "Belén", db)
    await W.marcar("ev1:ana@x.com", "ana@x.com", "recurso", "2026-11-04T17:00:00Z", "Diego", db)
    await W.marcar("ev2:luis@x.com", "luis@x.com", "enlace", "", "Diego", db)
    filas = (await db.execute(select(ContactEvent).where(ContactEvent.kind == W.KIND))).scalars().all()
    assert len(filas) == 3 and all(f.email in {"ana@x.com", "luis@x.com"} for f in filas)
    # No le cambia el nombre a la persona en su ficha.
    assert all(not f.first_name for f in filas)

    todos = await W.enviados(db)
    assert set(todos["ev1:ana@x.com"]) == {"presentacion", "recurso"}
    assert todos["ev1:ana@x.com"]["presentacion"]["autor"] == "Belén"
    assert set(todos["ev2:luis@x.com"]) == {"enlace"}

    assert (await W.desmarcar("ev1:ana@x.com", "recurso", db))["quitados"] == 1
    assert set((await W.enviados(db))["ev1:ana@x.com"]) == {"presentacion"}

    assert not (await W.marcar("ev3", "ana@x.com", "otro", "", "Diego", db))["ok"]
    assert not (await W.marcar("", "ana@x.com", "enlace", "", "Diego", db))["ok"]
    assert not (await W.marcar("ev3", "sin-arroba", "enlace", "", "Diego", db))["ok"]


def test_en_la_ficha_y_en_el_tablero():
    ev = _evento("whatsapp-llamada", "2026-11-02T10:00:00+00:00", "ana@x.com",
                 extra={"cita_id": "ev1", "paso": "recurso", "inicio": "2026-11-04T17:00:00Z", "autor": "Diego"})
    texto = _que("whatsapp-llamada", {"extra": ev["extra"]})
    assert texto.startswith("Diego le mandó el WhatsApp 2 de 3 («El método en PDF») de su llamada del ")
    assert "18:00" in texto

    reserva = _evento("reunion", "2026-11-01T09:00:00+00:00", "ana@x.com")
    fichas = fusionar_contactos([reserva, ev], set())
    assert W.enviados_de_fichas(fichas) == {"ev1": {"recurso"}}
    # Mandarle un WhatsApp no es «lo último que hizo» ella.
    assert fichas[0]["ultimo_contacto"]["kind"] == "reunion"

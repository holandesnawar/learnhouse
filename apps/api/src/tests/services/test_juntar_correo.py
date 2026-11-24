"""Juntar lo de una persona que cambió de correo (24/11/2026), contra una base
de datos de verdad (SQLite en memoria): su pago, su ficha, sus notas y su plan
pasan al correo nuevo, la lista de correos enviados no, y queda escrito en su
ficha sin contar como origen."""

import json

from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.contact_seguimiento import ContactNota
from src.db.enrollment import Enrollment
from src.db.llamadas_templadas import LlamadaTemplada
from src.db.panel_negocio import EmailLog, LeadPipeline
from src.services.contactos.contactos import _todos_los_eventos, fusionar_contactos
from src.services.contactos.juntar_correo import mover, texto_linea_de_tiempo


async def test_todo_pasa_al_correo_nuevo(db):
    db.add(Enrollment(email="Yoja@Viejo.com", status="paid", amount_cents=59700, paid_at="2026-11-01T10:00:00+00:00"))
    db.add(ContactEvent(email="yoja@viejo.com", kind="solicitud", first_name="Yoja", created_at="2026-10-30T10:00:00+00:00"))
    db.add(ContactNota(email="yoja@viejo.com", texto="Va a pagar", autor="Diego", created_at="2026-10-31T10:00:00+00:00"))
    db.add(LeadPipeline(email="yoja@viejo.com", etapa="seguimiento"))
    db.add(LlamadaTemplada(email="yoja@viejo.com", clave="auto:yoja@viejo.com", estado="hecha"))
    db.add(EmailLog(email="yoja@viejo.com", asunto="Welkom"))
    db.add(Enrollment(email="otra@x.com", status="paid", amount_cents=43500))
    await db.commit()

    r = await mover("yoja@viejo.com", "Yoja@Nuevo.com", db, por="Rida", user_id=7)
    assert r["movidas"] >= 5

    pagos = (await db.execute(select(Enrollment).where(Enrollment.email == "yoja@nuevo.com"))).scalars().all()
    assert len(pagos) == 1 and pagos[0].amount_cents == 59700
    assert (await db.execute(select(ContactNota).where(ContactNota.email == "yoja@nuevo.com"))).scalars().first()
    assert (await db.execute(select(LeadPipeline).where(LeadPipeline.email == "yoja@nuevo.com"))).scalars().first()
    t = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "yoja@nuevo.com"))).scalars().first()
    assert t.clave == "auto:yoja@nuevo.com"
    # Los correos enviados se quedan con la dirección de entonces.
    assert (await db.execute(select(EmailLog).where(EmailLog.email == "yoja@viejo.com"))).scalars().first()
    # Nadie más se toca.
    assert (await db.execute(select(Enrollment).where(Enrollment.email == "otra@x.com"))).scalars().first()
    # Del correo de antes no queda ninguna ficha.
    fichas = {f["email"]: f for f in fusionar_contactos(await _todos_los_eventos(db), set())}
    assert "yoja@viejo.com" not in fichas
    assert "yoja@nuevo.com" in fichas
    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == "correo-cambiado"))).scalars().first()
    assert json.loads(ev.extra)["antes"] == "yoja@viejo.com"


async def test_mismo_correo_no_hace_nada(db):
    r = await mover("a@x.com", " A@X.com ", db)
    assert r["movidas"] == 0


def test_texto():
    assert texto_linea_de_tiempo({"antes": "a@x.com", "ahora": "b@x.com", "por": "Rida"}) == "Su correo cambió de a@x.com a b@x.com (lo hizo Rida)"

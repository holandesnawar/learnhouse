"""Abrir una ficha ya no lee la tabla entera de eventos (16/11/2026): se filtra
por correo en la base de datos. El resultado para esa persona es el mismo."""

import pytest

from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment
from src.db.reservas import ReservaPago, ReservaPlaza
from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos


@pytest.mark.asyncio
async def test_los_eventos_de_una_persona_son_los_mismos_filtrando_en_sql(db):
    db.add(ContactEvent(email="ana@x.com", kind="guia", created_at="2026-11-01T10:00:00"))
    db.add(ContactEvent(email="ana@x.com", kind="reunion", created_at="2026-11-02T10:00:00"))
    db.add(ContactEvent(email="eva@x.com", kind="guia", created_at="2026-11-03T10:00:00"))
    db.add(Enrollment(email="ana@x.com", first_name="Ana", last_name="", status="paid", created_at="2026-11-04", paid_at="2026-11-04"))
    db.add(Enrollment(email="eva@x.com", first_name="Eva", last_name="", status="pending", created_at="2026-11-04"))
    r1 = ReservaPlaza(email="ana@x.com", first_name="Ana", last_name="", total_cents=59700, pagado_cents=5000, created_at="2026-11-05")
    r2 = ReservaPlaza(email="eva@x.com", first_name="Eva", last_name="", total_cents=59700, pagado_cents=5000, created_at="2026-11-05")
    db.add(r1)
    db.add(r2)
    await db.commit()
    await db.refresh(r1)
    await db.refresh(r2)
    for r in (r1, r2):
        db.add(ReservaPago(reserva_id=r.id, tipo="senal", importe_cents=5000, estado="pagado", paid_at="2026-11-05", created_at="2026-11-05"))
    await db.commit()

    def clave(e):
        return (e["kind"], e["when"], e["email"], str(e.get("extra")))

    for email in ("ana@x.com", "eva@x.com", "nadie@x.com"):
        antes = sorted(clave(e) for e in await _todos_los_eventos(db) if e["email"] == email)
        ahora = sorted(clave(e) for e in await _todos_los_eventos(db, email) if e["email"] == email)
        assert antes == ahora
    assert len([e for e in await _todos_los_eventos(db, "ana@x.com")]) == 5
    assert await _emails_con_cuenta(db, "ana@x.com") == set()

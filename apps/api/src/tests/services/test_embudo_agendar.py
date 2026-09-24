"""El embudo de /agendar se cuenta por persona, no por envío."""

from datetime import datetime, timezone

from src.services.contactos.embudo_agendar import resumen_agendar

AHORA = datetime(2026, 9, 24, 12, tzinfo=timezone.utc)


def test_cuenta_personas_y_pasos():
    ev = [
        {"kind": "agendar-empezado", "email": "a@x.com", "created_at": "2026-09-23T10:00:00+00:00"},
        {"kind": "cualificacion", "email": "a@x.com", "created_at": "2026-09-23T10:05:00+00:00", "extra": {"apto": True}},
        {"kind": "cualificacion", "email": "A@x.com", "created_at": "2026-09-23T10:09:00+00:00", "extra": {"apto": True}},
        {"kind": "reunion", "email": "a@x.com", "created_at": "2026-09-23T10:10:00+00:00"},
        {"kind": "agendar-empezado", "email": "b@x.com", "created_at": "2026-09-22T10:00:00+00:00"},
        {"kind": "cualificacion", "email": "c@x.com", "created_at": "2026-09-01T10:00:00+00:00", "extra": {"apto": False}},
    ]
    r = resumen_agendar(ev, AHORA)
    assert r["7d"] == {"empezaron": 2, "terminaron": 1, "encajan": 1, "no_encajan": 0, "reservaron": 1}
    assert r["30d"]["terminaron"] == 2
    assert r["30d"]["no_encajan"] == 1
    assert r["total"]["empezaron"] == 3


def test_los_excluidos_no_cuentan():
    ev = [{"kind": "agendar-empezado", "email": "prueba@x.com", "created_at": "2026-09-23T10:00:00+00:00"}]
    assert resumen_agendar(ev, AHORA, fuera={"prueba@x.com"})["total"]["empezaron"] == 0

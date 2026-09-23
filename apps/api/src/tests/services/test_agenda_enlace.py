"""El enlace de pago firmado y la lectura de las citas de Calendly."""

from src.services.contactos.agenda import cita_desde_calendly
from src.services.payments.enlace import DIAS_VALIDEZ, firmar, verificar

SECRETO = "x" * 40


def test_enlace_ida_y_vuelta():
    token = firmar({"e": "ana@x.com", "f": "Ana", "l": "Pérez", "p": "+316"}, SECRETO, ahora=1000)
    datos = verificar(token, SECRETO, ahora=1000 + 3600)
    assert datos["e"] == "ana@x.com" and datos["l"] == "Pérez"


def test_enlace_tocado_no_vale():
    token = firmar({"e": "ana@x.com", "f": "Ana"}, SECRETO, ahora=1000)
    cuerpo, firma = token.split(".")
    otro = firmar({"e": "otra@x.com", "f": "Ana"}, SECRETO, ahora=1000).split(".")[0]
    assert verificar(f"{otro}.{firma}", SECRETO, ahora=1000) is None
    assert verificar(token, "y" * 40, ahora=1000) is None
    assert verificar("basura", SECRETO) is None


def test_enlace_caduca():
    token = firmar({"e": "ana@x.com", "f": "Ana"}, SECRETO, ahora=1000)
    assert verificar(token, SECRETO, ahora=1000 + DIAS_VALIDEZ * 86400 + 1) is None


def test_cita_desde_calendly():
    evento = {
        "start_time": "2026-09-25T16:00:00.000000Z",
        "end_time": "2026-09-25T16:30:00.000000Z",
        "name": "Llamada de Consultoría HN",
        "location": {"type": "outbound_call", "location": "+31612345678"},
    }
    invitados = [
        {"name": "Ana", "email": "Ana@X.com", "status": "active", "cancel_url": "c", "reschedule_url": "r"},
        {"name": "Cancelada", "email": "b@x.com", "status": "canceled"},
    ]
    citas = cita_desde_calendly(evento, invitados)
    assert len(citas) == 1
    assert citas[0]["email"] == "ana@x.com"
    assert citas[0]["telefono"] == "+31612345678"
    assert citas[0]["inicio"].startswith("2026-09-25T16")


def test_cita_con_enlace_de_videollamada():
    evento = {"start_time": "t", "location": {"type": "zoom", "join_url": "https://zoom.us/j/1"}}
    citas = cita_desde_calendly(evento, [{"name": "Ana", "email": "a@x.com"}])
    assert citas[0]["enlace"] == "https://zoom.us/j/1" and citas[0]["telefono"] == ""

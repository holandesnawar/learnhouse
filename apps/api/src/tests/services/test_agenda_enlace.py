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
    citas = cita_desde_calendly({**evento, "uri": "https://api.calendly.com/scheduled_events/EV1"}, invitados)
    # Las canceladas también salen (el calendario las enseña tachadas).
    assert [c["estado"] for c in citas] == ["activa", "cancelada"]
    assert citas[0]["id"] == "EV1:ana@x.com"
    assert citas[0]["email"] == "ana@x.com"
    assert citas[0]["telefono"] == "+31612345678"
    assert citas[0]["inicio"].startswith("2026-09-25T16")


def test_cita_con_enlace_de_videollamada():
    evento = {"start_time": "t", "location": {"type": "zoom", "join_url": "https://zoom.us/j/1"}}
    citas = cita_desde_calendly(evento, [{"name": "Ana", "email": "a@x.com"}])
    assert citas[0]["enlace"] == "https://zoom.us/j/1" and citas[0]["telefono"] == ""


def test_cita_reprogramada_dice_por_que():
    evento = {"start_time": "t", "status": "canceled", "uri": "x/EV2"}
    inv = {"name": "Ana", "email": "a@x.com", "status": "canceled", "rescheduled": True, "cancellation": {"reason": "No puedo"}}
    c = cita_desde_calendly(evento, [inv])[0]
    assert c["estado"] == "cancelada" and c["reprogramada"] and c["motivo_cancelacion"] == "No puedo"


def test_calendario_de_google_desde_el_codigo_pegado():
    from src.services.contactos.resultado_llamada import calendario_de_google, url_de_google

    codigo = '<iframe src="https://calendar.google.com/calendar/embed?src=abc123%40group.calendar.google.com&ctz=Europe%2FAmsterdam" style="border: 0" width="800"></iframe>'
    cal = calendario_de_google(codigo)
    assert cal == {"ids": ["abc123@group.calendar.google.com"], "zona": "Europe/Amsterdam"}
    assert url_de_google(cal).startswith("https://calendar.google.com/calendar/embed?src=abc123%40group.calendar.google.com")
    # Lo que no es un calendario de Google no pasa.
    assert calendario_de_google('<iframe src="https://malo.com/x?src=a@b.c"></iframe>')["ids"] == []
    assert calendario_de_google("javascript:alert(1)")["ids"] == []

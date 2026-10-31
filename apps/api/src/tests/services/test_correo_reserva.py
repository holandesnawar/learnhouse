"""El correo de Rida al reservar una llamada (27/10/2026). Calendly es de
mentira: se comprueba la firma, qué se saca de cada aviso y que el correo sale
una sola vez por persona (ni en un cambio de hora, ni al volver a reservar)."""

import json
import time
from unittest.mock import patch

import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.organization_config import OrganizationConfig
from src.db.panel_negocio import LeadPipeline  # noqa: F401  (para que exista la tabla en la base de pruebas)
from src.services.contactos import correo_reserva as C
from src.services.users import emails as E

LLAMADA = "https://api.calendly.com/event_types/LLAMADA"
CLAVE = C.clave_firma("secreto-de-prueba")


def aviso(email="ana@x.com", nombre="ana lópez", tipo=LLAMADA, old_invitee=None, evento="invitee.created", **mas):
    payload = {
        "email": email,
        "name": nombre,
        "first_name": None,
        "timezone": "Europe/Amsterdam",
        "old_invitee": old_invitee,
        "reschedule_url": "https://calendly.com/reschedulings/abc",
        "cancel_url": "https://calendly.com/cancellations/abc",
        "uri": "https://api.calendly.com/scheduled_events/EV1/invitees/INV1",
        "questions_and_answers": [{"question": "Teléfono (WhatsApp)", "answer": "+31 6 1234 5678"}],
        "scheduled_event": {
            "uri": "https://api.calendly.com/scheduled_events/EV1",
            "event_type": tipo,
            "start_time": "2026-10-29T17:00:00.000000Z",
            "location": {"type": "zoom", "join_url": "https://zoom.us/j/123"},
        },
    }
    payload.update(mas)
    return {"event": evento, "payload": payload}


def firmado(cuerpo: dict, clave=CLAVE, t=None):
    crudo = json.dumps(cuerpo).encode()
    return crudo, C.firmar(crudo, clave, int(time.time() if t is None else t))


# ── la firma ───────────────────────────────────────────────────────────────


def test_la_firma_de_calendly():
    crudo, cabecera = firmado(aviso())
    assert C.firma_valida(cabecera, crudo, CLAVE)
    assert not C.firma_valida(cabecera, crudo, C.clave_firma("otro-secreto"))
    assert not C.firma_valida(cabecera, crudo + b" ", CLAVE)  # cuerpo tocado
    assert not C.firma_valida("", crudo, CLAVE)
    assert not C.firma_valida("v1=abc", crudo, CLAVE)
    viejo, cab_vieja = firmado(aviso(), t=time.time() - 3600)
    assert not C.firma_valida(cab_vieja, viejo, CLAVE)  # un aviso viejo reenviado
    # Con dos firmas (cambio de clave en Calendly), vale cualquiera.
    t = cabecera.split(",")[0]
    assert C.firma_valida(f"{t},v1=deadbeef,{cabecera.split(',')[1]}", crudo, CLAVE)


# ── lo que se saca de cada aviso ───────────────────────────────────────────


def test_lo_que_se_saca_de_una_reserva():
    r = C.reserva_de(aviso())
    assert r["email"] == "ana@x.com"
    assert r["nombre_pila"] == "Ana"
    assert r["telefono"] == "+31 6 1234 5678"
    assert r["enlace"] == "https://zoom.us/j/123"
    assert r["cambiar"].endswith("/abc")
    assert r["tipo_evento"] == LLAMADA
    assert r["cambio_de_hora"] is False
    assert C.reserva_de(aviso(old_invitee="https://api.calendly.com/.../OLD"))["cambio_de_hora"] is True
    assert C.reserva_de(aviso(evento="invitee.canceled")) is None
    assert C.reserva_de(aviso(email="")) is None


def test_dia_y_hora_en_la_hora_de_la_persona():
    assert C.cuando("2026-10-29T17:00:00.000000Z", "Europe/Amsterdam") == ("jueves 29 de octubre", "18:00")
    assert C.cuando("2026-10-29T17:00:00Z", "America/Mexico_City") == ("jueves 29 de octubre", "11:00")
    assert C.cuando("2026-10-29T17:00:00Z", "No/Existe") == ("jueves 29 de octubre", "18:00")
    assert C.cuando("", "") == ("", "")


def test_los_huecos():
    valores = {"nombre": "Ana", "dia": "jueves 29 de octubre", "hora": "18:00"}
    assert C.rellenar("¡Hola, {nombre}! El {dia} a las {hora}.", valores) == "¡Hola, Ana! El jueves 29 de octubre a las 18:00."
    assert C.rellenar("¡Hola, {nombre}!", {}) == "¡Hola!"
    assert C.huecos_que_no_valen("Hola {Nombre} {dia} {x}") == ["Nombre", "x"]
    assert C.huecos_que_no_valen(C.DE_FABRICA["asunto"] + C.DE_FABRICA["texto"]) == []


def test_el_correo_es_una_carta_de_rida():
    r = C.armar(C.reserva_de_ejemplo("ana@x.com", "Ana"), C.DE_FABRICA["asunto"], C.DE_FABRICA["texto"], preview=True)
    assert r["asunto"] == "Un mensaje de Rida antes de tu llamada"
    assert "¡Hola, Ana!" in r["html"] and "Rida Nawar" in r["html"]
    assert "El equipo de Nawar" not in r["html"]  # sin la firma del equipo: firma Rida
    assert "{" not in r["html"].split("<body")[1].split("<style")[0]


# ── el ciclo entero, con base de datos ─────────────────────────────────────


@pytest.fixture
async def escuela(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={"correo_reserva": {"activo": True}}))
    await db.commit()
    return org


class Envios:
    def __init__(self, falla=False):
        self.a: list[tuple[str, str, str]] = []
        self.falla = falla

    def __call__(self, email, asunto, texto, preview=False):
        if self.falla:
            raise RuntimeError("Resend no contesta")
        self.a.append((email, asunto, texto))
        return None


async def _sin_aviso_al_equipo(*a, **k):
    return None


async def _tipo():
    return LLAMADA


def _parches(envios):
    return [
        patch.object(C, "_secreto", lambda: "secreto-de-prueba"),
        patch.object(C, "_tipo_de_llamada", _tipo),
        patch.object(C, "_avisar_reparto", _sin_aviso_al_equipo),
        patch.object(C, "_redis", lambda: None),
        patch.object(E, "send_correo_reserva_email", envios),
    ]


async def _atender(db, cuerpo, envios):
    crudo, cabecera = firmado(cuerpo)
    ps = _parches(envios)
    for p in ps:
        p.start()
    try:
        return await C.atender_aviso(crudo, cabecera, db)
    finally:
        for p in ps:
            p.stop()


async def test_sale_una_vez_por_persona(db, escuela):
    envios = Envios()
    assert await _atender(db, aviso(), envios) == "enviado"
    assert len(envios.a) == 1
    email, asunto, texto = envios.a[0]
    assert email == "ana@x.com" and asunto == "Un mensaje de Rida antes de tu llamada"
    assert texto.startswith("¡Hola, Ana!") and "jueves 29 de octubre a las 18:00" in texto
    # La marca queda en su ficha.
    marcas = (await db.execute(select(ContactEvent).where(ContactEvent.kind == C.TIPO_EVENTO))).scalars().all()
    assert [m.email for m in marcas] == ["ana@x.com"]
    # Cancela y vuelve a reservar: no le llega otra vez.
    assert await _atender(db, aviso(nombre="Ana"), envios) == "ya-lo-tenia"
    assert len(envios.a) == 1


async def test_un_cambio_de_hora_no_manda_nada(db, escuela):
    envios = Envios()
    assert await _atender(db, aviso(old_invitee="https://api.calendly.com/x/OLD"), envios) == "cambio-de-hora"
    assert envios.a == []


async def test_otro_evento_del_calendly_no_manda_nada(db, escuela):
    envios = Envios()
    assert await _atender(db, aviso(tipo="https://api.calendly.com/event_types/PROVEEDOR"), envios) == "otro-evento"
    assert envios.a == []


async def test_apagado_no_manda_nada(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={}))
    await db.commit()
    envios = Envios()
    assert await _atender(db, aviso(), envios) == "apagado"
    assert envios.a == []


async def test_sin_firma_no_entra(db, escuela):
    crudo = json.dumps(aviso()).encode()
    with patch.object(C, "_secreto", lambda: "secreto-de-prueba"), patch.object(C, "_redis", lambda: None):
        with pytest.raises(PermissionError):
            await C.atender_aviso(crudo, C.firmar(crudo, C.clave_firma("otro"), int(time.time())), db)


async def test_si_el_envio_falla_se_reintenta(db, escuela):
    with pytest.raises(RuntimeError):
        await _atender(db, aviso(), Envios(falla=True))
    # Sin marca: el reintento de Calendly lo manda.
    assert (await db.execute(select(ContactEvent).where(ContactEvent.kind == C.TIPO_EVENTO))).first() is None
    envios = Envios()
    assert await _atender(db, aviso(), envios) == "enviado"
    assert len(envios.a) == 1


async def test_guardar_el_texto(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={}))
    await db.commit()
    estado = await C.leer(db, org.id)
    assert estado["activo"] is False and estado["asunto"] == C.DE_FABRICA["asunto"]
    with pytest.raises(ValueError):
        await C.guardar(org.id, {"texto": "Hola {Nombre}"}, "Rida", db)
    estado = await C.guardar(org.id, {"activo": True, "asunto": "Hola {nombre}", "texto": "Texto {dia}"}, "Rida", db)
    assert estado["activo"] is True and estado["por"] == "Rida" and estado["cambiado_en"]
    assert estado["asunto"] == "Hola {nombre}"
    # Vacío = el de fábrica.
    estado = await C.guardar(org.id, {"texto": "  "}, "Rida", db)
    assert estado["texto"] == C.DE_FABRICA["texto"] and estado["activo"] is True


# ── el «llamada nueva» al equipo no se repite ──────────────────────────────


class RedisFalso:
    def __init__(self):
        self.d: dict = {}

    def set(self, k, v, nx=False, ex=None):
        if nx and k in self.d:
            return None
        self.d[k] = v
        return True

    def delete(self, k):
        self.d.pop(k, None)


async def test_la_misma_reserva_avisa_una_vez_al_equipo(db):
    from src.services.panel import reparto

    enviados = []
    r = RedisFalso()

    async def _equipo(_db):
        return 1, []

    async def _admins(_db):
        return ["admin@x.com"]

    with patch("src.core.redis.get_redis_client", lambda: r), patch.object(reparto, "_equipo_de_la_escuela", _equipo), patch(
        "src.services.contactos.llamadas.emails_de_administradores", _admins
    ), patch.object(E, "send_llamada_agendada_email", lambda destino, datos: enviados.append((destino, datos))):
        assert await reparto.avisar_llamada_nueva({"email": "Ana@x.com", "cuando": "jue 29 oct · 18:00"}, db) == 1
        # La web avisa de la misma reserva un momento después: no se repite.
        assert await reparto.avisar_llamada_nueva({"email": "ana@x.com"}, db) == 0
    assert len(enviados) == 1

    # Si el correo al equipo falla, el siguiente aviso de esa reserva lo intenta.
    def _falla(destino, datos):
        raise RuntimeError("Resend no contesta")

    with patch("src.core.redis.get_redis_client", lambda: r), patch.object(reparto, "_equipo_de_la_escuela", _equipo), patch(
        "src.services.contactos.llamadas.emails_de_administradores", _admins
    ):
        with patch.object(E, "send_llamada_agendada_email", _falla):
            assert await reparto.avisar_llamada_nueva({"email": "luis@x.com"}, db) == 0
        with patch.object(E, "send_llamada_agendada_email", lambda destino, datos: enviados.append((destino, datos))):
            assert await reparto.avisar_llamada_nueva({"email": "luis@x.com"}, db) == 1


async def test_si_ya_tenia_closer_el_aviso_va_a_su_closer(db):
    """Segunda closer (28/10): quien ya tenía closer y vuelve a reservar (tras
    un No show) no pasa por «Por asignar»: el aviso le llega a su closer."""
    from src.services.panel import pipeline, reparto

    await pipeline.asignar("eva@x.com", 7, "Laura", "Rida", db)
    agendadas, asignadas = [], []

    async def _equipo(_db):
        return 1, [{"id": 7, "nombre": "Laura", "email": "laura@x.com"}, {"id": 3, "nombre": "Diego", "email": "diego@x.com"}]

    async def _admins(_db):
        return ["admin@x.com"]

    with patch("src.core.redis.get_redis_client", lambda: None), patch.object(reparto, "_equipo_de_la_escuela", _equipo), patch(
        "src.services.contactos.llamadas.emails_de_administradores", _admins
    ), patch.object(E, "send_llamada_agendada_email", lambda d, x: agendadas.append(d)), patch.object(
        E, "send_llamada_asignada_email", lambda d, x: asignadas.append((d, x))
    ):
        assert await reparto.avisar_llamada_nueva({"email": "Eva@x.com", "cuando": "vie 30 oct · 18:00"}, db) == 1
        # Alguien nuevo, sin closer: a quien reparte (aquí, los administradores).
        assert await reparto.avisar_llamada_nueva({"email": "nuevo@x.com"}, db) == 1
    assert asignadas == [("laura@x.com", {"email": "Eva@x.com", "cuando": "vie 30 oct · 18:00", "vuelve": True})]
    assert agendadas == ["admin@x.com"]
    html = E.send_llamada_asignada_email("laura@x.com", {"nombre": "Eva", "vuelve": True}, preview=True)
    assert "Ha reservado una llamada contigo" in str(html)


async def test_un_cambio_de_hora_del_equipo_no_manda_nada(db, escuela):
    """31/10: el equipo cambia la hora desde la escuela. Calendly avisa de la
    reserva nueva sin `old_invitee`; la marca de la ficha la reconoce."""
    from datetime import datetime, timezone

    from src.services.contactos import reservar as R

    db.add(ContactEvent(
        email="ana@x.com", kind=R.TIPO_CAMBIO, source="equipo",
        extra=json.dumps({"autor": "Diego", "inicio": "2026-10-29T17:00:00+00:00"}),
        created_at=datetime.now(timezone.utc).isoformat(),
    ))
    await db.commit()
    envios, equipo = Envios(), []

    async def _al_equipo(*a, **k):
        equipo.append(a)

    with patch.object(C, "_avisar_reparto", _al_equipo):
        crudo, cabecera = firmado(aviso())
        ps = [p for p in _parches(envios) if getattr(p, "attribute", "") != "_avisar_reparto"]
        for p in ps:
            p.start()
        try:
            assert await C.atender_aviso(crudo, cabecera, db) == "cambio-de-hora"
        finally:
            for p in ps:
                p.stop()
    assert envios.a == [] and equipo == []

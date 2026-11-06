"""Agendar una llamada desde la escuela (15/10/2026). Calendly es de mentira:
lo que se comprueba es lo que se le pide y qué se hace con lo que contesta."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment  # noqa: F401  (registra la tabla)
from src.db.enrollment_request import EnrollmentRequest  # noqa: F401
from src.db.llamadas_templadas import LlamadaTemplada
from src.db.reservas import ReservaPago, ReservaPlaza  # noqa: F401  (las lee la línea de tiempo)
from src.services.contactos import agenda as A
from src.services.contactos import reservar as R

TIPOS = [
    {"uri": "https://api.calendly.com/event_types/OTRO", "slug": "otra-cosa", "active": True,
     "scheduling_url": "https://calendly.com/holandesnawar/otra-cosa", "locations": []},
    {"uri": "https://api.calendly.com/event_types/LLAMADA", "slug": "llamada-de-consultoria", "active": True,
     "name": "Llamada de consultoría", "duration": 45,
     "scheduling_url": "https://calendly.com/holandesnawar/llamada-de-consultoria",
     "locations": [{"kind": "google_conference"}]},
]


# ── lógica pura ────────────────────────────────────────────────────────────


def test_elige_el_evento_de_las_llamadas():
    assert R.evento_elegido(TIPOS)["uri"].endswith("LLAMADA")
    assert R.evento_elegido(TIPOS, "https://calendly.com/holandesnawar/otra-cosa")["uri"].endswith("OTRO")
    assert R.evento_elegido([{**TIPOS[1], "active": False}, TIPOS[0]])["uri"].endswith("OTRO")
    assert R.evento_elegido([]) is None


def test_la_ubicacion_que_pide_calendly():
    assert R.ubicacion_para(TIPOS[1]) == {"kind": "google_conference"}
    assert R.ubicacion_para(TIPOS[0]) is None  # sin ubicación: no se manda
    assert R.ubicacion_para({"locations": [{"kind": "outbound_call"}]}, "+31612345678") == {
        "kind": "outbound_call", "location": "+31612345678"}
    assert R.ubicacion_para({"locations": [{"kind": "physical", "location": "Amsterdam"}]}) == {
        "kind": "physical", "location": "Amsterdam"}


def test_la_pagina_de_calendly_rellenada():
    hora = datetime(2026, 10, 16, 16, 0, tzinfo=timezone.utc)  # 18:00 en Países Bajos
    url = R.enlace_de_hora("https://calendly.com/holandesnawar/llamada-de-consultoria/", hora)
    assert url == ("https://calendly.com/holandesnawar/llamada-de-consultoria/2026-10-16T18:00:00+02:00"
                   "?month=2026-10&date=2026-10-16")
    final = R.con_datos(url, "Ana Gil", "ana@x.com")
    assert "month=2026-10" in final and "name=Ana+Gil" in final and "email=ana%40x.com" in final


def test_los_limites_del_dia_en_paises_bajos():
    ahora = datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc)
    desde, hasta = R.limites_del_dia("2026-10-16", ahora)
    assert desde == datetime(2026, 10, 15, 22, 0, tzinfo=timezone.utc)  # 00:00 CEST
    assert hasta == datetime(2026, 10, 16, 22, 0, tzinfo=timezone.utc)
    # Hoy: desde ahora, que Calendly no da horas pasadas.
    desde, _ = R.limites_del_dia("2026-10-10", ahora)
    assert desde == ahora + timedelta(minutes=1)


# ── un Calendly de mentira ─────────────────────────────────────────────────


class CalendlyFalso:
    def __init__(self, reservar_status=201, motivo="Forbidden", rechaza_ubicacion=False, tipos=None):
        self.pedidos: list[tuple[str, str, dict]] = []
        self.reservar_status = reservar_status
        self.motivo = motivo
        self.rechaza_ubicacion = rechaza_ubicacion
        self.tipos = tipos or TIPOS

    def __call__(self):
        falso = self

        class Cliente:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def request(self, metodo, url, **kw):
                falso.pedidos.append((metodo, url, kw))
                pedido = httpx.Request(metodo, url)
                if url.endswith("/users/me"):
                    return httpx.Response(200, json={"resource": {"uri": "https://api.calendly.com/users/YO"}}, request=pedido)
                if url.endswith("/event_types"):
                    return httpx.Response(200, json={"collection": falso.tipos}, request=pedido)
                if url.endswith("/event_type_available_times"):
                    return httpx.Response(200, json={"collection": [
                        {"status": "available", "start_time": "2026-10-16T16:00:00Z",
                         "scheduling_url": "https://calendly.com/holandesnawar/llamada-de-consultoria/2026-10-16T18:00:00+02:00?month=2026-10&date=2026-10-16"},
                        {"status": "available", "start_time": "2026-10-16T09:00:00Z", "scheduling_url": "u2"},
                    ]}, request=pedido)
                if url.endswith("/invitees") and metodo == "POST":
                    if falso.rechaza_ubicacion and "location" in kw["json"]:
                        return httpx.Response(400, json={"title": "Invalid Argument", "message": "The supplied parameters are invalid.",
                                                         "details": [{"parameter": "location", "message": "invalid_location_choice"}]}, request=pedido)
                    if falso.reservar_status >= 400:
                        return httpx.Response(falso.reservar_status, json={"title": "Permission Denied", "message": falso.motivo}, request=pedido)
                    return httpx.Response(201, json={"resource": {
                        "event": "https://api.calendly.com/scheduled_events/EV1",
                        "cancel_url": "https://calendly.com/cancellations/X",
                        "reschedule_url": "https://calendly.com/reschedulings/X"}}, request=pedido)
                return httpx.Response(404, json={"message": "no"}, request=pedido)

        return Cliente()


MANANA = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)


@pytest.mark.asyncio
async def test_las_horas_libres_del_dia():
    falso = CalendlyFalso()
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.huecos("2099-10-16")
    assert [h["inicio"] for h in r["huecos"]] == ["2026-10-16T09:00:00Z", "2026-10-16T16:00:00Z"]
    assert r["duracion"] == 45
    pedido = [p for p in falso.pedidos if p[1].endswith("/event_type_available_times")][0]
    assert pedido[2]["params"]["event_type"].endswith("LLAMADA")


@pytest.mark.asyncio
async def test_sin_calendly_conectado_no_hace_nada():
    with patch.object(A, "_token", lambda: ""):
        assert (await R.huecos("2026-10-16"))["configurado"] is False


@pytest.mark.asyncio
async def test_agenda_en_calendly_y_apunta_a_la_persona(db):
    falso = CalendlyFalso()
    A._cache["hasta"] = 9e18
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.reservar(nombre="Ana Gil", email="Ana@X.com", telefono="+31 6 1", inicio=MANANA.isoformat(),
                             url_hueco="", autor="Rida", db_session=db)
    assert r["ok"] and r["modo"] == "reservada"
    metodo, url, kw = [p for p in falso.pedidos if p[1].endswith("/invitees")][0]
    cuerpo = kw["json"]
    assert cuerpo["event_type"].endswith("LLAMADA") and cuerpo["location"] == {"kind": "google_conference"}
    assert cuerpo["invitee"] == {"name": "Ana Gil", "email": "ana@x.com", "timezone": "Europe/Amsterdam"}
    assert cuerpo["start_time"].endswith("Z")
    # Con `tracking` a medias Calendly rechaza la reserva entera (15/10).
    assert "tracking" not in cuerpo
    assert A._cache["hasta"] == 0.0  # la agenda se vuelve a pedir

    ev = (await db.execute(select(ContactEvent).where(ContactEvent.email == "ana@x.com"))).scalars().one()
    assert ev.kind == "llamada-equipo" and ev.phone == "+31 6 1"
    from src.services.contactos.contactos import _todos_los_eventos

    linea = [e for e in await _todos_los_eventos(db) if e["email"] == "ana@x.com"][0]
    assert linea["que"].startswith("Rida le agendó una llamada para el ")


@pytest.mark.asyncio
async def test_si_estaba_pendiente_en_llamadas_se_marca_hecha(db):
    db.add(LlamadaTemplada(email="ana@x.com", nombre="Ana", estado="pendiente", clave="auto:ana@x.com", created_at="2026-10-14"))
    await db.commit()
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", CalendlyFalso()):
        await R.reservar(nombre="Ana", email="ana@x.com", telefono="", inicio=MANANA.isoformat(), url_hueco="", autor="Rida", db_session=db)
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "ana@x.com"))).scalars().one()
    assert fila.estado == "hecha"


@pytest.mark.asyncio
async def test_en_el_plan_gratis_manda_a_la_pagina_de_calendly_rellenada(db):
    falso = CalendlyFalso(reservar_status=403, motivo="This feature requires a paid plan")
    hueco = "https://calendly.com/holandesnawar/llamada-de-consultoria/2026-10-16T18:00:00+02:00?month=2026-10&date=2026-10-16"
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.reservar(nombre="Ana Gil", email="ana@x.com", telefono="", inicio=MANANA.isoformat(),
                             url_hueco=hueco, autor="Rida", db_session=db)
    assert r["ok"] and r["modo"] == "enlace"
    assert r["url"].startswith(hueco) and "name=Ana+Gil" in r["url"] and "email=ana%40x.com" in r["url"]
    assert r["plan"] is True and "paid plan" in r["motivo"]
    ev = (await db.execute(select(ContactEvent).where(ContactEvent.email == "ana@x.com"))).scalars().one()
    assert ev.kind == "llamada-equipo"


@pytest.mark.asyncio
async def test_no_agenda_sin_datos_ni_en_el_pasado(db):
    with patch.object(A, "_token", lambda: "tok"):
        assert not (await R.reservar(nombre="", email="ana@x.com", telefono="", inicio=MANANA.isoformat(),
                                     url_hueco="", autor="R", db_session=db))["ok"]
        ayer = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        r = await R.reservar(nombre="Ana", email="ana@x.com", telefono="", inicio=ayer, url_hueco="", autor="R", db_session=db)
        assert not r["ok"] and "pasado" in r["motivo"]


@pytest.mark.asyncio
async def test_el_telefono_de_la_web_para_las_citas(db):
    db.add(ContactEvent(email="ana@x.com", kind="admision", phone="+31600000001", created_at="2026-10-01T10:00:00"))
    db.add(ContactEvent(email="ana@x.com", kind="cualificacion", phone="+31600000002", created_at="2026-10-02T10:00:00"))
    db.add(ContactEvent(email="leo@x.com", kind="guia-bases", phone="", created_at="2026-10-02T10:00:00"))
    await db.commit()
    tels = await R.telefonos_por_email({"ANA@x.com", "leo@x.com", "nadie@x.com"}, db)
    assert tels == {"ana@x.com": "+31600000002"}


# ── 15/10: «Calendly falló» al agendar ─────────────────────────────────────


def test_el_telefono_como_lo_pide_calendly():
    assert R.telefono_e164("+31 6 1234 5678") == "+31612345678"
    assert R.telefono_e164("0032 470 12 34 56") == "+32470123456"
    assert R.telefono_e164("") == ""


def test_respuestas_a_las_preguntas_obligatorias():
    tipo = {"custom_questions": [
        {"name": "Teléfono", "type": "phone_number", "required": True, "enabled": True, "position": 0},
        {"name": "¿Qué nivel tienes?", "type": "single_select", "required": True, "enabled": True, "position": 1,
         "answer_choices": ["Cero", "A1"]},
        {"name": "Cuéntanos algo", "type": "text", "required": True, "enabled": True, "position": 2},
        {"name": "Opcional", "type": "string", "required": False, "enabled": True, "position": 3},
        {"name": "Apagada", "type": "string", "required": True, "enabled": False, "position": 4},
    ]}
    assert R.respuestas_obligatorias(tipo, "+31 6 1") == [
        {"question": "Teléfono", "answer": "+3161", "position": 0},
        {"question": "¿Qué nivel tienes?", "answer": "Cero", "position": 1},
        {"question": "Cuéntanos algo", "answer": R.RESPUESTA_DEL_EQUIPO, "position": 2},
    ]
    assert R.respuestas_obligatorias({}, "") == []


def test_las_ubicaciones_que_se_prueban():
    tipo = {"locations": [{"kind": "google_conference"}, {"kind": "outbound_call"}]}
    assert R.ubicaciones_para(tipo, "+31 6 12") == [
        {"kind": "google_conference"}, {"kind": "outbound_call", "location": "+31612"}, None]
    assert R.ubicaciones_para({}, "") == [None]


def test_en_el_por_turnos_primero_sin_ubicacion():
    """05/11: en el por turnos cada closer tiene su ubicación (Diego Zoom,
    Belén Meet). Mandar la primera la imponía a todos."""
    tipo = {"pooling_type": "round_robin",
            "locations": [{"kind": "google_conference"}, {"kind": "zoom_conference"}]}
    assert R.ubicaciones_para(tipo) == [None, {"kind": "google_conference"}, {"kind": "zoom_conference"}]
    assert R.ubicaciones_para({"pooling_type": "round_robin"}) == [None]


@pytest.mark.asyncio
async def test_si_calendly_rechaza_la_ubicacion_prueba_sin_ella(db):
    tipos = [{**TIPOS[1], "custom_questions": [
        {"name": "Teléfono", "type": "phone_number", "required": True, "enabled": True, "position": 0}]}]
    falso = CalendlyFalso(rechaza_ubicacion=True, tipos=tipos)
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.reservar(nombre="Ana Gil", email="ana@x.com", telefono="+31 6 1", inicio=MANANA.isoformat(),
                             url_hueco="", autor="Rida", db_session=db)
    assert r["ok"] and r["modo"] == "reservada"
    cuerpos = [kw["json"] for m, u, kw in falso.pedidos if u.endswith("/invitees")]
    assert [("location" in c) for c in cuerpos] == [True, False]
    assert cuerpos[-1]["questions_and_answers"] == [{"question": "Teléfono", "answer": "+3161", "position": 0}]


@pytest.mark.asyncio
async def test_otro_rechazo_se_explica_tal_cual(db):
    falso = CalendlyFalso(reservar_status=400, motivo="The selected time is no longer available")
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.reservar(nombre="Ana", email="ana@x.com", telefono="", inicio=MANANA.isoformat(),
                             url_hueco="u", autor="Rida", db_session=db)
    assert r["modo"] == "enlace" and r["plan"] is False and "no longer available" in r["motivo"]
    # Un rechazo que no es de la ubicación no se reintenta.
    assert len([1 for m, u, kw in falso.pedidos if u.endswith("/invitees")]) == 1


def test_con_calendly_teams_gana_el_evento_por_turnos():
    """31/10: con un evento «por turnos» (round robin) en la organización,
    las llamadas van a ese, aunque el viejo siga con el slug de siempre."""
    viejo = {"uri": "u/VIEJO", "slug": "llamada-de-consultoria", "active": True, "pooling_type": None}
    turnos = {"uri": "u/TURNOS", "slug": "llamada-de-admision", "active": True, "pooling_type": "round_robin"}
    diego = {"uri": "u/DIEGO", "slug": "llamada-de-consultoria", "active": True, "pooling_type": None}
    otra = {"uri": "u/OTRA", "slug": "reunion-proveedor", "active": True, "pooling_type": None}
    assert R.evento_elegido([viejo, otra]) is viejo
    assert R.evento_elegido([viejo, turnos, otra]) is turnos
    # El por turnos con el slug preferido gana a otro por turnos.
    turnos2 = {**turnos, "uri": "u/T2", "slug": "llamada-de-consultoria"}
    assert R.evento_elegido([turnos, turnos2]) is turnos2
    # Qué avisos de Calendly son de la llamada: el por turnos, los enlaces con
    # el slug de siempre (el viejo y el personal de cada closer); no otra reunión.
    assert R.tipos_de_llamada([viejo, turnos, diego, otra]) == {"u/VIEJO", "u/TURNOS", "u/DIEGO"}


def test_la_copia_secreta_del_por_turnos_es_la_de_la_escuela():
    """02/11: el público deja reservar 2 días; el equipo agenda y cambia horas
    en una copia secreta con más días. La escuela usa la secreta y los avisos
    de las dos cuentan como la llamada."""
    publico = {"uri": "u/PUBLICO", "slug": "llamada-de-consultoria", "active": True, "pooling_type": "round_robin", "secret": False}
    copia = {"uri": "u/COPIA", "slug": "llamada-equipo", "active": True, "pooling_type": "round_robin", "secret": True}
    otra = {"uri": "u/OTRA", "slug": "reunion", "active": True, "pooling_type": None, "secret": True}
    assert R.evento_elegido([publico, copia, otra]) is copia
    assert R.evento_elegido([copia, publico]) is copia
    # Apagada en Calendly, vuelve el público.
    assert R.evento_elegido([publico, {**copia, "active": False}]) is publico
    # Un evento secreto que no es por turnos no cuenta.
    assert R.evento_elegido([publico, otra]) is publico
    assert R.tipos_de_llamada([publico, copia, otra]) == {"u/PUBLICO", "u/COPIA"}


def test_la_copia_secreta_de_un_evento_individual():
    """02/11, la copia de verdad: «Llamada de Consultoría HN (equipo)», secreta
    e individual como su original. Se reconoce por el nombre; otro evento
    secreto (la vieja «Agenda del equipo») o una copia de otro tipo, no."""
    publico = {"uri": "u/HN", "name": "Llamada de Consultoría HN", "slug": "llamada-de-consultoria", "active": True, "pooling_type": None, "secret": False}
    copia = {"uri": "u/HN2", "name": "Llamada de Consultoria HN (equipo)", "slug": "llamada-de-consultoria-hn-equipo", "active": True, "pooling_type": None, "secret": True}
    agenda = {"uri": "u/AG", "name": "Agenda del equipo", "slug": "agenda-del-equipo", "active": True, "pooling_type": None, "secret": True}
    assert R.evento_elegido([agenda, copia, publico]) is copia
    assert R.evento_publico([copia, publico]) is publico
    assert R.evento_elegido([agenda, publico]) is publico
    # Sin el secreto, no es la copia del equipo (saldría en la página pública).
    assert R.evento_elegido([publico, {**copia, "secret": False}]) is publico
    # Una copia por turnos de un original individual no cuenta: cambiaría de closer.
    assert R.copia_del_equipo([publico, {**copia, "pooling_type": "round_robin"}], publico) is None
    assert R.tipos_de_llamada([publico, copia, agenda]) == {"u/HN", "u/HN2"}


def test_el_anfitrion_de_una_cita():
    from src.services.contactos import agenda as A

    ev = {
        "uri": "https://api.calendly.com/scheduled_events/EV",
        "status": "active",
        "start_time": "2026-11-04T17:00:00Z",
        "event_memberships": [{"user": "u/BELEN", "user_email": "Belen@X.com", "user_name": "Belén Soto"}],
    }
    c = A.cita_desde_calendly(ev, [{"email": "ana@x.com", "status": "active"}])[0]
    assert (c["anfitrion_email"], c["anfitrion"]) == ("belen@x.com", "Belén Soto")
    assert A.anfitrion_de({}) == ("", "")


def test_quien_la_agendo_desde_la_escuela():
    """La ventana de la llamada dice si la agendó o la movió alguien desde la
    escuela (por la hora de la cita) o si se reservó en Calendly (05/11)."""
    from src.services.contactos.reservar import quien_la_agendo

    eventos = [
        {"kind": "llamada-equipo", "created_at": "2026-11-03T10:00:00+00:00", "extra": {"autor": "Diego Sosa", "inicio": "2026-11-05T17:00:00+00:00"}},
        {"kind": "llamada-cambiada", "created_at": "2026-11-04T09:00:00+00:00", "extra": {"autor": "Belén", "inicio": "2026-11-06T18:00:00+00:00"}},
    ]
    assert quien_la_agendo(eventos, "2026-11-05T17:00:30Z") == {"autor": "Diego Sosa", "cuando": "2026-11-03T10:00:00+00:00", "como": "agendo"}
    assert quien_la_agendo(eventos, "2026-11-06T18:00:00Z")["como"] == "cambio"
    # Otra hora: la reservaron en Calendly.
    assert quien_la_agendo(eventos, "2026-11-07T17:00:00Z") is None
    assert quien_la_agendo([], "2026-11-05T17:00:00Z") is None
    assert quien_la_agendo(eventos, "") is None


# ── quién la lleva y por dónde (05/11) ─────────────────────────────────────

TURNOS = {"uri": "https://api.calendly.com/event_types/TURNOS", "slug": "llamada-de-consultoria-hn", "active": True,
          "name": "Llamada de Consultoría HN", "pooling_type": "round_robin", "duration": 45,
          "profile": {"type": "Team", "owner": "https://api.calendly.com/organizations/ORG"},
          "scheduling_url": "https://calendly.com/d/x/llamada-de-consultoria-hn", "locations": []}
DE_DIEGO = {"uri": "https://api.calendly.com/event_types/DIEGO", "slug": "llamada-equipo", "active": True, "secret": True,
            "name": "Llamada de Consultoría HN (equipo)", "duration": 45,
            "profile": {"type": "User", "owner": "https://api.calendly.com/users/H", "name": "Holandés Nawar"},
            "scheduling_url": "https://calendly.com/holandesnawar/llamada-equipo",
            "locations": [{"kind": "zoom_conference"}, {"kind": "google_conference"}]}
VIEJO_DE_DIEGO = {**TIPOS[1], "profile": {"type": "User", "owner": "https://api.calendly.com/users/H"}}
DE_BELEN = {"uri": "https://api.calendly.com/event_types/BELEN", "slug": "llamada-de-consultoria-hn-belen", "active": True,
            "name": "Llamada de Consultoría HN · Belén", "duration": 45,
            "profile": {"type": "User", "owner": "https://api.calendly.com/users/B"},
            "scheduling_url": "https://calendly.com/belen/llamada", "locations": [{"kind": "google_conference"}]}
MIEMBROS = {
    "https://api.calendly.com/users/H": {"email": "h@nawar.es", "nombre": "Holandés Nawar"},
    "https://api.calendly.com/users/B": {"email": "belen@nawar.es", "nombre": "Belén Soto"},
}


def test_el_evento_de_cada_closer():
    tipos = [TURNOS, DE_DIEGO, VIEJO_DE_DIEGO, DE_BELEN, TIPOS[0]]
    eventos = R.eventos_de_closers(tipos, MIEMBROS)
    # Uno por persona: el de Diego es el «(equipo)» (nombre bueno), no el viejo.
    assert [(e["email"], e["uri"].rsplit("/", 1)[-1]) for e in eventos] == [("belen@nawar.es", "BELEN"), ("h@nawar.es", "DIEGO")]
    assert eventos[1]["ubicaciones"] == [{"kind": "zoom_conference", "nombre": "Zoom"}, {"kind": "google_conference", "nombre": "Google Meet"}]
    # Sin dueño conocido, no sale; el por turnos nunca es «de un closer».
    assert R.eventos_de_closers(tipos, {}) == []
    # Los avisos de Calendly de esos eventos cuentan como la llamada.
    llamadas = R.tipos_de_llamada(tipos)
    assert {DE_DIEGO["uri"], DE_BELEN["uri"], TURNOS["uri"]} <= llamadas
    assert TIPOS[0]["uri"] not in llamadas


def test_quien_puede_elegir_a_quien():
    marcados = [
        {**e, "closer_id": cid, "closer": nombre}
        for e, cid, nombre in zip(R.eventos_de_closers([TURNOS, DE_DIEGO, DE_BELEN], MIEMBROS), (5, 4), ("Belén Soto", "Diego Sosa"))
    ]
    # Administrador: por turnos y los dos; se propone el closer que la lleva.
    r = R.opciones_para(TURNOS, marcados, lleva=5, actor_id=1, es_admin=True)
    assert [o["quien"] for o in r["opciones"]] == ["Por turnos", "Belén", "Diego"]
    assert r["propuesta"] == DE_BELEN["uri"]
    assert r["opciones"][0]["ubicaciones"] == [] and r["opciones"][0]["por_turnos"]
    # Diego (closer), con un lead que no lleva nadie: él o por turnos; se propone él.
    r = R.opciones_para(TURNOS, marcados, lleva=0, actor_id=4, es_admin=False)
    assert [o["quien"] for o in r["opciones"]] == ["Por turnos", "Diego"] and r["propuesta"] == DE_DIEGO["uri"]
    # Diego con un lead de Belén: puede ponerla con Belén (la lleva ella), no quitársela.
    r = R.opciones_para(TURNOS, marcados, lleva=5, actor_id=4, es_admin=False)
    assert [o["quien"] for o in r["opciones"]] == ["Por turnos", "Belén", "Diego"] and r["propuesta"] == DE_BELEN["uri"]
    # Nadie con evento propio: solo por turnos.
    assert R.opciones_para(TURNOS, [], 0, 4, False) == {"opciones": [R.opciones_para(TURNOS, [], 0, 4, False)["opciones"][0]], "propuesta": "turnos"}


class CalendlyConClosers(CalendlyFalso):
    def __call__(self):
        falso = self
        base = super().__call__()

        class Cliente(type(base)):
            async def request(self, metodo, url, **kw):
                if "/organization_memberships" in url:
                    falso.pedidos.append((metodo, url, kw))
                    return httpx.Response(200, json={"collection": [
                        {"user": {"uri": u, "email": m["email"], "name": m["nombre"]}} for u, m in MIEMBROS.items()
                    ]}, request=httpx.Request(metodo, url))
                if url.endswith("/users/me"):
                    falso.pedidos.append((metodo, url, kw))
                    return httpx.Response(200, json={"resource": {"uri": "https://api.calendly.com/users/H",
                                                                  "current_organization": "https://api.calendly.com/organizations/ORG"}},
                                          request=httpx.Request(metodo, url))
                return await base.request(metodo, url, **kw)

        return Cliente()


@pytest.mark.asyncio
async def test_agenda_con_el_closer_y_la_herramienta_elegidos(db):
    R._eventos_cache.update(datos=None, hasta=0.0)
    falso = CalendlyConClosers(tipos=[TURNOS, DE_DIEGO, DE_BELEN])
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        h = await R.huecos("2099-10-16", DE_DIEGO["uri"])
        r = await R.reservar(nombre="Ana", email="ana@x.com", telefono="", inicio=MANANA.isoformat(), url_hueco="",
                             autor="Rida", db_session=db, evento=DE_DIEGO["uri"], ubicacion="zoom_conference")
        # Una herramienta que su evento no tiene: no se agenda con otra.
        mal = await R.reservar(nombre="Eva", email="eva@x.com", telefono="", inicio=MANANA.isoformat(), url_hueco="",
                               autor="Rida", db_session=db, evento=DE_BELEN["uri"], ubicacion="zoom_conference")
        # Un evento que no es de ningún closer: no.
        raro = await R.huecos("2099-10-16", "https://api.calendly.com/event_types/OTRO")
    assert h["evento"] == "Llamada de Consultoría HN (equipo)"
    pedido = [p for p in falso.pedidos if p[1].endswith("/event_type_available_times")][0]
    assert pedido[2]["params"]["event_type"] == DE_DIEGO["uri"]
    assert r["modo"] == "reservada"
    invitado = [p for p in falso.pedidos if p[1].endswith("/invitees")][0][2]["json"]
    assert invitado["event_type"] == DE_DIEGO["uri"] and invitado["location"] == {"kind": "zoom_conference"}
    assert mal["modo"] == "enlace" and "no ofrece Zoom" in mal["motivo"]
    assert len([p for p in falso.pedidos if p[1].endswith("/invitees")]) == 1
    assert "evento de ese closer" in raro["error"]
    R._eventos_cache.update(datos=None, hasta=0.0)


def test_el_clon_con_zoom_y_meet():
    """05/11: el usuario duplicó el evento en Calendly («…-hn-clon», oculto, con
    Zoom y Google Meet). La escuela lo reconoce por el slug y, con varios del
    mismo closer, se queda con el que deja elegir más videollamadas."""
    clon = {"uri": "https://api.calendly.com/event_types/CLON", "slug": "llamada-de-consultoria-hn-clon", "active": True,
            "secret": True, "name": "Clon de la llamada", "duration": 45,
            "profile": {"type": "User", "owner": "https://api.calendly.com/users/H"},
            "locations": [{"kind": "zoom_conference"}, {"kind": "google_conference"}]}
    solo_meet = {**DE_DIEGO, "locations": [{"kind": "google_conference"}]}
    eventos = R.eventos_de_closers([TURNOS, solo_meet, clon, DE_BELEN], MIEMBROS)
    diego = [e for e in eventos if e["email"] == "h@nawar.es"][0]
    assert diego["uri"] == clon["uri"]
    assert [u["nombre"] for u in diego["ubicaciones"]] == ["Zoom", "Google Meet"]
    assert clon["uri"] in R.tipos_de_llamada([TURNOS, clon])
    # Si el clon es del MISMO tipo que el público (por turnos y secreto), es la
    # copia del equipo y la opción «Por turnos» deja elegir Zoom o Meet.
    clon_turnos = {**clon, "pooling_type": "round_robin", "profile": {"type": "Team"}}
    base = R.evento_elegido([TURNOS, clon_turnos])
    assert base["uri"] == clon["uri"]
    turnos = R.opciones_para(base, [], 0, 1, True)["opciones"][0]
    assert turnos["por_turnos"] and [u["kind"] for u in turnos["ubicaciones"]] == ["zoom_conference", "google_conference"]
    # El por turnos con una sola (o con ubicación por anfitrión), sin elegir.
    assert R.opciones_para(TURNOS, [], 0, 1, True)["opciones"][0]["ubicaciones"] == []


def test_por_que_cada_evento():
    """06/11: «no sale Belén». La ventana dice por qué cuenta o no cada evento."""
    from src.services.contactos import reservar as R

    tipos = [
        {"uri": "T", "name": "Llamada de Consultoría HN", "pooling_type": "round_robin", "active": True, "profile": {"type": "Team"}},
        {"uri": "D", "name": "Llamada de Consultoría HN (equipo)", "active": True, "secret": True,
         "profile": {"type": "User", "owner": "u/diego"}},
        {"uri": "B", "name": "Llamada de Consultoría HN", "active": True, "admin_managed": True,
         "profile": {"type": "User", "owner": "u/belen"}},
        {"uri": "X", "name": "Otra cosa", "active": True, "profile": {"type": "User", "owner": "u/diego"}},
    ]
    miembros = {"u/diego": {"email": "h@x.com"}, "u/belen": {"email": "belen@nawar.es"}}
    eq = [{"id": 4, "nombre": "Diego Ruiz", "rol": "Closer", "email": "diego@x.com"},
          {"id": 5, "nombre": "Belén Soto", "rol": "Closer", "email": "belen@gmail.com"}]
    filas = {f["evento"] + f["de"]: f for f in R.por_que_cada_evento(tipos, miembros, eq, {"4": "h@x.com"})}
    assert "web" in filas["Llamada de Consultoría HN"]["motivo"]
    assert filas["Llamada de Consultoría HN (equipo)h@x.com"]["vale"]
    # El de Belén: su correo de Calendly no es el de su cuenta y no está apuntado.
    b = filas["Llamada de Consultoría HNbelen@nawar.es"]
    assert not b["vale"] and "Correos de Calendly" in b["motivo"] and b["gestionado"]
    assert "no empieza" in filas["Otra cosah@x.com"]["motivo"]
    # Con su correo apuntado, vale.
    filas = R.por_que_cada_evento(tipos, miembros, eq, {"4": "h@x.com", "5": "belen@nawar.es"})
    assert [f["vale"] for f in filas if f["de"] == "belen@nawar.es"] == [True]

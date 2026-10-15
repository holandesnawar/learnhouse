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

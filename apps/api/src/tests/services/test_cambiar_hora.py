"""Cambiar la hora de una llamada y cancelarla desde la escuela (31/10/2026).
Calendly es de mentira: se comprueba el orden (primero la nueva, luego cancelar
la vieja), que si la nueva falla la vieja se queda, y que el aviso de Calendly
de la reserva nueva no repite ni el correo de Rida ni el de «repártela»."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import pytest
from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment  # noqa: F401  (registra la tabla)
from src.db.enrollment_request import EnrollmentRequest  # noqa: F401
from src.db.panel_negocio import LeadPipeline  # noqa: F401
from src.db.reservas import ReservaPago, ReservaPlaza  # noqa: F401  (las lee la línea de tiempo)
from src.services.contactos import agenda as A
from src.services.contactos import reservar as R
from src.tests.services.test_reservar_llamada import TIPOS

ANTES = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)
NUEVA = ANTES + timedelta(days=3)


class Calendly:
    """Calendly de mentira: reserva, cancela y apunta lo que se le pide."""

    def __init__(self, reserva=201, cancela=201):
        self.pedidos: list[tuple[str, str, dict]] = []
        self.reserva, self.cancela = reserva, cancela

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
                    return httpx.Response(200, json={"collection": TIPOS}, request=pedido)
                if url.endswith("/invitees") and metodo == "POST":
                    if falso.reserva >= 400:
                        return httpx.Response(falso.reserva, json={"message": "No hay hueco"}, request=pedido)
                    return httpx.Response(201, json={"resource": {
                        "event": "https://api.calendly.com/scheduled_events/NUEVO",
                        "cancel_url": "https://calendly.com/cancellations/N",
                        "reschedule_url": "https://calendly.com/reschedulings/N"}}, request=pedido)
                if url.endswith("/cancellation") and metodo == "POST":
                    if falso.cancela >= 400:
                        return httpx.Response(falso.cancela, json={"message": "Event in the past"}, request=pedido)
                    return httpx.Response(201, json={"resource": {"reason": kw["json"]["reason"]}}, request=pedido)
                return httpx.Response(404, json={"message": "no"}, request=pedido)

        return Cliente()

    def de(self, final: str):
        return [p for p in self.pedidos if p[1].endswith(final)]


async def _cambiar(db, falso, **mas):
    datos = dict(cita_id="VIEJO:ana@x.com", nombre="Ana Gil", email="Ana@X.com", telefono="+31 6 1",
                 antes=ANTES.isoformat(), inicio=NUEVA.isoformat(), autor="Diego", confirmada=False)
    datos.update(mas)
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        return await R.cambiar_hora(**datos, db_session=db)


# ── lógica pura ────────────────────────────────────────────────────────────


def test_el_id_de_la_cita():
    assert R.uuid_de_cita("ABC:ana@x.com") == "ABC"
    assert R.uuid_de_cita("") == ""
    assert R.uuid_de_evento("https://api.calendly.com/scheduled_events/NUEVO") == "NUEVO"


def test_se_reconoce_el_aviso_del_cambio():
    ahora = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)
    cambio = {"created_at": "2026-10-31T11:30:00+00:00", "extra": {"inicio": "2026-11-04T17:00:00+00:00"}}
    assert R.es_el_cambio([cambio], "2026-11-04T17:00:00.000000Z", ahora)
    # Otra hora: es una reserva de verdad.
    assert not R.es_el_cambio([cambio], "2026-11-05T17:00:00Z", ahora)
    # Un cambio de hace días ya no tapa una reserva nueva a la misma hora.
    assert not R.es_el_cambio([cambio], "2026-11-04T17:00:00Z", ahora + timedelta(days=1))
    assert not R.es_el_cambio([], "2026-11-04T17:00:00Z", ahora)


def test_la_agenda_enseña_la_vieja_como_reprogramada():
    ev = {"uri": "https://api.calendly.com/scheduled_events/VIEJO", "status": "canceled", "start_time": "2026-11-01T17:00:00Z"}
    inv = {"email": "ana@x.com", "status": "canceled", "cancellation": {"reason": R.MOTIVO_CAMBIO_ENTERO}}
    assert A.cita_desde_calendly(ev, [inv])[0]["reprogramada"] is True
    # Cancelada sin más: no es reprogramada.
    inv2 = {**inv, "cancellation": {"reason": "No puedo ir"}}
    assert A.cita_desde_calendly(ev, [inv2])[0]["reprogramada"] is False


# ── cambiar la hora ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reserva_la_nueva_y_despues_cancela_la_vieja(db):
    falso = Calendly()
    A._cache["hasta"] = 9e18
    r = await _cambiar(db, falso)
    assert r["ok"] and r["cita_id"] == "NUEVO:ana@x.com" and r["aviso"] == ""
    orden = [p[1].rsplit("/", 1)[-1] for p in falso.pedidos if p[0] == "POST"]
    assert orden == ["invitees", "cancellation"]
    assert falso.de("/invitees")[0][2]["json"]["invitee"]["email"] == "ana@x.com"
    metodo, url, kw = falso.de("/cancellation")[0]
    assert "/scheduled_events/VIEJO/" in url and A.es_cambio_de_hora(kw["json"]["reason"])
    assert A._cache["hasta"] == 0.0

    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == R.TIPO_CAMBIO))).scalars().one()
    extra = json.loads(ev.extra)
    assert ev.email == "ana@x.com" and extra["cita_nueva"] == "NUEVO:ana@x.com" and extra["autor"] == "Diego"
    from src.services.contactos.contactos import _todos_los_eventos

    linea = [e for e in await _todos_los_eventos(db) if e["kind"] == R.TIPO_CAMBIO][0]
    assert linea["que"].startswith("Diego le cambió la llamada del ") and " al " in linea["que"]


@pytest.mark.asyncio
async def test_si_la_nueva_no_entra_la_vieja_se_queda(db):
    falso = Calendly(reserva=400)
    r = await _cambiar(db, falso)
    assert not r["ok"] and "No hay hueco" in r["motivo"]
    assert falso.de("/cancellation") == []
    # Sin rastro del cambio que no fue.
    assert (await db.execute(select(ContactEvent).where(ContactEvent.kind == R.TIPO_CAMBIO))).scalars().all() == []


@pytest.mark.asyncio
async def test_si_no_deja_cancelar_la_vieja_lo_avisa(db):
    r = await _cambiar(db, Calendly(cancela=403))
    assert r["ok"] and "Cancélala en Calendly" in r["aviso"] and "Event in the past" in r["aviso"]
    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == R.TIPO_CAMBIO))).scalars().one()
    assert json.loads(ev.extra)["sin_cancelar"] is True


@pytest.mark.asyncio
async def test_una_vieja_que_ya_paso_no_se_cancela(db):
    falso = Calendly()
    r = await _cambiar(db, falso, antes=(datetime.now(timezone.utc) - timedelta(hours=3)).isoformat())
    assert r["ok"] and falso.de("/cancellation") == []


@pytest.mark.asyncio
async def test_no_cambia_a_una_hora_pasada_ni_a_la_misma(db):
    falso = Calendly()
    r = await _cambiar(db, falso, inicio=(datetime.now(timezone.utc) - timedelta(hours=1)).isoformat())
    assert not r["ok"] and "pasado" in r["motivo"]
    r = await _cambiar(db, falso, inicio=ANTES.isoformat())
    assert not r["ok"] and "misma hora" in r["motivo"]
    assert falso.pedidos == []


@pytest.mark.asyncio
async def test_ya_hablado_con_la_persona_queda_confirmada(db):
    await _cambiar(db, Calendly(), confirmada=True)
    from src.services.contactos.confirmar_llamada import confirmadas

    assert "NUEVO:ana@x.com" in await confirmadas(db)


@pytest.mark.asyncio
async def test_el_aviso_de_calendly_del_cambio_no_repite_nada(db):
    await _cambiar(db, Calendly())
    assert await R.lo_cambio_el_equipo("ana@x.com", NUEVA.strftime("%Y-%m-%dT%H:%M:%S.000000Z"), db)
    assert not await R.lo_cambio_el_equipo("ana@x.com", ANTES.isoformat(), db)
    assert not await R.lo_cambio_el_equipo("leo@x.com", NUEVA.isoformat(), db)


# ── cancelar ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cancelar_la_llamada(db):
    falso = Calendly()
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", falso):
        r = await R.cancelar_llamada(cita_id="VIEJO:ana@x.com", nombre="Ana Gil", email="ana@x.com",
                                     inicio=ANTES.isoformat(), mensaje="", autor="Diego", db_session=db)
        assert r["ok"]
        assert falso.de("/cancellation")[0][2]["json"]["reason"] == R.MOTIVO_CANCELAR
        # Una que ya pasó no se cancela: se apunta qué pasó.
        r = await R.cancelar_llamada(cita_id="X:ana@x.com", nombre="", email="ana@x.com",
                                     inicio=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                                     mensaje="", autor="Diego", db_session=db)
        assert not r["ok"]
    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == R.TIPO_CANCELADA))).scalars().one()
    assert json.loads(ev.extra)["autor"] == "Diego"


@pytest.mark.asyncio
async def test_si_calendly_no_deja_cancelar_no_se_apunta(db):
    with patch.object(A, "_token", lambda: "tok"), patch.object(R, "_cliente", Calendly(cancela=403)):
        r = await R.cancelar_llamada(cita_id="VIEJO:ana@x.com", nombre="Ana", email="ana@x.com",
                                     inicio=ANTES.isoformat(), mensaje="Te escribo por WhatsApp", autor="Diego", db_session=db)
    assert not r["ok"] and "Event in the past" in r["motivo"]
    assert (await db.execute(select(ContactEvent).where(ContactEvent.kind == R.TIPO_CANCELADA))).scalars().all() == []

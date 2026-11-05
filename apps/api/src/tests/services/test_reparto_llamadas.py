"""Las dos mesas del tablero (Leads y Ventas) y el reparto de las llamadas
entre los closers (22/10/2026), contra una base de datos de verdad.

- La columna decide la mesa: Nuevo, Por llamar, No contesta y Contactado son
  de Leads; Agendado, No show, Seguimiento, Por pagar y Alumno, de Ventas.
  Descartado va a Ventas solo si llegó a tener una llamada.
- Asignar un closer no cambia la columna ni la fecha del último movimiento
  (si la cambiara, una reserva de Calendly dejaría de ponerla en Agendado).
- Mover de columna no pierde el closer, tampoco al juntar filas repetidas.
- El aviso de llamada nueva va a quien reparte; si no hay nadie puesto (o ya
  no está en el equipo), a los administradores.
"""

from datetime import datetime, timedelta, timezone

from sqlmodel import select

from src.db.enrollment_request import EnrollmentRequest
from src.db.panel_negocio import LeadPipeline
from src.services.contactos.contactos import _todos_los_eventos, fusionar_contactos
from src.services.panel import pipeline
from src.services.panel.reparto import destinos


def _hace(horas: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat()


async def _tablero(db) -> dict[str, dict]:
    fichas = fusionar_contactos(await _todos_los_eventos(db), set())
    return {t["id"]: t for t in (await pipeline.tablero(fichas, db))["tarjetas"]}


def test_cada_columna_en_su_mesa():
    for etapa in ("nuevo", "llamar", "no-contesta", "contactado"):
        assert pipeline.mesa_de(etapa, True) == "leads"
    for etapa in ("agendado", "no-show", "seguimiento", "pendiente-pago", "alumno"):
        assert pipeline.mesa_de(etapa, False) == "ventas"
    # Descartado sin haber hablado nunca con un closer: un lead que no siguió.
    assert pipeline.mesa_de("descartado", False) == "leads"
    # Con llamada: una venta perdida.
    assert pipeline.mesa_de("descartado", True) == "ventas"


def test_a_quien_avisar_de_una_llamada_nueva():
    equipo = [{"id": 7, "email": "Diego@X.com"}, {"id": 8, "email": "laura@x.com"}]
    admins = ["rida@x.com"]
    assert destinos(7, equipo, admins) == ["diego@x.com"]
    # Nadie puesto, o alguien que ya no está en el equipo: los administradores.
    assert destinos(0, equipo, admins) == admins
    assert destinos(99, equipo, admins) == admins


async def test_asignar_no_mueve_la_tarjeta_ni_su_fecha(db):
    db.add(EnrollmentRequest(email="ana@x.com", first_name="Ana", created_at=_hace(3)))
    await db.commit()

    t = await _tablero(db)
    assert t["ana@x.com"]["etapa"] == "nuevo" and t["ana@x.com"]["mesa"] == "leads"
    assert t["ana@x.com"]["closer_id"] == 0

    await pipeline.mover("ana@x.com", "agendado", None, None, "Rida", db)
    fila = (await db.execute(select(LeadPipeline).where(LeadPipeline.email == "ana@x.com"))).scalars().first()
    movida_el = fila.updated_at
    t = await _tablero(db)
    # En Ventas y sin closer: la pantalla la enseña en «Por asignar».
    assert t["ana@x.com"]["mesa"] == "ventas" and t["ana@x.com"]["closer_id"] == 0

    r = await pipeline.asignar("ana@x.com", 7, "Diego", "Diego", db)
    assert r["ok"] and r["cambia"]
    fila = (await db.execute(select(LeadPipeline).where(LeadPipeline.email == "ana@x.com"))).scalars().first()
    assert fila.updated_at == movida_el and fila.etapa == "agendado"
    t = await _tablero(db)
    assert t["ana@x.com"]["etapa"] == "agendado"
    assert (t["ana@x.com"]["closer_id"], t["ana@x.com"]["closer"]) == (7, "Diego")

    # Volver a dársela a quien ya la tiene no es un cambio (no hay correo).
    assert not (await pipeline.asignar("ana@x.com", 7, "Diego", "Diego", db))["cambia"]

    # Moverla de columna no le quita el closer.
    await pipeline.mover("ana@x.com", "seguimiento", None, None, "Diego", db)
    t = await _tablero(db)
    assert t["ana@x.com"]["etapa"] == "seguimiento" and t["ana@x.com"]["closer"] == "Diego"

    # Quitarle el closer.
    await pipeline.asignar("ana@x.com", 0, "", "Rida", db)
    t = await _tablero(db)
    assert t["ana@x.com"]["closer_id"] == 0 and t["ana@x.com"]["closer"] == ""


async def test_asignar_a_quien_nadie_ha_movido_no_lo_cambia_de_columna(db):
    db.add(EnrollmentRequest(email="bea@x.com", first_name="Bea", created_at=_hace(3)))
    await db.commit()
    await pipeline.asignar("bea@x.com", 8, "Laura", "Diego", db)
    t = await _tablero(db)
    # Sigue donde la pone su llegada (Nuevo): la fila solo guarda el closer.
    assert t["bea@x.com"]["etapa"] == "nuevo" and t["bea@x.com"]["closer"] == "Laura"


async def test_descartado_va_a_ventas_solo_si_tuvo_llamada(db):
    """Desde el 31/10 los leads también llevan closer («Asignarme» en Leads):
    tener closer ya no cuenta como haber tenido una llamada, o un lead que un
    closer descarta en Leads saltaría a Ventas. Lo que cuenta es la llamada:
    una reserva, una llamada del equipo, un cambio de hora…"""
    from src.db.contact_event import ContactEvent

    for e in ("sin", "lead", "reservo", "cambiada"):
        db.add(EnrollmentRequest(email=f"{e}@x.com", first_name=e, created_at=_hace(30)))
    db.add(ContactEvent(email="reservo@x.com", kind="reunion", created_at=_hace(20)))
    db.add(ContactEvent(email="cambiada@x.com", kind="llamada-cambiada", created_at=_hace(20)))
    await db.commit()
    await pipeline.mover("sin@x.com", "descartado", None, None, "Rida", db)
    # Un closer se queda el lead en Leads y luego lo descarta: sigue en Leads.
    await pipeline.asignar("lead@x.com", 7, "Diego", "Diego", db)
    await pipeline.mover("lead@x.com", "descartado", None, None, "Diego", db)
    for e in ("reservo", "cambiada"):
        await pipeline.asignar(f"{e}@x.com", 8, "Belén", "Rida", db)
        await pipeline.mover(f"{e}@x.com", "descartado", None, None, "Belén", db)
    t = await _tablero(db)
    assert t["sin@x.com"]["mesa"] == "leads"
    assert t["lead@x.com"]["mesa"] == "leads" and t["lead@x.com"]["closer"] == "Diego"
    assert t["reservo@x.com"]["mesa"] == "ventas"
    assert t["cambiada@x.com"]["mesa"] == "ventas" and t["cambiada@x.com"]["closer"] == "Belén"


async def test_un_lead_con_closer_sigue_en_su_columna_de_leads(db):
    db.add(EnrollmentRequest(email="ana@x.com", first_name="Ana", created_at=_hace(3)))
    await db.commit()
    await pipeline.asignar("ana@x.com", 8, "Belén", "Belén", db)
    t = await _tablero(db)
    assert (t["ana@x.com"]["etapa"], t["ana@x.com"]["mesa"]) == ("nuevo", "leads")
    assert (t["ana@x.com"]["closer_id"], t["ana@x.com"]["closer"]) == (8, "Belén")
    # Se mueve por Leads y no pierde el closer.
    await pipeline.mover("ana@x.com", "no-contesta", None, None, "Belén", db)
    t = await _tablero(db)
    assert (t["ana@x.com"]["etapa"], t["ana@x.com"]["mesa"], t["ana@x.com"]["closer"]) == ("no-contesta", "leads", "Belén")


async def test_filas_repetidas_no_pierden_el_closer(db):
    db.add(EnrollmentRequest(email="dup@x.com", first_name="Dup", created_at=_hace(30)))
    # Dos filas del mismo correo (pasaba con dos movimientos a la vez): la del
    # closer es la más vieja de las dos.
    db.add(LeadPipeline(email="dup@x.com", etapa="", closer_id=7, closer="Diego", asignado_at=_hace(2), updated_at=""))
    db.add(LeadPipeline(email="dup@x.com", etapa="contactado", updated_at=_hace(1)))
    await db.commit()
    t = await _tablero(db)
    assert t["dup@x.com"]["etapa"] == "contactado" and t["dup@x.com"]["closer"] == "Diego"

    await pipeline.mover("dup@x.com", "agendado", None, None, "Diego", db)
    filas = (await db.execute(select(LeadPipeline).where(LeadPipeline.email == "dup@x.com"))).scalars().all()
    assert len(filas) == 1 and filas[0].closer_id == 7 and filas[0].etapa == "agendado"


def test_el_correo_de_un_lead_no_habla_de_llamada():
    """Pasar un lead desde Leads (31/10): el closer tiene que llamarla, no
    entrar a una videollamada."""
    from src.services.users.emails import send_llamada_asignada_email

    datos = {"nombre": "Ana", "email": "ana@x.com", "telefono": "+31 6 1", "por": "Diego",
             "cuando": "jue 6 nov · 18:00", "enlace": "https://zoom.us/j/1", "lead": True}
    r = send_llamada_asignada_email("belen@x.com", datos, preview=True)
    assert r["subject"] == "Te han pasado una matrícula: Ana"
    assert "Aún no tiene llamada" in r["html"] and "mesa=leads" in r["html"]
    assert "Enlace de la videollamada" not in r["html"]
    # Sin `lead`, como siempre.
    r = send_llamada_asignada_email("belen@x.com", {**datos, "lead": False}, preview=True)
    assert r["subject"].startswith("Te han pasado una llamada: Ana · jue")
    assert "mesa=ventas" in r["html"] and "Enlace de la videollamada" in r["html"]


def test_al_leer_la_agenda_no_se_toca_lo_que_decidio_el_equipo():
    """05/11: pasar la tarjeta al anfitrión de Calendly le dio la vuelta a dos
    llamadas (Marylin era de Diego y la otra de Belén). Al leer la agenda solo
    se le pone closer a quien no tiene; lo que ya tiene closer se queda."""
    from datetime import datetime, timezone

    from src.services.panel.reparto import cambios_por_anfitrion

    ahora = datetime(2026, 11, 5, 18, 0, tzinfo=timezone.utc)
    diego, belen = {"id": 4, "nombre": "Diego"}, {"id": 5, "nombre": "Belén"}
    closer_de = {"h@x.com": diego, "belen@x.com": belen}
    cita = {"email": "ana@x.com", "estado": "activa", "anfitrion_email": "belen@x.com",
            "inicio": "2026-11-06T11:00:00Z", "reservada": "2026-11-05T10:00:00Z"}
    # Ya la lleva Diego (aunque se reservara después): no se toca.
    ya = {"ana@x.com": {"closer_id": 4, "asignado_at": "2026-11-04T09:00:00+00:00"}}
    assert cambios_por_anfitrion([cita], ya, closer_de, ahora) == {}
    # Sin closer: el de su cita.
    assert cambios_por_anfitrion([cita], {}, closer_de, ahora) == {"ana@x.com": belen}
    # Cancelada o con un anfitrión que no es closer: nada.
    assert cambios_por_anfitrion([{**cita, "estado": "cancelada"}], {}, closer_de, ahora) == {}
    assert cambios_por_anfitrion([{**cita, "anfitrion_email": "otro@x.com"}], {}, closer_de, ahora) == {}


def test_dos_llamadas_del_mismo_closer_a_la_vez():
    from src.services.panel.reparto import choques

    def c(i, nombre, closer, ini, fin="", estado="activa"):
        return {"id": i, "nombre": nombre, "closer_id": closer, "inicio": ini, "fin": fin, "estado": estado}

    citas = [
        c("a", "Ana", 4, "2026-11-06T11:00:00Z", "2026-11-06T11:45:00Z"),
        c("b", "Eva", 4, "2026-11-06T11:30:00Z"),
        c("x", "Sol", 5, "2026-11-06T11:00:00Z", "2026-11-06T11:45:00Z"),
        c("d", "Leo", 4, "2026-11-06T11:45:00Z", "2026-11-06T12:30:00Z"),
        c("e", "Max", 4, "2026-11-06T11:00:00Z", estado="cancelada"),
        c("f", "Bea", 0, "2026-11-06T11:00:00Z"),
    ]
    # Ana y Eva se pisan (las dos de Diego). Sol es de Belén; Leo empieza
    # cuando acaba Ana, pero Eva (sin fin, 45 min) le pisa; las canceladas y
    # las que no tienen closer no cuentan.
    assert choques(citas) == {"a": "Eva", "b": "Ana", "d": "Eva"}

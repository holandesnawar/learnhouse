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


async def test_descartado_va_a_ventas_si_tuvo_closer(db):
    db.add(EnrollmentRequest(email="sin@x.com", first_name="Sin", created_at=_hace(30)))
    db.add(EnrollmentRequest(email="con@x.com", first_name="Con", created_at=_hace(30)))
    await db.commit()
    await pipeline.mover("sin@x.com", "descartado", None, None, "Rida", db)
    await pipeline.asignar("con@x.com", 7, "Diego", "Diego", db)
    await pipeline.mover("con@x.com", "descartado", None, None, "Diego", db)
    t = await _tablero(db)
    assert t["sin@x.com"]["mesa"] == "leads"
    assert t["con@x.com"]["mesa"] == "ventas"


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

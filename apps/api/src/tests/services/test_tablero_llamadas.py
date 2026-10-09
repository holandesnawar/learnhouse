"""El tablero de Matrículas y la lista de Llamadas, contra una base de datos
de verdad (SQLite en memoria). 09/10: todo lo que entra, a llamar.

- Quien llegó hace menos de 48 h está en Nuevo; quien lleva más sin que nadie
  hable con él, en Por llamar. Con su temperatura y, si está en Llamadas,
  dónde se quedó.
- Quien solo bajó una guía no está en el tablero, salvo que lo manden a
  Llamadas; y si luego lo pasan a Contactado, no desaparece.
- Sacar a alguien de Nuevo / Por llamar lo marca como hecho en Llamadas (o
  quitado, si va a Descartado); marcarlo como hecho en Llamadas lo pasa a
  Contactado.
- Lo último que pasó manda: si vuelve a Llamadas después de moverlo, a llamar.
- Las columnas viejas (Propuesta, Perdido) se leen como las nuevas.
- Las notas viejas escritas en una fila de Llamadas con correo pasan a la
  ficha: no se pierde ninguna.
"""

import json
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.contact_seguimiento import ContactNota
from src.db.enrollment_request import EnrollmentRequest
from src.db.llamadas_templadas import LlamadaTemplada
from src.db.panel_negocio import LeadPipeline
from src.services.contactos.contactos import _todos_los_eventos, fusionar_contactos
from src.services.contactos.templadas import actualizar_templada, mandar_a_templadas
from src.services.panel import pipeline


def _hace(horas: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat()


async def _tablero(db) -> dict[str, dict]:
    fichas = fusionar_contactos(await _todos_los_eventos(db), set())
    return {t["id"]: t for t in (await pipeline.tablero(fichas, db))["tarjetas"]}


async def _llamadas(db, email: str) -> list[str]:
    filas = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == email))).scalars().all()
    return [f.estado for f in filas]


async def _hace_una_hora_que_la_movieron(db, email: str) -> None:
    fila = (await db.execute(select(LeadPipeline).where(LeadPipeline.email == email))).scalars().first()
    fila.updated_at = _hace(1)
    db.add(fila)
    await db.commit()


async def test_todo_lo_que_entra_va_a_nuevo_y_llamadas_va_a_juego(db):
    db.add(
        ContactEvent(
            email="ana@x.com", kind="admision", first_name="Ana", phone="+31612345678",
            extra=json.dumps({"embudo": "admision", "video": "visto", "ultima": "Horas a la semana"}),
            created_at=_hace(3),
        )
    )
    db.add(EnrollmentRequest(email="vieja@x.com", first_name="Vera", created_at=_hace(240)))
    db.add(ContactEvent(email="lead@x.com", kind="guia-bases", first_name="Leo", created_at=_hace(200)))
    db.add(LlamadaTemplada(nombre="Luis", telefono="+31 6 1111", origen="mano", estado="pendiente", created_at=_hace(1)))
    await db.commit()

    t = await _tablero(db)
    # Ana se quedó a medias: en Nuevo, en rojo y con dónde se quedó.
    assert t["ana@x.com"]["etapa"] == "nuevo"
    assert t["ana@x.com"]["temperatura"] == "caliente"
    assert "Horas a la semana" in t["ana@x.com"]["llamada"]["detalle"]
    assert await _llamadas(db, "ana@x.com") == ["pendiente"]
    # Su ficha dice la misma columna que su tarjeta.
    from src.services.panel.cliente import ficha_cliente

    assert (await ficha_cliente("ana@x.com", 1, True, db))["tablero"]["etapa"] == "nuevo"
    # Pidió plaza hace 10 días y nadie ha hablado con ella: Por llamar, en verde.
    assert t["vieja@x.com"]["etapa"] == "llamar" and t["vieja@x.com"]["temperatura"] == "frio"
    # Solo bajó una guía: fuera.
    assert "lead@x.com" not in t
    # Luis, apuntado a mano sin correo: tarjeta suelta en Nuevo.
    sueltas = [x for x in t.values() if x.get("suelta")]
    assert len(sueltas) == 1 and sueltas[0]["nombre"] == "Luis" and sueltas[0]["etapa"] == "nuevo"

    # El closer la llama y la pasa a En revisión: hecha en Llamadas.
    assert (await pipeline.mover("ana@x.com", "revision", None, None, "Closer", db))["ok"]
    assert await _llamadas(db, "ana@x.com") == ["hecha"]
    t = await _tablero(db)
    assert t["ana@x.com"]["etapa"] == "revision" and t["ana@x.com"]["llamada"] is None

    # Una hora después la vuelven a poner pendiente en Llamadas: a Nuevo.
    await _hace_una_hora_que_la_movieron(db, "ana@x.com")
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "ana@x.com"))).scalars().first()
    await actualizar_templada(fila.id, {"estado": "pendiente"}, db)
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "nuevo"

    # Descartada: quitada de Llamadas.
    await pipeline.mover("ana@x.com", "descartado", None, None, "Closer", db)
    assert await _llamadas(db, "ana@x.com") == ["descartada"]
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "descartado"


async def test_hecha_en_llamadas_sin_moverla_pasa_a_contactado(db):
    db.add(ContactEvent(email="eva@x.com", kind="admision", first_name="Eva", extra=json.dumps({"embudo": "admision"}), created_at=_hace(5)))
    await db.commit()
    assert (await _tablero(db))["eva@x.com"]["etapa"] == "nuevo"
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "eva@x.com"))).scalars().first()
    await actualizar_templada(fila.id, {"estado": "hecha"}, db)
    assert (await _tablero(db))["eva@x.com"]["etapa"] == "contactado"


async def test_quien_entra_por_llamadas_no_desaparece_al_moverlo(db):
    db.add(ContactEvent(email="lead@x.com", kind="guia-bases", first_name="Leo", created_at=_hace(200)))
    await db.commit()
    assert "lead@x.com" not in await _tablero(db)

    # «Mandar a Llamadas» desde su ficha: entra a Por llamar (bajó la guía
    # hace más de una semana: no es nuevo).
    await mandar_a_templadas("lead@x.com", "Leo", "+31 6 2222", "Admin", db)
    assert (await _tablero(db))["lead@x.com"]["etapa"] == "llamar"

    # Lo llaman y lo pasan a Contactado: sigue en el tablero.
    await pipeline.mover("lead@x.com", "contactado", None, None, "Closer", db)
    assert (await _tablero(db))["lead@x.com"]["etapa"] == "contactado"
    assert await _llamadas(db, "lead@x.com") == ["hecha"]


async def test_no_vino_vuelve_a_por_llamar(db):
    from src.services.contactos.resultado_llamada import guardar_resultado

    db.add(EnrollmentRequest(email="sol@x.com", first_name="Sol", created_at=_hace(5)))
    await db.commit()
    await pipeline.mover("sol@x.com", "contactado", None, None, "Closer", db)
    r = await guardar_resultado("cita-1", "sol@x.com", "no-vino", "No contestó", "2026-10-09T10:00:00Z", "Closer", 1, db)
    assert r["columna"] == "llamar"
    assert (await _tablero(db))["sol@x.com"]["etapa"] == "llamar"
    # Y lo que pasó queda en sus notas, las de la ficha.
    notas = (await db.execute(select(ContactNota).where(ContactNota.email == "sol@x.com"))).scalars().all()
    assert any("No vino" in n.texto and "No contestó" in n.texto for n in notas)


async def test_volver_a_nuevo_no_toca_llamadas_y_desmarca_atendida(db):
    db.add(EnrollmentRequest(email="eva@x.com", first_name="Eva", created_at=_hace(5)))
    await db.commit()
    await pipeline.mover("eva@x.com", "seguimiento", None, None, "Closer", db)
    s = (await db.execute(select(EnrollmentRequest).where(EnrollmentRequest.email == "eva@x.com"))).scalars().first()
    assert s.contacted_at  # salir de Nuevo = atendida
    await pipeline.mover("eva@x.com", "nuevo", None, None, "Closer", db)
    await db.refresh(s)
    assert not s.contacted_at
    assert await _llamadas(db, "eva@x.com") == []


async def test_columnas_viejas(db):
    db.add(EnrollmentRequest(email="a@x.com", first_name="A", created_at=_hace(5)))
    db.add(EnrollmentRequest(email="b@x.com", first_name="B", created_at=_hace(5)))
    db.add(LeadPipeline(email="a@x.com", etapa="propuesta", updated_at=_hace(2)))
    db.add(LeadPipeline(email="b@x.com", etapa="perdido", updated_at=_hace(2)))
    await db.commit()
    t = await _tablero(db)
    assert t["a@x.com"]["etapa"] == "seguimiento"
    assert t["b@x.com"]["etapa"] == "descartado"
    # Y quien mande todavía el nombre viejo no se queda sin mover.
    assert (await pipeline.mover("a@x.com", "perdido", None, None, "Closer", db))["etapa"] == "descartado"


async def test_las_notas_viejas_de_llamadas_pasan_a_la_ficha(db):
    db.add(
        LlamadaTemplada(
            nombre="Rosa", email="rosa@x.com", notas="Llamar después de las 18h", origen="mano",
            estado="pendiente", creado_por="Marco", created_at=_hace(48), updated_at=_hace(47),
        )
    )
    db.add(ContactEvent(email="rosa@x.com", kind="solicitud", first_name="Rosa", created_at=_hace(48)))
    await db.commit()
    await _tablero(db)
    notas = (await db.execute(select(ContactNota).where(ContactNota.email == "rosa@x.com"))).scalars().all()
    assert [(n.texto, n.autor) for n in notas] == [("Llamar después de las 18h", "Marco")]
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "rosa@x.com"))).scalars().first()
    assert fila.notas == ""
    # Una segunda vez no la duplica.
    await _tablero(db)
    assert len((await db.execute(select(ContactNota).where(ContactNota.email == "rosa@x.com"))).scalars().all()) == 1

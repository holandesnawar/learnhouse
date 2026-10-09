"""El tablero de Matrículas y la lista de Llamadas, contra una base de datos
de verdad (SQLite en memoria): la columna Seguimiento (08/10).

- Quien se quedó a medias en el proceso de admisión entra solo en Llamadas y
  sale en Seguimiento.
- Quien solo bajó una guía no está en el tablero, salvo que lo manden a
  Seguimiento; y si luego lo pasan a Contactado, no desaparece.
- Sacar a alguien de Seguimiento lo marca como hecho en Llamadas (o quitado,
  si va a Perdido); marcarlo como hecho en Llamadas lo saca de Seguimiento.
- Los de Llamadas sin ficha salen como tarjetas sueltas.
"""

import json
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from src.db.contact_event import ContactEvent
from src.db.llamadas_templadas import LlamadaTemplada
from src.services.contactos.contactos import _todos_los_eventos, fusionar_contactos
from src.services.contactos.templadas import actualizar_templada
from src.services.panel import pipeline


def _hace(horas: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat()


async def _tablero(db) -> dict[str, dict]:
    fichas = fusionar_contactos(await _todos_los_eventos(db), set())
    return {t["id"]: t for t in (await pipeline.tablero(fichas, db))["tarjetas"]}


async def _llamadas(db, email: str) -> list[str]:
    filas = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == email))).scalars().all()
    return [f.estado for f in filas]


async def test_seguimiento_va_a_juego_con_llamadas(db):
    db.add(
        ContactEvent(
            email="ana@x.com", kind="admision", first_name="Ana", phone="+31612345678",
            extra=json.dumps({"embudo": "admision", "video": "visto", "ultima": "Horas a la semana"}),
            created_at=_hace(3),
        )
    )
    db.add(ContactEvent(email="lead@x.com", kind="guia-bases", first_name="Leo", created_at=_hace(200)))
    db.add(LlamadaTemplada(nombre="Luis", telefono="+31 6 1111", origen="mano", estado="pendiente", created_at=_hace(1)))
    await db.commit()

    t = await _tablero(db)
    # Ana se quedó a medias: entra sola en Llamadas y sale en Seguimiento,
    # con su temperatura y dónde se quedó.
    assert t["ana@x.com"]["etapa"] == "seguimiento"
    assert t["ana@x.com"]["llamada"]["temperatura"] == "caliente"
    assert "Horas a la semana" in t["ana@x.com"]["llamada"]["detalle"]
    assert await _llamadas(db, "ana@x.com") == ["pendiente"]
    # Su ficha dice la misma columna que su tarjeta.
    from src.services.panel.cliente import ficha_cliente

    assert (await ficha_cliente("ana@x.com", 1, True, db))["tablero"]["etapa"] == "seguimiento"
    # Solo bajó una guía: fuera.
    assert "lead@x.com" not in t
    # Luis, apuntado a mano sin correo: tarjeta suelta en Seguimiento.
    sueltas = [x for x in t.values() if x.get("suelta")]
    assert len(sueltas) == 1 and sueltas[0]["nombre"] == "Luis" and sueltas[0]["etapa"] == "seguimiento"

    # El closer la llama y la pasa a Contactado: hecha en Llamadas.
    r = await pipeline.mover("ana@x.com", "contactado", None, None, "Closer", db)
    assert r["ok"]
    assert await _llamadas(db, "ana@x.com") == ["hecha"]
    t = await _tablero(db)
    assert t["ana@x.com"]["etapa"] == "contactado" and t["ana@x.com"]["llamada"] is None

    # Volver a mandarla a Seguimiento: pendiente otra vez, sin duplicar.
    await pipeline.mover("ana@x.com", "seguimiento", None, None, "Closer", db, nombre="Ana")
    assert await _llamadas(db, "ana@x.com") == ["pendiente"]
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "seguimiento"

    # Marcarla como hecha desde Llamadas la saca de Seguimiento.
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "ana@x.com"))).scalars().first()
    await actualizar_templada(fila.id, {"estado": "hecha"}, db)
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "contactado"

    # «A pendiente» en Llamadas: vuelve a Seguimiento aunque la hubieran movido.
    await actualizar_templada(fila.id, {"estado": "pendiente"}, db)
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "seguimiento"

    # Perdido: quitada de Llamadas.
    await pipeline.mover("ana@x.com", "perdido", None, None, "Closer", db)
    assert await _llamadas(db, "ana@x.com") == ["descartada"]
    assert (await _tablero(db))["ana@x.com"]["etapa"] == "perdido"


async def test_quien_entra_por_llamadas_no_desaparece_al_moverlo(db):
    db.add(ContactEvent(email="lead@x.com", kind="guia-bases", first_name="Leo", created_at=_hace(200)))
    await db.commit()
    assert "lead@x.com" not in await _tablero(db)

    # Lo mandan a Seguimiento (antes «Mandar a Llamadas» desde su ficha).
    await pipeline.mover("lead@x.com", "seguimiento", None, None, "Admin", db, nombre="Leo", telefono="+31 6 2222")
    t = await _tablero(db)
    assert t["lead@x.com"]["etapa"] == "seguimiento"
    fila = (await db.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == "lead@x.com"))).scalars().first()
    assert fila.estado == "pendiente" and fila.nombre == "Leo" and fila.telefono == "+31 6 2222"

    # Lo llaman y lo pasan a Contactado: sigue en el tablero.
    await pipeline.mover("lead@x.com", "contactado", None, None, "Closer", db)
    t = await _tablero(db)
    assert t["lead@x.com"]["etapa"] == "contactado"


async def test_ir_a_seguimiento_no_toca_la_marca_de_atendida(db):
    from src.db.enrollment_request import EnrollmentRequest

    db.add(EnrollmentRequest(email="eva@x.com", first_name="Eva", created_at=_hace(5), contacted_at=_hace(4)))
    await db.commit()
    await pipeline.mover("eva@x.com", "seguimiento", None, None, "Closer", db)
    s = (await db.execute(select(EnrollmentRequest).where(EnrollmentRequest.email == "eva@x.com"))).scalars().first()
    assert s.contacted_at  # sigue atendida

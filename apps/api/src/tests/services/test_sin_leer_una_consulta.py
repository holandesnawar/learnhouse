"""
Los «sin leer» de la comunidad, en una sola consulta (10/11/2026).

Antes era una consulta por canal, cada minuto y por pestaña abierta. Aquí se
comprueba que la consulta única da EXACTAMENTE lo mismo que la de antes.
Ver `_nuevos_por_canal` en src/services/communities/engagement.py.
"""

import asyncio
from types import SimpleNamespace

from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.communities.discussions import Discussion
from src.services.communities.engagement import _nuevos_por_canal, desde_cuando

YO = 7
OTRO = 8
ALTA = "2026-11-01 00:00:00.000000"


def _mensaje(n: int, canal: int, autor: int, fecha: str) -> Discussion:
    return Discussion(
        title=f"m{n}", content="", community_id=canal, org_id=1, author_id=autor,
        discussion_uuid=f"discussion_{n}", creation_date=fecha, update_date=fecha,
    )


async def _como_antes(canales, read_map, db_session) -> dict:
    """La versión de antes: una consulta por canal."""
    salida = {}
    for c in canales:
        consulta = select(Discussion).where(Discussion.community_id == c.id, Discussion.author_id != YO)
        desde = desde_cuando(read_map.get(c.id) or "", ALTA)
        if desde:
            consulta = consulta.where(Discussion.creation_date > desde)  # type: ignore
        filas = (await db_session.execute(consulta)).scalars().all()
        if filas:
            salida[c.id] = sorted(d.discussion_uuid for d in filas)
    return salida


def test_una_consulta_da_lo_mismo_que_una_por_canal():
    async def prueba():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: SQLModel.metadata.create_all(c, tables=[Discussion.__table__]))
        fabrica = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        consultas = []

        @event.listens_for(engine.sync_engine, "before_cursor_execute")
        def contar(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith("SELECT"):
                consultas.append(statement)

        canales = [SimpleNamespace(id=i) for i in (1, 2, 3, 4)]
        async with fabrica() as s:
            s.add_all([
                # Canal 1: leído el día 5; uno antes y dos después (uno mío).
                _mensaje(1, 1, OTRO, "2026-11-04 10:00:00.000000"),
                _mensaje(2, 1, OTRO, "2026-11-06 10:00:00.000000"),
                _mensaje(3, 1, YO, "2026-11-07 10:00:00.000000"),
                # Canal 2: nunca leído; cuenta desde el alta (día 1).
                _mensaje(4, 2, OTRO, "2026-10-20 10:00:00.000000"),
                _mensaje(5, 2, OTRO, "2026-11-02 10:00:00.000000"),
                _mensaje(6, 2, OTRO, "2026-11-03 10:00:00.000000"),
                # Canal 3: leído después de todo.
                _mensaje(7, 3, OTRO, "2026-11-02 10:00:00.000000"),
                # Canal 5: no es de los que ve.
                _mensaje(8, 5, OTRO, "2026-11-08 10:00:00.000000"),
            ])
            await s.commit()

            read_map = {1: "2026-11-05T00:00:00+00:00", 3: "2026-11-09T00:00:00+00:00"}
            antes = await _como_antes(canales, read_map, s)

            consultas.clear()
            nuevos = await _nuevos_por_canal(YO, canales, read_map, ALTA, s)
            assert len(consultas) == 1, "tiene que ser UNA consulta, no una por canal"

            ahora = {cid: sorted(d.discussion_uuid for d in filas) for cid, filas in nuevos.items()}
            assert ahora == antes
            assert ahora == {1: ["discussion_2"], 2: ["discussion_5", "discussion_6"]}

            # Sin canales no se pregunta nada.
            consultas.clear()
            assert await _nuevos_por_canal(YO, [], read_map, ALTA, s) == {}
            assert not consultas
        await engine.dispose()

    asyncio.run(prueba())

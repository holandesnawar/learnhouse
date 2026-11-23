"""El sobre del equipo (mensajes sin leer de los alumnos), en una sola
consulta (23/11/2026). Antes: una consulta por hilo de toda la escuela, cada
minuto y por pestaña. Tiene que dar lo mismo que la cuenta hilo a hilo."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.direct_messages import DirectMessage, DirectThread
from src.services.messages.direct import _sin_leer_equipo, _unread_for_staff


def test_una_consulta_da_lo_mismo_que_hilo_a_hilo():
    async def prueba():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda c: SQLModel.metadata.create_all(c, tables=[DirectThread.__table__, DirectMessage.__table__])
            )
        fabrica = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with fabrica() as db:
            hilos = [
                DirectThread(org_id=1, student_id=10, staff_read_at="2026-11-20 10:00:00"),
                DirectThread(org_id=1, student_id=11, staff_read_at=""),
                DirectThread(org_id=1, student_id=12, staff_read_at="2026-11-23 00:00:00"),
                DirectThread(org_id=2, student_id=13, staff_read_at=""),
            ]
            for h in hilos:
                db.add(h)
            await db.commit()
            msgs = [
                (hilos[0].id, 10, "2026-11-19 09:00:00"),  # leído
                (hilos[0].id, 10, "2026-11-21 09:00:00"),  # sin leer
                (hilos[0].id, None, "2026-11-22 09:00:00"),  # del equipo: no cuenta
                (hilos[1].id, 11, "2026-11-01 09:00:00"),  # sin leer (nunca leyó)
                (hilos[1].id, 11, "2026-11-02 09:00:00"),  # sin leer
                (hilos[2].id, 12, "2026-11-22 09:00:00"),  # leído
                (hilos[3].id, 13, "2026-11-22 09:00:00"),  # otra escuela
            ]
            for tid, autor, fecha in msgs:
                db.add(DirectMessage(thread_id=tid, author_id=autor, created_at=fecha))
            await db.commit()
            de_la_escuela = (await db.execute(select(DirectThread).where(DirectThread.org_id == 1))).scalars().all()
            antes = sum([await _unread_for_staff(t, db) for t in de_la_escuela])
            ahora, n = await _sin_leer_equipo(1, db)
            assert ahora == antes == 3
            assert n == 3
        await engine.dispose()

    asyncio.run(prueba())

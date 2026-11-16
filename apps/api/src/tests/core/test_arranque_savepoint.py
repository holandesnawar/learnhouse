"""Al arrancar, una sentencia de _ADDED_COLUMNS que falla no puede deshacer
las demás (cada una va en su SAVEPOINT)."""
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.events import database


@pytest.mark.asyncio
async def test_una_sentencia_que_falla_no_deshace_las_demas(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE t (id INTEGER)"))

    monkeypatch.setattr(
        database,
        "_ADDED_COLUMNS",
        [
            "ALTER TABLE t ADD COLUMN a TEXT",
            "ALTER TABLE no_existe ADD COLUMN x TEXT",  # falla
            "ALTER TABLE t ADD COLUMN b TEXT",
        ],
    )
    monkeypatch.setattr(database, "_DATOS_UNA_VEZ", ["INSERT INTO t (id) VALUES (1)"])

    async with engine.begin() as conn:
        await database._ensure_added_columns(conn)

    async with engine.connect() as conn:
        cols = [r[1] for r in (await conn.execute(text("PRAGMA table_info(t)"))).all()]
        filas = (await conn.execute(text("SELECT count(*) FROM t"))).scalar()
    await engine.dispose()

    assert "a" in cols and "b" in cols
    assert filas == 1

"""Quién queda fuera de los números (ver src/db/metric_exclusion.py)."""

from datetime import datetime, timezone

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.metric_exclusion import MetricExclusion


def _clave(email: str) -> str:
    return (email or "").strip().lower()


async def emails_excluidos(db_session: AsyncSession) -> set[str]:
    """Nunca lanza: si la tabla no se puede leer, no se excluye a nadie."""
    try:
        filas = (await db_session.execute(select(MetricExclusion.email))).scalars().all()
        return {_clave(e) for e in filas if e}
    except Exception:  # noqa: BLE001
        return set()


async def ids_excluidos(db_session: AsyncSession) -> set[int]:
    """Los usuarios de la escuela con un correo excluido."""
    from src.db.users import User

    correos = await emails_excluidos(db_session)
    if not correos:
        return set()
    filas = (
        await db_session.execute(select(User.id).where(func.lower(User.email).in_(list(correos))))  # type: ignore[attr-defined]
    ).scalars().all()
    return {int(i) for i in filas if i is not None}


async def excluir(email: str, motivo: str, db_session: AsyncSession) -> bool:
    clave = _clave(email)
    if "@" not in clave:
        return False
    if clave in await emails_excluidos(db_session):
        return True
    db_session.add(MetricExclusion(email=clave, motivo=(motivo or "")[:200], created_at=datetime.now(timezone.utc).isoformat()))
    await db_session.commit()
    return True


async def volver_a_contar(email: str, db_session: AsyncSession) -> None:
    clave = _clave(email)
    for f in (
        await db_session.execute(select(MetricExclusion).where(func.lower(MetricExclusion.email) == clave))
    ).scalars().all():
        await db_session.delete(f)
    await db_session.commit()

"""
Notas y "volver a llamar" de cada contacto (ver src/db/contact_seguimiento.py).

Lo usan el closer y los administradores desde Contactos y Llamadas. Las notas
no se editan: se añaden y, si sobra una, se borra (su autor o un
administrador). Así queda el historial de lo que se habló, en orden.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_seguimiento import ContactNota, ContactRecordatorio

MAX_NOTA = 4000


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clave(email: str) -> str:
    return (email or "").strip().lower()


def fecha_valida(fecha: str) -> bool:
    try:
        datetime.strptime(fecha, "%Y-%m-%d")
        return True
    except (TypeError, ValueError):
        return False


async def seguimiento_de(email: str, db_session: AsyncSession) -> dict:
    clave = _clave(email)
    notas = (
        await db_session.execute(
            select(ContactNota).where(func.lower(ContactNota.email) == clave).order_by(ContactNota.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().all()
    rec = await _recordatorio(clave, db_session)
    return {
        "notas": [
            {"id": n.id, "texto": n.texto, "autor": n.autor, "autor_id": n.autor_id, "created_at": n.created_at}
            for n in notas
        ],
        "volver_a_llamar": {"fecha": rec.fecha, "motivo": rec.motivo, "autor": rec.autor} if rec else None,
    }


async def _recordatorio(clave: str, db_session: AsyncSession) -> Optional[ContactRecordatorio]:
    return (
        await db_session.execute(
            select(ContactRecordatorio).where(func.lower(ContactRecordatorio.email) == clave)
        )
    ).scalars().first()


async def anadir_nota(email: str, texto: str, autor_id: int, autor: str, db_session: AsyncSession) -> dict:
    nota = ContactNota(
        email=_clave(email),
        texto=texto.strip()[:MAX_NOTA],
        autor_id=autor_id,
        autor=(autor or "")[:120],
        created_at=_ahora(),
    )
    db_session.add(nota)
    await db_session.commit()
    await db_session.refresh(nota)
    return {"id": nota.id, "texto": nota.texto, "autor": nota.autor, "autor_id": nota.autor_id, "created_at": nota.created_at}


async def borrar_nota(nota_id: int, user_id: int, es_admin: bool, db_session: AsyncSession) -> Optional[bool]:
    """True si se borró, False si no es suya, None si no existe."""
    nota = (await db_session.execute(select(ContactNota).where(ContactNota.id == nota_id))).scalars().first()
    if nota is None:
        return None
    if not es_admin and nota.autor_id != user_id:
        return False
    await db_session.delete(nota)
    await db_session.commit()
    return True


async def poner_recordatorio(
    email: str, fecha: str, motivo: str, autor: str, db_session: AsyncSession
) -> Optional[dict]:
    """Pone (o cambia) la fecha de volver a llamar. Fecha vacía = quitarla."""
    clave = _clave(email)
    rec = await _recordatorio(clave, db_session)
    if not fecha:
        if rec:
            await db_session.delete(rec)
            await db_session.commit()
        return None
    if rec is None:
        rec = ContactRecordatorio(email=clave)
    rec.fecha = fecha
    rec.motivo = (motivo or "").strip()[:200]
    rec.autor = (autor or "")[:120]
    rec.updated_at = _ahora()
    db_session.add(rec)
    await db_session.commit()
    return {"fecha": rec.fecha, "motivo": rec.motivo, "autor": rec.autor}


async def todos_los_recordatorios(db_session: AsyncSession) -> dict[str, dict]:
    """correo → {fecha, motivo}. Para marcar las líneas y la lista de "Hoy"."""
    filas = (await db_session.execute(select(ContactRecordatorio))).scalars().all()
    return {r.email: {"fecha": r.fecha, "motivo": r.motivo} for r in filas if r.fecha}


async def borrar_seguimiento(email: str, db_session: AsyncSession) -> None:
    """Para el borrado de pruebas: sin commit (lo hace quien llama)."""
    clave = _clave(email)
    for modelo in (ContactNota, ContactRecordatorio):
        for f in (
            await db_session.execute(select(modelo).where(func.lower(modelo.email) == clave))
        ).scalars().all():
            await db_session.delete(f)


async def resumen_seguimiento(db_session: AsyncSession, ultimas: int = 30) -> dict:
    """Lo que necesitan las listas de un vistazo: la fecha de volver a llamar
    de cada persona, cuántas notas tiene, y las últimas notas del equipo (para
    que el administrador vea lo que va apuntando el closer sin abrir fichas)."""
    notas = (
        await db_session.execute(select(ContactNota).order_by(ContactNota.id.desc()))  # type: ignore[attr-defined]
    ).scalars().all()
    por_email: dict[str, int] = {}
    for n in notas:
        por_email[n.email] = por_email.get(n.email, 0) + 1
    return {
        "recordatorios": await todos_los_recordatorios(db_session),
        "notas_por_email": por_email,
        "ultimas_notas": [
            {"id": n.id, "email": n.email, "texto": n.texto, "autor": n.autor, "created_at": n.created_at}
            for n in notas[:ultimas]
        ],
    }

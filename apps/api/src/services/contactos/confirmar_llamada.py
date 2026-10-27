"""
«Confirmada»: la persona ha dicho que sí viene a su llamada (27/10/2026).

Pedido del usuario: "mucha gente no se presenta". Se decidió que el closer
nuevo haga el seteo a mano (WhatsApp en cuanto reserva, una llamada si no
contesta y otro WhatsApp el mismo día), en vez de montar ya el WhatsApp
automático. Para que eso se pueda trabajar y medir:

- En cada cita que aún no ha pasado, «Marcar como confirmada» cuando la
  persona contesta que sí. Se ve en la agenda, en la tarjeta del tablero y en
  su ficha («Confirmó su llamada del jue 30 oct, 18:00 · lo apuntó Diego»).
- Arriba de Llamadas, «Por confirmar»: las de hoy y mañana que nadie ha
  confirmado todavía. Es la lista de trabajo del closer.
- En KPIs, cuántos no se presentan entre las confirmadas y entre las que no.
  Eso dice en números si el seteo sirve.

Se guarda como un evento de contacto (`kind = "llamada-confirmada"`, el id de
la cita de Calendly en `extra`), sin tabla nueva: así sale solo en la línea de
tiempo de la ficha. Una por cita: confirmar otra vez la misma cita reescribe
la fila, y «Quitar» la borra. No se escribe nada en Calendly.
"""

import json
from datetime import datetime, timezone
from typing import Iterable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent

KIND = "llamada-confirmada"


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extra(texto: str) -> dict:
    try:
        d = json.loads(texto) if texto else {}
        return d if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def ids_confirmadas(fichas: Iterable[dict]) -> set[str]:
    """Las citas confirmadas, a partir de los eventos de las fichas (las de
    `fusionar_contactos`). Función pura: la usan el tablero y los KPIs."""
    salida: set[str] = set()
    for f in fichas or []:
        for e in f.get("eventos") or []:
            if e.get("kind") == KIND:
                cid = str((e.get("extra") or {}).get("cita_id") or "")
                if cid:
                    salida.add(cid)
    return salida


async def _filas(db_session: AsyncSession) -> list[ContactEvent]:
    return list((await db_session.execute(select(ContactEvent).where(ContactEvent.kind == KIND))).scalars().all())


async def confirmadas(db_session: AsyncSession) -> dict[str, dict]:
    """{cita_id: {"autor", "cuando"}} de todas las citas confirmadas."""
    salida: dict[str, dict] = {}
    for f in await _filas(db_session):
        extra = _extra(f.extra)
        cid = str(extra.get("cita_id") or "")
        if cid:
            salida[cid] = {"autor": extra.get("autor") or "", "cuando": f.created_at or ""}
    return salida


async def confirmar(cita_id: str, email: str, nombre: str, inicio: str, autor: str, db_session: AsyncSession) -> dict:
    clave = (email or "").strip().lower()
    cita_id = (cita_id or "").strip()
    if not cita_id or "@" not in clave:
        return {"ok": False, "motivo": "Falta la cita o el correo"}
    filas = [f for f in await _filas(db_session) if str(_extra(f.extra).get("cita_id") or "") == cita_id]
    fila = filas[0] if filas else ContactEvent(email=clave, kind=KIND)
    for sobra in filas[1:]:
        await db_session.delete(sobra)
    partes = (nombre or "").strip().split(" ", 1)
    fila.email = clave
    fila.first_name = (partes[0] if partes else "")[:120]
    fila.last_name = (partes[1] if len(partes) > 1 else "")[:120]
    fila.source = "equipo"
    fila.extra = json.dumps({"cita_id": cita_id, "inicio": (inicio or "")[:40], "autor": (autor or "")[:120]}, ensure_ascii=False)
    fila.created_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "confirmada": {"autor": (autor or "")[:120], "cuando": fila.created_at}}


async def quitar(cita_id: str, db_session: AsyncSession) -> dict:
    cita_id = (cita_id or "").strip()
    if not cita_id:
        return {"ok": False, "motivo": "Falta la cita"}
    n = 0
    for f in await _filas(db_session):
        if str(_extra(f.extra).get("cita_id") or "") == cita_id:
            await db_session.delete(f)
            n += 1
    await db_session.commit()
    return {"ok": True, "quitadas": n}

"""
Los intentos de contacto dentro de «Contactado» (08/11/2026).

Pedido del usuario: "en la columna de contactado, que dentro esté como en
subcolumnas de qué nivel está el contacto: primera etapa, llamada y primer
mensaje; segunda etapa, llamada y segundo mensaje; y si nada, descarte… que
al entrar en la ficha ponga: se ha llamado una vez, se ha escrito el primer
mensaje por WhatsApp, no responde, siguiente etapa… y si a la tercera nada,
descarte".

Así:

- Tres intentos. En cada uno se apunta la LLAMADA y el WHATSAPP (los dos o
  uno solo). Cada cosa es un evento de contacto (`kind = "intento-contacto"`,
  en `extra`: intento, qué, autor y una nota opcional), sin tabla nueva: así
  sale solo en la línea de tiempo de la ficha. Apuntar otra vez lo mismo
  reescribe la fila; «Quitar» la borra.
- El NIVEL de la persona es el intento más alto con algo apuntado (0 = aún
  ninguno). La tarjeta del tablero lo dice («Intento 2 · llamada y
  WhatsApp») y la columna Contactado las agrupa por nivel.
- Tras el tercer intento, la ficha propone «Descartar» (que es mover la
  tarjeta a Descartado, como siempre). No se descarta nada solo.

`resumen` es pura (con test): la usan la ficha y el tablero.
"""

import json
from datetime import datetime, timezone
from typing import Iterable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent

KIND = "intento-contacto"
INTENTOS = (1, 2, 3)
QUE = ("llamada", "whatsapp")
NOMBRE_QUE = {"llamada": "le llamó", "whatsapp": "le escribió por WhatsApp"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extra(texto) -> dict:
    if isinstance(texto, dict):
        return texto
    try:
        d = json.loads(texto) if texto else {}
        return d if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def resumen(eventos: Iterable[dict]) -> dict:
    """{"nivel": 0-3, "intentos": [{"intento", "llamada", "whatsapp"}…]} a
    partir de los eventos de una ficha (los de `fusionar_contactos`). Cada
    paso hecho lleva {"autor", "cuando", "nota"}; lo no hecho, None."""
    hechos: dict[tuple[int, str], dict] = {}
    for e in eventos or []:
        if e.get("kind") != KIND:
            continue
        x = _extra(e.get("extra"))
        try:
            n = int(x.get("intento") or 0)
        except (TypeError, ValueError):
            continue
        que = str(x.get("que") or "")
        if n in INTENTOS and que in QUE:
            hechos[(n, que)] = {"autor": x.get("autor") or "", "cuando": e.get("when") or x.get("cuando") or "", "nota": x.get("nota") or ""}
    nivel = max((n for (n, _q) in hechos), default=0)
    return {
        "nivel": nivel,
        "intentos": [{"intento": n, **{q: hechos.get((n, q)) for q in QUE}} for n in INTENTOS],
    }


def texto_linea_de_tiempo(extra: dict) -> str:
    """«Diego le llamó (intento 2): no contesta»."""
    quien = extra.get("autor") or "El equipo"
    que = NOMBRE_QUE.get(str(extra.get("que") or ""), "intentó contactarle")
    texto = f"{quien} {que} (intento {extra.get('intento') or '?'})"
    return texto + (f": {extra['nota']}" if extra.get("nota") else "")


async def _filas(email: str, db_session: AsyncSession) -> list[ContactEvent]:
    q = select(ContactEvent).where(ContactEvent.kind == KIND, ContactEvent.email == email)
    return list((await db_session.execute(q)).scalars().all())


async def apuntar(email: str, intento: int, que: str, nota: str, autor: str, db_session: AsyncSession) -> dict:
    clave = (email or "").strip().lower()
    if "@" not in clave:
        return {"ok": False, "motivo": "Falta el correo"}
    if intento not in INTENTOS or que not in QUE:
        return {"ok": False, "motivo": "Intento o paso no válido"}
    filas = [f for f in await _filas(clave, db_session) if _extra(f.extra).get("intento") == intento and _extra(f.extra).get("que") == que]
    fila = filas[0] if filas else ContactEvent(email=clave, kind=KIND)
    for sobra in filas[1:]:
        await db_session.delete(sobra)
    fila.source = "equipo"
    fila.extra = json.dumps(
        {"intento": intento, "que": que, "autor": (autor or "")[:120], "nota": (nota or "").strip()[:300]}, ensure_ascii=False
    )
    fila.created_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True}


async def quitar(email: str, intento: int, que: str, db_session: AsyncSession) -> dict:
    clave = (email or "").strip().lower()
    n = 0
    for f in await _filas(clave, db_session):
        x = _extra(f.extra)
        if x.get("intento") == intento and x.get("que") == que:
            await db_session.delete(f)
            n += 1
    await db_session.commit()
    return {"ok": True, "quitados": n}

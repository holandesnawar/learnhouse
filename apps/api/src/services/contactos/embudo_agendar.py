"""
Los números de /agendar (la cualificación antes de la llamada): cuánta gente
empieza, cuánta termina, cuánta encaja y cuánta reserva hora. Para la página
"Páginas de la web" del closer y para Llamadas.

Una persona cuenta una vez por paso aunque repita el formulario (se cuenta por
correo). La lógica es pura (`resumen_agendar`, con test).
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent

_KINDS = ("agendar-empezado", "cualificacion", "reunion")


def _fecha(texto: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat((texto or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def resumen_agendar(eventos: list[dict], ahora: Optional[datetime] = None, fuera: set[str] = frozenset()) -> dict:
    """eventos: {kind, email, created_at, extra(dict)}. Devuelve los pasos del
    embudo para los últimos 7 días, 30 días y desde siempre."""
    ahora = ahora or datetime.now(timezone.utc)
    ventanas = {"7d": ahora - timedelta(days=7), "30d": ahora - timedelta(days=30), "total": None}
    salida = {}
    for nombre, desde in ventanas.items():
        empezaron, terminaron, encajan, reservaron = set(), set(), set(), set()
        for e in eventos:
            email = (e.get("email") or "").strip().lower()
            if not email or email in fuera:
                continue
            cuando = _fecha(e.get("created_at", ""))
            if desde and (cuando is None or cuando < desde):
                continue
            k = e.get("kind")
            if k == "agendar-empezado":
                empezaron.add(email)
            elif k == "cualificacion":
                terminaron.add(email)
                empezaron.add(email)
                if (e.get("extra") or {}).get("apto"):
                    encajan.add(email)
            elif k == "reunion":
                reservaron.add(email)
        salida[nombre] = {
            "empezaron": len(empezaron),
            "terminaron": len(terminaron),
            "encajan": len(encajan),
            "no_encajan": len(terminaron - encajan),
            "reservaron": len(reservaron),
        }
    return salida


async def embudo_agendar(db_session: AsyncSession) -> dict:
    from src.services.contactos.metricas import emails_excluidos

    filas = (
        await db_session.execute(select(ContactEvent).where(ContactEvent.kind.in_(_KINDS)))  # type: ignore[attr-defined]
    ).scalars().all()
    eventos = []
    for f in filas:
        try:
            extra = json.loads(f.extra) if f.extra else {}
        except Exception:  # noqa: BLE001
            extra = {}
        eventos.append({"kind": f.kind, "email": f.email, "created_at": f.created_at, "extra": extra})
    return resumen_agendar(eventos, fuera=await emails_excluidos(db_session))

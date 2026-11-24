"""Juntar lo de una persona que cambió de correo (24/11/2026).

Pedido del usuario: «a Yojaris le cambiamos el correo… no sale en las
estadísticas, el correo antiguo sale como que nunca ha entrado».

El panel junta a cada persona por CORREO (ficha, pagos, notas, tablero…), y la
cuenta de la escuela es otra cosa. Al cambiar el correo con el que entra un
alumno (`panel/enlace_contrasena.py::cambiar_correo`) solo cambiaba la cuenta:
su pago, su ficha y sus notas seguían con el correo de antes, que ya no tenía
cuenta. Por eso Clientes la daba por «sin entrar» y su ficha de alumno no
encontraba sus pagos.

Ahora, al cambiar el correo, TODO lo suyo pasa al correo nuevo (`mover`), tabla
por tabla y cada una en su propio paso (si una falla, las demás siguen). Para
quien se cambió antes de esto (Yojaris), Progreso → «Juntar con su correo de
antes» hace lo mismo a mano.

Lo que NO se toca, a propósito:
- `email_log`: es la lista de correos ENVIADOS, y se mandaron a la dirección de
  entonces.
- Stripe, Calendly y systeme.io: viven fuera. Una llamada vieja de Calendly
  sigue saliendo con el correo de antes en la agenda.

Queda un evento `correo-cambiado` en su ficha («El correo cambió de … a …»),
que no cuenta como origen ni como «lo último que hizo».
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

KIND = "correo-cambiado"

#: Las tablas que guardan cosas de una persona por su correo.
TABLAS = (
    "contact_event",
    "contact_nota",
    "contact_recordatorio",
    "call_outcome",
    "enrollment",
    "enrollment_request",
    "lead_pipeline",
    "panel_task",
    "plan_pagos",
    "reserva_plaza",
    "comision_closer",
    "reto_semana",
    "vision_payment",
    "metric_exclusion",
    "llamada_templada",
)


def limpio(correo: str) -> str:
    return (correo or "").strip().lower()


def texto_linea_de_tiempo(extra: dict) -> str:
    """Puro. Lo que sale en la línea de tiempo de la ficha."""
    antes = (extra or {}).get("antes") or ""
    ahora = (extra or {}).get("ahora") or ""
    por = (extra or {}).get("por") or ""
    texto = f"Su correo cambió de {antes} a {ahora}" if antes and ahora else "Su correo cambió"
    return texto + (f" (lo hizo {por})" if por else "")


async def _uno(db_session: AsyncSession, sql: str, params: dict) -> int:
    """Un paso aparte: si falla, se deshace solo ese y se sigue."""
    try:
        async with db_session.begin_nested():
            r = await db_session.execute(text(sql), params)
            return int(r.rowcount or 0)
    except Exception as e:  # noqa: BLE001
        logger.warning("Juntar correo: un paso no se pudo hacer (%s)", type(e).__name__)
        return 0


async def mover(antes: str, ahora: str, db_session: AsyncSession, por: str = "", user_id: int | None = None) -> dict:
    """Pasa todo lo del correo `antes` al correo `ahora`. Devuelve cuántas filas
    se movieron por tabla. No hace nada si son el mismo correo."""
    a, n = limpio(antes), limpio(ahora)
    if not a or not n or a == n:
        return {"movidas": 0, "por_tabla": {}}
    por_tabla: dict[str, int] = {}
    # La fila automática de Llamadas va por una clave única `auto:<correo>`:
    # se renombra solo si la nueva aún no existe (si existe, se queda la de antes).
    await _uno(
        db_session,
        "UPDATE llamada_templada SET clave = :cn WHERE clave = :ca "
        "AND NOT EXISTS (SELECT 1 FROM llamada_templada WHERE clave = :cn)",
        {"cn": f"auto:{n}", "ca": f"auto:{a}"},
    )
    for tabla in TABLAS:
        hechas = await _uno(db_session, f"UPDATE {tabla} SET email = :n WHERE lower(email) = :a", {"n": n, "a": a})
        if hechas:
            por_tabla[tabla] = hechas
    movidas = sum(por_tabla.values())
    # Que quede en su ficha. Es un evento de la escuela, no algo que hizo ella.
    try:
        from src.db.contact_event import ContactEvent

        async with db_session.begin_nested():
            db_session.add(
                ContactEvent(
                    email=n,
                    kind=KIND,
                    source="escuela",
                    extra=json.dumps({"antes": a, "ahora": n, "por": por, "user_id": user_id, "filas": movidas}),
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("Juntar correo: no se pudo apuntar en la ficha (%s)", type(e).__name__)
    await db_session.commit()
    logger.info("Correo juntado: %s filas en %s tablas", movidas, len(por_tabla))
    return {"movidas": movidas, "por_tabla": por_tabla}

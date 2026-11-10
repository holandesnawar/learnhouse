"""
La escuela por dentro, para quien está haciendo «Mijn eerste week» (10/11/2026).

El usuario, al ver la primera versión del regalo: "no está dentro de la
escuela, no se ve nada con candado… es solo una web". Tenía razón: era una
página suelta con una lista de módulos escrita a mano.

Ahora el regalo se ve DENTRO del armazón de la escuela (la misma barra, los
mismos bloques) y lo de los alumnos está a la vista con candado, con los
datos DE VERDAD de la escuela, sacados de aquí:

- la formación: sus módulos y los nombres de sus clases (los títulos, no el
  contenido);
- las clases en directo: cuáles hay y la próxima de cada una (día y tema);
- la comunidad: los canales y cuántos mensajes ha habido esta semana (la
  cifra, nunca un mensaje ni un nombre).

Es público (no hay sesión: son invitados) y por eso solo da nombres y cifras.
Nada de alumnos, nada de contenido, nada de enlaces a salas. Se guarda cinco
minutos en memoria: la piden todos los invitados y cambia poco.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

_CACHE: dict[str, Any] = {"at": 0.0, "datos": None}
_SEG = 300

_EMOJI = re.compile(r"[^\w\s·\-&'’,.:¿?¡!()/áéíóúüñÁÉÍÓÚÜÑ]", re.UNICODE)


def sin_emoji(nombre: str) -> str:
    """«🏆 Victorias» → «Victorias» (la barra de la escuela ya no pinta emojis)."""
    return " ".join(_EMOJI.sub(" ", nombre or "").split())


def tipo_de_clase(nombre: str) -> str:
    n = (nombre or "").lower()
    if "master" in n:
        return "masterclass"
    if "spreek" in n or "spreken" in n or "convers" in n:
        return "conversacion"
    return "semanal"


def modulos_de(clases: list[dict], max_clases: int = 14) -> list[dict]:
    """Las clases de la formación en orden, agrupadas por módulo: el nombre del
    módulo, cuántas clases tiene y los títulos de las primeras. Pura."""
    out: list[dict] = []
    for c in clases:
        nombre = (c.get("modulo") or "").strip()
        if not nombre:
            continue
        if not out or out[-1]["nombre"] != nombre:
            out.append({"nombre": nombre, "total": 0, "clases": []})
        out[-1]["total"] += 1
        if len(out[-1]["clases"]) < max_clases and (c.get("clase") or "").strip():
            out[-1]["clases"].append(c["clase"].strip())
    return out


def sin_repetir(clases: list[dict]) -> list[dict]:
    """Dos copias de la misma clase (Groep rood y Groep blauw) son una sola
    para quien mira desde fuera: se queda la que antes tenga clase. Pura."""
    por_nombre: dict[str, dict] = {}
    for c in clases:
        clave = c["nombre"].strip().lower()
        viejo = por_nombre.get(clave)
        if viejo is None:
            por_nombre[clave] = c
            continue
        a = (viejo.get("proxima") or {}).get("fecha") or "9999"
        b = (c.get("proxima") or {}).get("fecha") or "9999"
        if b < a:
            por_nombre[clave] = c
    return sorted(por_nombre.values(), key=lambda c: (c["tipo"] != "masterclass", c["tipo"] != "conversacion", c["nombre"]))


async def _formacion(db_session: AsyncSession) -> dict:
    from src.services.panel.avance import _curso_formacion, clases_en_orden

    curso = await _curso_formacion(db_session)
    if curso is None:
        return {"nombre": "Formación A0-A1", "modulos": [], "clases": 0}
    clases = await clases_en_orden(db_session, curso.id or 0)
    return {"nombre": curso.name, "modulos": modulos_de(clases), "clases": len(clases)}


async def _clases(org_id: int, db_session: AsyncSession) -> list[dict]:
    from src.db.tareas import TareaSemana
    from src.services.panel.tandas import hoy_nl
    from src.services.tareas import tareas as T

    hoy = hoy_nl()
    out = []
    for c in await T.clases_en_directo(org_id, db_session):
        curso = await T.curso_de(c["uuid"], db_session)
        if curso is None or not getattr(curso, "published", True):
            continue
        filas = (
            await db_session.execute(
                select(TareaSemana).where(TareaSemana.org_id == org_id, TareaSemana.course_uuid == c["uuid"], TareaSemana.fecha >= hoy)
            )
        ).scalars().all()
        siguiente = min(filas, key=lambda s: s.fecha, default=None)
        out.append(
            {
                "nombre": curso.name,
                "tipo": tipo_de_clase(curso.name),
                "proxima": {"fecha": siguiente.fecha, "tema": siguiente.tema} if siguiente else None,
            }
        )
    return sin_repetir(out)


async def _canales(org_id: int, db_session: AsyncSession) -> list[dict]:
    from sqlalchemy import func

    from src.db.communities.communities import Community
    from src.db.communities.discussions import Discussion

    desde = str(datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7))
    canales = (await db_session.execute(select(Community).where(Community.org_id == org_id))).scalars().all()
    cuentas = dict(
        (
            await db_session.execute(
                select(Discussion.community_id, func.count()).where(Discussion.creation_date >= desde).group_by(Discussion.community_id)
            )
        ).all()
    )
    out = [{"nombre": sin_emoji(c.name), "mensajes": int(cuentas.get(c.id, 0))} for c in canales if sin_emoji(c.name)]
    return sorted(out, key=lambda c: -c["mensajes"])[:8]


async def por_dentro(db_session: AsyncSession) -> dict:
    """Lo que se enseña con candado. Cada parte en su propio intento: si una
    falla, las demás salen."""
    if _CACHE["datos"] is not None and time.time() - _CACHE["at"] < _SEG:
        return _CACHE["datos"]
    from src.db.organizations import Organization

    org = (await db_session.execute(select(Organization))).scalars().first()
    org_id = int(getattr(org, "id", 0) or 0)
    datos: dict = {"formacion": {"nombre": "Formación A0-A1", "modulos": [], "clases": 0}, "clases": [], "canales": []}
    for clave, tarea in (("formacion", _formacion(db_session)), ("clases", _clases(org_id, db_session)), ("canales", _canales(org_id, db_session))):
        try:
            datos[clave] = await tarea
        except Exception:  # noqa: BLE001
            await db_session.rollback()
    _CACHE.update(at=time.time(), datos=datos)
    return datos

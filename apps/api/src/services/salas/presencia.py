"""
Quién ha estado en la sala de una clase, contado por la propia escuela
(19/11/2026).

Usuario: "¿en qué se basa la sala de profesores? No cuenta bien quién asistió
automáticamente, ni las clases dadas por el profe".

Lo que había:
- La asistencia automática salía SOLO de la API de Daily (`/meetings`, en
  `panel/camino.py`): si Daily no daba la lista, tardaba o la clave fallaba,
  nadie «fue» a la clase.
- «Clases dadas» (`clasesDadasPorProfe`, `huboClase`) solo miraba la lista que
  pasa el profe a mano, la grabación, la pizarra y «Cómo fue la clase». Lo que
  la sala sabía de quién estuvo dentro no contaba para nada; y quién la daba
  salía de quién FIGURABA en la clase, no de quién estuvo.

Ahora la sala de la escuela (`SalaPage`) avisa cada minuto mientras alguien
está dentro de la llamada (`POST /salas/course/{uuid}/presencia`) y aquí se
suman los segundos por persona, curso y día. Con eso:
- **Fue a la clase** = 10 minutos o más dentro ese día (lo de la escuela o lo
  de Daily, lo que diga que sí). Lo que marque el profe en la lista sigue
  mandando sobre los dos.
- **La clase se dio** = algún alumno o alguien del equipo estuvo 10 minutos.
- **La dio** = el profe que figura, si estuvo dentro; si no, el del equipo que
  más rato estuvo (los profes antes que los administradores).

Desde el día del estreno (`ESTRENO`) lo de la escuela vale aunque Daily no
conteste; antes no hay datos propios y se sigue con Daily.
"""

from __future__ import annotations

import time
from typing import Iterable, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.db.sala_presencia import SalaPresencia

MINIMO_SEG = 600
# Un aviso cada minuto: si llegan dos casi a la vez (dos pestañas), el segundo
# no suma; si pasa mucho entre dos (se colgó, se fue y volvió), suma como mucho
# un poco más de un minuto.
ENTRE_MIN = 25
SUMA_MAX = 75
ESTRENO = "2026-11-19"
ROL_PROFE = 5


def sumar(ultima: float, ahora: float) -> int:
    """Lo que suma un aviso que llega `ahora` si el anterior fue a `ultima`."""
    if not ultima:
        return 0
    paso = ahora - ultima
    if paso < ENTRE_MIN:
        return 0
    return int(min(paso, SUMA_MAX))


def quien_dio(equipo: Iterable[dict], figura: str = "", minimo: int = MINIMO_SEG) -> str:
    """El nombre de quien dio la clase. `equipo`: [{nombre, segundos, rol}].
    Si quien figura estuvo dentro, es esa persona; si no, el profe que más rato
    estuvo; y si no hay profe, quien más rato estuvo del equipo."""
    dentro = [e for e in equipo or [] if int(e.get("segundos") or 0) >= minimo and (e.get("nombre") or "").strip()]
    if not dentro:
        return ""
    f = (figura or "").strip().lower()
    if f:
        for e in dentro:
            n = e["nombre"].strip().lower()
            if n == f or n.split(" ")[0] == f.split(" ")[0]:
                return e["nombre"].strip()
    dentro.sort(key=lambda e: (0 if int(e.get("rol") or 0) == ROL_PROFE else 1, -int(e.get("segundos") or 0)))
    return dentro[0]["nombre"].strip()


async def apuntar(org_id: int, course_uuid: str, user, equipo: bool, rol: int, dia: str, db: AsyncSession) -> int:
    """Un aviso de «sigo dentro». Devuelve los segundos que lleva ese día."""
    uid = int(getattr(user, "id", 0) or 0)
    if not uid or not course_uuid or not dia:
        return 0
    ahora = time.time()
    fila = (
        await db.execute(
            select(SalaPresencia).where(
                SalaPresencia.course_uuid == course_uuid, SalaPresencia.user_id == uid, SalaPresencia.dia == dia
            )
        )
    ).scalars().first()
    nombre = " ".join(x for x in [getattr(user, "first_name", "") or "", getattr(user, "last_name", "") or ""] if x).strip()
    nombre = (nombre or getattr(user, "username", "") or "")[:160]
    if fila is None:
        fila = SalaPresencia(
            org_id=org_id, course_uuid=course_uuid, user_id=uid, dia=dia, segundos=0,
            equipo=bool(equipo), rol=int(rol or 0), nombre=nombre, primera=ahora, ultima=ahora,
        )
        db.add(fila)
    else:
        fila.segundos = int(fila.segundos or 0) + sumar(float(fila.ultima or 0), ahora)
        fila.ultima = ahora
        fila.equipo = bool(equipo) or bool(fila.equipo)
        if nombre:
            fila.nombre = nombre
        db.add(fila)
    await db.commit()
    return int(fila.segundos or 0)


async def _leer(db: AsyncSession, consulta) -> list:
    """En blando: si la tabla aún no existe (un arranque a medias), nada; y en
    un SAVEPOINT, para no estropear la transacción de quien pregunta."""
    try:
        async with db.begin_nested():
            return list((await db.execute(consulta)).scalars().all())
    except Exception:  # noqa: BLE001
        return []


async def de_la_escuela(org_id: int, db: AsyncSession) -> list:
    """Todas las filas de alumnos de la escuela (para el Camino)."""
    return await _leer(db, select(SalaPresencia).where(SalaPresencia.org_id == org_id, SalaPresencia.equipo == False))  # noqa: E712


async def del_dia(course_uuids: Iterable[str], dias: Iterable[str], db: AsyncSession) -> dict[tuple[str, str], list[dict]]:
    """{(course_uuid, día): [{user_id, segundos, equipo, rol, nombre}]}."""
    cursos = [c for c in set(course_uuids) if c]
    dias = [d for d in set(dias) if d]
    if not cursos or not dias:
        return {}
    filas = await _leer(
        db, select(SalaPresencia).where(SalaPresencia.course_uuid.in_(cursos), SalaPresencia.dia.in_(dias))  # type: ignore[attr-defined]
    )
    salida: dict[tuple[str, str], list[dict]] = {}
    for f in filas:
        salida.setdefault((f.course_uuid, f.dia), []).append(
            {"user_id": f.user_id, "segundos": int(f.segundos or 0), "equipo": bool(f.equipo), "rol": int(f.rol or 0), "nombre": f.nombre or ""}
        )
    return salida


def alumnos_dentro(filas: Optional[list[dict]], minimo: int = MINIMO_SEG) -> set[str]:
    """Los ids (texto) de los alumnos que estuvieron `minimo` segundos o más."""
    return {str(f["user_id"]) for f in filas or [] if not f.get("equipo") and int(f.get("segundos") or 0) >= minimo}


def equipo_dentro(filas: Optional[list[dict]]) -> list[dict]:
    return [f for f in filas or [] if f.get("equipo")]


def sabemos(dia: str) -> bool:
    """Desde el estreno, lo de la escuela vale aunque Daily no conteste."""
    return bool(dia) and dia >= ESTRENO

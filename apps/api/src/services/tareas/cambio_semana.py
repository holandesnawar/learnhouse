"""
Una semana en la clase del otro grupo (08/11/2026).

Pedido: "cambiarle la semana a un solo alumno según su grupo, por ejemplo que
una semana vaya al grupo del jueves sin que se le rompan las tareas. Ahora
solo se puede cambiar de grupo para siempre".

Cómo:

- El cambio se guarda en la semana de SU clase (`tarea_semana.cambios`,
  JSON {user_id: {"destino": id de la semana del otro grupo, "por", "at"}}).
  Solo hacia una clase HERMANA (las dos «Clase semanal», `hermanas`) y a una
  semana de la MISMA semana del calendario: es la misma clase dada otro día.
- **Sus tareas no se tocan**: siguen en su clase, con su entrega y su
  corrección. Sus grupos tampoco: la semana siguiente vuelve solo a la suya.
- El alumno lo ve en la página de su clase («Esta semana vas a la clase del
  jueves 12 nov, 19:00») con «Entrar a la sala» de la otra clase, que le deja
  pasar ese día aunque no sea de su grupo (`invitado_hoy`).
- La lista del otro grupo le incluye («viene del martes») y el profe le pasa
  lista allí; en la de su grupo sale como «esta semana va al jueves».
- Se deshace desde el mismo sitio (Organizar → Alumnos → «Cambiar una
  semana»).
"""

import json
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.tareas import TareaSemana


class CambioError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def leer_cambios(texto: Any) -> dict[str, dict]:
    try:
        d = json.loads(texto) if texto else {}
    except Exception:  # noqa: BLE001
        return {}
    if not isinstance(d, dict):
        return {}
    return {str(k): v for k, v in d.items() if isinstance(v, dict) and isinstance(v.get("destino"), int)}


def misma_semana(a: str, b: str) -> bool:
    try:
        return date.fromisoformat(a).isocalendar()[:2] == date.fromisoformat(b).isocalendar()[:2]
    except (TypeError, ValueError):
        return False


async def _curso(course_uuid: str, db_session: AsyncSession) -> Optional[Course]:
    from src.services.tareas.tareas import curso_de

    return await curso_de(course_uuid, db_session)


def _u(course_uuid: str) -> str:
    """Sin el prefijo «course_», como lo guardan las semanas."""
    from src.services.tareas.tareas import uuid_curso

    return uuid_curso(course_uuid)


async def _semanas_de(course_uuids: list[str], db_session: AsyncSession) -> list[TareaSemana]:
    limpios = sorted({_u(u) for u in course_uuids if u})
    if not limpios:
        return []
    return list(
        (await db_session.execute(select(TareaSemana).where(TareaSemana.course_uuid.in_(limpios)))).scalars().all()  # type: ignore[attr-defined]
    )


def _dia(fecha: str) -> str:
    from src.services.tareas.tareas import dia_largo

    try:
        return dia_largo(fecha)
    except Exception:  # noqa: BLE001
        return fecha


async def opciones(org_id: int, user_id: int, db_session: AsyncSession) -> list[dict]:
    """Para la ventana de Organizar: cada semana que viene (de hoy en adelante,
    5 semanas) de cada clase en directo de este alumno que tenga clase
    hermana, con las semanas del otro grupo de esa misma semana y el cambio
    que ya tenga."""
    from src.services.panel.tandas import hoy_nl
    from src.services.tareas.tareas import alumnos_del_curso, clases_en_directo, hermanas

    hoy = hoy_nl()
    salida = []
    for c in await clases_en_directo(org_id, db_session):
        course = await _curso(c["uuid"], db_session)
        if course is None:
            continue
        if user_id not in {a["user_id"] for a in await alumnos_del_curso(org_id, course, db_session)}:
            continue
        otras = await hermanas(course, db_session)
        if not otras:
            continue
        nombres = {_u(o.course_uuid): o.name for o in otras}
        de_otras = await _semanas_de([o.course_uuid for o in otras], db_session)
        for s in sorted(await _semanas_de([course.course_uuid], db_session), key=lambda x: x.fecha or ""):
            if not s.fecha or s.fecha < hoy or len(salida) >= 12:
                continue
            destinos = [
                {"id": o.id, "fecha": o.fecha, "dia": _dia(o.fecha), "tema": o.tema, "curso": nombres.get(o.course_uuid, "")}
                for o in de_otras
                if o.fecha and misma_semana(o.fecha, s.fecha)
            ]
            if not destinos:
                continue
            ya = leer_cambios(getattr(s, "cambios", "")).get(str(user_id))
            salida.append(
                {
                    "semana_id": s.id,
                    "curso": course.name,
                    "course_uuid": _u(course.course_uuid),
                    "fecha": s.fecha,
                    "dia": _dia(s.fecha),
                    "tema": s.tema,
                    "destinos": destinos,
                    "cambio": ya.get("destino") if ya else None,
                }
            )
    return salida


async def cambiar(org_id: int, semana_id: int, user_id: int, destino_id: Optional[int], autor: str, db_session: AsyncSession) -> dict:
    from src.services.tareas.tareas import alumnos_del_curso, hermanas

    s = await db_session.get(TareaSemana, semana_id)
    if s is None or s.org_id != org_id:
        raise CambioError("No existe esa semana", 404)
    course = await _curso(s.course_uuid, db_session)
    if course is None or user_id not in {a["user_id"] for a in await alumnos_del_curso(org_id, course, db_session)}:
        raise CambioError("Ese alumno no es de esta clase")
    cambios = leer_cambios(getattr(s, "cambios", ""))
    if destino_id:
        d = await db_session.get(TareaSemana, destino_id)
        otras = {_u(o.course_uuid) for o in await hermanas(course, db_session)}
        if d is None or d.course_uuid not in otras:
            raise CambioError("Solo se puede cambiar a la misma clase del otro grupo")
        if not (d.fecha and s.fecha and misma_semana(d.fecha, s.fecha)):
            raise CambioError("Tiene que ser la clase de esa misma semana")
        cambios[str(user_id)] = {"destino": d.id, "por": (autor or "Equipo")[:80], "at": datetime.now(timezone.utc).isoformat()}
    else:
        cambios.pop(str(user_id), None)
    s.cambios = json.dumps(cambios, ensure_ascii=False)
    db_session.add(s)
    await db_session.commit()
    return {"ok": True, "cambio": destino_id or None}


async def cambio_de(s: TareaSemana, user_id: int, db_session: AsyncSession) -> Optional[dict]:
    """Si este alumno va esa semana a la otra clase: a cuál, qué día y su sala."""
    c = leer_cambios(getattr(s, "cambios", "")).get(str(user_id))
    if not c:
        return None
    d = await db_session.get(TareaSemana, c["destino"])
    if d is None:
        return None
    course = await _curso(d.course_uuid, db_session)
    return {
        "semana_id": d.id,
        "course_uuid": _u(d.course_uuid),
        "curso": course.name if course else "",
        "fecha": d.fecha,
        "dia": _dia(d.fecha),
    }


async def invitados(destino: TareaSemana, db_session: AsyncSession) -> dict[int, dict]:
    """Los alumnos de las otras clases que esa semana vienen a esta:
    {user_id: {"de": nombre de su clase, "dia": su día de siempre}}."""
    from src.services.tareas.tareas import hermanas

    course = await _curso(destino.course_uuid, db_session)
    if course is None or not destino.fecha:
        return {}
    otras = await hermanas(course, db_session)
    nombres = {_u(o.course_uuid): o.name for o in otras}
    salida: dict[int, dict] = {}
    for s in await _semanas_de(list(nombres), db_session):
        if not (s.fecha and misma_semana(s.fecha, destino.fecha)):
            continue
        for uid, c in leer_cambios(getattr(s, "cambios", "")).items():
            if c.get("destino") == destino.id:
                try:
                    salida[int(uid)] = {"de": nombres.get(s.course_uuid, ""), "dia": _dia(s.fecha), "semana_id": s.id}
                except ValueError:
                    continue
    return salida


async def invitado_hoy(course_uuid: str, user_id: int, hoy: str, db_session: AsyncSession) -> bool:
    """¿Viene este alumno HOY a esta clase por un cambio de semana? Le deja
    entrar a la sala aunque no sea de su grupo."""
    for d in await _semanas_de([course_uuid], db_session):
        if d.fecha == hoy and user_id in await invitados(d, db_session):
            return True
    return False

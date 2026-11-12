"""
Crear una clase desde el calendario de la sala de profes (12/11/2026).

Pedido del usuario: "me sigue obligando a crear una semana antes de crear un
evento en el calendario de los profes; primero me gustaría subir eso en
eventos para que se vea qué le toca a quién, luego ahí dentro ya meter yo el
recurso". Hasta ahora una clase solo salía en el calendario después de ir a la
página del curso, pulsar «Nueva semana» y rellenar tema y día (y el «quién la
da» iba en otra pantalla).

Ahora se crea desde el propio calendario con lo mínimo: **qué clase es, qué
día y quién la da**. El tema y el documento se ponen después, en la ficha de
la clase. Por dentro es la misma «semana» de siempre (un capítulo del curso +
su fila en `tarea_semana`), así que todo lo demás (la página del alumno, la
pizarra, las grabaciones, el seguimiento) sigue igual.

- **Sin tema**: la semana nace con el tema vacío. El capítulo necesita nombre,
  así que se llama «Clase del 17 nov» (`NOMBRE_PROVISIONAL`); al poner el tema
  después, el capítulo toma ese nombre (`nombre_del_capitulo`, lo llama
  `editar_semana`). Al alumno le sale «Clase de la semana» con su día.
- **Repetir**: hasta 12 semanas seguidas, una cada 7 días, todas sin tema
  (menos la primera, si se puso). Si ese día ya hay una clase creada en ese
  curso, esa se salta (no se duplica) y se dice.
- **También en la clase del otro grupo** (las «hermanas»: Groep rood y Groep
  blauw): se crea la misma clase en su día de esa misma semana del calendario
  (`dia_en_su_semana`: el día en que más se da esa clase).
- **Quién la da** solo lo pone un administrador (la misma regla que
  `PUT /semana/{id}/profe/quien`): se guarda en `material_profe.profe`.
- Lo crea el equipo (administradores y profes, en las clases que pueden
  cambiar). No manda nada a nadie.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Iterable, Optional
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.services.tareas import material_profe as MP
from src.services.tareas import tareas as T

MAX_REPETIR = 12
PROVISIONAL = "Clase del "
_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _dia(f: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(f or "")[:10])
    except (TypeError, ValueError):
        return None


def nombre_provisional(fecha: str) -> str:
    """«Clase del 17 nov»: el nombre del capítulo mientras no hay tema. Pura."""
    d = _dia(fecha)
    return f"{PROVISIONAL}{d.day} {_MESES[d.month - 1]}" if d else "Clase"


def nombre_del_capitulo(actual: str, tema_antes: str, tema: str, fecha: str) -> Optional[str]:
    """El nombre que le toca al capítulo cuando cambia el tema (o el día) de
    su semana. Solo se cambia si el capítulo llevaba el nombre provisional o
    el tema de antes: un nombre puesto a mano en el editor del curso se
    respeta (None = no tocar). Pura."""
    actual = (actual or "").strip()
    nuevo = (tema or "").strip() or nombre_provisional(fecha)
    es_nuestro = not actual or actual.startswith(PROVISIONAL) or actual == "Clase" or actual == (tema_antes or "").strip()
    return nuevo[:160] if es_nuestro and nuevo != actual else None


def fechas_a_crear(fecha: str, repetir: Any) -> list[str]:
    """El día y los de las semanas siguientes. Pura."""
    d = _dia(fecha)
    if d is None:
        return []
    try:
        n = int(repetir or 1)
    except (TypeError, ValueError):
        n = 1
    n = max(1, min(MAX_REPETIR, n))
    return [(d + timedelta(days=7 * i)).isoformat() for i in range(n)]


def dia_en_su_semana(fecha: str, fechas_de_la_otra: Iterable[str]) -> str:
    """El día de la otra clase en la MISMA semana del calendario (lunes a
    domingo): el día de la semana en que más se da. Sin semanas de las que
    sacarlo, el mismo día. Pura."""
    d = _dia(fecha)
    if d is None:
        return ""
    cuenta: dict[int, int] = {}
    for f in fechas_de_la_otra:
        x = _dia(f)
        if x is not None:
            cuenta[x.weekday()] = cuenta.get(x.weekday(), 0) + 1
    if not cuenta:
        return d.isoformat()
    dia = max(cuenta, key=lambda k: (cuenta[k], -k))
    return (d - timedelta(days=d.weekday()) + timedelta(days=dia)).isoformat()


async def _crear_una(course: Course, fecha: str, tema: str, profe: str, autor: str, db_session: AsyncSession) -> dict:
    ahora = str(datetime.now())
    max_orden = (
        await db_session.execute(select(func.max(CourseChapter.order)).where(CourseChapter.course_id == course.id))
    ).scalars().first()
    cap = Chapter(
        name=(tema or nombre_provisional(fecha))[:160],
        description="",
        org_id=course.org_id,
        course_id=course.id,
        chapter_uuid=f"chapter_{uuid4()}",
        creation_date=ahora,
        update_date=ahora,
    )
    db_session.add(cap)
    await db_session.flush()
    db_session.add(
        CourseChapter(course_id=course.id, chapter_id=cap.id, org_id=course.org_id, order=(max_orden or 0) + 1, creation_date=ahora, update_date=ahora)
    )
    await db_session.commit()
    r = await T.crear_semana(
        course.org_id,
        course,
        {"chapter_uuid": cap.chapter_uuid, "tema": tema, "fecha": fecha, "avisar_presentacion": True, "avisar_grabacion": True},
        autor,
        db_session,
        sin_tema=True,
    )
    if profe:
        s = await T.tarea(r["semana"]["id"], db_session)
        await MP.guardar(s, MP.con_profe(MP.leer(s.material_profe), profe), db_session)
    return r["semana"]


async def crear_clases(course: Course, datos: dict, autor: str, admin: bool, db_session: AsyncSession) -> dict:
    """Crea la clase (y sus repeticiones, y las de la clase del otro grupo si
    se pide). Devuelve lo creado y lo que se saltó porque ya existía."""
    from src.services.salas.salas import es_clase_en_directo, nombre_con_etiqueta

    config = await T._config(course.org_id, db_session)
    if not es_clase_en_directo(config, course.course_uuid):
        raise T.TareaError("Eso no es una clase en directo", 400)
    fechas = fechas_a_crear(str(datos.get("fecha") or ""), datos.get("repetir"))
    if not fechas:
        raise T.TareaError("Falta el día de la clase")
    tema = str(datos.get("tema") or "").strip()[:160]
    profe = str(datos.get("profe") or "").strip()[:80] if admin else ""

    destinos: list[tuple[Course, Optional[list[str]]]] = [(course, None)]
    if datos.get("tambien"):
        for h in await T.hermanas(course, db_session, config):
            destinos.append((h, [s.fecha for s in await T.semanas_de(h.org_id, h.course_uuid, db_session)]))

    creadas, saltadas = [], []
    for curso, fechas_otra in destinos:
        ya = {s.fecha for s in await T.semanas_de(curso.org_id, curso.course_uuid, db_session)}
        nombre = nombre_con_etiqueta(config, curso.course_uuid, curso.name)
        for i, f in enumerate(fechas):
            dia = f if fechas_otra is None else dia_en_su_semana(f, fechas_otra)
            if dia in ya:
                saltadas.append({"curso": nombre, "fecha": dia})
                continue
            # «Quién la da» es de ESTA clase: en la del otro grupo no se copia.
            s = await _crear_una(curso, dia, tema if i == 0 else "", profe if curso.id == course.id else "", autor, db_session)
            ya.add(dia)
            creadas.append({"semana_id": s["id"], "course_uuid": T.uuid_curso(curso.course_uuid), "curso": nombre, "fecha": dia, "tema": s["tema"]})
    return {"ok": True, "creadas": creadas, "saltadas": saltadas}

"""
Por dónde va cada alumno en la formación, para el panel.

⚠️ Se cuenta por CLASES del curso (`trail_step`), no por `lesson_completion`.
Hasta el 04/10/2026 Clientes enseñaba "0 lecciones hechas" a todo el mundo,
aunque había alumnos avanzando. El motivo: en la formación cada sección de una
lección (Samenvatting, Flashcards, Lezen…) es su PROPIA clase del curso, y el
visor solo apunta una `lesson_completion` cuando se terminan todas las
secciones sin salir de la pantalla — cosa que dentro del curso no pasa nunca,
porque cada clase se abre por separado. Lo que sí se apunta, clase a clase, es
el recorrido (`trail/add_activity` → `trail_step`). Es lo mismo que usan las
Estadísticas para el avance por módulo.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.trail_steps import TrailStep

# El mismo que `apps/web/lib/nawar/cursos.ts` (CURSO_FORMACION_UUID).
FORMACION_UUID = "8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"


def resumir_avance(clases: list[dict], hechas: dict[int, str]) -> dict:
    """Función pura, con test.

    `clases`: las del curso EN ORDEN, cada una `{id, modulo, clase}`.
    `hechas`: id de clase → fecha en que la terminó.

    Devuelve cuántas lleva de cuántas, la última que terminó (por fecha, que
    es "lo último que ha hecho") y la primera que le falta en el orden del
    curso (que es "lo que le toca"). Las dos cosas a la vez porque no siempre
    coinciden: hay quien se salta una sección y sigue.
    """
    ids = {c["id"] for c in clases}
    suyas = {k: v for k, v in hechas.items() if k in ids}

    modulos: list[dict] = []
    por_nombre: dict[str, dict] = {}
    for c in clases:
        m = por_nombre.get(c["modulo"])
        if m is None:
            m = {"nombre": c["modulo"], "hechas": 0, "total": 0}
            por_nombre[c["modulo"]] = m
            modulos.append(m)
        m["total"] += 1
        if c["id"] in suyas:
            m["hechas"] += 1

    ultima = None
    if suyas:
        uid = max(suyas, key=lambda k: (suyas[k] or "", k))
        c = next(x for x in clases if x["id"] == uid)
        ultima = {"modulo": c["modulo"], "clase": c["clase"], "fecha": suyas[uid] or ""}

    siguiente = None
    for c in clases:
        if c["id"] not in suyas:
            siguiente = {"modulo": c["modulo"], "clase": c["clase"]}
            if c.get("uuid"):
                siguiente["uuid"] = c["uuid"]
            break

    total = len(clases)
    n = len(suyas)
    return {
        "hechas": n,
        "total": total,
        "pct": round(n * 100 / total) if total else 0,
        "ultima": ultima,
        "siguiente": siguiente,
        "modulos": modulos,
    }


async def _curso_formacion(db_session: AsyncSession) -> Course | None:
    return (
        await db_session.execute(
            select(Course).where(
                Course.course_uuid.in_([f"course_{FORMACION_UUID}", FORMACION_UUID])  # type: ignore[attr-defined]
            )
        )
    ).scalars().first()


async def clases_en_orden(db_session: AsyncSession, course_id: int) -> list[dict]:
    """Las clases publicadas del curso, módulo a módulo y en su orden."""
    filas = (
        await db_session.execute(
            select(Chapter.name, Activity.id, Activity.name, CourseChapter.order, ChapterActivity.order, Activity.activity_uuid)
            .join(ChapterActivity, ChapterActivity.chapter_id == Chapter.id)
            .join(Activity, Activity.id == ChapterActivity.activity_id)
            .join(
                CourseChapter,
                (CourseChapter.chapter_id == Chapter.id) & (CourseChapter.course_id == course_id),
                isouter=True,
            )
            .where(ChapterActivity.course_id == course_id, Activity.published == True)  # noqa: E712
        )
    ).all()
    filas = sorted(filas, key=lambda f: (f[3] if f[3] is not None else 10**6, f[4] or 0, f[1]))
    vistas: set[int] = set()
    out: list[dict] = []
    for modulo, aid, clase, _co, _ao, auuid in filas:
        if aid in vistas:
            continue
        vistas.add(aid)
        out.append({"id": int(aid), "uuid": auuid or "", "modulo": modulo or "", "clase": clase or ""})
    return out


async def avance_formacion(db_session: AsyncSession, user_ids: list[int]) -> dict[int, dict]:
    """Avance en la formación de cada alumno pedido. Vacío si no hay curso."""
    if not user_ids:
        return {}
    curso = await _curso_formacion(db_session)
    if curso is None or curso.id is None:
        return {}
    clases = await clases_en_orden(db_session, curso.id)

    hechas: dict[int, dict[int, str]] = {}
    for uid, aid, fecha in (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.activity_id, TrailStep.creation_date).where(
                TrailStep.course_id == curso.id,
                TrailStep.complete == True,  # noqa: E712
                TrailStep.user_id.in_(user_ids),  # type: ignore[attr-defined]
            )
        )
    ).all():
        suyas = hechas.setdefault(int(uid), {})
        # "2026-10-03 14:22:11.123456" → "2026-10-03T14:22:11": Safari no
        # entiende la fecha con espacio y la pantalla la pintaría en crudo.
        fecha = str(fecha or "").replace(" ", "T")[:19]
        # Si hubiera dos filas de la misma clase, vale la primera vez.
        if int(aid) not in suyas or (fecha and fecha < suyas[int(aid)]):
            suyas[int(aid)] = fecha

    return {uid: resumir_avance(clases, hechas.get(uid, {})) for uid in user_ids}

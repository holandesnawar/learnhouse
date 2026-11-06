"""
«Tu grupo esta semana» (07/11/2026): lo que el profe necesita saber de SU
grupo para preparar la clase, en una tarjeta de «Mis clases».

Pedido del usuario: "que desde ahí puedan ver más cosas… para preparar clase".
Todo sale de lo que la escuela ya guarda; aquí solo se junta:

- **Por dónde va el grupo en la formación**: la primera clase que le falta a
  cada alumno (`avance_formacion`, la misma cuenta que Panel → Progreso), el
  módulo en el que está la mayoría y quién va por detrás.
- **Lo que más fallan**: las palabras de `exercise_attempt.failed_labels` de
  las últimas 3 semanas, contadas por ALUMNO (no por intento: uno que repite
  diez veces no pesa más que los demás).
- **Sus consultas de las últimas 2 semanas** (Supabase, en blando: si no
  contesta, la tarjeta sale sin ellas).
- **Quién es nuevo** (entró hace menos de 7 días) y **quién lleva más de 7
  días sin entrar**.

Solo el equipo (la ruta lo comprueba). No lleva nada de dinero.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, timedelta
from typing import Any, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.exercise_attempts import ExerciseAttempt
from src.db.student_progress import StudentProgress, StudentVisitDay

logger = logging.getLogger(__name__)

DIAS_FALLOS = 21
DIAS_CONSULTAS = 14
DIAS_NUEVO = 7
DIAS_SIN_ENTRAR = 7
MAX_FALLOS = 8
MAX_CONSULTAS = 6


def _dia(texto: Any) -> str:
    return str(texto or "")[:10]


def _dias_desde(dia: str, hoy: str) -> Optional[int]:
    try:
        return (date.fromisoformat(hoy) - date.fromisoformat(dia[:10])).days
    except (TypeError, ValueError):
        return None


def resumen_grupo(
    alumnos: list[dict],
    avances: dict[int, dict],
    ultima_entrada: dict[int, str],
    intentos: Iterable[dict],
    hoy: str,
) -> dict:
    """Función pura, con test.

    `alumnos`: los de la clase ({user_id, nombre, entro}). `avances`: lo de
    `resumir_avance` por alumno. `ultima_entrada`: último día que entró.
    `intentos`: {user_id, date, failed_labels} de los ejercicios.
    """
    ids = {a["user_id"] for a in alumnos}
    orden: list[str] = []
    for av in avances.values():
        for m in av.get("modulos") or []:
            if m["nombre"] not in orden:
                orden.append(m["nombre"])

    donde: dict[int, dict] = {}
    for a in alumnos:
        av = avances.get(a["user_id"]) or {}
        sig = av.get("siguiente")
        if sig:
            donde[a["user_id"]] = {"modulo": sig.get("modulo") or "", "clase": sig.get("clase") or "", "pct": av.get("pct", 0)}
        elif av.get("total"):
            donde[a["user_id"]] = {"modulo": "", "clase": "", "pct": 100, "terminado": True}

    conteo = Counter(d["modulo"] for d in donde.values() if d.get("modulo"))
    mayoria = None
    if conteo:
        modulo, n = max(conteo.items(), key=lambda kv: (kv[1], -orden.index(kv[0]) if kv[0] in orden else 0))
        clases = Counter(d["clase"] for d in donde.values() if d.get("modulo") == modulo and d.get("clase"))
        mayoria = {"modulo": modulo, "n": n, "clase": clases.most_common(1)[0][0] if clases else ""}

    def pos(modulo: str) -> int:
        return orden.index(modulo) if modulo in orden else -1

    detras, delante = [], []
    if mayoria and mayoria["modulo"] in orden:
        ref = pos(mayoria["modulo"])
        for a in alumnos:
            d = donde.get(a["user_id"])
            if not d:
                continue
            if d.get("terminado"):
                delante.append({"nombre": a["nombre"], "modulo": "Terminó la formación"})
            elif d.get("modulo") and pos(d["modulo"]) < ref:
                detras.append({"nombre": a["nombre"], "modulo": d["modulo"], "clase": d["clase"]})
            elif d.get("modulo") and pos(d["modulo"]) > ref:
                delante.append({"nombre": a["nombre"], "modulo": d["modulo"]})

    # Lo que más fallan: cada palabra, cuántos alumnos distintos la fallaron.
    desde = (date.fromisoformat(hoy) - timedelta(days=DIAS_FALLOS)).isoformat()
    por_palabra: dict[str, set[int]] = {}
    for it in intentos or []:
        uid = it.get("user_id")
        if uid not in ids or _dia(it.get("date")) < desde:
            continue
        for etiqueta in it.get("failed_labels") or []:
            e = str(etiqueta or "").strip()
            if e:
                por_palabra.setdefault(e, set()).add(uid)
    fallos = sorted(
        ({"palabra": p, "alumnos": len(u)} for p, u in por_palabra.items() if len(u) >= (2 if len(ids) > 3 else 1)),
        key=lambda f: (-f["alumnos"], f["palabra"].lower()),
    )[:MAX_FALLOS]

    nuevos, sin_entrar = [], []
    for a in alumnos:
        dias_dentro = _dias_desde(_dia(a.get("entro")), hoy)
        if dias_dentro is not None and dias_dentro < DIAS_NUEVO:
            nuevos.append({"nombre": a["nombre"], "entro": _dia(a.get("entro"))})
            continue
        ultima = ultima_entrada.get(a["user_id"], "")
        dias = _dias_desde(ultima, hoy) if ultima else None
        if dias is None or dias > DIAS_SIN_ENTRAR:
            sin_entrar.append({"nombre": a["nombre"], "dias": dias})
    sin_entrar.sort(key=lambda x: -(x["dias"] if x["dias"] is not None else 10**6))

    return {
        "alumnos": len(alumnos),
        "mayoria": mayoria,
        "detras": detras,
        "delante": delante,
        "fallos": fallos,
        "nuevos": nuevos,
        "sin_entrar": sin_entrar,
    }


def consultas_del_grupo(consultas: Iterable[dict], emails: set[str], hoy: str) -> list[dict]:
    """Las consultas de los alumnos del grupo de las últimas 2 semanas."""
    desde = (date.fromisoformat(hoy) - timedelta(days=DIAS_CONSULTAS)).isoformat()
    salida = []
    for c in consultas or []:
        email = str(c.get("author_email") or "").strip().lower()
        if email not in emails or _dia(c.get("created_at")) < desde:
            continue
        texto = " ".join(str(c.get("content") or "").split())
        salida.append(
            {
                "titulo": str(c.get("title") or "").strip(),
                "texto": texto[:220] + ("…" if len(texto) > 220 else ""),
                "nombre": str(c.get("author_name") or "").strip(),
                "fecha": _dia(c.get("created_at")),
                "respondida": bool(c.get("resolved")),
            }
        )
    salida.sort(key=lambda c: c["fecha"], reverse=True)
    return salida[:MAX_CONSULTAS]


async def grupo_de_la_clase(org_id: int, course_uuid: str, db_session: AsyncSession) -> dict:
    from src.services.panel.avance import avance_formacion
    from src.services.panel.tandas import hoy_nl
    from src.services.tareas.tareas import TareaError, alumnos_del_curso, curso_de

    course = await curso_de(course_uuid, db_session)
    if course is None or course.org_id != org_id:
        raise TareaError("No existe esa clase", 404)
    hoy = hoy_nl()
    alumnos = await alumnos_del_curso(org_id, course, db_session)
    ids = [a["user_id"] for a in alumnos]

    avances = await avance_formacion(db_session, ids) if ids else {}

    ultima: dict[int, str] = {}
    if ids:
        for uid, dia in (
            await db_session.execute(
                select(StudentVisitDay.user_id, StudentVisitDay.day).where(StudentVisitDay.user_id.in_(ids))  # type: ignore[attr-defined]
            )
        ).all():
            d = _dia(dia)
            if d > ultima.get(int(uid), ""):
                ultima[int(uid)] = d
        for p in (
            await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(ids)))  # type: ignore[attr-defined]
        ).scalars().all():
            d = _dia(p.last_visit_date)
            if d > ultima.get(int(p.user_id), ""):
                ultima[int(p.user_id)] = d

    intentos = []
    if ids:
        intentos = [
            {"user_id": int(a.user_id), "date": a.date, "failed_labels": a.failed_labels or []}
            for a in (
                await db_session.execute(select(ExerciseAttempt).where(ExerciseAttempt.user_id.in_(ids)))  # type: ignore[attr-defined]
            ).scalars().all()
        ]

    datos = resumen_grupo(alumnos, avances, ultima, intentos, hoy)

    consultas: list[dict] = []
    aviso_consultas = ""
    try:
        from src.services.consultas.admin import list_consultas

        consultas = consultas_del_grupo(await list_consultas(), {a["email"] for a in alumnos if a.get("email")}, hoy)
    except Exception as exc:  # noqa: BLE001
        logger.info("Consultas del grupo: %s", exc)
        aviso_consultas = "No se han podido leer las consultas ahora."
    return {**datos, "consultas": consultas, "aviso_consultas": aviso_consultas, "hoy": hoy}

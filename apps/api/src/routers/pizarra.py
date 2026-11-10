"""
La pizarra de clase (10/11/2026). La explicación, en
`src/services/tareas/pizarra.py`.

- Abrir la pizarra, escribir, guardar y publicar: el equipo (administradores,
  moderadores y profes).
- El PDF de después de clase: el equipo siempre; un alumno, si puede ver esa
  clase (la misma comprobación que la página del curso) y desde el día de la
  clase.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.salas import _curso, _roles
from src.routers.tareas import _error, _nombre, _semana_equipo
from src.security.auth import get_current_user
from src.services.tareas import material_profe as MP
from src.services.tareas import pizarra as PZ
from src.services.tareas import tareas as T

router = APIRouter()

_SIN_CACHE = {"Cache-Control": "private, no-store"}


class NotasIn(BaseModel):
    fuente: str = ""
    doc: Any = None


async def _clases_de(s, db_session: AsyncSession) -> list[dict]:
    return (await T._clases([s.chapter_uuid], db_session)).get(s.chapter_uuid, []) if s.chapter_uuid else []


async def _guardar(s, material: dict, p: dict, db_session: AsyncSession) -> None:
    await MP.guardar(s, {**material, "pizarra": p}, db_session)


@router.get("/semana/{semana_id}", summary="La pizarra de una semana: sobre qué PDF se escribe y lo ya escrito (equipo).")
async def api_pizarra(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, admin = await _semana_equipo(semana_id, current_user, db_session)
    material = MP.leer(s.material_profe)
    p = PZ.leer(material)
    disponibles = PZ.fuentes(material, await _clases_de(s, db_session))
    curso = await T.curso_de(s.course_uuid, db_session)
    return {
        "semana": {"id": s.id, "tema": s.tema, "fecha": s.fecha, "course_uuid": s.course_uuid, "curso": getattr(curso, "name", "") or ""},
        "fuentes": disponibles,
        "fuente": PZ.fuente_valida(p["fuente"], disponibles),
        "anotaciones": PZ.leer_anotaciones(p) if p["fuente"] else None,
        "guardada_at": p["guardada_at"],
        "guardada_por": p["guardada_por"],
        "publicada": PZ.publicada_para_la_pantalla(p),
        "admin": admin,
    }


@router.get("/semana/{semana_id}/fuente/{fuente_id}", summary="El PDF sobre el que se escribe (equipo).")
async def api_fuente(
    semana_id: int,
    fuente_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, _admin = await _semana_equipo(semana_id, current_user, db_session)
    material = MP.leer(s.material_profe)
    de, _, ident = fuente_id.partition(":")
    ruta = None
    if de == "profe":
        encontrado = MP.archivo(material, ident)
        ruta = encontrado[0] if encontrado else None
    elif de == "clase":
        # Tiene que ser una presentación de ESTA semana, no cualquier clase.
        if any(c.get("activity_uuid") == ident and c.get("tipo") == "presentacion" for c in await _clases_de(s, db_session)):
            ruta = await _pdf_de_la_clase(ident, db_session)
    if ruta is None or not ruta.is_file() or ruta.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="Esa presentación ya no está. Súbela otra vez en «Editar».")
    return FileResponse(ruta, media_type="application/pdf", headers=_SIN_CACHE)


async def _pdf_de_la_clase(activity_uuid: str, db_session: AsyncSession):
    """El archivo de una clase de PDF del curso, en el disco."""
    from src.db.courses.activities import Activity
    from src.db.courses.courses import Course
    from src.db.organizations import Organization

    a = (await db_session.execute(select(Activity).where(Activity.activity_uuid == activity_uuid))).scalars().first()
    if a is None:
        return None
    nombre = str((a.content or {}).get("filename") or "") if isinstance(a.content, dict) else ""
    if not nombre or "/" in nombre or ".." in nombre:
        return None
    curso = (await db_session.execute(select(Course).where(Course.id == a.course_id))).scalars().first()
    org = (await db_session.execute(select(Organization).where(Organization.id == a.org_id))).scalars().first()
    if curso is None or org is None:
        return None
    return T.CONTENT_DIR / "orgs" / org.org_uuid / "courses" / curso.course_uuid / "activities" / a.activity_uuid / "documentpdf" / nombre


@router.put("/semana/{semana_id}/notas", summary="Guarda lo escrito en la pizarra (equipo).")
async def api_guardar_notas(
    semana_id: int,
    data: NotasIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, _admin = await _semana_equipo(semana_id, current_user, db_session)
    material = MP.leer(s.material_profe)
    disponibles = PZ.fuentes(material, await _clases_de(s, db_session))
    fuente = PZ.fuente_valida(data.fuente, disponibles)
    if not fuente:
        raise HTTPException(status_code=409, detail="Esta semana no tiene ninguna presentación en PDF")
    try:
        p = PZ.guardar_anotaciones(s.org_id, PZ.leer(material), fuente, data.doc, _nombre(current_user), MP._ahora())
    except T.TareaError as exc:
        raise _error(exc)
    await _guardar(s, material, p, db_session)
    return {"guardada_at": p["guardada_at"], "guardada_por": p["guardada_por"]}


@router.post("/semana/{semana_id}/publicar", summary="Guarda la presentación con las notas para los alumnos (equipo).")
async def api_publicar(
    semana_id: int,
    pdf: UploadFile = File(...),
    paginas: int = Form(0),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, _admin = await _semana_equipo(semana_id, current_user, db_session)
    datos = await pdf.read(PZ.MAX_PDF + 1)
    material = MP.leer(s.material_profe)
    try:
        p = PZ.publicar(s.org_id, PZ.leer(material), datos, paginas, _nombre(current_user), MP._ahora())
    except T.TareaError as exc:
        raise _error(exc)
    await _guardar(s, material, p, db_session)
    return PZ.publicada_para_la_pantalla(p)


@router.delete("/semana/{semana_id}/publicada", summary="Quita la presentación con notas de la semana de los alumnos (equipo).")
async def api_quitar_publicada(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, _admin = await _semana_equipo(semana_id, current_user, db_session)
    material = MP.leer(s.material_profe)
    await _guardar(s, material, PZ.quitar_publicada(PZ.leer(material)), db_session)
    return {"ok": True}


async def _puede_verla(request: Request, s, current_user, db_session: AsyncSession) -> bool:
    """El equipo siempre; el alumno que ve la clase, desde el día de la clase."""
    from src.services.panel.tandas import hoy_nl

    curso = await _curso(request, s.course_uuid, current_user, db_session)
    equipo, _admin = await _roles(current_user, curso.org_id, db_session)
    return equipo or T.abierta(s.fecha, hoy_nl())


@router.get("/semana/{semana_id}/pdf", summary="La presentación con las notas de la clase (equipo y alumnos de esa clase).")
async def api_pdf(
    request: Request,
    semana_id: int,
    descargar: Optional[int] = None,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from urllib.parse import quote

    try:
        s = await T.tarea(semana_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    if not await _puede_verla(request, s, current_user, db_session):
        raise HTTPException(status_code=403, detail="Se abre el día de la clase")
    ruta = PZ.pdf_publicado(PZ.leer(MP.leer(s.material_profe)))
    if ruta is None:
        raise HTTPException(status_code=404, detail="Esta clase aún no tiene la presentación con notas")
    nombre = f"{(s.tema or 'Clase').strip()} - notas de la clase.pdf"
    return FileResponse(
        ruta,
        media_type="application/pdf",
        headers={**_SIN_CACHE, "Content-Disposition": f"{'attachment' if descargar else 'inline'}; filename*=UTF-8''{quote(nombre)}"},
    )


@router.get("/course/{course_uuid}", summary="Qué semanas de una clase tienen la presentación con notas (quien ve la clase).")
async def api_del_curso(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.panel.tandas import hoy_nl

    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _admin = await _roles(current_user, curso.org_id, db_session)
    hoy = hoy_nl()
    out = []
    for s in await T.semanas_de(curso.org_id, T.uuid_curso(curso.course_uuid), db_session):
        if "pizarra" not in (s.material_profe or ""):
            continue
        pub = PZ.leer(MP.leer(s.material_profe)).get("publicada")
        if pub and (equipo or T.abierta(s.fecha, hoy)):
            out.append({"semana_id": s.id, "at": pub["at"], "paginas": pub["paginas"], "por": pub["por"]})
    return {"semanas": out}

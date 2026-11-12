"""
Las grabaciones de la sala: verlas por día, recortarlas y publicarlas en su
semana (10/11/2026). La explicación entera está en
`src/services/salas/estudio_grabaciones.py`.

- Ver el estudio, publicar y quitar: el equipo (administradores, moderadores y
  profes), cada uno en las clases que puede abrir (la misma comprobación que la
  sala: un monitor, solo el Spreekclub).
- El vídeo: el equipo, cualquier grabación de la sala de esa clase. Un alumno,
  solo lo publicado en una semana de una clase que ve y que ya ha llegado.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.salas import _curso, _roles
from src.security.auth import get_current_user
from src.services.salas import estudio_grabaciones as EG
from src.services.tareas import tareas as T

router = APIRouter()


def _error(exc: EG.GrabacionError) -> HTTPException:
    return HTTPException(status_code=exc.status if 400 <= exc.status < 600 else 502, detail=exc.mensaje)


def _nombre(user) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or "Equipo"


async def _del_equipo(request: Request, course_uuid: str, current_user, db_session: AsyncSession):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return curso


async def _semana(request: Request, semana_id: int, current_user, db_session: AsyncSession):
    """La semana y su curso, si esta persona puede ver ese curso."""
    try:
        s = await T.tarea(semana_id, db_session)
    except T.TareaError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.mensaje) from exc
    curso = await _curso(request, s.course_uuid, current_user, db_session)
    return s, curso


@router.get("/course/{course_uuid}", summary="Lo que grabó la sala de una clase, por día y con su semana (equipo).")
async def api_estudio(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _del_equipo(request, course_uuid, current_user, db_session)
    return await EG.estudio(curso, db_session)


@router.get("/ejemplo.mp4", summary="El vídeo de ejemplo de la escuela de pruebas (solo existe con los datos de prueba y sin Daily).")
async def api_ejemplo():
    from fastapi.responses import FileResponse

    if not EG.modo_ejemplo():
        raise HTTPException(status_code=404, detail="No existe")
    return FileResponse(EG.VIDEO_DE_EJEMPLO, media_type="video/mp4", headers={"Cache-Control": "public, max-age=3600"})


@router.get(
    "/video/{grabacion_id}",
    summary="El vídeo de una grabación de la sala: redirige a un enlace fresco de Daily.",
)
async def api_video(
    request: Request,
    grabacion_id: str,
    course: str,
    fresco: Optional[int] = 0,
    otro: Optional[int] = 0,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if otro:
        # «La clase del otro grupo» (12/11/2026): la grabación es de la sala de
        # la clase hermana. Se pide con la clase PROPIA (la que esta persona
        # puede abrir) y solo vale si está publicada en una semana ya dada de
        # la hermana y esta clase no tiene apagado «Mira también». Para todos,
        # también el equipo: es lo mismo que ve el alumno.
        hermana = await T.hermana_con_grabacion(curso, grabacion_id, db_session)
        if hermana is None:
            raise HTTPException(status_code=404, detail="Esa grabación no está publicada")
        curso = hermana
    elif not equipo:
        from src.services.panel.tandas import hoy_nl

        filas = await T.semanas_de(curso.org_id, curso.course_uuid, db_session)
        if not EG.publicada_para_alumnos(filas, grabacion_id, hoy_nl()):
            raise HTTPException(status_code=404, detail="Esa grabación no está publicada")
    if fresco:
        # El reproductor lo pide así cuando el enlace que tenía dejó de servir.
        EG.olvidar_enlace(grabacion_id)
    try:
        enlace = await EG.enlace_video(curso.course_uuid, grabacion_id)
    except EG.GrabacionError as exc:
        raise _error(exc) from exc
    # 302 y sin guardar: el enlace de Daily caduca, la próxima vez será otro.
    return RedirectResponse(enlace, status_code=302, headers={"Cache-Control": "no-store"})


class ParteIn(BaseModel):
    id: str
    trozos: Optional[list[list[float]]] = None


class PublicarIn(BaseModel):
    partes: list[ParteIn]
    titulo: Optional[str] = ""


@router.put("/semana/{semana_id}", summary="Publicar en una semana la grabación de la sala, con su recorte (equipo).")
async def api_publicar(
    request: Request,
    semana_id: int,
    body: PublicarIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, curso = await _semana(request, semana_id, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    datos: dict[str, Any] = {"partes": [p.model_dump() for p in body.partes], "titulo": body.titulo or ""}
    try:
        return await EG.publicar(s, curso, datos, _nombre(current_user), db_session)
    except EG.GrabacionError as exc:
        raise _error(exc) from exc


@router.delete("/semana/{semana_id}", summary="Dejar de enseñar la grabación de la sala en esa semana (equipo). En Daily no se borra nada.")
async def api_quitar(
    request: Request,
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, curso = await _semana(request, semana_id, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return await EG.quitar(s, db_session)


@router.post("/semana/{semana_id}/vista", summary="El alumno ha visto la grabación (pasó de la mitad).")
async def api_vista(
    request: Request,
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, curso = await _semana(request, semana_id, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if equipo:
        # El equipo mirándola no cuenta como un alumno que la vio.
        return {"ok": True, "vista": False}
    try:
        return await EG.marcar_vista(s, current_user.id, db_session)
    except EG.GrabacionError as exc:
        raise _error(exc) from exc

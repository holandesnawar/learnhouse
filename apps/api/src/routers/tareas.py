"""
Las semanas de las clases en directo, sus tareas y el seguimiento. La
explicación entera está en `src/services/tareas/tareas.py`.

- Ver las semanas, abrir una tarea y entregarla: quien puede ver la clase (la
  misma comprobación que la página del curso, `salas._curso`).
- Escuchar una nota de voz: el alumno las suyas; el equipo, todas.
- Corregir, el seguimiento semanal y los check-in: el equipo (administradores,
  moderadores y profes, `STAFF_ROLE_IDS`).
- Crear, cambiar y borrar semanas: administradores.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.routers.salas import _curso, _roles
from src.security.auth import get_current_user
from src.security.rbac.resource_access import check_resource_access
from src.security.rbac.types import AccessAction, AccessContext
from src.services.tareas import tareas as T

router = APIRouter()


def _error(exc: T.TareaError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


def _nombre(user) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or "Equipo"


def _nombre_para_el_alumno(user) -> str:
    """Quién corrige, tal como lo lee el alumno: su nombre, nunca el usuario
    («admin»). Sin nombre en la cuenta, vacío y la pantalla dice «Corregida»."""
    return f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()


def _con_sesion(current_user) -> None:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela para ver tus tareas")


async def _equipo(current_user, org_id: int, db_session: AsyncSession) -> bool:
    """El equipo (o 403). Devuelve si además es administrador."""
    _con_sesion(current_user)
    equipo, admin = await _roles(current_user, org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return admin


async def _admin(current_user, org_id: int, db_session: AsyncSession) -> None:
    if not await _equipo(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo los administradores")


async def _tarea_y_curso(request: Request, tarea_id: int, current_user, db_session: AsyncSession) -> tuple:
    try:
        t = await T.tarea(tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    curso = await _curso(request, t.course_uuid, current_user, db_session)
    return t, curso


async def _leer_audio(audio: Optional[UploadFile]) -> Optional[tuple[str, bytes]]:
    if audio is None:
        return None
    datos = await audio.read(T.MAX_AUDIO_BYTES + 1)
    if not datos:
        return None
    return (audio.filename or "nota.webm", datos)


# ── El alumno ───────────────────────────────────────────────────────────────


@router.get("/course/{course_uuid}/semanas", summary="Las semanas de una clase en directo, con lo que ha hecho quien pregunta.")
async def api_semanas(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    datos = await T.semanas_para_alumno(curso, current_user.id, db_session)
    return {**datos, "equipo": equipo, "admin": admin}


@router.get("/mi-semana", summary="«Tu semana» del Inicio: la semana en curso de cada clase que ve y las correcciones sin escuchar.")
async def api_mi_semana(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)

    async def puede_ver(course: Course) -> bool:
        if course.org_id != org_id:
            return False
        decision = await check_resource_access(
            request, db_session, current_user, course.course_uuid, AccessAction.READ,
            context=AccessContext.DASHBOARD, raise_on_deny=False,
        )
        return bool(decision.allowed)

    return await T.mi_semana(org_id, current_user.id, puede_ver, db_session)


@router.get("/tarea/{tarea_id}", summary="Una tarea y la entrega de quien pregunta.")
async def api_tarea(
    request: Request,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, curso = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    return {**await T.tarea_para(t, curso, current_user.id, db_session), "equipo": equipo, "admin": admin}


@router.post("/tarea/{tarea_id}/entrega", summary="Entrega (o cambia) la tarea: texto y/o nota de voz.")
async def api_entregar(
    request: Request,
    tarea_id: int,
    texto: str = Form(""),
    audio_seg: int = Form(0),
    quitar_audio: bool = Form(False),
    audio: Optional[UploadFile] = File(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, _curso_ok = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    try:
        return await T.entregar(t, current_user.id, texto, await _leer_audio(audio), audio_seg, quitar_audio, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.post("/tarea/{tarea_id}/vista", summary="El alumno ha visto la corrección (apaga el aviso).")
async def api_vista(
    request: Request,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, _curso_ok = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    return await T.marcar_vista(t, current_user.id, db_session)


@router.get("/audio/{entrega_id}/{cual}", summary="Una nota de voz de una entrega: la del alumno o la de la corrección.")
async def api_audio(
    entrega_id: int,
    cual: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    try:
        e = await T.entrega(entrega_id, db_session)
        t = await T.tarea(e.tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    if e.user_id != current_user.id:
        equipo, _admin_ok = await _roles(current_user, t.org_id, db_session)
        if not equipo:
            raise HTTPException(status_code=403, detail="Esa nota de voz no es tuya")
    encontrado = T.audio_de(e, "correccion" if cual == "correccion" else "alumno")
    if encontrado is None:
        raise HTTPException(status_code=404, detail="No hay nota de voz")
    ruta, mime = encontrado
    return FileResponse(ruta, media_type=mime, headers={"Cache-Control": "private, no-store"})


# ── Semanas (administradores) ───────────────────────────────────────────────


class SemanaIn(BaseModel):
    chapter_uuid: Optional[str] = None
    tema: Optional[str] = None
    fecha: Optional[str] = None
    enunciado: Optional[str] = None
    fecha_limite: Optional[str] = None


@router.post("/course/{course_uuid}/semanas", summary="Convierte un capítulo de la clase en una semana con su tarea (administradores).")
async def api_crear_semana(
    request: Request,
    course_uuid: str,
    data: SemanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    await _admin(current_user, curso.org_id, db_session)
    try:
        return await T.crear_semana(curso.org_id, curso, data.model_dump(exclude_unset=True), _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.put("/semana/{semana_id}", summary="Cambia el tema, el día o la tarea de una semana (administradores).")
async def api_editar_semana(
    semana_id: int,
    data: SemanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _admin(current_user, s.org_id, db_session)
        return await T.editar_semana(s, data.model_dump(exclude_unset=True, exclude={"chapter_uuid"}), db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.delete("/semana/{semana_id}", summary="Deja de ser una semana: borra su tarea y las entregas (administradores).")
async def api_borrar_semana(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _admin(current_user, s.org_id, db_session)
        return await T.borrar_semana(s, db_session)
    except T.TareaError as exc:
        raise _error(exc)


# ── El equipo ───────────────────────────────────────────────────────────────


@router.get("/org/{org_id}/clases", summary="Las clases en directo que pueden tener semanas (equipo).")
async def api_clases(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _equipo(current_user, org_id, db_session)
    return {"clases": await T.clases_en_directo(org_id, db_session), "admin": admin}


@router.get("/org/{org_id}/seguimiento", summary="Seguimiento semanal de una clase: alumno a alumno (equipo).")
async def api_seguimiento(
    org_id: int,
    course_uuid: str,
    semana_id: Optional[int] = None,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.seguimiento(org_id, course_uuid, semana_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/por-corregir", summary="Las tareas entregadas sin corregir (equipo).")
async def api_por_corregir(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    return {"entregas": await T.por_corregir(org_id, db_session)}


async def _entrega_del_equipo(entrega_id: int, current_user, db_session: AsyncSession):
    try:
        e = await T.entrega(entrega_id, db_session)
        t = await T.tarea(e.tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    await _equipo(current_user, t.org_id, db_session)
    return e


@router.get("/entrega/{entrega_id}", summary="Una entrega con su tarea, para corregirla (equipo).")
async def api_entrega(
    entrega_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    return await T.entrega_con_tarea(e, db_session)


@router.post("/entrega/{entrega_id}/correccion", summary="Corrige una entrega con texto y/o nota de voz (equipo).")
async def api_corregir(
    entrega_id: int,
    texto: str = Form(""),
    audio_seg: int = Form(0),
    audio: Optional[UploadFile] = File(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    try:
        return await T.corregir(e, texto, await _leer_audio(audio), audio_seg, current_user.id, _nombre_para_el_alumno(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.delete("/entrega/{entrega_id}/correccion", summary="Quita la corrección: vuelve a «por corregir» (equipo).")
async def api_reabrir(
    entrega_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    return await T.reabrir(e, db_session)


class CheckinIn(BaseModel):
    user_id: int
    hito: int
    nota: str = ""


@router.get("/org/{org_id}/checkins", summary="A quién le toca el check-in de las semanas 4, 8 y 12 (equipo).")
async def api_checkins(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    return await T.checkins(org_id, db_session)


@router.post("/org/{org_id}/checkins", summary="Apunta un check-in hecho (equipo).")
async def api_checkin_hecho(
    org_id: int,
    data: CheckinIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.marcar_checkin(org_id, data.user_id, data.hito, data.nota, _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)

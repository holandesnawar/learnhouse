"""
Salas en directo dentro de la escuela (Daily). La explicación entera está en
`src/services/salas/salas.py`.

- Ver la sala y entrar: quien puede ver el curso (la misma comprobación que la
  página del curso). El equipo entra como anfitrión.
- Encenderla, apagarla, grabar, el recuadro y bajar grabaciones: el equipo
  (administradores, moderadores y profes, desde el 02/11/2026). La etiqueta
  («Groep rood») solo los administradores.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.security.rbac.resource_access import check_resource_access
from src.security.rbac.types import AccessAction, AccessContext
from src.security.superadmin import is_user_superadmin
from src.services.courses.locks import is_org_admin, is_org_staff
from src.services.salas import salas

router = APIRouter()


async def _curso(request: Request, course_uuid: str, current_user, db_session: AsyncSession) -> Course:
    """El curso, si esta persona puede verlo (si no, 401/403/404)."""
    # Sin sesión no se entra nunca, aunque el curso sea público: la entrada
    # lleva el nombre de quien entra y la sala es solo para alumnos.
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela para usar la sala")
    limpio = salas.uuid_curso(course_uuid)
    curso = (
        await db_session.execute(
            select(Course).where(or_(Course.course_uuid == f"course_{limpio}", Course.course_uuid == limpio))
        )
    ).scalars().first()
    if not curso:
        raise HTTPException(status_code=404, detail="No existe ese curso")
    decision = await check_resource_access(
        request, db_session, current_user, curso.course_uuid, AccessAction.READ,
        context=AccessContext.DASHBOARD, raise_on_deny=False,
    )
    if not decision.allowed:
        raise HTTPException(status_code=403, detail="No tienes acceso a este curso")
    return curso


async def _roles(current_user, org_id: int, db_session: AsyncSession) -> tuple[bool, bool]:
    """(es del equipo, es administrador)."""
    superadmin = await is_user_superadmin(current_user.id, db_session)
    admin = superadmin or await is_org_admin(current_user.id, org_id, db_session)
    equipo = admin or await is_org_staff(current_user.id, org_id, db_session)
    return equipo, admin


def _error(exc: salas.SalaError) -> HTTPException:
    return HTTPException(status_code=exc.status if 400 <= exc.status < 600 else 502, detail=exc.mensaje)


@router.get("/course/{course_uuid}", summary="La sala de un curso: si está abierta y quién hay dentro.")
async def api_sala(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    ajustes = await salas.config_de(curso.org_id, curso.course_uuid, db_session)
    con_clave = bool(salas.clave_api())
    dentro = await salas.presentes(curso.course_uuid) if ajustes["activo"] and con_clave else []
    return {
        **ajustes,
        "curso": curso.name,
        "con_clave": con_clave,
        "presentes": dentro,
        "equipo": equipo,
        "admin": admin,
    }


@router.post("/course/{course_uuid}/entrar", summary="La entrada a la sala, con el nombre de quien entra.")
async def api_entrar(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    ajustes = await salas.config_de(curso.org_id, curso.course_uuid, db_session)
    if not ajustes["activo"]:
        raise HTTPException(status_code=409, detail="La sala de este curso no está abierta")
    try:
        datos = await salas.entrar(curso.course_uuid, current_user, equipo, ajustes["grabar"])
    except salas.SalaError as exc:
        raise _error(exc) from exc
    # `grabar` es siempre verdad desde el 02/11: cualquiera que entra arranca
    # la grabación, sin botón ni aviso en la sala.
    return {**datos, "curso": curso.name, "grabar": ajustes["grabar"]}


class SalaIn(BaseModel):
    activo: Optional[bool] = None
    # Ya no se usa (se graba siempre, 02/11/2026); se acepta para no romper
    # una pestaña abierta con la pantalla vieja.
    grabar: Optional[bool] = None
    # Si la página enseña las clases grabadas (27/10).
    grabadas: Optional[bool] = None
    # Una etiqueta que solo ven los administradores («Groep rood»), para
    # distinguir dos copias de la misma clase (29/10). Vacía = sin etiqueta.
    etiqueta: Optional[str] = None


@router.put("/course/{course_uuid}", summary="Encender o apagar la sala de un curso y si se graba (equipo; la etiqueta, administradores).")
async def api_guardar(
    request: Request,
    course_uuid: str,
    body: SalaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    if body.etiqueta is not None and not admin:
        raise HTTPException(status_code=403, detail="La etiqueta solo la cambia un administrador")
    try:
        return await salas.guardar_config(
            curso.org_id, curso.course_uuid, body.activo, body.grabar, db_session, grabadas=body.grabadas,
            etiqueta=body.etiqueta,
        )
    except salas.SalaError as exc:
        raise _error(exc) from exc


class RecuadroIn(BaseModel):
    subtitle: Optional[str] = ""
    live_url: Optional[str] = ""
    next_day: Optional[str] = ""
    next_weekday: Optional[str] = ""
    next_date: Optional[str] = ""
    schedule: Optional[str] = ""
    teacher: Optional[str] = ""
    duration: Optional[str] = ""


@router.put(
    "/course/{course_uuid}/recuadro",
    summary="El recuadro de una clase en directo: día, hora, profe… (equipo).",
)
async def api_recuadro(
    request: Request,
    course_uuid: str,
    body: RecuadroIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    try:
        return await salas.guardar_recuadro(curso.org_id, curso.course_uuid, body.model_dump(), db_session)
    except salas.SalaError as exc:
        raise _error(exc) from exc


@router.get("/course/{course_uuid}/grabaciones", summary="Las grabaciones de la sala (equipo).")
async def api_grabaciones(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    try:
        return {"grabaciones": await salas.grabaciones(curso.course_uuid)}
    except salas.SalaError as exc:
        raise _error(exc) from exc


@router.get(
    "/course/{course_uuid}/grabaciones/{grabacion_id}/descarga",
    summary="Enlace para bajar una grabación (equipo; caduca al rato).",
)
async def api_descarga(
    request: Request,
    course_uuid: str,
    grabacion_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    try:
        return {"url": await salas.enlace_descarga(curso.course_uuid, grabacion_id)}
    except salas.SalaError as exc:
        raise _error(exc) from exc

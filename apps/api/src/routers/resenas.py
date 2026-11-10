"""
Reseñas en vídeo de los alumnos (10/11/2026). La explicación entera, en
`src/services/resenas/resenas.py`.

- `…/mia`: el alumno, lo suyo (su invitación, mandar el vídeo, verlo).
- `…/org/{org_id}/…`: solo administradores (permiso de edición sobre la
  escuela, el mismo que para las estadísticas): invitar, revisar, bajar el
  vídeo, la nota, el regalo y borrar. Los profes y el closer no entran.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.orgs.orgs import rbac_check
from src.services.resenas import resenas as R

router = APIRouter()


def _error(exc: R.ResenaError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


def _con_sesion(current_user) -> None:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela para ver tu reseña")


async def _admin(request: Request, org_id: int, current_user, db_session: AsyncSession) -> None:
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


def _video(r, bajar: bool = False) -> FileResponse:
    encontrado = R.video_de(r)
    if encontrado is None:
        raise HTTPException(status_code=404, detail="No hay vídeo")
    ruta, mime, nombre = encontrado
    return FileResponse(
        path=str(ruta),
        media_type=mime,
        filename=nombre,
        content_disposition_type="attachment" if bajar else "inline",
        headers={"Cache-Control": "private, no-store"},
    )


# ── El alumno ───────────────────────────────────────────────────────────────


@router.get("/mia", summary="Mi reseña: si me han invitado, cómo va, y la guía para grabarla.")
async def api_mia(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    return await R.mia_para_la_pantalla(current_user.id, db_session)


@router.post("/mia", summary="Mandar mi vídeo (con el permiso marcado).")
async def api_grabar(
    video: Optional[UploadFile] = File(default=None),
    texto: str = Form(default=""),
    permiso: str = Form(default=""),
    usos: str = Form(default=""),
    segundos: str = Form(default="0"),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    try:
        return await R.grabar(current_user.id, video, texto, permiso, usos, segundos, db_session)
    except R.ResenaError as exc:
        raise _error(exc)


@router.get("/mia/video", summary="Ver mi propio vídeo.")
async def api_mi_video(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    r = await R.mia(current_user.id, db_session)
    if r is None or not R.puede_ver_video(r, current_user.id, False):
        raise HTTPException(status_code=404, detail="No hay vídeo")
    return _video(r)


# ── Administradores ─────────────────────────────────────────────────────────


class InvitarIn(BaseModel):
    user_ids: list[int] = []
    mensaje: str = ""
    regalo: str = ""


class RevisarIn(BaseModel):
    # aprobada · descartada · pendiente
    estado: str = ""


class CambioIn(BaseModel):
    nota: Optional[str] = None
    regalo: Optional[str] = None
    regalo_dado: Optional[bool] = None


@router.get("/org/{org_id}", summary="Las reseñas de la escuela, con sus cifras.")
async def api_listar(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return await R.listar(org_id, db_session)


@router.get("/org/{org_id}/alumnos", summary="A quién se puede invitar: alumnos con su avance.")
async def api_invitables(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    return {"alumnos": await R.invitables(org_id, db_session), "tope": R.TOPE}


@router.post("/org/{org_id}/invitar", summary="Invitar a varios alumnos a grabar su reseña.")
async def api_invitar(
    request: Request,
    org_id: int,
    body: InvitarIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    try:
        return await R.invitar(org_id, body.user_ids, body.mensaje, body.regalo, R.nombre_de(current_user), db_session)
    except R.ResenaError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/{resena_id}/estado", summary="Aprobar, descartar o devolver a pendiente.")
async def api_revisar(
    request: Request,
    org_id: int,
    resena_id: int,
    body: RevisarIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    try:
        return await R.revisar(org_id, resena_id, body.estado, R.nombre_de(current_user), db_session)
    except R.ResenaError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/{resena_id}", summary="La nota del equipo, el regalo y «regalo dado».")
async def api_cambiar(
    request: Request,
    org_id: int,
    resena_id: int,
    body: CambioIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    try:
        return await R.cambiar(org_id, resena_id, body.model_dump(exclude_none=True), db_session)
    except R.ResenaError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/{resena_id}/video", summary="Ver o bajar el vídeo de una reseña.")
async def api_video(
    request: Request,
    org_id: int,
    resena_id: int,
    bajar: int = 0,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    try:
        r = await R._una(org_id, resena_id, db_session)
    except R.ResenaError as exc:
        raise _error(exc)
    return _video(r, bajar=bool(bajar))


@router.delete("/org/{org_id}/{resena_id}", summary="Borrar una reseña (o una invitación) y su vídeo.")
async def api_borrar(
    request: Request,
    org_id: int,
    resena_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin(request, org_id, current_user, db_session)
    try:
        await R.borrar(org_id, resena_id, db_session)
    except R.ResenaError as exc:
        raise _error(exc)
    return {"ok": True}

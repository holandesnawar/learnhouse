"""
Los tableros de producción de la formación (19/11/2026), como el Deck de
Nextcloud pero dentro de la escuela. La explicación entera está en
`src/services/produccion/tableros.py`.

- Ver todo, crear y cambiar tarjetas, columnas, etiquetas nuevas, adjuntos y
  comentarios: el equipo de clases (administradores, moderadores y profes).
- Cursos y tableros (crear, cambiar, duplicar, borrar), cambiar o borrar
  etiquetas, borrar columnas e importar de Nextcloud: administradores.
- Borrar una tarjeta: quien la creó o un administrador.
"""

import mimetypes
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.equipo import _equipo
from src.security.auth import get_current_user
from src.services.equipo.equipo import miembros
from src.services.produccion import nextcloud as NC
from src.services.produccion import tableros as T

router = APIRouter()


def _error(exc: Exception) -> HTTPException:
    return HTTPException(status_code=getattr(exc, "status", 400), detail=getattr(exc, "mensaje", str(exc)))


async def _admin(current_user, org_id: int, db_session: AsyncSession) -> None:
    if not await _equipo(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Esto solo lo puede hacer un administrador")


class CursoIn(BaseModel):
    nombre: Optional[str] = None
    color: Optional[str] = None
    plantilla: Optional[str] = None
    orden: Optional[float] = None
    archivado: Optional[bool] = None


class EtiquetaIn(BaseModel):
    nombre: Optional[str] = None
    color: Optional[str] = None
    orden: Optional[float] = None


class TableroIn(BaseModel):
    curso_id: Optional[int] = None
    titulo: Optional[str] = None
    color: Optional[str] = None
    orden: Optional[float] = None
    archivado: Optional[bool] = None


class DuplicarIn(BaseModel):
    titulo: Optional[str] = None
    curso_id: Optional[int] = None
    con_tarjetas: bool = True


class ColumnaIn(BaseModel):
    titulo: Optional[str] = None
    orden: Optional[float] = None


class TarjetaNuevaIn(BaseModel):
    columna_id: int
    titulo: str


class TarjetaIn(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    vence: Optional[str] = None
    hecha: Optional[bool] = None
    archivada: Optional[bool] = None
    etiquetas: Optional[list[int]] = None
    asignados: Optional[list[Any]] = None
    enlaces: Optional[list[dict]] = None
    columna_id: Optional[int] = None
    tablero_id: Optional[int] = None
    orden: Optional[float] = None


class ComentarioIn(BaseModel):
    texto: str


class NextcloudIn(BaseModel):
    url: str
    usuario: str
    clave: str
    curso_id: Optional[int] = None
    tableros: Optional[list[int]] = None
    con_archivadas: bool = True


def _datos(m: BaseModel) -> dict:
    return m.model_dump(exclude_unset=True)


# ── todo de una vez ────────────────────────────────────────────────────────


@router.get("/org/{org_id}", summary="Los cursos con sus tableros y etiquetas, el equipo y quién soy.")
async def api_todo(org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    admin = await _equipo(current_user, org_id, db_session)
    datos = await T.vista_general(org_id, db_session)
    return {**datos, "miembros": await miembros(org_id, db_session), "yo": {"id": current_user.id, "admin": admin}}


@router.get("/org/{org_id}/proximas", summary="Las tarjetas con fecha y sin hacer, de todos los tableros.")
async def api_proximas(org_id: int, mias: bool = False, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    return await T.proximas(org_id, current_user.id, mias, db_session)


@router.get("/org/{org_id}/buscar", summary="Buscar tarjetas por título o texto en todos los tableros.")
async def api_buscar(org_id: int, q: str = "", current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    return await T.buscar(org_id, q, db_session)


# ── cursos y etiquetas ─────────────────────────────────────────────────────


@router.post("/org/{org_id}/cursos", summary="Un curso o nivel nuevo (solo administradores).")
async def api_crear_curso(org_id: int, body: CursoIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.crear_curso(org_id, body.nombre or "", body.color or "", db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/cursos/{curso_id}", summary="Cambiar un curso: nombre, color, plantilla, orden (solo administradores).")
async def api_cambiar_curso(org_id: int, curso_id: int, body: CursoIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.cambiar_curso(org_id, curso_id, _datos(body), db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/cursos/{curso_id}", summary="Borrar un curso con todos sus tableros (solo administradores).")
async def api_borrar_curso(org_id: int, curso_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        await T.borrar_curso(org_id, curso_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


@router.post("/org/{org_id}/cursos/{curso_id}/etiquetas", summary="Una etiqueta nueva del curso (el equipo).")
async def api_crear_etiqueta(org_id: int, curso_id: int, body: EtiquetaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.crear_etiqueta(org_id, curso_id, body.nombre or "", body.color or "", db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/etiquetas/{etiqueta_id}", summary="Cambiar una etiqueta (solo administradores).")
async def api_cambiar_etiqueta(org_id: int, etiqueta_id: int, body: EtiquetaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.cambiar_etiqueta(org_id, etiqueta_id, _datos(body), db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/etiquetas/{etiqueta_id}", summary="Borrar una etiqueta y quitarla de sus tarjetas (solo administradores).")
async def api_borrar_etiqueta(org_id: int, etiqueta_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        await T.borrar_etiqueta(org_id, etiqueta_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


# ── tableros ───────────────────────────────────────────────────────────────


@router.post("/org/{org_id}/tableros", summary="Un tablero nuevo con las columnas de siempre (solo administradores).")
async def api_crear_tablero(org_id: int, body: TableroIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.crear_tablero(org_id, int(body.curso_id or 0), body.titulo or "", body.color or "", db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/tableros/{tablero_id}", summary="Un tablero con sus columnas y sus tarjetas.")
async def api_tablero(org_id: int, tablero_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.ver_tablero(org_id, tablero_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/tableros/{tablero_id}/archivadas", summary="Las tarjetas archivadas de un tablero.")
async def api_archivadas(org_id: int, tablero_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.archivadas(org_id, tablero_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/tableros/{tablero_id}", summary="Cambiar un tablero: título, color, orden, curso, archivado (solo administradores).")
async def api_cambiar_tablero(org_id: int, tablero_id: int, body: TableroIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.cambiar_tablero(org_id, tablero_id, _datos(body), db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/tableros/{tablero_id}/duplicar", summary="Una copia del tablero, con o sin sus tarjetas (solo administradores).")
async def api_duplicar(org_id: int, tablero_id: int, body: DuplicarIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await T.duplicar_tablero(org_id, tablero_id, body.titulo or "", body.curso_id, body.con_tarjetas, db_session, current_user)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/tableros/{tablero_id}", summary="Borrar un tablero con sus tarjetas (solo administradores).")
async def api_borrar_tablero(org_id: int, tablero_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        await T.borrar_tablero(org_id, tablero_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


# ── columnas ───────────────────────────────────────────────────────────────


@router.post("/org/{org_id}/tableros/{tablero_id}/columnas", summary="Una columna nueva al final (el equipo).")
async def api_crear_columna(org_id: int, tablero_id: int, body: ColumnaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.crear_columna(org_id, tablero_id, body.titulo or "", db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/columnas/{columna_id}", summary="Cambiar el nombre o el orden de una columna (el equipo).")
async def api_cambiar_columna(org_id: int, columna_id: int, body: ColumnaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.cambiar_columna(org_id, columna_id, _datos(body), db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/columnas/{columna_id}", summary="Quitar una columna vacía (solo administradores).")
async def api_borrar_columna(org_id: int, columna_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        await T.borrar_columna(org_id, columna_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


# ── tarjetas ───────────────────────────────────────────────────────────────


@router.post("/org/{org_id}/tableros/{tablero_id}/tarjetas", summary="Una tarjeta nueva, con la plantilla de su curso (el equipo).")
async def api_crear_tarjeta(org_id: int, tablero_id: int, body: TarjetaNuevaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.crear_tarjeta(org_id, tablero_id, body.columna_id, body.titulo, current_user, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/tarjetas/{tarjeta_id}", summary="Una tarjeta entera, con sus comentarios.")
async def api_tarjeta(org_id: int, tarjeta_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.ver_tarjeta(org_id, tarjeta_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/tarjetas/{tarjeta_id}", summary="Cambiar una tarjeta (el equipo).")
async def api_cambiar_tarjeta(org_id: int, tarjeta_id: int, body: TarjetaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.cambiar_tarjeta(org_id, tarjeta_id, _datos(body), current_user, await miembros(org_id, db_session), db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/tarjetas/{tarjeta_id}", summary="Borrar una tarjeta (quien la creó o un administrador).")
async def api_borrar_tarjeta(org_id: int, tarjeta_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    admin = await _equipo(current_user, org_id, db_session)
    try:
        await T.borrar_tarjeta(org_id, tarjeta_id, current_user.id, admin, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


@router.post("/org/{org_id}/tarjetas/{tarjeta_id}/adjuntos", summary="Subir un archivo a una tarjeta (50 MB como mucho).")
async def api_subir(org_id: int, tarjeta_id: int, archivo: UploadFile = File(...), current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    datos = await archivo.read(T.MAX_ADJUNTO_BYTES + 1)
    try:
        return await T.subir_adjunto(org_id, tarjeta_id, archivo.filename or "", datos, current_user, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/tarjetas/{tarjeta_id}/adjuntos/{adjunto_id}", summary="Bajar un archivo de una tarjeta (el equipo).")
async def api_bajar(org_id: int, tarjeta_id: int, adjunto_id: str, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        r = await T.adjunto(org_id, tarjeta_id, adjunto_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    if r is None:
        raise HTTPException(status_code=404, detail="Ese archivo no está")
    ruta, nombre = r
    return FileResponse(
        path=str(ruta),
        media_type=mimetypes.guess_type(nombre)[0] or "application/octet-stream",
        filename=nombre,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/org/{org_id}/tarjetas/{tarjeta_id}/adjuntos/{adjunto_id}", summary="Quitar un archivo de una tarjeta (el equipo).")
async def api_borrar_adjunto(org_id: int, tarjeta_id: int, adjunto_id: str, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.borrar_adjunto(org_id, tarjeta_id, adjunto_id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/tarjetas/{tarjeta_id}/comentarios", summary="Comentar una tarjeta (el equipo).")
async def api_comentar(org_id: int, tarjeta_id: int, body: ComentarioIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.comentar(org_id, tarjeta_id, body.texto, current_user, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.put("/org/{org_id}/comentarios/{comentario_id}", summary="Cambiar un comentario propio.")
async def api_cambiar_comentario(org_id: int, comentario_id: int, body: ComentarioIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.cambiar_comentario(org_id, comentario_id, body.texto, current_user.id, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)


@router.delete("/org/{org_id}/comentarios/{comentario_id}", summary="Borrar un comentario (quien lo escribió o un administrador).")
async def api_borrar_comentario(org_id: int, comentario_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    admin = await _equipo(current_user, org_id, db_session)
    try:
        await T.borrar_comentario(org_id, comentario_id, current_user.id, admin, db_session)
    except T.ProduccionError as exc:
        raise _error(exc)
    return {"ok": True}


# ── Nextcloud ──────────────────────────────────────────────────────────────


@router.post("/org/{org_id}/nextcloud/tableros", summary="Ver los tableros del Deck de Nextcloud (la contraseña no se guarda).")
async def api_nextcloud_listar(org_id: int, body: NextcloudIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    try:
        return await NC.listar(body.url, body.usuario, body.clave)
    except NC.NextcloudError as exc:
        raise _error(exc)


@router.post("/org/{org_id}/nextcloud/importar", summary="Traer tableros del Deck de Nextcloud a un curso (la contraseña no se guarda).")
async def api_nextcloud_importar(org_id: int, body: NextcloudIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _admin(current_user, org_id, db_session)
    if not body.curso_id or not body.tableros:
        raise HTTPException(status_code=400, detail="Elige el curso y al menos un tablero")
    try:
        return await NC.importar(org_id, body.curso_id, body.url, body.usuario, body.clave, body.tableros, await miembros(org_id, db_session), current_user, db_session, body.con_archivadas)
    except (NC.NextcloudError, T.ProduccionError) as exc:
        raise _error(exc)

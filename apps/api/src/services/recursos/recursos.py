"""
Recursos compartidos: carpetas con archivos y enlaces para los alumnos.

Los archivos se guardan con el mismo almacén que los adjuntos del chat
(`communities/attachments.upload_attachment`): R2 si está configurado, si no
el volumen. Un solo sitio para los archivos de la escuela, y las mismas
comprobaciones de formato y tamaño (25 MB por archivo).
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.recursos import FolderWrite, LinkWrite, ResourceFolder, ResourceItem
from src.db.user_organizations import UserOrganization

logger = logging.getLogger(__name__)


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid(current_user) -> int:
    uid = getattr(current_user, "id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Hay que entrar para ver esto")
    return int(uid)


async def org_del_usuario(current_user, db_session: AsyncSession) -> int:
    """La escuela de quien pregunta. En single-tenancy solo hay una."""
    org_id = (
        await db_session.execute(
            select(UserOrganization.org_id).where(UserOrganization.user_id == _uid(current_user))
        )
    ).scalars().first()
    if not org_id:
        raise HTTPException(status_code=403, detail="No estás dentro de la escuela")
    return int(org_id)


def _folder_dict(f: ResourceFolder, items: list[ResourceItem]) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "description": f.description,
        "position": f.position,
        "created_at": f.created_at,
        "items": [
            {
                "id": i.id,
                "kind": i.kind,
                "title": i.title,
                "url": i.url,
                "file_name": i.file_name,
                "size": i.size,
                "position": i.position,
                "created_at": i.created_at,
            }
            for i in items
        ],
    }


async def listar(org_id: int, db_session: AsyncSession) -> list[dict]:
    carpetas = (
        await db_session.execute(
            select(ResourceFolder)
            .where(ResourceFolder.org_id == org_id)
            .order_by(ResourceFolder.position, ResourceFolder.id)
        )
    ).scalars().all()
    items = (
        await db_session.execute(
            select(ResourceItem)
            .where(ResourceItem.org_id == org_id)
            .order_by(ResourceItem.position, ResourceItem.id)
        )
    ).scalars().all()
    por_carpeta: dict[int, list[ResourceItem]] = {}
    for i in items:
        por_carpeta.setdefault(i.folder_id, []).append(i)
    return [_folder_dict(f, por_carpeta.get(f.id or 0, [])) for f in carpetas]


async def _carpeta(folder_id: int, org_id: int, db_session: AsyncSession) -> ResourceFolder:
    f = (
        await db_session.execute(
            select(ResourceFolder).where(ResourceFolder.id == folder_id, ResourceFolder.org_id == org_id)
        )
    ).scalars().first()
    if not f:
        raise HTTPException(status_code=404, detail="Esa carpeta no existe")
    return f


async def crear_carpeta(org_id: int, data: FolderWrite, db_session: AsyncSession) -> dict:
    nombre = (data.name or "").strip()[:120]
    if not nombre:
        raise HTTPException(status_code=400, detail="La carpeta necesita un nombre")
    ultimo = (
        await db_session.execute(
            select(ResourceFolder.position).where(ResourceFolder.org_id == org_id).order_by(ResourceFolder.position.desc())  # type: ignore[attr-defined]
        )
    ).scalars().first()
    f = ResourceFolder(
        org_id=org_id,
        name=nombre,
        description=(data.description or "").strip()[:400],
        position=int(ultimo or 0) + 1,
        created_at=_ahora(),
    )
    db_session.add(f)
    await db_session.commit()
    await db_session.refresh(f)
    return _folder_dict(f, [])


async def editar_carpeta(org_id: int, folder_id: int, data: FolderWrite, db_session: AsyncSession) -> dict:
    f = await _carpeta(folder_id, org_id, db_session)
    nombre = (data.name or "").strip()[:120]
    if not nombre:
        raise HTTPException(status_code=400, detail="La carpeta necesita un nombre")
    f.name = nombre
    f.description = (data.description or "").strip()[:400]
    db_session.add(f)
    await db_session.commit()
    await db_session.refresh(f)
    items = (
        await db_session.execute(
            select(ResourceItem).where(ResourceItem.folder_id == f.id).order_by(ResourceItem.position, ResourceItem.id)
        )
    ).scalars().all()
    return _folder_dict(f, list(items))


async def borrar_carpeta(org_id: int, folder_id: int, db_session: AsyncSession) -> dict:
    f = await _carpeta(folder_id, org_id, db_session)
    # Los items caen con ella (ondelete=CASCADE); por si la base no lo
    # aplicara, se borran a mano primero.
    for i in (
        await db_session.execute(select(ResourceItem).where(ResourceItem.folder_id == f.id))
    ).scalars().all():
        await db_session.delete(i)
    await db_session.delete(f)
    await db_session.commit()
    return {"ok": True}


async def ordenar_carpetas(org_id: int, ids: list[int], db_session: AsyncSession) -> dict:
    carpetas = (
        await db_session.execute(select(ResourceFolder).where(ResourceFolder.org_id == org_id))
    ).scalars().all()
    por_id = {f.id: f for f in carpetas}
    pos = 0
    for i in ids:
        f = por_id.get(i)
        if f is None:
            continue
        pos += 1
        f.position = pos
        db_session.add(f)
    await db_session.commit()
    return {"ok": True}


def _url_valida(url: str) -> str:
    url = (url or "").strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="El enlace tiene que empezar por http:// o https://")
    return url[:800]


async def _siguiente_posicion(folder_id: int, db_session: AsyncSession) -> int:
    ultimo = (
        await db_session.execute(
            select(ResourceItem.position).where(ResourceItem.folder_id == folder_id).order_by(ResourceItem.position.desc())  # type: ignore[attr-defined]
        )
    ).scalars().first()
    return int(ultimo or 0) + 1


async def anadir_enlace(org_id: int, folder_id: int, data: LinkWrite, db_session: AsyncSession) -> dict:
    f = await _carpeta(folder_id, org_id, db_session)
    titulo = (data.title or "").strip()[:160]
    if not titulo:
        raise HTTPException(status_code=400, detail="El enlace necesita un título")
    item = ResourceItem(
        org_id=org_id,
        folder_id=f.id or 0,
        kind="link",
        title=titulo,
        url=_url_valida(data.url),
        position=await _siguiente_posicion(f.id or 0, db_session),
        created_at=_ahora(),
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return _folder_dict(f, [item])["items"][0]


async def subir_archivo(
    org_id: int, folder_id: int, file: UploadFile, title: Optional[str], db_session: AsyncSession
) -> dict:
    from src.services.communities.attachments import upload_attachment

    f = await _carpeta(folder_id, org_id, db_session)
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    guardado = await upload_attachment(file, org.org_uuid)
    item = ResourceItem(
        org_id=org_id,
        folder_id=f.id or 0,
        kind="file",
        title=((title or "").strip() or guardado["name"])[:160],
        url=guardado["url"],
        file_name=guardado["name"][:160],
        size=int(guardado.get("size") or 0),
        position=await _siguiente_posicion(f.id or 0, db_session),
        created_at=_ahora(),
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return _folder_dict(f, [item])["items"][0]


async def borrar_item(org_id: int, item_id: int, db_session: AsyncSession) -> dict:
    item = (
        await db_session.execute(
            select(ResourceItem).where(ResourceItem.id == item_id, ResourceItem.org_id == org_id)
        )
    ).scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Ese recurso no existe")
    # El archivo físico se queda: borrar del volumen o de R2 a la primera es
    # perder un PDF por un clic. Se limpia aparte si algún día hace falta.
    await db_session.delete(item)
    await db_session.commit()
    return {"ok": True}


async def ordenar_items(org_id: int, folder_id: int, ids: list[int], db_session: AsyncSession) -> dict:
    f = await _carpeta(folder_id, org_id, db_session)
    items = (
        await db_session.execute(select(ResourceItem).where(ResourceItem.folder_id == f.id))
    ).scalars().all()
    por_id = {i.id: i for i in items}
    pos = 0
    for i in ids:
        it = por_id.get(i)
        if it is None:
            continue
        pos += 1
        it.position = pos
        db_session.add(it)
    await db_session.commit()
    return {"ok": True}

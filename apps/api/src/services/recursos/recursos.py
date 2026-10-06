"""
Recursos compartidos: carpetas con archivos y enlaces para los alumnos.

Los archivos se guardan con el mismo almacén que los adjuntos del chat
(`communities/attachments.upload_attachment`): R2 si está configurado, si no
el volumen. Un solo sitio para los archivos de la escuela, y las mismas
comprobaciones de formato y tamaño (25 MB por archivo).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.recursos import FolderWrite, LinkWrite, ResourceFolder, ResourceItem
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup

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


#: Rol de alumno (el mismo que `security/rbac/constants.py`).
ROL_ALUMNO = 4
ALUMNOS = "alumnos"


def leer_grupos(texto: str) -> list:
    """Los grupos guardados en la carpeta: ids (int) y/o "alumnos"."""
    try:
        valor = json.loads(texto) if texto else []
    except Exception:  # noqa: BLE001
        return []
    salida: list = []
    for v in valor if isinstance(valor, list) else []:
        if v == ALUMNOS:
            salida.append(ALUMNOS)
        elif isinstance(v, int) or (isinstance(v, str) and v.isdigit()):
            salida.append(int(v))
    return salida


def puede_ver(privada: bool, grupos: list, es_admin: bool, mios: set) -> bool:
    """¿Ve esta persona la carpeta? Función pura, con test.

    `mios`: los ids de sus grupos de usuarios, más "alumnos" si es alumno.
    El administrador lo ve todo. Si la carpeta tiene grupos, solo quien esté
    en alguno (lo de "privada" no cuenta entonces). Si no tiene grupos y es
    privada, solo administradores. Si no, todos."""
    if es_admin:
        return True
    if grupos:
        return bool(set(grupos) & mios)
    return not privada


async def quien_soy(user_id: int, org_id: int, db_session: AsyncSession) -> tuple[bool, set]:
    """(¿es administrador?, sus grupos + "alumnos" si es alumno)."""
    from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
    from src.security.rbac.rbac import is_user_superadmin

    rol = (
        await db_session.execute(
            select(UserOrganization.role_id).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    es_admin = rol in ADMIN_OR_MAINTAINER_ROLE_IDS
    if not es_admin:
        try:
            es_admin = bool(await is_user_superadmin(user_id, db_session))
        except Exception:  # noqa: BLE001
            es_admin = False
    mios: set = {
        int(g)
        for (g,) in (
            await db_session.execute(select(UserGroupUser.usergroup_id).where(UserGroupUser.user_id == user_id))
        ).all()
    }
    if rol == ROL_ALUMNO:
        mios.add(ALUMNOS)
    return es_admin, mios


async def _grupos_validos(org_id: int, pedidos: list, db_session: AsyncSession) -> list:
    """Solo grupos de esta escuela (y "alumnos"), sin repetir."""
    de_la_escuela = {
        int(g)
        for (g,) in (await db_session.execute(select(UserGroup.id).where(UserGroup.org_id == org_id))).all()
    }
    salida: list = []
    for v in leer_grupos(json.dumps(pedidos or [])):
        if (v == ALUMNOS or v in de_la_escuela) and v not in salida:
            salida.append(v)
    return salida


def _poner_grupos(f: ResourceFolder, data: FolderWrite, validos: list) -> None:
    """Guarda los grupos. Si se pidieron grupos y ninguno vale (borrados, de
    otra escuela), la carpeta se queda en «solo administradores»: pedir
    «solo estos» nunca puede acabar en «todos»."""
    f.grupos = json.dumps(validos)
    if data.grupos and not validos:
        f.private = True


def _folder_dict(f: ResourceFolder, items: list[ResourceItem]) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "description": f.description,
        "position": f.position,
        "created_at": f.created_at,
        "private": bool(getattr(f, "private", False)),
        "grupos": leer_grupos(getattr(f, "grupos", "") or ""),
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


async def listar(
    org_id: int,
    db_session: AsyncSession,
    *,
    con_privadas: bool = False,
    es_admin: bool = False,
    mios: Optional[set] = None,
) -> list[dict]:
    """Las carpetas. A quien no le toca una carpeta NO se le manda (ni sus
    items): se filtra aquí, en el servidor, no escondiéndola en la pantalla.
    `con_privadas` = el panel del administrador: todas."""
    carpetas = (
        await db_session.execute(
            select(ResourceFolder)
            .where(ResourceFolder.org_id == org_id)
            .order_by(ResourceFolder.position, ResourceFolder.id)
        )
    ).scalars().all()
    if not con_privadas:
        carpetas = [
            f
            for f in carpetas
            if puede_ver(bool(getattr(f, "private", False)), leer_grupos(getattr(f, "grupos", "") or ""), es_admin, mios or set())
        ]
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
        private=bool(data.private),
    )
    _poner_grupos(f, data, await _grupos_validos(org_id, data.grupos or [], db_session))
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
    f.private = bool(data.private)
    if data.grupos is not None:
        _poner_grupos(f, data, await _grupos_validos(org_id, data.grupos, db_session))
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

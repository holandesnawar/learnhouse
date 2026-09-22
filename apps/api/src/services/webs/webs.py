"""
Enlaces cortos y redirecciones de la web.

`destino_final` es una función pura (con test): monta la URL de destino con
las UTM del enlace sin pisar las que el destino ya llevara.
"""

import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.web_link import WebLink, WebLinkWrite

_SLUG_OK = re.compile(r"^[a-z0-9][a-z0-9\-/]{0,118}$")
# Rutas que la web sirve ella misma: un enlace con este nombre nunca se
# alcanzaría (la página real gana) y solo confundiría.
_RESERVADOS = {"api", "admin", "blog", "guia", "dash", "_astro", "favicon.ico", "robots.txt", "sitemap-index.xml"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def limpiar_slug(slug: str) -> str:
    s = (slug or "").strip().lower().strip("/")
    s = re.sub(r"\s+", "-", s)
    if not _SLUG_OK.match(s):
        raise HTTPException(
            status_code=400,
            detail="El atajo solo puede llevar letras, números, guiones y barras (p. ej. «ig» o «guia/bases»)",
        )
    if s.split("/")[0] in _RESERVADOS:
        raise HTTPException(status_code=400, detail=f"«{s}» está reservado: la web ya tiene esa ruta")
    return s


def _url_ok(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("/"):
        return url[:800]
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="El destino tiene que empezar por http(s):// o por /")
    return url[:800]


def destino_final(destination: str, utm: dict) -> str:
    """Pega las UTM del enlace al destino. Las que el destino ya traiga ganan:
    si alguien puso a mano un utm_source en la URL, era a propósito."""
    partes = urlsplit(destination)
    existentes = dict(parse_qsl(partes.query, keep_blank_values=True))
    for clave in ("utm_source", "utm_medium", "utm_campaign", "utm_content"):
        valor = (utm.get(clave) or "").strip()
        if valor and clave not in existentes:
            existentes[clave] = valor
    return urlunsplit((partes.scheme, partes.netloc, partes.path, urlencode(existentes), partes.fragment))


def _dict(l: WebLink) -> dict:
    utm = {k: getattr(l, k) for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content")}
    return {
        "id": l.id,
        "slug": l.slug,
        "destination": l.destination,
        "destino_final": destino_final(l.destination, utm),
        "kind": l.kind,
        **utm,
        "note": l.note,
        "clicks": l.clicks,
        "active": l.active,
        "created_at": l.created_at,
        "updated_at": l.updated_at,
    }


async def listar(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (
        await db_session.execute(
            select(WebLink).where(WebLink.org_id == org_id).order_by(WebLink.kind, WebLink.slug)
        )
    ).scalars().all()
    return [_dict(l) for l in filas]


async def _por_slug(slug: str, db_session: AsyncSession, org_id: Optional[int] = None) -> Optional[WebLink]:
    q = select(WebLink).where(WebLink.slug == slug)
    if org_id is not None:
        q = q.where(WebLink.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


def _volcar(l: WebLink, data: WebLinkWrite) -> None:
    l.destination = _url_ok(data.destination)
    l.kind = "redireccion" if data.kind == "redireccion" else "enlace"
    for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content"):
        setattr(l, k, (getattr(data, k) or "").strip()[:120])
    l.note = (data.note or "").strip()[:240]
    l.active = bool(data.active)
    l.updated_at = _ahora()


async def crear(org_id: int, data: WebLinkWrite, db_session: AsyncSession) -> dict:
    slug = limpiar_slug(data.slug)
    if await _por_slug(slug, db_session):
        raise HTTPException(status_code=409, detail=f"Ya hay un enlace en «/{slug}»")
    l = WebLink(org_id=org_id, slug=slug, created_at=_ahora())
    _volcar(l, data)
    db_session.add(l)
    await db_session.commit()
    await db_session.refresh(l)
    return _dict(l)


async def editar(org_id: int, link_id: int, data: WebLinkWrite, db_session: AsyncSession) -> dict:
    l = (
        await db_session.execute(select(WebLink).where(WebLink.id == link_id, WebLink.org_id == org_id))
    ).scalars().first()
    if not l:
        raise HTTPException(status_code=404, detail="Ese enlace no existe")
    slug = limpiar_slug(data.slug)
    otro = await _por_slug(slug, db_session)
    if otro and otro.id != l.id:
        raise HTTPException(status_code=409, detail=f"Ya hay un enlace en «/{slug}»")
    l.slug = slug
    _volcar(l, data)
    db_session.add(l)
    await db_session.commit()
    await db_session.refresh(l)
    return _dict(l)


async def borrar(org_id: int, link_id: int, db_session: AsyncSession) -> dict:
    l = (
        await db_session.execute(select(WebLink).where(WebLink.id == link_id, WebLink.org_id == org_id))
    ).scalars().first()
    if not l:
        raise HTTPException(status_code=404, detail="Ese enlace no existe")
    await db_session.delete(l)
    await db_session.commit()
    return {"ok": True}


async def resolver(slug: str, db_session: AsyncSession) -> Optional[dict]:
    """Lo que llama la web cuando le piden una ruta que no tiene. Cuenta el
    clic. Sin org: en single-tenancy el slug es único en toda la tabla."""
    s = (slug or "").strip().lower().strip("/")
    if not s:
        return None
    l = await _por_slug(s, db_session)
    if not l or not l.active:
        return None
    l.clicks = int(l.clicks or 0) + 1
    db_session.add(l)
    try:
        await db_session.commit()
    except Exception:  # noqa: BLE001
        await db_session.rollback()
    utm = {k: getattr(l, k) for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content")}
    return {"destino": destino_final(l.destination, utm), "kind": l.kind}

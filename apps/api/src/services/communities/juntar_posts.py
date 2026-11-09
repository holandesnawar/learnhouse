"""
Juntar dos publicaciones de la misma persona en un tablón (09/11/2026).

Pedido: "en presentaciones, como admin, ¿puedo editar algunos posts? Algunos
pusieron «hoi» como saludo y luego en otro mensaje las frases sobre ellos, y
ahora queda como dos posts diferentes".

Pasa sobre todo con lo que venía del chat (presentaciones_posts.py): en un
chat se escribe en varios mensajes seguidos, y en un tablón cada uno es una
publicación. «Juntar con la anterior» (solo administradores) coge una
publicación y la pega debajo de la anterior de la MISMA persona en el MISMO
canal:

- El texto de las dos, una detrás de otra, y las fotos y audios de las dos.
- El título: el de la de arriba, salvo que la de arriba sea solo un saludo
  (menos de 40 letras), que entonces se queda el de la de abajo.
- Los comentarios de la de abajo pasan a la de arriba; las respuestas en hilo
  del chat (`threadParent`) también. Los «me gusta» y reacciones de la de
  abajo se pierden (son de un mensaje que ya no existe).
- La de abajo se borra. No se puede deshacer, por eso la pantalla pregunta.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

_SALUDO = 40


def _doc(content: Any) -> dict:
    if isinstance(content, dict):
        return dict(content)
    try:
        d = json.loads(content) if content else None
    except (TypeError, ValueError):
        d = None
    if isinstance(d, dict):
        return d
    texto = str(content or "").strip()
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}] if texto else [],
    }


def texto_plano(doc: dict) -> str:
    partes: list[str] = []

    def walk(n: Any) -> None:
        if isinstance(n, dict):
            if n.get("type") == "text" and isinstance(n.get("text"), str):
                partes.append(n["text"])
            for h in n.get("content") or []:
                walk(h)

    walk(doc)
    return " ".join(" ".join(partes).split())


def juntar_contenido(a_content: Any, b_content: Any, a_titulo: str, b_titulo: str) -> tuple[str, str]:
    """(contenido, título) de la publicación juntada. Función pura, con test."""
    a, b = _doc(a_content), _doc(b_content)
    nuevo = {k: v for k, v in a.items() if k not in ("content", "attachments", "threadParent")}
    nuevo["type"] = a.get("type") or "doc"
    nuevo["content"] = list(a.get("content") or []) + list(b.get("content") or [])
    adjuntos = [x for x in (a.get("attachments") or []) if isinstance(x, dict)] + [
        x for x in (b.get("attachments") or []) if isinstance(x, dict)
    ]
    if adjuntos:
        nuevo["attachments"] = adjuntos
    titulo = a_titulo or b_titulo
    if len(texto_plano(a)) < _SALUDO and (b_titulo or "").strip():
        titulo = b_titulo
    return json.dumps(nuevo, ensure_ascii=False), (titulo or "")[:200]


def _es_respuesta(content: Any) -> bool:
    return bool(_doc(content).get("threadParent"))


async def juntar_con_la_anterior(request: Request, discussion_uuid: str, current_user, db_session: AsyncSession) -> dict:
    from src.db.communities.communities import Community
    from src.db.communities.discussion_comments import DiscussionComment
    from src.db.communities.discussions import Discussion
    from src.security.auth import resolve_acting_user_id
    from src.security.rbac import authorization_verify_based_on_org_admin_status
    from src.services.communities.discussions import _delete_discussion_children

    yo = resolve_acting_user_id(current_user)
    b = (await db_session.execute(select(Discussion).where(Discussion.discussion_uuid == discussion_uuid))).scalars().first()
    if not b:
        raise HTTPException(status_code=404, detail="Esa publicación ya no está")
    canal = (await db_session.execute(select(Community).where(Community.id == b.community_id))).scalars().first()
    if not canal:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    if not await authorization_verify_based_on_org_admin_status(request, yo, "update", canal.community_uuid, db_session):
        raise HTTPException(status_code=403, detail="Solo un administrador puede juntar publicaciones")

    candidatas = (
        await db_session.execute(
            select(Discussion).where(
                Discussion.community_id == b.community_id,
                Discussion.author_id == b.author_id,
                Discussion.id != b.id,
            )
        )
    ).scalars().all()
    anteriores = [d for d in candidatas if (d.creation_date or "") <= (b.creation_date or "") and not _es_respuesta(d.content)]
    if not anteriores:
        raise HTTPException(status_code=409, detail="No hay ninguna publicación anterior de esta persona en este canal")
    a = max(anteriores, key=lambda d: d.creation_date or "")

    a.content, a.title = juntar_contenido(a.content, b.content, a.title, b.title)
    db_session.add(a)

    # Los comentarios de la de abajo, a la de arriba.
    for c in (await db_session.execute(select(DiscussionComment).where(DiscussionComment.discussion_id == b.id))).scalars().all():
        c.discussion_id = a.id
        db_session.add(c)
    # Las respuestas en hilo del chat, también.
    respuestas = (
        await db_session.execute(
            select(Discussion).where(
                Discussion.community_id == b.community_id,
                Discussion.content.contains(b.discussion_uuid),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    for r in respuestas:
        d = _doc(r.content)
        if d.get("threadParent") == b.discussion_uuid:
            d["threadParent"] = a.discussion_uuid
            r.content = json.dumps(d, ensure_ascii=False)
            db_session.add(r)
    await db_session.flush()

    await _delete_discussion_children(b.id or 0, db_session)
    await db_session.delete(b)
    await db_session.commit()
    return {"discussion_uuid": a.discussion_uuid, "title": a.title}

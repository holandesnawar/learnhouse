"""
No leídos, menciones y encuestas de la comunidad.

Los "no leídos" se calculan comparando la fecha de cada mensaje con la última
vez que el alumno abrió ese canal (tabla channel_read_state). Las menciones se
detectan sobre el texto del mensaje: @all y @nombre.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.communities.communities import Community
from src.db.communities.discussions import Discussion
from src.db.community_engagement import (
    ChannelReadState,
    NotificationDismissed,
    NotificationFeed,
    NotificationItem,
    NotificationSeen,
    OrgNotification,
    PollVote,
    PollResults,
    UnreadCount,
)
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User

logger = logging.getLogger(__name__)

MENTION_ALL = "@all"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_id_or_401(current_user) -> int:
    uid = getattr(current_user, "id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return int(uid)


def message_text(content: Optional[str]) -> str:
    """El contenido va como JSON de ProseMirror; se saca el texto plano."""
    if not content:
        return ""
    try:
        doc = json.loads(content)
    except Exception:
        return str(content)

    out: List[str] = []

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "text" and isinstance(node.get("text"), str):
                out.append(node["text"])
            for child in node.get("content") or []:
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(doc)
    return " ".join(out)


def mentions_in(text: str) -> Tuple[bool, List[str]]:
    """(¿menciona a todos?, nombres mencionados en minúsculas)."""
    low = (text or "").lower()
    all_flag = MENTION_ALL in low or "@todos" in low
    names = [m.group(1).lower() for m in re.finditer(r"@([\wáéíóúüñ.\-]{2,40})", text or "")]
    names = [n for n in names if n not in ("all", "todos")]
    return all_flag, names


def mentions_user(text: str, user: User) -> bool:
    all_flag, names = mentions_in(text)
    if all_flag:
        return True
    candidates = {
        (user.username or "").lower(),
        (user.first_name or "").lower(),
        f"{(user.first_name or '').lower()}.{(user.last_name or '').lower()}".strip("."),
    }
    candidates.discard("")
    return any(n in candidates for n in names)


async def _community_or_404(community_uuid: str, db_session: AsyncSession) -> Community:
    community = (
        await db_session.execute(
            select(Community).where(Community.community_uuid == community_uuid)
        )
    ).scalars().first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


async def mark_channel_read(
    community_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> dict:
    user_id = _user_id_or_401(current_user)
    community = await _community_or_404(community_uuid, db_session)

    row = (
        await db_session.execute(
            select(ChannelReadState).where(
                ChannelReadState.user_id == user_id,
                ChannelReadState.community_id == community.id,
            )
        )
    ).scalars().first()

    now = _now()
    if row:
        row.last_read_at = now
    else:
        row = ChannelReadState(user_id=user_id, community_id=community.id, last_read_at=now)
    db_session.add(row)
    await db_session.commit()
    return {"community_uuid": community_uuid, "last_read_at": now}


async def get_read_states(
    current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> dict:
    """{community_uuid: last_read_at} — lo usa el chat para la línea de nuevos."""
    user_id = _user_id_or_401(current_user)
    rows = (
        await db_session.execute(
            select(Community.community_uuid, ChannelReadState.last_read_at)
            .join(ChannelReadState, ChannelReadState.community_id == Community.id)  # type: ignore
            .where(ChannelReadState.user_id == user_id)
        )
    ).all()
    return {uuid: last for uuid, last in rows}


async def get_unread(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[UnreadCount]:
    """
    Mensajes sin leer por canal, y cuántos de ellos te mencionan.

    Se traen solo los mensajes posteriores a la última lectura de cada canal, no
    el historial entero.
    """
    user_id = _user_id_or_401(current_user)

    user = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    org_ids = [
        r for r in (
            await db_session.execute(
                select(UserOrganization.org_id).where(UserOrganization.user_id == user_id)
            )
        ).scalars().all()
    ]
    if not org_ids:
        return []

    communities = (
        await db_session.execute(
            select(Community).where(Community.org_id.in_(org_ids))  # type: ignore
        )
    ).scalars().all()
    if not communities:
        return []

    read_rows = (
        await db_session.execute(
            select(ChannelReadState.community_id, ChannelReadState.last_read_at).where(
                ChannelReadState.user_id == user_id
            )
        )
    ).all()
    read_map = {cid: last for cid, last in read_rows}

    out: List[UnreadCount] = []
    for community in communities:
        last_read = read_map.get(community.id) or ""
        statement = select(Discussion).where(
            Discussion.community_id == community.id,
            Discussion.author_id != user_id,  # lo tuyo no cuenta como no leído
        )
        if last_read:
            statement = statement.where(Discussion.creation_date > last_read)  # type: ignore
        rows = (await db_session.execute(statement)).scalars().all()

        if not rows:
            continue

        mention_count = sum(1 for d in rows if mentions_user(message_text(d.content), user))
        out.append(
            UnreadCount(
                community_uuid=community.community_uuid,
                unread=len(rows),
                mentions=mention_count,
            )
        )
    return out


####################################################
# Campana de notificaciones
####################################################


async def _user_org_ids(user_id: int, db_session: AsyncSession) -> List[int]:
    return list(
        (
            await db_session.execute(
                select(UserOrganization.org_id).where(UserOrganization.user_id == user_id)
            )
        ).scalars().all()
    )


def _short(text: str, size: int = 160) -> str:
    text = (text or "").strip()
    return text if len(text) <= size else text[: size - 3].rstrip() + "…"


async def _mention_items(
    user: User, org_ids: List[int], db_session: AsyncSession
) -> List[dict]:
    """Mensajes de la comunidad que nombran al alumno (@nombre o @all)."""
    rows = (
        await db_session.execute(
            select(Discussion, Community, User)
            .join(Community, Community.id == Discussion.community_id)  # type: ignore
            .join(User, User.id == Discussion.author_id)  # type: ignore
            .where(
                Community.org_id.in_(org_ids),  # type: ignore
                Discussion.author_id != user.id,
            )
            .order_by(Discussion.creation_date.desc())  # type: ignore
            .limit(300)
        )
    ).all()

    out: List[dict] = []
    for discussion, community, author in rows:
        text = message_text(discussion.content)
        if not mentions_user(text, user):
            continue
        who = author.first_name or author.username or "Alguien"
        out.append(
            {
                "id": f"mention:{discussion.discussion_uuid}",
                "kind": "mention",
                "title": f"{who} te ha mencionado en {community.name or 'la comunidad'}",
                "excerpt": _short(text),
                "url": f"/community/{community.community_uuid}",
                "date": discussion.creation_date or "",
            }
        )
    return out


async def _pinned_items(org_ids: List[int], db_session: AsyncSession) -> List[dict]:
    """Mensajes que el equipo ha fijado como importantes en un canal."""
    rows = (
        await db_session.execute(
            select(Discussion, Community)
            .join(Community, Community.id == Discussion.community_id)  # type: ignore
            .where(
                Community.org_id.in_(org_ids),  # type: ignore
                Discussion.is_pinned == True,  # noqa: E712
            )
            .order_by(Discussion.update_date.desc())  # type: ignore
            .limit(10)
        )
    ).all()

    return [
        {
            "id": f"pinned:{discussion.discussion_uuid}",
            "kind": "pinned",
            "title": f"Mensaje importante en {community.name or 'la comunidad'}",
            "excerpt": _short(message_text(discussion.content) or discussion.title or ""),
            "url": f"/community/{community.community_uuid}",
            "date": discussion.update_date or discussion.creation_date or "",
        }
        for discussion, community in rows
    ]


async def _announcement_items(org_ids: List[int], db_session: AsyncSession) -> List[dict]:
    """Avisos que ha mandado la escuela (los mismos de la pantalla de Avisos)."""
    rows = (
        await db_session.execute(
            select(OrgNotification)
            .where(OrgNotification.org_id.in_(org_ids))  # type: ignore
            .order_by(OrgNotification.created_at.desc())  # type: ignore
            .limit(15)
        )
    ).scalars().all()

    labels = {
        "class": "Clase confirmada",
        "news": "Novedades de la escuela",
        "announcement": "Nuevo anuncio",
    }
    return [
        {
            "id": f"org:{row.id}",
            "kind": "announcement",
            "title": row.title or labels.get(row.kind, "Nuevo aviso"),
            "excerpt": _short(row.body or labels.get(row.kind, "")),
            "url": row.url or "/",
            "date": row.created_at or "",
        }
        for row in rows
    ]


async def _module_items(
    user_id: int, org_ids: List[int], db_session: AsyncSession
) -> List[dict]:
    """
    Módulos que se le han abierto al alumno hace poco (goteo de contenido).

    No hace falta guardar nada: la fecha de apertura es su fecha de alta más los
    días configurados, así que se calcula. Se muestran los de las últimas 3
    semanas — más atrás ya no es novedad.
    """
    from datetime import timedelta

    from src.db.courses.chapters import Chapter
    from src.db.courses.courses import Course
    from src.services.courses.locks import get_drip_settings

    out: List[dict] = []
    now = datetime.now()

    for org_id in org_ids:
        settings = await get_drip_settings(org_id, db_session)
        offsets = (settings or {}).get("chapters") or {}
        if not isinstance(offsets, dict) or not offsets:
            continue

        uo = (
            await db_session.execute(
                select(UserOrganization).where(
                    UserOrganization.user_id == user_id,
                    UserOrganization.org_id == org_id,
                )
            )
        ).scalars().first()
        if not uo or not uo.creation_date:
            continue
        try:
            enrolled_at = datetime.fromisoformat(uo.creation_date)
        except (ValueError, TypeError):
            continue

        opened: dict[str, datetime] = {}
        for chapter_uuid, offset in offsets.items():
            try:
                days = int(offset or 0)
            except (ValueError, TypeError):
                continue
            if days <= 0:
                continue
            unlock_at = enrolled_at + timedelta(days=days)
            if unlock_at <= now and (now - unlock_at) <= timedelta(days=21):
                opened[chapter_uuid] = unlock_at
        if not opened:
            continue

        rows = (
            await db_session.execute(
                select(Chapter, Course)
                .join(Course, Course.id == Chapter.course_id)  # type: ignore
                .where(Chapter.chapter_uuid.in_(list(opened.keys())))  # type: ignore
            )
        ).all()

        for chapter, course in rows:
            course_ref = (course.course_uuid or "").replace("course_", "")
            out.append(
                {
                    "id": f"module:{chapter.chapter_uuid}",
                    "kind": "module",
                    "title": f"Has desbloqueado {chapter.name}",
                    "excerpt": "Ya puedes entrar. Te toca seguir por aquí.",
                    "url": f"/course/{course_ref}" if course_ref else "/courses",
                    "date": opened[chapter.chapter_uuid].isoformat(),
                }
            )
    return out


async def list_notifications(
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    limit: int = 20,
) -> NotificationFeed:
    """
    Todo lo que el alumno se puede perder, en una lista: menciones, mensajes
    fijados, avisos de la escuela y módulos que se le acaban de abrir.

    Nada de esto manda correo: la campana es justo para lo que no merece un
    email pero sí que se entere al entrar.
    """
    user_id = _user_id_or_401(current_user)

    user = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    org_ids = await _user_org_ids(user_id, db_session)
    if not org_ids:
        return NotificationFeed(items=[], unseen=0)

    seen_row = (
        await db_session.execute(
            select(NotificationSeen).where(NotificationSeen.user_id == user_id)
        )
    ).scalars().first()
    last_seen = seen_row.last_seen_at if seen_row else ""

    raw: List[dict] = []
    # Cada fuente por separado: si una falla (config rara, tabla nueva sin
    # estrenar), la campana sigue enseñando el resto.
    for source in (
        _mention_items(user, org_ids, db_session),
        _pinned_items(org_ids, db_session),
        _announcement_items(org_ids, db_session),
        _module_items(user_id, org_ids, db_session),
    ):
        try:
            raw.extend(await source)
        except Exception as e:  # noqa: BLE001
            logger.warning("Fuente de notificaciones no disponible: %s", e)

    # Las que el alumno ha quitado a mano no vuelven.
    dismissed = set(
        (
            await db_session.execute(
                select(NotificationDismissed.item_id).where(
                    NotificationDismissed.user_id == user_id
                )
            )
        ).scalars().all()
    )
    if dismissed:
        raw = [r for r in raw if r["id"] not in dismissed]

    raw.sort(key=lambda r: r.get("date") or "", reverse=True)

    items = [
        NotificationItem(
            id=r["id"],
            kind=r["kind"],
            title=r["title"],
            excerpt=r["excerpt"],
            url=r["url"],
            date=r["date"],
            is_new=bool(r["date"] and r["date"] > last_seen),
        )
        for r in raw[:limit]
    ]

    return NotificationFeed(items=items, unseen=sum(1 for i in items if i.is_new))


async def dismiss_notification(
    item_id: str, current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> dict:
    """Quitar una notificación de la campana (la papelera de cada línea)."""
    user_id = _user_id_or_401(current_user)
    key = (item_id or "").strip()[:200]
    if not key:
        raise HTTPException(status_code=400, detail="Missing notification id")

    exists = (
        await db_session.execute(
            select(NotificationDismissed).where(
                NotificationDismissed.user_id == user_id,
                NotificationDismissed.item_id == key,
            )
        )
    ).scalars().first()
    if not exists:
        db_session.add(
            NotificationDismissed(user_id=user_id, item_id=key, created_at=_now())
        )
        await db_session.commit()
    return {"dismissed": key}


async def mark_notifications_seen(
    current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> dict:
    """Apaga el punto rojo de la campana. No marca los canales como leídos."""
    user_id = _user_id_or_401(current_user)
    row = (
        await db_session.execute(
            select(NotificationSeen).where(NotificationSeen.user_id == user_id)
        )
    ).scalars().first()

    now = _now()
    if row:
        row.last_seen_at = now
    else:
        row = NotificationSeen(user_id=user_id, last_seen_at=now)
    db_session.add(row)
    await db_session.commit()
    return {"last_seen_at": now}


####################################################
# Encuestas
####################################################


async def vote_poll(
    discussion_uuid: str,
    option_index: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> PollResults:
    user_id = _user_id_or_401(current_user)
    if option_index < 0 or option_index > 20:
        raise HTTPException(status_code=400, detail="Invalid option")

    discussion = (
        await db_session.execute(
            select(Discussion).where(Discussion.discussion_uuid == discussion_uuid)
        )
    ).scalars().first()
    if not discussion:
        raise HTTPException(status_code=404, detail="Message not found")

    row = (
        await db_session.execute(
            select(PollVote).where(
                PollVote.user_id == user_id,
                PollVote.discussion_uuid == discussion_uuid,
            )
        )
    ).scalars().first()

    if row:
        row.option_index = option_index  # cambiar el voto es válido
    else:
        row = PollVote(
            user_id=user_id,
            discussion_uuid=discussion_uuid,
            option_index=option_index,
            created_at=_now(),
        )
    db_session.add(row)
    await db_session.commit()

    return await poll_results(discussion_uuid, current_user, db_session)


async def poll_results(
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> PollResults:
    user_id = getattr(current_user, "id", None)
    rows = (
        await db_session.execute(
            select(PollVote.user_id, PollVote.option_index).where(
                PollVote.discussion_uuid == discussion_uuid
            )
        )
    ).all()

    counts: List[int] = []
    my_vote: Optional[int] = None
    for uid, idx in rows:
        while len(counts) <= idx:
            counts.append(0)
        counts[idx] += 1
        if user_id and int(uid) == int(user_id):
            my_vote = int(idx)

    return PollResults(
        discussion_uuid=discussion_uuid,
        counts=counts,
        total=len(rows),
        my_vote=my_vote,
    )

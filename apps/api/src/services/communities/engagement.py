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
from src.db.community_engagement import ChannelReadState, PollVote, PollResults, UnreadCount
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

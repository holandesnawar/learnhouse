"""
Mensajes directos alumno ↔ equipo.

Reglas del sitio:
- Cada alumno tiene UN hilo. Escribe ahí y lo lee cualquier moderador; no elige
  destinatario, que es justo lo que no queremos que tenga que pensar.
- El equipo ve la bandeja entera (un hilo por alumno) y contesta donde toque.
- Al crear el hilo se mete solo el mensaje de bienvenida de la academia, así el
  alumno nunca se encuentra una pantalla vacía el primer día.
- Se puede mandar una nota de voz: en una academia de idiomas es LA función
  (pronunciar, corregir), no un adorno.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.direct_messages import (
    DirectMessage,
    DirectMessageRead,
    DirectThread,
    DirectThreadDetail,
    DirectThreadRead,
)
from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS

logger = logging.getLogger(__name__)

# Audio corto: una nota de voz, no un podcast.
MAX_AUDIO_BYTES = 8 * 1024 * 1024
AUDIO_FORMATS = ("webm", "ogg", "mp3", "m4a", "mp4", "wav")

DEFAULT_WELCOME = (
    "¡Hola! Soy del equipo de Holandés Nawar. Este es tu canal directo con "
    "nosotros: escríbenos por aquí lo que necesites — dudas de la formación, "
    "de las clases o de tu cuenta. Te leemos todos los días. ¡Bienvenido/a!"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid(current_user) -> int:
    uid = getattr(current_user, "id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return int(uid)


async def _org(org_id: int, db_session: AsyncSession) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _default_org_id(user_id: int, db_session: AsyncSession) -> int:
    """La academia del usuario. En single-tenancy solo hay una."""
    org_id = (
        await db_session.execute(
            select(UserOrganization.org_id).where(UserOrganization.user_id == user_id)
        )
    ).scalars().first()
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization for this user")
    return int(org_id)


async def is_staff(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    uo = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    return bool(uo and uo.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS)


async def welcome_text(org_id: int, db_session: AsyncSession) -> str:
    row = (
        await db_session.execute(
            select(OrganizationConfig).where(OrganizationConfig.org_id == org_id)
        )
    ).scalars().first()
    if row and isinstance(row.config, dict):
        text = (row.config.get("direct_welcome") or {}).get("message")
        if isinstance(text, str) and text.strip():
            return text.strip()
    return DEFAULT_WELCOME


async def _user(user_id: Optional[int], db_session: AsyncSession) -> Optional[User]:
    if not user_id:
        return None
    return (
        await db_session.execute(select(User).where(User.id == user_id))
    ).scalars().first()


def _display_name(user: Optional[User]) -> str:
    if not user:
        return "Equipo Nawar"
    name = " ".join([p for p in [user.first_name, user.last_name] if p]).strip()
    return name or user.username or "Alumno/a"


async def get_or_create_thread(
    org_id: int, student_id: int, db_session: AsyncSession
) -> DirectThread:
    thread = (
        await db_session.execute(
            select(DirectThread).where(
                DirectThread.org_id == org_id,
                DirectThread.student_id == student_id,
            )
        )
    ).scalars().first()
    if thread:
        return thread

    now = _now()
    thread = DirectThread(
        org_id=org_id, student_id=student_id, created_at=now, last_message_at=now
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    # Bienvenida automática: la manda la academia, sin autor concreto.
    db_session.add(
        DirectMessage(
            thread_id=thread.id or 0,
            author_id=None,
            body=await welcome_text(org_id, db_session),
            created_at=now,
        )
    )
    await db_session.commit()
    return thread


async def _unread_for_student(thread: DirectThread, db_session: AsyncSession) -> int:
    """Mensajes del equipo que el alumno aún no ha visto."""
    rows = (
        await db_session.execute(
            select(DirectMessage).where(
                DirectMessage.thread_id == thread.id,
                DirectMessage.author_id != thread.student_id,
            )
        )
    ).scalars().all()
    last = thread.student_read_at or ""
    return sum(1 for m in rows if (m.created_at or "") > last)


async def _unread_for_staff(thread: DirectThread, db_session: AsyncSession) -> int:
    """Mensajes del alumno que el equipo aún no ha visto."""
    rows = (
        await db_session.execute(
            select(DirectMessage).where(
                DirectMessage.thread_id == thread.id,
                DirectMessage.author_id == thread.student_id,
            )
        )
    ).scalars().all()
    last = thread.staff_read_at or ""
    return sum(1 for m in rows if (m.created_at or "") > last)


async def _thread_row(
    thread: DirectThread, for_staff: bool, db_session: AsyncSession
) -> DirectThreadRead:
    student = await _user(thread.student_id, db_session)
    last = (
        await db_session.execute(
            select(DirectMessage)
            .where(DirectMessage.thread_id == thread.id)
            .order_by(DirectMessage.created_at.desc())  # type: ignore
            .limit(1)
        )
    ).scalars().first()

    preview = ""
    if last:
        preview = last.body.strip() or ("🎤 Nota de voz" if last.audio_file else "")
        if len(preview) > 90:
            preview = preview[:87].rstrip() + "…"

    return DirectThreadRead(
        id=thread.id or 0,
        student_id=thread.student_id,
        student_name=_display_name(student),
        student_avatar=(student.avatar_image or "") if student else "",
        last_message_at=thread.last_message_at or "",
        last_message_preview=preview,
        unread=(
            await _unread_for_staff(thread, db_session)
            if for_staff
            else await _unread_for_student(thread, db_session)
        ),
    )


async def list_threads(
    current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> List[DirectThreadRead]:
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)

    if not staff:
        thread = await get_or_create_thread(org_id, user_id, db_session)
        return [await _thread_row(thread, False, db_session)]

    threads = (
        await db_session.execute(
            select(DirectThread)
            .where(DirectThread.org_id == org_id)
            .order_by(DirectThread.last_message_at.desc())  # type: ignore
        )
    ).scalars().all()
    return [await _thread_row(t, True, db_session) for t in threads]


async def _thread_for_user(
    thread_id: Optional[int], user_id: int, org_id: int, staff: bool, db_session: AsyncSession
) -> DirectThread:
    """El hilo pedido, comprobando que quien pregunta puede verlo."""
    if thread_id is None:
        return await get_or_create_thread(org_id, user_id, db_session)

    thread = (
        await db_session.execute(select(DirectThread).where(DirectThread.id == thread_id))
    ).scalars().first()
    if not thread or thread.org_id != org_id:
        raise HTTPException(status_code=404, detail="Thread not found")
    if not staff and thread.student_id != user_id:
        raise HTTPException(status_code=403, detail="Not your conversation")
    return thread


async def get_thread(
    thread_id: Optional[int],
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> DirectThreadDetail:
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)

    # El equipo no tiene conversación propia: si pide "la mía", se le devuelve
    # la bandeja vacía. (Si no, se crearía un hilo del admin consigo mismo y
    # aparecería en su propia lista de alumnos.)
    if staff and thread_id is None:
        return DirectThreadDetail(
            thread=DirectThreadRead(id=0, student_id=0, student_name=""),
            messages=[],
            is_staff=True,
        )

    thread = await _thread_for_user(thread_id, user_id, org_id, staff, db_session)

    org = await _org(org_id, db_session)
    rows = (
        await db_session.execute(
            select(DirectMessage)
            .where(DirectMessage.thread_id == thread.id)
            .order_by(DirectMessage.created_at.asc())  # type: ignore
            .limit(300)
        )
    ).scalars().all()

    messages: List[DirectMessageRead] = []
    for m in rows:
        author = await _user(m.author_id, db_session)
        from_staff = m.author_id != thread.student_id
        audio_url = ""
        if m.audio_file:
            audio_url = f"/content/orgs/{org.org_uuid}/voice/{m.audio_file}"
        messages.append(
            DirectMessageRead(
                id=m.id or 0,
                body=m.body or "",
                audio_url=audio_url,
                audio_seconds=m.audio_seconds or 0,
                created_at=m.created_at or "",
                author_id=m.author_id,
                author_name=_display_name(author) if author else "Equipo Nawar",
                from_staff=from_staff,
            )
        )

    # Abrir el hilo cuenta como leerlo.
    if staff:
        thread.staff_read_at = _now()
    else:
        thread.student_read_at = _now()
    db_session.add(thread)
    await db_session.commit()

    return DirectThreadDetail(
        thread=await _thread_row(thread, staff, db_session),
        messages=messages,
        is_staff=staff,
    )


async def post_message(
    thread_id: Optional[int],
    body: str,
    audio: Optional[UploadFile],
    audio_seconds: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> DirectMessageRead:
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)
    thread = await _thread_for_user(thread_id, user_id, org_id, staff, db_session)

    text = (body or "").strip()
    audio_file = ""

    if audio is not None:
        audio_file = await _save_audio(audio, org_id, db_session)

    if not text and not audio_file:
        raise HTTPException(status_code=400, detail="Empty message")

    now = _now()
    message = DirectMessage(
        thread_id=thread.id or 0,
        author_id=user_id,
        body=text,
        audio_file=audio_file,
        audio_seconds=max(0, min(int(audio_seconds or 0), 60 * 10)),
        created_at=now,
    )
    db_session.add(message)

    thread.last_message_at = now
    # Quien escribe ya ha leído su propio mensaje.
    if staff:
        thread.staff_read_at = now
    else:
        thread.student_read_at = now
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(message)

    org = await _org(org_id, db_session)
    author = await _user(user_id, db_session)
    return DirectMessageRead(
        id=message.id or 0,
        body=message.body,
        audio_url=(
            f"/content/orgs/{org.org_uuid}/voice/{message.audio_file}"
            if message.audio_file
            else ""
        ),
        audio_seconds=message.audio_seconds,
        created_at=message.created_at,
        author_id=user_id,
        author_name=_display_name(author),
        from_staff=staff,
    )


async def _save_audio(audio: UploadFile, org_id: int, db_session: AsyncSession) -> str:
    """Guarda la nota de voz en el volumen de contenidos y devuelve el nombre."""
    from uuid import uuid4

    from src.services.utils.upload_content import upload_content

    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="La nota de voz es demasiado larga")

    ext = (audio.filename or "nota.webm").rsplit(".", 1)[-1].lower()
    if ext not in AUDIO_FORMATS:
        ext = "webm"

    org = await _org(org_id, db_session)
    filename = f"{uuid4()}.{ext}"
    await upload_content(
        directory="voice",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        file_binary=raw,
        file_and_format=filename,
        allowed_formats=list(AUDIO_FORMATS),
    )
    return filename


async def mark_read(
    thread_id: int, current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> dict:
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)
    thread = await _thread_for_user(thread_id, user_id, org_id, staff, db_session)

    now = _now()
    if staff:
        thread.staff_read_at = now
    else:
        thread.student_read_at = now
    db_session.add(thread)
    await db_session.commit()
    return {"read_at": now}


async def unread_total(
    current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> dict:
    """Lo que enciende el sobre del menú. También crea el hilo del alumno la
    primera vez, así la bienvenida le está esperando sin tener que entrar."""
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)

    if not staff:
        thread = await get_or_create_thread(org_id, user_id, db_session)
        return {"unread": await _unread_for_student(thread, db_session)}

    threads = (
        await db_session.execute(
            select(DirectThread).where(DirectThread.org_id == org_id)
        )
    ).scalars().all()
    total = 0
    for t in threads:
        total += await _unread_for_staff(t, db_session)
    return {"unread": total, "threads": len(threads)}

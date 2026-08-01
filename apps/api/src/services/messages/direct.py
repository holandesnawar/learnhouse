"""
Mensajes directos alumno ↔ equipo.

Reglas del sitio:
- Por defecto el alumno escribe "al equipo": ese hilo lo ve cualquier moderador.
  Es lo que sale sin tener que elegir nada.
- Si quiere, puede buscar a un moderador concreto y abrir una conversación con
  él. Esa la ven esa persona y los administradores (que mandan en la academia).
- El equipo ve su bandeja y puede buscar a cualquier alumno para escribirle
  primero.
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
    DirectoryEntry,
)
from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.security.rbac.constants import ADMIN_ROLE_ID, ADMIN_OR_MAINTAINER_ROLE_IDS

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


async def is_admin_user(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    """Los administradores ven todas las conversaciones; los moderadores, las suyas."""
    uo = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    return bool(uo and uo.role_id == ADMIN_ROLE_ID)


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


def _avatar_path(user: Optional[User]) -> str:
    """
    La foto que el usuario tenga puesta en su cuenta de la plataforma.

    Puede ser un fichero subido (vive en content/users/…) o una dirección
    completa si entró con Google y compañía: en ese caso se devuelve tal cual.
    """
    if not user or not user.avatar_image:
        return ""
    avatar = user.avatar_image
    if avatar.startswith("http://") or avatar.startswith("https://"):
        return avatar
    if not user.user_uuid:
        return ""
    return f"/content/users/{user.user_uuid}/avatars/{avatar}"


async def staff_titles(org_id: int, db_session: AsyncSession) -> dict:
    """{id_de_usuario_en_texto: "Director Académico"} — lo pone el admin."""
    row = (
        await db_session.execute(
            select(OrganizationConfig).where(OrganizationConfig.org_id == org_id)
        )
    ).scalars().first()
    if row and isinstance(row.config, dict):
        titles = (row.config.get("staff_titles") or {}).get("titles")
        if isinstance(titles, dict):
            return titles
    return {}


def _title_of(user: Optional[User], titles: dict) -> str:
    if not user or not user.id:
        return ""
    return str(titles.get(str(user.id), "")).strip()


async def _org_admin(org_id: int, db_session: AsyncSession) -> Optional[User]:
    """
    La cuenta administradora de la academia (la de "Nawar").

    Es quien figura como autor de los mensajes automáticos: así el nombre y la
    foto salen de una cuenta de verdad de la plataforma, y cambian solos cuando
    se cambia el perfil, en vez de estar escritos a mano en el código.
    """
    return (
        await db_session.execute(
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == ADMIN_ROLE_ID,
            )
            .order_by(User.id.asc())  # type: ignore
            .limit(1)
        )
    ).scalars().first()


async def _org_logo(org_id: int, db_session: AsyncSession) -> str:
    """El logo de la academia: es la cara de los mensajes automáticos."""
    org = await _org(org_id, db_session)
    if not org.logo_image:
        return ""
    return f"/content/orgs/{org.org_uuid}/logos/{org.logo_image}"


def _display_name(user: Optional[User]) -> str:
    if not user:
        return "Equipo Nawar"
    name = " ".join([p for p in [user.first_name, user.last_name] if p]).strip()
    return name or user.username or "Alumno/a"


async def get_or_create_thread(
    org_id: int,
    student_id: int,
    db_session: AsyncSession,
    staff_id: Optional[int] = None,
) -> DirectThread:
    """El hilo del alumno con el equipo (staff_id vacío) o con una persona."""
    statement = select(DirectThread).where(
        DirectThread.org_id == org_id,
        DirectThread.student_id == student_id,
    )
    statement = (
        statement.where(DirectThread.staff_id == staff_id)
        if staff_id
        else statement.where(DirectThread.staff_id.is_(None))  # type: ignore
    )
    thread = (await db_session.execute(statement)).scalars().first()
    if thread:
        return thread

    now = _now()
    thread = DirectThread(
        org_id=org_id,
        student_id=student_id,
        staff_id=staff_id,
        created_at=now,
        last_message_at=now,
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    # La bienvenida automática es cosa del hilo "con el equipo": en una
    # conversación con una persona concreta pintaría raro.
    if staff_id is None:
        admin = await _org_admin(org_id, db_session)
        db_session.add(
            DirectMessage(
                thread_id=thread.id or 0,
                # Firmado por la cuenta admin de la academia: el alumno ve su
                # nombre y su foto, no un remitente fantasma.
                author_id=admin.id if admin else None,
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
                # OJO: en SQL `author_id != X` deja fuera las filas con
                # author_id NULL, y la bienvenida automática no tiene autor.
                # Sin este OR, el mensaje de bienvenida no encendía el sobre.
                (DirectMessage.author_id.is_(None))  # type: ignore
                | (DirectMessage.author_id != thread.student_id),
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
    titles = await staff_titles(thread.org_id, db_session)
    student = await _user(thread.student_id, db_session)
    staff = await _user(thread.staff_id, db_session) if thread.staff_id else None
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

    # El título es "con quién hablo yo": el equipo ve el nombre del alumno; el
    # alumno ve "Equipo Nawar" o el nombre del moderador que eligió.
    # Con quién habla el alumno cuando el hilo es "con el equipo": la cuenta
    # admin de la academia, con su nombre y su foto de la plataforma.
    team = None if staff else await _org_admin(thread.org_id, db_session)
    staff_name = _display_name(staff) if staff else (_display_name(team) if team else "Equipo Nawar")
    title = _display_name(student) if for_staff else staff_name
    if for_staff:
        title_avatar = _avatar_path(student)
    elif staff:
        title_avatar = _avatar_path(staff)
    else:
        title_avatar = _avatar_path(team) or await _org_logo(thread.org_id, db_session)

    # El alumno ve el cargo de quien le atiende; el equipo no necesita cargo del
    # alumno.
    title_role = "" if for_staff else _title_of(staff or team, titles)

    return DirectThreadRead(
        id=thread.id or 0,
        student_id=thread.student_id,
        student_name=_display_name(student),
        student_avatar=_avatar_path(student),
        last_message_at=thread.last_message_at or "",
        last_message_preview=preview,
        unread=(
            await _unread_for_staff(thread, db_session)
            if for_staff
            else await _unread_for_student(thread, db_session)
        ),
        title=title,
        title_avatar=title_avatar,
        title_role=title_role,
        staff_id=thread.staff_id,
        staff_name=staff_name,
    )


async def list_threads(
    current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> List[DirectThreadRead]:
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)

    if not staff:
        # El de "con el equipo" siempre existe; detrás van los que haya abierto
        # con moderadores concretos.
        await get_or_create_thread(org_id, user_id, db_session)
        mine = (
            await db_session.execute(
                select(DirectThread)
                .where(
                    DirectThread.org_id == org_id,
                    DirectThread.student_id == user_id,
                )
                .order_by(DirectThread.last_message_at.desc())  # type: ignore
            )
        ).scalars().all()
        return [await _thread_row(t, False, db_session) for t in mine]

    admin = await is_admin_user(user_id, org_id, db_session)
    statement = select(DirectThread).where(DirectThread.org_id == org_id)
    if not admin:
        # Un moderador ve lo del equipo y lo suyo, no las conversaciones
        # privadas de otro moderador.
        statement = statement.where(
            (DirectThread.staff_id.is_(None)) | (DirectThread.staff_id == user_id)  # type: ignore
        )
    threads = (
        await db_session.execute(
            statement.order_by(DirectThread.last_message_at.desc())  # type: ignore
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

    if not staff:
        if thread.student_id != user_id:
            raise HTTPException(status_code=403, detail="Not your conversation")
        return thread

    # Del equipo: los hilos con el equipo son de todos; los privados, de su
    # dueño (y de los administradores).
    if thread.staff_id and thread.staff_id != user_id:
        if not await is_admin_user(user_id, org_id, db_session):
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

    # Identidad de respaldo para los mensajes automáticos antiguos (los que se
    # guardaron sin autor): la cuenta admin de la academia. Se pide una sola vez.
    fallback = await _org_admin(org_id, db_session)
    fallback_name = _display_name(fallback) if fallback else "Equipo Nawar"
    fallback_avatar = _avatar_path(fallback) or await _org_logo(org_id, db_session)
    titles = await staff_titles(org_id, db_session)
    fallback_title = _title_of(fallback, titles)

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
                author_name=_display_name(author) if author else fallback_name,
                author_avatar=(
                    _avatar_path(author)
                    if author
                    else (fallback_avatar if from_staff else "")
                ),
                # El cargo solo tiene sentido en quien atiende, no en el alumno.
                author_title=(
                    _title_of(author, titles) if author else (fallback_title if from_staff else "")
                )
                if from_staff
                else "",
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
        author_avatar=_avatar_path(author),
        author_title=(
            _title_of(author, await staff_titles(org_id, db_session)) if staff else ""
        ),
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


####################################################
# Buscador de personas y apertura de conversaciones
####################################################


async def directory(
    q: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    limit: int = 30,
    scope: str = "auto",
) -> List[DirectoryEntry]:
    """
    A quién le puedo escribir.

    - Alumno → los moderadores y administradores de la academia.
    - Equipo → los alumnos.

    Con ``scope="team"`` se pide el equipo explícitamente: lo usa el admin para
    repartir los cargos ("Director Académico") desde su pantalla de mensajes.

    El texto de búsqueda casa con el nombre, el usuario o el correo.
    """
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)
    titles = await staff_titles(org_id, db_session)
    # Quiero ver al equipo (en vez de "lo contrario a lo que soy").
    want_team = scope == "team" or not staff

    rows = (
        await db_session.execute(
            select(User, UserOrganization.role_id)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(UserOrganization.org_id == org_id)
        )
    ).all()

    needle = (q or "").strip().lower()
    out: List[DirectoryEntry] = []

    for user, role_id in rows:
        if user.id == user_id:
            continue
        is_team = role_id in ADMIN_OR_MAINTAINER_ROLE_IDS
        if want_team != is_team:
            continue

        name = _display_name(user)
        haystack = " ".join(
            [name, user.username or "", user.email or ""]
        ).lower()
        if needle and needle not in haystack:
            continue

        # ¿Ya hay conversación abierta con esta persona?
        thread = None
        if staff and want_team:
            # El equipo mirando al equipo (repartir cargos): aquí no hay
            # conversación que buscar.
            pass
        elif staff:
            thread = (
                await db_session.execute(
                    select(DirectThread).where(
                        DirectThread.org_id == org_id,
                        DirectThread.student_id == user.id,
                        DirectThread.staff_id.is_(None),  # type: ignore
                    )
                )
            ).scalars().first()
        else:
            thread = (
                await db_session.execute(
                    select(DirectThread).where(
                        DirectThread.org_id == org_id,
                        DirectThread.student_id == user_id,
                        DirectThread.staff_id == user.id,
                    )
                )
            ).scalars().first()

        out.append(
            DirectoryEntry(
                user_id=user.id or 0,
                name=name,
                # El correo solo lo ve el equipo: un alumno no tiene por qué ver
                # el de nadie.
                email=(user.email or "") if staff else "",
                avatar=_avatar_path(user),
                role=_title_of(user, titles) or ("Equipo" if is_team else "Alumno/a"),
                thread_id=thread.id if thread else None,
            )
        )

    out.sort(key=lambda e: e.name.lower())
    return out[:limit]


async def open_thread_with(
    peer_id: int, current_user: PublicUser | AnonymousUser, db_session: AsyncSession
) -> DirectThreadDetail:
    """Abre (o recupera) la conversación con esa persona y la devuelve entera."""
    user_id = _uid(current_user)
    org_id = await _default_org_id(user_id, db_session)
    staff = await is_staff(user_id, org_id, db_session)

    peer_role = (
        await db_session.execute(
            select(UserOrganization.role_id).where(
                UserOrganization.user_id == peer_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    if peer_role is None:
        raise HTTPException(status_code=404, detail="Esa persona no está en la academia")

    peer_is_team = peer_role in ADMIN_OR_MAINTAINER_ROLE_IDS

    if staff:
        if peer_is_team:
            raise HTTPException(
                status_code=400, detail="Los mensajes directos son con alumnos"
            )
        # El equipo escribe al alumno por su hilo de siempre, el compartido: así
        # el alumno no acumula conversaciones sueltas por cada moderador.
        thread = await get_or_create_thread(org_id, peer_id, db_session)
    else:
        if not peer_is_team:
            raise HTTPException(
                status_code=400, detail="Solo puedes escribir al equipo de la academia"
            )
        thread = await get_or_create_thread(org_id, user_id, db_session, staff_id=peer_id)

    return await get_thread(thread.id, current_user, db_session)

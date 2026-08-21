"""
Los dos grupos de la escuela: **Alumnos** y **Profes**.

Por qué existen
---------------
LearnHouse ya trae grupos de usuarios (sirven para abrir contenido a unos sí y
a otros no). Aquí se les da un uso fijo:

- **Alumnos** — entra todo el que se da de alta, sin que nadie tenga que
  acordarse. Es la lista de "quién está estudiando" y el sitio donde mañana se
  cuelga el contenido de un curso concreto.
- **Profes** — el grupo que **da permisos**. Meter a alguien ahí le convierte
  en profe (rol `PROFE_ROLE_ID`); sacarlo le devuelve a alumno.

Por qué el grupo cambia el rol, y no solo el grupo
--------------------------------------------------
Los permisos de verdad (quién entra al panel, quién ve la lista de alumnos,
quién borra un mensaje) los decide el **rol** de la persona en la escuela: es
lo que mira `rbac_check` en toda la plataforma. Si "Profes" fuera solo una
etiqueta, habría que acordarse de mirarla en veinte sitios y el día que se
olvidara uno sería un agujero.

Así que el grupo es el interruptor visible y el rol es el cableado: se ponen y
se quitan juntos, desde un único sitio (este fichero).

Todo lo de aquí es **idempotente** y **best-effort**: si algo falla, se apunta
en el registro pero nunca tumba un alta ni un cobro.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.user_organizations import UserOrganization
from src.security.rbac.constants import PROFE_ROLE_ID, STUDENT_ROLE_ID

logger = logging.getLogger(__name__)

STUDENTS_GROUP_NAME = "Alumnos"
TEACHERS_GROUP_NAME = "Profes"

_DESCRIPTIONS = {
    STUDENTS_GROUP_NAME: "Todo el que se da de alta en la escuela entra aquí solo.",
    TEACHERS_GROUP_NAME: (
        "El equipo docente. Quien está en este grupo atiende mensajes, "
        "modera la comunidad y ve las fichas de los alumnos."
    ),
}


async def _find_group(org_id: int, name: str, db_session: AsyncSession) -> Optional[UserGroup]:
    return (
        await db_session.execute(
            select(UserGroup).where(UserGroup.org_id == org_id, UserGroup.name == name)
        )
    ).scalars().first()


async def _get_or_create_group(org_id: int, name: str, db_session: AsyncSession) -> UserGroup:
    group = await _find_group(org_id, name, db_session)
    if group:
        return group

    now = str(datetime.now())
    group = UserGroup(
        name=name,
        description=_DESCRIPTIONS.get(name, ""),
        org_id=org_id,
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    logger.info("Grupo '%s' creado en la escuela %s", name, org_id)
    return group


async def ensure_default_groups(org_id: int, db_session: AsyncSession) -> dict:
    """Deja creados los dos grupos. Se puede llamar tantas veces como se quiera."""
    students = await _get_or_create_group(org_id, STUDENTS_GROUP_NAME, db_session)
    teachers = await _get_or_create_group(org_id, TEACHERS_GROUP_NAME, db_session)
    return {"students": students, "teachers": teachers}


async def _link_exists(usergroup_id: int, user_id: int, db_session: AsyncSession) -> bool:
    return bool(
        (
            await db_session.execute(
                select(UserGroupUser).where(
                    UserGroupUser.usergroup_id == usergroup_id,
                    UserGroupUser.user_id == user_id,
                )
            )
        ).scalars().first()
    )


async def add_user_to_students(user_id: int, org_id: int, db_session: AsyncSession) -> None:
    """
    Mete al alumno recién dado de alta en el grupo "Alumnos" y dispara las
    automatizaciones de "cuando alguien entra en la escuela".

    Las dos cosas juntas y en un solo sitio a propósito: hay cinco puertas de
    entrada (alta normal, invitación, enlace abierto, pago con cuenta nueva y
    pago con cuenta que ya existía) y separarlas sería garantizar que un día se
    olvida una.

    Best-effort de arriba abajo: ni el alta ni el cobro pueden fallar porque un
    grupo o un correo den problemas.
    """
    # ¿Es nuevo de verdad, o ya estaba? De esto depende que se le dé otra vez
    # la bienvenida: quien ya está en el grupo no vuelve a "entrar".
    is_new = False
    try:
        groups = await ensure_default_groups(org_id, db_session)
        students = groups["students"]
        if students.id is not None and not await _link_exists(students.id, user_id, db_session):
            now = str(datetime.now())
            db_session.add(
                UserGroupUser(
                    usergroup_id=students.id,
                    user_id=user_id,
                    org_id=org_id,
                    creation_date=now,
                    update_date=now,
                )
            )
            await db_session.commit()
            is_new = True
            logger.info("Alumno %s añadido al grupo Alumnos", user_id)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo meter al usuario %s en el grupo Alumnos", user_id)

    if not is_new:
        return

    # Su conversación con el equipo, con la bienvenida dentro, se crea AHORA —
    # al nacer la cuenta. Antes nacía la primera vez que el alumno miraba sus
    # mensajes, y eso tenía dos pegas: el sobre no se encendía hasta entonces
    # (así que la bienvenida no se veía), y desde el panel no aparecía en la
    # bandeja hasta que el alumno entrase por su cuenta.
    try:
        from src.services.messages.direct import get_or_create_thread

        await get_or_create_thread(org_id, user_id, db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo crear la conversación de bienvenida de %s", user_id)

    # Y lo que el admin haya montado para este momento. Fuera del try de
    # arriba: un correo mal puesto no puede tumbar un alta ni un cobro (dentro
    # ya se traga sus propios errores).
    from src.services.automations.engine import run_trigger

    await run_trigger("student_joined", org_id, user_id, db_session)


async def _set_role(user_id: int, org_id: int, role_id: int, db_session: AsyncSession) -> bool:
    link = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    if not link or link.role_id == role_id:
        return False
    link.role_id = role_id
    db_session.add(link)
    await db_session.commit()
    return True


async def sync_roles_for_group(
    usergroup_id: int, user_ids: list[int], db_session: AsyncSession, *, joining: bool
) -> None:
    """
    Si el grupo tocado es "Profes", pone o quita el rol de profe.

    Los administradores no se tocan nunca: meter a la dueña de la escuela en
    "Profes" para que salga en la lista no puede degradarla a profe, y sacarla
    tampoco puede dejarla como alumna.
    """
    try:
        group = (
            await db_session.execute(select(UserGroup).where(UserGroup.id == usergroup_id))
        ).scalars().first()
        if not group or group.name != TEACHERS_GROUP_NAME:
            return

        for user_id in user_ids:
            link = (
                await db_session.execute(
                    select(UserOrganization).where(
                        UserOrganization.user_id == user_id,
                        UserOrganization.org_id == group.org_id,
                    )
                )
            ).scalars().first()
            if not link:
                continue
            # Un administrador o un moderador sigue siéndolo.
            if link.role_id in (1, 2):
                continue
            target = PROFE_ROLE_ID if joining else STUDENT_ROLE_ID
            if await _set_role(user_id, group.org_id, target, db_session):
                logger.info(
                    "Usuario %s pasa a rol %s por el grupo Profes", user_id, target
                )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron ajustar los roles del grupo %s", usergroup_id)

"""Lock-based access checks for chapters and activities.

Mirrors the Playground access-type pattern but keyed on chapter_uuid /
activity_uuid in ``usergroupresource``. Lock tiers:

- ``public``:        anyone, including anonymous, can read
- ``authenticated``: must be signed in
- ``restricted``:    must be in an assigned usergroup (or an org admin)

Batch helpers are provided for TOC-style reads where many resources need
to be checked at once without N+1 queries.
"""

from datetime import datetime, timedelta
from typing import Iterable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS


async def is_org_admin(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    """True if user is admin/maintainer on this org (bypasses all locks)."""
    uo = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id,
        )
    )).scalars().first()
    return bool(uo and uo.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS)


async def batch_accessible_restricted_uuids(
    user_id: int,
    resource_uuids: Iterable[str],
    db_session: AsyncSession,
) -> set[str]:
    """Return the subset of resource_uuids the user can access via usergroup."""
    uuids = [u for u in resource_uuids if u]
    if not uuids:
        return set()

    ugrs = (await db_session.execute(
        select(
            UserGroupResource.resource_uuid,
            UserGroupResource.usergroup_id,
        ).where(UserGroupResource.resource_uuid.in_(uuids))
    )).all()
    if not ugrs:
        return set()

    ug_ids = list({row[1] for row in ugrs})
    member_ug_ids = set(
        (await db_session.execute(
            select(UserGroupUser.usergroup_id).where(
                UserGroupUser.usergroup_id.in_(ug_ids),
                UserGroupUser.user_id == user_id,
            )
        )).scalars().all()
    )
    return {resource_uuid for resource_uuid, ug_id in ugrs if ug_id in member_ug_ids}


# ---------------------------------------------------------------------------
# Drip content (time-based unlocking)
#
# A chapter can be configured to unlock a number of days AFTER each student's
# enrollment date (the date they joined the org). Settings live in
# OrganizationConfig.config["drip_content"]:
#
#     {"enabled": true, "chapters": {"<chapter_uuid>": <day_offset:int>}}
#
# A day_offset of 0 (or a chapter absent from the map) means "open from day 1".
# This is an independent axis from the usergroup lock_type system above.
# ---------------------------------------------------------------------------


async def get_drip_settings(org_id: int, db_session: AsyncSession) -> dict:
    """Read drip-content settings from org config. Returns {} when disabled/absent."""
    row = (await db_session.execute(
        select(OrganizationConfig).where(OrganizationConfig.org_id == org_id)
    )).scalars().first()
    if not row or not isinstance(row.config, dict):
        return {}
    drip = row.config.get("drip_content") or {}
    if not isinstance(drip, dict) or not drip.get("enabled"):
        return {}
    return drip


def _parse_dt(value) -> "datetime | None":
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


async def drip_locked_chapters(
    chapter_uuids: Iterable[str],
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
    *,
    drip: dict | None = None,
    is_admin: bool = False,
) -> dict[str, str]:
    """Map ``{chapter_uuid: unlock_date_iso}`` for chapters still locked by drip.

    A chapter absent from the returned map is NOT drip-locked for this user.
    Admins and chapters with offset <= 0 are never drip-locked. When the
    enrollment date can't be resolved we fail OPEN (no drip lock) so paying
    students never get accidentally shut out.
    """
    if is_admin:
        return {}
    settings = drip if drip is not None else await get_drip_settings(org_id, db_session)
    if not settings:
        return {}
    offsets = settings.get("chapters") or {}
    # Fecha fija: `{chapter_uuid: "2026-09-15"}`.
    #
    # Existe porque una cohorte que empieza junta no se gobierna bien con "a los
    # X días de tu alta": el que pagó el martes y el que pagó el viernes abren el
    # módulo 2 en días distintos, y entonces la clase en vivo del jueves va sobre
    # algo que la mitad todavía no puede ver. Con fecha fija, el módulo abre para
    # todos a la vez y la clase semanal cuadra con el contenido.
    #
    # Manda sobre los días: poner una fecha es una decisión explícita para esta
    # convocatoria; el desfase por alta es el comportamiento por defecto.
    fechas = settings.get("fechas") or {}
    if not isinstance(offsets, dict):
        offsets = {}
    if not isinstance(fechas, dict):
        fechas = {}
    if not offsets and not fechas:
        return {}

    if isinstance(current_user, AnonymousUser):
        return {}

    now = datetime.now()
    locked: dict[str, str] = {}

    # Las fechas fijas se resuelven ANTES de mirar el alta, porque no la
    # necesitan: si el alta no se puede leer, el desfase por días falla abierto
    # pero la fecha de la cohorte sigue siendo válida.
    pendientes: list[str] = []
    for cu in chapter_uuids:
        if not cu:
            continue
        fecha = _parse_dt(str(fechas.get(cu) or "")) if fechas.get(cu) else None
        if fecha is not None:
            if now < fecha:
                locked[cu] = fecha.isoformat()
            continue
        pendientes.append(cu)

    if not pendientes or not offsets:
        return locked

    # Enrollment date = when the user joined this org.
    acting_user_id = resolve_acting_user_id(current_user)
    uo = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == acting_user_id,
            UserOrganization.org_id == org_id,
        )
    )).scalars().first()
    enrolled_at = _parse_dt(uo.creation_date) if uo else None
    if enrolled_at is None:
        return locked  # fail open para el desfase; las fechas fijas se quedan

    for cu in pendientes:
        try:
            offset = int(offsets.get(cu, 0) or 0)
        except (ValueError, TypeError):
            offset = 0
        if offset <= 0:
            continue
        unlock_at = enrolled_at + timedelta(days=offset)
        if now < unlock_at:
            locked[cu] = unlock_at.isoformat()
    return locked


async def is_locked_for_user(
    lock_type: str | None,
    resource_uuid: str,
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
    *,
    accessible_restricted_uuids: set[str] | None = None,
    is_admin: bool | None = None,
) -> bool:
    """True if the resource should be hidden from current_user.

    ``accessible_restricted_uuids`` and ``is_admin`` are pre-computed escape
    hatches for batch callers -- they avoid repeating the same queries for
    every row. When absent, this function resolves them on its own.
    """
    lt = (lock_type or "public").lower()
    if lt == "public":
        return False

    is_anon = isinstance(current_user, AnonymousUser)
    if lt == "authenticated":
        return is_anon

    if lt != "restricted":
        # Unknown value -- fail safe (treat as public to avoid accidentally
        # locking people out after a rename/migration mishap).
        return False

    if is_anon:
        return True

    acting_user_id = resolve_acting_user_id(current_user)
    admin = is_admin if is_admin is not None else await is_org_admin(acting_user_id, org_id, db_session)
    if admin:
        return False

    if accessible_restricted_uuids is not None:
        return resource_uuid not in accessible_restricted_uuids

    accessible = await batch_accessible_restricted_uuids(
        acting_user_id, [resource_uuid], db_session
    )
    return resource_uuid not in accessible

"""
Superadmin tools — endpoints that need to run in production but are restricted
to platform superadmins. Mounted without the development-mode guard.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from src.db.users import PublicUser
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.security.auth import get_authenticated_user

logger = logging.getLogger(__name__)


router = APIRouter()


def _require_superadmin(current_user: PublicUser):
    if not hasattr(current_user, "is_superadmin") or not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin access required")


@router.get(
    "/email-test/all",
    summary="Send the four sample automation emails to an address.",
    description=(
        "Renders fake-data versions of each automation email (weekly digest, "
        "module unlocked, announcement, consulta answered) and sends them to "
        "the provided address so the design and copy can be reviewed in a real "
        "inbox. Superadmin only."
    ),
    responses={
        200: {"description": "Emails dispatched"},
        401: {"description": "Authentication required"},
        403: {"description": "Superadmin access required"},
    },
)
async def email_test_all(
    to: str,
    name: str = "Juan",
    current_user: PublicUser = Depends(get_authenticated_user),
):
    _require_superadmin(current_user)

    from src.services.users.emails import (
        send_weekly_digest_email,
        send_module_unlocked_email,
        send_announcement_email,
        send_consulta_answered_email,
    )

    sent: list[str] = []
    failures: dict[str, str] = {}

    for name_key, fn in [
        ("weekly_digest", lambda: send_weekly_digest_email(to, name)),
        ("module_unlocked", lambda: send_module_unlocked_email(to, name)),
        ("announcement", lambda: send_announcement_email(to, name)),
        ("consulta_answered", lambda: send_consulta_answered_email(to, name)),
    ]:
        try:
            fn()
            sent.append(name_key)
        except Exception as exc:  # noqa: BLE001 — we want to keep trying the rest
            logger.exception("%s test email failed: %s", name_key, exc)
            failures[name_key] = str(exc)

    return {
        "detail": f"Sent {len(sent)} of 4 test emails to {to}",
        "templates": sent,
        **({"failures": failures} if failures else {}),
    }


@router.get(
    "/demo-student",
    summary="Crear o reiniciar la cuenta de demostración.",
    description=(
        "Deja lista una cuenta de alumno de ejemplo (con racha, lecciones "
        "terminadas y notas) para enseñar la escuela sin dar acceso real. "
        "Se puede llamar las veces que haga falta: reinicia esa cuenta y no "
        "toca a ningún alumno de verdad. Solo superadmin."
    ),
)
async def demo_student(
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _require_superadmin(current_user)
    from src.services.demo.demo_student import seed_demo_student

    return await seed_demo_student(db_session)


@router.get(
    "/email-templates",
    summary="Lista de correos automáticos de la escuela.",
)
async def email_templates(
    current_user: PublicUser = Depends(get_authenticated_user),
):
    _require_superadmin(current_user)
    from src.services.demo.email_catalog import list_templates

    return list_templates()


@router.get(
    "/email-templates/{template_id}/preview",
    summary="Ver un correo automático con datos de ejemplo (no lo envía).",
)
async def email_template_preview(
    template_id: str,
    name: str = "María",
    current_user: PublicUser = Depends(get_authenticated_user),
):
    _require_superadmin(current_user)
    from src.services.demo.email_catalog import render_template

    try:
        return render_template(template_id, name)
    except KeyError:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post(
    "/email-templates/{template_id}/send-test",
    summary="Enviarse a uno mismo un correo automático para verlo en la bandeja.",
)
async def email_template_send_test(
    template_id: str,
    current_user: PublicUser = Depends(get_authenticated_user),
):
    _require_superadmin(current_user)
    from src.services.demo.email_catalog import send_template_test

    to = getattr(current_user, "email", None)
    if not to:
        raise HTTPException(status_code=400, detail="No email on the current user")
    try:
        send_template_test(template_id, to, getattr(current_user, "first_name", None) or "María")
    except KeyError:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"sent_to": to}


@router.get(
    "/seed/community/{org_id}",
    summary="¿Qué cuentas de arranque existen ya?",
)
async def api_seed_status(
    org_id: int,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _require_superadmin(current_user)
    from src.services.demo.seed_community import seed_status

    return await seed_status(org_id, db_session)


@router.post(
    "/seed/community/{org_id}/{community_id}",
    summary="Crea las cuentas de arranque y publica sus presentaciones en un canal.",
    description=(
        "Para que los primeros alumnos no entren en una comunidad vacía. Se "
        "puede repetir: lo que ya existe no se duplica. No manda correos ni "
        "permite entrar con esas cuentas."
    ),
)
async def api_seed_community(
    org_id: int,
    community_id: int,
    extras: bool = True,
    keys: str = "",
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _require_superadmin(current_user)
    from src.services.demo.seed_community import seed_community

    # `keys=marta,diego` publica solo a esas. Vacío = todas.
    chosen = [k.strip() for k in keys.split(",") if k.strip()] or None
    try:
        return await seed_community(
            org_id, community_id, db_session, include_extras=extras, keys=chosen
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete(
    "/seed/community/{org_id}/persona/{key}",
    summary="Retira a una persona de arranque: sus mensajes y su cuenta.",
)
async def api_remove_seed_persona(
    org_id: int,
    key: str,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _require_superadmin(current_user)
    from src.services.demo.seed_community import remove_seed_persona

    try:
        return await remove_seed_persona(org_id, key, db_session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


"""
Superadmin tools — endpoints that need to run in production but are restricted
to platform superadmins. Mounted without the development-mode guard.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from src.db.users import PublicUser
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

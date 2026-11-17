"""Volver a dar a un alumno su enlace de «crear contraseña» (17/11/2026).

Pedido del usuario: «poder reenviar el link de crear contraseña manualmente a x
alumnos, por ejemplo entró una nueva pero le caducó el link… no lo podemos
hacer nosotros algo manual, así no le pido a este alumno».

Es el MISMO enlace que el del correo de bienvenida tras pagar
(`/auth/crear-cuenta?email=…&resetCode=…`, 7 días): un código nuevo guardado en
Redis con las dos claves (`payments._store_reset_code`). Vale igual para quien
nunca puso contraseña y para quien ya tenía cuenta y la ha olvidado: la
pantalla pone la contraseña que escriba y entra sola.

Solo para cuentas de ESTA escuela. El enlace se devuelve SIEMPRE, para poder
mandarlo por WhatsApp si el correo no llega; con `enviar=True` sale además el
correo de bienvenida de siempre. Si el correo no sale, se dice por qué (no se
traga el error: la lección de la noche de las facturas).
"""

from __future__ import annotations

import logging
from urllib.parse import quote

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import User

logger = logging.getLogger(__name__)


async def dar_enlace(org_id: int, user_id: int, enviar: bool, db_session: AsyncSession) -> dict:
    from src.services.email.utils import en_hilo
    from src.services.payments.payments import _academy_url, _store_reset_code
    from src.services.users.emails import send_payment_welcome_email

    user = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if user is None:
        raise ValueError("No existe esa cuenta")
    es_de_aqui = (
        await db_session.execute(
            select(UserOrganization.id).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).first()
    if not es_de_aqui:
        raise ValueError("Esa cuenta no es de esta escuela")
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()

    code = _store_reset_code(user, (org.org_uuid if org else "") or "")
    if not code:
        return {
            "ok": False,
            "enlace": "",
            "correo_enviado": False,
            "motivo": "No se pudo guardar el código (Redis no responde). Que entre en /login y pulse «¿Olvidaste tu contraseña?».",
        }
    email = (user.email or "").strip().lower()
    enlace = f"{_academy_url()}/auth/crear-cuenta?email={quote(email)}&resetCode={code}"
    enviado, motivo = False, ""
    if enviar:
        try:
            await en_hilo(
                send_payment_welcome_email,
                email=email,
                name=user.first_name or "",
                reset_code=code,
                base_url=_academy_url(),
            )
            enviado = True
        except Exception as exc:  # noqa: BLE001
            logger.exception("Enlace de contraseña: el correo no salió para la cuenta %s", user_id)
            motivo = f"{type(exc).__name__}: {exc}"
    return {
        "ok": True,
        "email": email,
        "nombre": f"{user.first_name or ''} {user.last_name or ''}".strip(),
        "enlace": enlace,
        "dias": 7,
        "correo_enviado": enviado,
        "motivo": motivo,
    }

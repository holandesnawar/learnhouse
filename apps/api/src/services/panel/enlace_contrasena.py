"""Volver a dar a un alumno su enlace de «crear contraseña» (17/11/2026).

Pedido del usuario: «poder reenviar el link de crear contraseña manualmente a x
alumnos, por ejemplo entró una nueva pero le caducó el link… no lo podemos
hacer nosotros algo manual, así no le pido a este alumno».

Es el MISMO enlace que el del correo de bienvenida tras pagar
(`/auth/crear-cuenta?email=…&resetCode=…`, 15 días): un código nuevo guardado en
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
import re
from datetime import datetime
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
        "dias": 15,
        "correo_enviado": enviado,
        "motivo": motivo,
    }


# ── Cambiar el correo con el que entra (18/11/2026) ─────────────────────────
#
# Usuario: «entró una alumna nueva y hay que cambiarle el mail de acceso, pero
# ya creó cuenta… poder editar el mail con el que entran, solo admin».
#
# Solo cambia el correo de la CUENTA (con el que entra y al que le llegan los
# correos de la escuela). Su contraseña, sus clases, su progreso y sus grupos
# no se tocan: van por el id de la cuenta, no por el correo.
#
# Lo que NO se toca, a propósito: el pago (la matrícula y la factura de Stripe
# guardan el correo con el que pagó) y la ficha de Contactos (las notas, las
# llamadas y lo que hizo en la web van por ese correo de antes). Mover el pago
# al correo nuevo dejaría la ficha vieja sin «pagó» y volvería a salir como
# lead para llamar en Matrículas. Por eso su ficha sigue con el correo de antes.
#
# Solo a cuentas de alumno de esta escuela (nunca a un administrador ni al
# superadmin), y nunca a un correo que ya use otra cuenta.

_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def correo_valido(texto: str) -> str:
    """El correo limpio (sin espacios, en minúsculas) o ValueError."""
    nuevo = (texto or "").strip().lower()
    if len(nuevo) > 255 or not _CORREO.match(nuevo):
        raise ValueError("Ese correo no parece bien escrito")
    return nuevo


async def cambiar_correo(org_id: int, user_id: int, texto: str, db_session: AsyncSession) -> dict:
    """Cambia el correo de acceso de una cuenta de alumno. ValueError con el motivo."""
    from sqlalchemy import func

    nuevo = correo_valido(texto)
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if user is None:
        raise LookupError("No existe esa cuenta")
    uo = (
        await db_session.execute(
            select(UserOrganization).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    if uo is None:
        raise LookupError("Esa cuenta no es de esta escuela")
    if user.is_superadmin or uo.role_id in (1, 2):
        raise PermissionError("El correo de un administrador no se cambia desde aquí")
    antes = (user.email or "").strip().lower()
    if nuevo == antes:
        return {"ok": True, "email": nuevo, "antes": antes, "cambiado": False}
    otra = (
        await db_session.execute(select(User.id).where(func.lower(User.email) == nuevo, User.id != user_id))
    ).first()
    if otra:
        raise ValueError("Ese correo ya lo usa otra cuenta de la escuela")
    user.email = nuevo
    # El administrador responde por el correo nuevo: si quedara sin verificar,
    # en algunos sitios no podría entrar.
    user.email_verified = True
    user.update_date = str(datetime.now())
    db_session.add(user)
    await db_session.commit()
    logger.info("Correo de acceso cambiado para la cuenta %s", user_id)
    return {"ok": True, "email": nuevo, "antes": antes, "cambiado": True}

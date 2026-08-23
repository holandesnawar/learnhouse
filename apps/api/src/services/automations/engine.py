"""
El motor de automatizaciones: "cuando pase X, haz Y".

Cómo funciona
-------------
En los sitios donde ocurre algo importante (alguien entra en la escuela,
alguien paga, alguien termina la formación) se llama a `run_trigger`. Esa
función busca las automatizaciones encendidas para ese momento y las ejecuta,
**cada una en su propio try**: que falle un correo no puede tumbar un alta ni
un cobro. Lo que falle queda escrito en la propia fila (`last_error`), que es
lo que se enseña en el panel.

Qué NO hace todavía (y por qué se dice aquí)
--------------------------------------------
No hay esperas ("a los 3 días manda esto"). Para eso hace falta algo que se
despierte solo cada día, y la escuela hoy no tiene ese reloj. Todo lo que se
crea aquí ocurre **en el momento**. Cuando haya un reloj, se añade un campo de
días y este mismo motor lo aprovecha.
"""

from __future__ import annotations

import html
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.automations import Automation

logger = logging.getLogger(__name__)


# ── Qué puede disparar una automatización ────────────────────────────────
# El identificador es lo que se guarda; el resto es lo que se lee en pantalla.
TRIGGERS: list[dict] = [
    {
        "id": "student_joined",
        "label": "Cuando alguien entra en la escuela",
        "description": (
            "Salta con cada alumno nuevo, venga por donde venga: pagando, "
            "por invitación o dado de alta a mano."
        ),
    },
    {
        "id": "payment_completed",
        "label": "Cuando alguien paga la formación",
        "description": "Salta al confirmarse el cobro en Stripe.",
    },
    {
        "id": "course_completed",
        "label": "Cuando alguien termina un curso",
        "description": "Salta cuando el alumno completa todas las clases de un curso.",
    },
]

# ── Qué puede hacer ──────────────────────────────────────────────────────
ACTIONS: list[dict] = [
    {
        "id": "send_email",
        "label": "Mandar un correo",
        "description": "Un correo con el diseño de la escuela. Puedes usar {nombre}.",
        "fields": [
            {"key": "subject", "label": "Asunto", "type": "text", "required": True},
            {"key": "body", "label": "Texto del correo", "type": "richtext", "required": True},
            {"key": "cta_label", "label": "Texto del botón (opcional)", "type": "text"},
            {"key": "cta_url", "label": "Enlace del botón (opcional)", "type": "text"},
        ],
    },
    {
        "id": "send_message",
        "label": "Mandar un mensaje en Mis mensajes",
        "description": (
            "Aparece en su conversación con el equipo, firmado por la escuela. "
            "No manda correo. Puedes usar {nombre}."
        ),
        "fields": [
            {"key": "body", "label": "Mensaje", "type": "textarea", "required": True},
        ],
    },
    {
        "id": "add_to_group",
        "label": "Meterle en un grupo",
        "description": "Por ejemplo, el grupo de una cohorte concreta.",
        "fields": [
            {"key": "usergroup_id", "label": "Grupo", "type": "usergroup", "required": True},
        ],
    },
]

_TRIGGER_IDS = {t["id"] for t in TRIGGERS}
_ACTION_IDS = {a["id"] for a in ACTIONS}


def valid_trigger(trigger: str) -> bool:
    return trigger in _TRIGGER_IDS


def valid_action(action: str) -> bool:
    return action in _ACTION_IDS


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fill(text: str, context: dict) -> str:
    """
    Cambia {nombre} y {email} por lo que toque.

    A mano y no con `str.format`, porque el texto lo escribe una persona y una
    llave suelta —"así {es}"— reventaría el envío entero.
    """
    out = text or ""
    for key, value in context.items():
        out = out.replace("{" + key + "}", str(value or ""))
    return out


# ── Las acciones ─────────────────────────────────────────────────────────


async def _do_send_email(config: dict, context: dict, db_session: AsyncSession) -> None:
    from src.services.users.emails import send_news_email

    email = context.get("email")
    if not email:
        raise ValueError("Esa persona no tiene correo")

    body = _fill(config.get("body") or "", context)
    # Un texto escrito en una caja normal llega con saltos de línea, no con
    # etiquetas: se convierten para que el correo no salga en un párrafo.
    if "<" not in body:
        body = "".join(
            f"<p>{html.escape(line)}</p>" for line in body.splitlines() if line.strip()
        )

    send_news_email(
        email=email,
        name=context.get("nombre") or "alumno/a",
        title=_fill(config.get("subject") or "Novedades de la escuela", context),
        body_html=body,
        cta_label=_fill(config.get("cta_label") or "", context),
        cta_url=_fill(config.get("cta_url") or "", context),
    )


async def _do_send_message(config: dict, context: dict, db_session: AsyncSession) -> None:
    from src.db.direct_messages import DirectMessage
    from src.services.messages.direct import _org_admin, get_or_create_thread

    user_id = context.get("user_id")
    org_id = context.get("org_id")
    if not user_id or not org_id:
        raise ValueError("Falta el alumno o la escuela")

    thread = await get_or_create_thread(int(org_id), int(user_id), db_session)
    admin = await _org_admin(int(org_id), db_session)
    now = _now()
    db_session.add(
        DirectMessage(
            thread_id=thread.id or 0,
            # Firmado por la cuenta de la escuela, como la bienvenida.
            author_id=admin.id if admin else None,
            body=_fill(config.get("body") or "", context),
            created_at=now,
        )
    )
    thread.last_message_at = now
    db_session.add(thread)
    await db_session.commit()


async def _do_add_to_group(config: dict, context: dict, db_session: AsyncSession) -> None:
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup

    user_id = context.get("user_id")
    org_id = context.get("org_id")
    try:
        usergroup_id = int(config.get("usergroup_id") or 0)
    except (TypeError, ValueError):
        usergroup_id = 0
    if not user_id or not usergroup_id:
        raise ValueError("Falta el alumno o el grupo")

    group = (
        await db_session.execute(select(UserGroup).where(UserGroup.id == usergroup_id))
    ).scalars().first()
    if not group or group.org_id != int(org_id or 0):
        raise ValueError("Ese grupo no es de esta escuela")

    existing = (
        await db_session.execute(
            select(UserGroupUser).where(
                UserGroupUser.usergroup_id == usergroup_id,
                UserGroupUser.user_id == int(user_id),
            )
        )
    ).scalars().first()
    if existing:
        return

    now = str(datetime.now())
    db_session.add(
        UserGroupUser(
            usergroup_id=usergroup_id,
            user_id=int(user_id),
            org_id=group.org_id,
            creation_date=now,
            update_date=now,
        )
    )
    await db_session.commit()

    # Si el grupo es "Profes", esto además cambia el rol.
    from src.services.orgs.groups import sync_roles_for_group

    await sync_roles_for_group(usergroup_id, [int(user_id)], db_session, joining=True)


_RUNNERS = {
    "send_email": _do_send_email,
    "send_message": _do_send_message,
    "add_to_group": _do_add_to_group,
}


async def run_one(
    automation: Automation, context: dict, db_session: AsyncSession
) -> Optional[str]:
    """Ejecuta una. Devuelve el error como texto, o None si ha ido bien."""
    runner = _RUNNERS.get(automation.action)
    if not runner:
        return f"Acción desconocida: {automation.action}"
    try:
        await runner(automation.config or {}, context, db_session)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.exception("Automatización %s falló", automation.id)
        return str(exc)[:500]


async def build_context(user_id: int, org_id: int, db_session: AsyncSession, extra: Optional[dict] = None) -> dict:
    """Los datos con los que se rellenan los textos ({nombre}, {email}…)."""
    from src.db.users import User

    user = (
        await db_session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    name = ""
    if user:
        name = " ".join([p for p in [user.first_name, user.last_name] if p]).strip()
        name = name or user.username or ""
    context: dict[str, Any] = {
        "user_id": user_id,
        "org_id": org_id,
        "nombre": name or "alumno/a",
        "email": (user.email if user else "") or "",
    }
    if extra:
        context.update(extra)
    return context


async def run_trigger(
    trigger: str,
    org_id: int,
    user_id: int,
    db_session: AsyncSession,
    extra: Optional[dict] = None,
) -> None:
    """
    Ejecuta lo que haya colgado de ese momento.

    Best-effort de arriba abajo: esto se llama desde el alta y desde el cobro,
    y ninguna de las dos cosas puede fallar porque una automatización tenga un
    correo mal puesto.
    """
    try:
        rows = (
            await db_session.execute(
                select(Automation).where(
                    Automation.org_id == org_id,
                    Automation.trigger == trigger,
                    Automation.enabled == True,  # noqa: E712
                )
            )
        ).scalars().all()
        if not rows:
            return

        context = await build_context(user_id, org_id, db_session, extra)
        for automation in rows:
            error = await run_one(automation, context, db_session)
            automation.run_count = (automation.run_count or 0) + 1
            automation.last_run_at = _now()
            automation.last_error = error or ""
            db_session.add(automation)
        await db_session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron ejecutar las automatizaciones de '%s'", trigger)

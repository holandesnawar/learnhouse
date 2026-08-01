"""
Catálogo de los correos automáticos de la academia.

Sirve para verlos desde el panel: qué correos existen, cuándo se envían y qué
aspecto tienen exactamente, sin mandárselos a ningún alumno. Cada entrada sabe
montarse con datos de ejemplo.

Los correos se siguen enviando solos cuando toca; esto es solo la ventana para
mirarlos (y para mandárselos a uno mismo antes de tocar nada).
"""

from typing import Callable, Dict, List

from src.services.users import emails as E

class _FakeUser:
    """Lo mínimo que piden las plantillas que reciben un usuario entero."""

    def __init__(self, name: str):
        self.username = name
        self.first_name = name
        self.last_name = ""
        self.email = "alumno@ejemplo.com"


def _fake_user(name: str) -> "_FakeUser":
    return _FakeUser(name)


# id → (nombre, cuándo se envía, cómo se monta con datos de ejemplo)
_CATALOG: Dict[str, Dict] = {
    "payment_welcome": {
        "name": "Bienvenida tras la compra",
        "when": "Cuando se confirma el pago. Lleva el enlace para crear la contraseña.",
        "build": lambda to, name: E.send_payment_welcome_email(
            email=to, name=name, reset_code="EJEMPLO12", base_url=E.ACADEMY_URL, preview=True
        ),
    },
    "password_reset": {
        "name": "He olvidado mi contraseña",
        "when": "Cuando el alumno pide restablecer su contraseña desde el login.",
        "build": lambda to, name: E.send_password_reset_email_platform(
            generated_reset_code="EJEMPLO12",
            user=_fake_user(name),
            email=to,
            base_url=E.ACADEMY_URL,
            lang="es",
            preview=True,
        ),
    },
    "class_scheduled": {
        "name": "Clase semanal confirmada",
        "when": "Cuando pulsas «Avisar» en un evento del calendario.",
        "build": lambda to, name: E.send_class_scheduled_email(
            email=to,
            name=name,
            title="Clase en vivo — práctica de conversación",
            when_text="jueves 30 de julio · 19:00",
            event_url=f"{E.ACADEMY_URL}/calendario",
            preview=True,
        ),
    },
    "module_unlocked": {
        "name": "Módulo desbloqueado",
        "when": "Cuando al alumno se le abre un módulo nuevo del goteo.",
        "build": lambda to, name: E.send_module_unlocked_email(
            email=to, name=name, preview=True
        ),
    },
    "consulta_answered": {
        "name": "Consulta respondida",
        "when": "Cuando el equipo responde a una consulta del alumno.",
        "build": lambda to, name: E.send_consulta_answered_email(
            email=to, name=name, preview=True
        ),
    },
    "certificate_ready": {
        "name": "Certificado listo",
        "when": "Cuando el alumno completa la formación entera.",
        "build": lambda to, name: E.send_certificate_ready_email(
            email=to,
            name=name,
            certificate_url=f"{E.ACADEMY_URL}/certificates/ejemplo-1234",
            preview=True,
        ),
    },
    "announcement": {
        "name": "Novedad publicada en la comunidad",
        "when": "Cuando marcas «avisar por email» al escribir en un canal.",
        "build": lambda to, name: E.send_announcement_email(
            email=to, name=name, preview=True
        ),
    },
    "weekly_digest": {
        "name": "Resumen semanal",
        "when": "Plantilla lista, todavía sin disparador automático.",
        "build": lambda to, name: E.send_weekly_digest_email(
            email=to, name=name, preview=True
        ),
    },
    "account_creation": {
        "name": "Cuenta creada",
        "when": "Al crear una cuenta desde el panel o por invitación.",
        "build": lambda to, name: E.send_account_creation_email(
            user=_fake_user(name), email=to, lang="es", preview=True
        ),
    },
    "invitation": {
        "name": "Invitación a la academia",
        "when": "Cuando invitas a alguien con un código de invitación.",
        "build": lambda to, name: E.send_invitation_email(
            email=to,
            org_name="Holandés Nawar",
            inviter_username="Rida",
            signup_url=f"{E.ACADEMY_URL}/signup",
            lang="es",
            preview=True,
        ),
    },
}


def list_templates() -> List[dict]:
    return [
        {"id": key, "name": item["name"], "when": item["when"]}
        for key, item in _CATALOG.items()
    ]


def render_template(template_id: str, name: str = "María") -> dict:
    """Monta el correo con datos de ejemplo. No envía nada."""
    item = _CATALOG.get(template_id)
    if not item:
        raise KeyError(template_id)
    built = item["build"]("alumno@ejemplo.com", name)
    if not isinstance(built, dict):
        return {"subject": item["name"], "html": ""}
    return {"subject": built.get("subject", ""), "html": built.get("html", "")}


def send_template_test(template_id: str, to: str, name: str = "María") -> None:
    """Manda ese correo a una dirección concreta (la del admin que lo pide)."""
    item = _CATALOG.get(template_id)
    if not item:
        raise KeyError(template_id)
    rendered = render_template(template_id, name)
    from src.services.email.utils import send_email

    send_email(to=to, subject=rendered["subject"], body=rendered["html"])

"""
Evento de contacto — algo que una persona hizo con nosotros y que no tiene
tabla propia.

Qué resuelve
------------
La escuela ya guardaba a quien pide plaza (`enrollment_request`) y a quien
llega al pago (`enrollment`). Pero quien descarga una guía, escribe por
Instagram o reserva una reunión no dejaba rastro en ningún sitio nuestro:
iba directo a systeme.io, y en septiembre de 2026 se descubrió que systeme.io
ni siquiera guardaba el nombre. Meses de altas sin manera de reconstruirlas.

Esta tabla es la red de seguridad: cada alta, venga de donde venga, deja aquí
una fila con lo que se sabía en ese momento (nombre, correo, de qué anuncio
viene, por qué páginas pasó). El CRM deja de ser el único sitio donde vive el
dato.

⚠️ Aquí NO van las solicitudes de plaza ni las matrículas: esas ya tienen su
tabla y `services/contactos` las lee de ahí. Duplicarlas aquí haría que cada
persona saliera dos veces en su historial.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr
from sqlmodel import Field, SQLModel


class ContactEvent(SQLModel, table=True):
    __tablename__ = "contact_event"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    # Qué hizo: guia-bases, guia-hebben, instagram, reunion… Juego cerrado,
    # los nombres en cristiano están en services/contactos/contactos.py.
    kind: str = Field(default="", index=True, max_length=40)
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    # Desde dónde (web, ads, instagram…) y con qué etiqueta entró en el CRM.
    source: str = Field(default="", max_length=40)
    tag: str = Field(default="", max_length=120)
    # Por dónde pasó antes, separado por comas (ver nawar-web/src/lib/recorrido.ts).
    recorrido: str = Field(default="", max_length=400)
    referrer: str = Field(default="", max_length=120)
    # De qué anuncio viene. Vacío = orgánico.
    utm_source: str = Field(default="", max_length=120)
    utm_medium: str = Field(default="", max_length=120)
    utm_campaign: str = Field(default="", max_length=120)
    # Lo que no encaja en ninguna columna, en JSON (usuario de Instagram, etc.).
    extra: str = ""
    created_at: str = Field(default="", index=True)


class ContactEventCreate(BaseModel):
    email: EmailStr
    kind: str
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    source: str = ""
    tag: str = ""
    recorrido: list[str] = []
    referrer: str = ""
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    extra: dict = {}

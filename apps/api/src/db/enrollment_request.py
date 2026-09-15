"""
Solicitud de plaza — alguien que pide entrar SIN pasar por el pago.

Es lo que deja el formulario de /matricula-a0-a1 (y el de anuncios): nombre,
correo y teléfono, para que el equipo llame y cierre la venta hablando.

⚠️ Por qué NO va en la tabla `enrollment` aunque los campos sean casi los
mismos: `enrollment` es "esta persona entró en el checkout de Stripe", y de ahí
salen las ventas, el embudo y la conversión de Estadísticas. Meter aquí a quien
nunca vio una pasarela contaría como abandono de checkout e inflaría el embudo
con gente que jamás llegó a ese paso. Son dos cosas distintas y viven separadas
a propósito.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr
from sqlmodel import Field, SQLModel


class EnrollmentRequest(SQLModel, table=True):
    __tablename__ = "enrollment_request"

    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str = ""
    last_name: str = ""
    email: str = Field(default="", index=True, max_length=255)
    phone: str = ""
    # De dónde llegó: "web" (enlace normal) o "ads" (campaña). Se guarda para
    # poder mirar luego si las dos fuentes se parecen en calidad.
    source: str = Field(default="web", index=True)
    product: str = Field(default="formacion-a0-a1", index=True)
    created_at: str = Field(default="", index=True)
    # Cuándo se le escribió. Vacío = pendiente. Es lo que hace que la lista del
    # panel sea una lista de tareas y no un montón que crece para siempre.
    contacted_at: str = Field(default="", index=True)


class EnrollmentRequestCreate(BaseModel):
    email: EmailStr
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    source: str = "web"

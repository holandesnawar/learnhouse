"""
Seguimiento de un contacto por parte del equipo (sobre todo del closer):
notas de cada llamada y la fecha en la que hay que volver a llamar.

Va por CORREO y no por id de fila, porque una persona está repartida en varias
tablas (eventos, solicitudes, matrículas) y el correo es lo único que las une,
igual que en la ficha de Contactos.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class ContactNota(SQLModel, table=True):
    __tablename__ = "contact_nota"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    texto: str = Field(default="", max_length=4000)
    autor_id: int = 0
    autor: str = Field(default="", max_length=120)
    created_at: str = ""


class ContactRecordatorio(SQLModel, table=True):
    """Una fecha por persona: la próxima vez que hay que llamarla."""

    __tablename__ = "contact_recordatorio"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    # "AAAA-MM-DD"
    fecha: str = Field(default="", max_length=10)
    motivo: str = Field(default="", max_length=200)
    autor: str = Field(default="", max_length=120)
    updated_at: str = ""

"""
Mensajes directos entre el alumno y el equipo de la academia.

Un hilo por alumno: el alumno habla con "el equipo" (lo ven todos los
administradores/moderadores) y no con una persona concreta. Es lo que hace
falta aquí y evita la maraña de una mensajería de todos contra todos.

Tablas NUEVAS a propósito: al arrancar, la app crea las tablas que faltan pero
NO añade columnas a las que ya existen. Así esto entra sin migración manual.
"""

from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


class DirectThread(SQLModel, table=True):
    """La conversación de un alumno con el equipo."""

    __tablename__ = "direct_thread"
    __table_args__ = (UniqueConstraint("org_id", "student_id", name="uq_thread_org_student"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    student_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    created_at: str = ""
    last_message_at: str = ""
    # Hasta dónde ha leído cada lado (ISO 8601 en UTC).
    student_read_at: str = ""
    staff_read_at: str = ""


class DirectMessage(SQLModel, table=True):
    """Un mensaje del hilo. Puede ser texto, una nota de voz, o las dos cosas."""

    __tablename__ = "direct_message"

    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: int = Field(
        sa_column=Column(Integer, ForeignKey("direct_thread.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # Nulo = lo escribió la academia sin una persona concreta detrás
    # (por ejemplo el mensaje de bienvenida automático).
    author_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    body: str = Field(default="", sa_column=Column(Text))
    # Nombre del fichero de audio dentro de content/users/<uuid>/voice/.
    audio_file: str = Field(default="", sa_column=Column(String(300)))
    audio_seconds: int = 0
    created_at: str = ""


class DirectMessageRead(BaseModel):
    id: int
    body: str
    # Dirección completa de la nota de voz, o cadena vacía.
    audio_url: str = ""
    audio_seconds: int = 0
    created_at: str
    author_id: Optional[int] = None
    author_name: str
    # True si lo manda el equipo (para pintarlo del lado que toca).
    from_staff: bool


class DirectThreadRead(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_avatar: str = ""
    last_message_at: str = ""
    last_message_preview: str = ""
    unread: int = 0


class DirectThreadDetail(BaseModel):
    thread: DirectThreadRead
    messages: List[DirectMessageRead]
    # True si quien pregunta es del equipo (la pantalla cambia).
    is_staff: bool

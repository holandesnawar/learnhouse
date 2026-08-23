"""
Mensajes directos entre el alumno y el equipo de la escuela.

Un hilo por alumno: el alumno habla con "el equipo" (lo ven todos los
administradores/moderadores) y no con una persona concreta. Es lo que hace
falta aquí y evita la maraña de una mensajería de todos contra todos.

Tablas NUEVAS a propósito: al arrancar, la app crea las tablas que faltan pero
NO añade columnas a las que ya existen. Así esto entra sin migración manual.
"""

from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlmodel import Field, SQLModel


class DirectThread(SQLModel, table=True):
    """
    Una conversación.

    - ``staff_id`` vacío  → el alumno habla "con el equipo": la ve cualquier
      moderador. Es la de por defecto.
    - ``staff_id`` puesto → conversación con esa persona en concreto (la elige
      el alumno en el buscador). La ven esa persona y los administradores.
    """

    __tablename__ = "direct_thread"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    student_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    staff_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    created_at: str = ""
    last_message_at: str = ""
    # Hasta dónde ha leído cada lado (ISO 8601 en UTC).
    student_read_at: str = ""
    staff_read_at: str = ""


class DirectMessage(SQLModel, table=True):
    """
    Un mensaje del hilo.

    Puede llevar texto, una nota de voz grabada aquí mismo, y/o fotos y
    archivos adjuntos — igual que el chat de la comunidad.
    """

    __tablename__ = "direct_message"

    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: int = Field(
        sa_column=Column(Integer, ForeignKey("direct_thread.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # Nulo = lo escribió la escuela sin una persona concreta detrás
    # (por ejemplo el mensaje de bienvenida automático).
    author_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    body: str = Field(default="", sa_column=Column(Text))
    # Nombre del fichero de audio dentro de content/users/<uuid>/voice/.
    audio_file: str = Field(default="", sa_column=Column(String(300)))
    audio_seconds: int = 0
    # Fotos y archivos, como una lista JSON de {url, name, kind, size}. Texto
    # plano a propósito: la columna se añade a una tabla que ya existe en
    # producción (ver `_ADDED_COLUMNS`) y TEXT entra en cualquier motor.
    attachments: str = Field(default="", sa_column=Column(Text))
    created_at: str = ""


class DirectAttachment(BaseModel):
    """Una foto, un audio o un archivo colgado de un mensaje."""

    url: str
    name: str = ""
    # image · audio · file. Decide con qué se pinta.
    kind: str = "file"
    size: int = 0


class DirectMessageRead(BaseModel):
    id: int
    body: str
    # Dirección completa de la nota de voz, o cadena vacía.
    audio_url: str = ""
    audio_seconds: int = 0
    # Fotos y archivos del mensaje, ya listos para pintar.
    attachments: List[DirectAttachment] = []
    created_at: str
    author_id: Optional[int] = None
    author_name: str
    # Foto de quien escribe (la del moderador, o el logo de la escuela en los
    # mensajes automáticos). Ruta relativa; el front la completa.
    author_avatar: str = ""
    # Cargo ("Director Académico"): para que el alumno sepa quién le escribe.
    author_title: str = ""
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
    # Con quién es la conversación desde el punto de vista de quien pregunta.
    title: str = ""
    # Foto de esa persona (o el logo de la escuela).
    title_avatar: str = ""
    # Cargo de esa persona, si lo tiene puesto.
    title_role: str = ""
    # Vacío = con el equipo entero.
    staff_id: Optional[int] = None
    staff_name: str = ""


class DirectoryEntry(BaseModel):
    """Alguien a quien se le puede escribir (moderador o alumno)."""

    user_id: int
    name: str
    email: str = ""
    avatar: str = ""
    # Cargo si lo tiene puesto; si no, "Equipo" / "Alumno/a".
    role: str = ""
    # Hilo ya existente con esa persona, si lo hay.
    thread_id: Optional[int] = None


class DirectThreadDetail(BaseModel):
    thread: DirectThreadRead
    messages: List[DirectMessageRead]
    # True si quien pregunta es del equipo (la pantalla cambia).
    is_staff: bool

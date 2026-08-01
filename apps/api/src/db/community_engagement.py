"""
Tablas de "vida" de la comunidad: hasta dónde ha leído cada alumno cada canal
y los votos de las encuestas.

Son TABLAS NUEVAS a propósito: al arrancar, la app crea las tablas que faltan,
pero NO añade columnas a tablas existentes. Así esto entra en producción sin
migración manual.
"""

from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class ChannelReadState(SQLModel, table=True):
    """Última vez que un alumno abrió un canal. Base de los "no leídos"."""

    __tablename__ = "channel_read_state"
    __table_args__ = (UniqueConstraint("user_id", "community_id", name="uq_read_user_community"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    community_id: int = Field(
        sa_column=Column(Integer, ForeignKey("community.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # ISO 8601 en UTC. Se guarda como texto, igual que las fechas de discussion.
    last_read_at: str = ""


class PollVote(SQLModel, table=True):
    """Voto de un alumno en la encuesta de un mensaje. Uno por persona."""

    __tablename__ = "poll_vote"
    __table_args__ = (UniqueConstraint("user_id", "discussion_uuid", name="uq_vote_user_discussion"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    discussion_uuid: str = Field(sa_column=Column(String(120), nullable=False, index=True))
    option_index: int = 0
    created_at: str = ""


class NotificationSeen(SQLModel, table=True):
    """
    Hasta cuándo ha mirado el alumno su campana de notificaciones.

    Es distinto de haber leído el canal: puede ver "te han mencionado" y entrar
    al canal más tarde. Por eso lleva su propia fecha.
    """

    __tablename__ = "notification_seen"
    __table_args__ = (UniqueConstraint("user_id", name="uq_notification_seen_user"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    last_seen_at: str = ""


class NotificationItem(BaseModel):
    """Una mención en la comunidad, lista para pintar en la campana."""

    discussion_uuid: str
    community_uuid: str
    community_name: str
    author_name: str
    excerpt: str
    date: str
    # True si llegó después de la última vez que abrió la campana.
    is_new: bool


class NotificationFeed(BaseModel):
    items: List[NotificationItem]
    unseen: int


class UnreadCount(BaseModel):
    community_uuid: str
    unread: int
    mentions: int


class PollResults(BaseModel):
    discussion_uuid: str
    counts: List[int]
    total: int
    # Índice votado por quien pregunta, o None.
    my_vote: Optional[int] = None

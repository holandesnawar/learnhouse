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


class NotificationDismissed(SQLModel, table=True):
    """
    Notificaciones que el alumno ha quitado de su campana a mano.

    Las notificaciones no son filas de una tabla (se calculan a partir de los
    mensajes, los avisos y el goteo), así que lo que se guarda es su clave —
    la misma que devuelve el listado, por ejemplo "mention:discussion_abc".
    """

    __tablename__ = "notification_dismissed"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_dismissed_user_item"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    item_id: str = Field(sa_column=Column(String(200), nullable=False, index=True))
    created_at: str = ""


class OrgNotification(SQLModel, table=True):
    """
    Aviso de la escuela para todos: un anuncio, una clase confirmada…

    Se guarda una sola fila (no una por alumno): lo que cambia por persona es
    si ya lo ha visto, y eso ya lo dice notification_seen.
    """

    __tablename__ = "org_notification"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # announcement | class | news
    kind: str = Field(sa_column=Column(String(40), nullable=False))
    title: str = Field(sa_column=Column(String(300), nullable=False))
    body: str = ""
    # Ruta dentro de la escuela a la que lleva el aviso.
    url: str = ""
    created_at: str = ""


class NotificationItem(BaseModel):
    """Una línea de la campana, venga de donde venga."""

    # Clave única para el front (no es un id de base de datos).
    id: str
    # mention | pinned | announcement | module
    kind: str
    title: str
    excerpt: str
    # Ruta dentro de la escuela ("/community/xxx", "/course/xxx"…).
    url: str
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

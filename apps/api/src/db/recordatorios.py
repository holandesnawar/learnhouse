"""
Recordatorios que el equipo manda a mano a un alumno desde Panel → Alumnos →
Progreso ("esta semana no has entrado", "llevas 3 días sin entrar").

Una fila por envío. Sirve para enseñar en la lista "le recordaste hace 2 días"
y no escribirle dos veces seguidas sin darse cuenta.
"""

from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class StudentReminder(SQLModel, table=True):
    __tablename__ = "student_reminder"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    # "tres_dias" · "semana"
    tipo: str = Field(default="", max_length=20)
    asunto: str = Field(default="", max_length=200)
    sent_at: str = ""  # ISO en UTC
    sent_by: str = Field(default="", max_length=120)

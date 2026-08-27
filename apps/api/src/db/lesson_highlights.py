"""
Lesson highlight / note — per-student annotations on a lesson (dynamic page).

Each row is one highlight the student made over a piece of text inside a lesson,
optionally carrying a written note. Stored with the ProseMirror positions
(pm_from/pm_to) so the reader can re-paint the highlight, plus the quoted text so
we can skip painting if the lesson content later changed and the offsets no
longer match.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Index, Integer, String, Text
from sqlmodel import Field, SQLModel


class LessonHighlight(SQLModel, table=True):
    __tablename__ = "lesson_highlight"
    __table_args__ = (
        Index("ix_lesson_highlight_user_activity", "user_id", "activity_uuid"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True
        )
    )
    org_id: int = Field(default=0)
    # The lesson/activity the highlight lives in (activity_uuid string).
    activity_uuid: str = Field(sa_column=Column(String(255), index=True))
    # Human title of the lesson, denormalised so "Mis notas" can list without joins.
    activity_name: str = Field(default="", sa_column=Column(String(500)))
    course_uuid: str = Field(default="", sa_column=Column(String(255)))
    # Qué trozo de texto de la lección es.
    #
    # Una lección de la formación tiene varios textos sueltos (el resumen, el
    # texto de Lezen en neerlandés y su traducción), y las posiciones son
    # números de carácter DENTRO de cada uno. Sin esto, un resaltado del
    # neerlandés se repintaría encima de la traducción. Vacío = las lecciones
    # del editor, que van por posiciones de ProseMirror y no lo necesitan.
    block_key: str = Field(default="", sa_column=Column(String(120)))
    # Pastel colour key: yellow | pink | blue | green.
    color: str = Field(default="yellow", sa_column=Column(String(20)))
    quote: str = Field(default="", sa_column=Column(Text))
    note: str = Field(default="", sa_column=Column(Text))
    pm_from: int = Field(default=0)
    pm_to: int = Field(default=0)
    created_at: str = Field(default="")
    updated_at: str = Field(default="")


class LessonHighlightCreate(BaseModel):
    activity_uuid: str
    activity_name: Optional[str] = ""
    course_uuid: Optional[str] = ""
    block_key: Optional[str] = ""
    color: str = "yellow"
    quote: str = ""
    note: Optional[str] = ""
    pm_from: int = 0
    pm_to: int = 0


class LessonHighlightPatch(BaseModel):
    color: Optional[str] = None
    note: Optional[str] = None


class LessonHighlightRead(BaseModel):
    id: int
    activity_uuid: str
    activity_name: str
    course_uuid: str
    block_key: str = ""
    color: str
    quote: str
    note: str
    pm_from: int
    pm_to: int
    created_at: str
    updated_at: str


def now_iso() -> str:
    return datetime.now().isoformat()

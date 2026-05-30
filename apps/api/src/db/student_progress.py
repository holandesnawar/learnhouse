"""
Per-student progress signals: streak, last position, onboarding checks, theme
preference and a couple of derived counters. One row per user.

The `lesson_completion` table tracks each lesson the student has finished, with
the time spent on it — that powers the "real" /progreso page and the
"continue where you left off" experience.
"""

from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Index, Integer, JSON, String
from sqlmodel import Field, SQLModel


class StudentProgress(SQLModel, table=True):
    __tablename__ = "student_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            index=True,
            unique=True,
        )
    )
    last_visit_date: str = ""  # ISO date YYYY-MM-DD
    current_streak: int = 0
    longest_streak: int = 0
    # Free-form so we can evolve without migrations.
    current_position: dict = Field(default_factory=dict, sa_column=Column(JSON))
    onboarding_state: dict = Field(default_factory=dict, sa_column=Column(JSON))
    theme: str = "light"  # "light" | "dark" | "system"
    time_seconds_total: int = 0
    creation_date: str = ""
    update_date: str = ""


class LessonCompletion(SQLModel, table=True):
    __tablename__ = "lesson_completion"
    __table_args__ = (
        Index(
            "ix_lesson_completion_user_lesson",
            "user_id",
            "lesson_id",
            unique=True,
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True
        )
    )
    lesson_id: str = Field(sa_column=Column(String(255), index=True))
    module_id: str = ""
    completed_at: str = ""
    time_seconds: int = 0


# ── API DTOs ────────────────────────────────────────────────────────────────

class StudentProgressRead(BaseModel):
    last_visit_date: str
    current_streak: int
    longest_streak: int
    current_position: dict
    onboarding_state: dict
    theme: str
    time_seconds_total: int


class StudentProgressPatch(BaseModel):
    # Every field optional — PUT acts as a partial update.
    current_position: Optional[dict] = None
    onboarding_state: Optional[dict] = None
    theme: Optional[str] = None
    time_seconds_total: Optional[int] = None


class LessonCompletionCreate(BaseModel):
    module_id: str = ""
    time_seconds: int = 0


class LessonCompletionRead(BaseModel):
    lesson_id: str
    module_id: str
    completed_at: str
    time_seconds: int


class WeakWord(BaseModel):
    label: str
    fails: int


class StudentVisitResponse(BaseModel):
    last_visit_date: str
    current_streak: int
    longest_streak: int

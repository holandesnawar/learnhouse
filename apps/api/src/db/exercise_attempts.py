"""
Exercise attempt — stores the most recent attempt the student made at an
exercise practice (e.g. Luisteren of lesson X). One row per (user, section_key).
"""

from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Index, Integer, JSON, String
from sqlmodel import Field, SQLModel


class ExerciseAttempt(SQLModel, table=True):
    __tablename__ = "exercise_attempt"
    __table_args__ = (
        Index(
            "ix_exercise_attempt_user_key",
            "user_id",
            "section_key",
            unique=True,
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True
        )
    )
    section_key: str = Field(sa_column=Column(String(255), index=True))
    score: int = 0
    total: int = 0
    failed_labels: list = Field(default_factory=list, sa_column=Column(JSON))
    date: str = ""


class ExerciseAttemptRead(BaseModel):
    score: int
    total: int
    failed_labels: List[str]
    date: str


class ExerciseAttemptCreate(BaseModel):
    score: int
    total: int
    failed_labels: List[str]

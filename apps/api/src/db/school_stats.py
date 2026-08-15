"""
Números de la escuela — datos que NO se pueden deducir solos.

Casi todo lo que enseña la pantalla de Estadísticas se calcula de lo que ya
guardamos (matrículas, progreso, alumnos). Lo que no existe en ningún sitio y
tiene que escribir una persona vive aquí: el gasto de cada mes (para el coste
por lead) y la asistencia a la clase en vivo.

Una sola tabla con `kind` + `period`, en vez de una tabla por métrica: así
añadir un dato manual nuevo el día de mañana no exige tocar la base de datos.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class ManualEntry(SQLModel, table=True):
    __tablename__ = "school_manual_entry"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    # "cost" = gasto del mes · "attendance" = asistentes a una clase en vivo
    kind: str = Field(default="", index=True)
    # "2026-09" para el gasto mensual · "2026-09-17" para una clase concreta
    period: str = Field(default="", index=True)
    label: str = ""
    value: float = 0
    note: str = ""
    created_at: str = ""
    updated_at: str = ""


class ManualEntryWrite(BaseModel):
    kind: str
    period: str
    value: float
    label: str = ""
    note: str = ""


class ManualEntryRead(BaseModel):
    id: int
    kind: str
    period: str
    label: str
    value: float
    note: str
    updated_at: str

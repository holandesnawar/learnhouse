"""
Gastos de la escuela, apuntados a mano: profes, publicidad, herramientas.

Es un cuadro de mando, NO contabilidad (decidido 27/08/2026 y confirmado el
24/09): las facturas de verdad viven en el programa del gestor (Moneybird /
Holded). Aquí solo se apuntan importes para cruzarlos con las ventas y ver el
coste por matrícula, el margen y el coste por alumno.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class SchoolExpense(SQLModel, table=True):
    __tablename__ = "school_expense"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    # "AAAA-MM-DD"; el mes sale de aquí.
    fecha: str = Field(default="", index=True, max_length=10)
    # publicidad | profes | herramientas | otros
    categoria: str = Field(default="otros", index=True, max_length=40)
    concepto: str = Field(default="", max_length=200)
    importe_cents: int = 0
    nota: str = Field(default="", max_length=500)
    created_at: str = ""


class SchoolExpenseWrite(BaseModel):
    fecha: str
    categoria: str
    concepto: str = ""
    importe: float
    nota: str = ""

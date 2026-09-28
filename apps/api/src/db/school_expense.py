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


class SchoolRecurringExpense(SQLModel, table=True):
    """Un gasto que se repite cada mes (herramientas, un profe a sueldo fijo,
    la cuota de algo). Se apunta una vez y cuenta en cada mes desde `desde`
    hasta `hasta` (vacío = sigue). Darlo de baja es poner `hasta`, no
    borrarlo: los meses pasados siguen contando lo que costó."""

    __tablename__ = "school_recurring_expense"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    concepto: str = Field(default="", max_length=200)
    categoria: str = Field(default="herramientas", max_length=40)
    importe_cents: int = 0
    # "AAAA-MM"
    desde: str = Field(default="", max_length=7)
    hasta: str = Field(default="", max_length=7)
    nota: str = Field(default="", max_length=500)
    created_at: str = ""


class RecurringExpenseWrite(BaseModel):
    concepto: str
    categoria: str = "herramientas"
    importe: float
    desde: str
    hasta: str = ""
    nota: str = ""

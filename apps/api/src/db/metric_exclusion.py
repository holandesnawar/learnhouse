"""
Personas que NO cuentan en los números (pruebas del equipo, alumnos de test).

Existe porque borrar no era lo que se quería: el usuario pidió que un alumno de
prueba "no cuente su número", pero que siga pudiendo entrar a la escuela. Así
que no se toca su cuenta ni sus pagos: se apunta su correo aquí y las
estadísticas, los gastos, las plazas y los Contactos lo dejan fuera. Se puede
volver a contar cuando se quiera.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class MetricExclusion(SQLModel, table=True):
    __tablename__ = "metric_exclusion"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    motivo: str = Field(default="", max_length=200)
    created_at: str = ""

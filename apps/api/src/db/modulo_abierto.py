"""
Módulos que ya se le han abierto a un alumno con la apertura por avance
(`services/courses/avance_modulos.py`).

La apertura por avance se CALCULA: con el alta, las clases hechas y las
esperas mínimas se sabe qué módulos tiene abiertos cada alumno. Esta tabla
existe para dos cosas que el cálculo solo no resuelve:

1. **Lo que se abre no se vuelve a cerrar.** Si después de abrírsele el módulo
   4 se añaden clases al 3, el alumno deja de tener el 80 % del 3 y el cálculo
   le cerraría el 4, que ya estaba usando. La tarea diaria apunta aquí cada
   apertura, y lo apuntado manda sobre el cálculo.
2. **Abrir a mano.** El administrador puede abrirle un módulo a un alumno
   desde Panel → Alumnos → Progreso (`como="mano"`).
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class ModuloAbierto(SQLModel, table=True):
    __tablename__ = "modulo_abierto"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    chapter_uuid: str = Field(index=True, max_length=255)
    # ISO sin zona, en UTC (como `creation_date` en el resto de tablas).
    abierto_at: str = ""
    # "avance" (lo apuntó la tarea diaria) o "mano" (lo abrió el equipo).
    como: str = Field(default="avance", max_length=20)
    # Quién lo abrió a mano. Vacío si fue el avance.
    por: str = Field(default="", max_length=120)

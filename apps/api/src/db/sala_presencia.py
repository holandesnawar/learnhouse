"""
Quién ha estado dentro de cada sala y cuánto rato (19/11/2026). La lógica y el
porqué, en `services/salas/presencia.py`.

Una fila por persona, curso y día (hora de Países Bajos): los segundos que
estuvo dentro de la llamada, sumando lo que la propia sala avisa cada minuto
mientras está abierta. Tabla nueva: la crea `create_all` al arrancar.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class SalaPresencia(SQLModel, table=True):
    __tablename__ = "sala_presencia"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    course_uuid: str = Field(default="", max_length=80, index=True)
    user_id: int = Field(default=0, index=True)
    # AAAA-MM-DD, hora de Países Bajos.
    dia: str = Field(default="", max_length=10, index=True)
    segundos: int = 0
    # Del equipo (profe, monitor, administrador): para saber quién dio la clase.
    equipo: bool = False
    rol: int = 0
    nombre: str = Field(default="", max_length=160)
    # Segundos desde 1970 (UTC) del primer y del último aviso.
    primera: float = 0
    ultima: float = 0

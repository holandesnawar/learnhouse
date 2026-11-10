"""
«Mijn eerste week» (10/11/2026): el reto personalizado de 7 días, el regalo
para captar leads. La lógica y el porqué, en `services/reto/reto.py`.

`reto_semana`: una fila por persona (por correo). Sus respuestas (dónde vive,
de dónde es, para qué necesita el neerlandés, a qué se dedica, cuánto sabe) y
los días que ha hecho. El plan NO se guarda: se arma cada vez con las
respuestas (`reto.armar`), así se puede mejorar el contenido para todos.

Tabla nueva: la crea `create_all` al arrancar. No son alumnos ni tienen
cuenta: entran con un enlace personal firmado.
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class RetoSemana(SQLModel, table=True):
    __tablename__ = "reto_semana"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    nombre: str = Field(default="", max_length=120)
    telefono: str = Field(default="", max_length=24)
    # {"vive": "nl", "ciudad": "Utrecht", "origen": "colombia", "motivo": "medico", "trabajo": "zorg", "nivel": "nada"}
    respuestas: str = Field(default="{}", sa_column=Column(Text, default="{}"))
    # {"1": "2026-11-10T09:00:00+00:00", "2": …}: cuándo terminó cada día.
    hechos: str = Field(default="{}", max_length=600)
    # El día en que empezó (AAAA-MM-DD, hora de Países Bajos): el día 2 se abre al siguiente.
    inicio: str = Field(default="", max_length=10)
    # Si pulsó el botón de la llamada, y cuándo.
    llamada_at: str = Field(default="", max_length=40)
    created_at: str = ""
    updated_at: str = ""

"""
La sala de profes (08/11/2026, rama diseno): el tablero de tareas del equipo
docente y su manual (los SOP). La lógica, en `services/equipo/equipo.py`.

- `equipo_tarea`: una tarea del equipo de clases (profes, monitores y
  administradores), con su columna del tablero (por hacer · en curso · hecho),
  a quién va, para cuándo y, si es de una clase, de cuál.
- `equipo_documento`: una página del manual del equipo («Antes de la clase»,
  «Corregir una tarea»…), en texto con formato sencillo.

Tablas nuevas: las crea `create_all` al arrancar. Solo las ve el equipo
(`STAFF_ROLE_IDS`); los alumnos y el closer, no.
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class EquipoTarea(SQLModel, table=True):
    __tablename__ = "equipo_tarea"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    titulo: str = Field(default="", max_length=200)
    notas: str = Field(default="", max_length=4000)
    # por-hacer · en-curso · hecho
    estado: str = Field(default="por-hacer", max_length=12, index=True)
    # normal · alta
    prioridad: str = Field(default="normal", max_length=10)
    # Para cuándo (AAAA-MM-DD). Vacío = sin fecha.
    fecha: str = Field(default="", max_length=10)
    asignado_id: int = Field(default=0, index=True)  # 0 = para todo el equipo
    asignado: str = Field(default="", max_length=120)
    # La clase en directo de la que es (sin «course_»), si es de una.
    course_uuid: str = Field(default="", max_length=80)
    # Orden dentro de su columna (más pequeño, más arriba).
    orden: float = 0
    creado_por_id: int = 0
    creado_por: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""
    done_at: str = ""


class EquipoDocumento(SQLModel, table=True):
    __tablename__ = "equipo_documento"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    titulo: str = Field(default="", max_length=200)
    # El apartado del manual en el que va («Clases», «Alumnos»…).
    seccion: str = Field(default="", max_length=80)
    texto: str = Field(default="", sa_column=Column(Text, default=""))
    orden: float = 0
    creado_por: str = Field(default="", max_length=120)
    actualizado_por: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""

"""
La tarea de cada semana de una clase en directo y lo que entrega cada alumno
(28/10/2026). Tablas aprobadas por el usuario el 28/10. La lógica, en
`services/tareas/tareas.py`.

- `tarea_semana`: UNA semana de la clase (un capítulo del curso de la clase en
  directo: «De kleding», lunes 3 nov) y el enunciado de su tarea. Sin
  enunciado, esa semana no pide tarea.
- `tarea_entrega`: lo que entrega un alumno (texto y/o nota de voz) y la
  corrección del equipo (texto y/o nota de voz). Una fila por alumno y tarea.

Las notas de voz van a `content/privado/tareas/<org>/` y NUNCA se sirven por
`/content`: solo por la ruta de la tarea, al alumno que la entregó y al equipo.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class TareaSemana(SQLModel, table=True):
    __tablename__ = "tarea_semana"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    # Sin el prefijo «course_», como en org_config `salas`.
    course_uuid: str = Field(default="", index=True, max_length=80)
    chapter_uuid: str = Field(default="", index=True, max_length=80)
    tema: str = Field(default="", max_length=160)
    # Día de la clase (AAAA-MM-DD, hora de Países Bajos).
    fecha: str = Field(default="", max_length=10)
    # Vacío = esa semana no hay tarea.
    enunciado: str = Field(default="", max_length=4000)
    # Último día para entregar (AAAA-MM-DD). Vacío = el domingo de esa semana.
    fecha_limite: str = Field(default="", max_length=10)
    creada_por: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""


class TareaEntrega(SQLModel, table=True):
    __tablename__ = "tarea_entrega"

    id: Optional[int] = Field(default=None, primary_key=True)
    tarea_id: int = Field(default=0, index=True)
    user_id: int = Field(default=0, index=True)
    texto: str = Field(default="", max_length=6000)
    # Ruta relativa dentro de content/ (privado/tareas/<org>/…).
    audio: str = Field(default="", max_length=300)
    audio_seg: int = 0
    entregada_at: str = ""
    actualizada_at: str = ""
    # entregada → corregida
    estado: str = Field(default="entregada", max_length=20)
    correccion_texto: str = Field(default="", max_length=6000)
    correccion_audio: str = Field(default="", max_length=300)
    correccion_audio_seg: int = 0
    corregida_por_id: int = 0
    corregida_por: str = Field(default="", max_length=120)
    corregida_at: str = ""
    # Cuándo vio el alumno la corrección (apaga el aviso de la campana).
    vista_at: str = ""

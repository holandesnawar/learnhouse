"""
Reseñas en vídeo de los alumnos (10/11/2026). La lógica y el porqué, en
`services/resenas/resenas.py`.

Una sola tabla, `resena`: UNA fila por alumno invitado. Nace `invitada`
(el administrador le pide la reseña), pasa a `grabada` cuando el alumno sube
su vídeo con el permiso marcado, y el administrador la deja `aprobada` o
`descartada`.

El vídeo va a `content/privado/resenas/<org>/` (dentro del volumen: entra en
la copia diaria) y NUNCA se sirve por `/content`: solo por la ruta de reseñas,
al alumno que lo grabó y a los administradores.

Tabla nueva: la crea `create_all` al arrancar.
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class Resena(SQLModel, table=True):
    __tablename__ = "resena"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    user_id: int = Field(default=0, index=True)
    # El nombre del alumno cuando se le invitó (por si luego se borra la cuenta).
    nombre: str = Field(default="", max_length=160)
    # invitada · grabada · aprobada · descartada
    estado: str = Field(default="invitada", max_length=12, index=True)

    # El vídeo: ruta relativa dentro de content/ (privado/resenas/<org>/…).
    video: str = Field(default="", max_length=300)
    video_mime: str = Field(default="", max_length=40)
    video_seg: int = 0
    video_bytes: int = 0
    # Lo que el alumno quiera añadir por escrito.
    texto: str = Field(default="", sa_column=Column(Text, default=""))

    # El permiso: sin él no se guarda ningún vídeo. Se guarda el texto EXACTO
    # que aceptó, cuándo, y para qué usos (JSON: ["web", "redes", "anuncios"]).
    permiso: bool = False
    permiso_texto: str = Field(default="", sa_column=Column(Text, default=""))
    permiso_at: str = Field(default="", max_length=40)
    usos: str = Field(default="[]", max_length=120)

    # La invitación.
    invitada_por: str = Field(default="", max_length=120)
    invitada_at: str = Field(default="", max_length=40)
    mensaje: str = Field(default="", sa_column=Column(Text, default=""))
    grabada_at: str = Field(default="", max_length=40)

    # La revisión del equipo.
    revisada_at: str = Field(default="", max_length=40)
    revisada_por: str = Field(default="", max_length=120)
    nota: str = Field(default="", sa_column=Column(Text, default=""))

    # El agradecimiento («Un mes de Spreekclub») y cuándo se le dio.
    regalo: str = Field(default="", max_length=200)
    regalo_dado_at: str = Field(default="", max_length=40)

    created_at: str = Field(default="", max_length=40)
    updated_at: str = Field(default="", max_length=40)

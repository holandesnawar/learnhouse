"""
Los tableros de producción de la formación (19/11/2026), como el Deck de
Nextcloud pero dentro de la escuela. La lógica, en
`src/services/produccion/tableros.py`.

- `prod_curso`: un curso o nivel («A0-A1», «A1-A2»). Agrupa sus tableros y
  tiene sus etiquetas y su plantilla de tarjeta.
- `prod_tablero`: un tablero (un módulo: «A1 Module 10: Dagelijks leven»).
- `prod_columna`: una columna del tablero («Niet begonnen», «Ingeleverd»…).
- `prod_etiqueta`: una etiqueta del curso, con su color.
- `prod_tarjeta`: una tarjeta (una lección o un vídeo): descripción con el
  editor, etiquetas, a quién va, para cuándo, enlaces y adjuntos.
- `prod_comentario`: los comentarios de una tarjeta.

Tablas nuevas: las crea `create_all` al arrancar. Solo las ve el equipo de
clases (`STAFF_ROLE_IDS`). Lo que va en listas (etiquetas, asignados,
enlaces, adjuntos) se guarda como JSON en texto, igual que en Visión.
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class ProdCurso(SQLModel, table=True):
    __tablename__ = "prod_curso"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    nombre: str = Field(default="", max_length=120)
    color: str = Field(default="#0b2da0", max_length=9)
    # La descripción con la que nace cada tarjeta nueva (JSON del editor o HTML).
    plantilla: str = Field(default="", sa_column=Column(Text, default=""))
    orden: float = 0
    archivado: bool = False
    created_at: str = ""
    updated_at: str = ""


class ProdTablero(SQLModel, table=True):
    __tablename__ = "prod_tablero"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    curso_id: int = Field(default=0, index=True)
    titulo: str = Field(default="", max_length=160)
    color: str = Field(default="#0b2da0", max_length=9)
    orden: float = 0
    archivado: bool = False
    # De dónde vino («nextcloud:12»), para no traerlo dos veces.
    origen: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""


class ProdColumna(SQLModel, table=True):
    __tablename__ = "prod_columna"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    tablero_id: int = Field(default=0, index=True)
    titulo: str = Field(default="", max_length=80)
    orden: float = 0
    origen: str = Field(default="", max_length=120)


class ProdEtiqueta(SQLModel, table=True):
    __tablename__ = "prod_etiqueta"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    curso_id: int = Field(default=0, index=True)
    nombre: str = Field(default="", max_length=60)
    color: str = Field(default="#0b2da0", max_length=9)
    orden: float = 0


class ProdTarjeta(SQLModel, table=True):
    __tablename__ = "prod_tarjeta"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    tablero_id: int = Field(default=0, index=True)
    columna_id: int = Field(default=0, index=True)
    titulo: str = Field(default="", max_length=300)
    descripcion: str = Field(default="", sa_column=Column(Text, default=""))
    orden: float = 0
    # Para cuándo (AAAA-MM-DD o AAAA-MM-DDTHH:MM). Vacío = sin fecha.
    vence: str = Field(default="", max_length=32)
    hecha_at: str = Field(default="", max_length=40)
    archivada: bool = Field(default=False, index=True)
    etiquetas: str = Field(default="[]", sa_column=Column(Text, default="[]"))
    asignados: str = Field(default="[]", sa_column=Column(Text, default="[]"))
    enlaces: str = Field(default="[]", sa_column=Column(Text, default="[]"))
    adjuntos: str = Field(default="[]", sa_column=Column(Text, default="[]"))
    n_comentarios: int = 0
    origen: str = Field(default="", max_length=120)
    creado_por_id: int = 0
    creado_por: str = Field(default="", max_length=120)
    actualizado_por: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""


class ProdComentario(SQLModel, table=True):
    __tablename__ = "prod_comentario"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    tarjeta_id: int = Field(default=0, index=True)
    user_id: int = 0
    autor: str = Field(default="", max_length=120)
    texto: str = Field(default="", sa_column=Column(Text, default=""))
    created_at: str = ""
    editado_at: str = ""

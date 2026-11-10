"""
El Estudio (10/11/2026): la pizarra del negocio y el banco de ideas de
contenido. La lógica y el porqué, en `services/estudio/estudio.py`.

Una sola tabla, `estudio_item`: una NOTA de la pizarra (algo apuntado deprisa,
con su área) o una IDEA de contenido (un reel, un carrusel, un artículo…) con
su objetivo y los sitios donde ya se ha publicado.

Tabla nueva: la crea `create_all` al arrancar. La ven los administradores; el
closer, solo lo del área de ventas.
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class EstudioItem(SQLModel, table=True):
    __tablename__ = "estudio_item"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    # nota · idea
    tipo: str = Field(default="nota", max_length=10, index=True)
    # contenido · clases · formacion · proxima · ventas · comunidad · producto · otros
    area: str = Field(default="otros", max_length=20, index=True)
    titulo: str = Field(default="", max_length=300)
    # El texto largo: la nota entera, o el guion de la idea.
    texto: str = Field(default="", sa_column=Column(Text, default=""))
    # Ideas: reel · carrusel · historia · tiktok · blog · youtube · comunidad · correo · otro
    formato: str = Field(default="", max_length=20)
    # Ideas: alcance · comunidad · ventas
    objetivo: str = Field(default="", max_length=12)
    # idea · en-curso · hecho
    estado: str = Field(default="idea", max_length=12, index=True)
    # {"instagram": "2026-11-10", "tiktok": "2026-11-11"}: dónde se publicó y qué día.
    canales: str = Field(default="{}", max_length=400)
    fijada: bool = False
    # Para cuándo (AAAA-MM-DD). Vacío = sin fecha.
    fecha: str = Field(default="", max_length=10)
    autor_id: int = Field(default=0, index=True)
    autor: str = Field(default="", max_length=120)
    created_at: str = ""
    updated_at: str = ""

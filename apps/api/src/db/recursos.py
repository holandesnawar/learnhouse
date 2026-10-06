"""
Recursos: carpetas con archivos y enlaces que el equipo comparte con los
alumnos (PDF de la clase, un Drive con audios, un enlace a una web…).

Dos tablas nuevas, sin migración: `create_all` las crea al arrancar. Una
carpeta contiene items; un item es un enlace (`kind = "link"`, con su `url`)
o un archivo subido (`kind = "file"`, con la `url` del volumen o de R2 y el
nombre original para enseñarlo).

Lo gestiona el administrador. Quién VE cada carpeta (06/10/2026, "el grupo de
closers solo puede ver la carpeta comercial; el admin ve todo"):
- `grupos` vacío y no privada → todo el que está dentro de la escuela.
- `grupos` con algo → solo quien esté en alguno de esos grupos de usuarios
  (Panel → Usuarios → Grupos), y "alumnos" = cualquiera con rol de alumno.
- privada y sin grupos → solo administradores.
- Los administradores lo ven todo, siempre.
Ver `puede_ver` en `services/recursos/recursos.py`.
"""

from typing import Optional, Union

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class ResourceFolder(SQLModel, table=True):
    __tablename__ = "resource_folder"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(index=True)
    name: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=400)
    # Para ordenarlas a mano. Menor = más arriba. Empate → más antigua primero.
    position: int = 0
    created_at: str = ""
    # Solo para el equipo: el alumno no la ve. Para las facturas del negocio,
    # contratos, lo que sea del administrador. Columna añadida después de crear
    # la tabla → en _ADDED_COLUMNS.
    private: bool = False
    # Quién la ve: JSON con ids de grupos de usuarios y/o "alumnos". Vacío =
    # todos. Columna añadida después → en _ADDED_COLUMNS.
    grupos: str = Field(default="", max_length=400)


class ResourceItem(SQLModel, table=True):
    __tablename__ = "resource_item"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(index=True)
    folder_id: int = Field(
        sa_column=Column(Integer, ForeignKey("resource_folder.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # "link" o "file".
    kind: str = Field(default="link", max_length=10)
    title: str = Field(default="", max_length=160)
    url: str = Field(default="", max_length=800)
    # Solo para archivos: nombre original y tamaño, para enseñarlos.
    file_name: str = Field(default="", max_length=160)
    size: int = 0
    position: int = 0
    created_at: str = ""


class FolderWrite(BaseModel):
    name: str
    description: str = ""
    private: bool = False
    # None = no tocar los que tenga (pantallas viejas que no los mandan).
    grupos: Optional[list[Union[int, str]]] = None


class LinkWrite(BaseModel):
    title: str
    url: str


class OrderWrite(BaseModel):
    """Ids en el orden en que deben quedar."""

    ids: list[int]

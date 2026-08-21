"""
Automatizaciones de la escuela: "cuando pase X, haz Y".

Una tabla nueva a propósito: al arrancar, la aplicación crea las tablas que
faltan, así que esto entra sin migración a mano.

El `config` de cada acción se guarda como JSON (el asunto y el texto de un
correo, el grupo al que meter a alguien…). Cada acción decide qué campos usa;
lo que no reconozca, lo ignora.
"""

from typing import Optional

from pydantic import BaseModel
from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlmodel import Field, SQLModel


class Automation(SQLModel, table=True):
    __tablename__ = "automation"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    # Cómo la llama quien la creó ("Bienvenida del profe").
    name: str = Field(default="", sa_column=Column(String(160)))
    # Apagarla sin borrarla: probar cosas sin perder lo escrito.
    enabled: bool = True
    # Qué la dispara y qué hace. Los identificadores válidos viven en
    # `services/automations/engine.py`.
    trigger: str = Field(default="", sa_column=Column(String(60), index=True))
    action: str = Field(default="", sa_column=Column(String(60)))
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Para que en la pantalla se vea si de verdad está funcionando.
    run_count: int = 0
    last_run_at: str = Field(default="", sa_column=Column(String(40)))
    last_error: str = Field(default="", sa_column=Column(Text))
    created_at: str = Field(default="", sa_column=Column(String(40)))
    created_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )


class AutomationCreate(BaseModel):
    name: str = ""
    trigger: str
    action: str
    config: dict = {}
    enabled: bool = True


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[str] = None
    action: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None


class AutomationRead(BaseModel):
    id: int
    name: str
    trigger: str
    action: str
    config: dict
    enabled: bool
    run_count: int
    last_run_at: str
    last_error: str
    created_at: str

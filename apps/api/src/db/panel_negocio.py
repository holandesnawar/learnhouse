"""
El panel de negocio (sept 2026): kanban de matrículas, tareas del equipo y el
registro de correos que manda la escuela.

Todo va por CORREO, como la ficha de Contactos: una persona está repartida en
varias tablas (eventos, solicitudes, matrículas) y el correo es lo único que
las une.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class LeadPipeline(SQLModel, table=True):
    """En qué columna del kanban está cada persona y por dónde se la contacta.

    Solo hay fila cuando alguien la ha movido: sin fila, la etapa se deduce
    (nuevo, o contactado si ya estaba marcada como atendida). "Alumno" no se
    guarda nunca: sale sola en cuanto paga.
    """

    __tablename__ = "lead_pipeline"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    etapa: str = Field(default="nuevo", max_length=20)
    # whatsapp · llamada · email · instagram · otro ("" = sin decir)
    canal: str = Field(default="", max_length=20)
    motivo: str = Field(default="", max_length=200)
    updated_at: str = ""
    updated_by: str = Field(default="", max_length=120)


class PanelTask(SQLModel, table=True):
    """Una tarea del equipo. Puede ir colgada de una persona (email)."""

    __tablename__ = "panel_task"

    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(default="", max_length=200)
    notas: str = Field(default="", max_length=2000)
    # "AAAA-MM-DD" o "" (sin fecha)
    fecha: str = Field(default="", max_length=10, index=True)
    prioridad: str = Field(default="normal", max_length=10)  # normal · alta
    estado: str = Field(default="pendiente", max_length=12, index=True)  # pendiente · hecha
    asignado_id: int = Field(default=0, index=True)  # 0 = sin asignar
    asignado: str = Field(default="", max_length=120)
    creado_por_id: int = 0
    creado_por: str = Field(default="", max_length=120)
    email: str = Field(default="", index=True, max_length=255)
    created_at: str = ""
    done_at: str = ""


class EmailLog(SQLModel, table=True):
    """Cada correo que manda la escuela (Resend). Para el historial del
    cliente. Empieza a llenarse el día que se desplegó: lo anterior no está, y
    lo que manda systeme.io tampoco (vive allí)."""

    __tablename__ = "email_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    asunto: str = Field(default="", max_length=300)
    ok: bool = True
    created_at: str = Field(default="", index=True)

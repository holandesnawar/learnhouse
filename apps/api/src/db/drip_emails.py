"""
Marca de "ya se avisó de este módulo a este alumno".

Existe solo para que el aviso de módulo abierto se mande UNA vez. El goteo no
tiene ningún evento propio —los módulos no "se abren", simplemente llega su
fecha y la pantalla deja de pintar el candado—, así que quien manda el correo
es una tarea diaria. Sin esta tabla, cualquier reintento de esa tarea (un fallo
de red, un lanzamiento a mano desde GitHub) le repetiría el correo a los
cuarenta alumnos.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class DripEmailSent(SQLModel, table=True):
    __tablename__ = "drip_email_sent"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    chapter_uuid: str = Field(index=True, max_length=255)
    sent_at: str = ""

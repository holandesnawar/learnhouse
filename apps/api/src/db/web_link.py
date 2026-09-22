"""
Enlaces cortos y redirecciones de la web, editables desde el panel.

`holandesnawar.com/<slug>` → `destination`, con sus UTM pegadas. La web no
sabe nada de esto en su código: cuando le piden una ruta que no existe,
pregunta a la escuela (`GET /api/v1/webs/resolver/<slug>`) y redirige. O sea
que crear, cambiar o apagar un enlace no pide despliegue.

Dos usos, misma tabla:
- "enlace": un atajo para repartir (`/ig`, `/guia`), con UTM y contador.
- "redireccion": una URL vieja que no puede quedarse en 404 (una landing
  renombrada). Sin UTM, normalmente.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class WebLink(SQLModel, table=True):
    __tablename__ = "web_link"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(index=True)
    # Sin barra inicial, en minúsculas: "ig", "guia-bases", "clase/jueves".
    slug: str = Field(index=True, max_length=120)
    destination: str = Field(default="", max_length=800)
    kind: str = Field(default="enlace", max_length=20)
    utm_source: str = Field(default="", max_length=120)
    utm_medium: str = Field(default="", max_length=120)
    utm_campaign: str = Field(default="", max_length=120)
    utm_content: str = Field(default="", max_length=120)
    # Para acordarse de para qué era.
    note: str = Field(default="", max_length=240)
    clicks: int = 0
    active: bool = True
    created_at: str = ""
    updated_at: str = ""


class WebLinkWrite(BaseModel):
    slug: str
    destination: str
    kind: str = "enlace"
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""
    note: str = ""
    active: bool = True

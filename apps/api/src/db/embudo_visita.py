"""
Las visitas a los embudos de la web, sin datos personales (20/10/2026).

Pedido del usuario: "qué porcentaje ve el anuncio y de ahí cuántos dejan su
mail y datos y cuántos no, cuántos ven el vídeo y continúan y cuántos en el
vídeo se van". La escuela solo sabía de quien dejaba sus datos; lo de antes
(quien vio la página y se fue) no llegaba a ninguna parte.

Una fila por SESIÓN del navegador y embudo: un número al azar que la web
guarda en `sessionStorage` (se pierde al cerrar la pestaña). Ni nombre, ni
correo, ni IP: solo el día, si llegó por un anuncio y hasta dónde llegó. Cada
paso nuevo de la misma sesión actualiza la misma fila (`video_pct` solo
sube). Ver services/contactos/embudo_visitas.py.
"""

from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class EmbudoVisita(SQLModel, table=True):
    __tablename__ = "embudo_visita"
    __table_args__ = (UniqueConstraint("sesion", "embudo", name="uq_embudo_visita_sesion"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    sesion: str = Field(default="", index=True, max_length=40)
    # anuncio (/formacion-nawar-fb) · web (/formacion) · admision (/proceso-de-admision)
    embudo: str = Field(default="", index=True, max_length=20)
    # Día de la primera vez, en hora de Países Bajos (AAAA-MM-DD).
    dia: str = Field(default="", index=True, max_length=10)
    # ads (llegó con un enlace de anuncio de pago) u organico.
    canal: str = Field(default="organico", max_length=10)
    utm_source: str = Field(default="", max_length=120)
    utm_medium: str = Field(default="", max_length=120)
    utm_campaign: str = Field(default="", max_length=120)
    utm_content: str = Field(default="", max_length=120)
    # Hasta dónde llegó.
    visita: bool = False
    datos: bool = False
    video_pct: int = 0
    formulario: bool = False
    preguntas: bool = False
    reserva: bool = False
    created_at: str = ""
    updated_at: str = ""

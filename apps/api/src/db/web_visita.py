"""
Las visitas a toda la web, sin datos personales (17/11/2026).

Pedido del usuario: "ver las analíticas más importantes de las webs dentro
del panel… de dónde viene el tráfico, cuántos leads se convirtieron por paid
vs orgánico, quién agendó llamada gracias a qué utm". Google Analytics no
sirve para eso: no une la visita con la persona y, desde el aviso de cookies
(10/11), solo cuenta a quien acepta.

Una fila por SESIÓN del navegador (un número al azar en `sessionStorage`,
que se pierde al cerrar la pestaña). Ni nombre, ni correo, ni IP: el día, la
web (www o el subdominio de Black Friday), la primera página, las páginas
vistas, la web de la que venía, la campaña del enlace y si es móvil. Cada
página nueva de la misma sesión actualiza la misma fila.

Es distinta de `embudo_visita` (hasta dónde llega una sesión en los tres
embudos con vídeo): esta cuenta TODAS las páginas. Ver
services/stats/analitica.py.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class WebVisita(SQLModel, table=True):
    __tablename__ = "web_visita"

    id: Optional[int] = Field(default=None, primary_key=True)
    sesion: str = Field(default="", unique=True, index=True, max_length=40)
    # Día de la primera página, en hora de Países Bajos (AAAA-MM-DD).
    dia: str = Field(default="", index=True, max_length=10)
    # www.holandesnawar.com, blackfriday.holandesnawar.com…
    host: str = Field(default="", max_length=60)
    # La primera página, como la ve la web (en el subdominio de Black Friday,
    # /black-friday/…).
    entrada: str = Field(default="", max_length=200)
    # Las páginas vistas, sin repetir y en orden (JSON, 30 como mucho).
    paginas: str = ""
    vistas: int = 0
    # La web de la que venía (solo el nombre, y solo si era de fuera).
    referrer: str = Field(default="", max_length=120)
    utm_source: str = Field(default="", max_length=120)
    utm_medium: str = Field(default="", max_length=120)
    utm_campaign: str = Field(default="", max_length=120)
    utm_content: str = Field(default="", max_length=120)
    utm_term: str = Field(default="", max_length=120)
    # movil · ordenador (por el ancho de la pantalla).
    dispositivo: str = Field(default="", max_length=10)
    created_at: str = ""
    updated_at: str = ""

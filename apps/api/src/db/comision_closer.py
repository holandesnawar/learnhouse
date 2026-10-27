"""
La comisión del closer de cada venta, ya pagada (27/10/2026).

Pedido del usuario: "una etiqueta para saber qué venta fue ya pagada la
comisión del closer… que lo vea yo solo". Una fila por venta (por correo, como
todo el panel) con el día en que se marcó, quién la marcó y, si se apuntó,
cuánto se le pagó. Sin fila = comisión pendiente. Tabla aprobada por el
usuario el 27/10. La lógica, en `services/panel/comisiones.py`.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class ComisionCloser(SQLModel, table=True):
    __tablename__ = "comision_closer"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    # Lo que se le pagó al closer, en céntimos. 0 = sin apuntar.
    importe_cents: int = 0
    pagada_at: str = ""
    pagada_por: str = Field(default="", max_length=120)
    nota: str = Field(default="", max_length=300)

"""
Llamadas templadas: gente que mostró interés pero se quedó ahí.

Pedido del usuario (05/10/2026): "una lista nueva en Llamadas para la gente
que mostró interés y se quedó a medias; que los que no terminaron el
formulario de agendar vayan directos ahí, y que el closer o yo podamos meter
gente a mano: nombre, móvil, notas y fecha de llamada más o menos".

Por eso aquí, a diferencia del resto de la ficha, el CORREO es opcional: a
alguien que escribió por WhatsApp o que conociste en persona solo le tienes el
número. Las filas automáticas sí llevan el correo (sale del formulario).
Con correo, las notas no se guardan aquí: son las de su ficha (`contact_nota`).
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class LlamadaTemplada(SQLModel, table=True):
    __tablename__ = "llamada_templada"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(default="", max_length=160)
    telefono: str = Field(default="", max_length=40)
    email: str = Field(default="", index=True, max_length=255)
    notas: str = Field(default="", max_length=4000)
    # Ya no se usa (05/10: "pendiente o hecho y ya", sin fechas). Se deja la
    # columna para no tocar la tabla ya creada.
    llamar_el: str = Field(default="", max_length=10)
    # mano · agendar · admision
    origen: str = Field(default="mano", max_length=20)
    # Para las automáticas, qué dejó a medias ("se fue después de «Horas»…").
    detalle: str = Field(default="", max_length=300)
    # caliente · templado · frio, puesta a mano por el equipo. Vacía = la
    # calcula la escuela. Va en `_ADDED_COLUMNS` (la tabla ya existía).
    temperatura_manual: str = Field(default="", max_length=12)
    # pendiente · hecha · descartada
    estado: str = Field(default="pendiente", index=True, max_length=20)
    # Las automáticas: "auto:<correo>". Única, para no meter a la misma persona
    # dos veces si dos pantallas abren la lista a la vez. Las de mano, vacía.
    clave: Optional[str] = Field(default=None, unique=True, max_length=280)
    creado_por: str = Field(default="", max_length=120)
    # Cuándo mostró interés (las automáticas) o cuándo se apuntó (las de mano).
    created_at: str = ""
    updated_at: str = ""
    hecha_at: str = ""

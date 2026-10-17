"""
Visión (17/10/2026): el mapa del negocio y el centro de campañas. Solo para
administradores. Ver `src/services/vision/` para el porqué de cada pieza.

- `vision_map`: un lienzo. El de arriba del todo («Inicio») no tiene padre;
  los demás son el submapa de un nodo (una vertical o una campaña).
- `vision_node`: una tarjeta del lienzo. Lo que tiene dentro (texto con
  formato, enlaces, lista de tareas, archivos) va en columnas de texto con
  JSON, como el resto de tablas de la escuela (`plan_pagos.facturas`).
- `vision_edge`: una flecha entre dos tarjetas del mismo lienzo.
- `vision_campaign_data`: los números de una campaña apuntados a mano, por
  día o por semana. Los campos que la escuela ya sabe (leads, agendadas,
  presentadas, ventas, ingresos) son opcionales: vacíos = que los ponga la
  escuela por el `utm_campaign` de la campaña.
- `vision_payment`: un pago apuntado a mano (lo que no pasó por la caja de la
  escuela, o para decir que una venta fue con Klarna).
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class VisionMapa(SQLModel, table=True):
    __tablename__ = "vision_map"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    nombre: str = Field(default="", max_length=200)
    # El nodo del que es submapa. None = el mapa de Inicio.
    nodo_padre_id: Optional[int] = Field(default=None, index=True)
    # {"x":…, "y":…, "zoom":…}: dónde se quedó la vista.
    vista: str = Field(default="")
    created_at: str = ""
    updated_at: str = ""


class VisionNodo(SQLModel, table=True):
    __tablename__ = "vision_node"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    mapa_id: int = Field(default=0, index=True)
    # vertical · campana · anuncio · contenido · embudo · tarea · nota · metrica
    tipo: str = Field(default="nota", max_length=20)
    titulo: str = Field(default="", max_length=200)
    # idea · pendiente · en-curso · hecho · bloqueado
    estado: str = Field(default="pendiente", max_length=20)
    urgente: bool = False
    importante: bool = False
    etiquetas: str = Field(default="[]")
    responsable: str = Field(default="", max_length=120)
    # "AAAA-MM-DD"
    inicio: str = Field(default="", max_length=10)
    fin: str = Field(default="", max_length=10)
    vence: str = Field(default="", max_length=10)
    x: float = 0
    y: float = 0
    color: str = Field(default="", max_length=20)
    # El documento de Tiptap (JSON).
    cuerpo: str = Field(default="")
    enlaces: str = Field(default="[]")
    checklist: str = Field(default="[]")
    archivos: str = Field(default="[]")
    # El lienzo de dentro, si se ha abierto (verticales y campañas).
    submapa_id: Optional[int] = Field(default=None, index=True)
    # Campañas: el mismo valor que el enlace del anuncio. Une la campaña con
    # los leads y las ventas de la escuela.
    utm_campaign: str = Field(default="", index=True, max_length=120)
    # Nodos de métrica: {"campana_id": n, "clave": "cac"}.
    metrica: str = Field(default="")
    created_at: str = ""
    updated_at: str = ""


class VisionFlecha(SQLModel, table=True):
    __tablename__ = "vision_edge"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    mapa_id: int = Field(default=0, index=True)
    origen: int = Field(default=0, index=True)
    destino: int = Field(default=0, index=True)
    etiqueta: str = Field(default="", max_length=120)
    created_at: str = ""


class VisionDato(SQLModel, table=True):
    __tablename__ = "vision_campaign_data"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    # El nodo de la campaña.
    nodo_id: int = Field(default=0, index=True)
    # "AAAA-MM-DD": el día, o el lunes de la semana.
    fecha: str = Field(default="", index=True, max_length=10)
    # dia · semana
    periodo: str = Field(default="dia", max_length=10)
    gasto_cents: int = 0
    impresiones: int = 0
    clics: int = 0
    # Vacío = lo pone la escuela.
    leads: Optional[int] = None
    agendadas: Optional[int] = None
    presentadas: Optional[int] = None
    ventas: Optional[int] = None
    ingresos_cents: Optional[int] = None
    devoluciones_cents: int = 0
    otros_gastos_cents: int = 0
    otros_concepto: str = Field(default="", max_length=200)
    # Una de las categorías de Gastos (publicidad, profes, herramientas…).
    otros_categoria: str = Field(default="otros", max_length=20)
    nota: str = Field(default="", max_length=500)
    created_at: str = ""


class VisionPago(SQLModel, table=True):
    __tablename__ = "vision_payment"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    nodo_id: int = Field(default=0, index=True)
    alumno: str = Field(default="", max_length=200)
    email: str = Field(default="", index=True, max_length=255)
    importe_cents: int = 0
    # unico · klarna · plazos · otro
    metodo: str = Field(default="unico", max_length=20)
    fecha: str = Field(default="", max_length=10)
    # Si pasó por llamada (cuenta para la comisión del closer).
    con_llamada: bool = True
    nota: str = Field(default="", max_length=300)
    created_at: str = ""

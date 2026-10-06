"""
Reserva de plaza con señal (06/10/2026).

El caso: Manuel está en la llamada, quiere entrar, pero Klarna o su tarjeta
fallan y no se cierra. Se le manda un enlace de 50 € como SEÑAL: con eso se
guarda su plaza, pero NO entra a la escuela. Cuando paga lo que falta (en uno
o en varios pagos), entonces sí: cuenta, correo de "crea tu contraseña" y
venta en las estadísticas, como un pago normal.

Dos tablas:
- `reserva_plaza`: una por persona y acuerdo. Lo que hay que pagar en total
  (`total_cents`) y lo que lleva pagado (`pagado_cents`, que se RECALCULA
  sumando sus pagos, nunca se incrementa a ciegas: así un aviso repetido de
  Stripe no puede contar dos veces).
- `reserva_pago`: cada enlace abierto es una fila. `pendiente` al crear la
  sesión de pago, `pagado` cuando Stripe lo confirma, `caducado` si se abrió
  otra vez el enlace y esta sesión quedó vieja.

Ojo: mientras la reserva está abierta NO hay fila `paid` en `enrollment`. Es
a propósito: medio panel lee `enrollment.status == "paid"` como "es alumno"
(ventas, plazas, tablero, quién ya no hay que llamar), y una señal no lo es.
La fila `paid` se crea al completarse, con el total cobrado.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class ReservaPlaza(SQLModel, table=True):
    __tablename__ = "reserva_plaza"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    product: str = Field(default="formacion-a0-a1", max_length=60)
    total_cents: int = 0
    pagado_cents: int = 0
    currency: str = Field(default="eur", max_length=8)
    # abierta → completada (pagó todo: ya es alumno) | cancelada
    estado: str = Field(default="abierta", index=True, max_length=20)
    stripe_customer_id: str = Field(default="", max_length=80)
    # La matrícula `paid` que se crea al completarse.
    enrollment_id: Optional[int] = Field(default=None)
    creado_por: str = Field(default="", max_length=120)
    created_at: str = Field(default="")
    updated_at: str = Field(default="")
    completada_at: str = Field(default="")
    cancelada_at: str = Field(default="")
    nota: str = Field(default="", max_length=400)


class ReservaPago(SQLModel, table=True):
    __tablename__ = "reserva_pago"

    id: Optional[int] = Field(default=None, primary_key=True)
    reserva_id: int = Field(default=0, index=True)
    # senal (el primero, sin completar) | parcial | resto (el que completa)
    tipo: str = Field(default="senal", max_length=20)
    importe_cents: int = 0
    currency: str = Field(default="eur", max_length=8)
    # pendiente → pagado | caducado
    estado: str = Field(default="pendiente", index=True, max_length=20)
    stripe_session_id: str = Field(default="", index=True, max_length=255)
    creado_por: str = Field(default="", max_length=120)
    created_at: str = Field(default="")
    paid_at: str = Field(default="")

"""
Plan de pagos propio: la formación en 3 pagos mensuales (14/10/2026).

Para quien no conoce Klarna o a quien Klarna le falla en la llamada. Es una
suscripción de Stripe al MISMO producto que corta sola al tercer cobro, y el
acceso se da con el PRIMER pago (riesgo asumido por el usuario: "con algo de
riesgo pero por un poco más de dinero").

Una fila por plan. `facturas` guarda las facturas de Stripe ya cobradas
(`{id: {"c": céntimos, "f": fecha}}`) y de ahí se RECALCULAN `cuotas_pagadas` y
`pagado_cents`: el mismo cobro puede llegar por el aviso de la sesión, por el
de la factura y por la comprobación diaria, y no puede contar dos veces.

La lógica está en services/payments/plazos.py.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class PlanPagos(SQLModel, table=True):
    __tablename__ = "plan_pagos"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    product: str = Field(default="formacion-a0-a1", max_length=60)
    # La matrícula `paid` que se crea con el primer cobro.
    enrollment_id: Optional[int] = Field(default=None, index=True)
    stripe_customer_id: str = Field(default="", max_length=80)
    # Única: si Stripe entrega dos veces a la vez el aviso del primer cobro,
    # solo uno crea la fila.
    stripe_subscription_id: str = Field(default="", index=True, unique=True, max_length=80)
    # El calendario de Stripe que corta la suscripción al tercer cobro.
    stripe_schedule_id: str = Field(default="", max_length=80)
    cuotas: int = 3
    cuota_cents: int = 0
    currency: str = Field(default="eur", max_length=8)
    cuotas_pagadas: int = 0
    pagado_cents: int = 0
    facturas: str = Field(default="{}")
    # activo → completado | fallido (un cobro no entró: Stripe reintenta) |
    # cancelado (Stripe dejó de intentarlo sin completar)
    estado: str = Field(default="activo", index=True, max_length=20)
    proximo_cobro: str = Field(default="")
    # Por qué falló el último cobro y de qué factura ya se avisó al equipo
    # (un aviso por factura, no uno por cada reintento de Stripe).
    fallo: str = Field(default="", max_length=400)
    fallo_avisado: str = Field(default="", max_length=80)
    creado_por: str = Field(default="", max_length=120)
    created_at: str = Field(default="")
    updated_at: str = Field(default="")
    completado_at: str = Field(default="")
    sincronizado_at: str = Field(default="")

"""
Enrollment intent — captures the buyer's profile BEFORE they hit Stripe.

Lets us:
  * pre-fill the Stripe Checkout (better UX, fewer drop-offs).
  * retarget anyone who matriculated but never finished the payment.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr
from sqlmodel import Field, SQLModel


class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollment"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(default="", index=True, max_length=255)
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    country: str = ""
    city: str = ""
    status: str = Field(default="pending", index=True)
    stripe_customer_id: str = ""
    stripe_session_id: str = Field(default="", index=True)
    created_at: str = ""
    updated_at: str = ""
    # Qué se compró y por cuánto. Se rellena al confirmar el cobro para que la
    # tabla de ventas salga de nuestra base de datos (exacta, y sin depender de
    # que Stripe conteste). `product` deja la puerta abierta al siguiente curso:
    # el día que se venda A1-A2 basta con etiquetarlo distinto.
    product: str = Field(default="formacion-a0-a1", index=True)
    amount_cents: int = 0
    currency: str = "eur"
    paid_at: str = Field(default="", index=True)


class EnrollmentCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str = ""
    country: str = ""
    city: str = ""


class EnrollmentResponse(BaseModel):
    checkout_url: str


class EnrollmentIntentResponse(BaseModel):
    """Returned by /payments/enroll-intent.

    Used by the embedded Stripe Elements checkout we host ourselves at
    /auth/matricula-formacion-nawar-a0-a1/pago. The matricula form
    redirects to `payment_url`; the page then mounts the PaymentElement
    against `client_secret` using `publishable_key`.
    """

    enrollment_id: int
    client_secret: str
    publishable_key: str
    payment_url: str


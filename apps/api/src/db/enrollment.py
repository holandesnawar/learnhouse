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


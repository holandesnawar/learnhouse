"""
Enrollment intent — captures the buyer's profile BEFORE they hit Stripe.

Lets us:
  * pre-fill the Stripe Checkout (better UX, fewer drop-offs).
  * retarget anyone who matriculated but never finished the payment.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, ForeignKey, Index, Integer, JSON, String
from sqlmodel import Field, SQLModel


class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollment"
    __table_args__ = (
        Index("ix_enrollment_email", "email"),
        Index("ix_enrollment_stripe_session", "stripe_session_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(sa_column=Column(String(255), index=True))
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    country: str = ""
    city: str = ""
    # "pending" → just filled the form. "paid" → Stripe confirmed. "abandoned" → session expired.
    status: str = "pending"
    stripe_customer_id: str = ""
    stripe_session_id: str = ""
    extra: dict = Field(default_factory=dict, sa_column=Column(JSON))
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

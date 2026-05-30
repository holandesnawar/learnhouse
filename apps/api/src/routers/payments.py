"""Public endpoints driving Stripe checkout + webhook for the formación."""

import logging

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.enrollment import EnrollmentCreate, EnrollmentResponse
from src.services.payments.payments import (
    create_formacion_checkout_session,
    enroll_and_checkout,
    process_webhook_event,
)


logger = logging.getLogger(__name__)


router = APIRouter()


@router.post(
    "/enroll",
    response_model=EnrollmentResponse,
    summary="Save the enrollment intent + open a pre-filled Stripe Checkout.",
)
async def api_enroll(
    data: EnrollmentCreate,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    url = await enroll_and_checkout(data, db_session)
    return EnrollmentResponse(checkout_url=url)


@router.get(
    "/checkout/formacion",
    summary="Redirect the buyer to a Stripe Checkout Session for the formación.",
    description=(
        "Public endpoint. The external landing's 'Comprar' button can link straight "
        "to this URL — we create the session server-side and 302 to Stripe."
    ),
)
async def api_checkout_formacion(request: Request):
    url = await create_formacion_checkout_session()
    return RedirectResponse(url=url, status_code=303)


@router.post(
    "/webhook",
    summary="Stripe webhook receiver — provisions the academy account on payment.",
    description=(
        "Configured in Stripe Dashboard: send `checkout.session.completed`. "
        "Signature is verified against LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET."
    ),
)
async def api_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
    db_session: AsyncSession = Depends(get_db_session),
):
    payload = await request.body()
    return await process_webhook_event(request, payload, stripe_signature, db_session)

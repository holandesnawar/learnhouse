"""Public endpoints driving Stripe checkout + webhook for the formación."""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.enrollment import EnrollmentCreate, EnrollmentIntentResponse, EnrollmentResponse
from src.services.payments.payments import (
    create_formacion_checkout_session,
    enroll_and_checkout,
    enroll_and_payment_intent,
    ensure_matricula_abierta,
    get_seat_status,
    process_webhook_event,
)
from src.services.security.rate_limiting import check_enroll_rate_limit


logger = logging.getLogger(__name__)


router = APIRouter()


def _enforce_enroll_rate_limit(request: Request) -> None:
    """5/hour/IP. Returns 429 with a Retry-After header when exhausted so
    the client (matrícula form on holandesnawar.com) can surface a useful
    message and Cloudflare will honour the backoff."""
    is_allowed, retry_after = check_enroll_rate_limit(request)
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Vuelve a probar en unos minutos.",
            headers={"Retry-After": str(max(1, retry_after))},
        )


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
    _enforce_enroll_rate_limit(request)
    url = await enroll_and_checkout(data, db_session)
    return EnrollmentResponse(checkout_url=url)


@router.post(
    "/enroll-intent",
    response_model=EnrollmentIntentResponse,
    summary="Save the enrollment intent + create a PaymentIntent for our embedded checkout.",
    description=(
        "Use when the buyer should stay on the Nawar-branded payment page "
        "(/auth/matricula-formacion-nawar-a0-a1/pago) instead of being "
        "redirected to Stripe-hosted Checkout. Returns a client_secret the "
        "front-end mounts against Stripe Elements + a publishable_key + a "
        "payment_url to redirect to."
    ),
)
async def api_enroll_intent(
    data: EnrollmentCreate,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    _enforce_enroll_rate_limit(request)
    result = await enroll_and_payment_intent(data, db_session)
    return EnrollmentIntentResponse(**result)


@router.get(
    "/checkout/formacion",
    summary="Redirect the buyer to a Stripe Checkout Session for the formación.",
    description=(
        "Public endpoint. The external landing's 'Comprar' button can link straight "
        "to this URL — we create the session server-side and 302 to Stripe."
    ),
)
async def api_checkout_formacion(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    _enforce_enroll_rate_limit(request)
    await ensure_matricula_abierta(db_session)
    url = await create_formacion_checkout_session()
    return RedirectResponse(url=url, status_code=303)


@router.get(
    "/plazas",
    summary="Plazas de la convocatoria y si la matrícula sigue abierta.",
    description=(
        "Público y sin autenticación: lo consulta la web (holandesnawar.com) para "
        "decidir a dónde mandan los botones y para enseñar 'quedan X plazas'. "
        "Devuelve {abierta, plazas_totales, ocupadas, quedan}; `quedan` es null "
        "cuando no hay tope configurado."
    ),
)
async def api_plazas(db_session: AsyncSession = Depends(get_db_session)):
    return await get_seat_status(db_session)


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

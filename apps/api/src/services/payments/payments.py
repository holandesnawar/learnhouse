"""
Stripe payments: one-time checkout for the Holandés Nawar formación.

Flow:
  1. External landing button → GET /api/v1/payments/checkout/formacion
     redirects the buyer to a Stripe-hosted Checkout Session.
  2. Buyer pays on Stripe.
  3. Stripe fires checkout.session.completed → POST /payments/webhook.
  4. We create the academy account, mark email verified, generate a
     password-reset code, send a "welcome + create your password" email.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from urllib.parse import quote
from uuid import uuid4

import stripe
from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config.config import get_learnhouse_config
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserRead
from src.security.security import security_hash_password
from src.services.users.emails import send_payment_welcome_email
from src.services.users.password_reset import generate_secure_reset_code

logger = logging.getLogger(__name__)


# ── config helpers ─────────────────────────────────────────────────────────

def _stripe_secret() -> str:
    cfg = get_learnhouse_config()
    key = getattr(getattr(cfg.payments_config, "stripe", None), "stripe_secret_key", None)
    if not key:
        raise HTTPException(status_code=500, detail="Stripe secret key not configured")
    return key


def _webhook_secret() -> str:
    cfg = get_learnhouse_config()
    key = getattr(
        getattr(cfg.payments_config, "stripe", None),
        "stripe_webhook_standard_secret",
        None,
    )
    if not key:
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured")
    return key


def _formacion_price_id() -> str:
    price = os.environ.get("LEARNHOUSE_STRIPE_FORMACION_PRICE_ID")
    if not price:
        raise HTTPException(status_code=500, detail="Formación price id not configured")
    return price


def _stripe_publishable() -> str:
    """Public key the embedded Elements checkout needs to talk to Stripe.

    Plain LEARNHOUSE_STRIPE_PUBLISHABLE_KEY env var — no `NEXT_PUBLIC_`
    prefix because the value is served by the API, not baked into the
    Next.js bundle (so it doesn't matter which mode the page renders in
    and we can swap test ↔ live without rebuilding the front-end).
    """
    key = os.environ.get("LEARNHOUSE_STRIPE_PUBLISHABLE_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="Stripe publishable key not configured")
    return key


def _academy_url() -> str:
    cfg = get_learnhouse_config()
    domain = getattr(cfg.hosting_config, "domain", None)
    if domain:
        return f"https://{domain}".rstrip("/")
    return "https://academia.holandesnawar.nl"


# ── checkout ───────────────────────────────────────────────────────────────

async def create_formacion_checkout_session() -> str:
    """Create a Stripe Checkout Session for the formación and return its URL.

    The URL is unique per click — the caller (HTTP handler) should 302 to it.
    """
    stripe.api_key = _stripe_secret()
    academy = _academy_url()
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": _formacion_price_id(), "quantity": 1}],
            success_url=f"{academy}/auth/bienvenido?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{academy}/",
            allow_promotion_codes=True,
            # Force a Customer to be created with the buyer's email so Stripe
            # has someone to send the receipt to.
            customer_creation="always",
            # Generate an actual Stripe Invoice (PDF) and attach it to the
            # receipt email — same experience the old Payment Links had.
            invoice_creation={
                "enabled": True,
                "invoice_data": {
                    "description": "Formación Nawar A0-A1",
                    "footer": "Gracias por unirte a Holandés Nawar.",
                    "metadata": {"product": "formacion-a0-a1"},
                },
            },
            metadata={"product": "formacion-a0-a1"},
        )
    except Exception as exc:
        logger.exception("Stripe checkout creation failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not create checkout session: {exc}",
        )

    url = session.get("url") if hasattr(session, "get") else getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL")
    return url


# ── enrollment (matricula form → pre-filled checkout) ───────────────────────

async def enroll_and_checkout(
    data,
    db_session: AsyncSession,
) -> str:
    """Save the prospect, create a Stripe Customer with their data, open a
    Checkout Session pre-filled with all of it, and return the URL."""
    from src.db.enrollment import Enrollment, EnrollmentCreate  # noqa: F401

    stripe.api_key = _stripe_secret()
    academy = _academy_url()

    email = str(data.email).strip().lower()
    full_name = f"{data.first_name} {data.last_name}".strip() or data.first_name or "Alumno"

    # Stripe Customer first so checkout opens with name/email/phone pre-filled.
    try:
        customer = stripe.Customer.create(
            email=email,
            name=full_name,
            phone=data.phone or None,
            metadata={
                "country": data.country or "",
                "city": data.city or "",
                "source": "matricula-form",
            },
        )
    except Exception as exc:
        logger.exception("Stripe customer creation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create Stripe customer: {exc}")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer.id,
            line_items=[{"price": _formacion_price_id(), "quantity": 1}],
            success_url=f"{academy}/auth/bienvenido?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{academy}/auth/matricula-formacion-nawar-a0-a1",
            allow_promotion_codes=True,
            invoice_creation={
                "enabled": True,
                "invoice_data": {
                    "description": "Formación Nawar A0-A1",
                    "footer": "Gracias por unirte a Holandés Nawar.",
                    "metadata": {"product": "formacion-a0-a1"},
                },
            },
            metadata={
                "product": "formacion-a0-a1",
                "source": "matricula-form",
                "country": data.country or "",
                "city": data.city or "",
                "phone": data.phone or "",
            },
        )
    except Exception as exc:
        logger.exception("Stripe checkout creation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create checkout session: {exc}")

    now = datetime.now().isoformat()
    row = Enrollment(
        email=email,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone or "",
        country=data.country or "",
        city=data.city or "",
        status="pending",
        stripe_customer_id=customer.id,
        stripe_session_id=session.id,
        created_at=now,
        updated_at=now,
    )
    db_session.add(row)
    await db_session.commit()

    url = session.get("url") if hasattr(session, "get") else getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL")
    return url


async def _mark_enrollment_paid(session_id: str, db_session: AsyncSession) -> None:
    """Best-effort update of the matching enrollment row when payment succeeds."""
    try:
        from src.db.enrollment import Enrollment
        statement = select(Enrollment).where(Enrollment.stripe_session_id == session_id)
        row = (await db_session.execute(statement)).scalars().first()
        if not row:
            return
        row.status = "paid"
        row.updated_at = datetime.now().isoformat()
        db_session.add(row)
        await db_session.commit()
    except Exception:
        logger.exception("Could not mark enrollment %s as paid", session_id)


# ── embedded checkout (Stripe Elements) ────────────────────────────────────

async def enroll_and_payment_intent(data, db_session: AsyncSession) -> dict:
    """Save the prospect + create a PaymentIntent for our embedded Elements
    checkout (the page at /auth/matricula-formacion-nawar-a0-a1/pago).

    Returns {enrollment_id, client_secret, publishable_key, payment_url}.
    Stripe will surface card + Apple Pay + Google Pay + Klarna + iDEAL +
    everything else enabled in Dashboard via `automatic_payment_methods`.
    """
    from src.db.enrollment import Enrollment

    stripe.api_key = _stripe_secret()
    academy = _academy_url()

    email = str(data.email).strip().lower()
    full_name = f"{data.first_name} {data.last_name}".strip() or data.first_name or "Alumno"

    # Pull amount + currency off the Price so we don't hardcode the figure.
    try:
        price = stripe.Price.retrieve(_formacion_price_id())
        unit_amount = price.get("unit_amount") if hasattr(price, "get") else getattr(price, "unit_amount", None)
        currency_raw = price.get("currency") if hasattr(price, "get") else getattr(price, "currency", "eur")
    except Exception as exc:
        logger.exception("Stripe price retrieval failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not load price: {exc}")
    amount = int(unit_amount or 0)
    currency = (currency_raw or "eur").lower()
    if amount <= 0:
        raise HTTPException(status_code=500, detail="Configured price has empty unit_amount")

    # Stripe Customer first so the PI is linked + receipt/wallet UIs show the name.
    try:
        customer = stripe.Customer.create(
            email=email,
            name=full_name,
            phone=data.phone or None,
            metadata={
                "country": data.country or "",
                "city": data.city or "",
                "source": "matricula-form-elements",
            },
        )
    except Exception as exc:
        logger.exception("Stripe customer creation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create Stripe customer: {exc}")

    # Persist the enrollment row first so we have its id for the PI metadata.
    now = datetime.now().isoformat()
    row = Enrollment(
        email=email,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone or "",
        country=data.country or "",
        city=data.city or "",
        status="pending",
        stripe_customer_id=customer.id,
        stripe_session_id="",
        created_at=now,
        updated_at=now,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)

    try:
        # Explicit list instead of automatic_payment_methods so we control
        # exactly what shows up:
        #   - no 'link'        → no "Save my info / Stripe Link" prompt
        #     (Stripe's account-level toggle keeps moving around the dashboard
        #     so we kill it deterministically here)
        #   - no 'sepa_debit'  → no "Adeudo SEPA" tab (slow, refundable, niche)
        #   Card automatically surfaces Apple Pay / Google Pay as wallets
        #   when the device + browser support them; nothing to add for those.
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            customer=customer.id,
            receipt_email=email,
            description="Formación Nawar A0-A1",
            payment_method_types=["card", "ideal", "klarna", "bancontact"],
            metadata={
                "product": "formacion-a0-a1",
                "source": "matricula-form-elements",
                "enrollment_id": str(row.id or ""),
                "country": data.country or "",
                "city": data.city or "",
                "phone": data.phone or "",
                "first_name": data.first_name,
                "last_name": data.last_name,
            },
        )
    except Exception as exc:
        logger.exception("Stripe PaymentIntent creation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create payment intent: {exc}")

    # Stash the PI id on the same column we already use for Checkout Sessions,
    # so /webhook lookups + admin queries see one identifier regardless of flow.
    row.stripe_session_id = intent.id
    row.updated_at = datetime.now().isoformat()
    db_session.add(row)
    await db_session.commit()

    client_secret = (
        intent.client_secret
        if hasattr(intent, "client_secret")
        else (intent.get("client_secret") if hasattr(intent, "get") else None)
    )
    if not client_secret:
        raise HTTPException(status_code=502, detail="Stripe did not return a client secret")

    publishable_key = _stripe_publishable()

    # Carry the buyer's data forward into the URL so the checkout page can
    # confirm it back to them ("Pagando como X — email@y.com") and pre-fill
    # Stripe's billing fields. quote() handles +/spaces in phone numbers
    # and names; email goes through too for safety.
    em = quote(email, safe="")
    nm = quote(full_name, safe="")
    ph = quote(data.phone or "", safe="")

    return {
        "enrollment_id": row.id or 0,
        "client_secret": client_secret,
        "publishable_key": publishable_key,
        # pk is public by definition (Stripe.js needs it client-side, prefix
        # `pk_test_` / `pk_live_`); URL param avoids a round-trip on page load.
        # `amt` is the unit_amount in cents straight off the Price object so
        # the checkout summary stays in sync when you bump the price in
        # Stripe Dashboard without redeploying anything.
        # We re-use the matricula route + dispatch on cs/pk presence inside
        # the page itself — every attempt at a new sub/sibling auth route
        # kept 404ing in the Railway image, but the matricula path has been
        # in the deployed image for weeks so we know Next.js will serve it.
        "payment_url": (
            f"{academy}/auth/matricula-formacion-nawar-a0-a1"
            f"?ei={row.id or 0}&cs={client_secret}&pk={publishable_key}"
            f"&amt={amount}&cur={currency}"
            f"&em={em}&nm={nm}&ph={ph}"
        ),
    }


def _create_post_hoc_invoice(
    customer_id: str,
    amount: int,
    currency: str,
    description: str,
) -> None:
    """Generate a finalized 'paid out of band' Invoice for a PaymentIntent
    that already settled, so the buyer still gets the same NAWAR-XXXX PDF
    Stripe Checkout produced automatically. Best-effort: a Stripe hiccup
    here must never block account provisioning."""
    try:
        stripe.InvoiceItem.create(
            customer=customer_id,
            amount=amount,
            currency=currency,
            description=description,
        )
        invoice = stripe.Invoice.create(
            customer=customer_id,
            collection_method="send_invoice",
            days_until_due=0,
            auto_advance=False,
        )
        stripe.Invoice.finalize_invoice(invoice.id)
        stripe.Invoice.pay(invoice.id, paid_out_of_band=True)
    except Exception:
        logger.exception("Post-hoc invoice creation failed for customer %s", customer_id)


# ── user provisioning (internal — no RBAC, trusted webhook) ────────────────

async def _get_default_org(db_session: AsyncSession) -> Organization:
    """Single-tenant academy: there's exactly one organization, return it."""
    statement = select(Organization)
    org = (await db_session.execute(statement)).scalars().first()
    if not org:
        raise HTTPException(status_code=500, detail="No organization to enrol the new student into")
    return org


def _derive_username(email: str) -> str:
    base = email.split("@")[0].lower()
    # Make it filesystem/URL-safe and reasonably unique by suffixing 4 random hex.
    base = "".join(c for c in base if c.isalnum() or c in {".", "-", "_"})[:24] or "alumno"
    return f"{base}-{secrets.token_hex(2)}"


async def _create_paid_user(
    email: str,
    full_name: str,
    db_session: AsyncSession,
) -> tuple[User, bool]:
    """Create the user + link to the org as a regular member.

    Returns (user, created) where `created` is True only the first time the
    account is provisioned. On Stripe webhook retries the email already exists,
    so we reuse it and return created=False — the caller uses that to avoid
    sending duplicate welcome emails / generating duplicate invoices.

    Bypasses RBAC because the caller is the Stripe webhook (signature-verified).
    Password is a random throwaway — the student picks their real one via the
    "create your password" email link.
    """
    org = await _get_default_org(db_session)

    # If the email already exists (e.g. Stripe retried the webhook), reuse it.
    existing = (
        await db_session.execute(select(User).where(User.email == email))
    ).scalars().first()
    if existing:
        # Make sure they're linked to the org. Re-issuing the welcome email is fine.
        link = (
            await db_session.execute(
                select(UserOrganization).where(
                    UserOrganization.user_id == existing.id,
                    UserOrganization.org_id == org.id,
                )
            )
        ).scalars().first()
        if not link:
            link = UserOrganization(
                user_id=existing.id or 0,
                org_id=org.id or 0,
                role_id=4,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
            db_session.add(link)
            await db_session.commit()
        return existing, False

    first_name, _, last_name = (full_name or "").strip().partition(" ")

    user = User(
        user_uuid=f"user_{uuid4()}",
        username=_derive_username(email),
        email=email,
        first_name=first_name or "Alumno",
        last_name=last_name or "",
        password=security_hash_password(secrets.token_urlsafe(32)),
        email_verified=True,  # paid → trusted email
        email_verified_at=datetime.now(timezone.utc).isoformat(),
        signup_method="stripe",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    link = UserOrganization(
        user_id=user.id or 0,
        org_id=org.id or 0,
        role_id=4,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(link)
    await db_session.commit()
    return user, True


def _store_reset_code(user: User) -> Optional[str]:
    """Generate a reset code and stash it in Redis so /reset works for it."""
    from src.core.redis import get_redis_client  # local import — avoid heavy boot
    code = generate_secure_reset_code(length=8)
    ttl = 60 * 60  # 1 hour
    obj = {
        "reset_code": code,
        "reset_code_expires": int(datetime.now().timestamp()) + ttl,
        "reset_code_type": "password_reset",
        "created_at": datetime.now().isoformat(),
        "created_by": user.user_uuid,
    }
    try:
        r = get_redis_client()
        if not r:
            logger.error("Redis unavailable while storing reset code for %s", user.user_uuid)
            return None
        r.set(
            f"pwd_reset:user:{user.user_uuid}:platform:code:{code}",
            json.dumps(obj),
            ex=ttl,
        )
        return code
    except Exception:
        logger.exception("Could not write reset code to Redis")
        return None


# ── webhook entrypoint ─────────────────────────────────────────────────────

async def process_webhook_event(
    request: Request,
    payload: bytes,
    signature: str,
    db_session: AsyncSession,
) -> dict:
    secret = _webhook_secret()
    try:
        # Verify the signature only — we don't need the StripeObject Stripe
        # returns, since its proxy doesn't expose plain-dict semantics on
        # every Python release (no .get() on 3.14+) and trips the handler.
        stripe.Webhook.construct_event(payload, signature, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as exc:  # signature, parsing — surface as 400
        raise HTTPException(status_code=400, detail=f"Webhook signature check failed: {exc}")

    # Parse the raw payload as a plain dict so every downstream .get() works.
    try:
        event = json.loads(payload.decode("utf-8") if isinstance(payload, (bytes, bytearray)) else payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}")
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Webhook payload is not an object")

    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    try:
        if event_type == "checkout.session.completed":
            return await _handle_checkout_session(obj, db_session)
        if event_type == "payment_intent.succeeded":
            return await _handle_payment_intent(obj, db_session)
        return {"detail": f"ignored:{event_type}"}
    except HTTPException:
        raise
    except Exception as exc:
        # Surface the actual error in the response so Stripe's webhook delivery
        # log shows what broke (otherwise we only see "Internal Server Error").
        logger.exception("Webhook processing failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {exc}",
        )


async def _provision_after_payment(
    email: str,
    name: str,
    db_session: AsyncSession,
) -> dict:
    """Shared post-payment work: create the user, store a reset code, send
    the welcome email, tag in the CRM. Used by both webhook flows so behaviour
    stays identical whether the buyer paid via Checkout or Elements."""
    if not email:
        logger.error("post-payment provisioning called without email")
        return {"detail": "no email", "created": False}

    user, created = await _create_paid_user(email, name, db_session)

    if not created:
        # Stripe retried the webhook (or it was delivered twice): the account
        # was already provisioned. Re-assert the CRM tag (idempotent) but do
        # NOT re-send the welcome email — otherwise the student gets a fresh
        # "create your password" mail on every duplicate delivery.
        try:
            from src.services.crm.systeme import mark_as_alumno
            await mark_as_alumno(email)
        except Exception:
            logger.exception("Systeme tag update failed for %s", email)
        logger.info("Account for %s already provisioned — skipping welcome email", email)
        return {"detail": "already provisioned", "created": False}

    code = _store_reset_code(user)
    if not code:
        logger.error("Could not generate reset code for %s; user exists, email not sent", email)
        return {"detail": "user created but reset email could not be sent", "created": True}

    user_read = UserRead.model_validate(user)
    try:
        send_payment_welcome_email(
            email=user_read.email,
            name=name or user.first_name or "",
            reset_code=code,
            base_url=_academy_url(),
        )
    except Exception:
        logger.exception("Welcome email send failed for %s", email)

    try:
        from src.services.crm.systeme import mark_as_alumno
        await mark_as_alumno(email)
    except Exception:
        logger.exception("Systeme tag update failed for %s", email)

    return {"detail": "ok", "created": True}


async def _handle_checkout_session(obj: dict, db_session: AsyncSession) -> dict:
    """Legacy flow: Stripe-hosted Checkout Session has completed."""
    if obj.get("payment_status") != "paid":
        return {"detail": "session not paid"}

    session_id = obj.get("id") or ""
    if session_id:
        await _mark_enrollment_paid(session_id, db_session)

    email = (
        (obj.get("customer_details") or {}).get("email")
        or obj.get("customer_email")
        or ""
    ).strip().lower()
    name = ((obj.get("customer_details") or {}).get("name") or "").strip()
    return await _provision_after_payment(email, name, db_session)


async def _handle_payment_intent(obj: dict, db_session: AsyncSession) -> dict:
    """Embedded Elements flow: PaymentIntent succeeded. We look up the
    enrollment by metadata.enrollment_id (set when the PI was created)
    so we have an authoritative email + name to provision against."""
    intent_id = obj.get("id") or ""
    enrollment_id_str = (obj.get("metadata") or {}).get("enrollment_id") or ""

    enrollment = None
    if enrollment_id_str:
        try:
            from src.db.enrollment import Enrollment
            statement = select(Enrollment).where(Enrollment.id == int(enrollment_id_str))
            enrollment = (await db_session.execute(statement)).scalars().first()
        except Exception:
            logger.exception("Lookup of enrollment %s failed", enrollment_id_str)

    if not enrollment:
        logger.error("payment_intent.succeeded without enrollment match (intent=%s)", intent_id)
        return {"detail": "no enrollment"}

    if enrollment.status != "paid":
        enrollment.status = "paid"
        enrollment.updated_at = datetime.now().isoformat()
        db_session.add(enrollment)
        await db_session.commit()

    email = (enrollment.email or "").strip().lower()
    name = f"{enrollment.first_name} {enrollment.last_name}".strip()

    result = await _provision_after_payment(email, name, db_session)

    # Post-hoc invoice so the buyer still gets the same NAWAR-XXXX PDF Checkout
    # would have generated automatically. Best-effort — never block on it.
    # Only on first provisioning: on a Stripe retry the account already existed
    # (created=False) and we must NOT cut a second invoice for the same payment.
    amount = int(obj.get("amount_received") or obj.get("amount") or 0)
    currency = (obj.get("currency") or "eur").lower()
    customer_id = obj.get("customer") or enrollment.stripe_customer_id or ""
    if result.get("created") and customer_id and amount > 0:
        _create_post_hoc_invoice(
            customer_id=customer_id,
            amount=amount,
            currency=currency,
            description="Formación Nawar A0-A1",
        )

    return result

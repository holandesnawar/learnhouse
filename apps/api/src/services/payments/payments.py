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
from typing import Optional
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
            success_url=f"{academy}/bienvenido?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{academy}/",
            allow_promotion_codes=True,
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
) -> User:
    """Create the user + link to the org as a regular member.

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
        return existing

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
    return user


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
        event = stripe.Webhook.construct_event(payload, signature, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:  # type: ignore[attr-defined]
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    if event_type != "checkout.session.completed":
        # Quietly acknowledge other events so Stripe stops retrying.
        return {"detail": f"ignored:{event_type}"}

    obj = event["data"]["object"]
    if obj.get("payment_status") != "paid":
        return {"detail": "session not paid"}

    email = (
        (obj.get("customer_details") or {}).get("email")
        or obj.get("customer_email")
        or ""
    ).strip().lower()
    name = ((obj.get("customer_details") or {}).get("name") or "").strip()

    if not email:
        logger.error("checkout.session.completed without email — cannot provision")
        return {"detail": "no email"}

    user = await _create_paid_user(email, name, db_session)

    code = _store_reset_code(user)
    if not code:
        logger.error("Could not generate reset code for %s; will not send welcome email", email)
        return {"detail": "user created but reset email could not be sent"}

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
        # We don't fail the webhook — the user exists, we can resend manually.

    return {"detail": "ok"}

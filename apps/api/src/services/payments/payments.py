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
from datetime import datetime, timedelta, timezone
from typing import Optional, TYPE_CHECKING
from urllib.parse import quote
from uuid import uuid4

import stripe
from fastapi import HTTPException, Request
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from config.config import get_learnhouse_config
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserRead
from src.security.security import security_hash_password
from src.services.users.emails import send_payment_welcome_email
from src.services.users.password_reset import generate_secure_reset_code
from src.services.orgs.groups import add_user_to_students

logger = logging.getLogger(__name__)


# ── config helpers ─────────────────────────────────────────────────────────

def _stripe_secret() -> str:
    cfg = get_learnhouse_config()
    key = getattr(getattr(cfg.payments_config, "stripe", None), "stripe_secret_key", None)
    if not key:
        raise HTTPException(status_code=500, detail="Stripe secret key not configured")
    return key


def _usar_stripe() -> None:
    """
    Deja la clave puesta antes de hablar con Stripe. **Llamar SIEMPRE.**

    Por qué existe, que es el fallo más caro de todo el circuito de cobro:

    `stripe.api_key` es una variable global del módulo, y solo se ponía en las
    tres funciones que CREAN cosas (la sesión de pago y el PaymentIntent). El
    webhook no la ponía nunca — y no saltaba ningún error, porque comprobar la
    firma (`stripe.Webhook.construct_event`) es una cuenta local que no llama a
    Stripe y por tanto no necesita clave.

    Resultado: el webhook verificaba bien, marcaba la matrícula como pagada, y
    en cuanto intentaba emitir la factura Stripe contestaba "No API key
    provided". Ese error caía en el `except` de la factura, que se lo traga a
    propósito para no dejar al alumno sin cuenta. Así que el cobro parecía
    perfecto y la factura no salía nunca, sin una sola señal en ninguna parte.

    Llevaba roto desde que se cambió el Checkout de Stripe por el nuestro, que
    es justo cuando se dejó de recibir la factura buena.
    """
    stripe.api_key = _stripe_secret()


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


# ── puertas: plazas de la convocatoria ─────────────────────────────────────
#
# Cerrar puertas tiene que valer para TODO el tráfico, no solo para el botón
# de la landing: el enlace de la matrícula viaja en correos ya enviados y por
# WhatsApp, así que la puerta de verdad está aquí, en el servidor.
#
#   LEARNHOUSE_FORMACION_PLAZAS   nº de plazas de la convocatoria (0 = sin tope)
#   LEARNHOUSE_MATRICULA_ABIERTA  "no" cierra a mano, aunque queden plazas

def _plazas_totales() -> int:
    raw = (os.environ.get("LEARNHOUSE_FORMACION_PLAZAS") or "").strip()
    if raw.isdigit():
        return int(raw)
    if raw:
        # "40 plazas" en vez de "40" dejaría la convocatoria sin tope y sin que
        # nadie se entere hasta contar los cobros. Que al menos quede dicho.
        logger.error(
            "LEARNHOUSE_FORMACION_PLAZAS=%r no es un número: la matrícula queda SIN tope de plazas",
            raw,
        )
    return 0


def _cerrada_a_mano() -> bool:
    raw = (os.environ.get("LEARNHOUSE_MATRICULA_ABIERTA") or "si").strip().lower()
    return raw in {"no", "false", "0", "cerrada", "off"}


async def get_seat_status(db_session: AsyncSession) -> dict:
    """Plazas vendidas y si la matrícula sigue abierta.

    Cuenta matrículas `paid`, que es lo único que significa "plaza ocupada":
    las `pending` son gente que rellenó el formulario y no llegó a pagar, y
    contarlas cerraría la convocatoria antes de tiempo.
    """
    from src.db.enrollment import Enrollment

    total = _plazas_totales()
    ocupadas = 0
    try:
        statement = select(func.count()).select_from(Enrollment).where(Enrollment.status == "paid")
        ocupadas = int((await db_session.execute(statement)).scalar() or 0)
    except Exception:
        # Si la cuenta falla no cerramos la tienda por nuestra cuenta: se
        # informa de 0 ocupadas y manda el interruptor manual.
        logger.exception("No se pudieron contar las plazas ocupadas")

    abierta = not _cerrada_a_mano() and (total == 0 or ocupadas < total)
    return {
        "abierta": abierta,
        "plazas_totales": total,
        "ocupadas": ocupadas,
        # null cuando no hay tope configurado.
        "quedan": max(0, total - ocupadas) if total else None,
    }


async def ensure_matricula_abierta(db_session: AsyncSession) -> None:
    """403 con un mensaje que la web puede enseñar tal cual."""
    status = await get_seat_status(db_session)
    if not status["abierta"]:
        raise HTTPException(
            status_code=403,
            detail=(
                "Las plazas de esta convocatoria están completas. "
                "Apúntate a la lista de espera y te avisamos de la próxima."
            ),
        )


def _academy_url() -> str:
    """La dirección de la escuela. Una sola definición, en `emails.py`."""
    from src.services.users.emails import _school_url

    return _school_url()


# ── checkout ───────────────────────────────────────────────────────────────

async def create_formacion_checkout_session() -> str:
    """Create a Stripe Checkout Session for the formación and return its URL.

    The URL is unique per click — the caller (HTTP handler) should 302 to it.
    """
    _usar_stripe()
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

    await ensure_matricula_abierta(db_session)

    _usar_stripe()
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


async def _mark_enrollment_paid(
    session_id: str, db_session: AsyncSession, amount_cents: int = 0, currency: str = "eur"
) -> None:
    """Best-effort update of the matching enrollment row when payment succeeds."""
    try:
        from src.db.enrollment import Enrollment
        statement = select(Enrollment).where(Enrollment.stripe_session_id == session_id)
        row = (await db_session.execute(statement)).scalars().first()
        if not row:
            return
        row.status = "paid"
        row.updated_at = datetime.now().isoformat()
        if not row.paid_at:
            row.paid_at = datetime.now(timezone.utc).isoformat()
        if amount_cents > 0:
            row.amount_cents = amount_cents
            row.currency = currency
        db_session.add(row)
        await db_session.commit()
    except Exception:
        logger.exception("Could not mark enrollment %s as paid", session_id)


# ── embedded checkout (Stripe Elements) ────────────────────────────────────

#: Cuánto tiempo se considera que una matrícula sin pagar sigue siendo "el
#: mismo intento". Cubre de sobra el caso real (darle a "Cambiar" y rellenar
#: otra vez), sin llegar a fundir el intento de hoy con el de la semana pasada,
#: que sí es una vuelta nueva al embudo y debe contarse aparte.
_VENTANA_MISMO_INTENTO = timedelta(hours=24)


async def _matricula_sin_pagar_reciente(email: str, db_session: AsyncSession):
    """La matrícula sin pagar que este email dejó abierta hace poco, si la hay.

    Existe para que una sola persona indecisa no cuente como varias. El botón
    "Cambiar" del checkout devuelve al formulario, y cada vuelta creaba otra
    fila `pending`: en las estadísticas eso se lee como gente distinta que se
    matriculó y no pagó, e infla el abandono del embudo.

    Reutilizar la fila también es más seguro que crear otra. El webhook busca
    por `metadata.enrollment_id`, así que si alguien acaba pagando el intento
    viejo desde otra pestaña, sigue cayendo en la misma matrícula.
    """
    from src.db.enrollment import Enrollment

    stmt = (
        select(Enrollment)
        .where(Enrollment.email == email)
        .where(Enrollment.status == "pending")
        .order_by(Enrollment.id.desc())  # type: ignore[union-attr]
        .limit(1)
    )
    row = (await db_session.exec(stmt)).first()
    if row is None:
        return None

    try:
        creada = datetime.fromisoformat(str(row.created_at))
    except (TypeError, ValueError):
        # Fila antigua con la fecha en otro formato: mejor no tocarla.
        return None

    if datetime.now() - creada > _VENTANA_MISMO_INTENTO:
        return None
    return row


def _cerrar_sesion_anterior(session_id: str) -> None:
    """
    Caduca la sesión de pago que queda huérfana al rehacer la matrícula.

    Mismo motivo que con los PaymentIntent: dos pestañas abiertas no pueden
    acabar en dos cobros. Stripe rechaza caducar una sesión ya pagada o ya
    caducada, y eso está bien — significa que no había nada que cerrar.
    """
    if not session_id.startswith("cs_"):
        return
    try:
        stripe.checkout.Session.expire(session_id)
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo caducar la sesión %s", session_id, exc_info=True)


def _cancelar_intento_anterior(payment_intent_id: str) -> None:
    """Cierra el PaymentIntent que queda huérfano al rehacer la matrícula.

    Sin esto, alguien con dos pestañas abiertas podría pagar las dos y acabar
    cobrado dos veces. Solo se cancelan los que aún no han empezado a cobrarse:
    tocar uno que esté en mitad del 3DS rompería un pago en curso.
    """
    if not payment_intent_id.startswith("pi_"):
        return
    try:
        anterior = stripe.PaymentIntent.retrieve(payment_intent_id)
        estado = anterior.get("status") if hasattr(anterior, "get") else getattr(anterior, "status", "")
        if estado in ("requires_payment_method", "requires_confirmation"):
            stripe.PaymentIntent.cancel(payment_intent_id)
    except Exception:  # noqa: BLE001
        # Nunca puede impedir que se abra el pago nuevo.
        logger.warning("No se pudo cancelar el PaymentIntent %s", payment_intent_id, exc_info=True)


async def enroll_and_checkout_session(data, db_session: AsyncSession) -> dict:
    """
    Guarda la matrícula y abre una **sesión de pago de Stripe, embebida**.

    Por qué esta y no un PaymentIntent
    ----------------------------------
    Con PaymentIntent, Stripe manda un recibo escueto y **no emite factura**:
    hay que fabricarla a mano después del cobro. Eso costó una noche entera de
    fallos encadenados —la clave de Stripe que faltaba en el webhook, la marca
    de "ya atendida" en el usuario en vez de en la matrícula, el envío que
    nadie llamaba— y cada uno de ellos era invisible: el cobro entraba y la
    factura no salía, sin un solo error a la vista.

    La sesión de pago trae `invoice_creation`, y con eso **Stripe emite la
    factura numerada y la manda él**, con su recibo de siempre. Cero código
    nuestro en ese camino, y por tanto cero fallos nuestros.

    Y sigue siendo embebida (`ui_mode="embedded"`): se pinta dentro de nuestra
    propia página, así que el alumno no sale de la escuela. No hay que elegir
    entre la factura buena y quedarse en el dominio.

    Devuelve lo mismo que la versión de PaymentIntent —`client_secret`,
    `publishable_key`, `payment_url`— para que la landing no se entere del
    cambio. El secreto de una sesión empieza por `cs_`, y por ahí la página de
    pago sabe cuál de los dos tiene delante.
    """
    from src.db.enrollment import Enrollment

    await ensure_matricula_abierta(db_session)

    _usar_stripe()
    academy = _academy_url()

    email = str(data.email).strip().lower()
    full_name = f"{data.first_name} {data.last_name}".strip() or data.first_name or "Alumno"

    # El importe sale del Price, para que cambiarlo en Stripe no pida despliegue.
    try:
        price = stripe.Price.retrieve(_formacion_price_id())
        unit_amount = price.get("unit_amount") if hasattr(price, "get") else getattr(price, "unit_amount", None)
        currency_raw = price.get("currency") if hasattr(price, "get") else getattr(price, "currency", "eur")
    except Exception as exc:
        logger.exception("No se pudo leer el precio de Stripe: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not load price: {exc}")
    amount = int(unit_amount or 0)
    currency = (currency_raw or "eur").lower()
    if amount <= 0:
        raise HTTPException(status_code=500, detail="Configured price has empty unit_amount")

    # Cliente primero: la factura y el recibo necesitan a quién ir dirigidos.
    try:
        customer = stripe.Customer.create(
            email=email,
            name=full_name,
            phone=data.phone or None,
            metadata={
                "country": data.country or "",
                "city": data.city or "",
                "source": "matricula-form-checkout",
            },
        )
    except Exception as exc:
        logger.exception("No se pudo crear el cliente en Stripe: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create Stripe customer: {exc}")

    now = datetime.now().isoformat()
    # Una persona = una fila: si dejó una matrícula sin pagar hace un rato, es
    # el mismo intento y se reaprovecha en vez de inflar el abandono del embudo.
    row = await _matricula_sin_pagar_reciente(email, db_session)
    if row is not None:
        anterior = row.stripe_session_id
        row.first_name = data.first_name
        row.last_name = data.last_name
        row.phone = data.phone or ""
        row.country = data.country or ""
        row.city = data.city or ""
        row.stripe_customer_id = customer.id
        row.updated_at = now
        if anterior:
            _cerrar_sesion_anterior(anterior)
            _cancelar_intento_anterior(anterior)
    else:
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

    metadatos = {
        "product": "formacion-a0-a1",
        "source": "matricula-form-checkout",
        "enrollment_id": str(row.id or ""),
        "phone": data.phone or "",
        "first_name": data.first_name,
        "last_name": data.last_name,
        # La factura la emite Stripe. Esta marca la lee el webhook del
        # PaymentIntent para NO emitir otra por su cuenta: sin ella saldrían
        # dos facturas con dos números para un solo cobro.
        "factura_stripe": "1",
    }

    try:
        session = stripe.checkout.Session.create(
            # `embedded_page`, no `embedded`: Stripe renombró el valor y el
            # viejo ya no lo acepta ("The ui_mode value `embedded` is no longer
            # supported"). Es el mismo modo — la caja pintada dentro de nuestra
            # página — solo que ahora se llama así.
            ui_mode="embedded_page",
            mode="payment",
            line_items=[{"price": _formacion_price_id(), "quantity": 1}],
            customer=customer.id,
            # Al volver, la página de bienvenida de siempre.
            return_url=f"{academy}/auth/bienvenido?session_id={{CHECKOUT_SESSION_ID}}",
            # Esto es lo que arregla la factura: Stripe la crea, la numera con
            # el prefijo NAWAR y la manda con el recibo. Nada por nuestra parte.
            invoice_creation={
                "enabled": True,
                "invoice_data": {
                    "description": "Formación Nawar A0-A1",
                    "footer": "Gracias por unirte a Holandés Nawar.",
                    "metadata": {"product": "formacion-a0-a1"},
                },
            },
            # Sin campo de cupón, a propósito: una caja vacía que pone "código
            # de descuento" avisa de que existe un descuento que tú no tienes,
            # y parte de la gente se va a buscarlo y no vuelve. Los cupones van
            # en el enlace y aplicados solos.
            allow_promotion_codes=False,
            # Lista explícita en vez de automática, para decidir nosotros qué
            # sale: sin `link` (mete una cuenta en mitad del pago) y sin
            # `sepa_debit` (lento y raro aquí). La tarjeta ya arrastra Apple Pay
            # y Google Pay sola en los dispositivos que los tienen.
            payment_method_types=["card", "ideal", "klarna", "bancontact"],
            metadata=metadatos,
            payment_intent_data={"metadata": metadatos},
        )
    except Exception as exc:
        logger.exception("No se pudo crear la sesión de pago: %s", exc)
        raise HTTPException(status_code=502, detail=f"Could not create checkout session: {exc}")

    # Mismo campo que usaba el PaymentIntent: un solo identificador para el
    # webhook y para las consultas del panel, venga del flujo que venga.
    row.stripe_session_id = session.id
    row.updated_at = datetime.now().isoformat()
    db_session.add(row)
    await db_session.commit()

    client_secret = (
        session.client_secret
        if hasattr(session, "client_secret")
        else (session.get("client_secret") if hasattr(session, "get") else None)
    )
    if not client_secret:
        raise HTTPException(status_code=502, detail="Stripe did not return a client secret")

    em = quote(email, safe="")
    nm = quote(full_name, safe="")
    ph = quote(data.phone or "", safe="")

    return {
        "enrollment_id": row.id or 0,
        "client_secret": client_secret,
        "publishable_key": _stripe_publishable(),
        "amount": amount,
        "currency": currency,
        "payment_url": (
            f"{academy}/auth/matricula-formacion-nawar-a0-a1"
            f"?ei={row.id or 0}&cs={quote(client_secret, safe='')}"
            f"&pk={quote(_stripe_publishable(), safe='')}"
            f"&amt={amount}&cur={currency}&em={em}&nm={nm}&ph={ph}"
        ),
    }


async def enroll_and_payment_intent(data, db_session: AsyncSession) -> dict:
    """Save the prospect + create a PaymentIntent for our embedded Elements
    checkout (the page at /auth/matricula-formacion-nawar-a0-a1/pago).

    Returns {enrollment_id, client_secret, publishable_key, payment_url}.
    Stripe will surface card + Apple Pay + Google Pay + Klarna + iDEAL +
    everything else enabled in Dashboard via `automatic_payment_methods`.
    """
    from src.db.enrollment import Enrollment

    await ensure_matricula_abierta(db_session)

    _usar_stripe()
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
    # Si esta persona ya dejó una matrícula sin pagar hace un rato, se reaprovecha
    # su fila en vez de crear otra: es el mismo intento, no una persona nueva.
    row = await _matricula_sin_pagar_reciente(email, db_session)
    if row is not None:
        intento_huerfano = row.stripe_session_id
        row.first_name = data.first_name
        row.last_name = data.last_name
        row.phone = data.phone or ""
        row.country = data.country or ""
        row.city = data.city or ""
        row.stripe_customer_id = customer.id
        row.updated_at = now
        if intento_huerfano:
            _cancelar_intento_anterior(intento_huerfano)
    else:
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


async def diagnostico_facturas(limite: int, db_session: AsyncSession) -> dict:
    """
    Qué ha pasado de verdad con las últimas matrículas pagadas.

    Existe porque el camino del cobro se traga sus propios errores a propósito
    —un fallo de Stripe no puede impedir que el alumno tenga su cuenta— y eso
    deja al administrador sin forma de ver por qué no llega una factura. Aquí se
    le pregunta a Stripe directamente y se enseña lo que conteste.

    No cobra, no crea nada y no manda nada. Solo mira.
    """
    from src.db.enrollment import Enrollment

    filas = (
        await db_session.execute(
            select(Enrollment)
            .where(Enrollment.status == "paid")
            .order_by(Enrollment.id.desc())  # type: ignore[attr-defined]
            .limit(max(1, min(limite, 20)))
        )
    ).scalars().all()

    cfg = get_learnhouse_config()
    clave = (
        getattr(getattr(cfg.payments_config, "stripe", None), "stripe_secret_key", "") or ""
    ).strip()
    modo = "live" if clave.startswith("sk_live_") else ("test" if clave.startswith("sk_test_") else "sin clave")

    _usar_stripe()

    salida = []
    for e in filas:
        ficha = {
            "matricula": e.id,
            "email": e.email,
            "pagada": e.paid_at or "",
            "importe": f"{(e.amount_cents or 0) / 100:.2f} {(e.currency or 'eur').upper()}",
            "atendida": bool((getattr(e, "provisioned_at", "") or "").strip()),
            "cliente_stripe": e.stripe_customer_id or "",
            "facturas": [],
            "error": "",
        }
        if e.stripe_customer_id:
            try:
                lista = stripe.Invoice.list(customer=e.stripe_customer_id, limit=5)
                ficha["facturas"] = [
                    {
                        "numero": getattr(f, "number", "") or "",
                        "estado": getattr(f, "status", "") or "",
                        # OJO: esto es que se FINALIZÓ, no que Stripe la haya
                        # mandado por correo. Stripe no expone "enviada" como
                        # tal, así que para saberlo hay que reenviarla y ver qué
                        # contesta (`reenviar_factura`).
                        "finalizada": bool(getattr(f, "status_transitions", None)
                                           and getattr(f.status_transitions, "finalized_at", None)),
                        "id": getattr(f, "id", "") or "",
                        "correo_cliente": getattr(f, "customer_email", "") or "",
                        "pdf": getattr(f, "invoice_pdf", "") or "",
                    }
                    for f in lista.data
                ]
            except Exception as exc:  # noqa: BLE001
                ficha["error"] = str(exc)
        salida.append(ficha)

    return {"modo_stripe": modo, "matriculas": salida}


async def reintentar_factura(enrollment_id: int, db_session: AsyncSession) -> dict:
    """
    Vuelve a intentar la factura de una matrícula y **devuelve el motivo** si
    falla. Es la pieza que faltaba para dejar de adivinar.
    """
    from src.db.enrollment import Enrollment

    e = (
        await db_session.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    ).scalars().first()
    if not e:
        raise HTTPException(status_code=404, detail="Esa matrícula no existe")
    if e.status != "paid":
        raise HTTPException(status_code=400, detail="Esa matrícula no está pagada")
    if not e.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Esa matrícula no tiene cliente de Stripe")

    return _create_post_hoc_invoice(
        customer_id=e.stripe_customer_id,
        amount=int(e.amount_cents or 0),
        currency=(e.currency or "eur").lower(),
        description="Formación Nawar A0-A1",
    )


def reenviar_factura(invoice_id: str) -> dict:
    """
    Manda otra vez una factura que YA existe, y dice qué contesta Stripe.

    No crea nada: es para averiguar si el envío funciona sin emitir una segunda
    factura con otro número. Lo que devuelve es la respuesta de Stripe tal cual,
    que es justo lo que faltaba para dejar de suponer.
    """
    _usar_stripe()
    try:
        factura = stripe.Invoice.send_invoice(invoice_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("No se pudo reenviar la factura %s", invoice_id)
        return {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "numero": getattr(factura, "number", "") or "",
        "estado": getattr(factura, "status", "") or "",
        "correo_cliente": getattr(factura, "customer_email", "") or "",
    }


def _create_post_hoc_invoice(
    customer_id: str,
    amount: int,
    currency: str,
    description: str,
) -> dict:
    """Devuelve qué ha pasado, para poder verlo desde el panel.

    Antes esto no devolvía nada y cualquier fallo de Stripe se quedaba en un
    log que el administrador no puede leer. Resultado: la factura no llegaba y
    desde fuera no había forma de saber por qué — solo probar y volver a probar.
    Ahora el motivo sale por la puerta, y el diagnóstico del panel lo enseña.
    """
    """Generate a finalized 'paid out of band' Invoice for a PaymentIntent
    that already settled, so the buyer still gets the same NAWAR-XXXX PDF
    Stripe Checkout produced automatically. Best-effort: a Stripe hiccup
    here must never block account provisioning."""
    paso = "inicio"
    try:
        # Que no dependa de quién llame: esta función se invoca desde el webhook
        # y desde el reintento del panel, y en el webhook la clave NO estaba.
        _usar_stripe()
        paso = "InvoiceItem.create"
        stripe.InvoiceItem.create(
            customer=customer_id,
            amount=amount,
            currency=currency,
            description=description,
        )
        paso = "Invoice.create"
        invoice = stripe.Invoice.create(
            customer=customer_id,
            collection_method="send_invoice",
            days_until_due=0,
            auto_advance=False,
        )
        paso = "finalize_invoice"
        invoice = stripe.Invoice.finalize_invoice(invoice.id)
        # Marcarla pagada ANTES de mandarla, y no al revés: una factura enviada
        # sin pagar le llega al alumno con un botón de "Pagar esta factura", y
        # acabas cobrando dos veces a alguien que ya había pagado.
        paso = "pay(out_of_band)"
        invoice = stripe.Invoice.pay(invoice.id, paid_out_of_band=True)
    except Exception as e:  # noqa: BLE001
        logger.exception("Factura post-hoc fallida en %s para %s", paso, customer_id)
        return {"ok": False, "paso": paso, "error": str(e)}

    # Y mandarla, que es lo que faltaba.
    #
    # Con `auto_advance=False` Stripe NO la envía por su cuenta: la deja creada
    # y numerada, esperando. O sea que la factura NAWAR-XXXX existía en Stripe y
    # no la recibía nadie — el comprador se quedaba solo con el recibo escueto
    # del cobro, que es otro documento distinto.
    #
    # Va en su propio try: si el envío falla, la factura ya está emitida y
    # numerada, que es lo que no se puede perder.
    numero = getattr(invoice, "number", None) or ""
    try:
        stripe.Invoice.send_invoice(invoice.id)
    except Exception as e:  # noqa: BLE001
        logger.exception("La factura %s se emitió pero no se pudo enviar", invoice.id)
        return {
            "ok": False,
            "paso": "send_invoice",
            "error": str(e),
            "invoice_id": invoice.id,
            "numero": numero,
        }

    return {"ok": True, "invoice_id": invoice.id, "numero": numero}


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
        await add_user_to_students(existing.id or 0, org.id or 0, db_session)
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
    await add_user_to_students(user.id or 0, org.id or 0, db_session)
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
    # La clave, antes de nada.
    #
    # Comprobar la firma NO la necesita (es una cuenta local), así que faltando
    # aquí el webhook seguía verificando y marcando la matrícula como pagada.
    # Lo que se caía era todo lo que viene después y sí habla con Stripe: la
    # factura. Sin ruido, sin error visible, durante semanas.
    _usar_stripe()

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
    ya_atendida: bool = False,
) -> dict:
    """Shared post-payment work: create the user, store a reset code, send
    the welcome email, tag in the CRM. Used by both webhook flows so behaviour
    stays identical whether the buyer paid via Checkout or Elements."""
    if not email:
        logger.error("post-payment provisioning called without email")
        return {"detail": "no email", "created": False}

    user, created = await _create_paid_user(email, name, db_session)

    # Quién es y en qué escuela: lo necesitan las automatizaciones de
    # "cuando alguien paga", que se lanzan desde quien nos llama.
    who = {"user_id": user.id, "org_id": None}
    try:
        who["org_id"] = (
            await db_session.execute(
                select(UserOrganization.org_id).where(UserOrganization.user_id == user.id)
            )
        ).scalars().first()
    except Exception:
        logger.exception("No se pudo averiguar la escuela de %s", email)

    if ya_atendida:
        # Stripe ha reintentado el webhook (o lo ha entregado dos veces) y a
        # ESTA matrícula ya se le mandó lo suyo. Se reafirma la etiqueta del CRM
        # (que es idempotente) y nada más: repetir el correo le mandaría al
        # alumno un "crea tu contraseña" nuevo en cada entrega duplicada.
        #
        # Ojo con lo que NO se mira aquí: si la cuenta existía de antes. Eso era
        # lo que se miraba y estaba mal — quien compraba teniendo ya cuenta se
        # quedaba sin correo de bienvenida y sin factura.
        try:
            from src.services.crm.systeme import mark_as_alumno
            await mark_as_alumno(email)
        except Exception:
            logger.exception("Systeme tag update failed for %s", email)
        logger.info("Matrícula de %s ya atendida — no se repite el correo", email)
        return {"detail": "already provisioned", "created": False, "atendida_ahora": False, **who}

    code = _store_reset_code(user)
    if not code:
        logger.error("No se pudo generar el código para %s; la cuenta existe, el correo no sale", email)
        return {
            "detail": "user created but reset email could not be sent",
            "created": created,
            "atendida_ahora": False,
            **who,
        }

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

    return {"detail": "ok", "created": created, "atendida_ahora": True, **who}


async def _handle_checkout_session(obj: dict, db_session: AsyncSession) -> dict:
    """
    Sesión de pago completada. Es el camino de los pagos nuevos.

    La factura NO se emite aquí: la crea y la manda Stripe por su cuenta,
    porque la sesión se abre con `invoice_creation`. Lo único que hace falta de
    nuestra parte es dar de alta al alumno.
    """
    if obj.get("payment_status") != "paid":
        return {"detail": "session not paid"}

    session_id = obj.get("id") or ""
    metadatos = obj.get("metadata") or {}
    importe = int(obj.get("amount_total") or 0)
    moneda = (obj.get("currency") or "eur").lower()

    # Por id de matrícula si viene en los metadatos (los pagos nuevos), y si no
    # por el id de la sesión, que es como se hacía antes. Así siguen entrando
    # las matrículas viejas que quedaran colgadas.
    enrollment = None
    id_matricula = str(metadatos.get("enrollment_id") or "").strip()
    if id_matricula:
        try:
            from src.db.enrollment import Enrollment

            enrollment = (
                await db_session.execute(
                    select(Enrollment).where(Enrollment.id == int(id_matricula))
                )
            ).scalars().first()
        except Exception:
            logger.exception("No se pudo buscar la matrícula %s", id_matricula)

    if enrollment is not None:
        if enrollment.status != "paid":
            enrollment.status = "paid"
            enrollment.updated_at = datetime.now().isoformat()
            enrollment.amount_cents = importe
            enrollment.currency = moneda
            enrollment.paid_at = datetime.now(timezone.utc).isoformat()
            db_session.add(enrollment)
            await db_session.commit()
        email = (enrollment.email or "").strip().lower()
        name = f"{enrollment.first_name} {enrollment.last_name}".strip()
    else:
        if session_id:
            await _mark_enrollment_paid(session_id, db_session, importe, moneda)
        email = (
            (obj.get("customer_details") or {}).get("email")
            or obj.get("customer_email")
            or ""
        ).strip().lower()
        name = ((obj.get("customer_details") or {}).get("name") or "").strip()

    # La marca de "ya atendida" va en la matrícula, no en la cuenta: quien
    # compra teniendo ya cuenta también necesita su correo de bienvenida, y un
    # reintento de Stripe no debe mandarlo dos veces.
    ya_atendida = bool(
        enrollment is not None and (getattr(enrollment, "provisioned_at", "") or "").strip()
    )
    resultado = await _provision_after_payment(email, name, db_session, ya_atendida=ya_atendida)

    if enrollment is not None and resultado.get("atendida_ahora"):
        try:
            enrollment.provisioned_at = datetime.now(timezone.utc).isoformat()
            db_session.add(enrollment)
            await db_session.commit()
        except Exception:
            logger.exception("No se pudo marcar la matrícula %s como atendida", enrollment.id)

    # Y las automatizaciones de "cuando alguien paga", igual que en el otro
    # camino. Se tragan sus errores: el cobro ya está hecho.
    user_id = resultado.get("user_id")
    org_id = resultado.get("org_id")
    if user_id and org_id:
        from src.services.automations.engine import run_trigger

        await run_trigger(
            "payment_completed",
            int(org_id),
            int(user_id),
            db_session,
            extra={"importe": f"{importe / 100:.2f} {moneda.upper()}"},
        )

    return resultado


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
        # Importe y fecha del cobro: con esto la tabla de ventas de
        # Estadísticas sale de nuestra base de datos, sin llamar a Stripe.
        enrollment.amount_cents = int(obj.get("amount_received") or obj.get("amount") or 0)
        enrollment.currency = (obj.get("currency") or "eur").lower()
        enrollment.paid_at = datetime.now(timezone.utc).isoformat()
        db_session.add(enrollment)
        await db_session.commit()

    email = (enrollment.email or "").strip().lower()
    name = f"{enrollment.first_name} {enrollment.last_name}".strip()

    ya_atendida = bool((getattr(enrollment, "provisioned_at", "") or "").strip())
    result = await _provision_after_payment(email, name, db_session, ya_atendida=ya_atendida)

    # Se marca ANTES de la factura: si la factura falla, el correo ya ha salido
    # y no queremos que un reintento de Stripe lo mande otra vez.
    if result.get("atendida_ahora"):
        try:
            enrollment.provisioned_at = datetime.now(timezone.utc).isoformat()
            db_session.add(enrollment)
            await db_session.commit()
        except Exception:
            logger.exception("No se pudo marcar la matrícula %s como atendida", enrollment.id)

    # La factura NAWAR-XXXX que el Checkout de Stripe generaba solo. Best-effort:
    # nunca bloquea.
    #
    # Va atada al PAGO, no a si la cuenta era nueva. Antes miraba `created`, y
    # por eso quien compraba teniendo ya cuenta se quedaba sin factura y solo
    # con el recibo pelado de Stripe.
    amount = int(obj.get("amount_received") or obj.get("amount") or 0)
    currency = (obj.get("currency") or "eur").lower()
    customer_id = obj.get("customer") or enrollment.stripe_customer_id or ""
    #
    # Y NO si la factura la emite Stripe. Con la sesión de pago
    # (`invoice_creation`) la factura la crea y la manda él; emitir otra aquí
    # daría dos facturas con dos números para un solo cobro, que en contabilidad
    # es peor que no tener ninguna.
    factura_de_stripe = str((obj.get("metadata") or {}).get("factura_stripe") or "") == "1"
    if result.get("atendida_ahora") and customer_id and amount > 0 and not factura_de_stripe:
        _create_post_hoc_invoice(
            customer_id=customer_id,
            amount=amount,
            currency=currency,
            description="Formación Nawar A0-A1",
        )

    # Y lo que el admin haya montado para "cuando alguien paga". Se traga sus
    # propios errores: el cobro ya está hecho y la cuenta creada.
    user_id = result.get("user_id")
    org_id = result.get("org_id")
    if user_id and org_id:
        from src.services.automations.engine import run_trigger

        await run_trigger(
            "payment_completed",
            int(org_id),
            int(user_id),
            db_session,
            extra={"importe": f"{amount / 100:.2f} {currency.upper()}"},
        )

    return result

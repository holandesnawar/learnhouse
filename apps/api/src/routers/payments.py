"""Public endpoints driving Stripe checkout + webhook for the formación."""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.enrollment import EnrollmentCreate, EnrollmentIntentResponse, EnrollmentResponse
from src.db.enrollment_request import EnrollmentRequestCreate
from src.services.payments.solicitudes import crear_solicitud
from src.services.payments.payments import (
    create_formacion_checkout_session,
    enroll_and_checkout,
    enroll_and_checkout_session,
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
    summary="Guarda la matrícula y abre la sesión de pago embebida de Stripe.",
    description=(
        "El comprador se queda en la página de pago de la escuela; la caja de "
        "pago la pinta Stripe dentro de ella. Devuelve el `client_secret` de la "
        "sesión, la clave pública y la `payment_url` a la que redirigir.\n\n"
        "El nombre de la ruta se mantiene a propósito: la landing solo lee "
        "`payment_url`, así que el cambio de PaymentIntent a sesión de pago no "
        "la afecta."
    ),
)
async def api_enroll_intent(
    data: EnrollmentCreate,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Sesión de pago, no PaymentIntent.

    Con PaymentIntent, Stripe manda un recibo escueto y no emite factura: había
    que fabricarla a mano después del cobro, y esa pieza falló de tres formas
    distintas y todas invisibles. Con la sesión, `invoice_creation` hace que
    Stripe emita la factura numerada y la mande él. Menos código nuestro en el
    camino del dinero es menos sitios donde se rompa en silencio.

    `enroll_and_payment_intent` se queda en el código como vuelta atrás: si
    hubiera que volver, es cambiar esta línea.
    """
    _enforce_enroll_rate_limit(request)
    result = await enroll_and_checkout_session(data, db_session)
    return EnrollmentIntentResponse(**result)


_PAGINA_ENLACE = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Holandés Nawar</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#1D0084;color:#fff;font-family:system-ui,sans-serif;padding:24px;text-align:center">
<div style="max-width:420px"><h1 style="font-size:22px;margin:0 0 12px">{titulo}</h1>
<p style="font-size:16px;line-height:1.6;opacity:.9;margin:0">{texto}</p></div></body></html>"""


@router.get(
    "/pagar/{token}",
    summary="Abre un enlace de pago personal: crea la sesión y lleva al checkout.",
    description=(
        "Público. El enlace lo crea el equipo desde el panel "
        "(`POST /contactos/org/{id}/enlace-pago`) y lleva los datos firmados. "
        "Al abrirlo se crea la sesión de pago en ese momento (las de Stripe "
        "caducan en 24 h; el enlace dura más) y se redirige al checkout de la "
        "escuela ya rellenado. El cobro sigue el camino de siempre: cuenta, "
        "correo, factura y venta."
    ),
)
async def api_pagar_enlace(
    token: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    from fastapi.responses import HTMLResponse

    from config.config import get_learnhouse_config
    from src.db.enrollment import EnrollmentCreate
    from src.services.payments.enlace import verificar

    datos = verificar(token, get_learnhouse_config().security_config.auth_jwt_secret_key)
    if not datos:
        return HTMLResponse(
            _PAGINA_ENLACE.format(
                titulo="Este enlace ya no vale",
                texto="Ha caducado o no está completo. Escríbenos por WhatsApp y te mandamos uno nuevo.",
            ),
            status_code=410,
        )
    pedido = EnrollmentCreate(
        email=datos["e"],
        first_name=datos.get("f") or "",
        last_name=datos.get("l") or "",
        phone=datos.get("p") or "",
        utm_source="equipo",
        utm_medium="enlace-pago",
        recorrido=["enlace-pago"],
    )
    try:
        resultado = await enroll_and_checkout_session(pedido, db_session)
    except HTTPException as exc:
        return HTMLResponse(
            _PAGINA_ENLACE.format(
                titulo="Ahora mismo no se puede pagar",
                texto=f"{exc.detail}. Escríbenos por WhatsApp y lo vemos.",
            ),
            status_code=exc.status_code,
        )
    return RedirectResponse(url=resultado["payment_url"], status_code=303)


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


@router.post(
    "/solicitudes",
    summary="Guarda una solicitud de plaza (el formulario que NO cobra).",
    description=(
        "Público, como el resto del embudo: lo llama holandesnawar.com cuando "
        "alguien deja sus datos en la matrícula sin pago. No toca Stripe ni crea "
        "cuenta: solo guarda el contacto para que salga en Panel → Estadísticas. "
        "El alta en systeme.io la hace la web, que es donde vive la clave del CRM."
    ),
)
async def api_solicitud(
    data: EnrollmentRequestCreate,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    # El mismo tope que la matrícula de pago (5/hora/IP): es una escritura
    # pública, y sin esto un script llenaría la lista del panel de basura.
    _enforce_enroll_rate_limit(request)
    fila = await crear_solicitud(data, db_session)
    return {"ok": True, "id": fila.id}


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

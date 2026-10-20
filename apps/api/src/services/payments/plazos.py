"""
Plan de pagos propio: la formación en 3 pagos mensuales (14/10/2026).

Pedido del usuario: "un plan de pagos propio como backup, para los que no
conocen Klarna o en un momento no les funciona Klarna… con algo de riesgo pero
por un poco más de dinero, a 145 € 3 plazos… para el mismo producto y que dé
acceso también".

Cómo va
-------
1. El equipo crea en el panel un enlace de pago eligiendo «3 plazos» (la
   misma pieza de siempre, `Panel/EnlacePago.tsx`).
2. Al ABRIRLO, la escuela crea una sesión de pago de Stripe en modo
   SUSCRIPCIÓN, embebida en la caja de siempre: 145 € al mes, al mismo
   producto que la matrícula normal. El precio mensual se busca en Stripe por
   su `lookup_key` y, si aún no existe, se crea solo colgando del producto de
   `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID`. No hay que tocar el panel de Stripe.
3. Con el PRIMER cobro llega `checkout.session.completed` y pasa lo de un pago
   normal (`_handle_checkout_session`): matrícula `paid`, cuenta, correo de
   crear contraseña, etiqueta del CRM. **El acceso se da desde el primer
   pago.** Además se apunta el plan (`PlanPagos`) y se le pone a la
   suscripción un CALENDARIO de Stripe (`SubscriptionSchedule`) que dura 3
   meses y la cancela al terminar: **la corta Stripe, no nosotros**.
4. Los cobros 2 y 3 los hace Stripe solo, con su factura NAWAR-XXXX cada uno.
   La escuela se entera por los avisos `invoice.paid` /
   `invoice.payment_failed` si están activados en el webhook de Stripe y, si
   no, por la tarea diaria (`sincronizar_planes`, desde `drip-diario`), que le
   pregunta a Stripe por cada plan vivo. Por eso los avisos son opcionales.
5. Si un cobro falla: Stripe lo reintenta (y le escribe a la persona si eso
   está activado en Stripe). La escuela marca el plan como «Cobro fallido» y
   manda UN correo a los administradores por factura. **No se quita el
   acceso solo**: lo decide el equipo.

3 o 4 pagos, a elegir por la persona (20/10/2026, "pago a 3 meses 497, y a 4
meses 540… que elijan desde la misma página si lo quieren en 3 o 4 plazos"):
`OPCIONES`. El enlace del equipo ya no lleva el número de pagos: al abrirlo,
la página de pago enseña las dos opciones y la sesión de Stripe se crea al
elegir (`/payments/pagar/{token}?cuotas=3|4`). 497 no se divide entre 3, así
que las cuotas son 165,67 · 165,67 · 165,66 (`reparto`): los céntimos que
sobran van en las primeras. Cada importe es su propio precio mensual en
Stripe, y el calendario lleva un tramo por importe (`tramos`): 2 meses a
165,67 y 1 a 165,66. Cuotas y total van en los metadatos de la sesión y en el
plan (`cuotas`, `total_cents`).

Los enlaces creados ANTES del 20/10 siguen como se mandaron: 3 pagos de 145 €
(435) o de 165,67 (497), el total firmado en el enlace (`pt`, `total_valido`).

Lo que cuida
------------
- Contar dos veces: cada cobro se apunta por el id de su factura
  (`PlanPagos.facturas`) y las cifras se recalculan de ahí.
- Cobrar una cuarta vez: además del calendario, si un plan llega a 3 pagos y
  la suscripción no tiene calendario, la tarea diaria le pone
  `cancel_at_period_end` (falta un mes entero para el siguiente cobro).
- Dos suscripciones a la vez: abrir el enlace con un plan ya en marcha, o
  siendo ya alumno, se rechaza; y como en la matrícula normal, la sesión
  anterior sin pagar se cierra.
- El registro de la tarea diaria sale en un repo PÚBLICO: solo números.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.plan_pagos import PlanPagos

logger = logging.getLogger(__name__)

#: Estados en los que el plan aún tiene cobros por delante.
VIVOS = ("activo", "fallido")

NOMBRE_ESTADO = {
    "activo": "Al día",
    "fallido": "Cobro fallido",
    "completado": "Pagado entero",
    "cancelado": "Cancelado sin completar",
}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── condiciones ────────────────────────────────────────────────────────────


def cuotas() -> int:
    """Cuántos pagos. `LEARNHOUSE_PLAZOS_CUOTAS`, 3 de serie."""
    raw = (os.environ.get("LEARNHOUSE_PLAZOS_CUOTAS") or "").strip()
    return min(12, max(2, int(raw))) if raw.isdigit() else 3


def cuota_cents() -> int:
    """Lo que se cobra cada mes. `LEARNHOUSE_PLAZOS_CUOTA_CENTS`, 145 € de serie."""
    raw = (os.environ.get("LEARNHOUSE_PLAZOS_CUOTA_CENTS") or "").strip()
    return int(raw) if raw.isdigit() and int(raw) >= 50 else 14500


#: Lo que la persona elige en la página de pago: número de pagos → total
#: (20/10/2026). 4 × 135 € justos; 497 en 3, con los céntimos en las primeras.
OPCIONES: dict[int, int] = {3: 49700, 4: 54000}

#: El otro total que se podía elegir al crear el enlace (19/10). Solo para los
#: enlaces de antes del 20/10, que siguen cobrando lo que decían.
TOTAL_ALTO_CENTS = 49700


def condiciones_de(n: int, total: int) -> dict:
    lista = reparto(total, n)
    return {"cuotas": n, "cuota_cents": lista[0], "ultima_cents": lista[-1], "total_cents": total, "moneda": "eur"}


def opciones() -> list[dict]:
    """Las opciones de la página de pago, de menos a más pagos."""
    return [condiciones_de(n, total) for n, total in sorted(OPCIONES.items())]


def totales() -> list[int]:
    """Enlaces de antes del 20/10: el de serie (cuotas × cuota) y 497 €."""
    return sorted({cuotas() * cuota_cents(), TOTAL_ALTO_CENTS})


def total_valido(total: Any = None) -> int:
    """Enlaces de antes del 20/10: el total pedido si es uno de los de
    entonces; si no (o sin pedir), el de serie. Así un enlace con un total raro
    no cobra lo que no se ofreció."""
    try:
        pedido = int(total or 0)
    except (TypeError, ValueError):
        pedido = 0
    return pedido if pedido in totales() else cuotas() * cuota_cents()


def reparto(total_cents: int, n: int) -> list[int]:
    """Las cuotas de un total: iguales si se divide; si no, los céntimos que
    sobran van en las primeras (497 € en 3 → 16567, 16567, 16566)."""
    n = max(1, int(n or 1))
    base, resto = divmod(max(0, int(total_cents or 0)), n)
    return [base + 1] * resto + [base] * (n - resto)


def tramos(lista: list[int]) -> list[tuple[int, int]]:
    """Las cuotas seguidas iguales, juntas: (importe, meses). Un tramo por
    precio en el calendario de Stripe."""
    salida: list[tuple[int, int]] = []
    for c in lista:
        if salida and salida[-1][0] == c:
            salida[-1] = (c, salida[-1][1] + 1)
        else:
            salida.append((c, 1))
    return salida


def condiciones(total_cents: Any = None) -> dict:
    """Enlaces de antes del 20/10 (3 pagos y su total)."""
    return condiciones_de(cuotas(), total_valido(total_cents))


def total_del_plan(plan: PlanPagos) -> int:
    """El total de un plan; los de antes del 19/10 no lo guardaban."""
    return int(plan.total_cents or 0) or int(plan.cuotas or 0) * int(plan.cuota_cents or 0)


# ── lectura de objetos de Stripe (dict del webhook o StripeObject) ─────────


def _v(obj: Any, clave: str, defecto: Any = None) -> Any:
    if obj is None:
        return defecto
    if isinstance(obj, dict):
        return obj.get(clave, defecto)
    try:
        valor = obj[clave]
    except Exception:  # noqa: BLE001
        valor = getattr(obj, clave, defecto)
    return defecto if valor is None else valor


def _id(obj: Any) -> str:
    """Un campo de Stripe que puede venir como id o como objeto expandido."""
    if isinstance(obj, str):
        return obj
    return str(_v(obj, "id", "") or "")


def _lista(obj: Any) -> list:
    datos = _v(obj, "data", None)
    return list(datos) if datos else []


def suscripcion_de_factura(inv: Any) -> str:
    """La suscripción de una factura. Desde la versión de la API de 2025 vive en
    `parent.subscription_details`; antes, en `subscription`. El webhook manda
    la forma de la versión con la que se creó, así que se miran las dos."""
    directa = _id(_v(inv, "subscription"))
    if directa:
        return directa
    detalles = _v(_v(inv, "parent"), "subscription_details")
    return _id(_v(detalles, "subscription"))


# ── lógica pura (con test) ─────────────────────────────────────────────────


def leer_facturas(texto: str) -> dict:
    try:
        datos = json.loads(texto or "{}")
    except (TypeError, ValueError):
        return {}
    return datos if isinstance(datos, dict) else {}


def anotar_cobro(facturas: dict, factura_id: str, cents: int, fecha: str) -> dict:
    """Apunta un cobro por el id de su factura. Repetirlo no cambia nada."""
    if not factura_id or int(cents or 0) <= 0:
        return facturas
    nuevas = dict(facturas)
    if factura_id not in nuevas:
        nuevas[factura_id] = {"c": int(cents), "f": fecha or _ahora()}
    return nuevas


def cifras(facturas: dict) -> tuple[int, int]:
    """(pagos hechos, céntimos pagados)."""
    return len(facturas), sum(int((x or {}).get("c") or 0) for x in facturas.values())


def estado_del_plan(*, pagadas: int, cuotas: int, estado_stripe: str = "", fallida: bool = False) -> str:
    if pagadas >= cuotas:
        return "completado"
    if estado_stripe in ("canceled", "incomplete_expired"):
        return "cancelado"
    if fallida or estado_stripe in ("past_due", "unpaid"):
        return "fallido"
    return "activo"


def _fecha_corta(ts: Any) -> str:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%d/%m/%Y")
    except (TypeError, ValueError, OverflowError, OSError):
        return ""


def _iso(ts: Any) -> str:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError, OSError):
        return ""


def texto_fallo(numero: int, total: int, cents: int, siguiente_intento: Any) -> str:
    euros = f"{cents / 100:.2f}".replace(".", ",").replace(",00", "")
    base = f"No se pudo cobrar el pago {numero} de {total} ({euros} €)."
    cuando = _fecha_corta(siguiente_intento) if siguiente_intento else ""
    if cuando:
        return f"{base} Stripe lo vuelve a intentar el {cuando}."
    return f"{base} Stripe ya no lo va a reintentar solo."


def resumen(plan: PlanPagos) -> dict:
    pagos = sorted(
        ({"factura": k, "importe_cents": int(v.get("c") or 0), "fecha": v.get("f") or ""} for k, v in leer_facturas(plan.facturas).items()),
        key=lambda p: str(p["fecha"]),
    )
    total = total_del_plan(plan)
    return {
        "id": plan.id,
        "estado": plan.estado,
        "estado_nombre": NOMBRE_ESTADO.get(plan.estado, plan.estado),
        "cuotas": plan.cuotas,
        "cuota_cents": plan.cuota_cents,
        "total_cents": total,
        "cuotas_pagadas": plan.cuotas_pagadas,
        "pagado_cents": plan.pagado_cents,
        "pendiente_cents": max(0, total - int(plan.pagado_cents or 0)),
        "moneda": plan.currency or "eur",
        "proximo_cobro": plan.proximo_cobro if plan.estado in VIVOS else "",
        "fallo": plan.fallo if plan.estado in ("fallido", "cancelado") else "",
        "creado_por": plan.creado_por,
        "created_at": plan.created_at,
        "completado_at": plan.completado_at,
        "sincronizado_at": plan.sincronizado_at,
        "pagos": [{**p, "numero": i + 1} for i, p in enumerate(pagos)],
    }


# ── lectura ────────────────────────────────────────────────────────────────


async def _plan_por_suscripcion(sub_id: str, db_session: AsyncSession) -> Optional[PlanPagos]:
    if not sub_id:
        return None
    return (
        await db_session.execute(
            select(PlanPagos)
            .where(PlanPagos.stripe_subscription_id == sub_id)
            .execution_options(populate_existing=True)
        )
    ).scalars().first()


async def planes_de(email: str, db_session: AsyncSession) -> list[PlanPagos]:
    clave = (email or "").strip().lower()
    if not clave:
        return []
    return list(
        (
            await db_session.execute(
                select(PlanPagos).where(func.lower(PlanPagos.email) == clave).order_by(PlanPagos.id.desc())  # type: ignore[union-attr]
            )
        ).scalars().all()
    )


async def plan_de(email: str, db_session: AsyncSession) -> Optional[dict]:
    """Para la ficha: el plan vivo si lo hay; si no, el último."""
    filas = await planes_de(email, db_session)
    if not filas:
        return None
    elegido = next((p for p in filas if p.estado in VIVOS), filas[0])
    return resumen(elegido)


async def planes_por_email(db_session: AsyncSession) -> dict[str, dict]:
    """Para listas (Clientes, tablero): el último plan de cada correo."""
    salida: dict[str, dict] = {}
    for p in (await db_session.execute(select(PlanPagos).order_by(PlanPagos.id))).scalars().all():  # type: ignore[arg-type]
        salida[(p.email or "").strip().lower()] = resumen(p)
    return salida


# ── el precio mensual, en Stripe ───────────────────────────────────────────

_PRECIO: dict[str, str] = {}


def precio_plazos(cuota: Optional[int] = None) -> str:
    """El Price mensual de una cuota, en el MISMO producto que la matrícula.

    Se busca por `lookup_key` (lleva el importe: si se cambia la cuota, sale
    otro precio y el viejo sigue valiendo para los planes ya en marcha). Si no
    existe, se crea. Hay que haber llamado antes a `_usar_stripe()`."""
    import stripe

    from src.services.payments.payments import _formacion_price_id

    cuota = int(cuota or cuota_cents())
    clave = f"nawar-formacion-plazos-{cuota}-mes"
    if clave in _PRECIO:
        return _PRECIO[clave]

    def buscar() -> str:
        encontrados = _lista(stripe.Price.list(lookup_keys=[clave], active=True, limit=1))
        return _id(encontrados[0]) if encontrados else ""

    precio = buscar()
    if not precio:
        base = stripe.Price.retrieve(_formacion_price_id())
        producto = _id(_v(base, "product"))
        if not producto:
            raise HTTPException(status_code=500, detail="El precio de la formación en Stripe no tiene producto")
        euros = f"{cuota / 100:.2f}".replace(".", ",").replace(",00", "")
        try:
            precio = _id(
                stripe.Price.create(
                    product=producto,
                    currency=str(_v(base, "currency", "eur") or "eur"),
                    unit_amount=cuota,
                    recurring={"interval": "month"},
                    lookup_key=clave,
                    nickname=f"Plazos: cuota de {euros} €",
                    metadata={"plan": "plazos"},
                )
            )
        except Exception:  # noqa: BLE001
            # Dos personas abriendo a la vez el primer enlace: el otro ya lo creó.
            precio = buscar()
            if not precio:
                raise
    _PRECIO[clave] = precio
    return precio


# ── la persona abre el enlace ──────────────────────────────────────────────


async def abrir_plazos(data, autor: str, db_session: AsyncSession, total_cents: Any = None, n_cuotas: Any = None) -> dict:
    """Guarda la matrícula y abre la caja de pago en modo suscripción. Devuelve
    lo mismo que `enroll_and_checkout_session` (con `payment_url`). `n_cuotas`
    es lo que eligió la persona (`OPCIONES`); sin él, un enlace de antes del
    20/10: 3 pagos con el total firmado en el enlace (`total_valido`)."""
    import stripe

    from src.db.enrollment import Enrollment
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.payments import payments as P

    email = str(data.email).strip().lower()
    if any(p.estado in VIVOS or p.estado == "completado" for p in await planes_de(email, db_session)):
        raise HTTPException(status_code=409, detail="Ya tienes tu plan de pagos en marcha. Mira tu correo para entrar en la escuela")
    if email in await emails_que_pagaron(db_session):
        raise HTTPException(status_code=409, detail="Ya eres alumno de la formación. Mira tu correo para entrar en la escuela")
    await P.ensure_matricula_abierta(db_session)

    P._usar_stripe()
    academy = P._academy_url()
    full_name = f"{data.first_name} {data.last_name}".strip() or data.first_name or "Alumno"
    try:
        elegido = int(n_cuotas or 0)
    except (TypeError, ValueError):
        elegido = 0
    if elegido in OPCIONES:
        n, total = elegido, OPCIONES[elegido]
    else:
        n, total = cuotas(), total_valido(total_cents)
    cuota = reparto(total, n)[0]
    try:
        precio = precio_plazos(cuota)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo preparar el precio de los plazos")
        raise HTTPException(status_code=502, detail=f"No se ha podido preparar el pago a plazos: {exc}")

    try:
        cliente = stripe.Customer.create(
            email=email, name=full_name, phone=data.phone or None,
            metadata={"source": "plan-plazos"},
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se ha podido preparar el pago: {exc}")

    ahora = datetime.now().isoformat()
    fila = await P._matricula_sin_pagar_reciente(email, db_session)
    if fila is not None:
        anterior = fila.stripe_session_id
        fila.first_name, fila.last_name, fila.phone = data.first_name, data.last_name, data.phone or ""
        fila.stripe_customer_id = _id(cliente)
        fila.updated_at = ahora
        if anterior:
            P._cerrar_sesion_anterior(anterior)
            P._cancelar_intento_anterior(anterior)
    else:
        fila = Enrollment(
            email=email, first_name=data.first_name, last_name=data.last_name, phone=data.phone or "",
            status="pending", stripe_customer_id=_id(cliente), stripe_session_id="",
            created_at=ahora, updated_at=ahora,
        )
    P._guardar_procedencia(fila, data)
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)

    euros = f"{total / 100:.2f}".replace(".", ",").replace(",00", "")
    metadatos = {
        "product": "formacion-a0-a1",
        "source": "plan-plazos",
        "plan": "plazos",
        "cuotas": str(n),
        "total_cents": str(total),
        "enrollment_id": str(fila.id or ""),
        "autor": (autor or "")[:60],
    }
    base = dict(
        ui_mode="embedded_page",
        mode="subscription",
        line_items=[{"price": precio, "quantity": 1}],
        customer=_id(cliente),
        return_url=f"{academy}/auth/bienvenido?session_id={{CHECKOUT_SESSION_ID}}",
        allow_promotion_codes=False,
        metadata=metadatos,
        subscription_data={
            "metadata": metadatos,
            "description": f"Formación Nawar A0-A1 · {n} pagos, {euros} € en total (se acaba sola al pago {n})",
        },
    )
    # Tarjeta, iDEAL y Bancontact (los dos últimos dejan una domiciliación SEPA
    # para los cobros siguientes). Sin Klarna: esto es justo la alternativa. Si
    # la cuenta de Stripe no admite iDEAL en suscripciones, solo tarjeta.
    try:
        sesion = stripe.checkout.Session.create(payment_method_types=["card", "ideal", "bancontact"], **base)
    except Exception:  # noqa: BLE001
        logger.warning("Plazos sin iDEAL/Bancontact: se reintenta solo con tarjeta", exc_info=True)
        try:
            sesion = stripe.checkout.Session.create(payment_method_types=["card"], **base)
        except Exception as exc:  # noqa: BLE001
            logger.exception("No se pudo crear la sesión de los plazos")
            raise HTTPException(status_code=502, detail=f"No se ha podido abrir el pago a plazos: {exc}")

    fila.stripe_session_id = _id(sesion)
    fila.updated_at = datetime.now().isoformat()
    db_session.add(fila)
    await db_session.commit()

    secreto = _v(sesion, "client_secret", "")
    if not secreto:
        raise HTTPException(status_code=502, detail="Stripe no ha devuelto la caja de pago")
    pk = P._stripe_publishable()
    return {
        "enrollment_id": fila.id or 0,
        "client_secret": secreto,
        "publishable_key": pk,
        "amount": cuota,
        "currency": "eur",
        "payment_url": (
            f"{academy}/auth/matricula-formacion-nawar-a0-a1"
            f"?ei={fila.id or 0}&cs={quote(secreto, safe='')}&pk={quote(pk, safe='')}"
            f"&amt={cuota}&cur=eur&em={quote(email, safe='')}&nm={quote(full_name, safe='')}"
            f"&ph={quote(data.phone or '', safe='')}&cuotas={n}&tot={total}"
        ),
    }


# ── el calendario de Stripe que corta al tercer cobro ──────────────────────


def asegurar_final(plan: PlanPagos) -> str:
    """Le pone a la suscripción un calendario de `cuotas` meses que la cancela
    al terminar. Idempotente: si ya tiene uno, lo apunta y no toca nada.
    Devuelve el id del calendario. Hay que haber llamado a `_usar_stripe()`."""
    import stripe

    if plan.stripe_schedule_id or not plan.stripe_subscription_id:
        return plan.stripe_schedule_id
    sub = stripe.Subscription.retrieve(plan.stripe_subscription_id)
    ya = _id(_v(sub, "schedule"))
    if ya:
        plan.stripe_schedule_id = ya
        return ya
    calendario = stripe.SubscriptionSchedule.create(from_subscription=plan.stripe_subscription_id)
    fases = _v(calendario, "phases", []) or []
    if not fases:
        raise RuntimeError("Stripe devolvió un calendario sin fases")
    fase = fases[0]
    items = [
        {"price": _id(_v(it, "price")), "quantity": int(_v(it, "quantity", 1) or 1)}
        for it in (_v(fase, "items", []) or [])
    ]
    # Un tramo por importe: con 497 € en 3, dos meses a 165,67 (el precio con
    # el que se pagó el primero) y uno a 165,66. Con cuotas iguales, uno solo.
    partes = tramos(reparto(total_del_plan(plan), int(plan.cuotas or 3))) or [(int(plan.cuota_cents or 0), int(plan.cuotas or 3))]
    nuevas = [
        {
            "items": items,
            "start_date": _v(fase, "start_date"),
            "duration": {"interval": "month", "interval_count": partes[0][1]},
        }
    ]
    for importe, meses in partes[1:]:
        nuevas.append(
            {
                "items": [{"price": precio_plazos(importe), "quantity": 1}],
                "duration": {"interval": "month", "interval_count": meses},
                "proration_behavior": "none",
            }
        )
    stripe.SubscriptionSchedule.modify(_id(calendario), end_behavior="cancel", phases=nuevas)
    plan.stripe_schedule_id = _id(calendario)
    return plan.stripe_schedule_id


def _red_de_seguridad(plan: PlanPagos, sub: Any) -> None:
    """Pagado entero y sin calendario: que no haya un cuarto cobro."""
    import stripe

    if plan.estado != "completado" or plan.stripe_schedule_id or _id(_v(sub, "schedule")):
        return
    if _v(sub, "status") in ("canceled", "incomplete_expired") or _v(sub, "cancel_at_period_end") or _v(sub, "cancel_at"):
        return
    stripe.Subscription.modify(plan.stripe_subscription_id, cancel_at_period_end=True)


# ── apuntar cobros ─────────────────────────────────────────────────────────


async def _guardar(plan: PlanPagos, db_session: AsyncSession) -> None:
    """Recalcula las cifras desde las facturas y lleva lo pagado a la matrícula
    (las estadísticas leen `enrollment.amount_cents`)."""
    pagadas, pagado = cifras(leer_facturas(plan.facturas))
    plan.cuotas_pagadas, plan.pagado_cents = pagadas, pagado
    if pagadas >= int(plan.cuotas or 0) and not plan.completado_at:
        plan.completado_at = _ahora()
    plan.updated_at = _ahora()
    db_session.add(plan)
    if plan.enrollment_id and pagado > 0:
        from src.db.enrollment import Enrollment

        matricula = (
            await db_session.execute(select(Enrollment).where(Enrollment.id == plan.enrollment_id))
        ).scalars().first()
        if matricula is not None and int(matricula.amount_cents or 0) != pagado:
            matricula.amount_cents = pagado
            matricula.updated_at = datetime.now().isoformat()
            db_session.add(matricula)
    await db_session.commit()


async def registrar_primer_pago(obj: dict, enrollment, db_session: AsyncSession) -> Optional[PlanPagos]:
    """Lo llama `_handle_checkout_session` con el primer cobro (sesión en modo
    suscripción). Apunta el plan y le pone el calendario que lo corta. Nunca
    debe impedir el alta: quien llama lo envuelve en un try."""
    import stripe

    sub_id = _id(obj.get("subscription"))
    if not sub_id:
        logger.error("Sesión de plazos sin suscripción (%s)", obj.get("id"))
        return None
    meta = obj.get("metadata") or {}
    plan = await _plan_por_suscripcion(sub_id, db_session)
    if plan is None:
        detalles = obj.get("customer_details") or {}
        nombre = (detalles.get("name") or "").strip().split(" ", 1)
        plan = PlanPagos(
            email=((getattr(enrollment, "email", "") or detalles.get("email") or obj.get("customer_email") or "").strip().lower()),
            first_name=(getattr(enrollment, "first_name", "") or nombre[0])[:120],
            last_name=(getattr(enrollment, "last_name", "") or (nombre[1] if len(nombre) > 1 else ""))[:120],
            phone=(getattr(enrollment, "phone", "") or detalles.get("phone") or "")[:40],
            enrollment_id=getattr(enrollment, "id", None),
            stripe_customer_id=_id(obj.get("customer")),
            stripe_subscription_id=sub_id,
            cuotas=int(meta.get("cuotas") or 0) or cuotas(),
            cuota_cents=int(obj.get("amount_total") or 0) or cuota_cents(),
            # Los enlaces de antes del 19/10 no lo llevan: cuotas × cuota.
            total_cents=int(meta.get("total_cents") or 0),
            currency=(obj.get("currency") or "eur").lower(),
            creado_por=str(meta.get("autor") or "")[:120],
            created_at=_ahora(),
            updated_at=_ahora(),
        )
        db_session.add(plan)
        try:
            await db_session.commit()
        except IntegrityError:
            # El mismo aviso entregado dos veces a la vez: el otro ya la creó.
            await db_session.rollback()
            plan = await _plan_por_suscripcion(sub_id, db_session)
            if plan is None:
                raise
        await db_session.refresh(plan)

    factura = _id(obj.get("invoice"))
    if not factura:
        try:
            factura = _id(_v(stripe.Subscription.retrieve(sub_id), "latest_invoice"))
        except Exception:  # noqa: BLE001
            logger.warning("No se pudo leer la primera factura de %s", sub_id, exc_info=True)
    plan.facturas = json.dumps(anotar_cobro(leer_facturas(plan.facturas), factura, int(obj.get("amount_total") or 0), _ahora()))
    plan.estado = estado_del_plan(pagadas=cifras(leer_facturas(plan.facturas))[0], cuotas=plan.cuotas)
    await _guardar(plan, db_session)

    try:
        asegurar_final(plan)
        await _guardar(plan, db_session)
    except Exception:  # noqa: BLE001
        # La tarea diaria lo vuelve a intentar; y si nunca sale, al tercer
        # pago se pone `cancel_at_period_end` (ver `_red_de_seguridad`).
        logger.exception("No se pudo poner el calendario al plan %s", plan.id)
    return plan


async def atender_factura(inv: dict, pagada: bool, db_session: AsyncSession) -> dict:
    """Avisos `invoice.paid` / `invoice.payment_failed` (si están activados en
    Stripe). Las facturas que no son de un plan se ignoran."""
    plan = await _plan_por_suscripcion(suscripcion_de_factura(inv), db_session)
    if plan is None:
        return {"detail": "factura sin plan de pagos"}
    factura = _id(inv)
    facturas = leer_facturas(plan.facturas)
    if pagada:
        cobrado = int(inv.get("amount_paid") or 0)
        fecha = _iso(((inv.get("status_transitions") or {}).get("paid_at"))) or _ahora()
        plan.facturas = json.dumps(anotar_cobro(facturas, factura, cobrado, fecha))
        plan.fallo = ""
        plan.estado = estado_del_plan(pagadas=cifras(leer_facturas(plan.facturas))[0], cuotas=plan.cuotas)
    elif factura not in facturas:
        numero = len(facturas) + 1
        plan.fallo = texto_fallo(numero, plan.cuotas, int(inv.get("amount_due") or plan.cuota_cents), inv.get("next_payment_attempt"))
        plan.estado = "fallido"
        if plan.fallo_avisado != factura:
            await _avisar_fallo(plan, numero, db_session)
            plan.fallo_avisado = factura
    await _guardar(plan, db_session)
    return {"detail": "plan de pagos actualizado", "estado": plan.estado, "pagadas": plan.cuotas_pagadas}


async def _avisar_fallo(plan: PlanPagos, numero: int, db_session: AsyncSession) -> int:
    """Un correo a cada administrador. Nunca lanza."""
    try:
        from src.services.contactos.llamadas import emails_de_administradores
        from src.services.users.emails import send_plazo_fallido_email

        enviados = 0
        for destino in await emails_de_administradores(db_session):
            try:
                send_plazo_fallido_email(destino, {**resumen(plan), "email": plan.email,
                                                   "nombre": f"{plan.first_name} {plan.last_name}".strip(),
                                                   "telefono": plan.phone, "numero": numero, "fallo": plan.fallo})
                enviados += 1
            except Exception:  # noqa: BLE001
                logger.exception("No se pudo avisar del cobro fallido del plan %s", plan.id)
        return enviados
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar del cobro fallido del plan %s", plan.id)
        return 0


# ── preguntarle a Stripe (tarea diaria y botón «Comprobar ahora») ─────────


async def sincronizar(plan: PlanPagos, db_session: AsyncSession) -> dict:
    """Pone el plan al día con lo que dice Stripe. Hay que haber llamado a
    `_usar_stripe()`."""
    import stripe

    sub = stripe.Subscription.retrieve(plan.stripe_subscription_id)
    facturas = leer_facturas(plan.facturas)
    fallidas = []
    for inv in _lista(stripe.Invoice.list(subscription=plan.stripe_subscription_id, limit=24)):
        estado = _v(inv, "status", "")
        if estado == "paid" and int(_v(inv, "amount_paid", 0) or 0) > 0:
            pagada_el = _iso(_v(_v(inv, "status_transitions"), "paid_at")) or _ahora()
            facturas = anotar_cobro(facturas, _id(inv), int(_v(inv, "amount_paid", 0)), pagada_el)
        elif estado == "open" and int(_v(inv, "attempt_count", 0) or 0) > 0:
            fallidas.append(inv)
    plan.facturas = json.dumps(facturas)
    pagadas = len(facturas)

    estado_stripe = str(_v(sub, "status", "") or "")
    plan.estado = estado_del_plan(pagadas=pagadas, cuotas=plan.cuotas, estado_stripe=estado_stripe, fallida=bool(fallidas))

    # El próximo cobro: el final del periodo actual (desde 2025 vive en cada
    # línea de la suscripción, antes en la propia suscripción).
    items = _lista(_v(sub, "items"))
    fin = _v(items[0], "current_period_end") if items else None
    plan.proximo_cobro = _iso(fin or _v(sub, "current_period_end")) if plan.estado in VIVOS else ""

    if plan.estado in ("fallido", "cancelado") and pagadas < plan.cuotas:
        ultima = fallidas[0] if fallidas else None
        cents = int(_v(ultima, "amount_due", 0) or plan.cuota_cents)
        plan.fallo = texto_fallo(pagadas + 1, plan.cuotas, cents, _v(ultima, "next_payment_attempt") if ultima else None)
        clave = _id(ultima) if ultima else f"sub:{estado_stripe}"
        if plan.fallo_avisado != clave:
            await _avisar_fallo(plan, pagadas + 1, db_session)
            plan.fallo_avisado = clave
    else:
        plan.fallo = ""

    if plan.estado in VIVOS:
        try:
            asegurar_final(plan)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo poner el calendario al plan %s", plan.id)
    _red_de_seguridad(plan, sub)

    plan.sincronizado_at = _ahora()
    await _guardar(plan, db_session)
    return resumen(plan)


async def comprobar_ahora(plan_id: int, db_session: AsyncSession) -> dict:
    from src.services.payments.payments import _usar_stripe

    plan = (await db_session.execute(select(PlanPagos).where(PlanPagos.id == plan_id))).scalars().first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado")
    _usar_stripe()
    try:
        return await sincronizar(plan, db_session)
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo comprobar el plan %s", plan_id)
        raise HTTPException(status_code=502, detail=f"Stripe no ha contestado: {exc}")


async def sincronizar_planes(db_session: AsyncSession) -> dict:
    """La tarea diaria. Solo NÚMEROS en lo que devuelve: sale en el registro
    de GitHub Actions, que es público."""
    from src.services.payments.payments import _usar_stripe

    hace_40 = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
    planes = [
        p
        for p in (await db_session.execute(select(PlanPagos))).scalars().all()
        if p.estado in VIVOS or (p.estado == "completado" and not p.stripe_schedule_id and (p.completado_at or "") >= hace_40)
    ]
    salida = {"revisados": 0, "al_dia": 0, "fallidos": 0, "completados": 0, "errores": 0}
    if not planes:
        return salida
    try:
        _usar_stripe()
    except Exception:  # noqa: BLE001
        salida["errores"] = len(planes)
        return salida
    for plan in planes:
        try:
            r = await sincronizar(plan, db_session)
            salida["revisados"] += 1
            clave = {"activo": "al_dia", "fallido": "fallidos", "completado": "completados"}.get(r["estado"])
            if clave:
                salida[clave] += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo sincronizar el plan %s", plan.id)
            salida["errores"] += 1
    return salida

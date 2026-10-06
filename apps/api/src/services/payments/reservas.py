"""
Reservar plaza con una señal y pagar el resto después (06/10/2026).

Pedido del usuario: "Manuel está en llamada, tuvo problemas con Klarna o su
tarjeta y no pudo cerrar. Se le pasa un enlace de pago de 50 € como señal para
guardarse la plaza y queda registrado en su ficha, con lo que pagó y lo que
queda pendiente. No se le da acceso con los 50 €; cuando complete lo restante,
ahí se le da acceso. Que sea el checkout nuestro, el de siempre."

Cómo va
-------
1. El equipo crea desde la ficha un enlace por un importe (la señal). Eso abre
   (o reaprovecha) una `ReservaPlaza` con el total a pagar.
2. El enlace lleva firmados la reserva y el importe. Al ABRIRLO se crea la
   sesión de pago de Stripe por ese importe y se lleva a la persona a la caja
   de la escuela de siempre, que enseña "señal · ya pagado · lo que queda".
3. El aviso de Stripe (`reserva_pago_id` en los metadatos) apunta el pago y
   recalcula lo pagado. Si aún falta, nada más: la plaza queda reservada,
   **sin cuenta y sin correo de bienvenida**. Stripe manda su recibo y su
   factura, como con cualquier cobro.
4. Cuando lo pagado llega al total, la reserva se completa: se crea la
   matrícula `paid` con el total cobrado y se da el alta exactamente igual que
   un pago normal (`_provision_after_payment`: cuenta, correo de crear
   contraseña, etiqueta del CRM, automatizaciones).

Lo que cuida
------------
- Stripe manda DOS avisos por cada cobro (sesión completada y PaymentIntent).
  El pago se "reclama" con un UPDATE condicionado, igual que la bienvenida
  (`_reclamar_matricula`): solo uno de los dos lo apunta.
- `pagado_cents` se recalcula sumando los pagos, nunca se incrementa.
- El importe de un enlace se recorta a lo que quede pendiente al ABRIRLO: un
  enlace viejo no puede cobrar de más si entretanto ya pagó por otro lado.
- La señal ocupa plaza (`emails_con_plaza_reservada`, lo lee
  `get_seat_status`), y por eso el resto se puede pagar aunque la convocatoria
  ya esté llena: su plaza es suya.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.reservas import ReservaPago, ReservaPlaza

logger = logging.getLogger(__name__)

#: Lo mínimo que Stripe deja cobrar en euros.
MINIMO_CENTS = 50
#: La señal que se propone por defecto en la pantalla.
SENAL_POR_DEFECTO_CENTS = 5000

NOMBRE_TIPO = {
    "senal": "Señal (reserva de plaza)",
    "parcial": "Pago parcial",
    "resto": "Pago restante",
}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── lógica pura (con test) ─────────────────────────────────────────────────


def pendiente_de(total_cents: int, pagado_cents: int) -> int:
    return max(0, int(total_cents or 0) - int(pagado_cents or 0))


def tipo_de_pago(total_cents: int, pagado_antes: int, importe: int) -> str:
    """Cómo se llama este pago: el que completa es «resto»; el primero que no
    completa, «señal»; uno intermedio, «parcial»."""
    if pagado_antes + importe >= total_cents:
        return "resto"
    if pagado_antes <= 0:
        return "senal"
    return "parcial"


def importe_a_cobrar(pedido: int, total_cents: int, pagado_cents: int) -> int:
    """Lo que se cobra de verdad: lo pedido, sin pasar de lo pendiente.
    0 si ya no queda nada. Error si lo que queda es menos que el mínimo de
    Stripe y no completa (no debería pasar: se valida al crear el enlace)."""
    falta = pendiente_de(total_cents, pagado_cents)
    if falta <= 0:
        return 0
    importe = min(int(pedido or 0), falta)
    if importe < MINIMO_CENTS and importe < falta:
        raise HTTPException(status_code=400, detail="El importe mínimo es 0,50 €")
    return importe


def resumen(reserva: ReservaPlaza, pagos: list[ReservaPago]) -> dict:
    total = int(reserva.total_cents or 0)
    pagado = int(reserva.pagado_cents or 0)
    return {
        "id": reserva.id,
        "email": reserva.email,
        "nombre": f"{reserva.first_name} {reserva.last_name}".strip(),
        "telefono": reserva.phone,
        "estado": reserva.estado,
        "total_cents": total,
        "pagado_cents": pagado,
        "pendiente_cents": pendiente_de(total, pagado),
        "moneda": reserva.currency or "eur",
        "creado_por": reserva.creado_por,
        "created_at": reserva.created_at,
        "completada_at": reserva.completada_at,
        "cancelada_at": reserva.cancelada_at,
        "pagos": [
            {
                "id": p.id,
                "tipo": p.tipo,
                "nombre": NOMBRE_TIPO.get(p.tipo, p.tipo),
                "importe_cents": p.importe_cents,
                "estado": p.estado,
                "creado_por": p.creado_por,
                "created_at": p.created_at,
                "paid_at": p.paid_at,
            }
            for p in sorted(pagos, key=lambda x: str(x.paid_at or x.created_at or ""), reverse=True)
            # Las sesiones viejas que nadie pagó no le dicen nada a nadie.
            if p.estado != "caducado"
        ],
    }


# ── lectura ────────────────────────────────────────────────────────────────


async def _pagos_de(reserva_id: int, db_session: AsyncSession) -> list[ReservaPago]:
    # populate_existing: los pagos se marcan con UPDATE directos; sin esto la
    # sesión devolvería la copia vieja que ya tenía en memoria.
    return list(
        (
            await db_session.execute(
                select(ReservaPago)
                .where(ReservaPago.reserva_id == reserva_id)
                .execution_options(populate_existing=True)
            )
        ).scalars().all()
    )


async def reserva_abierta_de(email: str, db_session: AsyncSession) -> Optional[ReservaPlaza]:
    return (
        await db_session.execute(
            select(ReservaPlaza)
            .where(func.lower(ReservaPlaza.email) == email.strip().lower())
            .where(ReservaPlaza.estado == "abierta")
            .order_by(ReservaPlaza.id.desc())  # type: ignore[union-attr]
        )
    ).scalars().first()


async def reserva_de(email: str, db_session: AsyncSession) -> Optional[dict]:
    """Para la ficha: la abierta si la hay; si no, la última (completada o
    cancelada), para que se vea cómo pagó."""
    clave = (email or "").strip().lower()
    if not clave:
        return None
    filas = (
        await db_session.execute(
            select(ReservaPlaza)
            .where(func.lower(ReservaPlaza.email) == clave)
            .order_by(ReservaPlaza.id.desc())  # type: ignore[union-attr]
        )
    ).scalars().all()
    if not filas:
        return None
    elegida = next((r for r in filas if r.estado == "abierta"), filas[0])
    return resumen(elegida, await _pagos_de(int(elegida.id or 0), db_session))


async def reservas_abiertas(db_session: AsyncSession) -> list[dict]:
    """Quién tiene la plaza reservada y cuánto le falta. Lo más nuevo arriba."""
    filas = (
        await db_session.execute(
            select(ReservaPlaza).where(ReservaPlaza.estado == "abierta").order_by(ReservaPlaza.id.desc())  # type: ignore[union-attr]
        )
    ).scalars().all()
    return [resumen(r, await _pagos_de(int(r.id or 0), db_session)) for r in filas]


async def emails_con_plaza_reservada(db_session: AsyncSession) -> set[str]:
    """Quien ya pagó una señal y aún no ha completado: ocupa plaza."""
    filas = (
        await db_session.execute(
            select(ReservaPlaza.email).where(ReservaPlaza.estado == "abierta").where(ReservaPlaza.pagado_cents > 0)
        )
    ).all()
    return {str(e[0]).strip().lower() for e in filas if e and e[0]}


# ── el equipo crea el enlace ───────────────────────────────────────────────


async def precio_formacion() -> tuple[int, str]:
    """El precio de la formación, del Price de Stripe (el mismo que cobra la
    matrícula normal). Así el total de una reserva sale del mismo sitio."""
    import stripe

    from src.services.payments.payments import _formacion_price_id, _usar_stripe

    _usar_stripe()
    try:
        price = stripe.Price.retrieve(_formacion_price_id())
        cents = price.get("unit_amount") if hasattr(price, "get") else getattr(price, "unit_amount", 0)
        moneda = price.get("currency") if hasattr(price, "get") else getattr(price, "currency", "eur")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se ha podido leer el precio de Stripe: {exc}")
    if not cents:
        raise HTTPException(status_code=500, detail="El precio de la formación en Stripe está vacío")
    return int(cents), (moneda or "eur").lower()


async def crear_enlace(
    *,
    email: str,
    first_name: str,
    last_name: str,
    phone: str,
    importe_cents: int,
    total_cents: Optional[int],
    autor: str,
    es_admin: bool,
    db_session: AsyncSession,
) -> dict:
    """Crea (o reaprovecha) la reserva y devuelve el enlace firmado.

    El total solo lo puede fijar un administrador (es lo que se le cobra a la
    persona); para el closer, el precio de la formación. Una reserva abierta
    mantiene su total: el enlace nuevo cobra a cuenta de ella."""
    from config.config import get_learnhouse_config
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.payments.enlace import DIAS_VALIDEZ, firmar
    from src.services.payments.payments import _academy_url

    clave = (email or "").strip().lower()
    if "@" not in clave:
        raise HTTPException(status_code=400, detail="Hace falta un correo válido")
    if clave in await emails_que_pagaron(db_session):
        raise HTTPException(status_code=400, detail="Ya es alumno: no hay nada pendiente que cobrarle")

    reserva = await reserva_abierta_de(clave, db_session)
    ahora = _ahora()
    if reserva is None:
        if es_admin and total_cents:
            total, moneda = int(total_cents), "eur"
        else:
            total, moneda = await precio_formacion()
        if total < MINIMO_CENTS:
            raise HTTPException(status_code=400, detail="El total tiene que ser de al menos 0,50 €")
        reserva = ReservaPlaza(
            email=clave,
            first_name=first_name.strip()[:120],
            last_name=last_name.strip()[:120],
            phone=phone.strip()[:40],
            total_cents=total,
            currency=moneda,
            creado_por=autor[:120],
            created_at=ahora,
            updated_at=ahora,
        )
        db_session.add(reserva)
        await db_session.commit()
        await db_session.refresh(reserva)
    else:
        # Los datos de contacto más nuevos, si vienen.
        if first_name.strip():
            reserva.first_name = first_name.strip()[:120]
            reserva.last_name = last_name.strip()[:120]
        if phone.strip():
            reserva.phone = phone.strip()[:40]
        reserva.updated_at = ahora
        db_session.add(reserva)
        await db_session.commit()

    falta = pendiente_de(reserva.total_cents, reserva.pagado_cents)
    importe = int(importe_cents or 0)
    if importe < MINIMO_CENTS:
        raise HTTPException(status_code=400, detail="El importe mínimo es 0,50 €")
    if importe > falta:
        raise HTTPException(
            status_code=400,
            detail=f"Solo le quedan {falta / 100:.2f} € por pagar".replace(".", ","),
        )

    secreto = get_learnhouse_config().security_config.auth_jwt_secret_key
    token = firmar({"r": reserva.id, "i": importe, "e": clave, "a": autor[:60]}, secreto)

    # En su línea de tiempo: quién le mandó el enlace y de cuánto.
    try:
        from src.db.contact_event import ContactEventCreate
        from src.services.contactos.contactos import registrar_evento

        await registrar_evento(
            ContactEventCreate(
                email=clave, kind="enlace-pago", first_name=reserva.first_name, last_name=reserva.last_name,
                phone=reserva.phone, source="equipo",
                extra={"autor": autor, "importe_cents": importe, "reserva": reserva.id},
            ),
            db_session,
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo apuntar el enlace de reserva de %s", clave)

    return {
        "url": f"{_academy_url()}/api/v1/payments/reserva/{token}",
        "dias": DIAS_VALIDEZ,
        "tipo": tipo_de_pago(reserva.total_cents, reserva.pagado_cents, importe),
        "importe_cents": importe,
        "reserva": resumen(reserva, await _pagos_de(int(reserva.id or 0), db_session)),
    }


# ── la persona abre el enlace ──────────────────────────────────────────────


def _caducar(session_id: str) -> bool:
    """Caduca una sesión vieja. True si Stripe la cerró (o ya no existía)."""
    import stripe

    if not session_id.startswith("cs_"):
        return True
    try:
        stripe.checkout.Session.expire(session_id)
        return True
    except Exception:  # noqa: BLE001
        # Ya pagada, ya caducada o Stripe no contesta: no se toca la fila. Si
        # estaba pagada, su aviso la apuntará igual.
        logger.warning("No se pudo caducar la sesión %s", session_id, exc_info=True)
        return False


async def abrir_pago(token: str, db_session: AsyncSession) -> str:
    """Crea la sesión de pago por el importe del enlace y devuelve la dirección
    de la caja de la escuela. Errores como HTTPException con un texto que se
    puede enseñar tal cual."""
    import stripe

    from config.config import get_learnhouse_config
    from src.services.payments.enlace import verificar
    from src.services.payments.payments import (
        _academy_url,
        _stripe_publishable,
        _usar_stripe,
        ensure_matricula_abierta,
    )

    datos = verificar(token, get_learnhouse_config().security_config.auth_jwt_secret_key)
    if not datos or not datos.get("r"):
        raise HTTPException(status_code=410, detail="Este enlace ha caducado o no está completo")
    reserva = (
        await db_session.execute(select(ReservaPlaza).where(ReservaPlaza.id == int(datos["r"])))
    ).scalars().first()
    if reserva is None or reserva.estado == "cancelada":
        raise HTTPException(status_code=410, detail="Esta reserva ya no está activa")
    if reserva.estado == "completada":
        raise HTTPException(status_code=409, detail="Ya está todo pagado. ¡Revisa tu correo para entrar en la escuela!")

    importe = importe_a_cobrar(int(datos.get("i") or 0), reserva.total_cents, reserva.pagado_cents)
    if importe <= 0:
        raise HTTPException(status_code=409, detail="Ya está todo pagado")

    # La primera señal ocupa una plaza: tiene que haberla. Lo que viene después
    # se paga aunque ya no queden, porque su plaza ya es suya.
    if int(reserva.pagado_cents or 0) <= 0:
        await ensure_matricula_abierta(db_session)

    _usar_stripe()
    nombre = f"{reserva.first_name} {reserva.last_name}".strip() or reserva.email.split("@")[0]
    if not reserva.stripe_customer_id:
        try:
            cliente = stripe.Customer.create(
                email=reserva.email, name=nombre, phone=reserva.phone or None,
                metadata={"source": "reserva-plaza", "reserva_id": str(reserva.id)},
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"No se ha podido preparar el pago: {exc}")
        reserva.stripe_customer_id = cliente.id

    # Si ya se abrió antes y no se pagó, esa sesión se cierra: dos pestañas
    # abiertas no pueden acabar en dos cobros.
    for viejo in await _pagos_de(int(reserva.id or 0), db_session):
        if viejo.estado == "pendiente" and _caducar(viejo.stripe_session_id):
            viejo.estado = "caducado"
            db_session.add(viejo)

    tipo = tipo_de_pago(reserva.total_cents, reserva.pagado_cents, importe)
    pago = ReservaPago(
        reserva_id=int(reserva.id or 0),
        tipo=tipo,
        importe_cents=importe,
        currency=reserva.currency or "eur",
        estado="pendiente",
        creado_por=str(datos.get("a") or "")[:120],
        created_at=_ahora(),
    )
    db_session.add(pago)
    reserva.updated_at = _ahora()
    db_session.add(reserva)
    await db_session.commit()
    await db_session.refresh(pago)

    concepto = {
        "senal": "Señal · reserva de plaza · Formación Nawar A0-A1",
        "parcial": "Pago a cuenta · Formación Nawar A0-A1",
        "resto": "Pago restante · Formación Nawar A0-A1",
    }[tipo]
    metadatos = {
        "product": reserva.product or "formacion-a0-a1",
        "source": "reserva-plaza",
        "reserva_id": str(reserva.id),
        "reserva_pago_id": str(pago.id),
        "tipo": tipo,
        # Como en la matrícula normal: la factura la emite Stripe (invoice_creation)
        # y esta marca evita que el aviso del PaymentIntent haga otra.
        "factura_stripe": "1",
    }
    academy = _academy_url()
    pagado_despues = int(reserva.pagado_cents or 0) + importe
    falta_despues = pendiente_de(reserva.total_cents, pagado_despues)
    # Al volver: si con esto completa, la bienvenida de siempre (le llega el
    # correo para crear su contraseña). Si no, la de "plaza reservada".
    vuelta = f"{academy}/auth/bienvenido?session_id={{CHECKOUT_SESSION_ID}}"
    if falta_despues > 0:
        vuelta += f"&reserva=1&pag={pagado_despues}&pend={falta_despues}&cur={reserva.currency or 'eur'}"
    try:
        sesion = stripe.checkout.Session.create(
            ui_mode="embedded_page",
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": reserva.currency or "eur",
                        "unit_amount": importe,
                        "product_data": {"name": concepto},
                    },
                    "quantity": 1,
                }
            ],
            customer=reserva.stripe_customer_id,
            return_url=vuelta,
            invoice_creation={
                "enabled": True,
                "invoice_data": {
                    "description": concepto,
                    "footer": (
                        f"Total de la formación: {reserva.total_cents / 100:.2f} €. "
                        f"Pagado con este: {pagado_despues / 100:.2f} €. "
                        f"Pendiente: {falta_despues / 100:.2f} €."
                    ).replace(".", ","),
                    "metadata": {"product": reserva.product or "formacion-a0-a1", "reserva_id": str(reserva.id)},
                },
            },
            allow_promotion_codes=False,
            payment_method_types=["card", "ideal", "klarna", "bancontact"],
            metadata=metadatos,
            payment_intent_data={"metadata": metadatos},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo crear la sesión de la reserva %s", reserva.id)
        pago.estado = "caducado"
        db_session.add(pago)
        await db_session.commit()
        raise HTTPException(status_code=502, detail=f"No se ha podido abrir el pago: {exc}")

    pago.stripe_session_id = sesion.id
    db_session.add(pago)
    await db_session.commit()

    secreto_cliente = getattr(sesion, "client_secret", None) or (sesion.get("client_secret") if hasattr(sesion, "get") else None)
    if not secreto_cliente:
        raise HTTPException(status_code=502, detail="Stripe no ha devuelto la caja de pago")

    pk = _stripe_publishable()
    return (
        f"{academy}/auth/matricula-formacion-nawar-a0-a1"
        f"?cs={quote(secreto_cliente, safe='')}&pk={quote(pk, safe='')}"
        f"&amt={importe}&cur={reserva.currency or 'eur'}"
        f"&em={quote(reserva.email, safe='')}&nm={quote(nombre, safe='')}&ph={quote(reserva.phone or '', safe='')}"
        f"&tipo={tipo}&tot={reserva.total_cents}&prev={int(reserva.pagado_cents or 0)}"
    )


# ── el aviso de Stripe ─────────────────────────────────────────────────────


async def _recalcular(reserva: ReservaPlaza, db_session: AsyncSession) -> int:
    # Una suma en la base de datos, no en memoria: es la cifra que decide si
    # se da acceso.
    pagado = int(
        (
            await db_session.execute(
                select(func.coalesce(func.sum(ReservaPago.importe_cents), 0))
                .where(ReservaPago.reserva_id == reserva.id)
                .where(ReservaPago.estado == "pagado")
            )
        ).scalar_one()
        or 0
    )
    reserva.pagado_cents = pagado
    reserva.updated_at = _ahora()
    db_session.add(reserva)
    await db_session.commit()
    return pagado


async def atender_pago(pago_id: int, importe_cobrado: int, db_session: AsyncSession) -> dict:
    """Lo llaman los dos avisos de Stripe de un mismo cobro. Apunta el pago una
    sola vez; si completa la reserva, da el alta igual que un pago normal."""
    from src.services.payments.payments import (
        _provision_after_payment,
        _reclamar_matricula,
        _soltar_matricula,
    )

    pago = (await db_session.execute(select(ReservaPago).where(ReservaPago.id == pago_id))).scalars().first()
    if pago is None:
        logger.error("Aviso de Stripe para un pago de reserva que no existe (%s)", pago_id)
        return {"detail": "reserva_pago not found"}

    # 1. El pago, una sola vez (UPDATE condicionado: el segundo aviso no
    #    cambia ninguna fila). Cuenta también uno marcado como caducado: si
    #    Stripe lo cobró, se cobró.
    res = await db_session.execute(
        update(ReservaPago)
        .where(ReservaPago.id == pago_id)
        .where(ReservaPago.estado != "pagado")
        .values(
            estado="pagado",
            paid_at=_ahora(),
            importe_cents=int(importe_cobrado or pago.importe_cents or 0),
        )
    )
    await db_session.commit()
    apuntado = (res.rowcount or 0) > 0

    reserva = (
        await db_session.execute(
            select(ReservaPlaza).where(ReservaPlaza.id == pago.reserva_id).execution_options(populate_existing=True)
        )
    ).scalars().first()
    if reserva is None:
        return {"detail": "reserva not found"}
    pagado = await _recalcular(reserva, db_session)

    # 2. ¿Completa? Se reclama también, para que solo un aviso cree la matrícula.
    if reserva.estado == "abierta" and pagado >= int(reserva.total_cents or 0):
        res = await db_session.execute(
            update(ReservaPlaza)
            .where(ReservaPlaza.id == reserva.id)
            .where(ReservaPlaza.estado == "abierta")
            .values(estado="completada", completada_at=_ahora())
        )
        await db_session.commit()
        if (res.rowcount or 0) > 0:
            ahora = _ahora()
            matricula = Enrollment(
                email=reserva.email,
                first_name=reserva.first_name,
                last_name=reserva.last_name,
                phone=reserva.phone,
                status="paid",
                product=reserva.product or "formacion-a0-a1",
                amount_cents=pagado,
                currency=reserva.currency or "eur",
                paid_at=ahora,
                stripe_customer_id=reserva.stripe_customer_id,
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
                utm_medium="reserva",
                recorrido="reserva",
            )
            db_session.add(matricula)
            await db_session.commit()
            await db_session.refresh(matricula)
            reserva.enrollment_id = matricula.id
            reserva.estado = "completada"
            db_session.add(reserva)
            await db_session.commit()
        else:
            await db_session.refresh(reserva)

    if reserva.estado != "completada" or not reserva.enrollment_id:
        # Plaza reservada, sin acceso. Stripe ya manda recibo y factura.
        return {"detail": "pago de reserva apuntado" if apuntado else "pago de reserva ya apuntado", "pagado_cents": pagado}

    # 3. Completada: el alta de siempre, una sola vez (marca en la matrícula).
    matricula = (
        await db_session.execute(select(Enrollment).where(Enrollment.id == reserva.enrollment_id))
    ).scalars().first()
    if matricula is None:
        return {"detail": "reserva completada sin matrícula"}
    nombre = f"{reserva.first_name} {reserva.last_name}".strip()
    ya_atendida = not await _reclamar_matricula(matricula, db_session)
    resultado = await _provision_after_payment(reserva.email, nombre, db_session, ya_atendida=ya_atendida)
    if not ya_atendida and not resultado.get("atendida_ahora"):
        await _soltar_matricula(matricula, db_session)

    if resultado.get("atendida_ahora") and resultado.get("user_id") and resultado.get("org_id"):
        from src.services.automations.engine import run_trigger

        await run_trigger(
            "payment_completed",
            int(resultado["org_id"]),
            int(resultado["user_id"]),
            db_session,
            extra={"importe": f"{pagado / 100:.2f} {(reserva.currency or 'eur').upper()}"},
        )
    return {**resultado, "reserva": "completada"}


# ── el administrador corrige ───────────────────────────────────────────────


async def _reserva(reserva_id: int, db_session: AsyncSession) -> ReservaPlaza:
    r = (await db_session.execute(select(ReservaPlaza).where(ReservaPlaza.id == reserva_id))).scalars().first()
    if r is None:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return r


async def cambiar_total(reserva_id: int, total_cents: int, db_session: AsyncSession) -> dict:
    """Otro total pactado. Tiene que quedar algo por pagar: para dar acceso con
    lo que ya pagó está «Dar de alta a mano» en Facturas."""
    r = await _reserva(reserva_id, db_session)
    if r.estado != "abierta":
        raise HTTPException(status_code=400, detail="Solo se cambia el total de una reserva abierta")
    if int(total_cents) <= int(r.pagado_cents or 0):
        raise HTTPException(
            status_code=400,
            detail="El total tiene que ser mayor que lo ya pagado. Para darle acceso con lo pagado, usa «Dar de alta a mano».",
        )
    r.total_cents = int(total_cents)
    r.updated_at = _ahora()
    db_session.add(r)
    await db_session.commit()
    return resumen(r, await _pagos_de(int(r.id or 0), db_session))


async def cancelar(reserva_id: int, db_session: AsyncSession) -> dict:
    """Libera la plaza y cierra los enlaces que queden. NO devuelve dinero: si
    pagó una señal y hay que devolverla, se hace en Stripe."""
    r = await _reserva(reserva_id, db_session)
    if r.estado != "abierta":
        raise HTTPException(status_code=400, detail="Esta reserva ya no está abierta")
    for p in await _pagos_de(int(r.id or 0), db_session):
        if p.estado == "pendiente" and _caducar_seguro(p.stripe_session_id):
            p.estado = "caducado"
            db_session.add(p)
    r.estado = "cancelada"
    r.cancelada_at = _ahora()
    r.updated_at = r.cancelada_at
    db_session.add(r)
    await db_session.commit()
    return resumen(r, await _pagos_de(int(r.id or 0), db_session))


def _caducar_seguro(session_id: str) -> bool:
    try:
        from src.services.payments.payments import _usar_stripe

        _usar_stripe()
    except Exception:  # noqa: BLE001
        return False
    return _caducar(session_id)

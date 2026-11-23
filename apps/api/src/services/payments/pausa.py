"""
La regla de los plazos sin pagar: a los N días, el acceso queda en pausa
(23/11/2026).

Pedido del usuario: «regla para plazos también». Lo acordado: a los 7 días de
un cobro fallido el acceso queda en pausa y vuelve solo al pagar. **Nace
APAGADA**: se enciende en Panel → Pagos a plazos, que enseña a quién afectaría
hoy. Con la regla apagada la escuela se porta exactamente igual que antes: lo
único que se hace es apuntar en cada plan qué factura está sin pagar y desde
cuándo (`plan_pagos.impago`), que es lo que permite enseñar esa lista.

Cómo se decide
--------------
«En pausa» SE CALCULA, no se guarda. Una persona está en pausa si:

1. la regla está encendida (org_config `plazos_regla`: `activa`, `dias`), y
2. tiene un plan con una FACTURA SIN PAGAR (`impago`) y ya han pasado N días
   desde que esa factura se intentó cobrar por primera vez (por días de
   calendario, hora de Países Bajos), y
3. ese plan no tiene puesto «No pausar a esta persona» (`sin_pausa`), y
4. no tiene OTRA matrícula pagada que no cuelgue de un plan con deuda (pagó
   el resto con un enlace de «Otro importe», o tiene otro plan al día), y
5. en la escuela es alumno y nada más (rol 4): al equipo, a los closers y a
   los administradores no se les pausa nunca.

Como se calcula, vuelve sola: en cuanto la factura se paga (aviso
`invoice.paid` de Stripe, la tarea diaria o el botón «Ya he pagado:
comprobar»), `plazos.py` vacía `impago` y la persona deja de estar en pausa.

`impago` va SIEMPRE atado a una factura que se puede pagar (abierta o dada por
incobrable en Stripe, con algún intento de cobro): así siempre hay un enlace
para pagar y «vuelve al pagar» es verdad. Casos:

- Stripe reintenta y sigue fallando: el plan está «Cobro fallido», `impago`
  conserva el día del PRIMER intento de esa factura (no el de cada reintento).
- Stripe deja de reintentar y cancela la suscripción con la factura sin pagar:
  el plan pasa a «Cancelado» pero `impago` se queda → sigue en pausa hasta que
  pague esa factura (o el equipo le ponga «No pausar»).
- El equipo cancela la suscripción a mano en Stripe: NO se distingue del
  caso anterior (Stripe da el mismo motivo, «cancellation_requested», cuando
  la cancela el equipo que cuando se acaba el calendario del plan). Mientras
  quede una factura que se puede pagar, se debe. Para perdonársela: anular
  (void) esa factura en Stripe, o «No pausar a esta persona».
- La factura se anula (void) en Stripe: ya no se puede pagar → `impago` se
  vacía y no hay pausa.
- Plan terminado (todas las cuotas) o al día: no hay `impago`.
- Quien cambió el correo con el que entra (18/11): el plan sigue con el correo
  del pago, que ya no es el de su cuenta, y la regla no le encuentra. Queda
  SIN pausa (se falla hacia dejar entrar) y el panel lo dice en ese plan.

Qué se pausa
------------
La formación y las clases en directo: todo lo que cuelga de un curso (el
curso, sus capítulos y clases, las salas, las semanas, las tareas, las
grabaciones y la pizarra pasan por `check_resource_access` del curso, y ahí
está la puerta), y la lista de cursos. La comunidad, los mensajes, las
consultas y Recursos NO: tiene que poder escribir al equipo.

Coste: la regla y la lista de quién está en pausa se guardan un minuto en
memoria (la API es un solo proceso). Con la regla apagada es UNA consulta
pequeña por minuto (leer la regla); encendida, dos más por minuto, y una
por petición solo para quien está en la lista (mirar que es alumno).

La puerta nunca rompe una petición: lee dentro de un SAVEPOINT y, ante
cualquier fallo, deja entrar (y no vuelve a probar hasta dentro de un minuto).
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.plan_pagos import PlanPagos

logger = logging.getLogger(__name__)

CLAVE = "plazos_regla"
DIAS_DE_SERIE = 7
DIAS_MIN, DIAS_MAX = 3, 30

#: Estados del plan en los que puede haber una factura sin pagar.
CON_DEUDA = ("fallido", "cancelado")

#: Lo que ve quien intenta abrir un curso estando en pausa (la pantalla del
#: alumno no enseña este texto: pinta la suya con `GET /student/acceso`).
MOTIVO = "Tu acceso está en pausa: falta un pago de tu plan."


# ── lógica pura (con test) ─────────────────────────────────────────────────


def limpiar_regla(datos: Any) -> dict:
    """La regla, siempre con la misma forma. Sin nada guardado: apagada, 7 días."""
    d = datos if isinstance(datos, dict) else {}
    try:
        dias = int(d.get("dias") or DIAS_DE_SERIE)
    except (TypeError, ValueError):
        dias = DIAS_DE_SERIE
    return {"activa": d.get("activa") is True, "dias": min(DIAS_MAX, max(DIAS_MIN, dias))}


def leer_impago(texto: Any) -> dict:
    """Lo apuntado de la factura sin pagar. Vacío = no debe nada."""
    try:
        d = json.loads(texto) if isinstance(texto, str) and texto.strip() else (texto if isinstance(texto, dict) else {})
    except (TypeError, ValueError):
        d = {}
    if not isinstance(d, dict) or not str(d.get("desde") or "") or not str(d.get("factura") or ""):
        return {"desde": "", "factura": "", "cents": 0, "url": "", "avisada": ""}
    try:
        cents = int(d.get("cents") or 0)
    except (TypeError, ValueError):
        cents = 0
    return {
        "desde": str(d.get("desde") or ""),
        "factura": str(d.get("factura") or ""),
        "cents": cents,
        "url": str(d.get("url") or ""),
        "avisada": str(d.get("avisada") or ""),
    }


def con_impago(actual: Any, factura: str, desde: str, cents: Any = 0, url: str = "") -> str:
    """Apunta la factura sin pagar. Si ya era ESA factura, se conserva el día
    del primer intento y a quién se avisó (un reintento de Stripe no reinicia
    la cuenta de días). Devuelve el texto para guardar."""
    if not factura:
        return json.dumps({})
    antes = leer_impago(actual)
    misma = antes["factura"] == factura
    try:
        cents = int(cents or 0)
    except (TypeError, ValueError):
        cents = 0
    return json.dumps(
        {
            "desde": (antes["desde"] if misma else "") or desde or datetime.now(timezone.utc).isoformat(),
            "factura": factura,
            "cents": cents or (antes["cents"] if misma else 0),
            "url": url or (antes["url"] if misma else ""),
            "avisada": antes["avisada"] if misma else "",
        }
    )


def sin_impago() -> str:
    return json.dumps({})


def _dia_nl(iso: str) -> Optional[date]:
    from src.services.panel.tandas import ZONA, leer_instante

    cuando = leer_instante(iso)
    if cuando is None:
        return None
    return cuando.astimezone(ZONA).date()


def pausa_del_plan(*, regla: dict, estado: str, impago: Any, sin_pausa: bool, hoy: str) -> dict:
    """Cómo queda UN plan con la regla. Función pura.

    - `debe`: tiene una factura sin pagar.
    - `pausa_el`: el día (AAAA-MM-DD, hora NL) en que se cumple el plazo.
    - `cumple`: ya se ha cumplido y no está exento → «a quién afectaría».
    - `en_pausa`: además la regla está encendida. (Que la PERSONA esté en
      pausa depende también de sus otras matrículas: `pausados`.)
    """
    r = limpiar_regla(regla)
    imp = leer_impago(impago)
    dia = _dia_nl(imp["desde"]) if imp["desde"] else None
    debe = bool(dia) and estado in CON_DEUDA
    pausa_el = (dia + timedelta(days=r["dias"])).isoformat() if debe and dia else ""
    cumple = bool(debe and pausa_el and hoy >= pausa_el and not sin_pausa)
    return {
        "debe": debe,
        "sin_pagar_desde": dia.isoformat() if debe and dia else "",
        "pausa_el": pausa_el,
        "cumple": cumple,
        "en_pausa": bool(cumple and r["activa"]),
        "sin_pausa": bool(sin_pausa),
        "debe_cents": imp["cents"] if debe else 0,
        "factura": imp["factura"] if debe else "",
    }


def personas_en_pausa(planes: list[dict], matriculas_buenas: set[str], regla: dict, hoy: str) -> dict[str, dict]:
    """Quién cumple la regla, por correo. Función pura.

    `planes`: [{id, email, estado, impago, sin_pausa, …}] (todos los que tienen
    deuda). `matriculas_buenas`: correos con otra matrícula pagada que no
    cuelga de un plan con deuda. Devuelve {correo: {…el plan más antiguo sin
    pagar…}} de quien CUMPLE (haya regla encendida o no: eso lo mira quien
    llama con `regla["activa"]`)."""
    salida: dict[str, dict] = {}
    for p in planes:
        email = str(p.get("email") or "").strip().lower()
        if not email or email in matriculas_buenas:
            continue
        c = pausa_del_plan(regla=regla, estado=str(p.get("estado") or ""), impago=p.get("impago"), sin_pausa=bool(p.get("sin_pausa")), hoy=hoy)
        if not c["cumple"]:
            continue
        info = {**c, "plan_id": p.get("id"), "email": email, "moneda": p.get("moneda") or "eur",
                "cuotas": int(p.get("cuotas") or 0), "numero": int(p.get("cuotas_pagadas") or 0) + 1}
        if email not in salida or info["pausa_el"] < salida[email]["pausa_el"]:
            salida[email] = info
    return salida


# ── la regla guardada ──────────────────────────────────────────────────────

# Un minuto en memoria (la API es un solo proceso). En los tests no se guarda
# nada: cada test tiene su base de datos.
_TTL = 60.0
_cache: dict[str, Any] = {"hasta": 0.0, "regla": None, "mapa": None}


def olvidar() -> None:
    """Tras cambiar la regla o un plan: que la siguiente petición lo relea."""
    _cache["hasta"] = 0.0
    _cache["regla"] = None
    _cache["mapa"] = None


def _vigente() -> bool:
    return not os.environ.get("PYTEST_CURRENT_TEST") and time.monotonic() < float(_cache["hasta"])


async def _fila_config(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    consulta = select(OrganizationConfig)
    if org_id is not None:
        consulta = consulta.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(consulta.order_by(OrganizationConfig.org_id))).scalars().first()  # type: ignore[arg-type]


async def regla(db_session: AsyncSession) -> dict:
    """La regla de la escuela (una sola escuela: la primera configuración)."""
    if _vigente() and _cache["regla"] is not None:
        return _cache["regla"]
    fila = await _fila_config(db_session)
    config = fila.config if fila is not None and isinstance(fila.config, dict) else {}
    r = limpiar_regla(config.get(CLAVE))
    _cache["regla"] = r
    _cache["mapa"] = None
    _cache["hasta"] = time.monotonic() + _TTL
    return r


async def guardar_regla(org_id: int, datos: dict, db_session: AsyncSession) -> dict:
    """Enciende, apaga o cambia los días. Solo administradores (lo comprueba la
    ruta). Al ENCENDERLA se le pregunta antes a Stripe por los planes con
    deuda, para no pausar a quien ya pagó sin que la escuela se enterara."""
    fila = await _fila_config(db_session, org_id)
    if fila is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="La escuela no tiene configuración.")
    config = json.loads(json.dumps(fila.config or {}))
    antes = limpiar_regla(config.get(CLAVE))
    nueva = limpiar_regla({**antes, **{k: v for k, v in (datos or {}).items() if k in ("activa", "dias") and v is not None}})
    config[CLAVE] = nueva
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    olvidar()
    if nueva["activa"] and not antes["activa"]:
        try:
            await poner_al_dia_los_que_deben(db_session)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo preguntar a Stripe al encender la regla de plazos")
        olvidar()
    return nueva


# ── quién está en pausa ────────────────────────────────────────────────────


async def _planes_con_deuda(db_session: AsyncSession) -> list[PlanPagos]:
    filas = (
        await db_session.execute(select(PlanPagos).where(PlanPagos.estado.in_(CON_DEUDA)))  # type: ignore[attr-defined]
    ).scalars().all()
    return [p for p in filas if leer_impago(p.impago)["desde"]]


def _plan_dict(p: PlanPagos) -> dict:
    return {
        "id": p.id, "email": (p.email or "").strip().lower(), "estado": p.estado, "impago": p.impago,
        "sin_pausa": bool(p.sin_pausa), "moneda": p.currency or "eur", "cuotas": p.cuotas,
        "cuotas_pagadas": p.cuotas_pagadas, "enrollment_id": p.enrollment_id, "product": p.product,
    }


async def _matriculas_buenas(planes: list[PlanPagos], db_session: AsyncSession) -> set[str]:
    """Correos (de esos planes) con OTRA matrícula pagada que no cuelga de un
    plan con deuda: pagó el resto de otra forma, o tiene otro plan al día."""
    from sqlmodel import func

    from src.db.enrollment import Enrollment

    correos = {(p.email or "").strip().lower() for p in planes if p.email}
    if not correos:
        return set()
    de_planes_con_deuda = {p.enrollment_id for p in planes if p.enrollment_id}
    filas = (
        await db_session.execute(
            select(Enrollment.id, Enrollment.email).where(
                Enrollment.status == "paid",
                func.lower(Enrollment.email).in_(correos),  # type: ignore[union-attr]
            )
        )
    ).all()
    return {(email or "").strip().lower() for (mid, email) in filas if mid not in de_planes_con_deuda}


async def quien_cumple(db_session: AsyncSession) -> dict[str, dict]:
    """{correo: info} de quien cumple la regla hoy (esté encendida o no)."""
    from src.services.panel.tandas import hoy_nl

    planes = await _planes_con_deuda(db_session)
    if not planes:
        return {}
    r = await regla(db_session)
    buenas = await _matriculas_buenas(planes, db_session)
    return personas_en_pausa([_plan_dict(p) for p in planes], buenas, r, hoy_nl())


async def pausados(db_session: AsyncSession) -> dict[str, dict]:
    """{correo: info} de quien está EN PAUSA ahora. Vacío con la regla apagada
    (y entonces sin tocar la base de datos más que para leer la regla, una vez
    por minuto)."""
    if _vigente() and _cache["regla"] is not None:
        if not _cache["regla"]["activa"]:
            return {}
        if _cache["mapa"] is not None:
            return _cache["mapa"]
    try:
        # En un SAVEPOINT: si algo falla aquí, la transacción de la petición
        # sigue sana (en Postgres, una consulta rota la dejaría abortada).
        async with db_session.begin_nested():
            r = await regla(db_session)
            mapa = await quien_cumple(db_session) if r["activa"] else {}
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer quién está en pausa: se deja entrar a todos")
        _cache["regla"] = _cache["regla"] or limpiar_regla(None)
        _cache["hasta"] = time.monotonic() + _TTL
        mapa = {}
    _cache["mapa"] = mapa
    return mapa


async def _solo_alumno(user_id: int, db_session: AsyncSession) -> bool:
    """Alumno y nada más: quien tenga cualquier otro papel en la escuela
    (equipo, closer, administrador) no se pausa nunca."""
    from src.db.user_organizations import UserOrganization
    from src.security.rbac.constants import STUDENT_ROLE_ID

    roles = (
        await db_session.execute(select(UserOrganization.role_id).where(UserOrganization.user_id == user_id))
    ).scalars().all()
    return bool(roles) and all(r == STUDENT_ROLE_ID for r in roles)


async def pausa_de(user: Any, db_session: AsyncSession) -> Optional[dict]:
    """La puerta: None si esta persona entra con normalidad; si no, su pausa.
    Nunca lanza: ante cualquier fallo, deja entrar."""
    try:
        if getattr(user, "is_superadmin", False):
            return None
        email = str(getattr(user, "email", "") or "").strip().lower()
        user_id = int(getattr(user, "id", 0) or 0)
        if not email or not user_id:
            return None
        info = (await pausados(db_session)).get(email)
        if not info:
            return None
        if not await _solo_alumno(user_id, db_session):
            return None
        return info
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo comprobar la pausa de plazos")
        return None


# ── lo que ve el alumno ────────────────────────────────────────────────────


async def acceso_de(user: Any, db_session: AsyncSession) -> dict:
    """`GET /student/acceso`: si está en pausa, desde cuándo, cuánto debe y
    dónde se paga."""
    info = await pausa_de(user, db_session)
    if not info:
        return {"pausado": False}
    plan = (await db_session.execute(select(PlanPagos).where(PlanPagos.id == info["plan_id"]))).scalars().first()
    imp = leer_impago(plan.impago) if plan is not None else leer_impago("")
    return {
        "pausado": True,
        "desde": info["pausa_el"],
        "sin_pagar_desde": info["sin_pagar_desde"],
        "debe_cents": info["debe_cents"],
        "moneda": info["moneda"],
        "numero": info["numero"],
        "cuotas": info["cuotas"],
        "pagar_url": imp["url"],
    }


#: «Ya he pagado: comprobar»: como mucho una vez cada 30 s y 12 al día.
ESPERA_COMPROBAR_SEG = 30
TOPE_COMPROBAR_DIA = 12
_comprobaciones: dict[int, list[float]] = {}


def puede_comprobar(user_id: int, ahora: Optional[float] = None) -> tuple[bool, int]:
    """(puede, segundos que le faltan). Apunta el intento si puede."""
    ahora = time.time() if ahora is None else ahora
    veces = [t for t in _comprobaciones.get(user_id, []) if ahora - t < 86400]
    if veces and ahora - veces[-1] < ESPERA_COMPROBAR_SEG:
        _comprobaciones[user_id] = veces
        return False, int(ESPERA_COMPROBAR_SEG - (ahora - veces[-1])) + 1
    if len(veces) >= TOPE_COMPROBAR_DIA:
        _comprobaciones[user_id] = veces
        return False, 3600
    veces.append(ahora)
    _comprobaciones[user_id] = veces
    return True, 0


async def comprobar_mi_pago(user: Any, db_session: AsyncSession) -> dict:
    """El alumno dice que ya ha pagado: se le pregunta a Stripe por SU plan."""
    from fastapi import HTTPException

    info = await pausa_de(user, db_session)
    if not info:
        return {"pausado": False}
    ok, falta = puede_comprobar(int(getattr(user, "id", 0) or 0))
    if not ok:
        raise HTTPException(status_code=429, detail=f"Lo acabamos de comprobar. Vuelve a probar en {'un rato' if falta > 120 else f'{falta} segundos'}.")
    plan = (await db_session.execute(select(PlanPagos).where(PlanPagos.id == info["plan_id"]))).scalars().first()
    if plan is not None:
        try:
            from src.services.payments.payments import _usar_stripe
            from src.services.payments.plazos import sincronizar

            _usar_stripe()
            await sincronizar(plan, db_session, avisar=False)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo comprobar con Stripe el plan %s", info["plan_id"])
            raise HTTPException(status_code=502, detail="No hemos podido comprobarlo ahora mismo. Prueba en unos minutos o escríbenos.")
    olvidar()
    return await acceso_de(user, db_session)


# ── para el panel ──────────────────────────────────────────────────────────


async def para_el_panel(planes: list[PlanPagos], db_session: AsyncSession) -> tuple[dict, dict[int, dict]]:
    """(regla, {plan_id: pausa}) para Pagos a plazos: de cada plan, si debe,
    cuándo se pausa, si ya lo está (o lo estaría con la regla encendida) y por
    qué no, cuando no."""
    from sqlmodel import func

    from src.db.users import User
    from src.services.panel.tandas import hoy_nl

    r = await regla(db_session)
    hoy = hoy_nl()
    con_deuda = [p for p in planes if p.estado in CON_DEUDA and leer_impago(p.impago)["desde"]]
    buenas = await _matriculas_buenas(con_deuda, db_session) if con_deuda else set()
    correos = {(p.email or "").strip().lower() for p in con_deuda if p.email}
    con_cuenta: set[str] = set()
    if correos:
        con_cuenta = {
            (e or "").strip().lower()
            for (e,) in (
                await db_session.execute(select(User.email).where(func.lower(User.email).in_(correos)))  # type: ignore[union-attr]
            ).all()
        }
    salida: dict[int, dict] = {}
    for p in planes:
        c = pausa_del_plan(regla=r, estado=p.estado, impago=p.impago, sin_pausa=bool(p.sin_pausa), hoy=hoy)
        email = (p.email or "").strip().lower()
        nota = ""
        if c["debe"] and email in buenas:
            nota = "Tiene otra matrícula pagada: no se pausa."
            c = {**c, "cumple": False, "en_pausa": False}
        elif c["debe"] and email not in con_cuenta:
            nota = "No hay ninguna cuenta con este correo (¿se le cambió el correo de acceso?): no se pausa sola."
            c = {**c, "cumple": False, "en_pausa": False}
        salida[int(p.id or 0)] = {**c, "nota": nota}
    return r, salida


async def cambiar_exencion(plan_id: int, sin_pausa: bool, db_session: AsyncSession) -> dict:
    from fastapi import HTTPException

    plan = (await db_session.execute(select(PlanPagos).where(PlanPagos.id == plan_id))).scalars().first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado")
    plan.sin_pausa = bool(sin_pausa)
    plan.updated_at = datetime.now(timezone.utc).isoformat()
    db_session.add(plan)
    await db_session.commit()
    olvidar()
    return {"ok": True, "sin_pausa": plan.sin_pausa}


# ── Stripe y los avisos ────────────────────────────────────────────────────


async def poner_al_dia_los_que_deben(db_session: AsyncSession) -> int:
    """Pregunta a Stripe por los planes con una factura sin pagar (también los
    cancelados, que la tarea diaria ya no mira). Solo con la regla encendida:
    con ella apagada no cambia nada de lo que se hacía. Devuelve cuántos."""
    planes = await _planes_con_deuda(db_session)
    if not planes:
        return 0
    from src.services.payments.payments import _usar_stripe
    from src.services.payments.plazos import sincronizar

    _usar_stripe()
    hechos = 0
    for plan in planes:
        try:
            await sincronizar(plan, db_session, avisar=False)
            hechos += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo sincronizar el plan %s", plan.id)
    olvidar()
    return hechos


async def poner_al_dia_cancelados(db_session: AsyncSession) -> int:
    """Los planes CANCELADOS que aún deben una factura: la tarea diaria de
    siempre ya no los mira (solo los vivos), así que sin esto no se sabría que
    alguien pagó esa factura si los avisos de Stripe no están puestos. Solo se
    llama con la regla encendida. Devuelve cuántos fallaron."""
    errores = 0
    try:
        cancelados = [p for p in await _planes_con_deuda(db_session) if p.estado == "cancelado"]
        if cancelados:
            from src.services.payments.payments import _usar_stripe
            from src.services.payments.plazos import sincronizar

            _usar_stripe()
            for plan in cancelados:
                try:
                    await sincronizar(plan, db_session, avisar=False)
                except Exception:  # noqa: BLE001
                    logger.exception("No se pudo sincronizar el plan cancelado %s", plan.id)
                    errores += 1
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron revisar los planes cancelados con deuda")
        errores += 1
    olvidar()
    return errores


async def tarea_diaria(db_session: AsyncSession) -> dict:
    """Desde `drip-diario`, después de `sincronizar_planes`. Con la regla
    APAGADA solo cuenta a cuántos afectaría. Encendida: pone al día los planes
    cancelados que aún deben y avisa, UNA vez por factura, a quien entra en
    pausa (un correo a la persona y otro a cada administrador). Solo números:
    el registro es público."""
    r = await regla(db_session)
    if not r["activa"]:
        return {"activa": False, "afectaria": len(await quien_cumple(db_session))}
    salida = {"activa": True, "dias": r["dias"], "en_pausa": 0, "avisados": 0, "errores": 0}
    salida["errores"] += await poner_al_dia_cancelados(db_session)
    mapa = await quien_cumple(db_session)
    salida["en_pausa"] = len(mapa)
    for info in mapa.values():
        try:
            if await avisar_de_la_pausa(info, r, db_session):
                salida["avisados"] += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar de la pausa del plan %s", info.get("plan_id"))
            salida["errores"] += 1
    olvidar()
    return salida


async def avisar_de_la_pausa(info: dict, r: dict, db_session: AsyncSession) -> bool:
    """Los correos de «tu acceso está en pausa». Una vez por factura: la marca
    (`impago.avisada`) se escribe solo si el correo a la persona salió."""
    from src.services.contactos.llamadas import emails_de_administradores
    from src.services.email.utils import en_hilo
    from src.services.users.emails import send_acceso_en_pausa_alumno_email, send_acceso_en_pausa_email

    plan = (await db_session.execute(select(PlanPagos).where(PlanPagos.id == info["plan_id"]))).scalars().first()
    if plan is None:
        return False
    imp = leer_impago(plan.impago)
    if not imp["factura"] or imp["avisada"] == imp["factura"]:
        return False
    # Solo a quien de verdad se le pausa (alumno con cuenta): si no, no hay
    # nada en pausa de lo que avisar.
    from sqlmodel import func

    from src.db.users import User

    cuenta = (
        await db_session.execute(select(User).where(func.lower(User.email) == info["email"]))  # type: ignore[union-attr]
    ).scalars().first()
    if cuenta is None or not await _solo_alumno(int(cuenta.id or 0), db_session):
        return False
    nombre = f"{plan.first_name} {plan.last_name}".strip()
    datos = {
        "nombre": nombre,
        "email": plan.email,
        "telefono": plan.phone,
        "numero": info["numero"],
        "cuotas": info["cuotas"],
        "importe_cents": imp["cents"] or int(plan.cuota_cents or 0),
        "pagar_url": imp["url"],
        "dias": r["dias"],
        "sin_pagar_desde": info["sin_pagar_desde"],
    }
    await en_hilo(send_acceso_en_pausa_alumno_email, plan.email, datos)
    plan.impago = json.dumps({**imp, "avisada": imp["factura"]})
    db_session.add(plan)
    await db_session.commit()
    for destino in await emails_de_administradores(db_session):
        try:
            await en_hilo(send_acceso_en_pausa_email, destino, datos)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar al equipo de la pausa del plan %s", plan.id)
    return True

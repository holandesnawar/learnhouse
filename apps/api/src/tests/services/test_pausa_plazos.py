"""La regla de los plazos sin pagar (23/11/2026, services/payments/pausa.py).

«A los 7 días de un cobro fallido el acceso queda en pausa y vuelve solo al
pagar. Nace APAGADA.» Se comprueba que:
- apagada no cambia nada (entra igual, lista de cursos igual, correo igual);
- encendida pausa a los N días y no antes; pagar la devuelve sola;
- «No pausar a esta persona», otra matrícula pagada y el equipo: nunca;
- los correos de la pausa salen una vez por factura;
- un fallo al leer deja entrar.
Stripe es de mentira (el de test_plazos.py).
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlmodel import select
from starlette.requests import Request

from src.db.enrollment import Enrollment
from src.db.organization_config import OrganizationConfig
from src.db.plan_pagos import PlanPagos
from src.security.rbac.resource_access import check_resource_access
from src.security.rbac.types import AccessAction
from src.services.courses.courses import get_courses_orgslug
from src.services.payments import pausa as PA
from src.services.payments import plazos as Z
from src.services.panel.tandas import hoy_nl
from src.tests.services.test_plazos import StripeFalso, _con_stripe, _Varios

AHORA = str(datetime.now())


def _req() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})


def _hace(dias: int) -> int:
    return int((datetime.now(timezone.utc) - timedelta(days=dias)).timestamp())


async def _regla(db, org, activa: bool, dias: int = 7):
    fila = (await db.execute(select(OrganizationConfig))).scalars().first()
    if fila is None:
        fila = OrganizationConfig(org_id=org.id, config={}, creation_date=AHORA, update_date=AHORA)
    fila.config = {**(fila.config or {}), PA.CLAVE: {"activa": activa, "dias": dias}}
    db.add(fila)
    await db.commit()
    PA.olvidar()


async def _plan(db, email: str, sub: str = "sub_1") -> PlanPagos:
    """Un plan de 3 pagos con el primero cobrado, y su matrícula pagada."""
    mat = Enrollment(email=email, first_name="Ana", last_name="Gil", status="paid", amount_cents=14500, paid_at="2026-10-14")
    db.add(mat)
    await db.commit()
    await db.refresh(mat)
    plan = PlanPagos(
        email=email, first_name="Ana", last_name="Gil", phone="+31 6 1", enrollment_id=mat.id,
        stripe_customer_id="cus_1", stripe_subscription_id=sub, stripe_schedule_id="sub_sched_1",
        cuotas=3, cuota_cents=14500, total_cents=43500, cuotas_pagadas=1, pagado_cents=14500,
        facturas=json.dumps({"in_1": {"c": 14500, "f": "2026-10-14"}}), estado="activo",
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


def _fallo(dias: int, factura: str = "in_2", sub: str = "sub_1") -> dict:
    """El aviso de Stripe de un cobro que no entró, de una factura de hace N días."""
    return {
        "id": factura, "amount_due": 14500, "next_payment_attempt": None, "subscription": sub,
        "hosted_invoice_url": f"https://invoice.stripe.com/i/{factura}", "created": _hace(dias),
        "status_transitions": {"finalized_at": _hace(dias)},
    }


class _Correos:
    """Los correos que saldrían, sin mandar ninguno."""

    def __init__(self):
        self.fallo_alumno, self.fallo_equipo, self.pausa_alumno, self.pausa_equipo = [], [], [], []

    def parches(self):
        async def admins(_db):
            return ["jefa@x.com"]

        return [
            patch("src.services.users.emails.send_plazo_fallido_alumno_email", lambda d, x: self.fallo_alumno.append((d, x))),
            patch("src.services.users.emails.send_plazo_fallido_email", lambda d, x: self.fallo_equipo.append((d, x))),
            patch("src.services.users.emails.send_acceso_en_pausa_alumno_email", lambda d, x: self.pausa_alumno.append((d, x))),
            patch("src.services.users.emails.send_acceso_en_pausa_email", lambda d, x: self.pausa_equipo.append((d, x))),
            patch("src.services.contactos.llamadas.emails_de_administradores", admins),
        ]


async def _entra(db, user, course) -> bool:
    d = await check_resource_access(_req(), db, user, course.course_uuid, AccessAction.READ, raise_on_deny=False)
    return d.allowed


# ── lógica pura ────────────────────────────────────────────────────────────


def test_la_regla_nace_apagada_y_con_7_dias():
    assert PA.limpiar_regla(None) == {"activa": False, "dias": 7}
    assert PA.limpiar_regla({"activa": "si"}) == {"activa": False, "dias": 7}  # solo True la enciende
    assert PA.limpiar_regla({"activa": True, "dias": 1})["dias"] == 3
    assert PA.limpiar_regla({"activa": True, "dias": 99})["dias"] == 30


def test_un_reintento_no_reinicia_la_cuenta_de_dias():
    a = PA.con_impago("{}", "in_2", "2026-11-01T08:00:00+00:00", 14500, "https://pagar")
    b = PA.con_impago(a, "in_2", "2026-11-05T08:00:00+00:00", 14500, "")  # Stripe reintenta
    assert PA.leer_impago(b)["desde"] == "2026-11-01T08:00:00+00:00" and PA.leer_impago(b)["url"] == "https://pagar"
    c = PA.con_impago(b, "in_3", "2026-12-01T08:00:00+00:00", 14500, "")  # otra factura: otra cuenta
    assert PA.leer_impago(c)["desde"].startswith("2026-12-01")
    assert PA.leer_impago(PA.sin_impago())["desde"] == ""


def test_se_pausa_a_los_n_dias_y_no_antes():
    imp = PA.con_impago("{}", "in_2", "2026-11-01T08:00:00+00:00", 14500, "u")
    on = {"activa": True, "dias": 7}
    antes = PA.pausa_del_plan(regla=on, estado="fallido", impago=imp, sin_pausa=False, hoy="2026-11-07")
    assert antes["debe"] and antes["pausa_el"] == "2026-11-08" and not antes["en_pausa"]
    assert PA.pausa_del_plan(regla=on, estado="fallido", impago=imp, sin_pausa=False, hoy="2026-11-08")["en_pausa"]
    # Stripe canceló con la factura sin pagar: sigue debiendo.
    assert PA.pausa_del_plan(regla=on, estado="cancelado", impago=imp, sin_pausa=False, hoy="2026-12-01")["en_pausa"]
    # Apagada: «afectaría», pero no está en pausa.
    off = PA.pausa_del_plan(regla={"activa": False}, estado="fallido", impago=imp, sin_pausa=False, hoy="2026-11-20")
    assert off["cumple"] and not off["en_pausa"]
    # Exento, al día o terminado: nunca.
    assert not PA.pausa_del_plan(regla=on, estado="fallido", impago=imp, sin_pausa=True, hoy="2026-11-20")["cumple"]
    assert not PA.pausa_del_plan(regla=on, estado="activo", impago=imp, sin_pausa=False, hoy="2026-11-20")["debe"]
    assert not PA.pausa_del_plan(regla=on, estado="completado", impago=imp, sin_pausa=False, hoy="2026-11-20")["debe"]


# ── apagada: todo igual que antes ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_apagada_no_cambia_nada(db, org, regular_user, course):
    await _plan(db, regular_user.email)
    correos = _Correos()
    with _Varios(correos.parches()):
        await Z.atender_factura(_fallo(30), False, db)
        r = await PA.tarea_diaria(db)
    plan = (await db.execute(select(PlanPagos))).scalars().one()
    # Se apunta qué factura se debe (para poder enseñar «a quién afectaría»)…
    assert plan.estado == "fallido" and PA.leer_impago(plan.impago)["factura"] == "in_2"
    # …pero entra igual, ve sus cursos, y los correos son los de siempre.
    assert await _entra(db, regular_user, course)
    assert len(await get_courses_orgslug(_req(), regular_user, org.slug, db)) == 1
    assert await PA.acceso_de(regular_user, db) == {"pausado": False}
    assert len(correos.fallo_alumno) == 1 and correos.fallo_alumno[0][1]["dias_pausa"] == 0
    assert correos.pausa_alumno == [] and correos.pausa_equipo == []
    assert r == {"activa": False, "afectaria": 1}
    panel = await Z.listar_planes(db)
    assert panel["regla"]["activa"] is False and panel["regla"]["afectaria"] == 1 and panel["regla"]["en_pausa"] == 0
    assert panel["planes"][0]["pausa"]["cumple"] and not panel["planes"][0]["pausa"]["en_pausa"]


def test_el_correo_de_cobro_fallido_solo_habla_de_dias_con_la_regla_encendida():
    from src.services.users import emails as E

    datos = {"nombre": "Ana", "numero": 2, "cuotas": 3, "importe_cents": 14500, "pagar_url": "https://p"}
    sin = E.send_plazo_fallido_alumno_email("a@x.com", datos, preview=True)["html"]
    con = E.send_plazo_fallido_alumno_email("a@x.com", {**datos, "dias_pausa": 7}, preview=True)["html"]
    assert "quedará en pausa" not in sin and "De momento sigues teniendo acceso a la escuela." in sin
    assert "dentro de 7 días" in con and "quedará en pausa" in con
    pausa = E.send_acceso_en_pausa_alumno_email("a@x.com", datos, preview=True)
    assert "en pausa" in pausa["subject"] and "https://p" in pausa["html"] and "vuelve solo" in pausa["html"]
    assert "Acceso en pausa" in E.send_acceso_en_pausa_email("j@x.com", {**datos, "dias": 7}, preview=True)["subject"]


# ── encendida ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_encendida_pausa_a_los_n_dias_y_pagar_la_devuelve(db, org, regular_user, course):
    await _plan(db, regular_user.email)
    await _regla(db, org, True, 7)
    correos = _Correos()
    with _Varios(correos.parches()):
        await Z.atender_factura(_fallo(3), False, db)  # hace 3 días: aún no
        assert correos.fallo_alumno[0][1]["dias_pausa"] == 7  # el correo avisa de los días
        assert await _entra(db, regular_user, course)
        assert (await Z.listar_planes(db))["planes"][0]["pausa"]["pausa_el"] > hoy_nl()

        # La misma factura, pero emitida hace 9 días.
        plan = (await db.execute(select(PlanPagos))).scalars().one()
        plan.impago = PA.con_impago("{}", "in_2", datetime.fromtimestamp(_hace(9), tz=timezone.utc).isoformat(), 14500,
                                    "https://invoice.stripe.com/i/in_2")
        db.add(plan)
        await db.commit()
        PA.olvidar()

        assert not await _entra(db, regular_user, course)
        with pytest.raises(HTTPException) as e:
            await check_resource_access(_req(), db, regular_user, course.course_uuid, AccessAction.READ)
        assert e.value.status_code == 403 and e.value.detail == PA.MOTIVO
        assert await get_courses_orgslug(_req(), regular_user, org.slug, db) == []
        acceso = await PA.acceso_de(regular_user, db)
        assert acceso["pausado"] and acceso["debe_cents"] == 14500 and acceso["numero"] == 2 and acceso["cuotas"] == 3
        assert acceso["pagar_url"] == "https://invoice.stripe.com/i/in_2"
        panel = await Z.listar_planes(db)
        assert panel["regla"]["en_pausa"] == 1 and panel["planes"][0]["pausa"]["en_pausa"]

        # Paga: vuelve solo, sin que nadie toque nada.
        await Z.atender_factura({**_fallo(9), "amount_paid": 14500}, True, db)
    assert await _entra(db, regular_user, course)
    assert await PA.acceso_de(regular_user, db) == {"pausado": False}
    assert len(await get_courses_orgslug(_req(), regular_user, org.slug, db)) == 1


@pytest.mark.asyncio
async def test_ya_he_pagado_pregunta_a_stripe_y_no_manda_correos(db, org, regular_user, course):
    await _plan(db, regular_user.email)
    await _regla(db, org, True, 7)
    falso = StripeFalso()
    falso.suscripcion["status"] = "canceled"  # Stripe dejó de reintentar y canceló
    falso.facturas = [
        {"id": "in_1", "status": "paid", "amount_paid": 14500, "status_transitions": {"paid_at": _hace(40)}},
        {"id": "in_2", "status": "uncollectible", "attempt_count": 4, "amount_due": 14500, "created": _hace(10),
         "status_transitions": {"finalized_at": _hace(10)}, "hosted_invoice_url": "https://invoice.stripe.com/i/in_2"},
    ]
    correos = _Correos()
    PA._comprobaciones.clear()
    with _Varios(_con_stripe(falso) + correos.parches()):
        plan = (await db.execute(select(PlanPagos))).scalars().one()
        await Z.sincronizar(plan, db, avisar=False)
        # Cancelado por Stripe con la factura sin pagar: sigue en pausa.
        assert plan.estado == "cancelado" and not await _entra(db, regular_user, course)

        # Aún no ha pagado: sigue igual. Y no puede machacar el botón.
        assert (await PA.comprobar_mi_pago(regular_user, db))["pausado"]
        with pytest.raises(HTTPException) as e:
            await PA.comprobar_mi_pago(regular_user, db)
        assert e.value.status_code == 429

        # Paga esa factura en la página de Stripe y vuelve a comprobar.
        falso.facturas[1] = {**falso.facturas[1], "status": "paid", "amount_paid": 14500, "status_transitions": {"paid_at": _hace(0)}}
        PA._comprobaciones.clear()
        assert await PA.comprobar_mi_pago(regular_user, db) == {"pausado": False}
    assert await _entra(db, regular_user, course)
    assert correos.fallo_alumno == [] and correos.fallo_equipo == []  # comprobar no manda «cobro fallido»


@pytest.mark.asyncio
async def test_exento_con_otra_matricula_o_del_equipo_nunca(db, org, regular_user, admin_user, course):
    plan = await _plan(db, regular_user.email)
    await _plan(db, admin_user.email, sub="sub_admin")
    await _regla(db, org, True, 7)
    correos = _Correos()
    with _Varios(correos.parches()):
        await Z.atender_factura(_fallo(20), False, db)
        await Z.atender_factura(_fallo(20, factura="in_9", sub="sub_admin"), False, db)
    assert not await _entra(db, regular_user, course)
    # El equipo y los administradores, nunca (aunque tengan un plan sin pagar).
    assert await _entra(db, admin_user, course)
    assert await PA.acceso_de(admin_user, db) == {"pausado": False}

    # «No pausar a esta persona».
    await PA.cambiar_exencion(plan.id, True, db)
    assert await _entra(db, regular_user, course)
    panel = await Z.listar_planes(db)
    assert next(p for p in panel["planes"] if p["email"] == regular_user.email)["sin_pausa"] is True
    await PA.cambiar_exencion(plan.id, False, db)
    assert not await _entra(db, regular_user, course)

    # Otra matrícula pagada que no cuelga del plan (pagó el resto de otra forma).
    db.add(Enrollment(email=regular_user.email, status="paid", amount_cents=29000, paid_at="2026-11-20"))
    await db.commit()
    PA.olvidar()
    assert await _entra(db, regular_user, course)
    nota = next(p for p in (await Z.listar_planes(db))["planes"] if p["email"] == regular_user.email)["pausa"]["nota"]
    assert "otra matrícula" in nota


@pytest.mark.asyncio
async def test_los_correos_de_la_pausa_salen_una_vez_por_factura(db, org, regular_user, course):
    await _plan(db, regular_user.email)
    await _regla(db, org, True, 7)
    correos = _Correos()
    with _Varios(correos.parches()):
        await Z.atender_factura(_fallo(20), False, db)
        r1 = await PA.tarea_diaria(db)
        r2 = await PA.tarea_diaria(db)
    assert r1 == {"activa": True, "dias": 7, "en_pausa": 1, "avisados": 1, "errores": 0}
    assert r2["avisados"] == 0 and r2["en_pausa"] == 1
    assert [d for d, _ in correos.pausa_alumno] == [regular_user.email]
    assert [d for d, _ in correos.pausa_equipo] == ["jefa@x.com"]
    datos = correos.pausa_alumno[0][1]
    assert datos["pagar_url"].endswith("in_2") and datos["importe_cents"] == 14500 and datos["numero"] == 2
    # En el registro público, solo números.
    assert all(isinstance(v, (int, bool)) for v in r1.values())


@pytest.mark.asyncio
async def test_encenderla_y_los_dias_solo_entre_3_y_30(db, org, regular_user, course):
    db.add(OrganizationConfig(org_id=org.id, config={"otra_cosa": 1}, creation_date=AHORA, update_date=AHORA))
    await db.commit()
    await _plan(db, regular_user.email)
    with _Varios(_Correos().parches()):
        await Z.atender_factura(_fallo(20), False, db)
    assert await _entra(db, regular_user, course)  # nace apagada

    falso = StripeFalso()
    falso.suscripcion["status"] = "past_due"
    falso.facturas = [{"id": "in_2", "status": "open", "attempt_count": 3, "amount_due": 14500, "created": _hace(20),
                       "status_transitions": {"finalized_at": _hace(20)}, "hosted_invoice_url": "https://p"}]
    with _Varios(_con_stripe(falso)):
        assert await PA.guardar_regla(org.id, {"activa": True, "dias": 99}, db) == {"activa": True, "dias": 30}
        assert await _entra(db, regular_user, course)  # 20 días < 30
        assert await PA.guardar_regla(org.id, {"dias": 7}, db) == {"activa": True, "dias": 7}
        assert not await _entra(db, regular_user, course)
        assert await PA.guardar_regla(org.id, {"activa": False}, db) == {"activa": False, "dias": 7}
    assert await _entra(db, regular_user, course)
    fila = (await db.execute(select(OrganizationConfig))).scalars().one()
    assert fila.config["otra_cosa"] == 1  # no pisa el resto de la configuración


@pytest.mark.asyncio
async def test_si_falla_la_lectura_se_deja_entrar(db, org, regular_user, course):
    await _plan(db, regular_user.email)
    await _regla(db, org, True, 7)
    with _Varios(_Correos().parches()):
        await Z.atender_factura(_fallo(20), False, db)
    assert not await _entra(db, regular_user, course)

    async def rota(_db):
        raise RuntimeError("base de datos caída")

    with patch.object(PA, "quien_cumple", rota):
        PA.olvidar()
        assert await _entra(db, regular_user, course)
        # Y la petición sigue pudiendo usar la base de datos.
        assert (await db.execute(select(PlanPagos))).scalars().one().estado == "fallido"

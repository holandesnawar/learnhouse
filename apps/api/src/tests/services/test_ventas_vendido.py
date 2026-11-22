"""Vendido ≠ cobrado (22/11/2026). `services/stats/ventas.py`.

El caso del usuario: una venta de 597 € en 3 plazos salía en las estadísticas
como 199 € (lo cobrado). «Que no esté cobrado no es que no esté vendido.»
"""

from src.services.stats.gastos import resumen_gastos
from src.services.stats.periods import group_sales
from src.services.stats.ventas import emparejar, por_email, totales, venta_de


def matricula(**k) -> dict:
    base = {"id": 1, "email": "ana@ejemplo.com", "amount_cents": 19900, "fecha": "2026-11-10T10:00:00+00:00"}
    return {**base, **k}


def plan(**k) -> dict:
    base = {
        "estado": "activo",
        "cuotas": 3,
        "cuotas_pagadas": 1,
        "total_cents": 59700,
        "pagado_cents": 19900,
        "enrollment_id": 1,
        "email": "ana@ejemplo.com",
    }
    return {**base, **k}


def test_una_venta_a_plazos_vale_el_total_del_plan():
    v = venta_de(matricula(), plan())
    assert v["vendido_cents"] == 59700
    assert v["cobrado_cents"] == 19900
    assert v["por_cobrar_cents"] == 39800
    assert v["plazos"]["pagadas"] == 1 and v["plazos"]["cuotas"] == 3
    assert v["plazos"]["fallido"] is False


def test_sin_plan_lo_vendido_es_lo_cobrado():
    v = venta_de(matricula(amount_cents=59700))
    assert (v["vendido_cents"], v["cobrado_cents"], v["por_cobrar_cents"]) == (59700, 59700, 0)
    assert v["plazos"] is None


def test_un_plan_completado_no_deja_nada_por_cobrar():
    v = venta_de(matricula(amount_cents=59700), plan(estado="completado", cuotas_pagadas=3, pagado_cents=59700))
    assert v["vendido_cents"] == 59700 and v["por_cobrar_cents"] == 0


def test_un_cobro_fallido_sigue_vendido_y_se_avisa():
    v = venta_de(matricula(), plan(estado="fallido"))
    assert v["vendido_cents"] == 59700 and v["por_cobrar_cents"] == 39800
    assert v["plazos"]["fallido"] is True


def test_un_plan_cancelado_no_promete_dinero_que_no_va_a_llegar():
    v = venta_de(matricula(), plan(estado="cancelado"))
    assert v["vendido_cents"] == 19900
    assert v["por_cobrar_cents"] == 0
    assert v["perdido_cents"] == 39800


def test_por_cobrar_nunca_es_negativo():
    # Se cobró más de lo que decía el plan (un total cambiado a mano).
    v = venta_de(matricula(amount_cents=70000), plan(pagado_cents=70000))
    assert v["vendido_cents"] == 70000 and v["por_cobrar_cents"] == 0


def test_si_la_matricula_aun_no_lleva_el_primer_cobro_vale_el_del_plan():
    v = venta_de(matricula(amount_cents=0), plan())
    assert v["cobrado_cents"] == 19900 and v["vendido_cents"] == 59700


def test_totales_y_ticket_medio_sobre_lo_vendido():
    ventas = [venta_de(matricula(), plan()), venta_de(matricula(id=2, email="b@ejemplo.com", amount_cents=43500))]
    t = totales(ventas)
    assert t["ventas"] == 2
    assert t["vendido_cents"] == 59700 + 43500
    assert t["cobrado_cents"] == 19900 + 43500
    assert t["por_cobrar_cents"] == 39800
    assert t["ticket_medio_cents"] == round((59700 + 43500) / 2)
    assert t["a_plazos"] == 1 and t["con_fallo"] == 0
    assert totales([])["ticket_medio_cents"] == 0


def test_por_email_suma_las_ventas_de_la_misma_persona():
    ventas = [venta_de(matricula(), plan()), venta_de(matricula(id=2, amount_cents=100))]
    assert por_email(ventas)["ana@ejemplo.com"] == {
        "vendido_cents": 59800,
        "cobrado_cents": 20000,
        "por_cobrar_cents": 39800,
    }


def test_un_plan_no_cuenta_dos_veces():
    # Dos matrículas pagadas de la misma persona y un solo plan: el plan es de
    # la matrícula a la que apunta.
    ventas = emparejar(
        [matricula(id=1, amount_cents=100, fecha="2026-10-01"), matricula(id=2, fecha="2026-11-10")],
        [plan(enrollment_id=2)],
    )
    assert [v["vendido_cents"] for v in ventas] == [100, 59700]


def test_un_plan_sin_matricula_apuntada_va_por_el_correo():
    ventas = emparejar([matricula(id=7)], [plan(enrollment_id=None)])
    assert ventas[0]["vendido_cents"] == 59700
    # Y el de otra persona no se le pega a nadie.
    ventas = emparejar([matricula(id=7)], [plan(enrollment_id=None, email="otra@ejemplo.com")])
    assert ventas[0]["vendido_cents"] == 19900


def test_la_tabla_por_meses_cuenta_la_venta_entera_en_el_mes_del_primer_pago():
    filas = group_sales(
        [
            {"date": "2026-11-10", "amount_cents": 19900, "vendido_cents": 59700, "product": "f"},
            {"date": "2026-11-12", "amount_cents": 43500, "vendido_cents": 43500, "product": "f"},
        ]
    )
    assert len(filas) == 1
    f = filas[0]
    assert f["sales"] == 2
    assert f["vendido_cents"] == 103200
    assert f["cobrado_cents"] == 63400 and f["revenue_cents"] == 63400
    assert f["por_cobrar_cents"] == 39800
    assert f["avg_ticket_cents"] == 51600


def test_la_tabla_por_meses_sin_vendido_sale_como_antes():
    f = group_sales([{"date": "2026-11-10", "amount_cents": 43500, "product": "f"}])[0]
    assert f["vendido_cents"] == 43500 and f["por_cobrar_cents"] == 0 and f["avg_ticket_cents"] == 43500


def test_gastos_el_margen_va_sobre_lo_cobrado_y_lo_vendido_sale_al_lado():
    datos = resumen_gastos([("2026-11-10", 19900, 59700)], [("2026-11-05", "publicidad", 10000)], 1)
    assert datos["total"]["ingresos_cents"] == 19900
    assert datos["total"]["vendido_cents"] == 59700
    assert datos["total"]["por_cobrar_cents"] == 39800
    assert datos["total"]["margen_cents"] == 9900
    assert datos["meses"][0]["vendido_cents"] == 59700
    # Como antes, con solo (fecha, céntimos).
    viejo = resumen_gastos([("2026-11-10", 19900)], [], 0)
    assert viejo["total"]["vendido_cents"] == 19900 and viejo["total"]["por_cobrar_cents"] == 0


def test_kpis_la_venta_a_plazos_cuenta_entera_y_el_closer_no_ve_dinero():
    from datetime import datetime, timezone

    from src.services.stats.kpis import calcular, para_el_closer

    k = calcular(
        fichas=[], citas=[], resultados=[], pagaron={"ana@x.com"}, fuera=set(), visitas=[],
        ventas=[
            {"email": "ana@x.com", "paid_at": "2026-11-10T09:00:00", "amount_cents": 19900,
             "vendido_cents": 59700, "recorrido": ""},
            {"email": "ben@x.com", "paid_at": "2026-11-11T09:00:00", "amount_cents": 43500, "recorrido": ""},
        ],
        plazos_emails={"ana@x.com"}, desde="2026-11-09", hasta="2026-11-15",
        ahora=datetime(2026, 11, 16, tzinfo=timezone.utc),
    )
    v = k["ventas"]
    assert v["n"] == 2
    assert v["vendido_cents"] == 59700 + 43500
    assert v["cobrado_cents"] == 19900 + 43500
    assert v["por_cobrar_cents"] == 39800
    assert v["ticket_medio_cents"] == 51600
    assert para_el_closer(k)["ventas"] == {"n": 2}


def test_anuncios_ingresos_y_retorno_sobre_lo_vendido():
    from src.services.panel.ads import metricas

    fichas = [{"email": "c@x.com", "etapa": "alumno", "utm_campaign": "bf", "eventos": [], "primer_contacto": {"when": "2026-11-03"}}]
    r = metricas(
        [{"id": 1, "nombre": "BF", "utm_campaign": "bf", "gasto_cents": 19900}],
        fichas,
        {"c@x.com": 59700},
        {"c@x.com": 19900},
    )
    c = r["campanas"][0]
    assert c["ingresos_cents"] == 59700 and c["vendido_cents"] == 59700
    assert c["cobrado_cents"] == 19900 and c["por_cobrar_cents"] == 39800
    assert c["retorno"] == 3.0
    assert r["total"]["cobrado_cents"] == 19900 and r["total"]["por_cobrar_cents"] == 39800


def test_analitica_ingresos_es_lo_vendido_y_lo_cobrado_va_al_lado():
    from datetime import datetime, timezone

    from src.services.stats import analitica as A

    ficha = {
        "email": "ana@x.com", "nombre": "Ana", "etapa": "alumno", "pasos": [],
        "eventos": [{"kind": "solicitud", "when": "2026-11-02T10:00:00+00:00", "utm_source": "", "utm_medium": "",
                     "utm_campaign": "", "utm_content": "", "referrer": "", "recorrido": "", "extra": {}}],
    }
    personas = A.personas_de(
        [ficha], [], [], {"ana@x.com"}, {"ana@x.com": 59700}, set(), "ficha",
        datetime(2026, 11, 20, tzinfo=timezone.utc), {"ana@x.com": 19900},
    )
    assert personas and personas[0]["pago"]
    assert personas[0]["cents"] == 59700 and personas[0]["cobrado_cents"] == 19900
    c = A._cifras(personas, None)
    assert c["cents"] == 59700 and c["cobrado_cents"] == 19900 and c["por_cobrar_cents"] == 39800

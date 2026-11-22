"""El inicio del panel del administrador (22/11/2026): lo puro de
`services/panel/inicio.py`."""

from datetime import date

from src.services.panel.inicio import (
    cifras_alumnos,
    comparar,
    filas_de_hoy,
    forma_de_pago,
    pasos_embudo,
    rango,
    ultimas_ventas,
    ventas_entre,
)


def test_la_semana_se_compara_con_los_mismos_dias_de_la_pasada():
    # Miércoles 18 nov 2026: lunes a miércoles contra lunes a miércoles.
    r = rango("semana", date(2026, 11, 18))
    assert (r["desde"], r["hasta"]) == ("2026-11-16", "2026-11-18")
    assert (r["antes_desde"], r["antes_hasta"]) == ("2026-11-09", "2026-11-11")


def test_los_30_dias_contra_los_30_de_antes():
    r = rango("30", date(2026, 11, 22))
    assert (r["desde"], r["hasta"]) == ("2026-10-24", "2026-11-22")
    assert (r["antes_desde"], r["antes_hasta"]) == ("2026-09-24", "2026-10-23")


def test_el_mes_contra_los_mismos_dias_del_mes_pasado():
    r = rango("mes", date(2026, 11, 22))
    assert (r["desde"], r["hasta"]) == ("2026-11-01", "2026-11-22")
    assert (r["antes_desde"], r["antes_hasta"]) == ("2026-10-01", "2026-10-22")
    # El 31 de marzo se compara con febrero entero (no existe el 31 de febrero).
    r = rango("mes", date(2026, 3, 31))
    assert (r["antes_desde"], r["antes_hasta"]) == ("2026-02-01", "2026-02-28")


def test_un_periodo_que_no_existe_es_la_semana():
    assert rango("lo-que-sea", date(2026, 11, 22))["periodo"] == "semana"


def test_comparar():
    assert comparar(118, 100) == {"valor": 118, "antes": 100, "dif": 18, "pct": 18, "sentido": 1}
    assert comparar(94, 100)["pct"] == -6 and comparar(94, 100)["sentido"] == -1
    # Sin nada antes no hay tanto por ciento, pero sí diferencia.
    assert comparar(3, 0) == {"valor": 3, "antes": 0, "dif": 3, "pct": None, "sentido": 1}
    assert comparar(0, 0)["sentido"] == 0
    assert comparar(5, None)["dif"] is None


def test_la_venta_cuenta_el_dia_de_su_primer_pago_en_hora_de_paises_bajos():
    ventas = [
        {"email": "a", "fecha": "2026-11-15T23:30:00+00:00"},  # ya es lunes 16 en Países Bajos
        {"email": "b", "fecha": "2026-11-14T10:00:00"},
    ]
    assert [v["email"] for v in ventas_entre(ventas, "2026-11-16", "2026-11-22")] == ["a"]


def test_forma_de_pago():
    assert forma_de_pago({}) == {"texto": "Un pago", "detalle": "", "aviso": False}
    assert forma_de_pago({"recorrido": "reserva"})["texto"] == "Otro importe"
    plazos = {"estado": "activo", "cuotas": 3, "pagadas": 1, "proximo_cobro": "2026-12-20T09:00:00+00:00"}
    assert forma_de_pago({"plazos": plazos}) == {"texto": "3 plazos", "detalle": "pago 1 de 3 · próximo 20 dic", "aviso": False}
    fallo = forma_de_pago({"plazos": {**plazos, "estado": "fallido", "fallido": True}})
    assert fallo["aviso"] and fallo["detalle"] == "cobro fallido · pago 2 de 3"
    assert forma_de_pago({"plazos": {"estado": "completado", "cuotas": 3, "pagadas": 3}})["detalle"] == "pagado entero"
    assert forma_de_pago({"plazos": {"estado": "cancelado", "cancelado": True, "cuotas": 3, "pagadas": 1}})["aviso"]


def test_ultimas_ventas_la_mas_nueva_arriba_con_su_origen_y_su_closer():
    ventas = [
        {"email": "a@x", "nombre": "Ana", "fecha": "2026-11-10", "vendido_cents": 59700, "cobrado_cents": 59700},
        {"email": "b@x", "nombre": "Bea", "fecha": "2026-11-20", "vendido_cents": 59700, "cobrado_cents": 19900,
         "plazos": {"estado": "activo", "cuotas": 3, "pagadas": 1}},
    ]
    filas = ultimas_ventas(ventas, {"b@x": "Instagram · DM"}, {"b@x": {"id": 7, "nombre": "Diego"}})
    assert [f["nombre"] for f in filas] == ["Bea", "Ana"]
    assert filas[0]["origen"] == "Instagram · DM" and filas[0]["closer"] == "Diego" and filas[0]["closer_id"] == 7
    assert filas[0]["vendido_cents"] == 59700 and filas[0]["cobrado_cents"] == 19900
    assert filas[1]["closer"] == "" and filas[1]["pago"]["texto"] == "Un pago"


def test_el_embudo_va_con_el_tanto_por_ciento_del_paso_anterior():
    pasos = pasos_embudo({"visitas": 800, "leads": 64, "reservaron": 32, "vinieron": 24, "pagaron": 12})
    assert [p["clave"] for p in pasos] == ["visitas", "leads", "reservaron", "vinieron", "pagaron"]
    assert pasos[0]["pct"] is None and pasos[1]["pct"] == 8.0 and pasos[2]["pct"] == 50.0 and pasos[4]["pct"] == 50.0
    # Sin visitas contadas, empieza en los datos.
    sin = pasos_embudo({"visitas": None, "leads": 10, "reservaron": 5, "vinieron": 0, "pagaron": 0})
    assert sin[0]["clave"] == "leads" and sin[0]["pct"] is None and sin[3]["pct"] is None


def test_cifras_de_alumnos():
    alumnos = [
        {"entradas_7d": 3, "sin_avanzar": {"atascado": False}},
        {"entradas_7d": 0, "sin_avanzar": {"atascado": True}},
        {"entradas_7d": 1, "sin_avanzar": {"atascado": True}},
    ]
    assert cifras_alumnos(alumnos) == {"total": 3, "activos": 2, "sin_avanzar": 2}


def _hoy(**cambios):
    base = dict(llamar_hoy=[], nuevas=0, por_llamar=0, citas_hoy=[], por_pagar=[], cobros_fallidos=[], por_corregir=0,
                sin_grupo=[], sin_avanzar=0, sin_apuntar=0)
    return filas_de_hoy(**{**base, **cambios})


def test_hoy_solo_salen_las_filas_con_algo():
    assert _hoy() == []
    filas = _hoy(nuevas=5, por_corregir=4, sin_grupo=["Ana"])
    assert [f["clave"] for f in filas] == ["nuevas", "corregir", "grupo"]
    assert filas[0]["tono"] == "rojo" and filas[0]["n"] == 5
    assert filas[2]["detalle"] == "Ana" and filas[2]["href"].endswith("tab=tandas")


def test_hoy_las_llamadas_van_con_su_hora_y_lo_urgente_primero():
    filas = _hoy(
        citas_hoy=[{"hora": "12:00", "nombre": "Ana"}, {"hora": "16:30", "nombre": "Luis"}],
        cobros_fallidos=["Fran"],
        llamar_hoy=["a", "b", "c", "d", "e"],
        por_llamar=41,
    )
    assert [f["clave"] for f in filas] == ["cobros", "llamar", "citas", "porllamar"]
    assert filas[2]["detalle"] == "12:00 Ana · 16:30 Luis"
    assert filas[1]["detalle"] == "a · b · c y 2 más"

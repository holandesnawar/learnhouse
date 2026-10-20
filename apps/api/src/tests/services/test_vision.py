"""Visión: las cuentas de las campañas y del negocio (funciones puras)."""

from src.services.vision import calculo as C


AJ = C.normalizar_ajustes({"klarna_pct": 5, "klarna_fijo_cents": 0})


def _venta(importe=39700, metodo="unico", fecha="2026-10-20", con_llamada=True):
    return {"importe_cents": importe, "metodo": metodo, "fecha": fecha, "con_llamada": con_llamada}


def test_ajustes_de_fabrica_y_lo_que_no_vale():
    a = C.normalizar_ajustes(None)
    assert a["precio_cents"] == 43500 and a["profe_semanal_cents"] == 7500
    assert a["closer"] == [{"desde": "", "pct": 10.0}, {"desde": "2026-10-16", "pct": 15.0}]
    # Un tramo con un % imposible o una fecha rota no rompe nada.
    b = C.normalizar_ajustes({"closer": [{"desde": "mañana", "pct": 12}, {"desde": "2026-11-01", "pct": 140}], "precio_cents": "abc"})
    assert b["closer"] == [{"desde": "", "pct": 12.0}]
    assert b["precio_cents"] == 43500
    assert b["umbrales"]["cac"] == {"verde": 100, "rojo": 150}


def test_el_closer_cobra_el_tramo_del_dia_de_la_venta():
    tramos = AJ["closer"]
    assert C.pct_closer("2026-10-15", tramos) == 10
    assert C.pct_closer("2026-10-16", tramos) == 15
    assert C.pct_closer("2026-12-01T10:00:00Z", tramos) == 15


def test_dinero_klarna_y_closer():
    # 2 ventas de 397: una el 15/10 al contado (10 %), otra el 20/10 con Klarna (15 %).
    d = C.dinero_de_ventas([_venta(fecha="2026-10-15"), _venta(metodo="klarna", fecha="2026-10-20")], 0, AJ)
    assert d["ingresos_cents"] == 79400
    assert d["klarna_cents"] == 1985  # 5 % de 397
    assert d["ventas_netas_cents"] == 79400 - 1985
    # closer: 10 % de 397 + 15 % de (397 − 19,85)
    assert d["closer_cents"] == round(39700 * 0.10 + (39700 - 1985) * 0.15)
    assert d["ingreso_neto_cents"] == d["ventas_netas_cents"] - d["closer_cents"]


def test_sin_llamada_no_hay_comision_del_closer():
    d = C.dinero_de_ventas([_venta(con_llamada=False)], 0, AJ)
    assert d["closer_cents"] == 0 and d["ingreso_neto_cents"] == 39700


def test_las_devoluciones_bajan_la_base_del_closer():
    d = C.dinero_de_ventas([_venta(), _venta()], 39700, AJ)
    assert d["ventas_netas_cents"] == 39700
    assert d["closer_cents"] == round(39700 * 0.15)


def test_campana_completa():
    entrada = {
        "gasto_ads_cents": 30000,  # 300 € en anuncios
        "otros_gastos_cents": 10000,  # 100 €: clase gratis y vídeo UGC
        "impresiones": 20000,
        "clics": 400,
        "leads": 40,
        "agendadas": 20,
        "presentadas": 15,
        "ventas": [_venta(), _venta(), _venta()],
    }
    m = C.calcular_campana(entrada, AJ)
    assert m["ctr"] == 2.0
    assert m["cpc"] == 75  # 0,75 €
    assert m["coste_lead"] == 750
    assert m["coste_agendada"] == 1500
    assert m["paso_agendar"] == 50.0
    assert m["asistencia"] == 75.0
    assert m["cierre"] == 20.0
    # CAC con todo el coste de la campaña: 400 € / 3
    assert m["cac"] == round(40000 / 3)
    assert m["roas"] == round(119100 / 30000, 2)
    assert m["neto_por_alumno"] == round(m["ingreso_neto_cents"] / 3)
    assert m["margen"] == m["ingreso_neto_cents"] - 40000
    assert m["cac_maximo"] == m["neto_por_alumno"]


def test_sin_ventas_el_cac_maximo_sale_del_precio():
    m = C.calcular_campana({"gasto_ads_cents": 5000, "leads": 3}, AJ, hoy="2026-10-20")
    assert m["ventas"] == 0 and m["cac"] is None and m["cierre"] is None
    assert m["cac_maximo"] == round(43500 * 0.85)
    assert m["margen"] == -5000


def test_semaforo():
    u = AJ["umbrales"]
    assert C.semaforo("cac", 9000, u) == "verde"  # 90 €
    assert C.semaforo("cac", 12000, u) == "ambar"
    assert C.semaforo("cac", 15100, u) == "rojo"
    assert C.semaforo("cierre", 35, u) == "verde"
    assert C.semaforo("cierre", 10, u) == "rojo"
    assert C.semaforo("margen", -100, u) == "rojo"
    assert C.semaforo("margen", 0, u) == "verde"
    assert C.semaforo("neto_por_alumno", 30000, u) is None
    assert C.semaforo("cac", None, u) is None


def test_semanas_y_lunes():
    assert C.lunes("2026-10-17") == "2026-10-12"
    assert C.lunes("2026-10-12T08:00:00Z") == "2026-10-12"
    assert C.lunes("nada") == ""
    assert C.semanas_entre("2026-09-08", "2026-09-08") == 1
    assert C.semanas_entre("2026-09-08", "2026-09-15") == 2
    assert C.semanas_entre("2026-10-01", "2026-09-01") == 0


def test_total_del_negocio_con_el_profe():
    t = C.total_negocio([_venta(), _venta()], 0, 20000, AJ, hoy="2026-10-17", desde="2026-09-14")
    # 14/09 → 17/10: 5 semanas empezadas
    assert t["profe_semanas"] == 5 and t["profe_cents"] == 5 * 7500
    assert t["resultado_cents"] == t["ingreso_neto_cents"] - 37500 - 20000
    assert t["coste_por_alumno_cents"] == round((20000 + 37500) / 2)


# ── los números de la escuela por campaña ───────────────────────────────────

from unittest.mock import patch  # noqa: E402

import pytest  # noqa: E402

from src.db.vision import VisionDato, VisionFlecha, VisionMapa, VisionNodo, VisionPago  # noqa: E402,F401
from src.services.vision import campanas as K  # noqa: E402
from src.services.vision import mapa as M  # noqa: E402
from src.services.vision.escuela import agrupar  # noqa: E402


def _ficha(email, utm, cuando="2026-10-14T10:00:00", eventos_extra=()):
    eventos = [{"kind": "admision", "when": cuando, "utm_campaign": utm}] + list(eventos_extra)
    return {"email": email, "utm_campaign": utm, "eventos": eventos, "primer_contacto": {"when": cuando}}


def test_agrupar_por_campana():
    fichas = [
        _ficha("ana@x.com", "vsl-oct"),
        _ficha("bea@x.com", "vsl-oct", eventos_extra=[{"kind": "reunion", "when": "2026-10-15T09:00:00", "utm_campaign": ""}]),
        _ficha("carla@x.com", "otra"),
    ]
    citas = [{"email": "ana@x.com", "estado": "activa", "reservada": "2026-10-16T08:00:00Z"}, {"email": "carla@x.com", "estado": "cancelada", "reservada": "2026-10-16"}]
    resultados = [{"email": "ana@x.com", "resultado": "pagado", "inicio": "2026-10-17T16:00:00Z"}, {"email": "bea@x.com", "resultado": "no-vino", "inicio": "2026-10-18"}]
    ventas = [{"email": "ana@x.com", "importe_cents": 39700, "fecha": "2026-10-17T18:00:00"}]
    d = agrupar(fichas, citas, resultados, ventas, con_plan=set())
    g = d["por_utm"]["vsl-oct"]
    assert [x["email"] for x in g["leads"]] == ["ana@x.com", "bea@x.com"]
    assert {x["email"] for x in g["agendadas"]} == {"ana@x.com", "bea@x.com"}
    # Bea no vino: agendada sí, presentada no.
    assert [x["email"] for x in g["presentadas"]] == ["ana@x.com"]
    assert g["ventas"][0]["con_llamada"] is True and g["ventas"][0]["metodo"] == "unico"
    # La cita cancelada de Carla no cuenta.
    assert d["por_utm"]["otra"]["agendadas"] == []


def test_lo_apuntado_manda_sobre_la_escuela():
    escuela = {
        "leads": [{"email": "a", "fecha": "2026-10-14"}, {"email": "b", "fecha": "2026-10-15"}],
        "agendadas": [{"email": "a", "fecha": "2026-10-16"}],
        "presentadas": [],
        "ventas": [{"email": "a", "importe_cents": 39700, "fecha": "2026-10-17", "metodo": "unico", "con_llamada": True}],
    }
    filas = [{"fecha": "2026-10-14", "gasto_cents": 5000, "impresiones": 1000, "clics": 20, "leads": 7, "agendadas": None, "presentadas": None, "ventas": None, "ingresos_cents": None, "devoluciones_cents": 0, "otros_gastos_cents": 0}]
    r = K.entrada_de_campana(filas, [], escuela, None)
    e, f = r["entrada"], r["fuentes"]
    assert e["leads"] == 7 and f["leads"] == "a-mano"
    assert e["agendadas"] == 1 and f["agendadas"] == "escuela"
    assert len(e["ventas"]) == 1 and f["ventas"] == "escuela"
    assert f["gasto_ads"] == "a-mano"
    assert r["semanas"] == [{"semana": "2026-10-12", "gasto_ads_cents": 5000, "impresiones": 1000, "clics": 20, "leads": 7, "agendadas": 1, "ventas": 1, "ingresos_cents": 39700}]


def test_sin_gasto_apuntado_usa_el_de_anuncios():
    r = K.entrada_de_campana([], [], None, {"gasto_cents": 6900, "fecha": "2026-10-07"})
    assert r["entrada"]["gasto_ads_cents"] == 6900 and r["fuentes"]["gasto_ads"] == "anuncios"


def test_un_pago_con_el_correo_de_una_venta_le_pone_klarna_y_no_suma():
    escuela = [{"email": "ana@x.com", "importe_cents": 39700, "fecha": "2026-10-17", "metodo": "unico", "con_llamada": True}]
    pagos = [
        {"email": "ana@x.com", "importe_cents": 39700, "fecha": "2026-10-17", "metodo": "klarna", "con_llamada": True},
        {"email": "", "importe_cents": 19700, "fecha": "2026-10-18", "metodo": "unico", "con_llamada": False},
    ]
    v = K.mezclar_ventas(escuela, pagos)
    assert len(v) == 2
    assert v[0]["metodo"] == "klarna" and v[0]["origen"] == "escuela"
    assert v[1]["importe_cents"] == 19700 and v[1]["origen"] == "a-mano"


def test_ventas_apuntadas_en_datos_reparten_el_importe():
    filas = [{"fecha": "2026-10-20", "ventas": 3, "ingresos_cents": 100000}]
    r = K.entrada_de_campana(filas, [], {"leads": [], "agendadas": [], "presentadas": [], "ventas": [{"email": "x", "importe_cents": 39700, "fecha": "2026-10-20"}]}, None)
    importes = [v["importe_cents"] for v in r["entrada"]["ventas"]]
    assert importes == [33334, 33333, 33333] and r["fuentes"]["ventas"] == "a-mano"


# ── el mapa con base de datos ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_inicio_con_verticales_submapa_y_migas(db, org):
    d = await M.leer_mapa(1, None, db)
    titulos = {n["titulo"] for n in d["nodos"]}
    assert {"Holandés Nawar", "Marketing", "Ventas", "Legal", "Campañas"} <= titulos
    assert len(d["flechas"]) == 7
    assert d["migas"] == [{"mapa_id": d["mapa"]["id"], "nombre": "Inicio"}]
    # Abrir la vertical Marketing y dentro una campaña.
    marketing = next(n for n in d["nodos"] if n["titulo"] == "Marketing")
    sub = await M.abrir_submapa(1, marketing["id"], db)
    assert await M.abrir_submapa(1, marketing["id"], db) == sub  # no crea otro
    campana = await M.crear_nodo(1, sub, {"tipo": "campana", "titulo": "Repoblación", "x": 10, "y": 20}, db)
    sub2 = await M.abrir_submapa(1, campana["id"], db)
    d2 = await M.leer_mapa(1, sub2, db)
    assert [c["nombre"] for c in d2["migas"]] == ["Inicio", "Marketing", "Repoblación"]


@pytest.mark.asyncio
async def test_cambiar_tarjeta_limpia_lo_que_llega(db, org):
    d = await M.leer_mapa(1, None, db)
    n = d["nodos"][0]
    r = await M.cambiar_nodo(
        1,
        n["id"],
        {
            "estado": "inventado",
            "urgente": True,
            "vence": "mañana",
            "enlaces": [{"titulo": "Guion", "url": "docs.google.com/x"}, {"titulo": "", "url": ""}],
            "checklist": [{"texto": "Enviar guion", "hecho": True}, {"texto": "  "}],
            "utm_campaign": "  VSL-Oct ",
        },
        db,
    )
    assert r["estado"] == n["estado"] and r["urgente"] is True and r["vence"] == ""
    assert r["enlaces"] == [{"titulo": "Guion", "url": "https://docs.google.com/x"}]
    assert r["checklist"] == [{"texto": "Enviar guion", "hecho": True}] and r["hechas"] == 1
    assert r["utm_campaign"] == "vsl-oct"
    assert [u["id"] for u in await M.urgentes(1, db)] == [n["id"]]


@pytest.mark.asyncio
async def test_borrar_una_campana_se_lleva_su_submapa_y_sus_datos(db, org):
    inicio = (await M.leer_mapa(1, None, db))["mapa"]["id"]
    c = await M.crear_nodo(1, inicio, {"tipo": "campana", "titulo": "Clase gratuita"}, db)
    sub = await M.abrir_submapa(1, c["id"], db)
    dentro = await M.crear_nodo(1, sub, {"tipo": "tarea", "titulo": "Grabar"}, db)
    assert (await K.guardar_dato(1, c["id"], {"fecha": "2026-10-17", "gasto_cents": 6900}, db))["ok"]
    assert (await K.guardar_pago(1, c["id"], {"fecha": "2026-10-17", "importe_cents": 39700, "metodo": "klarna"}, db))["ok"]
    assert await M.borrar_nodo(1, c["id"], db)
    from sqlmodel import select

    assert (await db.execute(select(VisionDato))).scalars().all() == []
    assert (await db.execute(select(VisionPago))).scalars().all() == []
    assert await M.nodo(1, dentro["id"], db) is None
    assert await M.leer_mapa(1, sub, db) is None


@pytest.mark.asyncio
async def test_datos_solo_en_campanas_y_semana_al_lunes(db, org):
    inicio = (await M.leer_mapa(1, None, db))["mapa"]["id"]
    nota = await M.crear_nodo(1, inicio, {"tipo": "nota"}, db)
    assert not (await K.guardar_dato(1, nota["id"], {"fecha": "2026-10-17"}, db))["ok"]
    c = await M.crear_nodo(1, inicio, {"tipo": "campana", "titulo": "Ads"}, db)
    r = await K.guardar_dato(1, c["id"], {"fecha": "2026-10-17", "periodo": "semana", "gasto_cents": "6900", "leads": ""}, db)
    assert r["dato"]["fecha"] == "2026-10-12" and r["dato"]["gasto_cents"] == 6900 and r["dato"]["leads"] is None


@pytest.mark.asyncio
async def test_cuadro_de_mando_con_la_escuela_de_mentira(db, org):
    inicio = (await M.leer_mapa(1, None, db))["mapa"]["id"]
    c = await M.crear_nodo(1, inicio, {"tipo": "campana", "titulo": "VSL oct"}, db)
    await M.cambiar_nodo(1, c["id"], {"utm_campaign": "vsl-oct"}, db)
    await K.guardar_dato(1, c["id"], {"fecha": "2026-10-14", "gasto_cents": 30000, "otros_gastos_cents": 10000, "otros_concepto": "Vídeo UGC", "otros_categoria": "publicidad"}, db)

    async def escuela_falsa(org_id, db_session):
        return {
            "por_utm": {"vsl-oct": {"leads": [{"email": "a", "fecha": "2026-10-14"}] * 4, "agendadas": [{"email": "a", "fecha": "2026-10-15"}] * 2, "presentadas": [{"email": "a", "fecha": "2026-10-16"}], "ventas": [{"email": "a", "importe_cents": 39700, "fecha": "2026-10-16", "metodo": "unico", "con_llamada": True}]}},
            "ventas": [{"email": "a", "importe_cents": 39700, "fecha": "2026-10-16", "metodo": "unico", "con_llamada": True}],
            "avisos": [],
            "desde": "",
        }

    with patch("src.services.vision.escuela.numeros_de_la_escuela", escuela_falsa):
        r = await K.cuadro_de_mando(1, db)
    camp = r["campanas"][0]
    assert camp["cifras"]["leads"] == 4 and camp["cifras"]["ventas"] == 1
    assert camp["cifras"]["cac"] == 40000 and camp["semaforo"]["cac"] == "rojo"
    # Los gastos de Visión salen en Gastos, y el total del negocio los cuenta.
    filas = await K.gastos_para_el_panel(1, db)
    assert sorted(f["importe_cents"] for f in filas) == [10000, 30000]
    assert r["negocio"]["gastos_cents"] == 40000
    assert r["negocio"]["ingresos_cents"] == 39700


# ── plantilla: campaña de clase gratuita ────────────────────────────────────


def test_plan_clase_gratuita_fechas_y_flechas():
    from datetime import date

    from src.services.vision.plantillas import plan_clase_gratuita, utm_por_defecto

    # La fecha es el día que EMPIEZA la campaña (la clase es grabada).
    plan = plan_clase_gratuita(date(2026, 11, 6), "")
    assert plan["utm"] == utm_por_defecto(date(2026, 11, 6)) == "clase-gratis-06nov"
    c = plan["campana"]
    assert c["tipo"] == "campana" and c["utm_campaign"] == "clase-gratis-06nov"
    assert c["inicio"] == "2026-11-06" and "fin" not in c
    por = {n["clave"]: n for n in plan["nodos"]}
    # Nada de clase en directo: ni recordatorios ni repetición de 48 h.
    assert not {"recordatorios", "repeticion", "oferta", "cierre", "pagina"} & set(por)
    assert "directo" not in por["clase"]["titulo"]
    # Fechas límite contadas desde el día que empieza.
    assert por["clase"]["vence"] == "2026-10-30"
    assert por["pagina_ads"]["vence"] == por["pagina_org"]["vence"] == "2026-11-03"
    assert por["ugc"]["vence"] == "2026-11-06"
    # Lo que ya está hecho en la escuela sale en verde; lo demás, pendiente.
    assert por["listo"]["estado"] == "hecho"
    assert "estado" not in por["pagina_ads"]
    # Dos páginas: el anuncio va a la de ads; reels, historias y setter a la orgánica.
    assert {a for a, b, _ in plan["flechas"] if b == "pagina_ads"} == {"ugc"}
    assert {a for a, b, _ in plan["flechas"] if b == "pagina_org"} == {"reels", "historias", "setter"}
    assert "utm_medium=paid" in por["ugc"]["cuerpo"] and "utm_campaign=clase-gratis-06nov" in por["ugc"]["cuerpo"]
    assert "utm_medium=paid" not in por["reels"]["cuerpo"]
    assert "setter-NOMBRE" in por["setter"]["cuerpo"]
    # Seis correos en cadena: «aquí tienes tu clase», «por si la quieres volver
    # a ver» y los de convencer, todos con el botón de agendar.
    correos = [n for n in plan["nodos"] if n["clave"].startswith("correo")]
    assert [n["clave"] for n in correos] == [f"correo{i}" for i in range(1, 7)]
    assert "Aquí tienes tu clase" in correos[0]["cuerpo"] and "volver a ver" in correos[1]["cuerpo"]
    assert all("[enlace para agendar]" in n["cuerpo"] for n in correos)
    cadena = [(a, b) for a, b, _ in plan["flechas"] if a.startswith("correo") and b.startswith("correo")]
    assert cadena == [(f"correo{i}", f"correo{i + 1}") for i in range(1, 6)]
    assert ("correo6", "agendar", "botón en todos") in plan["flechas"]
    # Sin precio en los correos: eso se habla en la llamada.
    assert not any("€" in n["cuerpo"] for n in correos)
    # Toda flecha une tarjetas que existen y no hay claves repetidas.
    assert len(por) == len(plan["nodos"])
    for a, b, _ in plan["flechas"]:
        assert a in por and b in por
    # Las cifras: tarjetas de métrica de esta campaña.
    assert {n["metrica"]["clave"] for n in plan["nodos"] if n["tipo"] == "metrica"} == {"coste_lead", "coste_agendada", "cierre", "cac"}


async def test_crear_clase_gratuita_va_dentro_de_campanas(db):
    from src.services.vision.plantillas import crear_clase_gratuita

    inicio = await M.leer_mapa(1, None, db)
    r = await crear_clase_gratuita(1, {"mapa_id": inicio["mapa"]["id"], "fecha": "2026-11-06", "hora": "19:00"}, db)
    assert r["ok"]
    # Desde Inicio, la campaña va dentro de la vertical «Campañas».
    campanas_v = next(n for n in inicio["nodos"] if n["titulo"] == "Campañas")
    dentro = await M.leer_mapa(1, r["mapa_id"], db)
    assert dentro["mapa"]["nodo_padre_id"] == campanas_v["id"]
    camp = next(n for n in dentro["nodos"] if n["id"] == r["campana_id"])
    assert camp["tipo"] == "campana" and camp["utm_campaign"] == "clase-gratis-06nov" and camp["submapa_id"] == r["submapa_id"]
    # Su mapa, con el embudo entero y sus flechas.
    sub = await M.leer_mapa(1, r["submapa_id"], db)
    titulos = {n["titulo"] for n in sub["nodos"]}
    assert {"Página de la clase · ads", "Página de la clase · orgánico", "La clase (grabada)", "Anuncio UGC en Meta", "DMs del setter"} <= titulos
    assert "Correo 2 · Por si la quieres volver a ver" in titulos
    assert len(sub["flechas"]) == 16
    metricas = [n for n in sub["nodos"] if n["tipo"] == "metrica"]
    assert metricas and all(n["metrica"]["campana_id"] == r["campana_id"] for n in metricas)
    # Sin fecha, no.
    assert not (await crear_clase_gratuita(1, {"fecha": ""}, db))["ok"]
    assert (await db.execute(VisionNodo.__table__.select())).first() is not None
    assert (await db.execute(VisionFlecha.__table__.select())).first() is not None

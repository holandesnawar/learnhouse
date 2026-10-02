"""Kanban de matrículas y ficha del cliente: la lógica pura."""

from src.services.panel.cliente import linea_de_tiempo, paginas_vistas
from src.services.panel.pipeline import colocar, en_tablero
from src.services.panel.tareas import fecha_ok


def _ficha(**kw):
    base = {
        "email": "ana@correo.com",
        "nombre": "Ana",
        "telefono": "",
        "etapa": "pidio",
        "atendida": False,
        "matricula_at": "2026-09-20T10:00:00",
        "ultimo_contacto": {"when": "2026-09-20T10:00:00", "que": "Pidió plaza"},
    }
    base.update(kw)
    return base


def test_sin_mover_va_a_nuevo():
    assert colocar(_ficha(), None)["etapa"] == "nuevo"


def test_atendida_sin_mover_va_a_contactado():
    assert colocar(_ficha(atendida=True), None)["etapa"] == "contactado"


def test_se_queda_donde_la_dejaron():
    c = colocar(_ficha(), {"etapa": "propuesta", "canal": "whatsapp", "updated_at": "2026-09-25"})
    assert c["etapa"] == "propuesta"
    assert c["canal"] == "whatsapp"
    assert c["desde"] == "2026-09-25"


def test_al_pagar_pasa_a_alumno_aunque_la_movieran():
    assert colocar(_ficha(etapa="alumno"), {"etapa": "perdido"})["etapa"] == "alumno"


def test_una_etapa_rara_guardada_no_rompe():
    assert colocar(_ficha(), {"etapa": "loquesea"})["etapa"] == "nuevo"


def test_quien_solo_bajo_una_guia_no_entra_en_el_tablero():
    assert not en_tablero(_ficha(etapa="lead"))
    assert en_tablero(_ficha(etapa="pidio"))
    assert en_tablero(_ficha(etapa="en-pago"))
    assert en_tablero(_ficha(etapa="alumno"))


def test_paginas_vistas_en_orden_y_sin_repetir():
    ficha = {"eventos": [{"recorrido": "home,landing-precio"}, {"recorrido": "landing-precio,agendar"}]}
    pags = paginas_vistas(ficha)
    assert [p["id"] for p in pags] == ["home", "landing-precio", "agendar"]
    assert [p["precio"] for p in pags] == [False, True, False]


def test_linea_de_tiempo_lo_mas_reciente_arriba():
    linea = linea_de_tiempo(
        [{"when": "2026-09-01T10:00:00", "que": "Pidió plaza", "kind": "solicitud"}],
        [{"created_at": "2026-09-03T10:00:00", "asunto": "Bienvenida", "ok": True}],
        [{"created_at": "2026-09-02T10:00:00", "texto": "No contesta", "autor": "Closer"}],
        [],
    )
    assert [i["tipo"] for i in linea] == ["correo", "nota", "evento"]


def test_fecha_de_tarea():
    assert fecha_ok("2026-10-01") == "2026-10-01"
    assert fecha_ok("mañana") == ""
    assert fecha_ok("") == ""


def test_clientes_agrupados_por_correo():
    from src.services.panel.clientes import agrupar_pagos

    c = agrupar_pagos(
        [
            {"email": "Ana@x.com", "nombre": "Ana", "importe_cents": 19700, "fecha": "2026-09-10", "producto": "formacion-a0-a1"},
            {"email": "ana@x.com", "nombre": "Ana García", "importe_cents": 20000, "fecha": "2026-10-10", "producto": "formacion-a0-a1"},
            {"email": "leo@x.com", "nombre": "Leo", "importe_cents": 39700, "fecha": "2026-09-20", "producto": "formacion-a0-a1"},
        ]
    )
    assert [x["email"] for x in c] == ["ana@x.com", "leo@x.com"]
    assert c[0]["total_cents"] == 39700 and c[0]["pagos"] == 2
    assert c[0]["nombre"] == "Ana García"
    assert c[0]["primer_pago"] == "2026-09-10"


def test_anuncios_cuentan_leads_ventas_y_retorno():
    from src.services.panel.ads import metricas

    fichas = [
        {"email": "a@x.com", "etapa": "lead", "utm_campaign": "reels-sept", "eventos": [], "primer_contacto": {"when": "2026-09-01"}},
        {"email": "b@x.com", "etapa": "pidio", "utm_campaign": "", "eventos": [{"utm_campaign": "Reels-Sept"}], "primer_contacto": {"when": "2026-09-02"}},
        {"email": "c@x.com", "etapa": "alumno", "utm_campaign": "reels-sept", "eventos": [], "primer_contacto": {"when": "2026-09-03"}},
        {"email": "d@x.com", "etapa": "lead", "utm_campaign": "guia-oct", "eventos": [], "primer_contacto": {"when": "2026-09-04"}},
    ]
    r = metricas([{"id": 1, "nombre": "Reels", "utm_campaign": "reels-sept", "gasto_cents": 30000}], fichas, {"c@x.com": 39700})
    c = r["campanas"][0]
    assert (c["leads"], c["matriculas"], c["ventas"]) == (3, 2, 1)
    assert c["coste_por_lead_cents"] == 10000
    assert c["coste_por_venta_cents"] == 30000
    assert c["retorno"] == 1.32
    # La que no está apuntada sale aparte, para no perderla.
    assert r["sin_apuntar"] == [{"utm_campaign": "guia-oct", "leads": 1, "ventas": 0}]


def test_campana_sin_gasto_no_divide_por_cero():
    from src.services.panel.ads import metricas

    r = metricas([{"id": 1, "nombre": "X", "utm_campaign": "x", "gasto_cents": 0}], [], {})
    assert r["campanas"][0]["coste_por_lead_cents"] is None
    assert r["total"]["retorno"] is None


def test_tablero_lo_mas_nuevo_arriba_y_sin_pruebas():
    import asyncio

    from src.services.panel import pipeline

    async def sin_guardadas(_db):
        return {"x@x.com": {"etapa": "", "oculto": True}}

    fichas = [
        _ficha(email="viejo@x.com", matricula_at="2026-09-01T10:00:00"),
        _ficha(email="nuevo@x.com", matricula_at="2026-09-20T10:00:00+00:00"),
        _ficha(email="medio@x.com", matricula_at="2026-09-10T10:00:00"),
        _ficha(email="prueba@x.com", etapa="alumno", matricula_at="2026-09-25", fuera_de_metricas=True),
        _ficha(email="x@x.com", etapa="alumno", matricula_at="2026-09-26"),
    ]
    original = pipeline.guardadas
    pipeline.guardadas = sin_guardadas
    try:
        t = asyncio.run(pipeline.tablero(fichas, None))["tarjetas"]
    finally:
        pipeline.guardadas = original
    visibles = [c["email"] for c in t if not c["oculto"]]
    assert visibles == ["nuevo@x.com", "medio@x.com", "viejo@x.com"]
    # Las quitadas siguen llegando (para poder devolverlas), marcadas.
    assert {c["email"] for c in t if c["oculto"]} == {"prueba@x.com", "x@x.com"}


def test_por_que_vio_el_precio():
    from src.services.panel.cliente import por_que_vio_el_precio

    enlace = [{"kind": "matricula", "utm_medium": "enlace-pago", "recorrido": "enlace-pago"}]
    assert "enlace de pago" in por_que_vio_el_precio(enlace)
    web = [{"kind": "matricula", "utm_medium": "", "recorrido": "home", "referrer": "mail.google.com"}]
    t = por_que_vio_el_precio(web)
    assert "formulario de pago de la web" in t and "mail.google.com" in t and "el inicio de la web" in t
    directo = por_que_vio_el_precio([{"kind": "matricula", "recorrido": "", "referrer": ""}])
    assert "directamente" in directo
    assert por_que_vio_el_precio([{"kind": "solicitud", "recorrido": "agendar"}]) == ""


def test_la_admision_cuenta_como_matricula_y_dice_que_vio():
    from src.services.contactos.contactos import _evento, etapa_de

    e = _evento("admision", "2026-10-02T10:00:00", "p@x.com", extra={"video": "visto", "ultima": "Horas a la semana"})
    assert "vio el vídeo entero" in e["que"] and "Horas a la semana" in e["que"]
    assert etapa_de({"admision"}, False) == "pidio"
    m = _evento("matricula", "", "p@x.com", utm_medium="enlace-pago", recorrido="enlace-pago")
    assert "enlace de pago" in m["que"]

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

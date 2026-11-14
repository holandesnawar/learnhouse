"""La lectura semanal: semanas, archivo y lo que se guarda."""

from datetime import date

import pytest
from fastapi import HTTPException

from src.services.lecturas import lecturas as L


def test_la_semana_es_su_lunes():
    assert L.lunes_de("2026-11-12") == "2026-11-09"  # jueves → lunes
    assert L.lunes_de("2026-11-09") == "2026-11-09"
    assert L.lunes_de("2026-11-15") == "2026-11-09"  # domingo
    assert L.lunes_de("") == "" and L.lunes_de("mañana") == ""


def test_las_palabras_pegadas_una_por_linea():
    pal = L.leer_palabras("de fiets | la bici | Ik ga met de fiets.\n- het vervoermiddel | el medio de transporte\n\nfit")
    assert pal[0] == {"nl": "de fiets", "es": "la bici", "ejemplo": "Ik ga met de fiets."}
    assert pal[1] == {"nl": "het vervoermiddel", "es": "el medio de transporte", "ejemplo": ""}
    assert pal[2]["nl"] == "fit" and len(pal) == 3
    assert L.leer_palabras([{"nl": "", "es": "x"}, {"nl": "regelmatig", "es": "a menudo"}]) == [
        {"nl": "regelmatig", "es": "a menudo", "ejemplo": ""}
    ]


def test_limpiar_pide_semana_y_titulo_y_valida_enlaces():
    with pytest.raises(HTTPException):
        L.limpiar({"titulo": "Fietsen"})
    with pytest.raises(HTTPException):
        L.limpiar({"semana": "2026-11-12"})
    with pytest.raises(HTTPException):
        L.limpiar({"semana": "2026-11-12", "titulo": "Fietsen", "video": "javascript:alert(1)"})
    l = L.limpiar({"semana": "2026-11-12", "titulo": " Fietsen ", "video": "https://youtu.be/x", "palabras": "de fiets | la bici"})
    assert l["semana"] == "2026-11-09" and l["titulo"] == "Fietsen" and l["id"]
    # Cambiar una cosa no borra las demás.
    l2 = L.limpiar({"titulo_es": "La bici"}, l)
    assert l2["video"] == "https://youtu.be/x" and l2["palabras"] and l2["id"] == l["id"] and l2["titulo_es"] == "La bici"


def test_la_de_esta_semana_el_archivo_y_las_que_vienen():
    lecturas = [
        {"id": "a", "semana": "2026-10-26", "titulo": "Het weer"},
        {"id": "b", "semana": "2026-11-09", "titulo": "Fietsen"},
        {"id": "c", "semana": "2026-11-02", "titulo": "Koffie"},
        {"id": "d", "semana": "2026-11-16", "titulo": "Sinterklaas"},
    ]
    hoy = date(2026, 11, 12)
    alumno = L.partir(lecturas, hoy, equipo=False)
    assert alumno["actual"]["id"] == "b"
    assert [l["id"] for l in alumno["archivo"]] == ["c", "a"]
    assert alumno["proximas"] == []  # la del lunes que viene no se ve antes
    equipo = L.partir(lecturas, hoy, equipo=True)
    assert [l["id"] for l in equipo["proximas"]] == ["d"]
    # El lunes de la semana siguiente, pasa a ser la actual.
    assert L.partir(lecturas, date(2026, 11, 16), equipo=False)["actual"]["id"] == "d"
    assert L.partir([], hoy, equipo=False) == {"actual": None, "archivo": [], "proximas": []}


def test_el_aviso_de_la_campana_sale_la_semana_de_la_lectura():
    from datetime import datetime
    from src.services.lecturas.lecturas import NL, aviso_de

    lecturas = [
        {"id": "a", "semana": "2026-11-09", "titulo": "Fietsen in Nederland", "titulo_es": "La bici", "creada": "2026-11-05T10:00:00+01:00"},
        {"id": "b", "semana": "2026-11-16", "titulo": "De markt", "creada": "2026-11-05T10:00:00+01:00"},
    ]
    # El jueves de su semana: avisa de la suya, con fecha del lunes.
    aviso = aviso_de(lecturas, datetime(2026, 11, 12, 12, 0, tzinfo=NL))
    assert aviso["id"] == "lectura:a" and aviso["kind"] == "lectura"
    assert "Fietsen in Nederland" in aviso["title"]
    assert aviso["date"].startswith("2026-11-08T23:00:00")
    # El lunes siguiente ya es la otra: aviso nuevo.
    assert aviso_de(lecturas, datetime(2026, 11, 16, 8, 0, tzinfo=NL))["id"] == "lectura:b"
    # Dos semanas después de la última, ya no avisa.
    assert aviso_de(lecturas, datetime(2026, 11, 24, 8, 0, tzinfo=NL)) is None
    # Creada el miércoles de su propia semana: la fecha es la de crearla.
    tarde = [{"id": "c", "semana": "2026-11-09", "titulo": "X", "creada": "2026-11-11T15:00:00+01:00"}]
    assert aviso_de(tarde, datetime(2026, 11, 12, 12, 0, tzinfo=NL))["date"].startswith("2026-11-11T14:00:00")
    assert aviso_de([], datetime(2026, 11, 12, 12, 0, tzinfo=NL)) is None

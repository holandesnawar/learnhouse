import json
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


def test_ejercicios_de_la_lectura():
    from src.services.lecturas.lecturas import leer_ejercicios, limpiar

    ejs = leer_ejercicios(
        [
            {"tipo": "vf", "pregunta": "Anna fietst.", "correcta": "Niet waar"},
            {"tipo": "op", "pregunta": "Hoe laat?", "correcta": "om zeven uur", "opciones": ["om acht uur", "om zeven uur", "", "om acht uur"]},
            {"tipo": "hu", "pregunta": "Ik sta ___.", "correcta": "op"},
            {"tipo": "ab", "pregunta": "Hoe laat sta jij op?", "correcta": ""},
            {"tipo": "xx", "pregunta": "no vale", "correcta": "a"},
            {"tipo": "op", "pregunta": "sin respuesta", "correcta": ""},
        ]
    )
    assert [e["tipo"] for e in ejs] == ["vf", "op", "hu", "ab"]
    assert ejs[0]["correcta"] == "niet waar"
    assert ejs[1]["opciones"] == ["om acht uur"]
    l = limpiar({"semana": "2026-11-18", "titulo": "Mijn dag", "ejercicios": ejs})
    assert len(l["ejercicios"]) == 4 and l["semana"] == "2026-11-16"


def test_resultados_de_los_ejercicios():
    from datetime import datetime, timezone

    import pytest

    from src.services.lecturas import resultados as R

    t1 = datetime(2026, 11, 16, 9, tzinfo=timezone.utc)
    t2 = datetime(2026, 11, 17, 9, tzinfo=timezone.utc)
    d = R.apuntar({}, "l1", 7, 10, [2, 5, 5, "x", 99], t1)
    assert d["l1"]["aciertos"] == 7 and d["l1"]["fallos"] == [2, 5] and d["l1"]["veces"] == 1
    d = R.apuntar(d, "l1", 5, 10, [1], t2)
    assert d["l1"]["aciertos"] == 5 and d["l1"]["mejor"] == 7 and d["l1"]["veces"] == 2
    assert d["l1"]["primera"].startswith("2026-11-16") and d["l1"]["ultima"].startswith("2026-11-17")
    assert R.apuntar({}, "l2", 50, 10, [], t1)["l2"]["aciertos"] == 10
    with pytest.raises(ValueError):
        R.apuntar({}, "l3", 0, 0, [], t1)
    assert R.leer("no es json") == {} and R.leer(json.dumps(d))["l1"]["mejor"] == 7

    lectura = {"id": "l1", "ejercicios": [{"pregunta": "A?", "correcta": "a"}, {"pregunta": "B?", "correcta": "b"}]}
    alumnos = [{"user_id": 1, "nombre": "Ana"}, {"user_id": 2, "nombre": "Bea"}, {"user_id": 3, "nombre": "Carla"}]
    por = {1: {"l1": {"aciertos": 1, "total": 2, "fallos": [2], "ultima": "b"}}, 2: {"l1": {"aciertos": 2, "total": 2, "fallos": [], "ultima": "a"}}}
    r = R.resumen_lectura(lectura, por, alumnos)
    assert [h["nombre"] for h in r["hechos"]] == ["Ana", "Bea"]
    assert [a["nombre"] for a in r["sin_hacer"]] == ["Carla"]
    assert r["media_pct"] == 75
    assert r["mas_fallados"] == [{"numero": 2, "veces": 1, "pregunta": "B?", "correcta": "b"}]

    p = R.para_progreso(por[1], [{"id": "l1", "titulo": "Mijn huis", "semana": "2026-11-16"}, {"id": "otra"}])
    assert p == [{"id": "l1", "titulo": "Mijn huis", "semana": "2026-11-16", "aciertos": 1, "total": 2, "mejor": None, "veces": None, "ultima": "b"}]

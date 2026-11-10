"""La misma semana en los dos grupos (10/11/2026)."""

import json
from types import SimpleNamespace

from src.services.tareas import gemelas as G
from src.services.tareas import material_profe as MP


def test_la_gemela_es_la_del_mismo_tema_esa_semana():
    s = {"id": 1, "tema": "Mijn huis", "fecha": "2026-11-10"}
    otras = [
        {"id": 7, "tema": "Eten en drinken", "fecha": "2026-11-05"},
        {"id": 8, "tema": "mijn huis", "fecha": "2026-11-12"},
        {"id": 9, "tema": "Mijn huis", "fecha": "2026-12-12"},
    ]
    assert G.elegir_gemela(s, otras)["id"] == 8


def test_sin_el_mismo_tema_vale_la_unica_de_la_misma_semana():
    s = {"id": 1, "tema": "Mijn huis", "fecha": "2026-11-10"}
    assert G.elegir_gemela(s, [{"id": 8, "tema": "Thuis", "fecha": "2026-11-12"}])["id"] == 8
    # La de la semana anterior, aunque esté a menos de 6 días, no.
    assert G.elegir_gemela(s, [{"id": 8, "tema": "Thuis", "fecha": "2026-11-05"}]) is None
    assert G.elegir_gemela(s, []) is None


def test_el_plazo_se_corre_los_mismos_dias():
    assert G.plazo_corrido("2026-11-10", "2026-11-15", "2026-11-12") == "2026-11-17"
    assert G.plazo_corrido("2026-11-10", "", "2026-11-12") == ""


def test_igualar_copia_lo_de_la_clase_y_respeta_lo_del_grupo():
    archivo = {"id": "a1", "tipo": "archivo", "nombre": "Mijn huis.pdf", "ruta": "privado/tareas/1/profe/x.pdf", "por": "Rida", "at": "x"}
    origen = SimpleNamespace(
        tema="Mijn huis", enunciado="Describe tu casa", fecha="2026-11-10", fecha_limite="2026-11-15",
        material_profe=json.dumps({"notas": "Empieza por las habitaciones", "archivos": [archivo], "profe": "Paul", "pizarra": {"fuente": "profe:a1"}}),
    )
    destino = SimpleNamespace(
        tema="Thuis", enunciado="", fecha="2026-11-12", fecha_limite="", updated_at="",
        material_profe=json.dumps({"notas": "", "archivos": [], "profe": "Luna", "mensaje": {"texto": "Ojo con la hora", "por": "Rida", "at": "x"}, "pizarra": {"fuente": "profe:zz"}}),
    )
    cambios = G.igualar(origen, destino, "ahora")
    assert set(cambios) == {"tema", "tarea", "plazo", "material"}
    assert destino.tema == "Mijn huis" and destino.enunciado == "Describe tu casa" and destino.fecha_limite == "2026-11-17"
    assert destino.fecha == "2026-11-12"
    m = MP.leer(destino.material_profe)
    assert m["notas"] == "Empieza por las habitaciones" and m["archivos"][0]["ruta"] == archivo["ruta"]
    # Lo del grupo no se toca: quién la da, el mensaje y su pizarra.
    assert m["profe"] == "Luna" and m["mensaje"]["texto"] == "Ojo con la hora" and m["pizarra"]["fuente"] == "profe:zz"
    # Repetirlo no cambia nada.
    assert G.igualar(origen, destino, "luego") == []

"""Organizar clases: las reglas puras (quién ve qué, familias, avisos)."""
from src.services.panel.organizar import avisos_de, familias, ve_la_clase


def test_ve_la_clase_con_las_reglas_de_la_lista_de_cursos():
    assert ve_la_clase(True, [3], []) is True  # pública: todo el mundo
    assert ve_la_clase(False, [], [7]) is True  # sin grupos: todo el que entra
    assert ve_la_clase(False, [3], [7]) is False
    assert ve_la_clase(False, [3, 4], [4]) is True


def test_las_copias_van_juntas_y_por_dia():
    f = familias(
        [
            {"uuid": "b", "base": "Clase semanal", "etiqueta": "Groep blauw", "dia": "4"},
            {"uuid": "r", "base": "Clase semanal", "etiqueta": "Groep rood", "dia": "2"},
            {"uuid": "s", "base": "Spreekclub", "etiqueta": "", "dia": ""},
        ]
    )
    assert [x["nombre"] for x in f] == ["Clase semanal", "Spreekclub"]
    assert [c["uuid"] for c in f[0]["clases"]] == ["r", "b"]


def test_avisos_del_alumno():
    assert avisos_de([]) == "No ve ninguna clase en directo"
    assert "dos veces" in avisos_de([{"base": "Clase semanal"}, {"base": "Clase semanal"}])
    assert avisos_de([{"base": "Clase semanal"}, {"base": "Spreekclub"}]) == ""

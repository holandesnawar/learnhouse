"""La tarea diaria del goteo dice cuáles son las próximas aperturas."""

from src.services.notifications.drip import proximas_aperturas


def test_solo_las_futuras_y_en_orden():
    fechas = {"c3": "2026-09-21", "c5": "2026-10-19T00:00:00", "c4": "2026-10-05", "c6": ""}
    nombres = {"c3": "Módulo 3", "c4": "Módulo 4", "c5": "Módulo 5"}
    assert proximas_aperturas(fechas, nombres, "2026-10-04") == [
        {"fecha": "2026-10-05", "modulo": "Módulo 4"},
        {"fecha": "2026-10-19", "modulo": "Módulo 5"},
    ]


def test_hoy_no_es_proximo_y_sin_nombre_sale_el_id():
    assert proximas_aperturas({"c4": "2026-10-05", "c9": "2026-11-01"}, {}, "2026-10-05") == [
        {"fecha": "2026-11-01", "modulo": "c9"}
    ]

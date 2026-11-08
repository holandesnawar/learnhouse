"""Una semana en la clase del otro grupo (08/11/2026)."""

from src.services.tareas.cambio_semana import leer_cambios, misma_semana


def test_leer_cambios_ignora_lo_raro():
    assert leer_cambios("") == {}
    assert leer_cambios("no-json") == {}
    assert leer_cambios('{"5": {"destino": 12}, "6": {"destino": "x"}, "7": 3}') == {"5": {"destino": 12}}


def test_misma_semana_del_calendario():
    assert misma_semana("2026-11-10", "2026-11-12")  # martes y jueves
    assert not misma_semana("2026-11-08", "2026-11-10")  # domingo y martes siguiente
    assert not misma_semana("", "2026-11-10")

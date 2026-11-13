"""Atascados (Progreso) e insignias de módulo (13/11/2026)."""
from datetime import date, datetime

from src.services.insignias.insignias import insignias_de, nombre_corto, nuevas
from src.services.panel.alumnos import atasco, toque_reciente

HOY = date(2026, 11, 13)


def test_atascado_a_las_dos_semanas_sin_terminar_una_clase():
    # Terminó una clase hace 13 días: aún no. Hace 14: sí.
    assert atasco("2026-09-10", "2026-10-31 10:00:00", 5, 40, HOY)["atascado"] is False
    a = atasco("2026-09-10", "2026-10-30 10:00:00", 5, 40, HOY)
    assert a["atascado"] is True and a["dias"] == 14 and a["sin_empezar"] is False


def test_quien_no_ha_empezado_cuenta_desde_que_entro():
    assert atasco("2026-11-05", "", 0, 40, HOY)["atascado"] is False  # entró hace 8 días
    a = atasco("2026-10-20", "", 0, 40, HOY)
    assert a["atascado"] is True and a["sin_empezar"] is True


def test_quien_termino_la_formacion_no_esta_atascado():
    assert atasco("2026-06-01", "2026-09-01", 40, 40, HOY)["atascado"] is False
    # Sin fechas legibles o sin curso, tampoco se inventa nada.
    assert atasco("", "", 0, 40, HOY)["atascado"] is False
    assert atasco("2026-06-01", "", 0, 0, HOY)["atascado"] is False


def test_si_ya_se_le_escribio_esta_semana_no_se_pide_otra_vez():
    assert toque_reciente({"sent_at": "2026-11-10T09:00:00+00:00"}, HOY) is True
    assert toque_reciente({"sent_at": "2026-11-06T09:00:00+00:00"}, HOY) is False
    assert toque_reciente(None, HOY) is False


MODULOS = [
    {"uuid": "intro", "nombre": "Introducción", "numero": None, "clases": [1, 2]},
    {"uuid": "m1", "nombre": "MODULE 1 - Over jou", "numero": 1, "clases": [10, 11, 12, 13, 14]},
    {"uuid": "m2", "nombre": "MODULE 2 - Familie & vrienden", "numero": 2, "clases": [20, 21]},
    {"uuid": "m5", "nombre": "MODULE 5 - Hobby's", "numero": 5, "clases": []},
]


def test_una_insignia_por_modulo_superado_con_la_regla_del_80():
    d = lambda dia: datetime(2026, 11, dia, 12, 0)  # noqa: E731
    hechas = {10: d(1), 11: d(2), 12: d(3), 13: d(9), 20: d(10)}
    ins = insignias_de(MODULOS, hechas)
    # La introducción no da insignia.
    assert [i["numero"] for i in ins] == [1, 2, 5]
    m1, m2, m5 = ins
    # 4 de 5 = 80 %: superado el día de la cuarta clase.
    assert m1["conseguida"] is True and m1["cuando"] == "2026-11-09T12:00:00Z"
    assert m1["nombre"] == "Over jou" and m1["hechas"] == 4 and m1["necesarias"] == 4
    # 1 de 2: aún no. Un módulo sin clases no se supera nunca.
    assert m2["conseguida"] is False and m2["cuando"] is None
    assert m5["conseguida"] is False


def test_nueva_es_la_de_hace_poco_que_no_ha_quitado():
    ins = insignias_de(MODULOS, {10: datetime(2026, 11, 1), 11: datetime(2026, 11, 1), 12: datetime(2026, 11, 1), 13: datetime(2026, 11, 9)})
    ahora = datetime(2026, 11, 13, 9, 0)
    assert [i["id"] for i in nuevas(ins, set(), ahora)] == ["insignia:m1"]
    assert nuevas(ins, {"insignia:m1"}, ahora) == []
    # Pasadas dos semanas, deja de anunciarse.
    assert nuevas(ins, set(), datetime(2026, 11, 30)) == []


def test_nombre_corto():
    assert nombre_corto("MODULE 1 - Over jou") == "Over jou"
    assert nombre_corto("Examen final") == "Examen final"

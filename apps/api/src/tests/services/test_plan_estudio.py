"""El plan de estudio del alumno (services/plan/plan.py): lo puro."""

from datetime import date, datetime

import pytest

from src.services.plan import plan as P

AHORA = datetime(2026, 11, 16, 12, 0)  # lunes


def _plan(**k):
    base = {"objetivo": "medico", "dias": [0, 2, 5], "hora": "20:00", "minutos": 15, "recordar": True}
    return P.leer({**base, **k})


def _nl(dia, h, m=0):
    return datetime(2026, 11, dia, h, m, tzinfo=P.ZONA)


def test_leer_lo_vacio_y_lo_raro():
    assert not P.rellenado(P.leer(""))
    assert not P.rellenado(P.leer(None))
    p = P.leer('{"objetivo": "inventado", "dias": [9, "2", 2], "hora": "25:99", "minutos": 7}')
    assert p["objetivo"] == "" and p["dias"] == [2] and p["hora"] == "20:00" and p["minutos"] == 15


def test_limpiar_pide_objetivo_y_dias():
    with pytest.raises(ValueError):
        P.limpiar({"objetivo": "", "dias": [1]}, {}, AHORA.astimezone())
    with pytest.raises(ValueError):
        P.limpiar({"objetivo": "medico", "dias": []}, {}, AHORA.astimezone())
    with pytest.raises(ValueError):
        P.limpiar({"objetivo": "otro", "dias": [1], "objetivo_texto": " "}, {}, AHORA.astimezone())
    p = P.limpiar({"objetivo": "medico", "dias": [1, 3], "hora": "7:5"}, {"avisos": ["2026-11-10"]}, AHORA.astimezone())
    assert p["hora"] == "07:05" and p["avisos"] == ["2026-11-10"] and p["guardado"]


def test_toca_solo_su_dia_pasada_su_hora_y_si_no_ha_entrado():
    p = _plan()
    assert not P.toca_recordar(p, _nl(16, 19, 59), False, "2026-11-15")  # antes de su hora
    assert P.toca_recordar(p, _nl(16, 20, 5), False, "2026-11-15")
    assert P.toca_recordar(p, _nl(16, 22, 59), False, "2026-11-15")
    assert not P.toca_recordar(p, _nl(16, 23, 0), False, "2026-11-15")  # fuera de la ventana
    assert not P.toca_recordar(p, _nl(17, 20, 5), False, "2026-11-15")  # martes: no lo eligió
    assert not P.toca_recordar(p, _nl(16, 20, 5), True, "2026-11-16")  # ya entró hoy
    assert not P.toca_recordar(_plan(recordar=False), _nl(16, 20, 5), False, "")


def test_uno_al_dia_y_se_calla_tras_tres_ignorados():
    assert not P.toca_recordar(_plan(avisos=["2026-11-16"]), _nl(16, 20, 5), False, "2026-11-01")
    tres = ["2026-11-09", "2026-11-11", "2026-11-14"]
    assert not P.toca_recordar(_plan(avisos=tres), _nl(16, 20, 5), False, "2026-11-08")
    # Volvió a entrar el 12: solo ha ignorado uno desde entonces.
    assert P.toca_recordar(_plan(avisos=tres), _nl(16, 20, 5), False, "2026-11-12")


def test_la_semana_cuenta_los_dias_que_entro():
    p = _plan()
    s = P.semana(p, ["2026-11-15", "2026-11-16"], date(2026, 11, 17))
    assert s["meta"] == 3 and s["hechos"] == 1 and not s["cumplida"] and s["proximo"] == "miércoles"
    s = P.semana(p, ["2026-11-16", "2026-11-17", "2026-11-18"], date(2026, 11, 18))
    assert s["cumplida"] and s["proximo"] == ""
    assert P.semana(p, [], date(2026, 11, 16))["hoy_toca"]


def test_textos():
    assert P.dias_en_texto([0, 2, 5]) == "lunes, miércoles y sábado"
    assert P.dias_en_texto([6]) == "domingo"
    assert P.nombre_objetivo(_plan()) == "El médico y la farmacia"
    assert P.nombre_objetivo(_plan(objetivo="otro", objetivo_texto="Hablar con mi suegra")) == "Hablar con mi suegra"


def test_para_conocerte_guarda_el_antes_y_no_lo_mueve():
    """«Para conocerte» (17/11/2026): opcional, y la fecha del «antes» se queda."""
    from datetime import datetime, timezone

    from src.services.plan import plan as P

    base = {"objetivo": "trabajo", "dias": [0, 2]}
    primero = P.limpiar(
        {**base, "de_donde": " Colombia ", "problema": "No entiendo cuando me hablan rápido", "en_4_meses": "Hablando con mi jefe"},
        P.leer(""),
        datetime(2026, 11, 17, 10, tzinfo=timezone.utc),
    )
    assert primero["de_donde"] == "Colombia"
    assert primero["conocerte_at"] == "2026-11-17"
    # Cambia sus respuestas un mes después: el «antes» no se mueve.
    luego = P.limpiar({**base, "problema": "Ya lo entiendo mejor"}, P.leer(primero), datetime(2026, 12, 17, tzinfo=timezone.utc))
    assert luego["conocerte_at"] == "2026-11-17"
    # Lo que no manda la pantalla no se borra.
    assert luego["de_donde"] == "Colombia" and luego["en_4_meses"] == "Hablando con mi jefe"
    # Sin contestar nada, no hay fecha.
    assert P.limpiar(base, P.leer(""), datetime(2026, 11, 17, tzinfo=timezone.utc))["conocerte_at"] == ""

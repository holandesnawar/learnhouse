"""Tareas «flotar» y «mover» (22/11/2026): el medidor de la semana."""

from datetime import datetime, timezone

from src.services.panel.tareas import balance_semana, tipo_ok

# Miércoles 25/11/2026 a mediodía en Países Bajos → la semana va del 23 al 29.
AHORA = datetime(2026, 11, 25, 11, 0, tzinfo=timezone.utc)


def _t(tipo, estado, done_at="", asignado_id=7):
    return {"tipo": tipo, "estado": estado, "done_at": done_at, "asignado_id": asignado_id}


def test_tipo_solo_flotar_o_mover():
    assert tipo_ok("Flotar") == "flotar"
    assert tipo_ok(" mover ") == "mover"
    assert tipo_ok("otro") == ""
    assert tipo_ok(None) == ""


def test_cuenta_las_hechas_esta_semana_y_las_pendientes_de_quien_mira():
    tareas = [
        _t("flotar", "hecha", "2026-11-23T08:00:00+00:00"),
        _t("flotar", "hecha", "2026-11-24T08:00:00+00:00"),
        _t("flotar", "hecha", "2026-11-25T08:00:00+00:00"),
        _t("mover", "hecha", "2026-11-25T09:00:00+00:00"),
        _t("mover", "hecha", "2026-11-22T21:00:00+00:00"),  # domingo anterior
        _t("mover", "pendiente"),
        _t("flotar", "pendiente"),
        _t("", "pendiente"),
        _t("mover", "hecha", "2026-11-24T08:00:00+00:00", asignado_id=8),  # de otro
    ]
    b = balance_semana(tareas, 7, AHORA)
    assert b["desde"] == "2026-11-23"
    assert b["hechas"] == {"flotar": 3, "mover": 1, "sin": 0}
    assert b["pendientes"] == {"flotar": 1, "mover": 1, "sin": 1}
    assert (b["flotar_pct"], b["mover_pct"]) == (75, 25)


def test_el_lunes_de_madrugada_en_nl_ya_es_la_semana_nueva():
    # 22/11 23:30 UTC = lunes 23/11 00:30 en Países Bajos.
    b = balance_semana([_t("mover", "hecha", "2026-11-22T23:30:00+00:00")], 7, AHORA)
    assert b["hechas"]["mover"] == 1


def test_sin_nada_hecho_no_divide_por_cero():
    b = balance_semana([], 7, AHORA)
    assert (b["flotar_pct"], b["mover_pct"]) == (0, 0)

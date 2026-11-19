"""Quién estuvo en la sala, contado por la escuela (19/11/2026,
services/salas/presencia.py)."""

from src.services.salas import presencia as PR


def test_cada_aviso_suma_lo_que_paso_sin_pasarse():
    assert PR.sumar(0, 1000) == 0  # el primero no suma
    assert PR.sumar(1000, 1060) == 60
    assert PR.sumar(1000, 1010) == 0  # dos pestañas a la vez: no cuenta doble
    assert PR.sumar(1000, 5000) == PR.SUMA_MAX  # se colgó o se fue: poco


def test_quien_dio_la_clase():
    luna = {"nombre": "Luna Zegers", "segundos": 3000, "rol": 5}
    rida = {"nombre": "Rida Nawar", "segundos": 3600, "rol": 1}
    corto = {"nombre": "Paul Plaat", "segundos": 120, "rol": 5}
    assert PR.quien_dio([rida, luna], "Paul") == "Luna Zegers"
    assert PR.quien_dio([rida, luna], "Rida") == "Rida Nawar"
    assert PR.quien_dio([corto, rida], "Paul") == "Rida Nawar"
    assert PR.quien_dio([], "Paul") == ""


def test_alumnos_dentro_solo_con_diez_minutos():
    filas = [
        {"user_id": 1, "segundos": 700, "equipo": False},
        {"user_id": 2, "segundos": 300, "equipo": False},
        {"user_id": 3, "segundos": 4000, "equipo": True},
    ]
    assert PR.alumnos_dentro(filas) == {"1"}
    assert [f["user_id"] for f in PR.equipo_dentro(filas)] == [3]
    assert PR.sabemos("2026-11-19") and not PR.sabemos("2026-11-18")

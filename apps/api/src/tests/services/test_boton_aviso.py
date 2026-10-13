"""El correo de novedades lleva siempre un botón a la escuela (13/10/2026)."""

from src.services.notifications.broadcast import BOTON_POR_DEFECTO, boton_del_aviso
from src.services.users.emails import ACADEMY_URL


def test_sin_boton_va_a_la_escuela():
    assert boton_del_aviso("", "") == (BOTON_POR_DEFECTO, ACADEMY_URL)
    assert boton_del_aviso("   ", None) == (BOTON_POR_DEFECTO, ACADEMY_URL)


def test_el_que_se_escribe_manda():
    assert boton_del_aviso("Abrir la formación", "https://x.com/course/1") == (
        "Abrir la formación",
        "https://x.com/course/1",
    )


def test_solo_el_texto_lleva_a_la_escuela():
    assert boton_del_aviso("Ver el Werkboek", "") == ("Ver el Werkboek", ACADEMY_URL)


def test_solo_la_direccion_lleva_el_texto_de_siempre():
    assert boton_del_aviso("", "https://x.com/eventos") == (BOTON_POR_DEFECTO, "https://x.com/eventos")

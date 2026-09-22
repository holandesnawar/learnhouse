"""Quién ve qué en el panel: la regla es una función pura."""

from src.services.orgs.acceso import puede_ver


def test_el_closer_ve_contactos_siempre_y_numeros_solo_si_se_lo_abren():
    assert puede_ver(6, "contactos", False) is True
    assert puede_ver(6, "numeros", False) is False
    assert puede_ver(6, "numeros", True) is True


def test_administrador_y_moderador_lo_ven_todo():
    for rol in (1, 2):
        assert puede_ver(rol, "contactos", False)
        assert puede_ver(rol, "numeros", False)


def test_el_profe_y_el_alumno_no_ven_nada_de_esto():
    for rol in (4, 5):
        assert puede_ver(rol, "contactos", True) is False
        assert puede_ver(rol, "numeros", True) is False


def test_sin_rol_en_la_escuela_no_se_ve_nada():
    assert puede_ver(None, "contactos", True) is False

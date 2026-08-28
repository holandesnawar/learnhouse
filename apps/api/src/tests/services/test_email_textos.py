"""
Los textos editables de los correos.

Lo que se comprueba aquí no es que la pantalla pinte bien: es que **no se pueda
tocar lo que no se debe**, y que un texto mal escrito por un administrador no
tumbe un envío. Los dos son invariantes de seguridad, no detalles.
"""

from src.services.email import textos as T


def test_los_correos_del_pago_no_son_editables():
    """El invariante más importante del módulo.

    La bienvenida tras el pago y el de la contraseña son la puerta de entrada de
    quien acaba de pagar. Si alguien pudiera reescribirlos desde el panel, un
    texto mal guardado no se vería en pruebas: se vería en el primer alumno.
    """
    prohibidas = {
        "payment_welcome",
        "password_reset",
        "account_creation",
        "invitation",
        "email_verification",
    }
    assert prohibidas.isdisjoint(T.CAMPOS.keys())


def test_las_claves_de_fuera_del_catalogo_se_tiran():
    """No basta con esconderlo en la pantalla: la puerta está en el servidor."""
    limpio = T.limpiar(
        {
            "payment_welcome.cuerpo": "intento de colarse",
            "password_reset.asunto": "otro intento",
            "module_unlocked.asunto": "esto sí vale",
            "module_unlocked.inventado": "campo que no existe",
        }
    )
    assert limpio == {"module_unlocked.asunto": "esto sí vale"}


def test_el_texto_propio_gana_al_de_codigo():
    con = {"module_unlocked.asunto": "Abierto: {modulo}"}
    with T.usar_textos(con):
        assert T.texto("module_unlocked", "asunto", modulo="Módulo 2") == "Abierto: Módulo 2"
    # Y al salir del bloque se vuelve al de siempre.
    assert T.texto("module_unlocked", "asunto", modulo="Módulo 2") == "Has desbloqueado Módulo 2"


def test_una_variable_mal_escrita_no_revienta_el_envio():
    """Se cae al texto de código. Un correo con el texto de fábrica es un
    problema pequeño; una excepción en mitad del envío, no."""
    with T.usar_textos({"module_unlocked.asunto": "Roto {no_existe}"}):
        salida = T.texto("module_unlocked", "asunto", modulo="Módulo 2")
    assert salida == "Has desbloqueado Módulo 2"


def test_lo_que_se_teclea_no_puede_meter_html():
    salida = T.parrafos('Hola <script>alert(1)</script>', "x")
    assert "<script>" not in salida
    assert "&lt;script&gt;" in salida


def test_las_lineas_en_blanco_separan_parrafos_y_los_asteriscos_ponen_negrita():
    salida = T.parrafos("Uno\n\nDos *fuerte*", "estilo")
    assert salida.count("<p ") == 2
    assert "<strong>fuerte</strong>" in salida


def test_todas_las_plantillas_declaran_asunto_y_pie():
    """Si una se queda sin asunto, el correo sale sin asunto y nadie lo abre."""
    for plantilla, campos in T.CAMPOS.items():
        assert "asunto" in campos, plantilla
        assert "pie" in campos, plantilla


def test_las_variables_declaradas_existen_en_el_texto_por_defecto():
    """El panel las enseña como "puedes usar {x}". Si el texto de fábrica usa
    una que no está declarada, el administrador la borra sin saber qué era."""
    import re

    for plantilla, campos in T.CAMPOS.items():
        for campo, ficha in campos.items():
            usadas = set(re.findall(r"\{(\w+)\}", ficha.por_defecto))
            declaradas = set(ficha.variables)
            assert usadas <= declaradas, f"{plantilla}.{campo}: falta declarar {usadas - declaradas}"

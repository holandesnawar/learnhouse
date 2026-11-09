"""@all y @nombre en la comunidad: en el chat y en los tablones (13/10/2026)."""

import json
from types import SimpleNamespace

from src.services.communities.engagement import mentions_user, texto_para_menciones


def _doc(texto: str) -> str:
    return json.dumps(
        {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}]}
    )


ALUMNA = SimpleNamespace(username="lucia_g", first_name="Lucía", last_name="Gómez")


def test_all_en_el_cuerpo():
    d = SimpleNamespace(title="Novedad", content=_doc("@all ya está el Werkboek"))
    assert mentions_user(texto_para_menciones(d), ALUMNA)


def test_all_en_el_titulo_de_un_tablon():
    """En un tablón el título va aparte: antes no se miraba y no avisaba."""
    d = SimpleNamespace(title="@all Nuevo: el Werkboek", content=_doc("Ya está en el Módulo 1"))
    assert mentions_user(texto_para_menciones(d), ALUMNA)


def test_todos_y_mayusculas():
    d = SimpleNamespace(title="", content=_doc("Hola @Todos"))
    assert mentions_user(texto_para_menciones(d), ALUMNA)


def test_sin_mencion_no_avisa():
    d = SimpleNamespace(title="Nuevo: el Werkboek", content=_doc("correo@ejemplo.com no es una mención para ella"))
    assert not mentions_user(texto_para_menciones(d), ALUMNA)


def test_por_nombre():
    d = SimpleNamespace(title="Pregunta", content=_doc("@lucía ¿lo has visto?"))
    assert mentions_user(texto_para_menciones(d), ALUMNA)


def test_la_marca_de_leido_se_compara_con_el_formato_de_los_mensajes():
    """09/11/2026: «leído» se guarda en UTC con «T» y zona; los mensajes, como
    str(datetime.now()). Comparados tal cual, un mensaje del mismo día nunca
    contaba como nuevo (el espacio va antes que la «T»)."""
    from datetime import datetime, timedelta

    from src.services.communities.engagement import como_fecha_de_mensaje

    ahora = datetime.now()
    marca = (ahora - timedelta(minutes=5)).astimezone().isoformat()
    convertida = como_fecha_de_mensaje(marca)
    assert "T" not in convertida
    assert str(ahora) > convertida  # un mensaje de ahora es nuevo
    assert str(ahora - timedelta(minutes=10)) < convertida  # uno de antes, leído
    assert como_fecha_de_mensaje("") == ""


def test_lo_de_antes_de_entrar_no_es_nuevo():
    from src.services.communities.engagement import antes_de_entrar, desde_cuando

    alta = "2026-11-09 10:00:00"
    # Nunca abrió el canal: cuenta desde que entró.
    assert desde_cuando("", alta) == alta
    # Lo abrió después de entrar: cuenta desde la lectura.
    assert desde_cuando("2026-11-09T12:00:00", alta) > alta
    # Sin fecha de alta, como antes.
    assert desde_cuando("", "") == ""
    assert antes_de_entrar("2026-10-13 09:00:00.12", alta)
    assert antes_de_entrar("2026-10-20T18:00:00", alta)
    assert not antes_de_entrar("2026-11-09 11:00:00", alta)
    assert not antes_de_entrar("2026-10-13 09:00:00", "")

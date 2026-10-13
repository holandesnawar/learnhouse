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

"""El material del profe de cada semana (09/11/2026)."""

import pytest

from src.services.tareas import material_profe as MP
from src.services.tareas.tareas import TareaError


def test_leer_aguanta_lo_roto():
    assert MP.leer("") == {"notas": "", "archivos": [], "profe": "", "mensaje": None}
    assert MP.leer("{no es json") == {"notas": "", "archivos": [], "profe": "", "mensaje": None}
    assert MP.leer('{"notas": "hola", "archivos": [{"id": "a"}, "x"]}')["archivos"] == [{"id": "a"}]


def test_enlace_y_notas():
    m = MP.con_notas(MP.leer(""), "  Empieza con el vídeo  ")
    m = MP.con_enlace(m, "", "https://docs.google.com/x", "Ana")
    assert m["notas"] == "Empieza con el vídeo"
    assert m["archivos"][0]["nombre"] == "Presentación completa"
    with pytest.raises(TareaError):
        MP.con_enlace(m, "x", "docs.google.com/x", "Ana")


def test_la_pantalla_no_ve_la_ruta():
    m = MP.con_archivo(MP.leer(""), "clase.pptx", "privado/tareas/1/profe/a.pptx", 10, "Ana")
    assert "ruta" not in MP.para_la_pantalla(m)["archivos"][0]


def test_quitar_solo_quien_lo_subio_o_admin():
    m = MP.con_enlace(MP.leer(""), "x", "https://a.b", "Ana")
    aid = m["archivos"][0]["id"]
    with pytest.raises(TareaError):
        MP.sin(m, aid, "Tom", admin=False)
    m2, _ = MP.sin(m, aid, "Tom", admin=True)
    assert m2["archivos"] == []
    m3, _ = MP.sin(m, aid, "Ana", admin=False)
    assert m3["archivos"] == []


def test_tipo_de_archivo(tmp_path, monkeypatch):
    with pytest.raises(TareaError):
        MP.guardar_archivo(1, "virus.exe", b"x")
    monkeypatch.setattr(MP, "CONTENT_DIR", tmp_path)
    rel, ext = MP.guardar_archivo(1, "Clase 5.PPTX", b"datos")
    assert ext == ".pptx" and rel.startswith("privado/tareas/1/profe/")
    assert (tmp_path / rel).read_bytes() == b"datos"


def test_quien_da_la_semana_y_el_mensaje_del_administrador():
    from src.services.tareas import material_profe as MP

    m = MP.leer("")
    assert m["profe"] == "" and m["mensaje"] is None
    m = MP.con_profe(m, "  Luna   Zegers ")
    assert m["profe"] == "Luna Zegers"

    m = MP.con_mensaje(m, "Repasa el vocabulario de la ropa al principio", "Rida")
    assert m["mensaje"]["texto"].startswith("Repasa") and m["mensaje"]["por"] == "Rida" and m["mensaje"]["leido_por"] == ""
    m = MP.leido(m, "Luna Zegers")
    assert m["mensaje"]["leido_por"] == "Luna Zegers" and m["mensaje"]["leido_at"]
    # El mismo texto no lo vuelve a dejar sin leer; uno nuevo, sí.
    assert MP.con_mensaje(m, "Repasa el vocabulario de la ropa al principio", "Rida")["mensaje"]["leido_por"] == "Luna Zegers"
    m2 = MP.con_mensaje(m, "Cambio: empieza por los colores", "Rida")
    assert m2["mensaje"]["leido_por"] == ""
    # Vacío lo quita.
    assert MP.con_mensaje(m2, "  ", "Rida")["mensaje"] is None
    # Se guarda y se vuelve a leer igual, y la pantalla lo recibe.
    import json

    vuelta = MP.leer(json.dumps(m2))
    assert vuelta["profe"] == "Luna Zegers" and vuelta["mensaje"]["texto"].startswith("Cambio")
    assert MP.para_la_pantalla(vuelta)["mensaje"]["por"] == "Rida"
    with pytest.raises(MP.TareaError):
        MP.leido(MP.leer(""), "Luna")

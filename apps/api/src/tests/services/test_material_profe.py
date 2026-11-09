"""El material del profe de cada semana (09/11/2026)."""

import pytest

from src.services.tareas import material_profe as MP
from src.services.tareas.tareas import TareaError


def test_leer_aguanta_lo_roto():
    assert MP.leer("") == {"notas": "", "archivos": []}
    assert MP.leer("{no es json") == {"notas": "", "archivos": []}
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

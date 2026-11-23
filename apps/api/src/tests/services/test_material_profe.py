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


def test_el_mensaje_es_para_quien_da_la_clase():
    assert MP.es_para("Paul y Luna", "Luna")
    assert MP.es_para("Paul", "Paúl Plaat")
    assert not MP.es_para("Paul", "Luna")
    assert not MP.es_para("", "Luna")
    assert not MP.es_para("Paul", "")


def test_al_asignar_una_clase_se_apunta_cuando():
    """23/11/2026: la campana avisa al profe cuando le asignan una clase."""
    m = MP.con_profe(MP.leer(""), "  Luna   Zegers ", "Rida Nawar")
    assert m["profe"] == "Luna Zegers" and m["profe_at"] and m["profe_por"] == "Rida Nawar"
    # Lo guardado se lee igual, y guardar el MISMO nombre no avisa otra vez.
    import json

    leido = MP.leer(json.dumps(m))
    assert leido["profe_at"] == m["profe_at"]
    otra = MP.con_profe({**leido, "profe_at": "2026-11-01T10:00:00+00:00"}, "luna zegers", "Rida Nawar")
    assert otra["profe_at"] == "2026-11-01T10:00:00+00:00"
    # Cambiar de persona, sí; quitarla, borra la marca.
    assert MP.con_profe(otra, "Paul", "Rida")["profe_at"] != "2026-11-01T10:00:00+00:00"
    vacia = MP.con_profe(otra, "", "Rida")
    assert vacia["profe"] == "" and "profe_at" not in vacia
    assert "profe_at" not in MP.leer(json.dumps(vacia))


def test_los_avisos_de_asignacion_van_uno_por_clase():
    una = MP.agrupar_asignaciones(
        [{"semana_id": 7, "curso": "Masterclass", "fecha": "2026-11-26", "tema": "De tijd", "at": "2026-11-23T09:00:00+00:00"}]
    )
    assert una == [
        {
            "id": "clase-asignada:7:2026-11-23T09:00:00+00:00",
            "kind": "clase",
            "title": "Te han asignado: Masterclass",
            "excerpt": "jueves 26 nov · De tijd",
            "url": "/equipo?vista=calendario",
            "date": "2026-11-23T09:00:00+00:00",
        }
    ]
    # Ocho fechas seguidas de la misma clase: una línea, no ocho.
    varias = MP.agrupar_asignaciones(
        [
            {"semana_id": 9, "curso": "Spreekclub", "fecha": "2026-12-04", "tema": "", "at": "2026-11-23T09:00:01+00:00"},
            {"semana_id": 8, "curso": "Spreekclub", "fecha": "2026-11-27", "tema": "", "at": "2026-11-23T09:00:00+00:00"},
            {"semana_id": 7, "curso": "Masterclass", "fecha": "2026-11-26", "tema": "", "at": "2026-11-22T09:00:00+00:00"},
        ]
    )
    assert [a["title"] for a in varias] == ["Te han asignado: Spreekclub", "Te han asignado: Masterclass"]
    assert varias[0]["excerpt"] == "2 fechas; la primera, el viernes 27 nov"
    assert varias[1]["excerpt"] == "jueves 26 nov"

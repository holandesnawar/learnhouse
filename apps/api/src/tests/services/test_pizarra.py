"""La pizarra de clase (10/11/2026): lo que no necesita base de datos."""

import json

import pytest

from src.services.tareas import material_profe as MP
from src.services.tareas import pizarra as PZ
from src.services.tareas import tareas as T


def test_la_pizarra_no_se_pierde_al_guardar_otra_cosa_del_material():
    guardado = json.dumps({"notas": "hola", "archivos": [], "pizarra": {"fuente": "profe:abc", "anotaciones": "x.json"}})
    m = MP.con_notas(MP.leer(guardado), "otras notas")
    assert m["pizarra"]["fuente"] == "profe:abc"
    # A la pantalla solo le llega el resumen, nunca rutas del disco.
    assert MP.para_la_pantalla(m)["pizarra"] == {"guardada_at": "", "publicada_at": "", "paginas": 0}


def test_sin_pizarra_el_material_sale_como_siempre():
    assert "pizarra" not in MP.leer('{"notas": "x"}')
    assert MP.para_la_pantalla(MP.leer(""))["pizarra"] is None


def test_las_fuentes_son_los_pdf_del_profe_y_la_presentacion_de_los_alumnos():
    material = {"archivos": [
        {"id": "a1", "tipo": "archivo", "nombre": "Mijn huis.pdf", "ruta": "privado/tareas/1/profe/x.pdf"},
        {"id": "a2", "tipo": "archivo", "nombre": "Mijn huis.pptx", "ruta": "privado/tareas/1/profe/y.pptx"},
        {"id": "a3", "tipo": "enlace", "nombre": "Canva", "url": "https://canva.com/x"},
    ]}
    clases = [{"tipo": "presentacion", "activity_uuid": "activity_1", "nombre": "Presentación"}, {"tipo": "grabacion", "activity_uuid": "activity_2", "nombre": "Grabación"}]
    f = PZ.fuentes(material, clases)
    assert [x["id"] for x in f] == ["profe:a1", "clase:activity_1"]
    assert PZ.fuente_valida("clase:activity_1", f) == "clase:activity_1"
    assert PZ.fuente_valida("profe:borrada", f) == "profe:a1"
    assert PZ.fuente_valida("", []) == ""


def test_lo_escrito_se_limpia_antes_de_guardarlo():
    doc = PZ.limpiar_anotaciones({"paginas": [{"origen": 1, "trazos": [{"t": "lapiz", "p": [0, 0]}, "roto"]}, {"origen": None, "oculta": 1, "titulo": "Notas"}, "roto"]})
    assert doc == {"v": 1, "paginas": [
        {"origen": 1, "oculta": False, "titulo": "", "trazos": [{"t": "lapiz", "p": [0, 0]}]},
        {"origen": None, "oculta": True, "titulo": "Notas", "trazos": []},
    ]}
    with pytest.raises(T.TareaError):
        PZ.limpiar_anotaciones({"otra": "cosa"})


def test_guardar_escribir_publicar_y_quitar(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.leer({})
    p = PZ.guardar_anotaciones(7, p, "profe:a1", {"paginas": [{"origen": 1, "trazos": []}]}, "Paul", "2026-11-10T18:00:00+00:00")
    assert p["anotaciones"].startswith("privado/tareas/7/pizarra/") and p["guardada_por"] == "Paul"
    assert PZ.leer_anotaciones(p)["paginas"][0]["origen"] == 1
    # Guardar otra vez escribe en el MISMO archivo.
    p2 = PZ.guardar_anotaciones(7, p, "profe:a1", {"paginas": []}, "Paul", "2026-11-10T18:05:00+00:00")
    assert p2["anotaciones"] == p["anotaciones"]

    with pytest.raises(T.TareaError):
        PZ.publicar(7, p2, b"esto no es un pdf", 3, "Paul", "ahora")
    pdf = b"%PDF-1.4\n" + b"x" * 50 + b"\n%%EOF\n"
    p3 = PZ.publicar(7, p2, pdf, 3, "Paul", "2026-11-10T19:00:00+00:00")
    primero = PZ.pdf_publicado(p3)
    assert primero is not None and primero.read_bytes() == pdf
    assert PZ.publicada_para_la_pantalla(p3) == {"at": "2026-11-10T19:00:00+00:00", "por": "Paul", "paginas": 3, "tam": len(pdf)}
    # Volver a publicar sustituye: el archivo viejo se borra.
    p4 = PZ.publicar(7, p3, pdf + b"\n%%EOF", 4, "Paul", "2026-11-10T19:30:00+00:00")
    assert not primero.exists() and PZ.pdf_publicado(p4) is not None
    p5 = PZ.quitar_publicada(p4)
    assert p5["publicada"] is None and PZ.pdf_publicado(p5) is None
    # Y lo escrito sigue ahí.
    assert PZ.leer_anotaciones(p5) is not None

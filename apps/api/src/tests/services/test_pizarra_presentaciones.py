"""Cada presentación, sus notas (22/11/2026): lo que no necesita base de datos.

El caso del usuario: «un profe subió una presentación que no era en pizarra y
tomó notas ahí; ahora cómo se saca esa, dónde está, cómo metemos la que sí es».
"""

import json

import pytest

from src.services.tareas import material_profe as MP
from src.services.tareas import pizarra as PZ
from src.services.tareas import tareas as T

TRAZO = {"t": "lapiz", "p": [0.1, 0.1, 0.2, 0.2]}
OTRO = {"t": "texto", "texto": "ojo", "x": 0.5, "y": 0.5}


def _material(**pizarra):
    return {
        "archivos": [
            {"id": "buena", "tipo": "archivo", "nombre": "Mijn huis.pdf", "ruta": "privado/tareas/1/profe/b.pdf", "por": "Rida", "at": "2026-11-18T10:00:00+00:00", "tam": 100},
            {"id": "mala", "tipo": "archivo", "nombre": "equivocada.pdf", "ruta": "privado/tareas/1/profe/m.pdf", "por": "Luna", "at": "2026-11-23T18:31:00+00:00", "tam": 50},
            {"id": "ppt", "tipo": "archivo", "nombre": "Mijn huis.pptx", "ruta": "privado/tareas/1/profe/p.pptx"},
        ],
        "pizarra": pizarra,
    }


CLASES = [{"tipo": "presentacion", "activity_uuid": "activity_1", "nombre": "Presentación", "creada": "2026-11-18 09:00:00"}]


def test_lo_guardado_antes_se_lee_como_las_notas_de_su_presentacion():
    # Así está hoy en producción: un solo juego de notas y de qué documento era.
    viejo = {"fuente": "profe:buena", "anotaciones": "privado/tareas/1/pizarra/x.json", "guardada_at": "2026-11-18T02:25:51+00:00", "guardada_por": "Paul"}
    p = PZ.leer({"pizarra": viejo})
    assert p["notas"] == {
        "profe:buena": {
            "ruta": "privado/tareas/1/pizarra/x.json", "at": "2026-11-18T02:25:51+00:00", "por": "Paul", "paginas": None, "algo": True, "nombre": "",
            "sesion": "", "cambio": "2026-11-18T02:25:51+00:00",
        }
    }
    # Lo que leía el código de antes sigue igual.
    assert p["anotaciones"] == "privado/tareas/1/pizarra/x.json" and p["guardada_por"] == "Paul"
    lista = PZ.lista(_material(**viejo), CLASES)
    buena = lista["presentaciones"][0]
    assert buena["id"] == "profe:buena" and buena["en_pizarra"] and buena["notas"] == {"at": "2026-11-18T02:25:51+00:00", "por": "Paul", "paginas": None}
    assert lista["sueltas"] == []
    # Y el resumen de la sala de profes dice que hay algo escrito.
    assert MP.para_la_pantalla(MP.leer(json.dumps({"pizarra": viejo})))["pizarra"]["guardada_at"] == "2026-11-18T02:25:51+00:00"


def test_notas_viejas_de_un_documento_que_ya_no_esta_quedan_sueltas():
    viejo = {"fuente": "profe:borrada", "anotaciones": "privado/tareas/1/pizarra/x.json", "guardada_at": "2026-11-12T10:00:00+00:00", "guardada_por": "Paul"}
    lista = PZ.lista(_material(**viejo), CLASES)
    assert [x["id"] for x in lista["sueltas"]] == ["profe:borrada"]
    # La pizarra abre la primera del equipo, sin notas de otra pegadas.
    assert lista["fuente"] == "profe:buena" and lista["presentaciones"][0]["notas"] is None


def test_cada_presentacion_guarda_sus_notas(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.leer({})
    p = PZ.guardar_anotaciones(1, p, "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}, {"origen": 2, "trazos": []}, {"origen": None, "trazos": [OTRO]}]}, "Luna", "2026-11-23T18:36:00+00:00", "equivocada.pdf")
    # La primera en la que se escribe pasa a ser la de la pizarra.
    assert p["fuente"] == "profe:mala" and p["notas"]["profe:mala"]["paginas"] == 2
    p = PZ.guardar_anotaciones(1, p, "profe:buena", {"paginas": [{"origen": 3, "trazos": [TRAZO]}]}, "Rida", "2026-11-23T19:00:00+00:00", "Mijn huis.pdf")
    # Escribir en otra no pisa la primera ni cambia cuál es la de la pizarra.
    assert p["fuente"] == "profe:mala"
    assert PZ.leer_anotaciones(p, "profe:mala")["paginas"][0]["trazos"] == [TRAZO]
    assert PZ.leer_anotaciones(p, "profe:buena")["paginas"][0]["origen"] == 3
    assert p["notas"]["profe:mala"]["ruta"] != p["notas"]["profe:buena"]["ruta"]
    # Lo que se guarda en la base de datos se vuelve a leer igual.
    otra_vez = PZ.leer({"pizarra": json.loads(json.dumps(p))})
    assert otra_vez["notas"] == p["notas"] and otra_vez["fuente"] == "profe:mala"

    lista = PZ.lista(_material(**p), CLASES)
    assert [(x["id"], x["en_pizarra"], bool(x["notas"])) for x in lista["presentaciones"]] == [
        ("profe:mala", True, True),
        ("profe:buena", False, True),
        ("clase:activity_1", False, False),
    ]
    assert lista["presentaciones"][0]["de"] == "equipo" and lista["presentaciones"][2]["de"] == "alumnos"
    assert lista["presentaciones"][0]["notas"] == {"at": "2026-11-23T18:36:00+00:00", "por": "Luna", "paginas": 2}
    # A la pantalla nunca le llegan rutas del disco.
    assert "ruta" not in json.dumps(lista)


def test_pasar_las_notas_a_la_buena_las_junta_y_no_pierde_nada(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.leer({})
    p = PZ.guardar_anotaciones(1, p, "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}, {"origen": 9, "trazos": [OTRO]}, {"origen": None, "titulo": "Notas", "trazos": [OTRO]}]}, "Luna", "t1", "equivocada.pdf")
    p = PZ.guardar_anotaciones(1, p, "profe:buena", {"paginas": [{"origen": 1, "trazos": [OTRO]}, {"origen": 2, "trazos": []}]}, "Rida", "t2", "Mijn huis.pdf")
    archivo_malo = PZ.ruta_segura(p["notas"]["profe:mala"]["ruta"])
    p2, paso = PZ.pasar(1, p, "profe:mala", "profe:buena", "Rida", "t3", "Mijn huis.pdf")
    assert paso and "profe:mala" not in p2["notas"]
    # Era la de la pizarra: ahora lo es la buena.
    assert p2["fuente"] == "profe:buena"
    doc = PZ.leer_anotaciones(p2, "profe:buena")
    por_origen = {pg["origen"]: pg for pg in doc["paginas"] if pg["origen"] is not None}
    # Misma página: se suman los trazos (primero los que ya tenía).
    assert por_origen[1]["trazos"] == [OTRO, TRAZO]
    # Una página que la buena no tenía apuntada, y la página en blanco, al final.
    assert por_origen[9]["trazos"] == [OTRO]
    assert doc["paginas"][-1] == {"origen": None, "oculta": False, "titulo": "Notas", "trazos": [OTRO]}
    # Siguen siendo de quien las escribió (Luna), no de quien las pasó, y de la última vez que se escribió.
    assert p2["notas"]["profe:buena"]["paginas"] == 3 and p2["notas"]["profe:buena"]["at"] == "t2" and p2["notas"]["profe:buena"]["por"] == "Luna"
    # El archivo del origen ya está dentro del destino.
    assert archivo_malo is not None and not archivo_malo.exists()

    # Pasar desde una que no tiene notas no rompe nada (cambiar el PDF de los
    # alumnos sin haber escrito): solo cambia cuál es la de la pizarra.
    p3 = PZ.con_fuente(p2, "clase:vieja")
    p4, paso = PZ.pasar(1, p3, "clase:vieja", "clase:nueva", "Rida", "t4")
    assert not paso and p4["fuente"] == "clase:nueva" and p4["notas"] == p3["notas"]
    with pytest.raises(T.TareaError):
        PZ.pasar(1, p2, "profe:buena", "profe:buena", "Rida", "t5")


def test_quitar_una_presentacion_con_notas_las_deja_sueltas_y_se_pueden_pasar(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Luna", "t1", "equivocada.pdf")
    m = _material(**p)
    m["archivos"] = [a for a in m["archivos"] if a["id"] != "mala"]
    lista = PZ.lista(m, CLASES)
    assert lista["sueltas"] == [{"id": "profe:mala", "nombre": "equivocada.pdf", "at": "t1", "por": "Luna", "paginas": 1}]
    # La pizarra ya no puede abrir la que se quitó: abre la primera del equipo.
    assert lista["fuente"] == "profe:buena"
    p2, paso = PZ.pasar(1, p, "profe:mala", "profe:buena", "Rida", "t2", "Mijn huis.pdf")
    assert paso and PZ.lista({**m, "pizarra": p2}, CLASES)["sueltas"] == []
    assert PZ.leer_anotaciones(p2, "profe:buena")["paginas"][0]["trazos"] == [TRAZO]


def test_borrar_las_notas_de_una_no_toca_las_de_otra(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Luna", "t1")
    p = PZ.guardar_anotaciones(1, p, "profe:buena", {"paginas": [{"origen": 1, "trazos": [OTRO]}]}, "Rida", "t2")
    ruta = PZ.ruta_segura(p["notas"]["profe:mala"]["ruta"])
    p2 = PZ.borrar_notas(p, "profe:mala")
    assert ruta is not None and not ruta.exists()
    assert PZ.leer_anotaciones(p2, "profe:buena") is not None and PZ.leer_anotaciones(p2, "profe:mala") is None
    with pytest.raises(T.TareaError):
        PZ.borrar_notas(p2, "profe:mala")


def test_la_version_de_los_alumnos_dice_de_que_presentacion_salio(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    pdf = b"%PDF-1.4\n" + b"x" * 50 + b"\n%%EOF\n"
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "profe:buena", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Rida", "t1")
    p = PZ.publicar(1, p, pdf, 4, "Rida", "t2", "profe:buena", "Mijn huis.pdf")
    lista = PZ.lista(_material(**p), CLASES)
    assert lista["presentaciones"][0]["publicada"] == {"at": "t2", "por": "Rida", "paginas": 4}
    assert lista["presentaciones"][1]["publicada"] is None
    assert lista["publicada"] == {"at": "t2", "por": "Rida", "paginas": 4, "tam": len(pdf), "fuente": "profe:buena", "nombre": "Mijn huis.pdf"}
    # Lo publicado antes del 22/11 no decía de cuál: era la de la pizarra de entonces.
    viejo = {"fuente": "profe:buena", "anotaciones": "x.json", "publicada": {"ruta": "y.pdf", "at": "t0", "por": "Paul", "paginas": 13, "tam": 9}}
    assert PZ.lista(_material(**viejo), CLASES)["presentaciones"][0]["publicada"] == {"at": "t0", "por": "Paul", "paginas": 13}


def test_la_pizarra_en_blanco_siempre_se_puede_abrir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert PZ.existe("blanco", []) and not PZ.existe("profe:x", [])
    # Una clase sin ningún PDF: la lista sale vacía hasta que se escribe.
    assert PZ.lista({}, []) == {"presentaciones": [], "sueltas": [], "fuente": "", "publicada": None}
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "blanco", {"paginas": [{"origen": None, "trazos": [TRAZO]}]}, "Tom", "t1", "Pizarra en blanco")
    lista = PZ.lista({"pizarra": p}, [])
    assert lista["fuente"] == "blanco"
    assert lista["presentaciones"] == [
        {"id": "blanco", "de": "blanco", "nombre": "Pizarra en blanco", "por": "", "at": "", "tam": 0, "en_pizarra": True, "notas": {"at": "t1", "por": "Tom", "paginas": 1}, "publicada": None}
    ]


def test_guardar_sin_nada_escrito_no_cuenta_como_notas(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "profe:buena", {"paginas": [{"origen": 1, "trazos": []}, {"origen": 2, "trazos": []}]}, "Rida", "t1")
    assert PZ.lista(_material(**p), CLASES)["presentaciones"][0]["notas"] is None
    assert PZ.ultima_escritura(p) == ""
    # Una página escondida o una en blanco sí son trabajo que conservar.
    p = PZ.guardar_anotaciones(1, p, "profe:buena", {"paginas": [{"origen": 1, "oculta": True, "trazos": []}]}, "Rida", "t2")
    assert PZ.lista(_material(**p), CLASES)["presentaciones"][0]["notas"] == {"at": "t2", "por": "Rida", "paginas": 0}


def test_cambiar_el_archivo_conserva_el_id_y_el_nombre_se_puede_cambiar():
    m = MP.leer(json.dumps(_material()))
    m2, vieja = MP.con_archivo_cambiado(m, "buena", "privado/tareas/1/profe/nuevo.pdf", 999, "Rida")
    a = next(x for x in m2["archivos"] if x["id"] == "buena")
    assert vieja == "privado/tareas/1/profe/b.pdf" and a["ruta"].endswith("nuevo.pdf") and a["tam"] == 999 and a["nombre"] == "Mijn huis.pdf"
    assert a["por"] == "Rida" and a["cambiado_por"] == "Rida"
    # Un PDF por un PDF: si no, dejaría de ser una presentación.
    with pytest.raises(T.TareaError):
        MP.con_archivo_cambiado(m, "buena", "privado/tareas/1/profe/nuevo.pptx", 1, "Rida")
    with pytest.raises(T.TareaError):
        MP.con_archivo_cambiado(m, "no-esta", "privado/tareas/1/profe/nuevo.pdf", 1, "Rida")
    m3 = MP.con_nombre(m, "mala", "  Mijn huis ·  versión vieja  ")
    # La extensión se conserva: por ella saben las listas que es un PDF.
    assert next(x for x in m3["archivos"] if x["id"] == "mala")["nombre"] == "Mijn huis · versión vieja.pdf"
    with pytest.raises(T.TareaError):
        MP.con_nombre(m, "mala", "   ")


def test_subir_un_pdf_a_una_clase_con_la_pizarra_en_blanco_lo_pone_en_la_pizarra(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    # El monitor apuntó en la pizarra en blanco; luego se sube la presentación.
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "blanco", {"paginas": [{"origen": None, "trazos": [TRAZO]}]}, "Tom", "t1")
    assert p["fuente"] == "blanco"
    m = {"archivos": [{"id": "a1", "tipo": "archivo", "nombre": "Lego.pdf", "ruta": "privado/tareas/1/profe/a.pdf"}], "pizarra": p}
    m2 = PZ.tras_subir(m, "a1")
    lista = PZ.lista(m2, [])
    assert lista["fuente"] == "profe:a1"
    # Las notas de la pizarra en blanco siguen ahí, en su fila.
    assert [(x["id"], bool(x["notas"])) for x in lista["presentaciones"]] == [("profe:a1", False), ("blanco", True)]
    # Con una presentación ya elegida, subir otra no la cambia.
    m3 = {"archivos": [*m2["archivos"], {"id": "a2", "tipo": "archivo", "nombre": "Otra.pdf", "ruta": "privado/tareas/1/profe/b.pdf"}], "pizarra": m2["pizarra"]}
    assert PZ.lista(PZ.tras_subir(m3, "a2"), [])["fuente"] == "profe:a1"
    # Un PowerPoint no es una presentación de la pizarra.
    m4 = {"archivos": [{"id": "p1", "tipo": "archivo", "nombre": "x.pptx", "ruta": "privado/tareas/1/profe/x.pptx"}], "pizarra": p}
    assert PZ.tras_subir(m4, "p1") is m4
    # Sin pizarra todavía no se inventa nada: ya abre la primera del equipo.
    m5 = {"archivos": [{"id": "a1", "tipo": "archivo", "nombre": "Lego.pdf", "ruta": "privado/tareas/1/profe/a.pdf"}]}
    assert PZ.tras_subir(m5, "a1") is m5 and PZ.lista(m5, [])["fuente"] == "profe:a1"


def test_dos_pizarras_abiertas_en_la_misma_presentacion_no_se_pisan_en_silencio(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    doc = {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}
    p = PZ.leer({})
    # La pestaña A la abre sin notas (base "") y guarda.
    assert PZ.choque(p, "profe:buena", "", "pestana-a") is None
    p = PZ.guardar_anotaciones(1, p, "profe:buena", doc, "Luna", "2026-11-23T18:36:00+00:00", "Mijn huis.pdf", "pestana-a")
    rev_a = p["notas"]["profe:buena"]["cambio"]
    # A sigue guardando: nunca choca consigo misma, aunque se le perdiera una respuesta.
    assert PZ.choque(p, "profe:buena", "", "pestana-a") is None
    # La pestaña B la tenía abierta desde antes (base ""): al ir a guardar, se entera.
    otra = PZ.choque(p, "profe:buena", "", "pestana-b")
    assert otra == {"por": "Luna", "at": "2026-11-23T18:36:00+00:00"}
    # Si B recarga (ya tiene la revisión de A), puede guardar.
    assert PZ.choque(p, "profe:buena", rev_a, "pestana-b") is None
    # Una pantalla de antes del cambio (sin base ni sesión) no avisa de nada.
    assert PZ.choque(p, "profe:buena", None, "") is None
    # En otra presentación no hay choque.
    assert PZ.choque(p, "profe:mala", "", "pestana-b") is None


def test_pasar_notas_a_una_presentacion_avisa_a_quien_la_tiene_abierta(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    doc = {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}
    p = PZ.guardar_anotaciones(1, PZ.leer({}), "profe:buena", doc, "Rida", "2026-11-23T18:40:00+00:00", "Mijn huis.pdf", "pestana-a")
    p = PZ.guardar_anotaciones(1, p, "profe:mala", doc, "Luna", "2026-11-23T18:30:00+00:00", "equivocada.pdf", "pestana-c")
    rev = p["notas"]["profe:buena"]["cambio"]
    # Alguien pasa a la buena unas notas MÁS VIEJAS que las suyas: la fecha de
    # quién escribió no cambia, pero el archivo sí, y la pestaña A se entera.
    p, paso = PZ.pasar(1, p, "profe:mala", "profe:buena", "admin", "2026-11-23T19:00:00+00:00", "Mijn huis.pdf")
    assert paso and p["notas"]["profe:buena"]["at"] == "2026-11-23T18:40:00+00:00"
    assert PZ.choque(p, "profe:buena", rev, "pestana-a") is not None


def test_la_presentacion_de_los_alumnos_tiene_nombre_para_el_equipo():
    # La clase del curso se llama siempre «Presentación»: no dice nada.
    lista = PZ.lista(_material(), CLASES)
    alumnos = next(x for x in lista["presentaciones"] if x["de"] == "alumnos")
    assert alumnos["nombre"] == "Presentación de los alumnos"
    # Si se renombró en el editor del curso, ese nombre.
    otra = [{**CLASES[0], "nombre": "Dossier Mijn huis"}]
    assert next(x for x in PZ.lista(_material(), otra)["presentaciones"] if x["de"] == "alumnos")["nombre"] == "Dossier Mijn huis"
    # Y el que le ponga el equipo (el del archivo, al subirla) manda; el alumno no lo ve.
    p = PZ.con_nombre(PZ.leer({}), "clase:activity_1", "  Mijn huis · para antes.pdf ")
    lista = PZ.lista(_material(**p), CLASES)
    assert next(x for x in lista["presentaciones"] if x["de"] == "alumnos")["nombre"] == "Mijn huis · para antes.pdf"
    assert PZ.leer(_material(**p))["nombres"] == {"clase:activity_1": "Mijn huis · para antes.pdf"}
    # Con el nombre vacío vuelve al de serie.
    p = PZ.con_nombre(p, "clase:activity_1", "")
    assert PZ.leer(_material(**p))["nombres"] == {}


# ── Pasar una presentación a otra sesión de la misma clase (22/11/2026) ─────


def _disco(tmp_path, monkeypatch):
    monkeypatch.setattr(PZ, "CONTENT_DIR", tmp_path)
    monkeypatch.setattr(T, "CONTENT_DIR", tmp_path)


def test_pasar_una_presentacion_con_sus_notas_a_otra_sesion(tmp_path, monkeypatch):
    # «Se subió en la sesión que no era»: el archivo y lo escrito pasan a la buena.
    _disco(tmp_path, monkeypatch)
    origen = MP.leer(json.dumps(_material()))
    p = PZ.guardar_anotaciones(1, PZ.leer(origen), "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Luna", "2026-11-20T18:00:00+00:00")
    origen = {**origen, "pizarra": PZ.con_fuente(p, "profe:mala")}
    destino = MP.leer("")
    o, d, paso = PZ.a_otra_sesion(1, origen, destino, "profe:mala", "2026-11-22T10:00:00+00:00")
    assert paso == {"archivo": True, "notas": True, "en_pizarra": True}
    # En la de origen ya no está, ni el archivo ni sus notas, y deja de ser la de la pizarra.
    assert [a["id"] for a in o["archivos"]] == ["buena", "ppt"]
    assert PZ.leer(o)["notas"] == {} and PZ.leer(o)["fuente"] == ""
    assert PZ.lista(o, [])["fuente"] == "profe:buena"
    # En la de destino está, con lo escrito, y es la que abre la pizarra.
    lista = PZ.lista(d, [])
    assert [x["id"] for x in lista["presentaciones"]] == ["profe:mala"] and lista["fuente"] == "profe:mala"
    assert lista["presentaciones"][0]["notas"]["por"] == "Luna" and lista["presentaciones"][0]["notas"]["paginas"] == 1
    assert PZ.leer_anotaciones(PZ.leer(d), "profe:mala")["paginas"][0]["trazos"] == [TRAZO]
    # No se pierde nada por el camino: el archivo sigue siendo el mismo.
    assert d["archivos"][0]["ruta"] == "privado/tareas/1/profe/m.pdf"


def test_al_pasar_a_otra_sesion_no_se_cambia_la_que_ya_abre_alli_la_pizarra(tmp_path, monkeypatch):
    _disco(tmp_path, monkeypatch)
    origen = MP.leer(json.dumps(_material()))
    destino = MP.leer(json.dumps({"archivos": [{"id": "suya", "tipo": "archivo", "nombre": "Otra.pdf", "ruta": "privado/tareas/1/profe/o.pdf"}], "pizarra": {"fuente": "profe:suya"}}))
    o, d, paso = PZ.a_otra_sesion(1, origen, destino, "profe:mala", "2026-11-22T10:00:00+00:00")
    assert paso == {"archivo": True, "notas": False, "en_pizarra": False}
    assert PZ.lista(d, [])["fuente"] == "profe:suya"
    assert [a["id"] for a in d["archivos"]] == ["suya", "mala"]


def test_si_el_mismo_archivo_ya_esta_en_la_otra_sesion_las_notas_se_juntan(tmp_path, monkeypatch):
    # «Guardar también en el otro grupo» copia el archivo con el mismo id.
    _disco(tmp_path, monkeypatch)
    origen = MP.leer(json.dumps(_material()))
    origen = {**origen, "pizarra": PZ.guardar_anotaciones(1, PZ.leer(origen), "profe:buena", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Luna", "2026-11-20T18:00:00+00:00")}
    destino = MP.leer(json.dumps({"archivos": [dict(origen["archivos"][0])]}))
    destino = {**destino, "pizarra": PZ.guardar_anotaciones(1, PZ.leer(destino), "profe:buena", {"paginas": [{"origen": 1, "trazos": [OTRO]}, {"origen": 2, "trazos": [OTRO]}]}, "Paul", "2026-11-21T18:00:00+00:00")}
    o, d, paso = PZ.a_otra_sesion(1, origen, destino, "profe:buena", "2026-11-22T10:00:00+00:00")
    assert paso["archivo"] and paso["notas"]
    assert [a["id"] for a in d["archivos"]] == ["buena"]  # no se duplica
    doc = PZ.leer_anotaciones(PZ.leer(d), "profe:buena")
    assert doc["paginas"][0]["trazos"] == [OTRO, TRAZO] and doc["paginas"][1]["trazos"] == [OTRO]
    assert PZ.leer(o)["notas"] == {}


def test_las_notas_sueltas_tambien_se_pasan_a_otra_sesion(tmp_path, monkeypatch):
    _disco(tmp_path, monkeypatch)
    origen = MP.leer(json.dumps(_material()))
    p = PZ.guardar_anotaciones(1, PZ.leer(origen), "profe:mala", {"paginas": [{"origen": 1, "trazos": [TRAZO]}]}, "Luna", "2026-11-20T18:00:00+00:00")
    origen = {**origen, "archivos": [a for a in origen["archivos"] if a["id"] != "mala"], "pizarra": p}
    assert [x["id"] for x in PZ.lista(origen, [])["sueltas"]] == ["profe:mala"]
    o, d, paso = PZ.a_otra_sesion(1, origen, MP.leer(""), "profe:mala", "2026-11-22T10:00:00+00:00")
    assert paso == {"archivo": False, "notas": True, "en_pizarra": False}
    assert PZ.lista(o, [])["sueltas"] == [] and [x["id"] for x in PZ.lista(d, [])["sueltas"]] == ["profe:mala"]


def test_la_de_los_alumnos_no_se_pasa_a_otra_sesion():
    with pytest.raises(T.TareaError):
        PZ.a_otra_sesion(1, MP.leer(json.dumps(_material())), MP.leer(""), "clase:activity_1", "2026-11-22T10:00:00+00:00")
    with pytest.raises(T.TareaError):
        PZ.a_otra_sesion(1, MP.leer(json.dumps(_material())), MP.leer(""), "profe:no-existe", "2026-11-22T10:00:00+00:00")


def test_las_otras_sesiones_salen_de_la_mas_cercana_a_la_mas_lejana():
    from types import SimpleNamespace as S

    from src.routers.pizarra import _otras_sesiones

    esta = S(id=1, tema="A", fecha="2026-11-20")
    todas = [esta, S(id=2, tema="B", fecha="2026-11-27"), S(id=3, tema="C", fecha="2026-11-13"), S(id=4, tema="D", fecha="2026-12-25"), S(id=5, tema="", fecha="")]
    assert [x["id"] for x in _otras_sesiones(esta, todas)] == [3, 2, 4, 5]

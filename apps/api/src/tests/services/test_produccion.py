"""Los tableros de producción (19/11/2026): cursos, tableros, columnas,
tarjetas, adjuntos, comentarios e importar de Nextcloud, contra una base de
datos de verdad (SQLite en memoria) y un Nextcloud falso."""

import json

import httpx
import pytest

from src.services.produccion import nextcloud as NC
from src.services.produccion import tableros as T
from src.services.produccion.markdown import markdown_a_html


class Persona:
    def __init__(self, id=1, first_name="Rida", last_name="Nawar", username="rida"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


EQUIPO = [{"id": 1, "nombre": "Rida Nawar", "rol": "Dirección"}, {"id": 2, "nombre": "Luna Zegers", "rol": "Profe"}]


# ── el texto de Nextcloud ──────────────────────────────────────────────────


def test_markdown_a_html():
    md = "## 📌 Doelen\n\n- De student kent **woorden**\n- [x] Hecho\n\nIn deze les… zie https://bunny.net/v/1\n\n<script>x</script>"
    h = markdown_a_html(md)
    assert "<h2>📌 Doelen</h2>" in h
    assert "<li><p>De student kent <strong>woorden</strong></p></li>" in h
    assert "☑ Hecho" in h
    assert '<a href="https://bunny.net/v/1">' in h
    assert "<script>" not in h and "&lt;script&gt;" in h
    assert markdown_a_html("") == ""
    tabla = markdown_a_html("| a | b |\n|---|---|\n| 1 | 2 |")
    assert tabla.startswith("<table>") and "<td><p>2</p></td>" in tabla
    # Un enlace a javascript: no se pinta como enlace.
    assert "href" not in markdown_a_html("[mal](javascript:alert(1))")


def test_ayudas_puras():
    assert T.vence_ok("2026-11-20T09:30:00") == "2026-11-20T09:30"
    assert T.vence_ok("2026-11-20") == "2026-11-20"
    assert T.vence_ok("ayer") == ""
    assert T.url_ok("drive.google.com/x") == "https://drive.google.com/x"
    assert T.url_ok("javascript:alert(1)") == ""
    assert T.color_ok("0087C5") == "#0087C5" and T.color_ok("rojo") == "#0b2da0"
    assert T.texto_plano(json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hola"}]}]})) == "Hola"
    assert T.texto_plano("<h2>Doelen</h2><p></p>") == "Doelen"
    antes = [{"id": 0, "nombre": "Paul Plaat"}]
    assert T.asignados_ok([2, {"id": 0, "nombre": "Paul Plaat"}, {"id": 0, "nombre": "Otro"}, 99], EQUIPO, antes) == [
        {"id": 2, "nombre": "Luna Zegers"},
        {"id": 0, "nombre": "Paul Plaat"},
    ]
    tarjetas = [
        {"id": 1, "vence": "2026-11-10", "hecha_at": "", "archivada": False, "asignados": [{"id": 2}]},
        {"id": 2, "vence": "2026-11-30", "hecha_at": "", "archivada": False, "asignados": []},
        {"id": 3, "vence": "2026-11-01", "hecha_at": "x", "archivada": False, "asignados": []},
        {"id": 4, "vence": "", "hecha_at": "", "archivada": False, "asignados": []},
    ]
    p = T.proximas_de(tarjetas, 2, "2026-11-19")
    assert [t["id"] for t in p] == [1, 2] and p[0]["vencida"] and p[0]["mia"]
    assert [t["id"] for t in T.proximas_de(tarjetas, 2, "2026-11-19", solo_mias=True)] == [1]
    assert NC.base_de("portal.nawar.es") == "https://portal.nawar.es"
    assert NC.base_de("https://portal.nawar.es/index.php/apps/deck/#/board/3") == "https://portal.nawar.es"
    assert NC.persona_del_equipo("luna zegers", EQUIPO)["id"] == 2
    assert NC.persona_del_equipo("Luna", EQUIPO)["id"] == 2
    assert NC.persona_del_equipo("Bas", EQUIPO) is None


# ── el día a día ───────────────────────────────────────────────────────────


async def test_cursos_tableros_y_tarjetas(db, tmp_path, monkeypatch):
    monkeypatch.setattr(T, "CONTENT_DIR", tmp_path)
    a0 = await T.crear_curso(1, "A0-A1", "#0b2da0", db)
    a1 = await T.crear_curso(1, "A1-A2", "", db)
    general = await T.vista_general(1, db)
    assert [c["nombre"] for c in general["cursos"]] == ["A0-A1", "A1-A2"]
    assert [e["nombre"] for e in general["cursos"][0]["etiquetas"]] == [n for n, _ in T.ETIQUETAS_DE_FABRICA]

    tb = await T.crear_tablero(1, a0["id"], "A1 Module 10: Dagelijks leven", "", db)
    vista = await T.ver_tablero(1, tb["id"], db)
    assert [c["titulo"] for c in vista["columnas"]] == T.COLUMNAS_DE_FABRICA
    col1, col2 = vista["columnas"][0]["id"], vista["columnas"][2]["id"]

    x = await T.crear_tarjeta(1, tb["id"], col1, "Les 1 - Woordenschat", Persona(), db)
    assert "Korte beschrijving" in x["descripcion"] and x["creado_por"] == "Rida Nawar"
    ingeleverd = general["cursos"][0]["etiquetas"][0]["id"]
    otra_etiqueta = general["cursos"][1]["etiquetas"][0]["id"]
    x = await T.cambiar_tarjeta(
        1,
        x["id"],
        {
            "etiquetas": [ingeleverd, otra_etiqueta],
            "asignados": [2],
            "vence": "2026-11-25T10:00",
            "enlaces": [{"titulo": "Vídeo en Bunny", "url": "iframe.mediadelivery.net/play/1/2"}, {"url": "javascript:x"}],
            "columna_id": col2,
            "descripcion": "<h2>Doelen</h2><p>Hablar de la rutina</p>",
        },
        Persona(2, "Luna", "Zegers"),
        EQUIPO,
        db,
    )
    # La etiqueta de otro curso no entra; el enlace malo tampoco.
    assert x["etiquetas"] == [ingeleverd]
    assert x["asignados"] == [{"id": 2, "nombre": "Luna Zegers"}]
    assert [e["url"] for e in x["enlaces"]] == ["https://iframe.mediadelivery.net/play/1/2"]
    assert x["columna_id"] == col2 and x["actualizado_por"] == "Luna Zegers" and x["tiene_descripcion"]

    hecha = await T.cambiar_tarjeta(1, x["id"], {"hecha": True}, Persona(), EQUIPO, db)
    assert hecha["hecha_at"]
    assert (await T.vista_general(1, db))["cursos"][0]["tableros"][0]["hechas"] == 1

    # Adjuntos y comentarios.
    x = await T.subir_adjunto(1, x["id"], "guion.pdf", b"%PDF-1.4", Persona(), db)
    adj = x["adjuntos"][0]
    assert adj["nombre"] == "guion.pdf" and "ruta" not in adj
    ruta, nombre = await T.adjunto(1, x["id"], adj["id"], db)
    assert ruta.read_bytes() == b"%PDF-1.4" and nombre == "guion.pdf"
    with pytest.raises(T.ProduccionError):
        await T.subir_adjunto(1, x["id"], "virus.exe", b"x", Persona(), db)
    c = await T.comentar(1, x["id"], "El vídeo está en Drive", Persona(2, "Luna", "Zegers"), db)
    assert (await T.ver_tarjeta(1, x["id"], db))["n_comentarios"] == 1
    with pytest.raises(T.ProduccionError):
        await T.borrar_comentario(1, c["id"], 1, False, db)  # no es suyo
    await T.borrar_comentario(1, c["id"], 1, True, db)  # el administrador sí
    assert (await T.ver_tarjeta(1, x["id"], db))["n_comentarios"] == 0

    # Buscar, también por el texto de dentro y sin acentos.
    assert [r["id"] for r in await T.buscar(1, "rutina", db)] == [x["id"]]

    # Pasar el tablero al otro curso: la etiqueta pasa por nombre.
    await T.cambiar_tablero(1, tb["id"], {"curso_id": a1["id"]}, db)
    movida = await T.ver_tarjeta(1, x["id"], db)
    etiquetas_a1 = {e["id"]: e["nombre"] for e in (await T.vista_general(1, db))["cursos"][1]["etiquetas"]}
    assert [etiquetas_a1[i] for i in movida["etiquetas"]] == ["Ingeleverd"]

    # Duplicar para preparar otro módulo: sin fechas ni personas ni adjuntos.
    copia = await T.duplicar_tablero(1, tb["id"], "A2 Module 01", a1["id"], True, db, Persona())
    v = await T.ver_tablero(1, copia["id"], db)
    assert [c["titulo"] for c in v["columnas"]] == T.COLUMNAS_DE_FABRICA
    assert len(v["tarjetas"]) == 1 and v["tarjetas"][0]["columna_id"] == v["columnas"][0]["id"]
    assert v["tarjetas"][0]["vence"] == "" and v["tarjetas"][0]["asignados"] == [] and v["tarjetas"][0]["n_adjuntos"] == 0

    # Una columna con tarjetas no se quita; vacía sí.
    with pytest.raises(T.ProduccionError):
        await T.borrar_columna(1, col2, db)
    await T.borrar_columna(1, vista["columnas"][4]["id"], db)

    # Borrar la tarjeta: quien la creó o un administrador.
    with pytest.raises(T.ProduccionError):
        await T.borrar_tarjeta(1, x["id"], 2, False, db)
    await T.borrar_tarjeta(1, x["id"], 1, False, db)
    assert not ruta.exists()

    # Otro colegio no ve nada.
    with pytest.raises(T.ProduccionError):
        await T.ver_tablero(2, tb["id"], db)

    await T.borrar_curso(1, a1["id"], db)
    assert [c["nombre"] for c in (await T.vista_general(1, db))["cursos"]] == ["A0-A1"]


# ── Nextcloud ──────────────────────────────────────────────────────────────


def _nextcloud_falso(llamadas: list):
    tableros = [
        {"id": 7, "title": "A1 MODULE 10: DAGELIJKS LEVEN", "color": "8E44AD", "archived": False, "deletedAt": 0, "labels": [{"id": 1, "title": "Ingeleverd", "color": "0082C9"}]},
        {"id": 8, "title": "A2 MODULE 01", "color": "31CC7C", "archived": False, "deletedAt": 0, "labels": []},
    ]
    stacks = [
        {
            "id": 70,
            "title": "Niet begonnen",
            "order": 1,
            "cards": [],
        },
        {
            "id": 72,
            "title": "Ingeleverd",
            "order": 3,
            "cards": [
                {
                    "id": 701,
                    "title": "Les 1 - Woordenschat | Dagelijkste routine",
                    "description": "# Korte Beschrijving\nIn deze les leren studenten…\n\n## 📌 Doelen\n- De student kent woorden",
                    "order": 1,
                    "labels": [{"id": 1, "title": "Ingeleverd", "color": "0082C9"}],
                    "assignedUsers": [{"participant": {"uid": "luna", "displayname": "Luna Zegers"}}, {"participant": {"uid": "paul", "displayname": "Paul Plaat"}}],
                    "duedate": "2026-08-17T06:00:00+00:00",
                    "done": "2026-10-05T13:02:00+00:00",
                    "archived": False,
                    "deletedAt": 0,
                    "attachmentCount": 1,
                    "commentsCount": 1,
                    "createdAt": 1767225600,
                    "lastModified": 1767312000,
                    "owner": {"displayname": "Rida"},
                }
            ],
        },
    ]

    def manejar(req: httpx.Request) -> httpx.Response:
        llamadas.append(str(req.url))
        if req.headers.get("authorization") is None:
            return httpx.Response(401)
        p = req.url.path
        if p.endswith("/apps/deck/api/v1.0/boards"):
            return httpx.Response(200, json=tableros)
        if p.endswith("/boards/7/stacks"):
            return httpx.Response(200, json=stacks)
        if p.endswith("/boards/7/stacks/archived"):
            return httpx.Response(200, json=[{"id": 70, "title": "Niet begonnen", "order": 1, "cards": [{"id": 702, "title": "Vieja", "order": 1, "archived": True, "deletedAt": 0}]}])
        if p.endswith("/cards/701/attachments"):
            return httpx.Response(200, json=[{"id": 5, "type": "file", "data": "Les1.mp4", "extendedData": {"fileid": 4242}, "deletedAt": 0}])
        if p.endswith("/cards/701/comments"):
            return httpx.Response(200, json={"ocs": {"data": [{"id": 1, "message": "Grabado, falta subirlo a Bunny", "actorDisplayName": "Luna Zegers", "creationDateTime": "2026-10-05T13:00:00+00:00"}]}})
        return httpx.Response(404)

    return httpx.MockTransport(manejar)


async def test_importar_de_nextcloud(db):
    llamadas: list = []
    tr = _nextcloud_falso(llamadas)
    lista = await NC.listar("portal.nawar.es", "rida", "app-pass", transporte=tr)
    assert [b["titulo"] for b in lista] == ["A1 MODULE 10: DAGELIJKS LEVEN", "A2 MODULE 01"]
    assert lista[0]["color"] == "#8E44AD"

    curso = await T.crear_curso(1, "A0-A1", "", db)
    r = await NC.importar(1, curso["id"], "https://portal.nawar.es", "rida", "app-pass", [7], EQUIPO, Persona(), db, transporte=tr)
    info = r["tableros"][0]
    assert info["creado"] and info["nuevas"] == 2 and not info.get("error")

    v = await T.ver_tablero(1, info["tablero_id"], db)
    assert v["tablero"]["titulo"] == "A1 MODULE 10: DAGELIJKS LEVEN" and v["tablero"]["color"] == "#8E44AD"
    assert [c["titulo"] for c in v["columnas"]] == ["Niet begonnen", "Ingeleverd"]
    assert len(v["tarjetas"]) == 1 and v["n_archivadas"] == 1
    t = await T.ver_tarjeta(1, v["tarjetas"][0]["id"], db)
    assert t["titulo"].startswith("Les 1") and "<h1>Korte Beschrijving</h1>" in t["descripcion"]
    assert t["asignados"] == [{"id": 2, "nombre": "Luna Zegers"}, {"id": 0, "nombre": "Paul Plaat"}]
    assert t["vence"] == "2026-08-17T08:00" and t["hecha_at"]
    assert t["enlaces"][0]["url"] == "https://portal.nawar.es/f/4242"
    assert t["comentarios"][0]["autor"] == "Luna Zegers" and t["n_comentarios"] == 1
    general = await T.vista_general(1, db)
    assert [e["nombre"] for e in general["cursos"][0]["etiquetas"]].count("Ingeleverd") == 1

    # Volver a importar no repite nada.
    otra = await NC.importar(1, curso["id"], "portal.nawar.es", "rida", "app-pass", [7], EQUIPO, Persona(), db, transporte=tr)
    assert not otra["tableros"][0]["creado"] and otra["tableros"][0]["nuevas"] == 0 and otra["tableros"][0]["ya_estaban"] == 2

    # Sin contraseña, no.
    with pytest.raises(NC.NextcloudError):
        await NC.listar("portal.nawar.es", "rida", "", transporte=tr)

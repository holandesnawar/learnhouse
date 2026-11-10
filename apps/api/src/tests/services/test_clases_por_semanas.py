"""Las clases en directo por semanas (06/11/2026): las grabaciones de los meses
de antes en su semana, «Mira también» con la clase del otro grupo y «Avisar a
la clase» (services/tareas/tareas.py)."""

from datetime import datetime

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.organization_config import OrganizationConfig
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User
from src.services.panel import tandas
from src.services.tareas import tareas as T

BUNNY = {"type": "doc", "content": [{"type": "blockBunny", "attrs": {"src": "https://iframe.mediadelivery.net/embed/675650/170f7e3b-aaaa"}}]}


def test_el_dia_y_el_tema_salen_del_nombre():
    assert T.fecha_en_titulo("14-10 Het Weer | Paul Plaat", 2026) == {"fecha": "2026-10-14", "tema": "Het Weer", "profe": "Paul Plaat"}
    assert T.fecha_en_titulo("26-10-2026 Bij de apotheek | Bas Wanders", 2025)["fecha"] == "2026-10-26"
    assert T.fecha_en_titulo("02/11/26 - Kleding", 2026) == {"fecha": "2026-11-02", "tema": "Kleding", "profe": ""}
    assert T.fecha_en_titulo("Repaso general", 2026) == {"fecha": "", "tema": "Repaso general", "profe": ""}
    assert T.fecha_en_titulo("31-02 Nada", 2026)["fecha"] == ""
    assert T.anio_del_capitulo("OCTUBRE - 2026") == 2026
    assert T.anio_del_capitulo("Material extra") is None


def test_cada_grabacion_en_su_semana():
    semanas = [
        {"id": 1, "fecha": "2026-10-26", "tema": "Bij de apotheek", "clases": []},
        {"id": 2, "fecha": "2026-11-02", "tema": "De kleding", "clases": [{"tipo": "presentacion"}]},
    ]
    sueltas = [
        {"id": 10, "tipo": "grabacion", "fecha": "2026-10-26", "tema": "Bij de apotheek"},
        # Mismo tema, misma semana (otro día): a su semana.
        {"id": 11, "tipo": "grabacion", "fecha": "2026-11-03", "tema": "Kleding"},
        {"id": 12, "tipo": "grabacion", "fecha": "2026-10-14", "tema": "Het Weer"},
        {"id": 13, "tipo": "grabacion", "fecha": "", "tema": "Repaso"},
        {"id": 14, "tipo": "otra", "fecha": "2026-11-02", "tema": "Un PDF"},
    ]
    archivo = T.colocar_sueltas(semanas, sueltas)
    assert [c["id"] for c in semanas[0]["clases"]] == [10]
    assert [c.get("id") for c in semanas[1]["clases"]] == [None, 11]
    assert semanas[1]["clases"][1]["suelta"] is True
    # Lo que no tiene semana: el más nuevo primero y lo que no dice su día, al final.
    assert [c["id"] for c in archivo] == [14, 12, 13]
    # Una semana que ya tiene su grabación no recibe otra (salían dobles), y
    # una «Presentación» sin día no sale en «Clases anteriores».
    con_la_suya = [{"id": 3, "fecha": "2026-11-02", "tema": "De kleding", "clases": [{"tipo": "grabacion"}]}]
    resto = T.colocar_sueltas(con_la_suya, [
        {"id": 20, "tipo": "grabacion", "fecha": "2026-11-02", "tema": "De kleding"},
        {"id": 21, "tipo": "grabacion", "fecha": "", "tema": "Presentación", "nombre": "Presentación"},
    ])
    assert len(con_la_suya[0]["clases"]) == 1 and resto == []
    # Otro tema en otra semana no se mete.
    assert T.semana_de_la_grabacion(semanas, {"fecha": "2026-11-04", "tema": "Het Weer"}) is None


def test_el_video_de_una_grabacion():
    assert T.video_de("TYPE_DYNAMIC", "SUBTYPE_DYNAMIC_PAGE", BUNNY)["url"].startswith(
        "https://iframe.mediadelivery.net/embed/675650/170f7e3b-aaaa?"
    )
    assert T.video_de("TYPE_VIDEO", "SUBTYPE_VIDEO_YOUTUBE", {"uri": "https://youtu.be/abcdefGHIJ1"}) == {
        "tipo": "youtube", "url": "https://www.youtube-nocookie.com/embed/abcdefGHIJ1"}
    assert T.video_de("TYPE_VIDEO", "SUBTYPE_VIDEO_HOSTED", {"filename": "a.mp4"})["tipo"] == "archivo"
    assert T.video_de("TYPE_DYNAMIC", "SUBTYPE_DYNAMIC_PAGE", {"type": "doc"}) is None
    assert T.es_hermana("Clase semanal", "clase  Semanal") and not T.es_hermana("Clase semanal", "Masterclass")
    assert T.dia_habitual(["2026-11-05", "2026-10-29", "2026-11-02"]) == "jueves"


def test_a_quien_le_llega_el_aviso():
    filas = [
        {"user_id": 1, "presentacion": True, "grabacion": False, "ejercicios": {"hechos": 2, "total": 2}, "tarea": "entregada", "clase": None},
        {"user_id": 2, "presentacion": False, "grabacion": True, "ejercicios": {"hechos": 0, "total": 2}, "tarea": "pendiente", "clase": None},
    ]
    assert [f["user_id"] for f in T.quien_recibe(filas, "todos")] == [1, 2]
    assert [f["user_id"] for f in T.quien_recibe(filas, "sin_presentacion")] == [2]
    assert [f["user_id"] for f in T.quien_recibe(filas, "sin_grabacion")] == [1]
    assert [f["user_id"] for f in T.quien_recibe(filas, "sin_ejercicios")] == [2]
    assert [f["user_id"] for f in T.quien_recibe(filas, "sin_tarea")] == [2]
    assert T.quien_recibe(filas, "sin_clase") == []  # sin la sala no se sabe quién fue


async def _user(db, org, uid, grupo=None):
    a = "2026-09-08 10:00:00"
    db.add(User(id=uid, username=f"u{uid}", first_name=f"A{uid}", last_name="", email=f"u{uid}@example.com",
                password="x", user_uuid=f"user_{uid}", creation_date=a, update_date=a))
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=4, creation_date=a, update_date=a))
    if grupo:
        db.add(UserGroupUser(usergroup_id=grupo, user_id=uid, org_id=org.id, creation_date=a, update_date=a))
    await db.commit()


async def _actividad(db, org, aid, curso_id, cap_id, nombre, tipo, sub, content, orden=1):
    a = str(datetime.now())
    db.add(Activity(id=aid, name=nombre, activity_type=tipo, activity_sub_type=sub, content=content, published=True,
                    org_id=org.id, course_id=curso_id, activity_uuid=f"activity_{aid}", creation_date=a, update_date=a))
    db.add(ChapterActivity(order=orden, chapter_id=cap_id, activity_id=aid, course_id=curso_id, org_id=org.id,
                           creation_date=a, update_date=a))


async def _dos_grupos(db, org):
    """Groep blauw (curso 2) y Groep rood (curso 6): la misma «Clase semanal»."""
    a = str(datetime.now())
    db.add(OrganizationConfig(org_id=org.id, config={"salas": {"blauw": {"directo": True}, "rood": {"directo": True}}},
                              creation_date=a, update_date=a))
    for cid, cu in ((2, "course_blauw"), (6, "course_rood")):
        db.add(Course(id=cid, name="Clase semanal", description="", public=False, published=True, open_to_contributors=False,
                      org_id=org.id, course_uuid=cu, creation_date=a, update_date=a))
    db.add(Course(id=7, name="Masterclass", description="", public=False, published=True, open_to_contributors=False,
                  org_id=org.id, course_uuid="course_mc", creation_date=a, update_date=a))
    # Blauw: el mes de octubre (de antes) y la semana de Kleding.
    db.add(Chapter(id=20, name="OCTUBRE - 2026", description="", org_id=org.id, course_id=2, chapter_uuid="chapter_oct", creation_date=a, update_date=a))
    db.add(Chapter(id=21, name="Kleding", description="", org_id=org.id, course_id=2, chapter_uuid="chapter_kb", creation_date=a, update_date=a))
    # Rood: la semana de Kleding, con su grabación.
    db.add(Chapter(id=61, name="Kleding", description="", org_id=org.id, course_id=6, chapter_uuid="chapter_kr", creation_date=a, update_date=a))
    db.add(Chapter(id=62, name="Mijn huis", description="", org_id=org.id, course_id=6, chapter_uuid="chapter_hr", creation_date=a, update_date=a))
    for gid, nombre, cu in ((10, "Beta - Blauw", "course_blauw"), (9, "Beta - Rood", "course_rood")):
        db.add(UserGroup(id=gid, name=nombre, org_id=org.id, usergroup_uuid=f"ug_{gid}", description="", creation_date=a, update_date=a))
        db.add(UserGroupResource(usergroup_id=gid, resource_uuid=cu, org_id=org.id, creation_date=a, update_date=a))
    await db.commit()
    dyn, pag = ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE
    await _actividad(db, org, 30, 2, 20, "14-10 Het Weer | Paul Plaat", dyn, pag, BUNNY, 1)
    await _actividad(db, org, 31, 2, 20, "02-11-2026 Kleding | Bas Wanders", dyn, pag, BUNNY, 2)
    await _actividad(db, org, 32, 2, 21, "Presentación", ActivityTypeEnum.TYPE_DOCUMENT, ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF, {}, 1)
    await _actividad(db, org, 33, 6, 61, "Grabación Kleding", dyn, pag, BUNNY, 1)
    await _actividad(db, org, 34, 6, 62, "Grabación Mijn huis", dyn, pag, BUNNY, 1)
    await db.commit()
    blauw = await T.curso_de("blauw", db)
    rood = await T.curso_de("rood", db)
    await T.crear_semana(org.id, blauw, {"chapter_uuid": "chapter_kb", "tema": "Kleding", "fecha": "2026-11-02"}, "Rida", db)
    await T.crear_semana(org.id, rood, {"chapter_uuid": "chapter_kr", "tema": "Kleding", "fecha": "2026-11-05"}, "Rida", db)
    await T.crear_semana(org.id, rood, {"chapter_uuid": "chapter_hr", "tema": "Mijn huis", "fecha": "2026-11-12"}, "Rida", db)
    await _user(db, org, 100, grupo=10)
    await _user(db, org, 101, grupo=10)
    db.add(TrailStep(complete=True, teacher_verified=False, grade="", data={}, trailrun_id=1, trail_id=1,
                     activity_id=31, course_id=2, org_id=org.id, user_id=100, creation_date=a, update_date=a))
    await db.commit()
    return blauw, rood


async def test_la_pagina_de_la_clase_por_semanas(db, org, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-06")
    blauw, _ = await _dos_grupos(db, org)
    v = await T.semanas_para_alumno(blauw, 100, db, con_archivo=True)
    kleding = v["semanas"][0]
    # La grabación de Kleding del mes de octubre va dentro de su semana, vista.
    assert [(c["tipo"], c["hecha"], bool(c.get("suelta"))) for c in kleding["clases"]] == [
        ("presentacion", False, False), ("grabacion", True, True)]
    # Het Weer no tiene semana: sale como una clase más, con su día y su profe.
    assert [(c["fecha"], c["tema"], c["profe"]) for c in v["archivo"]] == [("2026-10-14", "Het Weer", "Paul Plaat")]
    assert all("id" not in c for c in v["archivo"])
    # Sin pedir el archivo (el Inicio), como siempre.
    assert "archivo" not in await T.semanas_para_alumno(blauw, 100, db)
    # El seguimiento cuenta esa grabación.
    seg = await T.seguimiento(org.id, "blauw", None, db)
    assert [f["grabacion"] for f in seg["alumnos"]] == [True, False]
    assert seg["cifras"]["grabacion"] == 1 and seg["cifras"]["con_grabacion"]


async def test_mira_tambien_la_clase_del_otro_grupo(db, org, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-06")
    blauw, rood = await _dos_grupos(db, org)
    r = await T.mira_tambien(blauw, db)
    assert len(r["clases"]) == 1
    otra = r["clases"][0]
    assert otra["course_uuid"] == "rood" and otra["dia"] == "jueves"
    # Solo lo ya dado: la de Mijn huis (12 nov) aún no.
    assert [(g["tema"], g["fecha"], g["video"]["tipo"]) for g in otra["grabaciones"]] == [("Kleding", "2026-11-05", "bunny")]
    # Desde rood se ve blauw, aunque sus grabaciones sigan en el capítulo del
    # mes (10/11/2026: «no veo lo del otro grupo»).
    desde_rood = (await T.mira_tambien(rood, db))["clases"]
    assert [(g["tema"], g["fecha"]) for g in desde_rood[0]["grabaciones"]] == [("Kleding", "2026-11-02"), ("Het Weer", "2026-10-14")]
    # La Masterclass no es hermana de nadie.
    assert await T.mira_tambien(await T.curso_de("mc", db), db) == {"clases": []}
    # El equipo ve la otra clase para crear la semana en las dos.
    h = await T.hermanas_para_el_equipo(blauw, db)
    assert [(x["course_uuid"], x["id"]) for x in h] == [("rood", 6)]
    # Apagado en los ajustes de la clase: no sale.
    fila = (await db.execute(__import__("sqlmodel").select(OrganizationConfig))).scalars().first()
    fila.config = {"salas": {"blauw": {"directo": True, "mira_tambien": False}, "rood": {"directo": True}}}
    db.add(fila)
    await db.commit()
    assert await T.mira_tambien(blauw, db) == {"clases": []}


async def test_avisar_a_la_clase(db, org, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-06")
    blauw, _ = await _dos_grupos(db, org)
    s = (await T.semanas_de(org.id, blauw.course_uuid, db))[0]
    d = await T.destinatarios(org.id, s, db)
    por = {f["id"]: [a["user_id"] for a in f["alumnos"]] for f in d["filtros"]}
    assert por["todos"] == [100, 101] and por["sin_grabacion"] == [101] and por["sin_presentacion"] == [100, 101]
    assert "sin_tarea" not in por and "sin_clase" not in por  # sin tarea ni sala, esos filtros no salen
    # Prueba: no se apunta nada.
    r = await T.avisar_clase(org.id, s, {"filtro": "sin_grabacion", "titulo": "Mira la grabación", "texto": "Hola", "campana": True, "prueba": True}, "Rida", db)
    assert r["prueba"] and T.leer_avisos(s.avisos) == []
    r = await T.avisar_clase(org.id, s, {"filtro": "sin_grabacion", "titulo": "Mira la grabación", "texto": "Ya está.\n\nVela antes del lunes.",
                                         "campana": True, "correo": True}, "Rida", db)
    assert r["alumnos"] == 1 and r["destinos"] == [("u101@example.com", "A101")]
    assert "<p>Ya está.</p><p>Vela antes del lunes.</p>" == r["correo"]["html"]
    # En la campana, solo a quien le tocó.
    a101 = [x for x in await T.avisos_alumno(101, db) if x["kind"] == "clase"]
    assert len(a101) == 1 and a101[0]["title"] == "Mira la grabación" and a101[0]["url"] == "/course/blauw"
    assert [x for x in await T.avisos_alumno(100, db) if x["kind"] == "clase"] == []
    assert (await T.destinatarios(org.id, s, db))["avisos"][0]["alumnos"] == 1
    # Las clases lado a lado.
    lado = await T.resumen_clases(org.id, db)
    assert {c["course_uuid"]: c["semana"]["tema"] for c in lado}["blauw"] == "Kleding"

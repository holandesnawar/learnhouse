"""Las semanas de las clases en directo y su tarea (services/tareas/tareas.py).

- El plazo, la semana en curso y la próxima.
- Qué es cada clase de una semana (presentación, grabación, ejercicios).
- Entregar, corregir, el aviso al alumno y volver a abrir.
- El seguimiento semanal y las semanas sin nada.
- El check-in de las semanas 4, 8 y 12.
"""

from datetime import datetime, timezone

import pytest

from src.db.contact_event import ContactEvent
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.tareas import TareaEntrega
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User
from src.services.panel import tandas
from src.services.tareas import tareas as T


def test_plazo_el_domingo_de_la_semana():
    assert T.limite_de("2026-11-02") == "2026-11-08"  # lunes → domingo
    assert T.limite_de("2026-11-05") == "2026-11-08"  # jueves → domingo
    assert T.limite_de("2026-11-08") == "2026-11-15"  # domingo → el siguiente
    assert T.limite_de("2026-11-02", "2026-11-10") == "2026-11-10"
    assert T.limite_de("") == ""


def test_semana_en_curso_y_proxima():
    semanas = [
        {"id": 1, "fecha": "2026-10-26"},
        {"id": 2, "fecha": "2026-11-02"},
        {"id": 3, "fecha": "2026-11-09"},
    ]
    # El viernes antes de la clase del 2: sigue la del 26 (plazo el domingo 1).
    assert T.semana_actual(semanas, "2026-10-30") == (1, 2)
    # El lunes 2 empieza la nueva.
    assert T.semana_actual(semanas, "2026-11-02") == (2, 3)
    assert T.semana_actual(semanas, "2026-11-08") == (2, 3)
    # Antes de la primera clase: ninguna en curso, la próxima es la primera.
    assert T.semana_actual(semanas, "2026-10-20") == (None, 1)
    # Después de la última: ninguna.
    assert T.semana_actual(semanas, "2026-11-20") == (None, None)


def test_que_es_cada_clase():
    assert T.tipo_de_clase("TYPE_DOCUMENT", "SUBTYPE_DOCUMENT_PDF", {}) == "presentacion"
    assert T.tipo_de_clase("TYPE_VIDEO", "SUBTYPE_VIDEO_HOSTED", {}) == "grabacion"
    assert T.tipo_de_clase(ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_EMBED, {"embed_url": "nawar:m3/les/flashcards"}) == "ejercicios"
    assert T.tipo_de_clase("TYPE_DYNAMIC", "SUBTYPE_DYNAMIC_EMBED", {"embed_url": "https://iframe.mediadelivery.net/embed/1/2"}) == "grabacion"
    pagina = {"type": "doc", "content": [{"type": "blockBunny", "attrs": {"src": "https://iframe.mediadelivery.net/embed/1/2"}}]}
    assert T.tipo_de_clase("TYPE_DYNAMIC", "SUBTYPE_DYNAMIC_PAGE", pagina) == "grabacion"
    assert T.tipo_de_clase("TYPE_DYNAMIC", "SUBTYPE_DYNAMIC_PAGE", {"type": "doc"}) == "otra"


def test_estado_racha_y_checkin():
    assert T.estado_entrega(False, None) == "sin-tarea"
    assert T.estado_entrega(True, None) == "pendiente"
    assert T.estado_entrega(True, {"estado": "entregada"}) == "entregada"
    assert T.estado_entrega(True, {"estado": "corregida"}) == "corregida"
    assert T.racha([True, True, False, True]) == {"seguidas": 2, "sin_nada": 0}
    assert T.racha([False, False, True]) == {"seguidas": 0, "sin_nada": 2}
    assert T.racha([]) == {"seguidas": 0, "sin_nada": 0}
    assert T.hito_pendiente(3, set()) is None
    assert T.hito_pendiente(4, set()) == 4
    assert T.hito_pendiente(6, set()) == 4  # atrasado, aún toca
    assert T.hito_pendiente(6, {4}) is None
    assert T.hito_pendiente(8, set()) == 8  # ya toca el siguiente
    assert T.hito_pendiente(16, set()) is None


def test_quien_fue_a_la_clase_ese_dia():
    # 2 nov 2026, 19:00 en Países Bajos = 18:00 UTC.
    lunes = int(datetime(2026, 11, 2, 18, 0, tzinfo=timezone.utc).timestamp())
    martes = int(datetime(2026, 11, 3, 18, 0, tzinfo=timezone.utc).timestamp())
    sesiones = [
        {"id": "a", "start_time": lunes, "participants": [{"user_id": "7", "duration": 3000}, {"user_id": "8", "duration": 60}]},
        {"id": "b", "start_time": martes, "participants": [{"user_id": "9", "duration": 3000}]},
    ]
    assert T.asistentes_el_dia(sesiones, "2026-11-02") == {"7"}


async def _alumno(db, org, uid, nombre, entro="2026-09-08 10:00:00", rol=4):
    db.add(User(id=uid, username=f"u{uid}", first_name=nombre, last_name="", email=f"u{uid}@example.com",
                password="x", user_uuid=f"user_{uid}", creation_date=entro, update_date=entro))
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=rol, creation_date=entro, update_date=entro))
    await db.commit()


async def _clase_con_semana(db, org):
    ahora = str(datetime.now())
    c = Course(id=50, name="Masterclass", description="", public=False, published=True, open_to_contributors=False,
               org_id=org.id, course_uuid="course_mc", creation_date=ahora, update_date=ahora)
    ch = Chapter(id=60, name="De kleding", description="", org_id=org.id, course_id=50,
                 chapter_uuid="chapter_kleding", creation_date=ahora, update_date=ahora)
    db.add(c)
    db.add(ch)
    await db.commit()
    for aid, nombre, tipo, sub, content, orden in [
        (70, "Presentación", ActivityTypeEnum.TYPE_DOCUMENT, ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF, {}, 1),
        (71, "Flashcards", ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_EMBED, {"embed_url": "nawar:m/l/flashcards"}, 2),
        (72, "Oefeningen", ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_EMBED, {"embed_url": "nawar:m/l/vocabulary"}, 3),
    ]:
        db.add(Activity(id=aid, name=nombre, activity_type=tipo, activity_sub_type=sub, content=content, published=True,
                        org_id=org.id, course_id=50, activity_uuid=f"activity_{aid}", creation_date=ahora, update_date=ahora))
        db.add(ChapterActivity(order=orden, chapter_id=60, activity_id=aid, course_id=50, org_id=org.id,
                               creation_date=ahora, update_date=ahora))
    # La clase es solo del grupo «Blauwe groep».
    g = UserGroup(id=80, name="Blauwe groep", org_id=org.id, usergroup_uuid="ug_b", description="",
                  creation_date=ahora, update_date=ahora)
    db.add(g)
    db.add(UserGroupResource(usergroup_id=80, resource_uuid="course_mc", org_id=org.id, creation_date=ahora, update_date=ahora))
    await db.commit()
    await _alumno(db, org, 7, "Ana")
    await _alumno(db, org, 8, "Luis")
    await _alumno(db, org, 9, "Otra clase")
    for uid in (7, 8):
        db.add(UserGroupUser(usergroup_id=80, user_id=uid, org_id=org.id, creation_date=ahora, update_date=ahora))
    # Ana abrió la presentación y una tanda de ejercicios.
    for aid in (70, 71):
        db.add(TrailStep(complete=True, teacher_verified=False, grade="", data={}, trailrun_id=1, trail_id=1,
                         activity_id=aid, course_id=50, org_id=org.id, user_id=7, creation_date=ahora, update_date=ahora))
    await db.commit()
    return c


@pytest.fixture
def contenido(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "CONTENT_DIR", tmp_path)
    return tmp_path


async def test_una_semana_de_principio_a_fin(db, org, monkeypatch, contenido):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-04")
    c = await _clase_con_semana(db, org)

    with pytest.raises(T.TareaError):
        await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "", "fecha": "2026-11-02"}, "Rida", db)
    r = await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02",
                                         "enunciado": "Escribe 5 frases sobre tu ropa."}, "Rida", db)
    s = r["semana"]
    assert s["limite"] == "2026-11-08" and s["tiene_tarea"] and s["course_uuid"] == "mc"
    with pytest.raises(T.TareaError):  # el mismo capítulo, dos veces no
        await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "X", "fecha": "2026-11-02"}, "Rida", db)

    # Lo que ve Ana en la página de su clase.
    v = await T.semanas_para_alumno(c, 7, db)
    assert v["actual"] == s["id"] and v["proxima"] is None
    semana = v["semanas"][0]
    assert [(x["tipo"], x["hecha"]) for x in semana["clases"]] == [("presentacion", True), ("ejercicios", True), ("ejercicios", False)]
    assert semana["tarea"]["estado"] == "pendiente"

    # Entregar vacío no; con texto y nota de voz, sí.
    t = await T.tarea(s["id"], db)
    with pytest.raises(T.TareaError):
        await T.entregar(t, 7, "   ", None, 0, False, db)
    r = await T.entregar(t, 7, "Ik draag een blauwe broek.", ("nota.webm", b"audio"), 12, False, db)
    e = r["entrega"]
    assert e["tiene_audio"] and e["audio_seg"] == 12 and e["estado"] == "entregada"
    fila = await T.entrega(e["id"], db)
    ruta, mime = T.audio_de(fila, "alumno")
    assert ruta.read_bytes() == b"audio" and mime == "audio/webm"
    assert str(ruta).startswith(str(contenido / "privado" / "tareas"))
    # Cambiarla mientras no está corregida: se queda la misma nota de voz.
    r = await T.entregar(t, 7, "Ik draag een blauwe broek en een witte trui.", None, 0, False, db)
    assert r["entrega"]["tiene_audio"] and r["entrega"]["audio_seg"] == 12

    # El equipo: por corregir y el seguimiento.
    pc = await T.por_corregir(org.id, db)
    assert [p["nombre"] for p in pc] == ["Ana"] and pc[0]["curso"] == "Masterclass"
    seg = await T.seguimiento(org.id, "mc", None, db)
    assert [a["nombre"] for a in seg["alumnos"]] == ["Ana", "Luis"]  # el de otra clase no sale
    ana, luis = seg["alumnos"]
    assert ana["presentacion"] is True and ana["ejercicios"] == {"hechos": 1, "total": 2} and ana["tarea"] == "entregada"
    assert luis["presentacion"] is False and luis["tarea"] == "pendiente"
    assert ana["clase"] is None and "Zoom" in seg["aviso"]  # sin sala no se sabe quién fue
    assert seg["cifras"]["presentacion"] == 1 and seg["cifras"]["por_corregir"] == 1

    # Corregir con nota de voz: al alumno le sale en la campana.
    await T.corregir(fila, "¡Muy bien!", ("c.webm", b"voz"), 20, 1, "Rida", db)
    avisos = await T.avisos_alumno(7, db)
    assert len(avisos) == 1 and avisos[0]["url"] == f"/tarea/{s['id']}" and "Rida" in avisos[0]["excerpt"]
    with pytest.raises(T.TareaError):  # corregida: ya no se cambia
        await T.entregar(t, 7, "otra", None, 0, False, db)
    await T.marcar_vista(t, 7, db)
    assert await T.avisos_alumno(7, db) == []
    assert await T.avisos_equipo(org.id, False, db) == []  # nada por corregir

    # Volver a abrirla borra la nota de voz de la corrección.
    voz = T.audio_de(fila, "correccion")[0]
    await T.reabrir(fila, db)
    assert not voz.exists() and (await T.entrega(e["id"], db)).estado == "entregada"
    eq = await T.avisos_equipo(org.id, False, db)
    assert eq[0]["kind"] == "corregir" and eq[0]["url"] == "/seguimiento"

    # Borrar la semana se lleva las entregas y sus notas de voz.
    r = await T.borrar_semana(await T.tarea(s["id"], db), db)
    assert r["entregas_borradas"] == 1 and not ruta.exists()


async def test_aviso_de_presentacion_nueva(db, org, monkeypatch, contenido):
    c = await _clase_con_semana(db, org)
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-10-30")
    sid = (await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02"},
                                "Rida", db))["semana"]["id"]
    # Luis (de la clase, sin abrirla) recibe el aviso, con enlace a la presentación.
    avisos = await T.avisos_alumno(8, db)
    assert [a["kind"] for a in avisos] == ["semana"]
    a = avisos[0]
    assert a["id"] == f"semana:{sid}:activity_70" and a["title"] == "Nueva clase: De kleding"
    assert a["url"] == "/course/mc/activity/70" and "lunes 2 de noviembre" in a["excerpt"]
    assert "T" in a["date"] and a["date"].endswith("+00:00")  # misma forma que el resto de la campana
    # Ana ya la abrió: no. El de otra clase (fuera del grupo), tampoco.
    assert await T.avisos_alumno(7, db) == []
    assert await T.avisos_alumno(9, db) == []
    # El equipo no: solo los alumnos.
    await _alumno(db, org, 10, "Profe", rol=5)
    db.add(UserGroupUser(usergroup_id=80, user_id=10, org_id=org.id, creation_date="x", update_date="x"))
    await db.commit()
    assert await T.avisos_alumno(10, db) == []
    # Una semana de hace más de 7 días ya no avisa.
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-12")
    assert await T.avisos_alumno(8, db) == []
    assert T.dia_largo("2026-11-02") == "lunes 2 de noviembre"


async def test_antes_de_la_clase_solo_la_presentacion(db, org, monkeypatch, contenido):
    assert T.abierta("2026-11-02", "2026-11-01") is False
    assert T.abierta("2026-11-02", "2026-11-02") is True  # el día de la clase, ya
    assert T.abierta("", "2026-11-01") is True

    c = await _clase_con_semana(db, org)
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-10-30")
    r = await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02",
                                         "enunciado": "Escribe 5 frases sobre tu ropa."}, "Rida", db)
    sid = r["semana"]["id"]

    # El viernes antes: Ana ve la presentación; los ejercicios y el enunciado, no.
    v = await T.semanas_para_alumno(c, 7, db)
    assert v["proxima"] == sid
    s = v["semanas"][0]
    assert not s["abierta"] and [x["tipo"] for x in s["clases"]] == ["presentacion"]
    assert s["ocultas"] == 2 and s["tiene_tarea"] and s["enunciado"] == ""
    assert (await T.tarea_para(await T.tarea(sid, db), c, 7, db))["enunciado"] == ""
    with pytest.raises(T.TareaError):  # entregar antes de la clase, no
        await T.entregar(await T.tarea(sid, db), 7, "Ik draag een broek.", None, 0, False, db)
    # El equipo lo ve todo, para comprobar la semana.
    eq = (await T.semanas_para_alumno(c, 1, db, equipo=True))["semanas"][0]
    assert len(eq["clases"]) == 3 and eq["enunciado"]

    # El lunes de la clase se abre todo.
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-02")
    s = (await T.semanas_para_alumno(c, 7, db))["semanas"][0]
    assert s["abierta"] and len(s["clases"]) == 3 and s["enunciado"]
    r = await T.entregar(await T.tarea(sid, db), 7, "Ik draag een broek.", None, 0, False, db)
    assert r["ok"]


async def test_semanas_sin_nada(db, org, monkeypatch, contenido):
    c = await _clase_con_semana(db, org)
    ahora = str(datetime.now())
    db.add(Chapter(id=61, name="Het weer", description="", org_id=org.id, course_id=50,
                   chapter_uuid="chapter_weer", creation_date=ahora, update_date=ahora))
    await db.commit()
    await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_weer", "tema": "Het weer", "fecha": "2026-10-26", "enunciado": "x"}, "Rida", db)
    await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02", "enunciado": "x"}, "Rida", db)
    # El 10 de noviembre las dos semanas están cerradas.
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-10")
    seg = await T.seguimiento(org.id, "mc", None, db)
    por = {a["nombre"]: a for a in seg["alumnos"]}
    assert por["Ana"]["seguidas"] == 1 and por["Ana"]["sin_nada"] == 0  # hizo algo en la del 2 nov
    assert por["Luis"]["sin_nada"] == 2


async def test_checkin_cada_4_semanas(db, org, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-10-28")
    await _alumno(db, org, 7, "Ana", "2026-10-01 10:00:00")   # semana 4
    await _alumno(db, org, 8, "Luis", "2026-10-21 10:00:00")  # semana 2: no toca
    await _alumno(db, org, 9, "Eva", "2026-09-02 10:00:00")   # semana 8
    r = await T.checkins(org.id, db)
    assert [(a["nombre"], a["hito"]) for a in r["toca"]] == [("Eva", 8), ("Ana", 4)]
    await T.marcar_checkin(org.id, 7, 4, "Va bien, le cuesta el oído", "Rida", db)
    assert [a["nombre"] for a in (await T.checkins(org.id, db))["toca"]] == ["Eva"]
    ev = (await db.execute(__import__("sqlmodel").select(ContactEvent))).scalars().first()
    assert ev.kind == "check-in" and ev.email == "u7@example.com"
    from src.services.contactos.contactos import _que

    assert _que("check-in", {"extra": {"hito": 4, "autor": "Rida", "nota": "Va bien"}}) == "Check-in de la semana 4 (lo hizo Rida): Va bien"
    eq = await T.avisos_equipo(org.id, True, db)
    assert eq and eq[-1]["kind"] == "checkin" and eq[-1]["url"] == "/dash/estadisticas?tab=seguimiento"
    with pytest.raises(T.TareaError):
        await T.marcar_checkin(org.id, 7, 5, "", "Rida", db)


def test_la_ruta_de_las_notas_de_voz_no_sale_de_su_carpeta():
    assert T.ruta_segura("privado/facturas/1/x.pdf") is None
    assert T.ruta_segura("privado/tareas/../../etc/passwd") is None
    assert T.ruta_segura("/etc/passwd") is None
    assert TareaEntrega().estado == "entregada"

"""Progreso de alumnos: dónde se quedó y cuándo entró por última vez."""

from datetime import date, datetime

from src.services.panel.alumnos import donde_y_cuando, estado_de, listar_alumnos

CLASES = {
    "a1": {"id": 1, "uuid": "activity_a1", "modulo": "Módulo 1", "clase": "1.1 Samenvatting"},
    "a2": {"id": 2, "uuid": "activity_a2", "modulo": "Módulo 1", "clase": "1.4 Lezen"},
}


def test_la_posicion_abierta_gana_si_es_mas_reciente():
    r = donde_y_cuando(
        {"activity_uuid": "a2", "updated_at": "2026-10-03T18:05:00.000Z"},
        {"modulo": "Módulo 1", "clase": "1.1 Samenvatting", "fecha": "2026-10-02 10:00:00.1"},
        ["2026-10-03"],
        CLASES,
    )
    assert r["donde"]["clase"] == "1.4 Lezen" and r["donde"]["como"] == "abrio"
    assert r["ultima_entrada"] == "2026-10-03T18:05:00Z"


def test_la_clase_terminada_gana_si_es_mas_reciente_y_acepta_uuid_con_prefijo():
    r = donde_y_cuando(
        {"activity_uuid": "activity_a1", "updated_at": "2026-10-01T09:00:00Z"},
        {"modulo": "Módulo 1", "clase": "1.4 Lezen", "fecha": "2026-10-02 10:00:00"},
        [],
        CLASES,
    )
    assert r["donde"]["clase"] == "1.4 Lezen" and r["donde"]["como"] == "termino"


def test_un_dia_de_visita_posterior_manda_aunque_no_abriera_nada():
    r = donde_y_cuando({"activity_uuid": "a1", "updated_at": "2026-10-01T09:00:00Z"}, None, ["2026-10-04"], CLASES)
    assert r["ultima_entrada"] == "2026-10-04"
    assert r["donde"]["clase"] == "1.1 Samenvatting"


def test_el_dia_suelto_usa_la_hora_si_la_hay_ese_dia():
    r = donde_y_cuando({"activity_uuid": "a1", "updated_at": "2026-10-04T07:30:00Z"}, None, ["2026-10-04"], CLASES)
    assert r["ultima_entrada"] == "2026-10-04T07:30:00Z"


def test_repaso_en_la_app_de_ejercicios():
    r = donde_y_cuando({"lesson_title": "De kalender", "updated_at": "2026-10-04T07:30:00Z"}, None, [], CLASES)
    assert r["donde"] == {"modulo": "App de ejercicios", "clase": "De kalender", "cuando": "2026-10-04T07:30:00Z", "como": "repaso"}


def test_sin_nada():
    assert donde_y_cuando({}, None, [], CLASES) == {"donde": None, "ultima_entrada": ""}


def test_estados():
    hoy = date(2026, 10, 10)
    assert estado_de("", 0, hoy)["id"] == "nunca"
    assert estado_de("2026-10-09", 0, hoy)["id"] == "sin-empezar"
    assert estado_de("2026-10-08T10:00:00Z", 3, hoy)["id"] == "activo"
    assert estado_de("2026-10-04", 3, hoy)["id"] == "enfriando"
    e = estado_de("2026-09-30", 3, hoy)
    assert e["id"] == "descolgado" and e["dias"] == 10


async def test_listar_alumnos_con_la_base(db, org, user_role, regular_user, course, chapter, activity, monkeypatch):
    from src.db.student_progress import StudentProgress, StudentVisitDay
    from src.db.trail_steps import TrailStep
    from src.services.panel import avance as avance_mod

    monkeypatch.setattr(avance_mod, "FORMACION_UUID", "test")
    monkeypatch.setattr("src.services.panel.alumnos.STUDENT_ROLE_ID", user_role.id)
    ahora = str(datetime.now())
    db.add(TrailStep(trailrun_id=1, trail_id=1, activity_id=activity.id, course_id=course.id, org_id=org.id,
                     complete=True, teacher_verified=False, grade="", user_id=regular_user.id,
                     creation_date=ahora, update_date=ahora))
    db.add(StudentProgress(user_id=regular_user.id, last_visit_date="2026-10-01",
                           current_position={"activity_uuid": activity.activity_uuid, "updated_at": "2026-10-02T08:00:00Z"}))
    db.add(StudentVisitDay(user_id=regular_user.id, day="2026-09-30"))
    await db.commit()

    r = await listar_alumnos(org.id, db)
    assert len(r["alumnos"]) == 1
    a = r["alumnos"][0]
    assert a["hechas"] == 1 and a["total"] == 1
    assert a["donde"]["clase"] == "Test Activity"
    assert a["dias_que_entro"] == 2

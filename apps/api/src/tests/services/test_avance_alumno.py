"""Por dónde va el alumno: se cuenta por clases del curso, no por lecciones."""

from src.services.panel.avance import resumir_avance

CLASES = [
    {"id": 1, "modulo": "Módulo 1", "clase": "1.1 Samenvatting"},
    {"id": 2, "modulo": "Módulo 1", "clase": "1.2 Flashcards"},
    {"id": 3, "modulo": "Módulo 1", "clase": "1.3 Oefening"},
    {"id": 4, "modulo": "Módulo 2", "clase": "2.1 Samenvatting"},
]


def test_sin_nada_hecho_le_toca_la_primera():
    a = resumir_avance(CLASES, {})
    assert a["hechas"] == 0 and a["total"] == 4 and a["pct"] == 0
    assert a["ultima"] is None
    assert a["siguiente"] == {"modulo": "Módulo 1", "clase": "1.1 Samenvatting"}


def test_cuenta_clases_y_reparte_por_modulo():
    a = resumir_avance(CLASES, {1: "2026-10-01", 2: "2026-10-02"})
    assert a["hechas"] == 2 and a["pct"] == 50
    assert a["modulos"] == [
        {"nombre": "Módulo 1", "hechas": 2, "total": 3},
        {"nombre": "Módulo 2", "hechas": 0, "total": 1},
    ]
    assert a["siguiente"]["clase"] == "1.3 Oefening"


def test_la_ultima_es_por_fecha_y_la_siguiente_por_orden():
    # Se saltó la 1.2 y ya hizo la 2.1: lo último que hizo es la 2.1, pero lo
    # que le falta primero es la 1.2.
    a = resumir_avance(CLASES, {1: "2026-10-01", 3: "2026-10-02", 4: "2026-10-03"})
    assert a["ultima"]["clase"] == "2.1 Samenvatting"
    assert a["siguiente"]["clase"] == "1.2 Flashcards"


def test_clases_que_ya_no_estan_en_el_curso_no_cuentan():
    a = resumir_avance(CLASES, {1: "2026-10-01", 99: "2026-10-05"})
    assert a["hechas"] == 1
    assert a["ultima"]["clase"] == "1.1 Samenvatting"


def test_todo_hecho_no_hay_siguiente():
    a = resumir_avance(CLASES, {i: f"2026-10-0{i}" for i in (1, 2, 3, 4)})
    assert a["pct"] == 100 and a["siguiente"] is None


# --- Con la base de datos: la consulta de verdad ----------------------------

from datetime import datetime  # noqa: E402

from src.db.trail_steps import TrailStep  # noqa: E402
from src.services.panel import avance as avance_mod  # noqa: E402


async def test_avance_formacion_lee_las_clases_hechas(db, org, course, chapter, activity, regular_user, monkeypatch):
    monkeypatch.setattr(avance_mod, "FORMACION_UUID", "test")
    db.add(
        TrailStep(
            trailrun_id=1,
            trail_id=1,
            activity_id=activity.id,
            course_id=course.id,
            org_id=org.id,
            complete=True,
            teacher_verified=False,
            grade="",
            user_id=regular_user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db.commit()

    a = (await avance_mod.avance_formacion(db, [regular_user.id]))[regular_user.id]
    assert a["hechas"] == 1 and a["total"] == 1
    assert a["ultima"]["modulo"] == "Test Chapter"
    assert a["ultima"]["clase"] == "Test Activity"


async def test_sin_curso_de_formacion_no_rompe(db, regular_user):
    assert await avance_mod.avance_formacion(db, [regular_user.id]) == {}

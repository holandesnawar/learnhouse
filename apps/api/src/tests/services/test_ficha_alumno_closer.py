"""La ficha del alumno para los closers (23/11/2026): cómo va UNA persona,
con la puerta de contactos y «Qué ven los closers», y sin dinero."""

from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

import src.db.enrollment  # noqa: F401 — la lista lee el WhatsApp de la matrícula: la tabla tiene que existir
from src.services.panel import alcance as AL
from src.services.panel.alumnos import alumno_de_la_ficha, listar_alumnos, sin_dinero


def _claves(dato, salida=None):
    """Todas las claves de un dato, también las de dentro."""
    salida = set() if salida is None else salida
    if isinstance(dato, dict):
        for k, v in dato.items():
            salida.add(str(k))
            _claves(v, salida)
    elif isinstance(dato, list):
        for x in dato:
            _claves(x, salida)
    return salida


def test_sin_dinero_quita_lo_de_dinero_y_deja_lo_demas():
    fila = {
        "user_id": 7,
        "nombre": "Ana",
        "pct": 40,
        # El plan de ESTUDIO (su objetivo): se queda.
        "plan": {"objetivo": "Trabajo", "dias": "lunes y jueves", "minutos": 20},
        "sin_avanzar": {"atascado": True, "dias": 15},
        "modulos": [{"nombre": "MODULE 1", "hechas": 3, "total": 10}],
        # Nada de esto existe hoy en la fila: si alguien lo añade, no sale.
        "total_cents": 59700,
        "cobrado_cents": 23000,
        "pagos": [{"importe_cents": 23000}],
        "comision": {"estimada_cents": 8900},
        "venta": {"vendido_cents": 69000},
        "dentro": {"precio": 597, "apagado": True},
    }
    limpia = sin_dinero(fila)
    assert limpia["plan"] == fila["plan"] and limpia["modulos"] == fila["modulos"]
    assert limpia["sin_avanzar"] == fila["sin_avanzar"]
    # «apagado» no es dinero aunque se parezca a «pagado».
    assert limpia["dentro"] == {"apagado": True}
    for clave in ("total_cents", "cobrado_cents", "pagos", "comision", "venta"):
        assert clave not in limpia
    assert sin_dinero(None) is None and sin_dinero([{"importe": 1, "a": 2}]) == [{"a": 2}]


async def _con_un_alumno(db, org, user_role, regular_user, course, activity, monkeypatch):
    from src.db.student_progress import StudentProgress
    from src.db.trail_steps import TrailStep
    from src.services.panel import avance as avance_mod

    monkeypatch.setattr(avance_mod, "FORMACION_UUID", "test")
    monkeypatch.setattr("src.services.panel.alumnos.STUDENT_ROLE_ID", user_role.id)
    ahora = str(datetime.now())
    db.add(TrailStep(trailrun_id=1, trail_id=1, activity_id=activity.id, course_id=course.id, org_id=org.id,
                     complete=True, teacher_verified=False, grade="", user_id=regular_user.id,
                     creation_date=ahora, update_date=ahora))
    db.add(StudentProgress(user_id=regular_user.id, last_visit_date="2026-11-20"))
    await db.commit()


async def test_la_fila_de_una_persona_es_la_misma_de_progreso(db, org, user_role, regular_user, course, chapter, activity, monkeypatch):
    await _con_un_alumno(db, org, user_role, regular_user, course, activity, monkeypatch)

    todos = (await listar_alumnos(org.id, db))["alumnos"]
    solo = (await listar_alumnos(org.id, db, solo=regular_user.id))["alumnos"]
    assert len(todos) == 1 and solo == todos
    # Otra cuenta: nadie.
    assert (await listar_alumnos(org.id, db, solo=999))["alumnos"] == []

    r = await alumno_de_la_ficha(org.id, "  Regular@Test.com ", db)
    assert r["alumno"]["user_id"] == regular_user.id
    assert r["alumno"]["hechas"] == 1 and r["alumno"]["total"] == 1
    if r["camino"] is not None:
        assert r["camino"]["user_id"] == regular_user.id and "clases_directo" in r["camino"]
    # Ni un campo de dinero, en ningún nivel.
    for clave in _claves(r):
        assert not any(p in clave.lower() for p in ("cents", "importe", "comision", "vendido", "cobrado", "precio")), clave


async def test_sin_cuenta_de_alumno_no_hay_fila(db, org, user_role, regular_user, course, chapter, activity, admin_user, monkeypatch):
    await _con_un_alumno(db, org, user_role, regular_user, course, activity, monkeypatch)
    assert await alumno_de_la_ficha(org.id, "nadie@test.com", db) == {"alumno": None, "camino": None}
    assert await alumno_de_la_ficha(org.id, "", db) == {"alumno": None, "camino": None}
    # Un administrador tiene cuenta, pero no es alumno: tampoco.
    assert await alumno_de_la_ficha(org.id, admin_user.email, db) == {"alumno": None, "camino": None}


async def test_la_ruta_respeta_lo_que_ve_cada_closer(db, org, user_role, regular_user, course, chapter, activity, monkeypatch):
    from src.routers import panel as R

    await _con_un_alumno(db, org, user_role, regular_user, course, activity, monkeypatch)

    async def puerta(*_a, **_k):
        return None

    monkeypatch.setattr(R, "exigir_acceso", puerta)

    class Closer:
        id = 4

    def filtro(valor):
        async def leer(*_a, **_k):
            return valor
        return leer

    # «Solo lo suyo» y la lleva otro closer: 403, como en /cliente.
    with patch("src.services.panel.alcance.filtro_de", filtro(AL.Filtro(4, False, {"regular@test.com": 5}))):
        with pytest.raises(HTTPException) as e:
            await R.api_alumno_de_la_ficha(None, org.id, "regular@test.com", Closer(), db)
        assert e.value.status_code == 403
    # «Solo lo suyo» y no la lleva nadie: tampoco.
    with patch("src.services.panel.alcance.filtro_de", filtro(AL.Filtro(4, False, {}))):
        with pytest.raises(HTTPException):
            await R.api_alumno_de_la_ficha(None, org.id, "regular@test.com", Closer(), db)
    # Es suya: la ve.
    with patch("src.services.panel.alcance.filtro_de", filtro(AL.Filtro(4, False, {"regular@test.com": 4}))):
        r = await R.api_alumno_de_la_ficha(None, org.id, "regular@test.com", Closer(), db)
        assert r["alumno"]["email"] == "regular@test.com"
    # «Todo» (o un administrador): sin filtro.
    with patch("src.services.panel.alcance.filtro_de", filtro(None)):
        r = await R.api_alumno_de_la_ficha(None, org.id, "regular@test.com", Closer(), db)
        assert r["alumno"]["user_id"] == regular_user.id


async def test_alumnos_y_camino_siguen_siendo_solo_de_administradores(db, org, monkeypatch):
    """La ruta nueva no abre las de siempre: un closer sigue sin la lista entera."""
    from src.routers import panel as R

    async def puerta(*_a, **_k):
        return None

    async def no_admin(*_a, **_k):
        return False

    monkeypatch.setattr(R, "exigir_acceso", puerta)
    monkeypatch.setattr(R, "_es_admin", no_admin)

    class Closer:
        id = 4

    for ruta in (R.api_alumnos, R.api_camino):
        with pytest.raises(HTTPException) as e:
            await ruta(None, org.id, Closer(), db)
        assert e.value.status_code == 403

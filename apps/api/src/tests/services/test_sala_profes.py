"""La sala de profes (08/11/2026): el tablero de tareas del equipo y el manual,
contra una base de datos de verdad (SQLite en memoria)."""

import pytest

from src.services.equipo import equipo as E


class Persona:
    def __init__(self, id=1, first_name="Sanne", last_name="de Vries", username="sanne"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


EQUIPO = [{"id": 1, "nombre": "Sanne de Vries", "rol": "Profe", "avatar": ""}, {"id": 2, "nombre": "Rida", "rol": "Dirección", "avatar": ""}]


@pytest.fixture(autouse=True)
def _equipo(monkeypatch):
    async def miembros(org_id, db):
        return EQUIPO

    monkeypatch.setattr(E, "miembros", miembros)


async def test_crear_mover_y_borrar_tareas(db):
    a = await E.crear_tarea(1, {"titulo": "Subir la presentación de De kleding", "fecha": "2026-11-10", "prioridad": "alta", "course_uuid": "course_abc"}, Persona(), db)
    assert a["estado"] == "por-hacer" and a["prioridad"] == "alta" and a["course_uuid"] == "abc"
    assert a["creado_por"] == "Sanne de Vries" and a["asignado_id"] == 0
    b = await E.crear_tarea(1, {"titulo": "Corregir tareas", "asignado_id": 2}, Persona(), db)
    assert b["asignado"] == "Rida"
    # La nueva va la primera de su columna.
    assert [t["id"] for t in await E.listar_tareas(1, db)] == [b["id"], a["id"]]

    # Mover a «Hecho» apunta cuándo; volver a «En curso» lo quita.
    hecha = await E.cambiar_tarea(1, a["id"], {"estado": "hecho"}, db)
    assert hecha["estado"] == "hecho" and hecha["done_at"]
    de_vuelta = await E.cambiar_tarea(1, a["id"], {"estado": "en-curso", "orden": 5}, db)
    assert de_vuelta["done_at"] == "" and de_vuelta["orden"] == 5

    # A alguien de fuera del equipo, no.
    with pytest.raises(E.EquipoError):
        await E.cambiar_tarea(1, a["id"], {"asignado_id": 99}, db)
    # Sin título, no.
    with pytest.raises(E.EquipoError):
        await E.crear_tarea(1, {"titulo": "  "}, Persona(), db)
    # Otra escuela no la ve ni la toca.
    with pytest.raises(E.EquipoError):
        await E.cambiar_tarea(2, a["id"], {"titulo": "x"}, db)

    # Borra quien la creó o un administrador; otro profe, no.
    with pytest.raises(E.EquipoError) as exc:
        await E.borrar_tarea(1, a["id"], user_id=7, es_admin=False, db_session=db)
    assert exc.value.status == 403
    await E.borrar_tarea(1, a["id"], user_id=1, es_admin=False, db_session=db)
    await E.borrar_tarea(1, b["id"], user_id=7, es_admin=True, db_session=db)
    assert await E.listar_tareas(1, db) == []


def test_lo_que_me_toca():
    tareas = [
        {"id": 1, "estado": "por-hacer", "asignado_id": 0, "fecha": "", "prioridad": "normal", "orden": 0},
        {"id": 2, "estado": "por-hacer", "asignado_id": 5, "fecha": "2026-11-09", "prioridad": "normal", "orden": 0},
        {"id": 3, "estado": "hecho", "asignado_id": 5, "fecha": "2026-11-01", "prioridad": "normal", "orden": 0},
        {"id": 4, "estado": "en-curso", "asignado_id": 6, "fecha": "2026-11-01", "prioridad": "alta", "orden": 0},
        {"id": 5, "estado": "en-curso", "asignado_id": 5, "fecha": "2026-11-01", "prioridad": "normal", "orden": 0},
    ]
    assert [t["id"] for t in E.mias_pendientes(tareas, 5, "2026-11-08")] == [5, 2, 1]
    assert E.vencida(tareas[4], "2026-11-08") and not E.vencida(tareas[2], "2026-11-08")


async def test_el_manual_y_su_plantilla(db):
    docs = await E.sembrar_plantilla(1, Persona(id=2, first_name="Rida", last_name=""), db)
    assert len(docs) == len(E.PLANTILLA) and docs[0]["titulo"] == "Preparar la semana"
    # La plantilla nunca pisa lo que ya hay.
    with pytest.raises(E.EquipoError) as exc:
        await E.sembrar_plantilla(1, Persona(), db)
    assert exc.value.status == 409

    nuevo = await E.crear_doc(1, {"titulo": "Cómo cambiar el día de una clase", "seccion": "Clases", "texto": "- Paso"}, Persona(), db)
    assert nuevo["orden"] == len(E.PLANTILLA) + 1
    cambiado = await E.cambiar_doc(1, nuevo["id"], {"texto": "## Nuevo\n- Otro paso"}, Persona(id=2, first_name="Rida", last_name=""), db)
    assert cambiado["texto"].startswith("## Nuevo") and cambiado["actualizado_por"] == "Rida"
    await E.borrar_doc(1, nuevo["id"], db)
    assert len(await E.listar_docs(1, db)) == len(E.PLANTILLA)
    assert await E.listar_docs(2, db) == []


def test_monitores_y_spreekclub():
    from src.services.equipo import monitores as M

    assert M.es_grupo_monitores("Monitores") and M.es_grupo_monitores(" monitor ") and M.es_grupo_monitores("Monitóres")
    assert not M.es_grupo_monitores("Programa nuevo") and not M.es_grupo_monitores("Testers")
    assert M.es_spreekclub("Spreekclub · Groep rood") and M.es_spreekclub("Spreek club")
    assert M.es_spreekclub("Spreken Club") and M.es_spreekclub("Spreekuur")
    assert not M.es_spreekclub("Clase semanal") and not M.es_spreekclub("Masterclass")
    # Desde el 09/11: el monitor ve también la Masterclass, nunca la clase semanal.
    assert M.es_clase_del_monitor("Masterclass") and M.es_clase_del_monitor("Spreken Club")
    assert not M.es_clase_del_monitor("Clase semanal · Groep rood") and not M.es_clase_del_monitor("Formación Nawar A0-A1")


async def test_la_invitacion_de_monitores_entra_ya_como_monitor(db):
    """Quien entra con una invitación del grupo «Monitores» pasa a profe (rol 5)
    en el acto: no ve la escuela como alumno ni un momento. Otra invitación,
    un administrador o alguien que ya no es alumno, no se tocan."""
    from src.db.user_organizations import UserOrganization
    from src.db.usergroups import UserGroup
    from src.services.equipo import monitores as M

    mon = UserGroup(name="Monitores", description="", org_id=1)
    otro = UserGroup(name="Programa nuevo", description="", org_id=1)
    db.add(mon)
    db.add(otro)
    for uid, rol in ((10, 4), (11, 4), (12, 1)):
        db.add(UserOrganization(user_id=uid, org_id=1, role_id=rol, creation_date="", update_date=""))
    await db.commit()

    assert await M.al_entrar_con_invitacion(10, 1, mon.id, db) is True
    assert await M.al_entrar_con_invitacion(11, 1, otro.id, db) is False
    assert await M.al_entrar_con_invitacion(12, 1, mon.id, db) is False
    assert await M.al_entrar_con_invitacion(10, 1, None, db) is False

    from sqlmodel import select

    roles = {u.user_id: u.role_id for u in (await db.execute(select(UserOrganization))).scalars().all()}
    assert roles == {10: 5, 11: 4, 12: 1}

"""Los profes y las clases en directo (02/11/2026).

Usuario: "hay que hacer que los profes puedan abrir salas, comenzarlas, vean
las semanas y poder ajustar los deberes… la etiqueta que no la pueda cambiar
el profe". Se comprueba que el profe (rol 5, del equipo):
- ve y abre las clases cerradas a un grupo de alumnos en el que no está;
- crea contenido (sus semanas) en una clase en directo, pero no en la
  formación, y no borra;
- enciende la sala y cambia el recuadro, pero no la etiqueta;
- crea y cambia semanas, pero no las quita.
Y que un alumno fuera del grupo sigue sin verla.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.organization_config import OrganizationConfig
from src.db.roles import Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroups import UserGroup
from src.db.users import PublicUser, User
from src.routers import salas as rutas
from src.routers import tareas as rutas_tareas
from src.security.rbac.resource_access import check_resource_access
from src.security.rbac.types import AccessAction
from src.services.courses.courses import get_courses_orgslug
from src.tests.conftest import USER_RIGHTS

AHORA = str(datetime.now())


def _req() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})


async def _escuela(db, org, user_role):
    db.add(Role(id=5, name="Profe", org_id=org.id, role_type=RoleTypeEnum.TYPE_ORGANIZATION, role_uuid="role_profe",
                rights=USER_RIGHTS.model_dump(), creation_date=AHORA, update_date=AHORA))
    db.add(OrganizationConfig(org_id=org.id, config={"salas": {"directo1": {"activo": False, "directo": True}}},
                              creation_date=AHORA, update_date=AHORA))
    for i, uuid in ((11, "course_directo1"), (12, "course_formacion1")):
        db.add(Course(id=i, name=uuid, description="", public=False, published=True, open_to_contributors=False,
                      org_id=org.id, course_uuid=uuid, creation_date=AHORA, update_date=AHORA))
    # Las dos, cerradas a «Programa nuevo», donde no está nadie de estas pruebas.
    db.add(UserGroup(id=30, name="Programa nuevo", description="", org_id=org.id, usergroup_uuid="ug_prog",
                     creation_date=AHORA, update_date=AHORA))
    await db.commit()
    for uuid in ("course_directo1", "course_formacion1"):
        db.add(UserGroupResource(usergroup_id=30, resource_uuid=uuid, org_id=org.id, creation_date=AHORA, update_date=AHORA))
    db.add(Chapter(id=40, name="Semana 1", description="", org_id=org.id, course_id=11, chapter_uuid="chapter_s1",
                   creation_date=AHORA, update_date=AHORA))
    db.add(CourseChapter(chapter_id=40, course_id=11, org_id=org.id, order=1, creation_date=AHORA, update_date=AHORA))
    await db.commit()


async def _persona(db, org, uid: int, rol: int) -> PublicUser:
    db.add(User(id=uid, username=f"u{uid}", first_name="Paul" if rol == 5 else "Ana", last_name="", email=f"u{uid}@x.com",
                password="x", user_uuid=f"user_{uid}", creation_date=AHORA, update_date=AHORA))
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=rol, creation_date=AHORA, update_date=AHORA))
    await db.commit()
    return PublicUser(id=uid, username=f"u{uid}", first_name="Paul" if rol == 5 else "Ana", last_name="",
                      email=f"u{uid}@x.com", user_uuid=f"user_{uid}")


async def _puede(db, persona, recurso, accion) -> bool:
    return (await check_resource_access(_req(), db, persona, recurso, accion, raise_on_deny=False)).allowed


async def test_el_profe_ve_las_clases_cerradas_y_el_alumno_de_fuera_no(db, org, user_role):
    await _escuela(db, org, user_role)
    profe = await _persona(db, org, 60, 5)
    alumno = await _persona(db, org, 61, 4)

    assert await _puede(db, profe, "course_directo1", AccessAction.READ)
    assert not await _puede(db, alumno, "course_directo1", AccessAction.READ)

    # En su lista (la barra de la escuela) le salen; al alumno de fuera, no.
    del_profe = {c.course_uuid for c in await get_courses_orgslug(_req(), profe, org.slug, db, 1, 50)}
    del_alumno = {c.course_uuid for c in await get_courses_orgslug(_req(), alumno, org.slug, db, 1, 50)}
    assert {"course_directo1", "course_formacion1"} <= del_profe
    assert "course_directo1" not in del_alumno


async def test_el_profe_crea_en_la_clase_en_directo_no_en_la_formacion_y_no_borra(db, org, user_role):
    await _escuela(db, org, user_role)
    profe = await _persona(db, org, 60, 5)
    alumno = await _persona(db, org, 61, 4)

    assert await _puede(db, profe, "course_directo1", AccessAction.CREATE)
    assert await _puede(db, profe, "course_directo1", AccessAction.UPDATE)
    assert not await _puede(db, profe, "course_directo1", AccessAction.DELETE)
    assert not await _puede(db, profe, "course_formacion1", AccessAction.CREATE)
    assert not await _puede(db, alumno, "course_directo1", AccessAction.CREATE)


async def test_el_profe_enciende_la_sala_y_cambia_el_recuadro_pero_no_la_etiqueta(db, org, user_role, monkeypatch):
    await _escuela(db, org, user_role)
    profe = await _persona(db, org, 60, 5)
    alumno = await _persona(db, org, 61, 4)

    r = await rutas.api_guardar(_req(), "directo1", rutas.SalaIn(activo=True), profe, db)
    assert r["activo"] is True and r["grabar"] is True
    r = await rutas.api_guardar(_req(), "directo1", rutas.SalaIn(grabar=False), profe, db)
    assert r["grabar"] is True  # se graba siempre (02/11/2026)
    with pytest.raises(HTTPException) as exc:
        await rutas.api_guardar(_req(), "directo1", rutas.SalaIn(etiqueta="Groep rood"), profe, db)
    assert exc.value.status_code == 403 and "administrador" in exc.value.detail
    assert (await rutas.api_recuadro(_req(), "directo1", rutas.RecuadroIn(teacher="Paul"), profe, db))["teacher"] == "Paul"

    with pytest.raises(HTTPException) as exc:
        await rutas.api_guardar(_req(), "directo1", rutas.SalaIn(activo=False), alumno, db)
    assert exc.value.status_code == 403


async def test_el_profe_crea_y_cambia_semanas_pero_no_las_quita(db, org, user_role):
    await _escuela(db, org, user_role)
    profe = await _persona(db, org, 60, 5)

    r = await rutas_tareas.api_crear_semana(
        _req(), "directo1",
        rutas_tareas.SemanaIn(chapter_uuid="chapter_s1", tema="Saludos", fecha="2026-11-09", enunciado="Preséntate"),
        profe, db,
    )
    semana_id = r["semana"]["id"]
    r = await rutas_tareas.api_editar_semana(semana_id, rutas_tareas.SemanaIn(enunciado="Preséntate en 1 minuto"), profe, db)
    assert r["semana"]["enunciado"] == "Preséntate en 1 minuto"
    with pytest.raises(HTTPException) as exc:
        await rutas_tareas.api_borrar_semana(semana_id, profe, db)
    assert exc.value.status_code == 403

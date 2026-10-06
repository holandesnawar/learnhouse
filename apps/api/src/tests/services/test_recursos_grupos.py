"""Recursos por grupos (06/10/2026): «el grupo de closers solo puede ver la
carpeta comercial; el admin ve todo»."""

import json

import pytest

from src.db.organizations import Organization
from src.db.recursos import FolderWrite, ResourceFolder
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.services.recursos.recursos import (
    _grupos_validos,
    crear_carpeta,
    leer_grupos,
    listar,
    puede_ver,
    quien_soy,
)


def test_leer_grupos_aguanta_basura():
    assert leer_grupos("") == []
    assert leer_grupos("no es json") == []
    assert leer_grupos('{"a": 1}') == []
    assert leer_grupos('[3, "7", "alumnos", "otro", null]') == [3, 7, "alumnos"]


def test_puede_ver():
    # Sin grupos: todos, salvo que sea privada.
    assert puede_ver(False, [], False, set())
    assert not puede_ver(True, [], False, {"alumnos"})
    # Con grupos: solo quien esté en alguno (lo de privada ya no cuenta).
    assert puede_ver(True, [5], False, {5})
    assert not puede_ver(False, [5], False, {"alumnos"})
    assert puede_ver(False, ["alumnos", 5], False, {"alumnos"})
    # El administrador, todo.
    assert puede_ver(True, [5], True, set())


async def _escena(db):
    db.add(Organization(id=2, name="Otra", slug="otra", email="o@o.com", org_uuid="org_otra"))
    db.add(UserGroup(id=10, org_id=1, name="Closers", description="", usergroup_uuid="ug_1"))
    db.add(UserGroup(id=20, org_id=2, name="De otra escuela", description="", usergroup_uuid="ug_2"))
    # 100 = closer (rol 6, en el grupo), 200 = alumno, 300 = administrador.
    db.add(UserOrganization(user_id=100, org_id=1, role_id=6, creation_date="", update_date=""))
    db.add(UserOrganization(user_id=200, org_id=1, role_id=4, creation_date="", update_date=""))
    db.add(UserOrganization(user_id=300, org_id=1, role_id=1, creation_date="", update_date=""))
    db.add(UserGroupUser(user_id=100, usergroup_id=10, org_id=1, creation_date="", update_date=""))
    await db.commit()
    for nombre, private, grupos in [
        ("Comercial", False, [10]),
        ("Módulo 1", False, ["alumnos"]),
        ("Para todos", False, []),
        ("Facturas", True, []),
    ]:
        await crear_carpeta(1, FolderWrite(name=nombre, private=private, grupos=grupos), db)


async def _ve(db, user_id):
    es_admin, mios = await quien_soy(user_id, 1, db)
    return [c["name"] for c in await listar(1, db, es_admin=es_admin, mios=mios)]


@pytest.mark.asyncio
async def test_cada_uno_ve_lo_suyo(db, org):
    await _escena(db)
    assert await _ve(db, 100) == ["Comercial", "Para todos"]
    assert await _ve(db, 200) == ["Módulo 1", "Para todos"]
    assert await _ve(db, 300) == ["Comercial", "Módulo 1", "Para todos", "Facturas"]
    # El panel las enseña todas, con sus grupos.
    todas = await listar(1, db, con_privadas=True)
    assert [c["grupos"] for c in todas] == [[10], ["alumnos"], [], []]


@pytest.mark.asyncio
async def test_no_se_cuelan_grupos_de_otra_escuela(db, org):
    await _escena(db)
    assert await _grupos_validos(1, [10, 20, "alumnos", 10, "x"], db) == [10, "alumnos"]
    # Pedir «solo estos» con grupos que no valen no la abre a todos.
    f = await crear_carpeta(1, FolderWrite(name="Rara", grupos=[20]), db)
    assert f["grupos"] == [] and f["private"] is True
    assert "Rara" not in await _ve(db, 200)
    guardada = await db.get(ResourceFolder, f["id"])
    assert json.loads(guardada.grupos) == []

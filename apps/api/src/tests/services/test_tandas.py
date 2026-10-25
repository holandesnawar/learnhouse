"""Tandas y grupos automáticos al pagar (25/10/2026): services/panel/tandas.py.

- Quien paga con las tandas encendidas entra en «Programa nuevo» y en el grupo
  de su mes; con ellas apagadas, en ninguno.
- El correo «Alumno nuevo» le llega al equipo siempre, con sus grupos.
- «Beta» mete a los alumnos de antes, no a los del programa nuevo, y repetirlo
  no duplica.
- Quién ve un curso o un canal, con el aviso del curso con grupo pero público.
"""

from datetime import datetime
from unittest.mock import patch

from sqlmodel import select

from src.db.communities.communities import Community  # noqa: F401 (crea su tabla en la base de pruebas)
from src.db.courses.courses import Course  # noqa: F401
from src.db.organization_config import OrganizationConfig
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.panel import tandas

DOMINGO = datetime(2026, 10, 25, 12, tzinfo=tandas.ZONA)
LUNES = datetime(2026, 10, 26, 9, tzinfo=tandas.ZONA)


def test_nombre_de_la_tanda_por_mes_o_fijo():
    assert tandas.nombre_tanda("2026-10-26") == "Matrícula octubre 2026"
    assert tandas.nombre_tanda("2026-11-03") == "Matrícula noviembre 2026"
    assert tandas.nombre_tanda("2026-10-26", " Matrícula noviembre 2026 ") == "Matrícula noviembre 2026"


def test_desde_cuando_toca():
    cfg = tandas.leer_config({"activo": True, "desde": "2026-10-26"})
    assert not tandas.toca(cfg, "2026-10-25") and tandas.toca(cfg, "2026-10-26")
    assert not tandas.toca(tandas.leer_config({"activo": False, "desde": "2026-10-01"}), "2026-10-26")
    # Encendidas sin fecha: desde ya.
    assert tandas.toca(tandas.leer_config({"activo": True}), "2026-10-26")
    assert tandas.leer_config("basura") == {"activo": False, "desde": "", "programa_id": 0, "tanda": ""}


def test_quien_ve_cada_curso_o_canal():
    assert tandas.quien_lo_ve(False, ["Beta"])["texto"] == "Solo Beta"
    assert tandas.quien_lo_ve(False, [])["texto"] == "Todos los que han entrado"
    publico_con_grupo = tandas.quien_lo_ve(True, ["Beta"])
    assert publico_con_grupo["texto"] == "Todo el mundo" and publico_con_grupo["aviso"]
    assert tandas.quien_lo_ve(True, ["Beta"], publicado=False)["texto"].startswith("Sin publicar")


async def _escuela(db, org, cfg=None):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0", **({"tandas": cfg} if cfg else {})},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()


async def _alumno(db, org, uid: int, email: str) -> User:
    u = User(id=uid, username=f"u{uid}", first_name=f"Alumno{uid}", last_name="", email=email,
             password="x", user_uuid=f"user_{uid}", creation_date=str(datetime.now()), update_date=str(datetime.now()))
    db.add(u)
    await db.commit()
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=tandas.ROL_ALUMNO,
                            creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()
    return u


async def _grupos_de(db, uid: int) -> set[str]:
    ids = (await db.execute(select(UserGroupUser.usergroup_id).where(UserGroupUser.user_id == uid))).scalars().all()
    return {g.name for g in (await db.execute(select(UserGroup))).scalars().all() if g.id in ids}


async def test_con_las_tandas_encendidas_entra_en_el_programa_y_en_su_mes(db, org):
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com")
    # El domingo todavía no toca.
    assert await tandas.asignar(ana.id, org.id, db, ahora=DOMINGO) == []
    assert await tandas.asignar(ana.id, org.id, db, ahora=LUNES) == ["Programa nuevo", "Matrícula octubre 2026"]
    assert await _grupos_de(db, ana.id) == {"Programa nuevo", "Matrícula octubre 2026"}
    # El grupo del programa queda apuntado: renombrarlo no rompe nada.
    cfg = await tandas.config(db, org.id)
    programa = (await db.execute(select(UserGroup).where(UserGroup.id == cfg["programa_id"]))).scalars().one()
    programa.name = "Masterclass + Spreekuren"
    db.add(programa)
    await db.commit()
    beto = await _alumno(db, org, 11, "beto@x.com")
    assert await tandas.asignar(beto.id, org.id, db, ahora=LUNES) == ["Masterclass + Spreekuren", "Matrícula octubre 2026"]
    assert len((await db.execute(select(UserGroup))).scalars().all()) == 2
    # Repetir no duplica.
    await tandas.asignar(beto.id, org.id, db, ahora=LUNES)
    assert len((await db.execute(select(UserGroupUser).where(UserGroupUser.user_id == beto.id))).scalars().all()) == 2


async def test_una_tanda_con_nombre_fijo(db, org):
    await _escuela(db, org, {"activo": True, "tanda": "Matrícula noviembre 2026"})
    ana = await _alumno(db, org, 10, "ana@x.com")
    assert await tandas.asignar(ana.id, org.id, db, ahora=LUNES) == ["Programa nuevo", "Matrícula noviembre 2026"]


async def test_apagadas_no_mete_en_nada_pero_avisa_al_equipo(db, org):
    await _escuela(db, org)
    ana = await _alumno(db, org, 10, "ana@x.com")
    enviados = []

    async def admins(_db):
        return ["rida@x.com"]

    with patch("src.services.contactos.llamadas.emails_de_administradores", admins), patch(
        "src.services.users.emails.send_alumno_nuevo_email", lambda to, datos: enviados.append((to, datos))
    ):
        assert await tandas.al_entrar(ana, "Ana Gil", "ana@x.com", db) == []
    assert enviados == [("rida@x.com", {"nombre": "Ana Gil", "email": "ana@x.com", "telefono": "", "grupos": []})]
    assert await _grupos_de(db, ana.id) == set()


async def test_al_entrar_con_tandas_dice_los_grupos_y_sin_aviso_no_escribe(db, org):
    await _escuela(db, org, {"activo": True})
    ana = await _alumno(db, org, 10, "ana@x.com")
    enviados = []

    async def admins(_db):
        return ["rida@x.com"]

    with patch("src.services.contactos.llamadas.emails_de_administradores", admins), patch(
        "src.services.users.emails.send_alumno_nuevo_email", lambda to, datos: enviados.append(datos["grupos"])
    ):
        grupos = await tandas.al_entrar(ana, "Ana", "ana@x.com", db)
        beto = await _alumno(db, org, 11, "beto@x.com")
        await tandas.al_entrar(beto, "Beto", "beto@x.com", db, avisar=False)
    assert grupos[0] == "Programa nuevo" and grupos[1].startswith("Matrícula ")
    assert enviados == [grupos]  # el alta a mano no escribe al equipo
    assert "Programa nuevo" in await _grupos_de(db, beto.id)


async def test_beta_mete_a_los_de_antes_y_no_a_los_nuevos(db, org):
    await _escuela(db, org, {"activo": True})
    viejos = [await _alumno(db, org, i, f"v{i}@x.com") for i in (10, 11, 12)]
    nueva = await _alumno(db, org, 13, "nueva@x.com")
    await tandas.asignar(nueva.id, org.id, db, ahora=LUNES)

    r = await tandas.meter_en_beta(org.id, db)
    assert r == {"ok": True, "grupo": "Beta", "entran": 3, "total": 3}
    for v in viejos:
        assert "Beta" in await _grupos_de(db, v.id)
    assert "Beta" not in await _grupos_de(db, nueva.id)
    # Otra vez: no entra nadie más.
    assert (await tandas.meter_en_beta(org.id, db))["entran"] == 0

    res = await tandas.resumen(org.id, db)
    assert res["alumnos"] == 4 and res["alumnos_sin_grupo"] == 0
    por_nombre = {g["nombre"]: g for g in res["grupos"]}
    assert por_nombre["Beta"]["alumnos"] == 3 and por_nombre["Beta"]["es_beta"]
    assert por_nombre["Programa nuevo"]["es_programa"] and por_nombre["Programa nuevo"]["alumnos"] == 1


# ── la campana y los «sin leer», solo de los canales que se ven ────────────


def test_quien_puede_abrir_un_canal():
    from src.services.communities.engagement import puede_ver_canal

    assert puede_ver_canal(True, {1}, set())  # público: todos, aunque tenga grupo
    assert puede_ver_canal(False, set(), set())  # sin grupo: cualquiera que entra
    assert puede_ver_canal(False, {1, 2}, {2})
    assert not puede_ver_canal(False, {1}, {2})


async def test_un_alumno_nuevo_no_ve_los_canales_de_la_beta(db, org):
    from src.db.communities.communities import Community
    from src.db.usergroup_resources import UserGroupResource
    from src.services.communities.engagement import _canales_que_ve

    await _escuela(db, org, {"activo": True})
    viejo = await _alumno(db, org, 10, "viejo@x.com")
    nueva = await _alumno(db, org, 11, "nueva@x.com")
    await tandas.asignar(nueva.id, org.id, db, ahora=LUNES)
    await tandas.meter_en_beta(org.id, db)
    beta = (await db.execute(select(UserGroup).where(UserGroup.name == "Beta"))).scalars().one()
    cfg = await tandas.config(db, org.id)

    canales = {}
    for nombre, publico in (("General beta", False), ("Spreekuren", False), ("Avisos", True)):
        c = Community(name=nombre, public=publico, org_id=org.id, community_uuid=f"community_{nombre}")
        db.add(c)
        await db.commit()
        await db.refresh(c)
        canales[nombre] = c.id
    db.add(UserGroupResource(usergroup_id=beta.id, resource_uuid="community_General beta", org_id=org.id))
    db.add(UserGroupResource(usergroup_id=cfg["programa_id"], resource_uuid="community_Spreekuren", org_id=org.id))
    await db.commit()

    assert await _canales_que_ve(viejo.id, [org.id], db) == {canales["General beta"], canales["Avisos"]}
    assert await _canales_que_ve(nueva.id, [org.id], db) == {canales["Spreekuren"], canales["Avisos"]}


# ── avisos por correo solo a un grupo ──────────────────────────────────────


async def test_un_aviso_de_grupo_solo_le_llega_a_ese_grupo(db, org):
    from src.db.usergroup_resources import UserGroupResource
    from src.services.notifications.broadcast import grupos_del_aviso, list_org_recipients

    await _escuela(db, org, {"activo": True})
    await _alumno(db, org, 10, "viejo@x.com")
    nueva = await _alumno(db, org, 11, "nueva@x.com")
    await tandas.asignar(nueva.id, org.id, db, ahora=LUNES)
    await tandas.meter_en_beta(org.id, db)
    beta = (await db.execute(select(UserGroup).where(UserGroup.name == "Beta"))).scalars().one()

    todos = {e for e, _ in await list_org_recipients(org.id, db)}
    assert todos == {"viejo@x.com", "nueva@x.com"}
    assert {e for e, _ in await list_org_recipients(org.id, db, grupos=[beta.id])} == {"viejo@x.com"}

    # Desde un canal cerrado a la beta: el aviso va a la beta. Desde uno
    # abierto, a todos.
    db.add(Community(name="Beta", public=False, org_id=org.id, community_uuid="community_beta"))
    db.add(Community(name="General", public=True, org_id=org.id, community_uuid="community_general"))
    db.add(UserGroupResource(usergroup_id=beta.id, resource_uuid="community_beta", org_id=org.id))
    await db.commit()
    assert await grupos_del_aviso({"community_uuid": "community_beta"}, db) == [beta.id]
    assert await grupos_del_aviso({"community_uuid": "community_general"}, db) == []
    assert await grupos_del_aviso({"grupos": [beta.id, "x"]}, db) == [beta.id]

"""Tandas: cada alumno nuevo en su grupo (25/10/2026):
services/panel/tandas.py.

- Desde el 31/10, quien paga desde el día del cambio entra SOLO en el
  programa nuevo (`al_pagar`, `entrar_solos`), salvo quien tiene sugerencia de
  beta: ese queda por decidir, con su aviso en la campana del administrador, y
  `decidir` lo pone en el programa nuevo o en la beta (y se puede cambiar).
- Se sugiere la beta a quien antes del cambio estaba en «Por pagar», reservó
  con señal o tenía un enlace de pago.
- «Beta» mete a los alumnos de antes, no a los del programa nuevo ni a los que
  entran desde el cambio, y repetirlo no duplica.
- Quién ve un curso o un canal, con el aviso del curso con grupo pero público.
"""

from datetime import datetime

from sqlmodel import select

from src.db.communities.communities import Community  # noqa: F401 (crea su tabla en la base de pruebas)
from src.db.contact_event import ContactEvent
from src.db.courses.courses import Course  # noqa: F401
from src.db.metric_exclusion import MetricExclusion  # noqa: F401
from src.db.panel_negocio import LeadPipeline
from src.db.reservas import ReservaPlaza
from src.db.organization_config import OrganizationConfig
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.panel import tandas

def test_nombre_de_la_tanda_por_mes_o_fijo():
    assert tandas.nombre_tanda("2026-10-26") == "Matrícula octubre 2026"
    assert tandas.nombre_tanda("2026-11-03") == "Matrícula noviembre 2026"
    assert tandas.nombre_tanda("2026-10-26", " Matrícula noviembre 2026 ") == "Matrícula noviembre 2026"


def test_la_configuracion_con_valores_seguros():
    assert tandas.leer_config("basura") == {"activo": False, "desde": "", "programa_id": 0, "tanda": ""}
    assert tandas.leer_config({"activo": 1, "desde": "2026-10-26T00:00", "programa_id": "7"})["programa_id"] == 7


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


async def _alumno(db, org, uid: int, email: str, entro: str = "", rol: int = tandas.ROL_ALUMNO) -> User:
    """`entro` = cuándo pagó (como lo escribe el servidor: UTC sin zona)."""
    u = User(id=uid, username=f"u{uid}", first_name=f"Alumno{uid}", last_name="", email=email,
             password="x", user_uuid=f"user_{uid}", creation_date=str(datetime.now()), update_date=str(datetime.now()))
    db.add(u)
    await db.commit()
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=rol,
                            creation_date=entro or str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()
    return u


async def _grupos_de(db, uid: int) -> set[str]:
    ids = (await db.execute(select(UserGroupUser.usergroup_id).where(UserGroupUser.user_id == uid))).scalars().all()
    return {g.name for g in (await db.execute(select(UserGroup))).scalars().all() if g.id in ids}


async def test_sin_entrar_solos_quedan_por_decidir(db, org):
    """Quien aún no ha pasado por el alta (o se escapó) sale por decidir."""
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-26 08:00:00")
    beto = await _alumno(db, org, 11, "beto@x.com", entro="2026-10-27 09:00:00")
    pendientes = await tandas.por_decidir(org.id, db)
    assert {p["id"] for p in pendientes} == {ana.id, beto.id}
    assert await _grupos_de(db, ana.id) == set() and await _grupos_de(db, beto.id) == set()


async def test_apagado_no_avisa_de_nadie(db, org):
    await _escuela(db, org, {"activo": False, "desde": "2026-10-26"})
    await _alumno(db, org, 10, "ana@x.com", entro="2026-10-26 08:00:00")
    assert await tandas.por_decidir(org.id, db) == []


async def test_elegir_el_programa_nuevo_y_cambiar_de_idea(db, org):
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-26 08:00:00")
    r = await tandas.decidir(org.id, ana.id, "nuevo", db)
    assert r["ok"] and r["grupos"] == ["Programa nuevo", "Matrícula octubre 2026"]
    assert await _grupos_de(db, ana.id) == {"Programa nuevo", "Matrícula octubre 2026"}
    assert await tandas.por_decidir(org.id, db) == []
    # Repetir no duplica.
    await tandas.decidir(org.id, ana.id, "nuevo", db)
    assert len((await db.execute(select(UserGroupUser).where(UserGroupUser.user_id == ana.id))).scalars().all()) == 2
    # A la beta: fuera del programa y de su tanda.
    await tandas.decidir(org.id, ana.id, "beta", db)
    assert await _grupos_de(db, ana.id) == {"Beta"}
    # El grupo del programa queda apuntado: renombrarlo no rompe nada.
    cfg = await tandas.config(db, org.id)
    programa = (await db.execute(select(UserGroup).where(UserGroup.id == cfg["programa_id"]))).scalars().one()
    programa.name = "Masterclass + Spreekuren"
    db.add(programa)
    await db.commit()
    await tandas.decidir(org.id, ana.id, "nuevo", db)
    assert await _grupos_de(db, ana.id) == {"Masterclass + Spreekuren", "Matrícula octubre 2026"}
    assert not (await tandas.decidir(org.id, ana.id, "otro", db))["ok"]
    assert not (await tandas.decidir(org.id, 999, "beta", db))["ok"]


async def test_la_tanda_va_por_el_mes_en_que_entro_o_con_nombre_fijo(db, org):
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26", "tanda": "Matrícula noviembre 2026"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-31 10:00:00")
    assert (await tandas.decidir(org.id, ana.id, "nuevo", db))["grupos"] == ["Programa nuevo", "Matrícula noviembre 2026"]
    await tandas.guardar(org.id, {"tanda": ""}, db)
    beto = await _alumno(db, org, 11, "beto@x.com", entro="2026-11-02 10:00:00")
    assert (await tandas.decidir(org.id, beto.id, "nuevo", db))["grupos"] == ["Programa nuevo", "Matrícula noviembre 2026"]


def test_quien_podria_ser_de_la_beta():
    desde = "2026-10-26"
    assert tandas.motivo_beta(desde, por_pagar_el="2026-10-20T10:00:00+00:00") == (
        "Estaba en «Por pagar» desde el 20/10, antes del cambio."
    )
    # Desde el cambio, «Por pagar» también es del programa nuevo: no cuenta.
    assert tandas.motivo_beta(desde, por_pagar_el="2026-10-26T12:00:00+00:00") == ""
    # Las 23:30 UTC del 25 son ya las 00:30 del 26 en Países Bajos.
    assert tandas.motivo_beta(desde, senal_el="2026-10-25 23:30:00") == ""
    assert tandas.motivo_beta(desde, senal_el="2026-10-25 21:00:00") == "Reservó plaza con señal el 25/10, antes del cambio."
    assert tandas.motivo_beta(desde, enlace_el="2026-10-22 10:00:00") == "Le creasteis un enlace de pago el 22/10, antes del cambio."
    # Sin día del cambio, nadie es candidato.
    assert tandas.motivo_beta("", por_pagar_el="2026-10-20T10:00:00+00:00") == ""


def test_en_que_programa_esta():
    assert tandas.programa_de({1, 7}, 1, 2) == "nuevo"
    assert tandas.programa_de({2}, 1, 2) == "beta"
    assert tandas.programa_de({1, 2}, 1, 2) == "los dos"
    assert tandas.programa_de({7}, 1, 2) == ""
    assert tandas.programa_de({1}, 0, 0) == ""


async def test_se_sugiere_la_beta_a_quien_venia_de_antes(db, org):
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-27 08:00:00")
    beto = await _alumno(db, org, 11, "beto@x.com", entro="2026-10-27 08:00:00")
    carla = await _alumno(db, org, 12, "carla@x.com", entro="2026-10-27 08:00:00")
    dani = await _alumno(db, org, 13, "dani@x.com", entro="2026-10-27 08:00:00")
    eva = await _alumno(db, org, 14, "eva@x.com", entro="2026-10-27 08:00:00")
    db.add(LeadPipeline(email="Ana@x.com", etapa="pendiente-pago", updated_at="2026-10-20T10:00:00+00:00"))
    db.add(ReservaPlaza(email="beto@x.com", created_at="2026-10-21T10:00:00+00:00"))
    db.add(ContactEvent(email="carla@x.com", kind="enlace-pago", created_at="2026-10-23T10:00:00+00:00"))
    # Una señal cancelada no cuenta, y «Por pagar» desde el cambio tampoco.
    db.add(ReservaPlaza(email="dani@x.com", estado="cancelada", created_at="2026-10-21T10:00:00+00:00"))
    db.add(LeadPipeline(email="eva@x.com", etapa="pendiente-pago", updated_at="2026-10-26T07:00:00+00:00"))
    await db.commit()

    sugerencias = {a["id"]: a["sugerencia"] for a in await tandas.por_decidir(org.id, db, con_motivo=True)}
    assert sugerencias == {ana.id: "beta", beto.id: "beta", carla.id: "beta", dani.id: "nuevo", eva.id: "nuevo"}


async def test_el_resumen_trae_los_nuevos_sin_testers_y_beta_no_los_toca(db, org):
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    viejo = await _alumno(db, org, 10, "viejo@x.com", entro="2026-10-01 10:00:00")
    ana = await _alumno(db, org, 11, "ana@x.com", entro="2026-10-26 08:00:00")
    prueba = await _alumno(db, org, 12, "prueba@x.com", entro="2026-10-27 08:00:00")
    db.add(LeadPipeline(email="ana@x.com", etapa="pendiente-pago", updated_at="2026-10-20T10:00:00+00:00"))
    testers = UserGroup(name="Testers", description="", org_id=org.id, usergroup_uuid="usergroup_t", creation_date="", update_date="")
    db.add(testers)
    await db.commit()
    await db.refresh(testers)
    db.add(UserGroupUser(usergroup_id=testers.id, user_id=prueba.id, org_id=org.id, creation_date="", update_date=""))
    await db.commit()

    # «Beta» solo mete a los de antes del cambio: Ana sigue por decidir.
    assert (await tandas.meter_en_beta(org.id, db))["entran"] == 1
    assert await _grupos_de(db, viejo.id) == {"Beta"}
    assert await _grupos_de(db, ana.id) == set()

    res = await tandas.resumen(org.id, db)
    assert res["alumnos_sin_grupo"] == 0 and res["por_decidir"] == 1
    assert [n["id"] for n in res["nuevos"]] == [ana.id]  # sin la cuenta de prueba
    nueva = res["nuevos"][0]
    assert nueva["programa"] == "" and "Por pagar" in nueva["motivo"] and nueva["sugerencia"] == "beta"


async def test_la_campana_avisa_al_administrador_y_no_al_alumno(db, org):
    from src.services.communities.engagement import _decidir_items

    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    admin = await _alumno(db, org, 1, "rida@x.com", rol=1)
    ana = await _alumno(db, org, 11, "ana@x.com", entro="2026-10-26 08:00:00")
    beto = await _alumno(db, org, 12, "beto@x.com", entro="2026-10-26 09:00:00")
    db.add(LeadPipeline(email="ana@x.com", etapa="pendiente-pago", updated_at="2026-10-20T10:00:00+00:00"))
    await db.commit()

    items = {i["id"]: i for i in await _decidir_items(admin.id, [org.id], db)}
    assert set(items) == {f"tanda:{ana.id}", f"tanda:{beto.id}"}
    assert items[f"tanda:{ana.id}"]["url"] == "/dash/estadisticas?tab=tandas"
    assert "elige su grupo" in items[f"tanda:{ana.id}"]["title"]
    assert "Te sugerimos la beta" in items[f"tanda:{ana.id}"]["excerpt"]
    assert "Te sugerimos" not in items[f"tanda:{beto.id}"]["excerpt"]
    assert await _decidir_items(ana.id, [org.id], db) == []
    await tandas.decidir(org.id, ana.id, "beta", db)
    await tandas.decidir(org.id, beto.id, "nuevo", db)
    assert await _decidir_items(admin.id, [org.id], db) == []


async def test_beta_mete_a_los_de_antes_y_no_a_los_nuevos(db, org):
    await _escuela(db, org, {"activo": True})
    viejos = [await _alumno(db, org, i, f"v{i}@x.com") for i in (10, 11, 12)]
    nueva = await _alumno(db, org, 13, "nueva@x.com")
    await tandas.decidir(org.id, nueva.id, "nuevo", db)

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
    await tandas.decidir(org.id, nueva.id, "nuevo", db)
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
    await tandas.decidir(org.id, nueva.id, "nuevo", db)
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


async def test_cada_alumno_nuevo_entra_solo_en_el_programa_nuevo(db, org):
    """31/10: "cada alumno que entre nuevo tiene que entrar en el grupo de
    Programa nuevo". Menos a quien se le vendió la clase de conversación antes
    del cambio: ese lo sigue eligiendo el equipo."""
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-31 08:00:00")
    beto = await _alumno(db, org, 11, "beto@x.com", entro="2026-10-31 09:00:00")
    viejo = await _alumno(db, org, 12, "viejo@x.com", entro="2026-10-01 09:00:00")
    db.add(LeadPipeline(email="beto@x.com", etapa="pendiente-pago", updated_at="2026-10-20T10:00:00+00:00"))
    await db.commit()

    assert await tandas.al_pagar(org.id, ana.id, db) == "nuevo"
    assert await _grupos_de(db, ana.id) == {"Programa nuevo", "Matrícula octubre 2026"}
    # Beto estaba en «Por pagar» antes del cambio: se queda para elegir.
    assert await tandas.al_pagar(org.id, beto.id, db) == ""
    assert await _grupos_de(db, beto.id) == set()
    assert [a["id"] for a in await tandas.por_decidir(org.id, db)] == [beto.id]
    # El de antes del cambio no se toca nunca.
    assert await tandas.al_pagar(org.id, viejo.id, db) == ""
    assert await _grupos_de(db, viejo.id) == set()
    # Repetirlo (un reintento de Stripe) no duplica.
    assert await tandas.al_pagar(org.id, ana.id, db) == ""
    assert len((await db.execute(select(UserGroupUser).where(UserGroupUser.user_id == ana.id))).scalars().all()) == 2


async def test_meter_a_uno_no_toca_a_los_que_ya_esperaban(db, org):
    """"No toques a los que están": al entrar Ana, Bea (que pagó antes y sigue
    sin grupo) se queda como estaba."""
    await _escuela(db, org, {"activo": True, "desde": "2026-10-26"})
    bea = await _alumno(db, org, 11, "bea@x.com", entro="2026-10-28 08:00:00")
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-31 20:00:00")
    assert await tandas.al_pagar(org.id, ana.id, db) == "nuevo"
    assert await _grupos_de(db, bea.id) == set()
    assert [a["id"] for a in await tandas.por_decidir(org.id, db)] == [bea.id]


def test_la_tarea_diaria_no_toca_los_grupos():
    """Hubo un repaso diario que metía a todos los que esperaban: se quitó."""
    import inspect

    from src.routers import notifications

    assert "entrar_solos" not in inspect.getsource(notifications)


async def test_con_las_tandas_apagadas_no_entra_nadie(db, org):
    await _escuela(db, org, {"activo": False, "desde": "2026-10-26"})
    ana = await _alumno(db, org, 10, "ana@x.com", entro="2026-10-31 08:00:00")
    assert await tandas.al_pagar(org.id, ana.id, db) == ""
    assert await _grupos_de(db, ana.id) == set()


async def test_el_alta_solo_mete_a_quien_entra_ahora(db, org, monkeypatch):
    """El alta (pago, señal completada, plazos y alta a mano pasan por
    `_create_paid_user`) llama a las tandas solo cuando la persona entra en la
    escuela en ese momento: ni en un reintento ni con quien ya era alumno."""
    from src.services.payments import payments

    llamadas: list[int] = []

    async def _org(_db):
        return org

    async def _nada(*a, **k):
        return None

    async def _al_pagar(org_id, user_id, _db):
        llamadas.append(user_id)
        return "nuevo"

    monkeypatch.setattr(payments, "_get_default_org", _org)
    monkeypatch.setattr(payments, "add_user_to_students", _nada)
    monkeypatch.setattr(tandas, "al_pagar", _al_pagar)

    nueva, creada = await payments._create_paid_user("nueva@x.com", "Nueva Alumna", db)
    assert creada and llamadas == [nueva.id]
    # Un reintento de Stripe del mismo pago: ya está en la escuela.
    await payments._create_paid_user("nueva@x.com", "Nueva Alumna", db)
    assert llamadas == [nueva.id]
    # Alguien que ya era alumno y vuelve a pasar por el alta: no se le toca.
    vieja = await _alumno(db, org, 50, "vieja@x.com", entro="2026-10-28 08:00:00")
    await payments._create_paid_user("vieja@x.com", "Vieja", db)
    assert llamadas == [nueva.id] and vieja.id not in llamadas

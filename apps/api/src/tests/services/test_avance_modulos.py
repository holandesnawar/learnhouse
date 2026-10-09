"""La apertura de módulos por avance (09/10/2026): para quien entra desde el
10/10, el módulo 3 se abre a las 2 semanas si ha terminado el 1 y el 2, y
cada siguiente cuando termina el anterior y ha pasado una semana (dos tras el
5 y el 7) desde que se le abrió. Terminado = 80 % de las clases. La primera
convocatoria sigue con sus fechas fijas."""

from datetime import datetime, timedelta

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.modulo_abierto import ModuloAbierto
from src.db.organization_config import OrganizationConfig
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.courses import avance_modulos as am
from src.services.courses.locks import drip_locks_detalle

ENTRADA = datetime(2026, 10, 12, 9, 0)


def _modulos(clases_por_modulo: dict) -> list[dict]:
    """{"Introducción": 4, "MODULE 1 - X": 10, …} → la lista que espera el
    cálculo, con ids de clase correlativos."""
    out, siguiente = [], 1
    for nombre, n in clases_por_modulo.items():
        out.append(
            {
                "uuid": nombre,
                "nombre": nombre,
                "numero": am.numero_de_modulo(nombre),
                "clases": list(range(siguiente, siguiente + n)),
            }
        )
        siguiente += n
    return out


CURSO = {"Introducción": 4, **{f"MODULE {i} - M{i}": 10 for i in range(1, 11)}, "Examen final": 5}


def _dia(n: float) -> datetime:
    return ENTRADA + timedelta(days=n)


def _hacer(modulo: dict, cuando: datetime, cuantas: int | None = None) -> dict:
    return {c: cuando for c in modulo["clases"][: cuantas if cuantas is not None else len(modulo["clases"])]}


def test_el_mas_rapido_abre_el_10_a_los_77_dias_y_el_examen_a_los_84():
    modulos = _modulos(CURSO)
    hechas: dict = {}
    # Hace cada módulo entero en cuanto se le abre.
    for _ in range(len(modulos)):
        estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(200))
        for m in modulos:
            if estado[m["uuid"]]["abierto"]:
                hechas.update(_hacer(m, estado[m["uuid"]]["abre"]))
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(200))
    dias = {m["nombre"]: (estado[m["uuid"]]["abre"] - ENTRADA).days for m in modulos}
    assert dias["Introducción"] == 0 and dias["MODULE 1 - M1"] == 0 and dias["MODULE 2 - M2"] == 0
    assert [dias[f"MODULE {i} - M{i}"] for i in range(3, 11)] == [14, 21, 28, 42, 49, 63, 70, 77]
    assert dias["Examen final"] == 84


def test_sin_terminar_el_1_y_el_2_el_3_no_se_abre_y_dice_cuanto_falta():
    modulos = _modulos(CURSO)
    m1, m2, m3 = modulos[1], modulos[2], modulos[3]
    hechas = {**_hacer(m1, _dia(3)), **_hacer(m2, _dia(4), 5)}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(20))
    assert not estado[m3["uuid"]]["abierto"]
    # 80 % de 10 = 8; lleva 5 del módulo 2.
    assert estado[m3["uuid"]]["motivo"] == "Se abre cuando termines el módulo 2: te faltan 3 clases."
    # Los dos sin empezar: los nombra a los dos.
    estado = am.calcular_aperturas(modulos, ENTRADA, {}, {}, _dia(5))
    assert estado[m3["uuid"]]["motivo"] == "Se abre cuando termines los módulos 1 y 2: te faltan 16 clases."
    # Y la fecha mínima va al lado mientras no hayan pasado las 2 semanas.
    assert estado[m3["uuid"]]["fecha_minima"] == _dia(14)


def test_el_80_por_ciento_basta():
    modulos = _modulos(CURSO)
    m1, m2, m3 = modulos[1], modulos[2], modulos[3]
    hechas = {**_hacer(m1, _dia(3), 8), **_hacer(m2, _dia(4), 8)}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(15))
    assert estado[m3["uuid"]]["abierto"] and estado[m3["uuid"]]["abre"] == _dia(14)


def test_terminado_antes_de_tiempo_espera_a_la_fecha_y_la_dice():
    modulos = _modulos(CURSO)
    m1, m2, m3 = modulos[1], modulos[2], modulos[3]
    hechas = {**_hacer(m1, _dia(2)), **_hacer(m2, _dia(5))}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(6))
    assert not estado[m3["uuid"]]["abierto"]
    assert estado[m3["uuid"]]["motivo"] is None and estado[m3["uuid"]]["abre"] == _dia(14)


def test_la_espera_cuenta_desde_que_se_abrio_el_anterior_no_desde_que_lo_termino():
    modulos = _modulos(CURSO)
    m1, m2, m3, m4 = modulos[1], modulos[2], modulos[3], modulos[4]
    # Termina el 2 tarde (día 30): el 3 se abre ese día.
    hechas = {**_hacer(m1, _dia(10)), **_hacer(m2, _dia(30))}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(31))
    assert estado[m3["uuid"]]["abre"] == _dia(30)
    # Termina el 3 al día siguiente: el 4, a la semana de abrirse el 3.
    hechas.update(_hacer(m3, _dia(31)))
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(36))
    assert not estado[m4["uuid"]]["abierto"] and estado[m4["uuid"]]["abre"] == _dia(37)
    # Si tarda más de una semana, se abre el día que termina.
    hechas = {**_hacer(m1, _dia(10)), **_hacer(m2, _dia(30)), **_hacer(m3, _dia(50))}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(51))
    assert estado[m4["uuid"]]["abre"] == _dia(50)


def test_lo_apuntado_manda_abrir_a_mano_y_no_volver_a_cerrar():
    modulos = _modulos(CURSO)
    m3, m4, m5 = modulos[3], modulos[4], modulos[5]
    # Abierto a mano el 4 sin haber terminado nada.
    estado = am.calcular_aperturas(modulos, ENTRADA, {}, {m4["uuid"]: (_dia(5), "mano")}, _dia(6))
    assert estado[m4["uuid"]]["abierto"] and estado[m4["uuid"]]["como"] == "mano"
    assert not estado[m3["uuid"]]["abierto"]
    # El 5 sigue la regla: necesita el 4 terminado.
    assert estado[m5["uuid"]]["motivo"] == "Se abre cuando termines el módulo 4: te faltan 8 clases."
    # Dos pasos por delante: sin contar clases de un módulo cerrado.
    assert modulos[6]["uuid"] and estado[modulos[6]["uuid"]]["motivo"] == "Se abre después del módulo 5."
    # Apuntado por la tarea diaria y luego el 3 deja de llegar al 80 % (se le
    # añadieron clases): el 4 sigue abierto.
    modulos[3]["clases"] = modulos[3]["clases"] + list(range(900, 920))
    estado = am.calcular_aperturas(modulos, ENTRADA, {}, {m4["uuid"]: (_dia(21), "avance")}, _dia(30))
    assert estado[m4["uuid"]]["abierto"]


def test_un_modulo_sin_clases_no_abre_el_siguiente():
    modulos = _modulos({"MODULE 1 - A": 10, "MODULE 2 - B": 10, "MODULE 3 - C": 0, "MODULE 4 - D": 10})
    hechas = {**_hacer(modulos[0], _dia(1)), **_hacer(modulos[1], _dia(1))}
    estado = am.calcular_aperturas(modulos, ENTRADA, hechas, {}, _dia(30))
    assert estado["MODULE 3 - C"]["abierto"]
    assert not estado["MODULE 4 - D"]["abierto"]
    assert "estamos terminando de preparar" in estado["MODULE 4 - D"]["motivo"]


def test_quien_entra_desde_el_10_10_en_hora_de_holanda():
    ajustes = am.ajustes_avance({"enabled": True})
    assert ajustes == {"activo": True, "desde": "2026-10-10"}
    # 9/10 a las 23:30 en UTC ya es el 10/10 en Holanda.
    assert am.usa_avance(datetime(2026, 10, 9, 23, 30), ajustes)
    assert not am.usa_avance(datetime(2026, 10, 9, 21, 0), ajustes)
    assert not am.usa_avance(datetime(2026, 9, 3), ajustes)
    assert not am.usa_avance(datetime(2026, 11, 3), {"activo": False, "desde": "2026-10-10"})
    assert am.ajustes_avance({"avance": {"activo": True, "desde": "basura"}})["desde"] == "2026-10-10"


# ── Con la base de datos ─────────────────────────────────────────────────────


async def _escuela(db, org):
    ahora = str(datetime.now())
    db.add(
        OrganizationConfig(
            org_id=org.id,
            config={"drip_content": {"enabled": True, "chapters": {}, "fechas": {"ch_m3": "2026-09-21", "ch_m4": "2099-10-12", "ch_otro": "2099-01-01"}}},
            creation_date=ahora,
            update_date=ahora,
        )
    )
    db.add(Course(id=10, name="Formación", description="", public=False, published=True, open_to_contributors=False,
                  org_id=org.id, course_uuid=f"course_{am.FORMACION_UUID}", creation_date=ahora, update_date=ahora))
    db.add(Course(id=11, name="Clase semanal", description="", public=False, published=True, open_to_contributors=False,
                  org_id=org.id, course_uuid="course_otro", creation_date=ahora, update_date=ahora))
    capitulos = [("ch_intro", "Introducción", 10), ("ch_m1", "MODULE 1 - OVER JOU", 10), ("ch_m2", "MODULE 2 - FAMILIE", 10),
                 ("ch_m3", "MODULE 3 - ETEN", 10), ("ch_m4", "MODULE 4 - WERK", 10), ("ch_otro", "Clases en vivo", 11)]
    aid = 100
    for i, (uuid, nombre, course_id) in enumerate(capitulos, start=1):
        db.add(Chapter(id=i, name=nombre, description="", org_id=org.id, course_id=course_id, chapter_uuid=uuid,
                       creation_date=ahora, update_date=ahora))
        db.add(CourseChapter(chapter_id=i, course_id=course_id, org_id=org.id, order=i, creation_date=ahora, update_date=ahora))
        for j in range(5):
            aid += 1
            db.add(Activity(id=aid, name=f"{i}.{j}", activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
                            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE, content={}, published=True,
                            org_id=org.id, course_id=course_id, activity_uuid=f"a{aid}", creation_date=ahora, update_date=ahora))
            db.add(ChapterActivity(order=j, chapter_id=i, activity_id=aid, course_id=course_id, org_id=org.id,
                                   creation_date=ahora, update_date=ahora))
    await db.commit()


async def _alumno(db, org, user_role, uid: int, entrada: datetime) -> PublicUser:
    ahora = str(datetime.now())
    db.add(User(id=uid, username=f"u{uid}", first_name="A", last_name="B", email=f"u{uid}@x.com", password="x",
                user_uuid=f"user_{uid}", creation_date=ahora, update_date=ahora))
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=user_role.id, creation_date=str(entrada), update_date=ahora))
    await db.commit()
    return PublicUser(id=uid, username=f"u{uid}", first_name="A", last_name="B", email=f"u{uid}@x.com", user_uuid=f"user_{uid}")


TODOS = ["ch_intro", "ch_m1", "ch_m2", "ch_m3", "ch_m4", "ch_otro"]


async def test_la_primera_convocatoria_sigue_con_sus_fechas(db, org, user_role):
    await _escuela(db, org)
    alumno = await _alumno(db, org, user_role, 50, datetime(2026, 9, 10, 12))
    cerrados = await drip_locks_detalle(TODOS, org.id, alumno, db)
    # El 3 abrió el 21/09; el 4 y la clase semanal, con su fecha.
    assert set(cerrados) == {"ch_m4", "ch_otro"}
    assert cerrados["ch_m4"]["motivo"] is None


async def test_quien_entra_despues_va_por_avance_y_solo_en_la_formacion(db, org, user_role):
    await _escuela(db, org)
    entrada = datetime.now() - timedelta(days=20)
    corte = (entrada - timedelta(days=1)).date().isoformat()
    from sqlmodel import select

    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    fila.config = {**fila.config, "drip_content": {**fila.config["drip_content"], "avance": {"activo": True, "desde": corte}}}
    db.add(fila)
    await db.commit()
    alumno = await _alumno(db, org, user_role, 51, entrada)

    cerrados = await drip_locks_detalle(TODOS, org.id, alumno, db)
    # Aunque el 3 tenga fecha pasada, para él está cerrado: no ha hecho nada.
    assert set(cerrados) == {"ch_m3", "ch_m4", "ch_otro"}
    assert cerrados["ch_m3"]["motivo"] == "Se abre cuando termines los módulos 1 y 2: te faltan 8 clases."
    # La clase semanal sigue con su fecha fija.
    assert cerrados["ch_otro"]["motivo"] is None and cerrados["ch_otro"]["fecha"].startswith("2099-01-01")

    # Hace las 5 clases del 1 y 4 del 2 (80 %): a los 20 días, el 3 abierto.
    hechas = [101 + 5 + k for k in range(5)] + [101 + 10 + k for k in range(4)]
    for aid in hechas:
        db.add(TrailStep(complete=True, teacher_verified=False, grade="", data={}, trailrun_id=1, trail_id=1,
                         activity_id=aid, course_id=10, org_id=org.id, user_id=51,
                         creation_date=str(entrada + timedelta(days=3)), update_date=str(entrada)))
    await db.commit()
    cerrados = await drip_locks_detalle(TODOS, org.id, alumno, db)
    assert set(cerrados) == {"ch_m4", "ch_otro"}
    assert cerrados["ch_m4"]["motivo"] == "Se abre cuando termines el módulo 3: te faltan 4 clases."

    # Abrir el 4 a mano.
    db.add(ModuloAbierto(user_id=51, chapter_uuid="ch_m4", abierto_at=str(datetime.now() - timedelta(minutes=1)), como="mano"))
    await db.commit()
    assert set(await drip_locks_detalle(TODOS, org.id, alumno, db)) == {"ch_otro"}

    # La tarea diaria apunta el 3 (lo abrió el avance) y no el 4 (ya estaba).
    nuevas = await am.guardar_aperturas(org.id, [51], db)
    assert [cu for _u, cu, _d in nuevas] == ["ch_m3"]
    assert await am.guardar_aperturas(org.id, [51], db) == []
    assert await am.ids_con_avance(org.id, db) == {51}


async def _con_corte(db, org, corte: str, fechas: dict | None = None):
    from sqlmodel import select

    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    goteo = {**fila.config["drip_content"], "avance": {"activo": True, "desde": corte}}
    if fechas is not None:
        goteo["fechas"] = fechas
    fila.config = {**fila.config, "drip_content": goteo}
    db.add(fila)
    await db.commit()


async def _hizo(db, org, user_id: int, ids: list[int], cuando: datetime):
    for aid in ids:
        db.add(TrailStep(complete=True, teacher_verified=False, grade="", data={}, trailrun_id=1, trail_id=1,
                         activity_id=aid, course_id=10, org_id=org.id, user_id=user_id,
                         creation_date=str(cuando), update_date=str(cuando)))
    await db.commit()


async def test_el_correo_de_la_fecha_fija_no_le_llega_a_quien_va_por_avance(db, org, user_role):
    from unittest.mock import patch

    from src.services.notifications.drip import avisar_aperturas_por_avance, avisar_modulos_abiertos_hoy

    await _escuela(db, org)
    hoy = datetime.now().date().isoformat()
    entrada = datetime.now() - timedelta(days=15)
    await _con_corte(db, org, (entrada - timedelta(days=1)).date().isoformat(), {"ch_m4": hoy})
    await _alumno(db, org, user_role, 50, datetime(2026, 9, 10, 12))
    await _alumno(db, org, user_role, 51, entrada)

    with patch("src.services.users.emails.send_module_unlocked_email") as correo:
        r = await avisar_modulos_abiertos_hoy(org.id, db)
    assert r["enviados"] == 1
    assert [c.kwargs["email"] for c in correo.call_args_list] == ["u50@x.com"]

    # El nuevo terminó el 1 y el 2: el 3 se le abrió ayer (día 14) → aviso.
    await _hizo(db, org, 51, list(range(106, 116)), entrada + timedelta(days=2))
    with patch("src.services.users.emails.send_module_unlocked_email") as correo:
        r = await avisar_aperturas_por_avance(org.id, db)
        assert r == {"alumnos": 1, "apuntados": 1, "enviados": 1}
        assert correo.call_args.kwargs["module_name"] == "MODULE 3 - ETEN"
        # Otra vez el mismo día: nada.
        assert (await avisar_aperturas_por_avance(org.id, db))["enviados"] == 0


async def test_la_campana_no_le_anuncia_la_fecha_fija_a_quien_va_por_avance(db, org, user_role):
    from src.services.communities.engagement import _module_items

    await _escuela(db, org)
    ayer = (datetime.now() - timedelta(days=1)).date().isoformat()
    entrada = datetime.now() - timedelta(days=15)
    await _con_corte(db, org, (entrada - timedelta(days=1)).date().isoformat(), {"ch_m4": ayer})
    await _alumno(db, org, user_role, 50, datetime(2026, 9, 10, 12))
    await _alumno(db, org, user_role, 51, entrada)

    assert [i["id"] for i in await _module_items(50, [org.id], db)] == ["module:ch_m4"]
    assert await _module_items(51, [org.id], db) == []
    await _hizo(db, org, 51, list(range(106, 116)), entrada + timedelta(days=2))
    assert [i["id"] for i in await _module_items(51, [org.id], db)] == ["module:ch_m3"]


async def test_abrir_una_clase_cerrada_no_la_apunta_como_hecha(db, org, user_role):
    """Encontrado el 09/10: abrir la dirección de una clase de un módulo
    cerrado la marcaba como hecha."""
    from src.services.trail.trail import cerrada_por_el_goteo

    await _escuela(db, org)
    entrada = datetime.now() - timedelta(days=20)
    await _con_corte(db, org, (entrada - timedelta(days=1)).date().isoformat())
    alumno = await _alumno(db, org, user_role, 51, entrada)
    curso = await db.get(Course, 10)
    # 116 es la primera clase del módulo 3 (cerrado); 106, la del 1 (abierto).
    assert await cerrada_por_el_goteo(await db.get(Activity, 116), curso, alumno, db)
    assert not await cerrada_por_el_goteo(await db.get(Activity, 106), curso, alumno, db)


async def test_el_equipo_nuevo_sigue_las_fechas_de_la_convocatoria(db, org, user_role):
    """Un profe que entra después da la clase compartiendo pantalla: ve lo
    mismo que la convocatoria, no el avance."""
    from src.db.roles import Role, RoleTypeEnum

    await _escuela(db, org)
    entrada = datetime.now() - timedelta(days=20)
    await _con_corte(db, org, (entrada - timedelta(days=1)).date().isoformat())
    ahora = str(datetime.now())
    db.add(Role(id=5, name="Profe", org_id=org.id, role_type=RoleTypeEnum.TYPE_ORGANIZATION, role_uuid="role_profe",
                rights={}, creation_date=ahora, update_date=ahora))
    await db.commit()
    profe = await _alumno(db, org, user_role, 60, entrada)
    from sqlmodel import select

    uo = (await db.execute(select(UserOrganization).where(UserOrganization.user_id == 60))).scalars().first()
    uo.role_id = 5
    db.add(uo)
    await db.commit()
    assert await am.estado_avance(60, org.id, db) is None
    # Con las fechas de la convocatoria: el 3 abierto (21/09), el 4 cerrado.
    assert set(await drip_locks_detalle(TODOS, org.id, profe, db)) == {"ch_m4", "ch_otro"}
    assert await am.ids_con_avance(org.id, db) == set()

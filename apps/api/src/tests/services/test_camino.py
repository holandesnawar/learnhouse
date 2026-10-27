"""El camino de 16 semanas de cada alumno (services/panel/camino.py).

- La semana se cuenta desde el día que entró y termina el último día de la
  semana 16.
- Una clase en directo cuenta una vez por sesión, y solo si estuvo 10 min.
- La tabla sale con sus grupos, sin pruebas, y con las clases por curso.
"""

from datetime import datetime

from src.db.organization_config import OrganizationConfig
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User
from src.services.panel import camino as mod
from src.services.salas import salas


def test_semana_del_camino():
    r = mod.semana_del_camino("2026-10-27", "2026-10-27")
    assert r["semana"] == 1 and r["estado"] == "en-curso"
    # 16 semanas: la última termina el día 112 (contando el primero).
    assert r["termina"] == "2027-02-15" and r["dias_quedan"] == 111
    assert mod.semana_del_camino("2026-10-27", "2026-11-03")["semana"] == 2
    assert mod.semana_del_camino("2026-09-08", "2026-10-27")["semana"] == 8
    ultimas = mod.semana_del_camino("2026-10-27", "2027-02-02")
    assert ultimas["semana"] == 15 and ultimas["estado"] == "ultimas"
    ultimo_dia = mod.semana_del_camino("2026-10-27", "2027-02-15")
    assert ultimo_dia["semana"] == 16 and ultimo_dia["estado"] == "ultimas" and ultimo_dia["dias_quedan"] == 0
    fin = mod.semana_del_camino("2026-10-27", "2027-02-16")
    assert fin["estado"] == "terminado" and fin["semana"] == 16
    assert mod.semana_del_camino("", "2026-10-27")["estado"] == "sin-fecha"


def test_asistencia_una_vez_por_sesion_y_al_menos_10_minutos():
    sesiones = [
        {"id": "s1", "participants": [
            {"user_id": "7", "duration": 3000},
            {"user_id": "8", "duration": 120},          # entró y salió
            {"user_id": "9", "duration": 400}, {"user_id": "9", "duration": 300},  # dos veces: 11 min
        ]},
        {"id": "s2", "participants": [{"user_id": "7", "duration": 1800}, {"user_id": None, "duration": 5000}]},
        {"id": "s3", "participants": []},
        "basura",
    ]
    r = mod.asistencias(sesiones)
    assert r == {"7": {"s1", "s2"}, "9": {"s1"}}


async def _alumno(db, org, uid, nombre, entro, rol=4):
    db.add(User(id=uid, username=f"u{uid}", first_name=nombre, last_name="", email=f"u{uid}@example.com",
                password="x", user_uuid=f"user_{uid}", creation_date=entro, update_date=entro))
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=rol, creation_date=entro, update_date=entro))
    await db.commit()


async def test_la_tabla_con_grupos_semanas_y_clases(db, org, monkeypatch):
    ahora = str(datetime.now())
    db.add(OrganizationConfig(org_id=org.id, config={"salas": {"abc": {"activo": True}}},
                              creation_date=ahora, update_date=ahora))
    from src.db.courses.courses import Course
    db.add(Course(name="Masterclass", description="", public=False, published=True, open_to_contributors=False,
                  org_id=org.id, course_uuid="course_abc", creation_date=ahora, update_date=ahora))
    await db.commit()
    await _alumno(db, org, 7, "Ana", "2026-09-08 10:00:00")
    await _alumno(db, org, 8, "Luis", "2026-10-27 09:00:00")
    await _alumno(db, org, 9, "Profe", "2026-09-01 09:00:00", rol=5)  # no es alumno
    g = UserGroup(name="Beta · Grupo 1", org_id=org.id, usergroup_uuid="ug_1", description="",
                  creation_date=ahora, update_date=ahora)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    db.add(UserGroupUser(usergroup_id=g.id, user_id=7, org_id=org.id, creation_date=ahora, update_date=ahora))
    await db.commit()

    monkeypatch.setenv("LEARNHOUSE_DAILY_API_KEY", "x")
    mod._cache.clear()

    async def daily(metodo, ruta, cuerpo=None, params=None):
        assert ruta == "/meetings" and params["room"] == salas.nombre_sala("abc")
        return {"data": [{"id": "s1", "participants": [{"user_id": "7", "duration": 3600}]}]}

    monkeypatch.setattr(salas, "_daily", daily)
    r = await mod.camino(org.id, db)
    assert [a["nombre"] for a in r["alumnos"]] == ["Luis", "Ana"]  # el más nuevo arriba; el profe no sale
    ana = r["alumnos"][1]
    assert ana["grupos"] == ["Beta · Grupo 1"] and ana["entro"] == "2026-09-08"
    assert ana["clases_directo"] == 1 and ana["clases_por_curso"] == [{"curso": "Masterclass", "n": 1}]
    assert r["alumnos"][0]["clases_directo"] == 0 and r["aviso"] == ""
    assert r["cursos"] == [{"uuid": "abc", "nombre": "Masterclass"}]


async def test_sin_daily_la_tabla_sale_igual_y_dice_por_que(db, org, monkeypatch):
    ahora = str(datetime.now())
    db.add(OrganizationConfig(org_id=org.id, config={"salas": {"abc": {"activo": True}}},
                              creation_date=ahora, update_date=ahora))
    from src.db.courses.courses import Course
    db.add(Course(name="Masterclass", description="", public=False, published=True, open_to_contributors=False,
                  org_id=org.id, course_uuid="course_abc", creation_date=ahora, update_date=ahora))
    await db.commit()
    await _alumno(db, org, 7, "Ana", "2026-09-08 10:00:00")
    mod._cache.clear()

    async def roto(*a, **k):
        raise salas.SalaError("Daily (500): caído", 500)

    monkeypatch.setenv("LEARNHOUSE_DAILY_API_KEY", "x")
    monkeypatch.setattr(salas, "_daily", roto)
    r = await mod.camino(org.id, db)
    assert len(r["alumnos"]) == 1 and r["alumnos"][0]["clases_directo"] == 0
    assert "caído" in r["aviso"]

"""Las grabaciones de la sala: por día, con su semana, recortadas y publicadas
(services/salas/estudio_grabaciones.py).

Daily no se alcanza desde las pruebas: se sustituye `salas._daily` por uno
falso. Lo que se comprueba:
- los trozos se limpian (orden, solapes, duración, mínimo 1 s) y el tiempo
  «visible» va y vuelve al tiempo de la grabación;
- cada día de grabación encuentra su semana (mismo día; si no, a un día);
- si la sala cortó y volvió a grabar, ese día tiene varias partes, en orden;
- publicar comprueba en Daily que la grabación es de ESTA sala, usa la
  duración de Daily y no borra nada allí; quitar vacía la semana;
- el alumno recibe lo publicado solo con la clase ya llegada, y verla pasa a
  la columna «Grabación» del Seguimiento;
- el enlace del vídeo se guarda un rato para no llamar a Daily en cada salto.
"""

import copy
import json
from datetime import datetime, timezone

import pytest

from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.panel import tandas
from src.services.salas import estudio_grabaciones as EG
from src.services.salas import salas
from src.services.tareas import tareas as T

CURSO = "course_8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"
SALA = salas.nombre_sala(CURSO)


def _ts(dia: str, hora: int, minuto: int = 0) -> int:
    a, m, d = (int(x) for x in dia.split("-"))
    return int(datetime(a, m, d, hora, minuto, tzinfo=timezone.utc).timestamp())


class DailyFalso:
    def __init__(self, grabaciones):
        self.grabaciones = {g["id"]: g for g in grabaciones}
        self.llamadas = []

    async def __call__(self, metodo, ruta, cuerpo=None, params=None):
        self.llamadas.append((metodo, ruta, copy.deepcopy(cuerpo), params))
        if metodo == "GET" and ruta == "/recordings":
            return {"data": [g for g in self.grabaciones.values() if g["room_name"] == params["room_name"]]}
        if metodo == "GET" and ruta.endswith("/access-link"):
            return {"download_link": f"https://video.daily.co/{ruta.split('/')[2]}.mp4?firma={len(self.llamadas)}"}
        if metodo == "GET" and ruta.startswith("/recordings/"):
            g = self.grabaciones.get(ruta.split("/")[2])
            if g is None:
                raise salas.SalaError("Daily (404): not-found", 404)
            return g
        raise AssertionError(f"Llamada inesperada: {metodo} {ruta}")


def _grabacion(gid, dia, hora, dur, sala=SALA, estado="finished", minuto=0):
    return {"id": gid, "room_name": sala, "start_ts": _ts(dia, hora, minuto), "duration": dur, "status": estado, "max_participants": 6}


@pytest.fixture(autouse=True)
def _sin_copias(monkeypatch):
    EG._enlaces.clear()
    monkeypatch.setenv("LEARNHOUSE_DAILY_API_KEY", "clave-de-prueba")
    yield
    EG._enlaces.clear()


# ── Lógica pura ─────────────────────────────────────────────────────────────


def test_los_trozos_se_limpian():
    # Desordenados, solapados, fuera de la duración y uno de medio segundo.
    assert EG.limpiar_trozos([[100, 200], [10, 50], [40, 60], [199.8, 400], [70, 70.5]], 300) == [[10.0, 60.0], [100.0, 300.0]]
    # Nada válido con duración conocida: la grabación entera.
    assert EG.limpiar_trozos([], 120) == [[0.0, 120.0]]
    assert EG.limpiar_trozos([["x", 3], [5]], 120) == [[0.0, 120.0]]
    # Sin duración, vacío quiere decir «entera».
    assert EG.limpiar_trozos(None, 0) == []
    # Negativos al cero.
    assert EG.limpiar_trozos([[-5, 10]], 60) == [[0.0, 10.0]]


def test_tiempo_visible_y_tiempo_real():
    trozos = [[10, 60], [100, 300]]  # se ven 50 s y luego 200 s
    assert EG.duracion_visible(trozos) == 250
    assert EG.duracion_visible([], 90) == 90
    assert EG.a_real(trozos, 0) == 10
    assert EG.a_real(trozos, 49) == 59
    assert EG.a_real(trozos, 51) == 101  # ya en el segundo trozo
    assert EG.a_real(trozos, 9999) == 300
    assert EG.a_visible(trozos, 5) == 0  # cortado al principio
    assert EG.a_visible(trozos, 30) == 20
    assert EG.a_visible(trozos, 80) == 50  # en el corte: cae al siguiente trozo
    assert EG.a_visible(trozos, 150) == 100
    assert EG.a_visible(trozos, 999) == 250
    # Sin recorte, es lo mismo.
    assert EG.a_real([], 42) == 42 and EG.a_visible([], 42) == 42


def test_el_dia_es_el_de_paises_bajos():
    # 23:30 UTC del 3 nov = 00:30 del 4 en Países Bajos (invierno, +1).
    assert EG.dia_nl(_ts("2026-11-03", 23, 30)) == "2026-11-04"
    assert EG.dia_nl(_ts("2026-11-03", 18)) == "2026-11-03"
    assert EG.dia_nl("2026-11-03T18:00:00+00:00") == "2026-11-03"
    assert EG.dia_nl("") == "" and EG.dia_nl("no es una fecha") == ""


def test_cada_dia_encuentra_su_semana():
    semanas = [{"id": 1, "fecha": "2026-11-03", "tema": "Mijn huis"}, {"id": 2, "fecha": "2026-11-10", "tema": "De kleding"}]
    assert EG.semana_del_dia("2026-11-03", semanas)["id"] == 1
    # La clase acabó pasada la medianoche, o se movió un día.
    assert EG.semana_del_dia("2026-11-04", semanas)["id"] == 1
    assert EG.semana_del_dia("2026-11-09", semanas)["id"] == 2
    # A dos días, ninguna: una prueba de la sala no se cuelga de una clase.
    assert EG.semana_del_dia("2026-11-06", semanas) is None
    # Entre dos clases a un día cada una: la anterior.
    juntas = [{"id": 1, "fecha": "2026-11-03"}, {"id": 2, "fecha": "2026-11-05"}]
    assert EG.semana_del_dia("2026-11-04", juntas)["id"] == 1


def test_varias_grabaciones_el_mismo_dia_son_partes_de_la_misma_clase():
    grabaciones = [
        salas.grabacion_de(_grabacion("rec-bbbb-2222", "2026-11-03", 18, 1500, minuto=35)),
        salas.grabacion_de(_grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000)),
        salas.grabacion_de(_grabacion("rec-cccc-3333", "2026-11-10", 18, 3600, estado="in-progress")),
    ]
    semanas = [{"id": 1, "fecha": "2026-11-03", "tema": "Mijn huis"}, {"id": 2, "fecha": "2026-11-10", "tema": "De kleding"}]
    publicadas = {"rec-aaaa-1111": {"semana_id": 1, "tema": "Mijn huis", "fecha": "2026-11-03", "trozos": [[60.0, 2000.0]], "segundos": 1940}}
    dias = EG.agrupar(grabaciones, semanas, publicadas)
    assert [d["dia"] for d in dias] == ["2026-11-10", "2026-11-03"]  # lo más nuevo, primero
    martes = dias[1]
    assert [p["id"] for p in martes["partes"]] == ["rec-aaaa-1111", "rec-bbbb-2222"]  # en el orden en que se grabó
    assert martes["dur"] == 3500 and martes["semana"]["id"] == 1
    assert martes["publicada"]["semana_id"] == 1
    assert martes["partes"][0]["trozos"] == [[60.0, 2000.0]] and martes["partes"][1]["trozos"] is None
    assert martes["partes"][0]["hora"] == "19:00"  # hora de Países Bajos
    # La que aún se está grabando no se puede publicar todavía.
    assert dias[0]["partes"][0]["lista"] is False and dias[0]["publicada"] is None


def test_lo_guardado_se_lee_limpio():
    assert EG.leer("") == {} and EG.leer("no es json") == {} and EG.leer('{"partes": []}') == {}
    g = EG.leer(json.dumps({"partes": [{"id": "rec-aaaa-1111", "dur": 100, "trozos": [[50, 500], [0, 10]]}, {"id": "mal"}],
                            "titulo": "Mijn huis", "vistas": {"7": "2026-11-04"}}))
    assert g["partes"] == [{"id": "rec-aaaa-1111", "dur": 100.0, "trozos": [[0.0, 10.0], [50.0, 100.0]]}]
    assert EG.segundos_de(g) == 60
    alumno = EG.para_la_semana(g, user_id=7)
    assert alumno["vista"] is True and alumno["segundos"] == 60 and "por" not in alumno
    assert EG.para_la_semana(g, user_id=8)["vista"] is False
    assert EG.para_la_semana(g, equipo=True)["vistas"] == 1
    assert EG.para_la_semana("") is None
    assert EG.quienes_la_vieron(g) == {7}


# ── Con Daily (falso) y la base de datos ────────────────────────────────────


async def _clase(db, org):
    ahora = str(datetime.now())
    c = Course(id=50, name="Clase semanal", description="", public=True, published=True, open_to_contributors=False,
               org_id=org.id, course_uuid=CURSO, creation_date=ahora, update_date=ahora)
    db.add(c)
    for cid, nombre in ((60, "Mijn huis"), (61, "De kleding")):
        db.add(Chapter(id=cid, name=nombre, description="", org_id=org.id, course_id=50,
                       chapter_uuid=f"chapter_{cid}", creation_date=ahora, update_date=ahora))
    for uid, nombre in ((7, "Ana"), (8, "Luis")):
        db.add(User(id=uid, username=f"u{uid}", first_name=nombre, last_name="", email=f"u{uid}@example.com",
                    password="x", user_uuid=f"user_{uid}", creation_date=ahora, update_date=ahora))
        db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=4, creation_date=ahora, update_date=ahora))
    await db.commit()
    s1 = (await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_60", "tema": "Mijn huis", "fecha": "2026-11-03"}, "Rida", db))["semana"]["id"]
    s2 = (await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_61", "tema": "De kleding", "fecha": "2026-11-10"}, "Rida", db))["semana"]["id"]
    return c, s1, s2


async def test_aparecen_solas_se_publican_recortadas_y_se_quitan(db, org, monkeypatch):
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-05")
    c, s1, s2 = await _clase(db, org)
    daily = DailyFalso([
        _grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000),
        _grabacion("rec-bbbb-2222", "2026-11-03", 18, 1500, minuto=35),
        _grabacion("rec-ajena-9999", "2026-11-03", 18, 900, sala="otra-sala"),
    ])
    monkeypatch.setattr(salas, "_daily", daily)

    # Aparecen solas, juntas en su día y con su semana.
    e = await EG.estudio(c, db)
    assert e["aviso"] == "" and len(e["dias"]) == 1
    dia = e["dias"][0]
    assert dia["semana"]["id"] == s1 and [p["id"] for p in dia["partes"]] == ["rec-aaaa-1111", "rec-bbbb-2222"]
    assert dia["publicada"] is None
    assert [s["id"] for s in e["semanas"]] == [s2, s1] and all(s["grabacion_sala"] is None for s in e["semanas"])

    # Publicar: quita el primer minuto de la primera parte; la segunda, entera.
    # La duración que manda es la de Daily, no la de la pantalla.
    semana = await T.tarea(s1, db)
    r = await EG.publicar(semana, c, {"partes": [
        {"id": "rec-aaaa-1111", "trozos": [[60, 99999]]},
        {"id": "rec-bbbb-2222", "trozos": []},
    ], "titulo": ""}, "Rida", db)
    assert r["segundos"] == 1940 + 1500 and r["por"] == "Rida"
    assert r["partes"][0]["trozos"] == [[60.0, 2000.0]] and r["partes"][1]["trozos"] == [[0.0, 1500.0]]
    # En Daily no se ha tocado nada: solo lecturas.
    assert all(m == "GET" for m, *_ in daily.llamadas)

    # Una grabación de otra sala no se publica aquí.
    with pytest.raises(EG.GrabacionError) as exc:
        await EG.publicar(semana, c, {"partes": [{"id": "rec-ajena-9999"}]}, "Rida", db)
    assert exc.value.status == 404
    with pytest.raises(EG.GrabacionError):
        await EG.publicar(semana, c, {"partes": []}, "Rida", db)

    e = await EG.estudio(c, db)
    assert e["dias"][0]["publicada"]["semana_id"] == s1 and e["dias"][0]["partes"][0]["trozos"] == [[60.0, 2000.0]]

    # El alumno la recibe en su semana (la clase ya pasó) y aún no la ha visto.
    v = await T.semanas_para_alumno(c, 7, db)
    suya = next(s for s in v["semanas"] if s["id"] == s1)
    assert suya["grabacion_sala"]["vista"] is False and len(suya["grabacion_sala"]["partes"]) == 2
    assert "por" not in suya["grabacion_sala"]
    # La semana que aún no ha llegado no enseña nada de la sala.
    assert next(s for s in v["semanas"] if s["id"] == s2)["grabacion_sala"] is None

    # Ana pasa de la mitad: vista. Cuenta en el Seguimiento; Luis, no.
    await EG.marcar_vista(await T.tarea(s1, db), 7, db)
    await EG.marcar_vista(await T.tarea(s1, db), 7, db)  # dos veces no cambia nada
    v = await T.semanas_para_alumno(c, 7, db)
    assert next(s for s in v["semanas"] if s["id"] == s1)["grabacion_sala"]["vista"] is True
    seg = await T.seguimiento(org.id, CURSO, s1, db)
    por_alumno = {a["user_id"]: a["grabacion"] for a in seg["alumnos"]}
    assert por_alumno == {7: True, 8: False}
    assert seg["cifras"]["con_grabacion"] is True and seg["cifras"]["grabacion"] == 1

    # Cambiar solo el recorte no borra quién la vio.
    await EG.publicar(await T.tarea(s1, db), c, {"partes": [
        {"id": "rec-aaaa-1111", "trozos": [[120, 1900]]}, {"id": "rec-bbbb-2222"},
    ]}, "Rida", db)
    assert EG.quienes_la_vieron((await T.tarea(s1, db)).grabacion_sala) == {7}

    # Quitarla: la semana se queda sin grabación de la sala.
    await EG.quitar(await T.tarea(s1, db), db)
    v = await T.semanas_para_alumno(c, 7, db)
    assert next(s for s in v["semanas"] if s["id"] == s1)["grabacion_sala"] is None
    seg = await T.seguimiento(org.id, CURSO, s1, db)
    assert seg["cifras"]["con_grabacion"] is False and seg["alumnos"][0]["grabacion"] is None
    with pytest.raises(EG.GrabacionError):
        await EG.marcar_vista(await T.tarea(s1, db), 7, db)


async def test_el_alumno_solo_ve_lo_publicado_y_con_la_clase_ya_dada(db, org, monkeypatch):
    c, s1, s2 = await _clase(db, org)
    daily = DailyFalso([_grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000), _grabacion("rec-cccc-3333", "2026-11-10", 18, 2000)])
    monkeypatch.setattr(salas, "_daily", daily)
    await EG.publicar(await T.tarea(s1, db), c, {"partes": [{"id": "rec-aaaa-1111"}]}, "Rida", db)
    await EG.publicar(await T.tarea(s2, db), c, {"partes": [{"id": "rec-cccc-3333"}]}, "Rida", db)
    filas = await T.semanas_de(org.id, CURSO, db)
    assert EG.publicada_para_alumnos(filas, "rec-aaaa-1111", "2026-11-05") is True
    # La del 10 está publicada, pero el 5 esa clase aún no ha llegado.
    assert EG.publicada_para_alumnos(filas, "rec-cccc-3333", "2026-11-05") is False
    assert EG.publicada_para_alumnos(filas, "rec-cccc-3333", "2026-11-10") is True
    assert EG.publicada_para_alumnos(filas, "rec-otra-0000", "2026-11-30") is False


async def test_el_enlace_del_video_se_guarda_un_rato(monkeypatch):
    daily = DailyFalso([_grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000), _grabacion("rec-ajena-9999", "2026-11-03", 18, 9, sala="otra")])
    monkeypatch.setattr(salas, "_daily", daily)
    uno = await EG.enlace_video(CURSO, "rec-aaaa-1111")
    assert uno.startswith("https://video.daily.co/rec-aaaa-1111.mp4")
    antes = len(daily.llamadas)
    assert await EG.enlace_video(CURSO, "rec-aaaa-1111") == uno  # el reproductor salta: no se vuelve a preguntar
    assert len(daily.llamadas) == antes
    # Si dejó de servir, se pide otro.
    EG.olvidar_enlace("rec-aaaa-1111")
    assert await EG.enlace_video(CURSO, "rec-aaaa-1111") != uno
    # De otra sala, no; y un id raro ni se pregunta.
    with pytest.raises(EG.GrabacionError) as exc:
        await EG.enlace_video(CURSO, "rec-ajena-9999")
    assert exc.value.status == 404
    with pytest.raises(EG.GrabacionError) as exc:
        await EG.enlace_video(CURSO, "../rooms")
    assert exc.value.status == 400


async def test_si_daily_falla_las_semanas_salen_igual(db, org, monkeypatch):
    c, s1, _ = await _clase(db, org)

    async def roto(*a, **k):
        raise salas.SalaError("Daily (500): boom", 500)

    monkeypatch.setattr(salas, "_daily", roto)
    e = await EG.estudio(c, db)
    assert e["dias"] == [] and len(e["semanas"]) == 2 and "Daily (500): boom" in e["aviso"]
    monkeypatch.delenv("LEARNHOUSE_DAILY_API_KEY")
    assert "Falta la clave" in (await EG.estudio(c, db))["aviso"]


# ── La ruta del vídeo: quién puede verlo ────────────────────────────────────


async def test_la_ruta_del_video_solo_da_al_alumno_lo_publicado(db, org, monkeypatch):
    from fastapi import HTTPException

    from src.routers import grabaciones as rutas

    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-05")
    c, s1, _ = await _clase(db, org)
    daily = DailyFalso([_grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000), _grabacion("rec-bbbb-2222", "2026-11-03", 18, 900, minuto=40)])
    monkeypatch.setattr(salas, "_daily", daily)
    await EG.publicar(await T.tarea(s1, db), c, {"partes": [{"id": "rec-aaaa-1111"}]}, "Rida", db)

    class Alumno:
        id = 7

    async def curso(request, course_uuid, current_user, db_session):
        return c

    papel = {"equipo": False}

    async def roles(current_user, org_id, db_session):
        return papel["equipo"], False

    monkeypatch.setattr(rutas, "_curso", curso)
    monkeypatch.setattr(rutas, "_roles", roles)

    # El alumno: lo publicado, sí (un 302 al enlace de Daily, sin guardar).
    r = await rutas.api_video(None, "rec-aaaa-1111", course=CURSO, fresco=0, current_user=Alumno(), db_session=db)
    assert r.status_code == 302 and r.headers["location"].startswith("https://video.daily.co/rec-aaaa-1111.mp4")
    assert r.headers["cache-control"] == "no-store"
    # La parte que el equipo dejó fuera, no.
    with pytest.raises(HTTPException) as exc:
        await rutas.api_video(None, "rec-bbbb-2222", course=CURSO, fresco=0, current_user=Alumno(), db_session=db)
    assert exc.value.status_code == 404
    # El equipo, cualquiera de la sala (para recortarla antes de publicar).
    papel["equipo"] = True
    r = await rutas.api_video(None, "rec-bbbb-2222", course=CURSO, fresco=0, current_user=Alumno(), db_session=db)
    assert r.status_code == 302
    # «fresco» pide a Daily un enlace nuevo aunque hubiera uno guardado.
    antes = r.headers["location"]
    r = await rutas.api_video(None, "rec-bbbb-2222", course=CURSO, fresco=1, current_user=Alumno(), db_session=db)
    assert r.headers["location"] != antes

    # Publicar y quitar: solo el equipo; el alumno marca vista y el equipo mirando no cuenta.
    papel["equipo"] = False
    with pytest.raises(HTTPException) as exc:
        await rutas.api_publicar(None, s1, rutas.PublicarIn(partes=[rutas.ParteIn(id="rec-aaaa-1111")]), current_user=Alumno(), db_session=db)
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        await rutas.api_quitar(None, s1, current_user=Alumno(), db_session=db)
    assert exc.value.status_code == 403
    assert (await rutas.api_vista(None, s1, current_user=Alumno(), db_session=db))["vista"] is True
    papel["equipo"] = True
    assert (await rutas.api_vista(None, s1, current_user=Alumno(), db_session=db))["vista"] is False
    assert EG.quienes_la_vieron((await T.tarea(s1, db)).grabacion_sala) == {7}


def test_el_modo_de_ejemplo_solo_con_datos_de_prueba_y_sin_daily(monkeypatch):
    from src.services.salas import estudio_grabaciones as EG

    monkeypatch.delenv("LEARNHOUSE_DAILY_API_KEY", raising=False)
    monkeypatch.delenv("LEARNHOUSE_DATOS_DE_PRUEBA", raising=False)
    assert EG.modo_ejemplo() is False
    monkeypatch.setenv("LEARNHOUSE_DATOS_DE_PRUEBA", "si")
    assert EG.modo_ejemplo() is True
    # Con la clave de Daily puesta (la escuela de verdad), nunca.
    monkeypatch.setenv("LEARNHOUSE_DAILY_API_KEY", "clave")
    assert EG.modo_ejemplo() is False

    monkeypatch.delenv("LEARNHOUSE_DAILY_API_KEY")
    curso = "course_bfbcb42b-7dc3-4448-9df8-5d7b96135859"
    semanas = [{"fecha": "2026-11-10"}, {"fecha": "2026-11-17"}, {"fecha": "2026-09-01"}, {"fecha": ""}]
    g = EG.grabaciones_de_ejemplo(curso, semanas, "2026-11-10")
    # Solo la clase ya dada de las últimas 4 semanas: ni la que viene ni la vieja.
    assert len(g) == 1 and g[0]["id"].startswith("demo-20261110-")
    assert EG.es_de_ejemplo(curso, g[0]["id"]) and not EG.es_de_ejemplo("course_otro-curso-distinto-0000", g[0]["id"])
    assert EG._ID.fullmatch(g[0]["id"])

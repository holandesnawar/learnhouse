"""Salas en directo dentro de la escuela (services/salas/salas.py).

Daily no se alcanza desde las pruebas: se sustituye `_daily` por uno falso que
apunta cada llamada. Lo que se comprueba:
- la sala de cada curso tiene un nombre fijo y válido;
- se entra con su nombre; el equipo como anfitrión; desde el 02/11/2026 la
  grabación viene puesta de serie y la arranca CUALQUIERA que entra;
- si Daily no deja grabar, se entra igual sin grabar y se dice por qué;
- sin la clave, un mensaje claro; las grabaciones solo de ESTA sala;
- los ajustes por curso, y que la sala apagada no deja entrar.
"""

import copy
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.organization_config import OrganizationConfig
from src.routers import salas as rutas
from src.security.rbac.types import AccessDecision
from src.services.salas import salas

CURSO = "course_8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"


class DailyFalso:
    """Apunta las llamadas y contesta como Daily."""

    def __init__(self, sala_existe=False, falla_grabar=False):
        self.llamadas = []
        self.config_sala = {}
        self.sala_existe = sala_existe
        self.falla_grabar = falla_grabar

    async def __call__(self, metodo, ruta, cuerpo=None, params=None):
        self.llamadas.append((metodo, ruta, copy.deepcopy(cuerpo), params))
        if metodo == "GET" and ruta.startswith("/rooms/") and ruta.endswith("/presence"):
            return {"total_count": 2, "data": [{"userName": "Ana García"}, {"userName": ""}]}
        if metodo == "GET" and ruta.startswith("/rooms/"):
            if not self.sala_existe:
                raise salas.SalaError("Daily (404): not-found", 404)
            return {"url": "https://nawar.daily.co/" + ruta.split("/")[-1], "config": dict(self.config_sala)}
        if metodo == "POST" and ruta.startswith("/rooms/"):
            self.config_sala.update(cuerpo["properties"])
            return {"url": "https://nawar.daily.co/" + ruta.split("/")[-1]}
        if metodo == "POST" and ruta == "/rooms":
            self.sala_existe = True
            return {"url": "https://nawar.daily.co/" + cuerpo["name"]}
        if metodo == "POST" and ruta == "/meeting-tokens":
            if self.falla_grabar and cuerpo["properties"].get("start_cloud_recording"):
                raise salas.SalaError("Daily (400): invalid-request-error · recording not allowed on this plan", 400)
            return {"token": "tok-123"}
        if metodo == "GET" and ruta == "/recordings":
            return {"data": [
                {"id": "rec-1111-aaaa", "room_name": params["room_name"], "start_ts": 1761580800,
                 "duration": 3600, "status": "finished", "max_participants": 7},
            ]}
        if metodo == "GET" and ruta.startswith("/recordings/") and ruta.endswith("/access-link"):
            return {"download_link": "https://descarga.daily.co/rec.mp4"}
        if metodo == "GET" and ruta.startswith("/recordings/"):
            return {"room_name": "otra-sala" if "ajena" in ruta else salas.nombre_sala(CURSO)}
        raise AssertionError(f"Llamada inesperada: {metodo} {ruta}")


class Persona:
    def __init__(self, id=7, first_name="Ana", last_name="García", username="ana"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


@pytest.fixture(autouse=True)
def _limpia_cache():
    salas._salas.clear()
    yield
    salas._salas.clear()


def test_nombre_fijo_y_valido():
    assert salas.nombre_sala(CURSO) == "nawar-8a1d1fabffbb44ef"
    assert salas.nombre_sala(CURSO.replace("course_", "")) == salas.nombre_sala(CURSO)
    assert salas.uuid_curso(CURSO) == "8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"


def test_ajustes_por_curso_apagada_y_grabando_de_serie():
    # Apagada de serie, pero si se enciende, graba (02/11/2026).
    assert salas.leer_config({}, CURSO) == {"activo": False, "grabar": True}
    config = {"salas": {"8a1d1fab-ffbb-44ef-8f21-04ef63676d6e": {"activo": True}}}
    assert salas.leer_config(config, CURSO) == {"activo": True, "grabar": True}
    # Desde el 02/11/2026 no hay casilla: un «grabar: false» de antes no cuenta.
    config = {"salas": {"8a1d1fab-ffbb-44ef-8f21-04ef63676d6e": {"activo": True, "grabar": False}}}
    assert salas.leer_config(config, CURSO) == {"activo": True, "grabar": True}


def test_nombre_visible():
    assert salas.nombre_visible("Ana", "García", "ana") == "Ana García"
    assert salas.nombre_visible("", "", "ana_g") == "ana_g"
    assert salas.nombre_visible(" ", "", "") == "Alumno"


def test_cualquiera_que_entra_arranca_la_grabacion():
    """02/11/2026: "al entrar alguien, quien sea, ya se grabe"."""
    alumno = salas.propiedades_entrada("nawar-x", "Ana", 7, anfitrion=False, grabar=True, ahora=1000)
    assert alumno["is_owner"] is False
    assert alumno["enable_recording"] == "cloud" and alumno["start_cloud_recording"] is True
    assert alumno["user_name"] == "Ana" and alumno["user_id"] == "7" and alumno["lang"] == "es"
    assert alumno["exp"] == 1000 + 4 * 3600 and alumno["eject_at_token_exp"] is True

    profe = salas.propiedades_entrada("nawar-x", "Paul", 3, anfitrion=True, grabar=True, ahora=1000)
    assert profe["is_owner"] is True
    assert profe["enable_recording"] == "cloud" and profe["start_cloud_recording"] is True

    # Nadie ve el botón de grabar: ni el alumno ni el equipo la paran a mano.
    assert alumno["enable_recording_ui"] is False and profe["enable_recording_ui"] is False

    sin_grabar = salas.propiedades_entrada("nawar-x", "Paul", 3, anfitrion=True, grabar=False, ahora=1000)
    assert "start_cloud_recording" not in sin_grabar and "enable_recording" not in sin_grabar


def test_presentes_y_grabaciones_en_cristiano():
    assert salas.presentes_de({"data": [{"userName": "Ana"}, {"user_name": "Luis"}, {}]}) == ["Ana", "Luis", "Alguien"]
    assert salas.presentes_de(None) == []
    g = salas.grabacion_de({"id": "r1", "start_ts": 0, "duration": 61, "status": "finished"})
    assert g["id"] == "r1" and g["duracion_seg"] == 61 and g["estado"] == "finished"
    assert salas.motivo_daily({"error": "x", "info": "y"}, 400) == "Daily (400): x · y"


async def test_crea_la_sala_la_primera_vez_y_entra_con_su_nombre(monkeypatch):
    daily = DailyFalso()
    monkeypatch.setattr(salas, "_daily", daily)
    r = await salas.entrar(CURSO, Persona(), anfitrion=False, grabar=True)
    assert r["url"] == "https://nawar.daily.co/nawar-8a1d1fabffbb44ef"
    assert r["token"] == "tok-123" and r["nombre"] == "Ana García"
    assert r["anfitrion"] is False and r["grabando"] is True and r["aviso"] == ""
    creada = [c for c in daily.llamadas if c[:2] == ("POST", "/rooms")]
    assert len(creada) == 1 and creada[0][2]["privacy"] == "private"
    assert creada[0][2]["properties"]["enable_recording"] == "cloud"

    # La segunda vez no se pregunta ni se crea: la dirección ya se sabe.
    daily.llamadas.clear()
    await salas.entrar(CURSO, Persona(), anfitrion=False, grabar=False)
    assert [c[1] for c in daily.llamadas] == ["/meeting-tokens"]


async def test_el_profe_graba_y_si_daily_no_deja_entra_sin_grabar(monkeypatch):
    daily = DailyFalso(sala_existe=True)
    monkeypatch.setattr(salas, "_daily", daily)
    r = await salas.entrar(CURSO, Persona(first_name="Paul", last_name=""), anfitrion=True, grabar=True)
    assert r["anfitrion"] is True and r["grabando"] is True and r["aviso"] == ""
    # A la sala que ya existía sin grabación se le pone una vez.
    assert ("POST", "/rooms/nawar-8a1d1fabffbb44ef", {"properties": {"enable_recording": "cloud"}}, None) in daily.llamadas
    assert daily.config_sala["enable_recording"] == "cloud"

    salas._salas.clear()
    daily = DailyFalso(sala_existe=True, falla_grabar=True)
    monkeypatch.setattr(salas, "_daily", daily)
    r = await salas.entrar(CURSO, Persona(), anfitrion=True, grabar=True)
    assert r["token"] == "tok-123" and r["grabando"] is False
    assert "recording not allowed" in r["aviso"]
    entradas = [c[2]["properties"] for c in daily.llamadas if c[1] == "/meeting-tokens"]
    assert entradas[0].get("start_cloud_recording") is True and "start_cloud_recording" not in entradas[1]


async def test_sin_clave_lo_dice(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_DAILY_API_KEY", raising=False)
    with pytest.raises(salas.SalaError) as exc:
        await salas.entrar(CURSO, Persona(), anfitrion=False, grabar=False)
    assert exc.value.status == 503 and "LEARNHOUSE_DAILY_API_KEY" in exc.value.mensaje


async def test_presentes_en_blando(monkeypatch):
    monkeypatch.setattr(salas, "_daily", DailyFalso())
    assert await salas.presentes(CURSO) == ["Ana García", "Alguien"]

    async def roto(*a, **k):
        raise salas.SalaError("Daily (500): caído", 500)

    monkeypatch.setattr(salas, "_daily", roto)
    assert await salas.presentes(CURSO) == []


async def test_grabaciones_solo_de_esta_sala(monkeypatch):
    monkeypatch.setattr(salas, "_daily", DailyFalso(sala_existe=True))
    lista = await salas.grabaciones(CURSO)
    assert lista[0]["id"] == "rec-1111-aaaa" and lista[0]["duracion_seg"] == 3600
    assert await salas.enlace_descarga(CURSO, "rec-1111-aaaa") == "https://descarga.daily.co/rec.mp4"
    with pytest.raises(salas.SalaError) as exc:
        await salas.enlace_descarga(CURSO, "rec-ajena-bbbb")
    assert exc.value.status == 404
    with pytest.raises(salas.SalaError):
        await salas.enlace_descarga(CURSO, "../../rooms")


async def _con_config(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0"},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()


async def test_guardar_ajustes(db, org):
    await _con_config(db, org)
    assert await salas.config_de(org.id, CURSO, db) == {"activo": False, "grabar": True}
    assert await salas.guardar_config(org.id, CURSO, True, None, db) == {"activo": True, "grabar": True}
    # Quitar la grabación ya no se puede: se graba siempre (02/11/2026).
    assert await salas.guardar_config(org.id, CURSO, None, False, db) == {"activo": True, "grabar": True}
    assert await salas.config_de(org.id, CURSO.replace("course_", ""), db) == {"activo": True, "grabar": True}
    assert await salas.guardar_config(org.id, CURSO, None, True, db) == {"activo": True, "grabar": True}


async def test_encender_marca_el_curso_en_directo_y_no_pierde_el_recuadro(db, org):
    await _con_config(db, org)
    await salas.guardar_recuadro(org.id, CURSO, {"teacher": "Paul", "schedule": "19:00", "raro": "x"}, db)
    await salas.guardar_config(org.id, CURSO, True, True, db)
    await salas.guardar_config(org.id, CURSO, False, None, db)
    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    guardado = fila.config["salas"]["8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"]
    # Apagada, pero sigue siendo una clase en directo, con su recuadro y la grabación puesta.
    assert guardado["activo"] is False and guardado["directo"] is True and guardado["grabar"] is True
    assert guardado["banner"]["teacher"] == "Paul" and guardado["banner"]["schedule"] == "19:00"
    assert "raro" not in guardado["banner"]


async def test_quitar_las_clases_grabadas_no_toca_lo_demas(db, org):
    await _con_config(db, org)
    await salas.guardar_config(org.id, CURSO, True, True, db)
    r = await salas.guardar_config(org.id, CURSO, None, None, db, grabadas=False)
    assert r == {"activo": True, "grabar": True, "grabadas": False}
    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    guardado = fila.config["salas"]["8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"]
    assert guardado["grabadas"] is False and guardado["directo"] is True and guardado["activo"] is True
    assert (await salas.guardar_config(org.id, CURSO, None, None, db, grabadas=True))["grabadas"] is True


def test_recuadro_solo_campos_conocidos_y_con_tope():
    r = salas.limpiar_recuadro({"teacher": "  Paul  ", "subtitle": "x" * 900, "otro": "no"})
    assert r["teacher"] == "Paul" and len(r["subtitle"]) == 600 and "otro" not in r
    assert set(r) == set(salas.CAMPOS_RECUADRO)
    assert salas.limpiar_recuadro(None)["live_url"] == ""


@pytest.fixture
def acceso_permitido():
    with patch.object(rutas, "check_resource_access",
                      new=AsyncMock(return_value=AccessDecision(allowed=True, reason="ok"))) as m:
        yield m


async def test_la_sala_apagada_no_deja_entrar_y_el_alumno_no_la_enciende(
    db, org, course, admin_user, regular_user, mock_request, acceso_permitido, monkeypatch
):
    await _con_config(db, org)
    monkeypatch.setattr(salas, "_daily", DailyFalso())
    with pytest.raises(HTTPException) as exc:
        await rutas.api_entrar(mock_request, "test", regular_user, db)
    assert exc.value.status_code == 409

    with pytest.raises(HTTPException) as exc:
        await rutas.api_guardar(mock_request, "test", rutas.SalaIn(activo=True), regular_user, db)
    assert exc.value.status_code == 403

    await rutas.api_guardar(mock_request, "test", rutas.SalaIn(activo=True, grabar=True), admin_user, db)
    alumno = await rutas.api_entrar(mock_request, "test", regular_user, db)
    assert alumno["anfitrion"] is False and alumno["nombre"] == "Regular User"
    # Él también arranca la grabación al entrar (02/11/2026).
    assert alumno["grabar"] is True and alumno["grabando"] is True
    admin = await rutas.api_entrar(mock_request, "test", admin_user, db)
    assert admin["anfitrion"] is True and admin["grabando"] is True

    with pytest.raises(HTTPException) as exc:
        await rutas.api_grabaciones(mock_request, "test", regular_user, db)
    assert exc.value.status_code == 403

    # El recuadro (día, hora, profe) lo cambia solo un administrador.
    with pytest.raises(HTTPException) as exc:
        await rutas.api_recuadro(mock_request, "test", rutas.RecuadroIn(teacher="Yo"), regular_user, db)
    assert exc.value.status_code == 403
    r = await rutas.api_recuadro(mock_request, "test", rutas.RecuadroIn(teacher="Paul"), admin_user, db)
    assert r["teacher"] == "Paul"


async def test_sin_sesion_no_entra_aunque_el_curso_sea_publico(
    db, org, course, admin_user, anonymous_user, mock_request, acceso_permitido, monkeypatch
):
    await _con_config(db, org)
    monkeypatch.setattr(salas, "_daily", DailyFalso())
    await rutas.api_guardar(mock_request, "test", rutas.SalaIn(activo=True), admin_user, db)
    for ruta in (rutas.api_entrar, rutas.api_sala):
        with pytest.raises(HTTPException) as exc:
            await ruta(mock_request, "test", anonymous_user, db)
        assert exc.value.status_code == 401


async def test_sin_acceso_al_curso_no_entra(db, org, course, regular_user, mock_request):
    await _con_config(db, org)
    with patch.object(rutas, "check_resource_access",
                      new=AsyncMock(return_value=AccessDecision(allowed=False, reason="no"))):
        with pytest.raises(HTTPException) as exc:
            await rutas.api_entrar(mock_request, "test", regular_user, db)
    assert exc.value.status_code == 403


# ── Duplicar una clase en directo y la etiqueta (29/10/2026) ────────────────

SEMANAL = "course_bfbcb42b-7dc3-4448-9df8-5d7b96135859"


def test_la_copia_de_la_clase_semanal_hereda_lo_suyo_menos_la_etiqueta():
    config = {
        "weekly_class_banner": {"teacher": "Paul", "schedule": "19:00", "raro": "x"},
        "salas": {"bfbcb42b-7dc3-4448-9df8-5d7b96135859": {"activo": True, "grabar": True, "etiqueta": "Groep rood"}},
        "customization": {"faq": {"items": [], "courses": {"bfbcb42b-7dc3-4448-9df8-5d7b96135859": {"items": [{"q": "¿Cuándo?", "a": "Jueves"}]}}}},
    }
    assert salas.es_clase_en_directo(config, SEMANAL) and not salas.es_clase_en_directo(config, CURSO)
    nuevo = salas.config_con_la_copia(config, SEMANAL, "course_nuevo-123")
    copia = nuevo["salas"]["nuevo-123"]
    # Es en directo, enseña las grabaciones y se lleva el recuadro viejo de toda la escuela.
    assert copia["directo"] and copia["grabadas"] and copia["activo"] and copia["grabar"]
    assert copia["banner"]["teacher"] == "Paul" and "raro" not in copia["banner"]
    assert "etiqueta" not in copia
    assert nuevo["customization"]["faq"]["courses"]["nuevo-123"]["items"][0]["q"] == "¿Cuándo?"
    # El original no se toca.
    assert config["salas"]["bfbcb42b-7dc3-4448-9df8-5d7b96135859"]["etiqueta"] == "Groep rood"
    assert "nuevo-123" not in config["salas"]


async def test_etiqueta_solo_para_administradores(db, org):
    await _con_config(db, org)
    r = await salas.guardar_config(org.id, CURSO, None, None, db, etiqueta="  Groep   rood  ")
    assert r["etiqueta"] == "Groep rood"
    assert salas.limpiar_etiqueta("x" * 80) == "x" * 30
    assert (await salas.guardar_config(org.id, CURSO, None, None, db, etiqueta=""))["etiqueta"] == ""


async def test_copiar_a_la_copia_con_sus_semanas(db, org):
    from src.db.tareas import TareaSemana

    await _con_config(db, org)
    await salas.guardar_config(org.id, CURSO, True, None, db)
    db.add(TareaSemana(org_id=org.id, course_uuid=CURSO.replace("course_", ""), chapter_uuid="chapter_a", tema="Los colores",
                       fecha="2026-11-02", enunciado="Graba tu presentación"))
    db.add(TareaSemana(org_id=org.id, course_uuid=CURSO.replace("course_", ""), chapter_uuid="chapter_suelto", tema="Otra"))
    await db.commit()
    assert await salas.copiar_a_la_copia(org.id, CURSO, "course_copia-1", {"chapter_a": "chapter_b"}, db)
    filas = (await db.execute(select(TareaSemana).where(TareaSemana.course_uuid == "copia-1"))).scalars().all()
    assert [(f.chapter_uuid, f.tema, f.fecha, f.enunciado) for f in filas] == [("chapter_b", "Los colores", "2026-11-02", "Graba tu presentación")]
    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    assert fila.config["salas"]["copia-1"]["directo"] is True
    # Un curso normal (la formación) no se toca.
    assert not await salas.copiar_a_la_copia(org.id, "course_otro", "course_copia-2", {}, db)

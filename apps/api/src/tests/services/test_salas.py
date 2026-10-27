"""Salas en directo dentro de la escuela (services/salas/salas.py).

Daily no se alcanza desde las pruebas: se sustituye `_daily` por uno falso que
apunta cada llamada. Lo que se comprueba:
- la sala de cada curso tiene un nombre fijo y válido;
- el alumno entra con su nombre y SIN grabar; el equipo entra como anfitrión y
  graba solo si el curso lo tiene puesto;
- si Daily no deja grabar, se entra igual sin grabar y se dice por qué;
- sin la clave, un mensaje claro; las grabaciones solo de ESTA sala;
- los ajustes por curso, y que la sala apagada no deja entrar.
"""

import copy
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.db.organization_config import OrganizationConfig
from src.routers import salas as rutas
from src.security.rbac.types import AccessDecision
from src.services.salas import salas

CURSO = "course_8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"


class DailyFalso:
    """Apunta las llamadas y contesta como Daily."""

    def __init__(self, sala_existe=False, falla_grabar=False):
        self.llamadas = []
        self.sala_existe = sala_existe
        self.falla_grabar = falla_grabar

    async def __call__(self, metodo, ruta, cuerpo=None, params=None):
        self.llamadas.append((metodo, ruta, copy.deepcopy(cuerpo), params))
        if metodo == "GET" and ruta.startswith("/rooms/") and ruta.endswith("/presence"):
            return {"total_count": 2, "data": [{"userName": "Ana García"}, {"userName": ""}]}
        if metodo == "GET" and ruta.startswith("/rooms/"):
            if not self.sala_existe:
                raise salas.SalaError("Daily (404): not-found", 404)
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


def test_ajustes_por_curso_apagada_de_serie():
    assert salas.leer_config({}, CURSO) == {"activo": False, "grabar": False}
    config = {"salas": {"8a1d1fab-ffbb-44ef-8f21-04ef63676d6e": {"activo": True, "grabar": True}}}
    assert salas.leer_config(config, CURSO) == {"activo": True, "grabar": True}
    assert salas.leer_config(config, "course_otro") == {"activo": False, "grabar": False}


def test_nombre_visible():
    assert salas.nombre_visible("Ana", "García", "ana") == "Ana García"
    assert salas.nombre_visible("", "", "ana_g") == "ana_g"
    assert salas.nombre_visible(" ", "", "") == "Alumno"


def test_entrada_del_alumno_no_graba_y_la_del_equipo_si():
    alumno = salas.propiedades_entrada("nawar-x", "Ana", 7, anfitrion=False, grabar=True, ahora=1000)
    assert alumno["is_owner"] is False and "start_cloud_recording" not in alumno
    assert alumno["user_name"] == "Ana" and alumno["user_id"] == "7" and alumno["lang"] == "es"
    assert alumno["exp"] == 1000 + 4 * 3600 and alumno["eject_at_token_exp"] is True

    profe = salas.propiedades_entrada("nawar-x", "Paul", 3, anfitrion=True, grabar=True, ahora=1000)
    assert profe["is_owner"] is True
    assert profe["enable_recording"] == "cloud" and profe["start_cloud_recording"] is True

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
    assert r["anfitrion"] is False and r["grabando"] is False and r["aviso"] == ""
    creada = [c for c in daily.llamadas if c[:2] == ("POST", "/rooms")]
    assert len(creada) == 1 and creada[0][2]["privacy"] == "private"

    # La segunda vez no se pregunta ni se crea: la dirección ya se sabe.
    daily.llamadas.clear()
    await salas.entrar(CURSO, Persona(), anfitrion=False, grabar=False)
    assert [c[1] for c in daily.llamadas] == ["/meeting-tokens"]


async def test_el_profe_graba_y_si_daily_no_deja_entra_sin_grabar(monkeypatch):
    monkeypatch.setattr(salas, "_daily", DailyFalso(sala_existe=True))
    r = await salas.entrar(CURSO, Persona(first_name="Paul", last_name=""), anfitrion=True, grabar=True)
    assert r["anfitrion"] is True and r["grabando"] is True and r["aviso"] == ""

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
    assert await salas.config_de(org.id, CURSO, db) == {"activo": False, "grabar": False}
    assert await salas.guardar_config(org.id, CURSO, True, None, db) == {"activo": True, "grabar": False}
    assert await salas.guardar_config(org.id, CURSO, None, True, db) == {"activo": True, "grabar": True}
    assert await salas.config_de(org.id, CURSO.replace("course_", ""), db) == {"activo": True, "grabar": True}


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
    assert alumno["anfitrion"] is False and alumno["grabando"] is False and alumno["nombre"] == "Regular User"
    # No graba él, pero se le avisa de que la sesión se graba.
    assert alumno["grabar"] is True
    admin = await rutas.api_entrar(mock_request, "test", admin_user, db)
    assert admin["anfitrion"] is True and admin["grabando"] is True

    with pytest.raises(HTTPException) as exc:
        await rutas.api_grabaciones(mock_request, "test", regular_user, db)
    assert exc.value.status_code == 403


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

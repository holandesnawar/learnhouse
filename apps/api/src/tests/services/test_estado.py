"""
Estado de la escuela: lo que se apunta, cómo se limpia y cómo se resume.
Ver src/services/estado/estado.py.
"""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.core.middleware.estado import EstadoMiddleware
from src.services.estado import estado as E


# ── Sin datos personales ─────────────────────────────────────────────────────

def test_el_mensaje_sale_sin_correos_telefonos_ni_claves():
    sucio = (
        "IntegrityError: duplicate key ana.perez+1@gmail.com tel +31 6 12345678 "
        "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.abcDEF123 clave sk_live_51Habcdefghijk "
        "curso 3f2504e0-4f89-41d3-9a0c-0305e82c3301"
    )
    limpio = E.limpiar_texto(sucio)
    assert "gmail" not in limpio and "ana.perez" not in limpio
    assert "12345678" not in limpio
    assert "eyJ" not in limpio
    assert "sk_live" not in limpio
    assert "3f2504e0" not in limpio
    assert limpio.startswith("IntegrityError: duplicate key")


def test_el_mensaje_se_recorta():
    assert len(E.limpiar_texto("x " * 1000, 120)) <= 120


def test_la_ruta_sale_sin_ids_ni_correos():
    assert E.limpiar_ruta("/course/3f2504e0-4f89-41d3-9a0c-0305e82c3301/activity/42?x=1") == "/course/{id}/activity/{id}"
    assert E.limpiar_ruta("/api/v1/contactos/org/1/contacto/ana@gmail.com") == "/api/v1/contactos/org/{id}/contacto/{id}"
    assert E.limpiar_ruta("https://app.holandesnawar.com/auth/crear-cuenta?email=a@b.com&resetCode=123") == "/auth/crear-cuenta"
    assert E.limpiar_ruta("/community/community_bbe57cb8-aaaa-bbbb-cccc-1234567890ab") == "/community/{id}"
    assert E.limpiar_ruta("/api/v1/ebook/compra/cs_test_a1B2c3D4e5F6g7") == "/api/v1/ebook/compra/{id}"
    assert E.limpiar_ruta("") == "/"


def test_el_navegador_en_cristiano():
    iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
    assert E.navegador_de(iphone) == "iPhone · Safari 17"
    chrome_iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1"
    assert E.navegador_de(chrome_iphone) == "iPhone · Chrome 126"
    android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    assert E.navegador_de(android) == "Android · Chrome 126"
    insta = iphone + " Instagram 330.0.0.0"
    assert E.navegador_de(insta) == "iPhone · Instagram"
    edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
    assert E.navegador_de(edge) == "Windows · Edge 126"
    assert E.navegador_de("") == ""


# ── Qué cuenta como lenta ────────────────────────────────────────────────────

def test_el_umbral_de_las_lentas():
    ruta = "/api/v1/student/insights"
    assert not E.cuenta_como_lenta(ruta, "GET", "", 1999)
    assert E.cuenta_como_lenta(ruta, "GET", "", 2000)
    assert E.cuenta_como_lenta(ruta, "GET", "", 9000)


@pytest.mark.parametrize("ruta,metodo,tipo", [
    ("/api/v1/payments/webhook", "POST", "application/json"),
    ("/api/v1/backup/content-archive", "GET", ""),
    ("/api/v1/tareas/semana/{id}/profe/archivo", "POST", "multipart/form-data; boundary=x"),
    ("/api/v1/messages/send", "POST", "multipart/form-data; boundary=x"),
    ("/api/v1/tareas/audio/{entrega_id}/{cual}", "GET", ""),
    ("/api/v1/ebook/descarga/{token}", "GET", ""),
    ("/api/v1/tareas/course/{course_uuid}/mira-tambien/{activity_uuid}/video", "GET", ""),
    ("/content/orgs/x/logo.png", "GET", ""),
    ("/api/v1/student/insights", "OPTIONS", ""),
])
def test_subidas_descargas_y_webhooks_no_cuentan_como_lentas(ruta, metodo, tipo):
    assert not E.cuenta_como_lenta(ruta, metodo, tipo, 30000)


# ── Agrupar ──────────────────────────────────────────────────────────────────

def _error(**cambios):
    base = {
        "tipo": "error-api", "cuando": "2026-11-10T10:00:05", "ruta": "/api/v1/tareas/semana/{id}", "metodo": "GET",
        "status": 500, "ms": 120, "mensaje": "KeyError: 'tema'", "user_id": 7,
    }
    base.update(cambios)
    return base


def test_los_repetidos_del_mismo_minuto_son_una_fila():
    grupos = E.agrupar([
        _error(),
        _error(cuando="2026-11-10T10:00:40", ms=900),
        _error(cuando="2026-11-10T10:00:59"),
    ])
    assert len(grupos) == 1
    assert grupos[0]["veces"] == 3
    assert grupos[0]["ms"] == 900
    assert grupos[0]["cuando"] == "2026-11-10T10:00:05"
    assert grupos[0]["ultima"] == "2026-11-10T10:00:59"
    assert len(grupos[0]["clave"]) == 40


def test_otro_minuto_otra_persona_u_otro_fallo_no_se_juntan():
    grupos = E.agrupar([
        _error(),
        _error(cuando="2026-11-10T10:01:00"),
        _error(user_id=8),
        _error(mensaje="ValueError: x"),
        _error(tipo="lenta", status=200),
    ])
    assert len(grupos) == 5


def test_el_tope_por_minuto():
    E._minuto_actual, E._escritas_este_minuto = "", 0
    assert E._cupo(50, "2026-11-10T10:00:00") == 50
    assert E._cupo(50, "2026-11-10T10:00:30") == E.TOPE_POR_MINUTO - 50
    assert E._cupo(50, "2026-11-10T10:00:59") == 0
    # Minuto nuevo, cupo nuevo.
    assert E._cupo(5, "2026-11-10T10:01:00") == 5


# ── Tiempos ──────────────────────────────────────────────────────────────────

def test_los_cubos_y_los_percentiles():
    assert E.cubo_de(10) == 0
    assert E.cubo_de(50) == 1
    assert E.cubo_de(1999) == 5
    assert E.cubo_de(999999) == len(E.CUBOS)
    hist = E.hist_vacio()
    for ms in [20] * 90 + [3000] * 10:
        hist[E.cubo_de(ms)] += 1
    assert E.percentil(hist, 0.5) < 50
    assert 2000 <= E.percentil(hist, 0.95) <= 4000
    assert E.percentil(E.hist_vacio(), 0.5) == 0
    assert E.leer_hist("no es json") == E.hist_vacio()
    assert E.sumar_hist(hist, hist)[0] == 180


# ── El resumen ───────────────────────────────────────────────────────────────

AHORA = datetime(2026, 11, 10, 12, 0, 0, tzinfo=timezone.utc)


def _filas():
    import json

    rapido = E.hist_vacio()
    rapido[0] = 100
    lento = E.hist_vacio()
    lento[6] = 8
    lento[1] = 2
    return [
        {**_error(), "veces": 3, "ultima": "2026-11-10T10:00:59", "navegador": "iPhone · Safari 17", "version": "abc"},
        {**_error(user_id=8, cuando="2026-11-09T09:00:00"), "veces": 1, "navegador": "Android · Chrome 126"},
        {**_error(user_id=None, cuando="2026-11-08T09:00:00"), "veces": 2},
        # De hace más de 7 días: no cuenta.
        {**_error(cuando="2026-10-20T09:00:00"), "veces": 50},
        {"tipo": "lenta", "cuando": "2026-11-10T08:00:00", "ruta": "/api/v1/student/insights", "metodo": "GET", "status": 200, "ms": 4100, "veces": 2, "user_id": 7},
        {"tipo": "lenta", "cuando": "2026-11-09T08:00:00", "ruta": "/api/v1/student/insights", "metodo": "GET", "status": 200, "ms": 2500, "veces": 1, "user_id": 9},
        {"tipo": "error-pantalla", "cuando": "2026-11-10T11:00:00", "pagina": "/course/{id}", "mensaje": "NotFoundError: removeChild", "extra": "traducida", "veces": 2, "user_id": 7, "navegador": "Android · Chrome 126"},
        {"tipo": "tiempos", "cuando": "2026-11-10T10:00:00", "ruta": "/api/v1/health", "metodo": "GET", "mensaje": json.dumps(rapido), "ms": 2000, "status": 40, "veces": 100},
        {"tipo": "tiempos", "cuando": "2026-11-10T10:00:00", "ruta": "/api/v1/student/insights", "metodo": "GET", "mensaje": json.dumps(lento), "ms": 25000, "status": 3900, "veces": 10},
        {"tipo": "tiempos", "cuando": "2026-11-10T11:00:00", "ruta": "/api/v1/student/insights", "metodo": "GET", "mensaje": json.dumps(lento), "ms": 25000, "status": 3500, "veces": 10},
        {"tipo": "arranque", "cuando": "2026-11-10T07:00:00", "version": "abc"},
        {"tipo": "arranque", "cuando": "2026-11-07T07:00:00", "version": "old"},
    ]


def test_el_resumen():
    r = E.resumir(_filas(), AHORA)
    assert len(r["errores"]) == 1
    e = r["errores"][0]
    assert e["veces"] == 6 and e["hoy"] == 3 and e["personas"] == 2 and e["anonimas"] == 1
    assert e["ultima"] == "2026-11-10T10:00:59"
    assert e["navegadores"][0] == {"nombre": "iPhone · Safari 17", "veces": 3}
    assert r["hoy"]["errores"] == 3 and r["hoy"]["rutas_con_error"] == 1
    assert r["semana"]["errores"] == 6

    assert r["lentas"][0]["veces"] == 3 and r["lentas"][0]["peor_ms"] == 4100 and r["lentas"][0]["personas"] == 2

    p = r["pantallas"][0]
    assert p["pagina"] == "/course/{id}" and p["veces"] == 2 and p["traducida"] == 2
    assert r["hoy"]["pantallas"] == 2 and r["hoy"]["paginas_rotas"] == 1

    # La ruta lenta, primera; las dos horas, sumadas.
    primera = r["rutas"][0]
    assert primera["ruta"] == "/api/v1/student/insights"
    assert primera["peticiones"] == 20
    assert primera["mediana_ms"] >= 2000 and primera["p95_ms"] >= primera["mediana_ms"]
    assert primera["peor_ms"] == 3900 and primera["media_ms"] == 2500
    assert r["rutas"][1]["mediana_ms"] < 50

    assert [a["version"] for a in r["arranques"]] == ["abc", "old"]
    assert r["hoy"]["arranques"] == 1


def test_el_semaforo():
    vacio = E.resumir([], AHORA)
    assert E.semaforo(vacio)["color"] == "verde"
    r = E.resumir(_filas(), AHORA)
    s = E.semaforo(r)
    assert s["color"] == "ambar"
    assert "3 errores hoy en 1 acción" in s["frase"] and "2 pantallas rotas en 1 página" in s["frase"]
    caido = E.semaforo(vacio, {"comprobaciones": [{"nombre": "Redis", "ok": False}]})
    assert caido["color"] == "rojo" and "Redis" in caido["frase"]
    lleno = E.semaforo(vacio, {"comprobaciones": [{"nombre": E.ESPACIO, "ok": False, "detalle": "93 % usado · quedan 300 MB"}]})
    assert lleno["color"] == "rojo" and lleno["frase"].startswith("Queda poco espacio")


# ── La pantalla rota ─────────────────────────────────────────────────────────

def test_el_aviso_del_navegador_sale_limpio():
    e = E.evento_de_pantalla({
        "m": "NotFoundError: Failed to execute 'removeChild' on 'Node' para ana@gmail.com",
        "p": "at removeChild (https://app.holandesnawar.com/_next/static/chunks/main-app.js:1:2)",
        "u": "https://app.holandesnawar.com/course/3f2504e0-4f89-41d3-9a0c-0305e82c3301/activity/9?x=ana@gmail.com",
        "t": True, "a": False, "d": "trozo", "n": "Inicio · Tu semana",
    }, "ua")
    assert e and e["tipo"] == "error-pantalla"
    assert "gmail" not in e["mensaje"] and "removeChild" in e["mensaje"]
    assert e["pagina"] == "/course/{id}/activity/{id}"
    assert e["extra"] == "traducida,trozo"
    assert E.evento_de_pantalla({"m": ""}) is None
    assert E.evento_de_pantalla("texto") is None


# ── Las claves: solo sí o no ─────────────────────────────────────────────────

def test_de_las_claves_solo_se_dice_si_estan():
    claves = E.claves_puestas({"LEARNHOUSE_STRIPE_SECRET_KEY": "sk_live_secreto", "LEARNHOUSE_DAILY_API_KEY": "  "})
    por_nombre = {c["nombre"]: c["puesta"] for c in claves}
    assert por_nombre["Stripe (cobros)"] is True
    assert por_nombre["Daily (salas)"] is False
    assert "sk_live" not in str(claves)


# ── El middleware, con una aplicación de mentira ─────────────────────────────

@pytest.fixture
def encendido(monkeypatch):
    """En los tests el estado está apagado: aquí se enciende, sin tarea de fondo."""
    monkeypatch.setattr(E, "_activo", True)
    monkeypatch.setattr(E, "asegurar_tarea", lambda: None)
    E._cola.clear()
    E._tiempos.clear()
    yield
    E._cola.clear()
    E._tiempos.clear()


def _app():
    app = FastAPI()

    @app.get("/api/v1/bien/{cosa_id}")
    async def bien(cosa_id: int):
        return {"ok": cosa_id}

    @app.get("/api/v1/rota/{cosa_id}")
    async def rota(cosa_id: int):
        raise KeyError("tema de ana@gmail.com")

    @app.get("/api/v1/caida")
    async def caida():
        raise HTTPException(status_code=503, detail="Database is not healthy")

    @app.get("/api/v1/no-esta")
    async def no_esta():
        raise HTTPException(status_code=404, detail="No existe")

    app.add_middleware(EstadoMiddleware)
    return app


def test_el_middleware_apunta_errores_y_tiempos(encendido):
    cliente = TestClient(_app(), raise_server_exceptions=False)

    assert cliente.get("/api/v1/bien/5").status_code == 200
    assert cliente.get("/api/v1/no-esta").status_code == 404
    assert not E._cola, "ni lo que va bien ni un 404 se apuntan como error"
    # Los tiempos, por la plantilla de la ruta, no por la ruta con su id.
    assert any(ruta == "/api/v1/bien/{cosa_id}" for (_, _, ruta) in E._tiempos)

    assert cliente.get("/api/v1/rota/7", headers={"referer": "https://x.com/course/123", "user-agent": "curl/8"}).status_code == 500
    e = E._cola.pop()
    assert e["tipo"] == "error-api" and e["status"] == 500
    assert e["ruta"] == "/api/v1/rota/{cosa_id}"
    assert e["mensaje"].startswith("KeyError") and "gmail" not in e["mensaje"]
    assert e["pagina"] == "/course/{id}"

    assert cliente.get("/api/v1/caida").status_code == 503
    e = E._cola.pop()
    assert e["status"] == 503 and e["mensaje"] == "Database is not healthy"


def test_el_middleware_apunta_las_lentas(encendido, monkeypatch):
    monkeypatch.setattr(E, "UMBRAL_LENTA_MS", 0)
    monkeypatch.setattr(E, "cuenta_como_lenta", lambda *a, **k: True)
    cliente = TestClient(_app())
    assert cliente.get("/api/v1/bien/5").status_code == 200
    e = E._cola.pop()
    assert e["tipo"] == "lenta" and e["ruta"] == "/api/v1/bien/{cosa_id}"


def test_apagado_no_apunta_nada(monkeypatch):
    monkeypatch.setattr(E, "_activo", False)
    E._cola.clear()
    cliente = TestClient(_app(), raise_server_exceptions=False)
    assert cliente.get("/api/v1/rota/7").status_code == 500
    assert not E._cola


def test_si_apuntar_falla_la_peticion_sale_igual(encendido, monkeypatch):
    def romper(*a, **k):
        raise RuntimeError("la base de datos no está")

    monkeypatch.setattr(E, "apuntar_tiempo", romper)
    monkeypatch.setattr(E, "apuntar", romper)
    cliente = TestClient(_app(), raise_server_exceptions=False)
    assert cliente.get("/api/v1/bien/5").json() == {"ok": 5}
    assert cliente.get("/api/v1/caida").status_code == 503


# ── Escribir y leer, con base de datos de verdad (SQLite en memoria) ─────────

def test_vaciar_escribe_agrupado_y_el_panel_lo_lee(monkeypatch):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlmodel import SQLModel, select
    from sqlmodel.ext.asyncio.session import AsyncSession

    from src.db.estado import EstadoEvento

    async def prueba():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: SQLModel.metadata.create_all(c, tables=[EstadoEvento.__table__]))
        fabrica = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        monkeypatch.setattr(E, "_fabrica", lambda: fabrica)
        monkeypatch.setattr(E, "_activo", True)
        E._cola.clear()
        E._tiempos.clear()
        E._minuto_actual, E._escritas_este_minuto = "", 0

        ahora = E.ahora_iso()
        for _ in range(3):
            E.apuntar({"tipo": "error-api", "cuando": ahora, "ruta": "/api/v1/x/{id}", "metodo": "GET", "status": 500, "ms": 10, "mensaje": "KeyError: 'a'", "ua": "curl/8"})
        assert await E.vaciar() == 1
        # El mismo fallo otra vez en el mismo minuto: se suma a su fila.
        E.apuntar({"tipo": "error-api", "cuando": ahora, "ruta": "/api/v1/x/{id}", "metodo": "GET", "status": 500, "ms": 30, "mensaje": "KeyError: 'a'"})
        await E.vaciar()

        E.apuntar_tiempo("GET", "/api/v1/x/{id}", 20)
        E.apuntar_tiempo("GET", "/api/v1/x/{id}", 3000)
        assert await E.volcar_tiempos() == 1
        E.apuntar_tiempo("GET", "/api/v1/x/{id}", 40)
        await E.volcar_tiempos()

        async with fabrica() as s:
            filas = (await s.execute(select(EstadoEvento))).scalars().all()
            errores = [f for f in filas if f.tipo == "error-api"]
            tiempos = [f for f in filas if f.tipo == "tiempos"]
            assert len(errores) == 1 and errores[0].veces == 4 and errores[0].ms == 30
            assert errores[0].navegador == "Programa"
            assert len(tiempos) == 1 and tiempos[0].veces == 3 and tiempos[0].status == 3000

            async def sin_comprobar(_):
                return {"comprobaciones": []}

            monkeypatch.setattr(E, "en_vivo", sin_comprobar)
            p = await E.panel(s)
            assert p["aviso"] == ""
            assert p["resumen"]["errores"][0]["veces"] == 4
            assert p["resumen"]["rutas"][0]["peticiones"] == 3
            assert p["semaforo"]["color"] == "ambar"
        await engine.dispose()

    asyncio.run(prueba())


def test_si_la_tabla_no_existe_no_pasa_nada(monkeypatch):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlmodel.ext.asyncio.session import AsyncSession

    async def prueba():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        fabrica = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        monkeypatch.setattr(E, "_fabrica", lambda: fabrica)
        monkeypatch.setattr(E, "_activo", True)
        E._cola.clear()
        E._minuto_actual, E._escritas_este_minuto = "", 0
        E.apuntar({"tipo": "error-api", "ruta": "/x", "metodo": "GET", "status": 500, "mensaje": "x"})
        assert await E.vaciar() == 0
        E.apuntar_tiempo("GET", "/x", 5)
        assert await E.volcar_tiempos() == 0
        await E.borrar_viejos()

        async def sin_comprobar(_):
            return {"comprobaciones": []}

        monkeypatch.setattr(E, "en_vivo", sin_comprobar)
        async with fabrica() as s:
            p = await E.panel(s)
            assert p["aviso"].startswith("No se pudo leer")
            assert p["resumen"]["errores"] == []
        await engine.dispose()

    asyncio.run(prueba())

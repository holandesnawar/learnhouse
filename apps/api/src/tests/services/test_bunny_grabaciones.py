"""Las grabaciones de la sala copiadas a Bunny (18/11/2026), con un Bunny y
un Daily falsos. Ver la cabecera de `src/services/salas/bunny.py`."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from src.services.salas import bunny
from src.services.salas import estudio_grabaciones as EG
from src.services.salas import salas
from src.tests.services.test_estudio_grabaciones import CURSO, DailyFalso, _clase, _grabacion


class BunnyFalso:
    def __init__(self):
        self.videos = {}
        self.llamadas = []

    async def __call__(self, metodo, ruta, cuerpo=None, params=None):
        self.llamadas.append((metodo, ruta, cuerpo))
        if metodo == "GET" and ruta == "/videos":
            items = list(self.videos.values())
            return {"totalItems": len(items), "items": items}
        if metodo == "POST" and ruta == "/videos/fetch":
            guid = f"guid-{len(self.videos) + 1}"
            self.videos[guid] = {"guid": guid, "title": cuerpo["title"], "status": 2, "encodeProgress": 10, "availableResolutions": ""}
            return {"success": True, "id": guid, "statusCode": 200}
        if metodo == "POST" and ruta.startswith("/videos/guid-"):
            return {"success": True}
        if metodo == "GET" and ruta.endswith("/play"):
            return {"fallbackUrl": "https://vz-abc-123.b-cdn.net/x/play_720p.mp4"}
        raise AssertionError(f"Llamada inesperada a Bunny: {metodo} {ruta}")


@pytest.fixture(autouse=True)
def _limpio(monkeypatch):
    bunny._cache.update(t=0.0, videos={}, error="")
    bunny._host.clear()
    bunny._mp4_ok.clear()
    bunny._pidiendo.clear()
    EG._de_esta_sala.clear()
    EG._enlaces.clear()
    monkeypatch.setenv("LEARNHOUSE_DAILY_API_KEY", "clave-de-prueba")
    for n in ("LIBRARY_ID_BUNNY", "LIBRARY_API_BUNNY", "LIBRARY_CDN_BUNNY"):
        monkeypatch.delenv(n, raising=False)
    yield
    bunny._cache.update(t=0.0, videos={}, error="")


def test_logica_pura():
    assert bunny.titulo_de("rec-1") == "daily-rec-1"
    assert bunny.id_de_titulo("daily-rec-1") == "rec-1"
    assert bunny.id_de_titulo("otra cosa") == ""
    assert bunny.resumen(None)["estado"] == "no"
    assert bunny.resumen({"status": 3, "encodeProgress": 40, "guid": "g"}) == {"estado": "preparando", "progreso": 40, "guid": "g"}
    assert bunny.resumen({"status": 4, "guid": "g"})["estado"] == "lista"
    assert bunny.resumen({"status": 5, "guid": "g"})["estado"] == "error"
    assert bunny.host_de({"thumbnailUrl": "https://vz-ab12-3.b-cdn.net/g/thumbnail.jpg"}) == "vz-ab12-3.b-cdn.net"
    assert bunny.host_de("vz-x.b-cdn.net") == "vz-x.b-cdn.net"
    assert bunny.mp4_de("h.b-cdn.net", "g", "240p,360p,720p,1080p") == "https://h.b-cdn.net/g/play_720p.mp4"
    assert bunny.mp4_de("h.b-cdn.net", "g", "240p,480p") == "https://h.b-cdn.net/g/play_480p.mp4"
    assert bunny.mp4_de("", "g", "720p") == ""


def test_que_se_copia_solo():
    ahora = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)
    g = lambda gid, dia, dur, estado="finished": {"id": gid, "inicio": f"{dia}T18:00:00+00:00", "duracion_seg": dur, "estado": estado}
    lista = [
        g("nueva", "2026-11-17", 3000),
        g("corta", "2026-11-17", 30),
        g("procesando", "2026-11-17", 3000, "in-progress"),
        g("vieja", "2026-09-01", 3000),
        g("ya", "2026-11-16", 3000),
        g("demo-x", "2026-11-16", 3000),
        g("antes", "2026-11-10", 3000),
    ]
    assert bunny.para_copiar(lista, {"ya"}, ahora) == ["nueva", "antes"]
    assert bunny.para_copiar(lista, set(), ahora, limite=1) == ["nueva"]


async def test_sin_claves_no_hace_nada(monkeypatch):
    monkeypatch.setattr(salas, "_daily", DailyFalso([_grabacion("rec-aaaa-1111", "2026-11-03", 18, 2000)]))
    assert bunny.configurado() is False
    assert (await EG.enlace_video(CURSO, "rec-aaaa-1111")).startswith("https://video.daily.co/")


async def test_se_copia_y_cuando_esta_lista_se_ve_desde_bunny(db, org, monkeypatch):
    monkeypatch.setenv("LIBRARY_ID_BUNNY", "123")
    monkeypatch.setenv("LIBRARY_API_BUNNY", "clave")
    hoy = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    c, s1, _ = await _clase(db, org)
    monkeypatch.setattr(salas, "_daily", DailyFalso([_grabacion("rec-aaaa-1111", hoy, 8, 2000)]))
    falso = BunnyFalso()
    monkeypatch.setattr(bunny, "_bunny", falso)
    respuestas = {"ok": 206}

    async def responde(url):
        return respuestas["ok"]

    monkeypatch.setattr(bunny, "_responde", responde)

    datos = await EG.estudio(c, db)
    assert datos["bunny"]["activo"] is True
    parte = datos["dias"][0]["partes"][0]
    assert parte["bunny"]["estado"] == "preparando"
    await asyncio.gather(*list(bunny._tareas))
    pedidas = [x for x in falso.llamadas if x[1] == "/videos/fetch"]
    assert len(pedidas) == 1
    assert pedidas[0][2]["url"].startswith("https://video.daily.co/rec-aaaa-1111.mp4")
    assert pedidas[0][2]["title"] == "daily-rec-aaaa-1111"

    # Abrir otra vez el estudio no la vuelve a pedir.
    bunny._cache["t"] = 0.0
    await EG.estudio(c, db)
    await asyncio.gather(*list(bunny._tareas))
    assert len([x for x in falso.llamadas if x[1] == "/videos/fetch"]) == 1

    # Mientras Bunny la prepara, el vídeo sigue saliendo de Daily.
    assert (await EG.enlace_video(CURSO, "rec-aaaa-1111")).startswith("https://video.daily.co/")

    # Lista: sale el mp4 de Bunny.
    falso.videos["guid-1"].update(status=4, availableResolutions="360p,720p")
    bunny._cache["t"] = 0.0
    assert await EG.enlace_video(CURSO, "rec-aaaa-1111") == "https://vz-abc-123.b-cdn.net/guid-1/play_720p.mp4"
    # A la segunda vez que falla en el navegador, el de Daily.
    assert (await EG.enlace_video(CURSO, "rec-aaaa-1111", con_bunny=False)).startswith("https://video.daily.co/")

    # Si el mp4 no existe (MP4 Fallback encendido después), Daily, sin romper
    # nada, y se le pide a Bunny que la rehaga (una vez).
    respuestas["ok"] = 404
    bunny._mp4_ok.clear()
    bunny._rehaciendo.clear()
    assert (await EG.enlace_video(CURSO, "rec-aaaa-1111")).startswith("https://video.daily.co/")
    assert await EG.enlace_video(CURSO, "rec-aaaa-1111")
    assert len([x for x in falso.llamadas if x[1] == "/videos/guid-1/reencode"]) == 1
    d = await bunny.detalle("rec-aaaa-1111")
    assert "rehaga" in bunny.explicar(d)
    respuestas["ok"] = 403
    assert "403" in bunny.explicar(await bunny.detalle("rec-aaaa-1111"))

    # Una grabación de otra sala, ni con Bunny.
    with pytest.raises(EG.GrabacionError):
        await EG.enlace_video(CURSO, "rec-ajena-9999")


async def test_si_bunny_falla_el_estudio_sale_igual(db, org, monkeypatch):
    monkeypatch.setenv("LIBRARY_ID_BUNNY", "123")
    monkeypatch.setenv("LIBRARY_API_BUNNY", "mala")
    hoy = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    c, _, _ = await _clase(db, org)
    monkeypatch.setattr(salas, "_daily", DailyFalso([_grabacion("rec-aaaa-1111", hoy, 8, 2000)]))

    async def roto(*a, **k):
        raise bunny.BunnyError("Bunny (401): Authorization has been denied", 401)

    monkeypatch.setattr(bunny, "_bunny", roto)
    datos = await EG.estudio(c, db)
    await asyncio.gather(*list(bunny._tareas), return_exceptions=True)
    assert datos["dias"][0]["partes"]
    assert "401" in datos["bunny"]["error"]
    assert (await EG.enlace_video(CURSO, "rec-aaaa-1111")).startswith("https://video.daily.co/")

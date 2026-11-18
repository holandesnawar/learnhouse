"""
Las grabaciones de la sala, copiadas a Bunny Stream (18/11/2026).

Por qué
-------
Daily guarda cada grabación como un mp4 «en trozos» (fragmentado) de varios
gigas, sin índice para saltar: en el navegador, ir al minuto 40 obliga a bajar
todo lo de antes y el vídeo se queda congelado (ver «El vídeo del recorte se
queda congelado a mitad» en CLAUDE.md). El usuario bajaba la grabación, la
cortaba en Final Cut y la subía: sin espacio en el ordenador, no se sostiene.

Cómo va
-------
- La escuela le pasa a Bunny el enlace de descarga de Daily (`POST
  /library/{id}/videos/fetch`) y Bunny la baja y la convierte él solo. Nada
  pasa por la escuela ni por el ordenador de nadie.
- **Bunny es la memoria**: cada vídeo se llama `daily-<id de la grabación>`, y
  así se sabe cuál es cuál sin tabla nueva. La lista de la biblioteca se lee
  una vez por minuto como mucho (`_videos`).
- Se copian solas las grabaciones terminadas de más de un minuto de los
  últimos 30 días al abrir el estudio de grabaciones (en segundo plano, unas
  pocas cada vez), y las partes que se publican.
- **El recorte sigue siendo virtual** (los trozos que se ven, en
  `tarea_semana.grabacion_sala`): lo que cambia es de DÓNDE sale el vídeo.
  Cuando Bunny la tiene lista, `/grabaciones/video/{id}` redirige a su mp4
  (MP4 Fallback, que se puede saltar al momento) en vez de a Daily. Mientras
  Bunny la prepara, o si algo falla, sigue saliendo la de Daily: nunca peor que
  antes.

Lo que necesita (en Railway, lo pone el usuario)
------------------------------------------------
- `LIBRARY_ID_BUNNY` (o `LEARNHOUSE_BUNNY_LIBRARY_ID`): el número de la
  biblioteca de Bunny Stream.
- `LIBRARY_API_BUNNY` (o `LEARNHOUSE_BUNNY_API_KEY`): su clave (la de la
  biblioteca, en Bunny → Stream → la biblioteca → API).
- Opcional `LIBRARY_CDN_BUNNY`: el nombre del CDN de la biblioteca
  (`vz-xxxx.b-cdn.net`); sin él, se le pregunta a Bunny.
- En la biblioteca: **MP4 Fallback encendido** (Encoding) y, si tiene dominios
  permitidos, `app.holandesnawar.com` entre ellos.

Sin probar contra Bunny de verdad: `video.bunnycdn.com` no se alcanza desde el
entorno de desarrollo. Con un Bunny falso, sí (`test_bunny_grabaciones.py`).
Si algo falla, el estudio enseña el motivo tal cual (`motivo`).
"""

import asyncio
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

API = "https://video.bunnycdn.com"
PREFIJO = "daily-"
#: La grabación más corta que vale la pena copiar.
MINIMO_SEG = 60
#: Hasta cuántos días atrás se copian solas.
DIAS_ATRAS = 30
#: Cuántas se piden a Bunny como mucho cada vez que se abre el estudio.
POR_VEZ = 4
_LISTA_SEG = 60
_REFERER = "https://app.holandesnawar.com/"

# Estados de Bunny Stream.
_LISTA = 4
_ERRORES = (5, 6)


class BunnyError(Exception):
    def __init__(self, mensaje: str, status: int = 502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _env(*nombres: str) -> str:
    for n in nombres:
        v = (os.environ.get(n) or "").strip()
        if v:
            return v
    return ""


def biblioteca() -> str:
    return _env("LIBRARY_ID_BUNNY", "LEARNHOUSE_BUNNY_LIBRARY_ID")


def clave() -> str:
    return _env("LIBRARY_API_BUNNY", "LEARNHOUSE_BUNNY_API_KEY")


def configurado() -> bool:
    return bool(biblioteca() and clave())


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def titulo_de(grabacion_id: str) -> str:
    return f"{PREFIJO}{grabacion_id}"


def id_de_titulo(titulo: str) -> str:
    t = str(titulo or "")
    return t[len(PREFIJO):] if t.startswith(PREFIJO) else ""


def resumen(video: Optional[dict]) -> dict:
    """Lo que la pantalla necesita de un vídeo de Bunny: en qué está."""
    if not video:
        return {"estado": "no", "progreso": 0}
    try:
        st = int(video.get("status"))
    except (TypeError, ValueError):
        st = -1
    try:
        progreso = int(video.get("encodeProgress") or 0)
    except (TypeError, ValueError):
        progreso = 0
    if st == _LISTA:
        return {"estado": "lista", "progreso": 100, "guid": str(video.get("guid") or "")}
    if st in _ERRORES:
        return {"estado": "error", "progreso": progreso, "guid": str(video.get("guid") or "")}
    return {"estado": "preparando", "progreso": max(0, min(99, progreso)), "guid": str(video.get("guid") or "")}


def host_de(valor: Any) -> str:
    """El nombre del CDN de la biblioteca (`vz-….b-cdn.net`) dentro de un
    texto, una dirección o una respuesta de Bunny. Vacío si no aparece."""
    if isinstance(valor, dict):
        for k in ("fallbackUrl", "videoPlaylistUrl", "thumbnailUrl", "previewUrl", "seekPath", "captionsPath"):
            h = host_de(valor.get(k))
            if h:
                return h
        return host_de(valor.get("video")) if isinstance(valor.get("video"), dict) else ""
    texto = str(valor or "").strip()
    m = re.search(r"([a-z0-9-]+\.b-cdn\.net)", texto, re.I)
    return m.group(1).lower() if m else ""


def mp4_de(host: str, guid: str, resoluciones: Any) -> str:
    """El mp4 de MP4 Fallback: Bunny lo hace hasta 720p, con la mayor que
    tenga ese vídeo."""
    if not host or not guid:
        return ""
    lista = [r.strip() for r in str(resoluciones or "").split(",") if r.strip()]
    altos = []
    for r in lista:
        m = re.fullmatch(r"(\d+)p", r)
        if m and int(m.group(1)) <= 720:
            altos.append(int(m.group(1)))
    alto = max(altos) if altos else 720
    return f"https://{host}/{guid}/play_{alto}p.mp4"


def para_copiar(grabaciones: list[dict], ya: set[str], ahora: Optional[datetime] = None, limite: int = POR_VEZ) -> list[str]:
    """Qué grabaciones del estudio hay que pedir a Bunny: terminadas, de más
    de un minuto, de los últimos 30 días y que Bunny aún no tiene. Las más
    nuevas primero."""
    ahora = ahora or datetime.now(timezone.utc)
    corte = ahora - timedelta(days=DIAS_ATRAS)
    salen = []
    for g in grabaciones:
        gid = str(g.get("id") or "")
        if not gid or gid in ya or gid.startswith("demo-"):
            continue
        if str(g.get("estado") or "") != "finished" or int(g.get("duracion_seg") or 0) < MINIMO_SEG:
            continue
        try:
            inicio = datetime.fromisoformat(str(g.get("inicio") or ""))
        except ValueError:
            continue
        if inicio.tzinfo is None:
            inicio = inicio.replace(tzinfo=timezone.utc)
        if inicio < corte:
            continue
        salen.append((inicio, gid))
    salen.sort(reverse=True)
    return [gid for _, gid in salen[:limite]]


def motivo(cuerpo: Any, status: int) -> str:
    if isinstance(cuerpo, dict):
        txt = cuerpo.get("Message") or cuerpo.get("message") or cuerpo.get("title") or cuerpo.get("error")
        if txt:
            return f"Bunny ({status}): {txt}"
    return f"Bunny ({status}): {str(cuerpo)[:300]}" if cuerpo else f"Bunny respondió {status}"


# ── Hablar con Bunny ────────────────────────────────────────────────────────


async def _bunny(metodo: str, ruta: str, cuerpo: Optional[dict] = None, params: Optional[dict] = None) -> Any:
    if not configurado():
        raise BunnyError("Faltan LIBRARY_ID_BUNNY y LIBRARY_API_BUNNY en Railway.", 503)
    url = f"{API}/library/{biblioteca()}{ruta}"
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.request(
                metodo, url, json=cuerpo, params=params,
                headers={"AccessKey": clave(), "accept": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise BunnyError(f"No se pudo hablar con Bunny: {exc}", 502) from exc
    try:
        datos = r.json() if r.content else {}
    except ValueError:
        datos = r.text[:300]
    if r.status_code >= 400:
        raise BunnyError(motivo(datos, r.status_code), r.status_code)
    return datos


_cache: dict[str, Any] = {"t": 0.0, "videos": {}, "error": ""}
_host: dict[str, str] = {}
_mp4_ok: dict[str, tuple[float, bool]] = {}
_pidiendo: set[str] = set()
_tareas: set[asyncio.Task] = set()
_cerrojo = asyncio.Lock()


async def _videos(fresco: bool = False) -> dict[str, dict]:
    """{id de la grabación de Daily: vídeo de Bunny}. Se lee como mucho una
    vez por minuto."""
    if not fresco and time.time() - _cache["t"] < _LISTA_SEG:
        return _cache["videos"]
    async with _cerrojo:
        if not fresco and time.time() - _cache["t"] < _LISTA_SEG:
            return _cache["videos"]
        salen: dict[str, dict] = {}
        try:
            for pagina in range(1, 11):
                datos = await _bunny("GET", "/videos", params={"page": pagina, "itemsPerPage": 100, "search": PREFIJO, "orderBy": "date"})
                items = datos.get("items") if isinstance(datos, dict) else None
                for v in items or []:
                    gid = id_de_titulo(v.get("title"))
                    if gid and gid not in salen:
                        salen[gid] = v
                total = int((datos or {}).get("totalItems") or 0) if isinstance(datos, dict) else 0
                if not items or pagina * 100 >= total:
                    break
            _cache.update(t=time.time(), videos=salen, error="")
        except BunnyError as exc:
            _cache.update(t=time.time(), error=exc.mensaje)
            logger.warning("Bunny: no se pudo leer la biblioteca. %s", exc.mensaje)
        return _cache["videos"]


def ultimo_error() -> str:
    return str(_cache.get("error") or "")


async def estados(ids: list[str]) -> dict[str, dict]:
    """En qué está cada grabación en Bunny (para la pantalla)."""
    if not configurado():
        return {}
    videos = await _videos()
    salen = {}
    for gid in ids:
        r = resumen(videos.get(gid))
        if r["estado"] == "no" and gid in _pidiendo:
            r = {"estado": "preparando", "progreso": 0}
        salen[gid] = r
    return salen


async def _cdn() -> str:
    h = _env("LIBRARY_CDN_BUNNY", "LEARNHOUSE_BUNNY_CDN")
    if h:
        return host_de(h) or h.replace("https://", "").replace("http://", "").strip("/")
    return _host.get("h", "")


async def _host_desde(guid: str) -> str:
    h = await _cdn()
    if h:
        return h
    try:
        datos = await _bunny("GET", f"/videos/{guid}/play")
        h = host_de(datos)
    except BunnyError as exc:
        logger.warning("Bunny: no se pudo saber el CDN. %s", exc.mensaje)
        h = ""
    if h:
        _host["h"] = h
    return h


async def _responde(url: str) -> bool:
    """¿El mp4 existe de verdad? (MP4 Fallback apagado = 404)."""
    guardado = _mp4_ok.get(url)
    if guardado and time.time() - guardado[0] < (3600 if guardado[1] else 300):
        return guardado[1]
    ok = False
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(url, headers={"Range": "bytes=0-1", "Referer": _REFERER})
            ok = r.status_code in (200, 206)
            if not ok:
                logger.warning("Bunny: el mp4 %s responde %s", url, r.status_code)
    except httpx.HTTPError as exc:
        logger.warning("Bunny: no se pudo comprobar el mp4. %s", exc)
    _mp4_ok[url] = (time.time(), ok)
    return ok


async def mp4_listo(grabacion_id: str) -> str:
    """El mp4 de Bunny de esa grabación si está listo y responde; si no, ""."""
    if not configurado():
        return ""
    try:
        videos = await _videos()
        v = videos.get(grabacion_id)
        if not v or resumen(v)["estado"] != "lista":
            return ""
        guid = str(v.get("guid") or "")
        host = await _host_desde(guid)
        url = mp4_de(host, guid, v.get("availableResolutions"))
        if url and await _responde(url):
            return url
    except Exception as exc:  # noqa: BLE001 - nunca romper el vídeo por Bunny
        logger.warning("Bunny: %s", exc)
    return ""


async def copiar(grabacion_id: str, enlace_daily: str) -> dict:
    """Pide a Bunny que baje la grabación de Daily. Si ya la tiene (o se le
    está pidiendo), no hace nada."""
    videos = await _videos()
    if grabacion_id in videos:
        return resumen(videos[grabacion_id])
    if grabacion_id in _pidiendo:
        return {"estado": "preparando", "progreso": 0}
    _pidiendo.add(grabacion_id)
    try:
        datos = await _bunny("POST", "/videos/fetch", {"url": enlace_daily, "title": titulo_de(grabacion_id)})
        guid = ""
        if isinstance(datos, dict):
            guid = str(datos.get("id") or datos.get("guid") or datos.get("videoId") or "")
            if datos.get("success") is False:
                raise BunnyError(motivo(datos, int(datos.get("statusCode") or 400)), 400)
        if guid:
            # Por si Bunny no respetara el título al bajarla: se le pone.
            try:
                await _bunny("POST", f"/videos/{guid}", {"title": titulo_de(grabacion_id)})
            except BunnyError:
                pass
        _cache["t"] = 0.0
        return {"estado": "preparando", "progreso": 0}
    except BunnyError:
        _pidiendo.discard(grabacion_id)
        raise


def en_segundo_plano(coro) -> None:
    t = asyncio.create_task(coro)
    _tareas.add(t)
    t.add_done_callback(_tareas.discard)

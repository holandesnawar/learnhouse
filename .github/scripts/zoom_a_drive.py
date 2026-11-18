"""
Las grabaciones de las llamadas de venta, de Zoom a Google Drive (18/11/2026).

Cada noche: lee las grabaciones de la nube de Zoom, baja SOLO el audio y la
transcripción de cada llamada y los sube a la unidad compartida de Drive,
ordenados así:

    <carpeta>/2026-11/Compraron/2026-11-12 18.00 · Ana López/
        audio.m4a · transcripcion.txt · transcripcion.vtt · datos.txt
    <carpeta>/2026-11/No compraron/…
    <carpeta>/2026-11/Sin identificar/…

Quién era y si compró lo dice la escuela (`/api/v1/notifications/
llamadas-grabadas`, ver `apps/api/src/services/contactos/llamadas_grabadas.py`).
Si alguien compra después, su carpeta pasa sola a «Compraron».

El borrado mensual (pedido del usuario: "ahora en noviembre que se borren las
grabaciones de Zoom de octubre y tenemos audio y transcripción, así podemos
revisar el vídeo un mes"): el VÍDEO de una llamada de un mes ya terminado se
borra de Zoom, solo si:
- es una llamada identificada (una cita de Calendly: nunca una clase u otra
  reunión), y
- su audio ya está en Drive con el mismo tamaño que en Zoom.
El audio y la transcripción de Zoom no se tocan. Se borra para siempre
(`ZOOM_BORRADO=trash` lo manda a la papelera de Zoom en su lugar).

⚠️ EL REPOSITORIO ES PÚBLICO y su registro también: aquí solo se escriben
cifras, nunca nombres, correos ni enlaces.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests

ZONA = ZoneInfo("Europe/Amsterdam")
ZOOM = "https://api.zoom.us/v2"
DRIVE = "https://www.googleapis.com/drive/v3"
SUBIR = "https://www.googleapis.com/upload/drive/v3/files"
CARPETA = "application/vnd.google-apps.folder"
CATEGORIA = {True: "Compraron", False: "No compraron", None: "Sin identificar"}

PRUEBA = (os.environ.get("PRUEBA") or "").strip().lower() in ("si", "sí", "true", "1")
BORRAR = (os.environ.get("BORRAR_VIDEO") or "mes-anterior").strip().lower()
BORRADO = "trash" if (os.environ.get("ZOOM_BORRADO") or "").strip().lower() == "trash" else "delete"

cuenta = {"llamadas": 0, "nuevas": 0, "ya_estaban": 0, "movidas": 0, "sin_audio": 0,
          "videos_borrados": 0, "gb_liberados": 0.0, "errores": 0, "identificadas": 0}


def aviso(texto: str) -> None:
    print(texto, flush=True)


# ── Zoom ────────────────────────────────────────────────────────────────────


def token_zoom() -> str:
    r = requests.post(
        "https://zoom.us/oauth/token",
        params={"grant_type": "account_credentials", "account_id": os.environ["ZOOM_ACCOUNT_ID"]},
        auth=(os.environ["ZOOM_CLIENT_ID"], os.environ["ZOOM_CLIENT_SECRET"]),
        timeout=30,
    )
    if r.status_code != 200:
        raise SystemExit(f"Zoom no da acceso ({r.status_code}): revisa ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET.")
    return r.json()["access_token"]


def zoom(tok: str, metodo: str, ruta: str, **kw) -> requests.Response:
    for intento in range(4):
        r = requests.request(metodo, ZOOM + ruta, headers={"Authorization": f"Bearer {tok}"}, timeout=60, **kw)
        if r.status_code != 429:
            return r
        time.sleep(3 * (intento + 1))
    return r


def usuarios(tok: str) -> list[str]:
    r = zoom(tok, "GET", "/users", params={"page_size": 300})
    if r.status_code != 200:
        aviso(f"Zoom no deja listar usuarios ({r.status_code}): solo las del dueño de la app.")
        return ["me"]
    return [u["id"] for u in r.json().get("users") or []] or ["me"]


def meses(desde: date, hasta: date):
    a = desde
    while a <= hasta:
        b = min(hasta, (a.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))
        yield a, b
        a = b + timedelta(days=1)


def grabaciones(tok: str, desde: date) -> list[dict]:
    hoy = datetime.now(timezone.utc).date()
    vistas: dict[str, dict] = {}
    for uid in usuarios(tok):
        for a, b in meses(desde, hoy):
            siguiente = ""
            while True:
                params = {"from": a.isoformat(), "to": b.isoformat(), "page_size": 300}
                if siguiente:
                    params["next_page_token"] = siguiente
                r = zoom(tok, "GET", f"/users/{uid}/recordings", params=params)
                if r.status_code != 200:
                    aviso(f"Zoom no deja leer grabaciones de un usuario ({r.status_code}).")
                    break
                datos = r.json()
                for m in datos.get("meetings") or []:
                    if m.get("uuid"):
                        vistas[m["uuid"]] = m
                siguiente = datos.get("next_page_token") or ""
                if not siguiente:
                    break
    return sorted(vistas.values(), key=lambda m: m.get("start_time") or "")


def uuid_url(uuid: str) -> str:
    # Zoom pide codificar dos veces los uuid que empiezan por / o llevan //.
    if uuid.startswith("/") or "//" in uuid:
        return quote(quote(uuid, safe=""), safe="")
    return quote(uuid, safe="")


def bajar(tok: str, url: str, destino: str) -> int:
    with requests.get(url, headers={"Authorization": f"Bearer {tok}"}, stream=True, timeout=300, allow_redirects=True) as r:
        r.raise_for_status()
        with open(destino, "wb") as f:
            for trozo in r.iter_content(1024 * 1024):
                f.write(trozo)
    return os.path.getsize(destino)


# ── La escuela ──────────────────────────────────────────────────────────────


def clasificar(items: list[dict]) -> dict:
    salen: dict = {}
    for i in range(0, len(items), 100):
        r = requests.post(
            os.environ["SCHOOL_URL"].rstrip("/") + "/api/v1/notifications/llamadas-grabadas",
            headers={"X-Cron-Token": os.environ["SCHOOL_CRON_TOKEN"]},
            json={"llamadas": items[i:i + 100]},
            timeout=120,
        )
        if r.status_code != 200:
            raise SystemExit(f"La escuela respondió {r.status_code} al preguntar quién era cada llamada.")
        datos = r.json()
        if datos.get("aviso"):
            aviso("La escuela avisa: no pudo leer Calendly; las llamadas salen como «Sin identificar».")
        salen.update(datos.get("llamadas") or {})
    return salen


# ── Google Drive (cuenta de servicio en una unidad compartida) ──────────────


def sesion_drive():
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession

    info = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
    cred = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/drive"])
    return AuthorizedSession(cred)


TODAS = {"supportsAllDrives": "true", "includeItemsFromAllDrives": "true"}


class Drive:
    def __init__(self, s, raiz: str):
        self.s = s
        self.raiz = raiz
        r = s.get(f"{DRIVE}/files/{raiz}", params={"fields": "id,driveId", "supportsAllDrives": "true"})
        if r.status_code != 200:
            raise SystemExit(f"Drive no deja abrir la carpeta ({r.status_code}): revisa DRIVE_FOLDER_ID y que la cuenta de servicio esté dentro de la unidad compartida.")
        self.drive_id = r.json().get("driveId") or ""
        if not self.drive_id:
            raise SystemExit("La carpeta no está en una unidad compartida: la cuenta de servicio no tiene espacio propio. Usa una unidad compartida.")
        self._carpetas: dict[tuple[str, str], str] = {}

    def buscar(self, q: str, campos: str = "files(id,name,parents,appProperties,size)") -> list[dict]:
        salen, token = [], None
        while True:
            params = {"q": q, "fields": f"nextPageToken,{campos}", "corpora": "drive", "driveId": self.drive_id,
                      "pageSize": 1000, **TODAS}
            if token:
                params["pageToken"] = token
            r = self.s.get(f"{DRIVE}/files", params=params)
            r.raise_for_status()
            d = r.json()
            salen.extend(d.get("files") or [])
            token = d.get("nextPageToken")
            if not token:
                return salen

    def carpeta(self, padre: str, nombre: str, props: dict | None = None) -> str:
        clave = (padre, nombre)
        if props:
            # La carpeta de una llamada: siempre nueva (ya se sabe que no está;
            # dos llamadas con el mismo nombre no deben acabar en una).
            r = self.s.post(f"{DRIVE}/files", params={"supportsAllDrives": "true", "fields": "id"},
                            json={"name": nombre, "mimeType": CARPETA, "parents": [padre], "appProperties": props})
            r.raise_for_status()
            return r.json()["id"]
        if clave in self._carpetas:
            return self._carpetas[clave]
        n = nombre.replace("\\", "\\\\").replace("'", "\\'")
        hay = self.buscar(f"'{padre}' in parents and name = '{n}' and mimeType = '{CARPETA}' and trashed = false")
        if hay:
            self._carpetas[clave] = hay[0]["id"]
            return hay[0]["id"]
        cuerpo = {"name": nombre, "mimeType": CARPETA, "parents": [padre]}
        r = self.s.post(f"{DRIVE}/files", params={"supportsAllDrives": "true", "fields": "id"}, json=cuerpo)
        r.raise_for_status()
        self._carpetas[clave] = r.json()["id"]
        return self._carpetas[clave]

    def subir(self, padre: str, nombre: str, ruta: str, tipo: str) -> dict:
        meta = {"name": nombre, "parents": [padre]}
        r = self.s.post(SUBIR, params={"uploadType": "resumable", "supportsAllDrives": "true", "fields": "id,size"},
                        json=meta, headers={"X-Upload-Content-Type": tipo})
        r.raise_for_status()
        with open(ruta, "rb") as f:
            r2 = self.s.put(r.headers["Location"], data=f, headers={"Content-Type": tipo})
        r2.raise_for_status()
        return r2.json()

    def subir_texto(self, padre: str, nombre: str, texto: str, archivo_id: str = "") -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as t:
            t.write(texto)
        try:
            if archivo_id:
                with open(t.name, "rb") as f:
                    r = self.s.patch(f"{SUBIR}/{archivo_id}", params={"uploadType": "media", "supportsAllDrives": "true"},
                                     data=f, headers={"Content-Type": "text/plain; charset=utf-8"})
                r.raise_for_status()
            else:
                self.subir(padre, nombre, t.name, "text/plain")
        finally:
            os.unlink(t.name)

    def mover(self, archivo: str, de: str, a: str, props: dict) -> None:
        r = self.s.patch(f"{DRIVE}/files/{archivo}", params={"addParents": a, "removeParents": de, "supportsAllDrives": "true"},
                         json={"appProperties": props})
        r.raise_for_status()


# ── Lo que se escribe ───────────────────────────────────────────────────────


def vtt_a_texto(vtt: str) -> str:
    """La transcripción de Zoom (VTT) en texto para leer: «Persona: frase»,
    juntando las frases seguidas de la misma persona."""
    lineas, quien, frase = [], None, []
    for bloque in re.split(r"\n\s*\n", vtt.replace("\r", "")):
        partes = [p for p in bloque.strip().split("\n") if p.strip()]
        texto = [p for p in partes if "-->" not in p and not p.strip().isdigit() and p.strip() != "WEBVTT"]
        if not texto:
            continue
        t = " ".join(texto).strip()
        m = re.match(r"^([^:]{1,60}):\s*(.*)$", t)
        nombre, dicho = (m.group(1).strip(), m.group(2)) if m else ("", t)
        if nombre != quien and frase:
            lineas.append(f"{quien}: {' '.join(frase)}" if quien else " ".join(frase))
            frase = []
        quien = nombre
        frase.append(dicho)
    if frase:
        lineas.append(f"{quien}: {' '.join(frase)}" if quien else " ".join(frase))
    return "\n\n".join(lineas) + "\n"


def ficha(m: dict, c: dict, inicio_nl: datetime) -> str:
    filas = [
        f"Llamada del {inicio_nl.strftime('%d/%m/%Y a las %H:%M')} (hora de Países Bajos)",
        f"Duración: {int(m.get('duration') or 0)} minutos",
    ]
    if c.get("identificada"):
        filas += [
            f"Persona: {c.get('nombre') or '—'}",
            f"Correo: {c.get('email') or '—'}",
            f"Closer: {c.get('closer') or '—'}",
            f"Compró: {'sí' if c.get('compro') else 'no'}" + (f" ({c['pagado_eur']:.2f} €)" if c.get("pagado_eur") else ""),
        ]
        if c.get("resultado"):
            filas.append(f"«¿Qué pasó?» en la escuela: {c['resultado']}")
        if c.get("nota"):
            filas.append(f"Nota: {c['nota']}")
    else:
        filas.append("Sin identificar: no se encontró su cita de Calendly (puede ser una clase u otra reunión).")
    filas.append(f"Zoom: {m.get('topic') or ''}")
    return "\n".join(filas) + "\n"


def limpio(texto: str) -> str:
    return re.sub(r"[\\/:*?\"<>|]+", " ", texto or "").strip()[:80]


# ── El proceso ──────────────────────────────────────────────────────────────


def main() -> None:
    faltan = [n for n in ("ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "GOOGLE_SERVICE_ACCOUNT_JSON",
                          "DRIVE_FOLDER_ID", "SCHOOL_URL", "SCHOOL_CRON_TOKEN") if not (os.environ.get(n) or "").strip()]
    if faltan:
        aviso("Aún no está configurado. Faltan los secretos: " + ", ".join(faltan) + ". No se ha hecho nada.")
        return
    desde = date.fromisoformat((os.environ.get("DESDE") or "").strip() or (datetime.now().date() - timedelta(days=365)).isoformat())
    tok = token_zoom()
    reuniones = [m for m in grabaciones(tok, desde) if m.get("recording_files")]
    cuenta["llamadas"] = len(reuniones)
    aviso(f"Grabaciones en Zoom desde {desde}: {len(reuniones)}")
    if not reuniones:
        return
    items = [{"clave": m["uuid"], "inicio": m.get("start_time"), "meeting_id": str(m.get("id") or ""),
              "anfitrion_email": m.get("host_email") or ""} for m in reuniones]
    quien = clasificar(items)
    drive = Drive(sesion_drive(), os.environ["DRIVE_FOLDER_ID"].strip())

    # Lo que ya está en Drive, por el uuid de Zoom.
    ya = {}
    for f in drive.buscar(f"mimeType = '{CARPETA}' and appProperties has {{ key='tipo' and value='llamada' }} and trashed = false"):
        u = (f.get("appProperties") or {}).get("zoom")
        if u:
            ya[u] = f
    este_mes = datetime.now(ZONA).strftime("%Y-%m")

    for m in reuniones:
        try:
            procesar(m, quien.get(m["uuid"]) or {"identificada": False}, drive, ya, tok, este_mes)
        except Exception as exc:  # noqa: BLE001 - una llamada mala no para las demás
            cuenta["errores"] += 1
            aviso(f"Una llamada falló: {type(exc).__name__}")

    aviso("Resumen: " + ", ".join(f"{k} {round(v, 2) if isinstance(v, float) else v}" for k, v in cuenta.items()))
    if PRUEBA:
        aviso("Era una PRUEBA: no se ha subido ni borrado nada.")
    if cuenta["errores"]:
        sys.exit(1)


def procesar(m: dict, c: dict, drive: Drive, ya: dict, tok: str, este_mes: str) -> None:
    inicio = datetime.fromisoformat(str(m.get("start_time")).replace("Z", "+00:00")).astimezone(ZONA)
    mes = inicio.strftime("%Y-%m")
    compro = bool(c.get("compro")) if c.get("identificada") else None
    if c.get("identificada"):
        cuenta["identificadas"] += 1
    nombre = f"{inicio.strftime('%Y-%m-%d %H.%M')} · {limpio(c.get('nombre') or '') or limpio(m.get('topic') or '') or 'Llamada'}"
    archivos = m.get("recording_files") or []
    audio = next((f for f in archivos if f.get("file_type") == "M4A" and f.get("download_url")), None)
    trans = next((f for f in archivos if f.get("file_type") == "TRANSCRIPT" and f.get("download_url")), None)
    videos = [f for f in archivos if f.get("file_type") == "MP4" and f.get("id")]
    props = {"tipo": "llamada", "zoom": m["uuid"][:100], "compro": {True: "si", False: "no", None: "?"}[compro]}

    carpeta_id = ""
    audio_en_drive = 0
    existente = ya.get(m["uuid"][:100])
    if existente:
        cuenta["ya_estaban"] += 1
        carpeta_id = existente["id"]
        if (existente.get("appProperties") or {}).get("compro") != props["compro"] and not PRUEBA:
            destino = drive.carpeta(drive.carpeta(drive.raiz, mes), CATEGORIA[compro])
            drive.mover(carpeta_id, (existente.get("parents") or [""])[0], destino, props)
            hay = drive.buscar(f"'{carpeta_id}' in parents and name = 'datos.txt' and trashed = false")
            drive.subir_texto(carpeta_id, "datos.txt", ficha(m, c, inicio), hay[0]["id"] if hay else "")
            cuenta["movidas"] += 1
        hay = drive.buscar(f"'{carpeta_id}' in parents and name = 'audio.m4a' and trashed = false")
        audio_en_drive = int(hay[0].get("size") or 0) if hay else 0
    elif PRUEBA:
        cuenta["por_subir"] = cuenta.get("por_subir", 0) + 1
    else:
        with tempfile.TemporaryDirectory() as tmp:
            ruta_audio = os.path.join(tmp, "audio.m4a")
            if audio:
                bajar(tok, audio["download_url"], ruta_audio)
            elif videos:
                # Sin archivo de audio: se saca del vídeo.
                ruta_video = os.path.join(tmp, "video.mp4")
                bajar(tok, videos[0]["download_url"], ruta_video)
                hecho = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", ruta_video, "-vn", "-c:a", "copy", ruta_audio])
                if hecho.returncode != 0:
                    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", ruta_video, "-vn", "-c:a", "aac", "-b:a", "96k", ruta_audio], check=True)
                os.unlink(ruta_video)
            else:
                cuenta["sin_audio"] += 1
                return
            destino = drive.carpeta(drive.carpeta(drive.raiz, mes), CATEGORIA[compro])
            carpeta_id = drive.carpeta(destino, nombre, props)
            subido = drive.subir(carpeta_id, "audio.m4a", ruta_audio, "audio/mp4")
            audio_en_drive = int(subido.get("size") or 0)
            if trans:
                ruta_vtt = os.path.join(tmp, "t.vtt")
                bajar(tok, trans["download_url"], ruta_vtt)
                vtt = open(ruta_vtt, encoding="utf-8", errors="replace").read()
                drive.subir_texto(carpeta_id, "transcripcion.txt", vtt_a_texto(vtt))
                drive.subir(carpeta_id, "transcripcion.vtt", ruta_vtt, "text/vtt")
            drive.subir_texto(carpeta_id, "datos.txt", ficha(m, c, inicio))
            cuenta["nuevas"] += 1

    # El borrado mensual del vídeo (ver la cabecera).
    if BORRAR != "mes-anterior" or PRUEBA or mes >= este_mes or not c.get("identificada") or not videos:
        return
    if not audio_en_drive:
        return
    if audio and int(audio.get("file_size") or 0) and audio_en_drive != int(audio["file_size"]):
        return
    for v in videos:
        r = zoom(tok, "DELETE", f"/meetings/{uuid_url(m['uuid'])}/recordings/{v['id']}", params={"action": BORRADO})
        if r.status_code in (200, 204):
            cuenta["videos_borrados"] += 1
            cuenta["gb_liberados"] += int(v.get("file_size") or 0) / 1e9
        else:
            cuenta["errores"] += 1
            aviso(f"Zoom no dejó borrar un vídeo ({r.status_code}).")


if __name__ == "__main__":
    main()

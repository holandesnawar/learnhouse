"""
El material del profe de cada semana (09/11/2026).

Pedido: "que yo pueda añadir la presentación completa, que no es la misma que
la presentación que se da con antelación antes de la clase… poder yo como
admin añadir y cambiar cosas de la sala de profesores… para que el profe,
cuando entre en la sala de profesores, ya sepa dónde está todo para preparar
la clase".

Cada semana (`tarea_semana`) lleva en la columna `material_profe` (TEXT, JSON):

    {"notas": "…", "archivos": [{"id", "nombre", "tipo": "archivo"|"enlace",
                                 "ruta"?, "url"?, "tam"?, "por", "at"}]}

- **Solo lo ve el equipo** (administradores, moderadores y profes). Al alumno
  no le llega nunca: `semanas` solo lo añade con `equipo=True`, y el archivo
  se baja por una ruta que pide ser del equipo.
- Los archivos (la presentación completa en PDF, PowerPoint, Keynote…) van a
  `content/privado/tareas/<org>/profe/` (dentro del volumen: entran en la copia
  diaria) y nunca los sirve `/content`. También vale un enlace (Google Slides,
  Canva…).
- Lo añaden y cambian los administradores y los profes (el profe puede subir
  su propia presentación); quitar un archivo, quien lo subió o un
  administrador.
"""

from __future__ import annotations

import json
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from src.services.tareas.tareas import CARPETA, CONTENT_DIR, TareaError, ruta_segura

MAX_BYTES = 80 * 1024 * 1024
MAX_ARCHIVOS = 12
EXTENSIONES = {
    ".pdf": "application/pdf",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".key": "application/x-iwork-keynote-sffkey",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
}


def _ahora() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def leer(texto: Any) -> dict:
    """Lo guardado, siempre con la misma forma (y nada roto si el JSON lo está)."""
    try:
        d = json.loads(texto) if isinstance(texto, str) and texto.strip() else (texto if isinstance(texto, dict) else {})
    except (ValueError, TypeError):
        d = {}
    if not isinstance(d, dict):
        d = {}
    archivos = [a for a in (d.get("archivos") or []) if isinstance(a, dict) and a.get("id")]
    return {"notas": str(d.get("notas") or ""), "archivos": archivos}


def para_la_pantalla(m: dict) -> dict:
    """Sin la ruta en disco: la pantalla pide el archivo por su id."""
    return {
        "notas": m.get("notas", ""),
        "archivos": [{k: v for k, v in a.items() if k != "ruta"} for a in m.get("archivos", [])],
    }


def con_notas(m: dict, notas: str) -> dict:
    return {**m, "notas": (notas or "").strip()[:6000]}


def url_valida(url: str) -> str:
    u = (url or "").strip()
    if not (u.startswith("https://") or u.startswith("http://")) or len(u) > 1000 or " " in u:
        raise TareaError("Pon un enlace entero, que empiece por https://")
    return u


def con_enlace(m: dict, nombre: str, url: str, por: str) -> dict:
    if len(m["archivos"]) >= MAX_ARCHIVOS:
        raise TareaError(f"Como mucho {MAX_ARCHIVOS} cosas por semana")
    a = {
        "id": _uuid.uuid4().hex[:12],
        "tipo": "enlace",
        "nombre": (nombre or "").strip()[:120] or "Presentación completa",
        "url": url_valida(url),
        "por": (por or "")[:120],
        "at": _ahora(),
    }
    return {**m, "archivos": [*m["archivos"], a]}


def guardar_archivo(org_id: int, nombre: str, datos: bytes) -> tuple[str, str]:
    """Guarda el archivo y devuelve (ruta relativa, extensión)."""
    if not datos:
        raise TareaError("El archivo está vacío")
    if len(datos) > MAX_BYTES:
        raise TareaError(f"El archivo pesa más de {MAX_BYTES // (1024 * 1024)} MB. Súbelo a Google Drive y pega el enlace.")
    ext = Path(nombre or "").suffix.lower()
    if ext not in EXTENSIONES:
        raise TareaError("Ese tipo de archivo no vale: PDF, PowerPoint, Keynote, Word, imagen, audio o vídeo")
    relativa = f"{CARPETA}/{org_id}/profe/{_uuid.uuid4().hex}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    return relativa, ext


def con_archivo(m: dict, nombre: str, relativa: str, tam: int, por: str) -> dict:
    if len(m["archivos"]) >= MAX_ARCHIVOS:
        raise TareaError(f"Como mucho {MAX_ARCHIVOS} cosas por semana")
    a = {
        "id": _uuid.uuid4().hex[:12],
        "tipo": "archivo",
        "nombre": (nombre or "archivo")[:160],
        "ruta": relativa,
        "tam": int(tam),
        "por": (por or "")[:120],
        "at": _ahora(),
    }
    return {**m, "archivos": [*m["archivos"], a]}


def sin(m: dict, archivo_id: str, por: str, admin: bool) -> tuple[dict, Optional[str]]:
    """Quita uno (quien lo subió o un administrador). Devuelve la ruta a borrar."""
    a = next((x for x in m["archivos"] if x.get("id") == archivo_id), None)
    if a is None:
        raise TareaError("Ese archivo ya no está", 404)
    if not admin and (a.get("por") or "") != (por or ""):
        raise TareaError("Solo lo puede quitar quien lo subió o un administrador", 403)
    return {**m, "archivos": [x for x in m["archivos"] if x.get("id") != archivo_id]}, a.get("ruta")


def archivo(m: dict, archivo_id: str) -> Optional[tuple[Path, str, str]]:
    """(ruta en disco, tipo, nombre) de un archivo subido."""
    a = next((x for x in m["archivos"] if x.get("id") == archivo_id and x.get("tipo") == "archivo"), None)
    if a is None:
        return None
    ruta = ruta_segura(a.get("ruta") or "")
    if ruta is None or not ruta.is_file():
        return None
    return ruta, EXTENSIONES.get(ruta.suffix.lower(), "application/octet-stream"), a.get("nombre") or ruta.name


def borrar_del_disco(relativa: Optional[str]) -> None:
    ruta = ruta_segura(relativa or "")
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


async def guardar(s, m: dict, db_session) -> dict:
    s.material_profe = json.dumps(m, ensure_ascii=False)
    s.updated_at = _ahora()
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return para_la_pantalla(m)

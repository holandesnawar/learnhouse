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

Además (09/11/2026, "cada profe debe ver la clase que tiene asignada… en
masterclass también su parte… y me gustaría dejar algún mensaje ahí para que
el profe lea mi comentario"), solo para administradores:

- `profe`: **quién da ESA semana** («Luna»), por encima del «La da» de la
  clase. Sirve para la masterclass, donde cada semana puede darla un profe
  distinto: la tarjeta le sale a esa persona en su sala.
- `mensaje`: un mensaje del administrador para el profe de esa semana
  (`{texto, por, at, leido_por, leido_at}`). El profe lo marca «Leído» y el
  administrador lo ve. Cambiar el texto lo vuelve a dejar sin leer.
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
    msg = d.get("mensaje") if isinstance(d.get("mensaje"), dict) else {}
    mensaje = (
        {k: str(msg.get(k) or "") for k in ("texto", "por", "at", "leido_por", "leido_at")}
        if (msg.get("texto") or "").strip()
        else None
    )
    return {"notas": str(d.get("notas") or ""), "archivos": archivos, "profe": str(d.get("profe") or ""), "mensaje": mensaje}


def para_la_pantalla(m: dict) -> dict:
    """Sin la ruta en disco: la pantalla pide el archivo por su id."""
    return {
        "notas": m.get("notas", ""),
        "archivos": [{k: v for k, v in a.items() if k != "ruta"} for a in m.get("archivos", [])],
        "profe": m.get("profe", ""),
        "mensaje": m.get("mensaje"),
    }


def con_profe(m: dict, profe: str) -> dict:
    """Quién da esta semana (vacío = el de la clase)."""
    return {**m, "profe": " ".join((profe or "").split())[:80]}


def con_mensaje(m: dict, texto: str, por: str) -> dict:
    """El mensaje del administrador. Vacío = sin mensaje. Si cambia, vuelve a
    estar sin leer."""
    t = (texto or "").strip()[:4000]
    if not t:
        return {**m, "mensaje": None}
    viejo = m.get("mensaje") or {}
    if (viejo.get("texto") or "").strip() == t:
        return m
    return {**m, "mensaje": {"texto": t, "por": (por or "")[:120], "at": _ahora(), "leido_por": "", "leido_at": ""}}


def leido(m: dict, por: str) -> dict:
    msg = m.get("mensaje")
    if not msg:
        raise TareaError("Esta semana no tiene mensaje", 404)
    return {**m, "mensaje": {**msg, "leido_por": (por or "")[:120], "leido_at": _ahora()}}


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


def _plano(t: str) -> str:
    import unicodedata

    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()


def es_para(quien_da: str, nombre_de_pila: str) -> bool:
    """Si la clase la da esta persona: su nombre de pila está en «La da»
    («Paul», «Paul y Luna»). Lo mismo que `esDe` de la pantalla."""
    import re

    n = (_plano(nombre_de_pila).split() or [""])[0]
    if len(n) < 2:
        return False
    return n in re.split(r"[^a-z0-9]+", _plano(quien_da))


async def avisos_de_mensajes(org_id: int, user_id: int, db_session) -> list[dict]:
    """La campana del profe (09/11/2026): «Rida te ha dejado un mensaje» por
    cada clase de esta semana o la que viene que da él, con el mensaje del
    administrador sin leer. Se va sola al marcarlo «Leído»."""
    from datetime import date, timedelta

    from sqlmodel import select

    from src.db.tareas import TareaSemana
    from src.db.users import User
    from src.services.panel.tandas import hoy_nl
    from src.services.salas import salas as S

    yo = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if not yo or not (yo.first_name or "").strip():
        return []
    hoy = date.fromisoformat(hoy_nl())
    desde = (hoy - timedelta(days=7)).isoformat()
    hasta = (hoy + timedelta(days=14)).isoformat()
    filas = (
        await db_session.execute(
            select(TareaSemana).where(
                TareaSemana.org_id == org_id,
                TareaSemana.fecha >= desde,
                TareaSemana.fecha <= hasta,
                TareaSemana.material_profe.contains("mensaje"),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    out: list[dict] = []
    recuadros: dict = {}
    for s in filas:
        m = leer(s.material_profe)
        msg = m.get("mensaje")
        if not msg or msg.get("leido_por"):
            continue
        quien = m.get("profe") or ""
        if not quien:
            if s.course_uuid not in recuadros:
                try:
                    cfg = await S.config_de(org_id, s.course_uuid, db_session)
                    recuadros[s.course_uuid] = str((cfg.get("banner") or {}).get("teacher") or "")
                except Exception:  # noqa: BLE001
                    recuadros[s.course_uuid] = ""
            quien = recuadros[s.course_uuid]
        if not es_para(quien, yo.first_name or ""):
            continue
        out.append(
            {
                "id": f"msgprofe:{s.id}:{msg.get('at', '')}",
                "kind": "clase",
                "title": f"{msg.get('por') or 'La dirección'} te ha dejado un mensaje",
                "excerpt": f"{s.tema or 'Tu próxima clase'}: {msg.get('texto', '')[:140]}",
                "url": "/equipo",
                "date": msg.get("at") or "",
            }
        )
    return out

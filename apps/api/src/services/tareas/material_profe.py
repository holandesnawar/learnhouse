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
    salida = {"notas": str(d.get("notas") or ""), "archivos": archivos, "profe": str(d.get("profe") or ""), "mensaje": mensaje}
    # Cuándo se le asignó (23/11/2026): con eso la campana avisa al profe.
    if salida["profe"] and str(d.get("profe_at") or ""):
        salida["profe_at"] = str(d.get("profe_at") or "")
        salida["profe_por"] = str(d.get("profe_por") or "")
    # La pizarra de clase (10/11/2026, pizarra.py) vive aquí dentro: se
    # conserva tal cual para que guardar unas notas no la borre.
    if isinstance(d.get("pizarra"), dict):
        salida["pizarra"] = d["pizarra"]
    # «Cómo fue la clase» (12/11/2026): dos líneas del profe después de darla.
    des = d.get("despues") if isinstance(d.get("despues"), dict) else {}
    if (des.get("texto") or "").strip():
        salida["despues"] = {k: str(des.get(k) or "") for k in ("texto", "por", "at")}
    return salida


def para_la_pantalla(m: dict) -> dict:
    """Sin la ruta en disco: la pantalla pide el archivo por su id."""
    return {
        "notas": m.get("notas", ""),
        "archivos": [{k: v for k, v in a.items() if k != "ruta"} for a in m.get("archivos", [])],
        "profe": m.get("profe", ""),
        "mensaje": m.get("mensaje"),
        # De la pizarra, solo si hay algo escrito y si ya está publicada.
        "pizarra": _pizarra_resumen(m),
        "despues": m.get("despues"),
    }


def _pizarra_resumen(m: dict) -> Optional[dict]:
    """`guardada_at` = la última vez que se escribió en CUALQUIER presentación
    de la semana (22/11/2026: cada una guarda sus notas, pizarra.py)."""
    if not isinstance(m.get("pizarra"), dict):
        return None
    from src.services.tareas import pizarra as PZ

    p = PZ.leer(m)
    pub = p.get("publicada")
    return {
        "guardada_at": PZ.ultima_escritura(p),
        "publicada_at": str((pub or {}).get("at") or ""),
        "paginas": int((pub or {}).get("paginas") or 0),
    }


def con_profe(m: dict, profe: str, por: str = "") -> dict:
    """Quién da esta semana (vacío = el de la clase).

    Si CAMBIA a otra persona se apunta cuándo (`profe_at`) y quién lo puso
    (`profe_por`): con eso la campana le avisa («Te han asignado…»,
    `avisos_de_asignacion`). Guardar el mismo nombre otra vez no avisa de nuevo."""
    nuevo = " ".join((profe or "").split())[:80]
    salida = {k: v for k, v in m.items() if k not in ("profe_at", "profe_por")}
    salida["profe"] = nuevo
    if nuevo:
        if _plano(nuevo) == _plano(m.get("profe") or "") and m.get("profe_at"):
            salida["profe_at"] = m.get("profe_at")
            salida["profe_por"] = m.get("profe_por") or ""
        else:
            salida["profe_at"] = _ahora()
            salida["profe_por"] = " ".join((por or "").split())[:80]
    return salida


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


def con_despues(m: dict, texto: str, por: str) -> dict:
    """«Cómo fue la clase»: lo escribe quien la dio (o cualquiera del equipo)
    después de darla, para que quede en la ficha. Vacío = se quita."""
    t = (texto or "").strip()[:2000]
    if not t:
        return {k: v for k, v in m.items() if k != "despues"}
    return {**m, "despues": {"texto": t, "por": (por or "")[:120], "at": _ahora()}}


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


def con_nombre(m: dict, archivo_id: str, nombre: str) -> dict:
    """Cambia el nombre con el que se ve un archivo o un enlace (22/11/2026)."""
    n = " ".join((nombre or "").split())[:150]
    if not n:
        raise TareaError("Escribe un nombre")
    a = next((x for x in m["archivos"] if x.get("id") == archivo_id), None)
    if a is None:
        raise TareaError("Ese archivo ya no está", 404)
    # La extensión se conserva: por ella se sabe en las listas si es un PDF.
    ext = Path(str(a.get("nombre") or "")).suffix if a.get("tipo") == "archivo" else ""
    if ext and ext.lower() in EXTENSIONES and not n.lower().endswith(ext.lower()):
        n += ext
    return {**m, "archivos": [{**x, "nombre": n} if x.get("id") == archivo_id else x for x in m["archivos"]]}


def con_archivo_cambiado(m: dict, archivo_id: str, relativa: str, tam: int, por: str) -> tuple[dict, Optional[str]]:
    """Cambia el ARCHIVO de uno ya subido conservando su id (22/11/2026): así
    una presentación corregida conserva lo escrito sobre ella en la pizarra
    (las notas van por id, pizarra.py). El nombre que se ve no cambia. Devuelve
    también la ruta del archivo de antes, para borrarlo si nadie más lo usa.

    Tiene que ser del mismo tipo (un PDF por un PDF): si no, dejaría de ser
    una presentación y sus notas se quedarían sueltas."""
    a = next((x for x in m["archivos"] if x.get("id") == archivo_id and x.get("tipo") == "archivo"), None)
    if a is None:
        raise TareaError("Ese archivo ya no está", 404)
    if Path(str(a.get("ruta") or "")).suffix.lower() != Path(relativa).suffix.lower():
        raise TareaError("Tiene que ser del mismo tipo que el de antes (un PDF por un PDF)")
    cambiado = {**a, "ruta": relativa, "tam": int(tam), "cambiado_por": (por or "")[:120], "cambiado_at": _ahora()}
    return {**m, "archivos": [cambiado if x.get("id") == archivo_id else x for x in m["archivos"]]}, a.get("ruta")


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


#: Durante cuántos días sale en la campana una clase recién asignada.
DIAS_AVISO_ASIGNACION = 14


def agrupar_asignaciones(filas: list[dict]) -> list[dict]:
    """Los avisos de «te han asignado…», uno por clase (curso). Puro.

    `filas`: [{semana_id, curso, fecha, tema, at}] ya filtradas (son de esta
    persona, de hoy en adelante y asignadas hace poco). Con varias fechas de
    la misma clase (se crearon 8 seguidas) sale UNA línea, no ocho."""
    por_curso: dict[str, list[dict]] = {}
    for f in filas:
        por_curso.setdefault(f["curso"], []).append(f)
    out = []
    for curso, lista in por_curso.items():
        lista.sort(key=lambda f: f["fecha"])
        ultima = max(f["at"] for f in lista)
        primera = lista[0]
        if len(lista) == 1:
            detalle = _dia_corto(primera["fecha"]) + (f" · {primera['tema']}" if primera.get("tema") else "")
        else:
            detalle = f"{len(lista)} fechas; la primera, el {_dia_corto(primera['fecha'])}"
        out.append(
            {
                "id": f"clase-asignada:{primera['semana_id']}:{ultima}",
                "kind": "clase",
                "title": f"Te han asignado: {curso}",
                "excerpt": detalle,
                "url": "/equipo?vista=calendario",
                "date": ultima,
            }
        )
    out.sort(key=lambda i: i["date"], reverse=True)
    return out


_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _dia_corto(fecha: str) -> str:
    from datetime import date

    try:
        d = date.fromisoformat(fecha)
    except ValueError:
        return fecha
    return f"{_DIAS[d.weekday()]} {d.day} {_MESES[d.month - 1]}"


async def avisos_de_asignacion(org_id: int, user_id: int, db_session) -> list[dict]:
    """La campana del profe (23/11/2026): «Te han asignado: Masterclass · jueves
    26 nov» cuando un administrador le pone una clase («La da esta semana» en
    la ficha, o «Nueva clase» con su nombre). Sale durante dos semanas, solo de
    clases que aún no han pasado, y se quita como cualquier aviso. Va por el
    nombre de pila, como el resto de la sala de profesores."""
    from datetime import date, datetime, timedelta, timezone

    from sqlmodel import select

    from src.db.courses.courses import Course
    from src.db.tareas import TareaSemana
    from src.db.users import User
    from src.services.panel.tandas import hoy_nl
    from src.services.salas.salas import nombre_con_etiqueta
    from src.services.tareas import tareas as T

    yo = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if not yo or not (yo.first_name or "").strip():
        return []
    hoy = hoy_nl()
    corte = (datetime.now(timezone.utc) - timedelta(days=DIAS_AVISO_ASIGNACION)).replace(microsecond=0).isoformat()
    filas = (
        await db_session.execute(
            select(TareaSemana).where(
                TareaSemana.org_id == org_id,
                TareaSemana.fecha >= hoy,
                TareaSemana.material_profe.contains("profe_at"),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    mio = " ".join(f"{yo.first_name or ''} {yo.last_name or ''}".split())
    mias: list[dict] = []
    for s in filas:
        m = leer(s.material_profe)
        at = m.get("profe_at") or ""
        if not at or at < corte or not es_para(m.get("profe") or "", yo.first_name or ""):
            continue
        # Si se la puso él mismo, no hace falta avisarle.
        if mio and _plano(m.get("profe_por") or "") == _plano(mio):
            continue
        mias.append({"semana_id": s.id, "course_uuid": s.course_uuid, "fecha": s.fecha, "tema": s.tema or "", "at": at})
    if not mias:
        return []
    config = await T._config(org_id, db_session)
    nombres: dict[str, str] = {}
    for u in {f["course_uuid"] for f in mias}:
        c = (await db_session.execute(select(Course).where(Course.course_uuid == u))).scalars().first()
        nombres[u] = nombre_con_etiqueta(config, u, c.name if c else "Clase")
    for f in mias:
        f["curso"] = nombres[f["course_uuid"]]
    return agrupar_asignaciones(mias)

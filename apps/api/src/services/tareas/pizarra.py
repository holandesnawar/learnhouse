"""
La pizarra de clase (10/11/2026).

Pedido: "se sube a la escuela, y luego ahí el profe pueda abrirlo en clase
mientras comparte pantalla, y editar desde dentro o escribir notas, con el
mismo diseño, y pulsar «guardar» con un clic y eso es la presentación de
después de clase, la que ven los alumnos".

Cómo va:

1. El profe abre la presentación de esa semana DENTRO de la escuela
   (`/pizarra/<semana>`): un PDF del material del profe (la «presentación
   completa») o el PDF que los alumnos ven antes de la clase.
2. Escribe encima mientras comparte pantalla: lápiz, rotulador, texto con la
   letra de la marca, páginas en blanco para notas, esconder una página. Lo
   que escribe se guarda solo (`anotaciones`: un JSON con los trazos, en
   coordenadas de 0 a 1 de cada página, así se ve igual en cualquier pantalla).
3. «Guardar para los alumnos»: el navegador pinta cada página con lo escrito
   encima y monta un PDF; la escuela lo guarda y, desde el día de la clase,
   los alumnos de esa clase lo ven en su semana como «Presentación con las
   notas de la clase». Se puede volver a guardar (sustituye) o quitar.

Dónde se guarda, sin tabla ni columna nueva: dentro de
`tarea_semana.material_profe` (JSON), en la clave `pizarra`:

    {"fuente": "profe:<id>" | "clase:<activity_uuid>",
     "anotaciones": "<ruta del JSON>", "guardada_at", "guardada_por",
     "publicada": {"ruta", "at", "por", "paginas", "tam"} | None}

Los dos archivos van a `content/privado/tareas/<org>/pizarra/` (dentro del
volumen: entran en la copia diaria) y `/content` nunca los sirve: el JSON solo
al equipo; el PDF, al equipo y a los alumnos que ven esa clase, por su ruta.

Cada grupo tiene su semana, así que cada profe guarda SUS notas: lo que se
escribe en la clase del martes no pisa lo del jueves.
"""

from __future__ import annotations

import json
import uuid as _uuid
from pathlib import Path
from typing import Any, Optional

from src.services.tareas.tareas import CARPETA, CONTENT_DIR, TareaError, ruta_segura

MAX_ANOTACIONES = 8 * 1024 * 1024
MAX_PDF = 60 * 1024 * 1024
MAX_PAGINAS = 200


def leer(material: dict) -> dict:
    """La pizarra guardada en el material de la semana, siempre con la misma forma."""
    p = material.get("pizarra") if isinstance(material, dict) else None
    if not isinstance(p, dict):
        p = {}
    pub = p.get("publicada") if isinstance(p.get("publicada"), dict) else None
    if pub and not pub.get("ruta"):
        pub = None
    return {
        "fuente": str(p.get("fuente") or ""),
        "anotaciones": str(p.get("anotaciones") or ""),
        "guardada_at": str(p.get("guardada_at") or ""),
        "guardada_por": str(p.get("guardada_por") or ""),
        "publicada": (
            {
                "ruta": str(pub.get("ruta") or ""),
                "at": str(pub.get("at") or ""),
                "por": str(pub.get("por") or ""),
                "paginas": int(pub.get("paginas") or 0),
                "tam": int(pub.get("tam") or 0),
            }
            if pub
            else None
        ),
    }


def publicada_para_la_pantalla(p: dict) -> Optional[dict]:
    """Sin la ruta en disco."""
    pub = p.get("publicada")
    return {k: v for k, v in pub.items() if k != "ruta"} if pub else None


def fuentes(material: dict, clases: list[dict]) -> list[dict]:
    """Los PDF sobre los que se puede escribir: primero los del profe (la
    presentación completa), luego el que ven los alumnos antes de la clase."""
    out: list[dict] = []
    for a in material.get("archivos") or []:
        if a.get("tipo") == "archivo" and str(a.get("ruta") or "").lower().endswith(".pdf"):
            out.append({"id": f"profe:{a.get('id')}", "de": "profe", "nombre": a.get("nombre") or "Presentación completa"})
    for c in clases or []:
        if c.get("tipo") == "presentacion" and c.get("activity_uuid"):
            out.append({"id": f"clase:{c['activity_uuid']}", "de": "alumnos", "nombre": c.get("nombre") or "Presentación"})
    return out


def fuente_valida(fuente: str, disponibles: list[dict]) -> str:
    """La fuente pedida si existe; si no, la primera; si no hay ninguna, vacío."""
    ids = [f["id"] for f in disponibles]
    if fuente in ids:
        return fuente
    return ids[0] if ids else ""


def limpiar_anotaciones(doc: Any) -> dict:
    """Lo mínimo para no guardar cualquier cosa: una lista de páginas, cada una
    con de qué página del PDF sale (o ninguna: en blanco) y sus trazos."""
    if not isinstance(doc, dict) or not isinstance(doc.get("paginas"), list):
        raise TareaError("No se pudo leer lo escrito en la pizarra")
    paginas = []
    for pg in doc["paginas"][:MAX_PAGINAS]:
        if not isinstance(pg, dict):
            continue
        origen = pg.get("origen")
        paginas.append(
            {
                "origen": int(origen) if isinstance(origen, (int, float)) and origen >= 1 else None,
                "oculta": bool(pg.get("oculta")),
                "titulo": str(pg.get("titulo") or "")[:120],
                "trazos": [t for t in (pg.get("trazos") or []) if isinstance(t, dict)][:4000],
            }
        )
    return {"v": 1, "paginas": paginas}


def _carpeta(org_id: int) -> Path:
    d = CONTENT_DIR / CARPETA / str(org_id) / "pizarra"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _relativa(org_id: int, nombre: str) -> str:
    return f"{CARPETA}/{org_id}/pizarra/{nombre}"


def _borrar(relativa: str) -> None:
    ruta = ruta_segura(relativa or "")
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


def guardar_anotaciones(org_id: int, p: dict, fuente: str, doc: dict, por: str, ahora: str) -> dict:
    """Escribe el JSON (en el mismo archivo si ya había) y devuelve la pizarra nueva."""
    texto = json.dumps(limpiar_anotaciones(doc), ensure_ascii=False, separators=(",", ":"))
    datos = texto.encode("utf-8")
    if len(datos) > MAX_ANOTACIONES:
        raise TareaError("Hay demasiado escrito en esta pizarra para guardarlo. Borra algún trazo largo.")
    relativa = p.get("anotaciones") or _relativa(org_id, f"{_uuid.uuid4().hex}.json")
    ruta = ruta_segura(relativa)
    if ruta is None:
        relativa = _relativa(org_id, f"{_uuid.uuid4().hex}.json")
        ruta = ruta_segura(relativa)
    _carpeta(org_id)
    assert ruta is not None
    ruta.write_bytes(datos)
    return {**p, "fuente": fuente, "anotaciones": relativa, "guardada_at": ahora, "guardada_por": (por or "")[:120]}


def leer_anotaciones(p: dict) -> Optional[dict]:
    ruta = ruta_segura(p.get("anotaciones") or "")
    if ruta is None or not ruta.is_file():
        return None
    try:
        return json.loads(ruta.read_text("utf-8"))
    except (ValueError, OSError):
        return None


def es_pdf(datos: bytes) -> bool:
    return datos[:5] == b"%PDF-" and b"%%EOF" in datos[-2048:]


def publicar(org_id: int, p: dict, datos: bytes, paginas: int, por: str, ahora: str) -> dict:
    """Guarda el PDF de después de clase (sustituye al anterior)."""
    if not datos:
        raise TareaError("La presentación llegó vacía")
    if len(datos) > MAX_PDF:
        raise TareaError(f"La presentación pesa más de {MAX_PDF // (1024 * 1024)} MB")
    if not es_pdf(datos):
        raise TareaError("Lo que llegó no es un PDF")
    _carpeta(org_id)
    relativa = _relativa(org_id, f"{_uuid.uuid4().hex}.pdf")
    ruta = ruta_segura(relativa)
    assert ruta is not None
    ruta.write_bytes(datos)
    viejo = (p.get("publicada") or {}).get("ruta")
    if viejo:
        _borrar(viejo)
    return {
        **p,
        "publicada": {"ruta": relativa, "at": ahora, "por": (por or "")[:120], "paginas": max(0, int(paginas or 0)), "tam": len(datos)},
    }


def quitar_publicada(p: dict) -> dict:
    viejo = (p.get("publicada") or {}).get("ruta")
    if viejo:
        _borrar(viejo)
    return {**p, "publicada": None}


def pdf_publicado(p: dict) -> Optional[Path]:
    pub = p.get("publicada")
    ruta = ruta_segura((pub or {}).get("ruta") or "")
    return ruta if ruta and ruta.is_file() else None

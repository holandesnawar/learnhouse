"""
Los tableros de producción de la formación (19/11/2026).

Pedido del usuario, enseñando su Deck de Nextcloud (portal.nawar.es): "para
mi admin tener la parte de kanban con el deck sobre las formaciones donde yo
pueda tener el contenido, modificar, etiquetar, escribir los objetivos de cada
videoclase grabada, pegar links, y el profe también sobre dónde están los
entregables… con un solo deck se me hace difícil diferenciar entre un curso u
otro, entre el A0-A1 que ya tenemos y el A1-A2 que estamos preparando… y ya
dentro de la escuela".

Cómo está hecho:

- **Cursos** (`prod_curso`: «A0-A1», «A1-A2»): lo que en Nextcloud no había.
  Cada curso tiene sus tableros, sus etiquetas y su plantilla de tarjeta (con
  la que nace cada tarjeta nueva: «Korte beschrijving», «Doelen»…).
- **Tableros** (`prod_tablero`, uno por módulo), **columnas**
  (`prod_columna`: «Niet begonnen», «Aan het opnemen», «Ingeleverd»…) y
  **tarjetas** (`prod_tarjeta`, una por lección o vídeo).
- La tarjeta: descripción con el editor de la escuela (se guarda como lo da el
  editor: JSON de Tiptap o, lo que viene de Nextcloud, HTML), etiquetas del
  curso, a quién va (personas del equipo; lo importado que no casa con nadie
  se queda con su nombre), para cuándo y si está hecha, enlaces, adjuntos
  (`content/privado/produccion/<org>/`, nunca por `/content`) y comentarios.
- Quién: todo el equipo de clases (`STAFF_ROLE_IDS`) ve todo, crea y cambia
  tarjetas, columnas, comentarios y adjuntos. Crear, cambiar y borrar cursos y
  tableros, cambiar o borrar etiquetas, borrar columnas e importar de
  Nextcloud: administradores. Una tarjeta la borra quien la creó o un
  administrador (archivarla, cualquiera). Lo comprueba `routers/produccion.py`.

Importar de Nextcloud: `services/produccion/nextcloud.py`.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

from sqlalchemy import delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.produccion import ProdColumna, ProdComentario, ProdCurso, ProdEtiqueta, ProdTablero, ProdTarjeta

CONTENT_DIR = Path("content")
MAX_ADJUNTO_BYTES = 50 * 1024 * 1024
MAX_DESCRIPCION = 300_000
EXTENSIONES = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic",
    ".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".csv",
    ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp", ".key", ".pages", ".numbers",
    ".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".mov", ".webm", ".zip",
}

COLUMNAS_DE_FABRICA = ["Niet begonnen", "Aan het opnemen", "Ingeleverd", "Revisie nodig", "Klaar"]
ETIQUETAS_DE_FABRICA = [
    ("Ingeleverd", "#0082C9"),
    ("Revisie nodig", "#C2410C"),
    ("Opnemen", "#7C3AED"),
    ("Klaar", "#15803D"),
]
PLANTILLA_DE_FABRICA = (
    "<h2>Korte beschrijving</h2><p></p>"
    "<h2>Doelen</h2><ul><li><p></p></li></ul>"
    "<h2>Materiaal en links</h2><p></p>"
)
COLORES = ["#0b2da0", "#0082C9", "#15803D", "#C2410C", "#7C3AED", "#DB2777", "#CA8A04", "#0891B2", "#DC2626", "#4B5563"]


class ProduccionError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


# ── ayudas ─────────────────────────────────────────────────────────────────


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _lista(texto: Any) -> list:
    if isinstance(texto, list):
        return texto
    try:
        v = json.loads(texto or "[]")
    except (TypeError, ValueError):
        return []
    return v if isinstance(v, list) else []


def _json(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


def color_ok(c: Any, por_defecto: str = "#0b2da0") -> str:
    c = str(c or "").strip()
    if re.fullmatch(r"[0-9a-fA-F]{6}", c):
        c = "#" + c
    return c.upper() if re.fullmatch(r"#[0-9a-fA-F]{6}", c) else por_defecto


def vence_ok(texto: Any) -> str:
    """AAAA-MM-DD o AAAA-MM-DDTHH:MM (hora de Países Bajos, sin zona). Lo que
    no se entiende, vacío."""
    t = str(texto or "").strip()
    if not t:
        return ""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?", t)
    if not m:
        return ""
    try:
        date.fromisoformat(m.group(1))
    except ValueError:
        return ""
    if m.group(2) is None:
        return m.group(1)
    hh, mm = int(m.group(2)), int(m.group(3))
    if hh > 23 or mm > 59:
        return m.group(1)
    return f"{m.group(1)}T{hh:02d}:{mm:02d}"


def url_ok(url: Any) -> str:
    u = str(url or "").strip()
    if not u:
        return ""
    if not re.match(r"^[a-z][a-z0-9+.-]*://", u, re.I):
        # «javascript:…», «data:…», «mailto:…»: fuera. «dominio.com:8080/…» vale.
        if re.match(r"^[a-z][a-z0-9+.-]*:(?!\d)", u, re.I):
            return ""
        u = "https://" + u
    return u[:1000] if re.match(r"^https?://[^\s/$.?#][^\s]*$", u, re.I) else ""


def _sin_acentos(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn").lower()


def texto_plano(descripcion: str) -> str:
    """El texto de una descripción (JSON del editor o HTML), sin formato."""
    d = (descripcion or "").strip()
    if not d:
        return ""
    if d.startswith("{"):
        try:
            nodo = json.loads(d)
        except ValueError:
            return d
        trozos: list[str] = []

        def recorrer(n: Any) -> None:
            if isinstance(n, dict):
                if n.get("type") == "text":
                    trozos.append(str(n.get("text") or ""))
                for h in n.get("content") or []:
                    recorrer(h)
                if n.get("type") in ("paragraph", "heading", "listItem"):
                    trozos.append(" ")

        recorrer(nodo)
        return re.sub(r"\s+", " ", "".join(trozos)).strip()
    sin = re.sub(r"<[^>]+>", " ", d)
    import html as _h

    return re.sub(r"\s+", " ", _h.unescape(sin)).strip()


def _orden_al_final(ordenes: Iterable[float]) -> float:
    o = list(ordenes)
    return (max(o) + 1) if o else 1.0


# ── serializar ─────────────────────────────────────────────────────────────


def curso_dict(c: ProdCurso) -> dict:
    return {
        "id": c.id,
        "nombre": c.nombre,
        "color": c.color,
        "plantilla": c.plantilla or "",
        "orden": c.orden,
        "archivado": bool(c.archivado),
    }


def etiqueta_dict(e: ProdEtiqueta) -> dict:
    return {"id": e.id, "curso_id": e.curso_id, "nombre": e.nombre, "color": e.color, "orden": e.orden}


def tablero_dict(t: ProdTablero) -> dict:
    return {
        "id": t.id,
        "curso_id": t.curso_id,
        "titulo": t.titulo,
        "color": t.color,
        "orden": t.orden,
        "archivado": bool(t.archivado),
        "origen": t.origen,
        "updated_at": t.updated_at,
    }


def columna_dict(c: ProdColumna) -> dict:
    return {"id": c.id, "tablero_id": c.tablero_id, "titulo": c.titulo, "orden": c.orden}


def _adjunto_publico(a: dict) -> dict:
    return {k: a.get(k) for k in ("id", "nombre", "ext", "tamano", "subido", "por")}


def tarjeta_resumen(t: ProdTarjeta) -> dict:
    texto = texto_plano(t.descripcion)
    return {
        "id": t.id,
        "tablero_id": t.tablero_id,
        "columna_id": t.columna_id,
        "titulo": t.titulo,
        "orden": t.orden,
        "vence": t.vence,
        "hecha_at": t.hecha_at,
        "archivada": bool(t.archivada),
        "etiquetas": [int(x) for x in _lista(t.etiquetas) if str(x).isdigit()],
        "asignados": [a for a in _lista(t.asignados) if isinstance(a, dict)],
        "n_enlaces": len(_lista(t.enlaces)),
        "n_adjuntos": len(_lista(t.adjuntos)),
        "n_comentarios": int(t.n_comentarios or 0),
        "tiene_descripcion": bool(texto),
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def tarjeta_completa(t: ProdTarjeta) -> dict:
    d = tarjeta_resumen(t)
    d.update(
        {
            "descripcion": t.descripcion or "",
            "enlaces": [e for e in _lista(t.enlaces) if isinstance(e, dict)],
            "adjuntos": [_adjunto_publico(a) for a in _lista(t.adjuntos) if isinstance(a, dict)],
            "creado_por": t.creado_por,
            "creado_por_id": t.creado_por_id,
            "actualizado_por": t.actualizado_por,
            "origen": t.origen,
        }
    )
    return d


def comentario_dict(c: ProdComentario) -> dict:
    return {"id": c.id, "user_id": c.user_id, "autor": c.autor, "texto": c.texto, "created_at": c.created_at, "editado_at": c.editado_at}


def _nombre(u: Any) -> str:
    n = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
    return n or getattr(u, "username", "") or "Equipo"


# ── leer ───────────────────────────────────────────────────────────────────


async def _curso(org_id: int, curso_id: int, db: AsyncSession) -> ProdCurso:
    c = await db.get(ProdCurso, curso_id)
    if c is None or c.org_id != org_id:
        raise ProduccionError("Ese curso no existe", 404)
    return c


async def _tablero(org_id: int, tablero_id: int, db: AsyncSession) -> ProdTablero:
    t = await db.get(ProdTablero, tablero_id)
    if t is None or t.org_id != org_id:
        raise ProduccionError("Ese tablero no existe", 404)
    return t


async def _columna(org_id: int, columna_id: int, db: AsyncSession) -> ProdColumna:
    c = await db.get(ProdColumna, columna_id)
    if c is None or c.org_id != org_id:
        raise ProduccionError("Esa columna no existe", 404)
    return c


async def _tarjeta(org_id: int, tarjeta_id: int, db: AsyncSession) -> ProdTarjeta:
    t = await db.get(ProdTarjeta, tarjeta_id)
    if t is None or t.org_id != org_id:
        raise ProduccionError("Esa tarjeta no existe", 404)
    return t


async def _todas(db: AsyncSession, modelo, *condiciones) -> list:
    return list((await db.execute(select(modelo).where(*condiciones))).scalars().all())


async def vista_general(org_id: int, db: AsyncSession) -> dict:
    """Los cursos con sus etiquetas y sus tableros, y cuántas tarjetas tiene
    cada tablero (por hacer, hechas, vencidas)."""
    cursos = sorted(await _todas(db, ProdCurso, ProdCurso.org_id == org_id), key=lambda c: (c.orden, c.id))
    etiquetas = await _todas(db, ProdEtiqueta, ProdEtiqueta.org_id == org_id)
    tableros = await _todas(db, ProdTablero, ProdTablero.org_id == org_id)
    tarjetas = await _todas(db, ProdTarjeta, ProdTarjeta.org_id == org_id, ProdTarjeta.archivada == False)  # noqa: E712
    hoy = date.today().isoformat()
    cuentas: dict[int, dict] = {}
    for t in tarjetas:
        c = cuentas.setdefault(t.tablero_id, {"total": 0, "hechas": 0, "vencidas": 0})
        c["total"] += 1
        if t.hecha_at:
            c["hechas"] += 1
        elif t.vence and t.vence[:10] < hoy:
            c["vencidas"] += 1
    salida = []
    for c in cursos:
        d = curso_dict(c)
        d["etiquetas"] = [etiqueta_dict(e) for e in sorted((e for e in etiquetas if e.curso_id == c.id), key=lambda e: (e.orden, e.id))]
        d["tableros"] = [
            {**tablero_dict(t), **cuentas.get(t.id, {"total": 0, "hechas": 0, "vencidas": 0})}
            for t in sorted((t for t in tableros if t.curso_id == c.id), key=lambda t: (t.orden, t.id))
        ]
        salida.append(d)
    return {"cursos": salida}


async def ver_tablero(org_id: int, tablero_id: int, db: AsyncSession) -> dict:
    t = await _tablero(org_id, tablero_id, db)
    columnas = sorted(await _todas(db, ProdColumna, ProdColumna.tablero_id == t.id), key=lambda c: (c.orden, c.id))
    tarjetas = await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id == t.id)
    activas = sorted((x for x in tarjetas if not x.archivada), key=lambda x: (x.orden, x.id))
    return {
        "tablero": tablero_dict(t),
        "columnas": [columna_dict(c) for c in columnas],
        "tarjetas": [tarjeta_resumen(x) for x in activas],
        "n_archivadas": sum(1 for x in tarjetas if x.archivada),
    }


async def archivadas(org_id: int, tablero_id: int, db: AsyncSession) -> list[dict]:
    t = await _tablero(org_id, tablero_id, db)
    filas = await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id == t.id, ProdTarjeta.archivada == True)  # noqa: E712
    return [tarjeta_resumen(x) for x in sorted(filas, key=lambda x: x.updated_at or "", reverse=True)]


async def ver_tarjeta(org_id: int, tarjeta_id: int, db: AsyncSession) -> dict:
    t = await _tarjeta(org_id, tarjeta_id, db)
    coms = sorted(await _todas(db, ProdComentario, ProdComentario.tarjeta_id == t.id), key=lambda c: c.created_at or "")
    return {**tarjeta_completa(t), "comentarios": [comentario_dict(c) for c in coms]}


def proximas_de(tarjetas: list[dict], user_id: int, hoy: str, solo_mias: bool = False) -> list[dict]:
    """Las tarjetas con fecha y sin hacer, la más urgente primero (función
    pura, con test). Cada una dice si es de quien pregunta."""
    salida = []
    for t in tarjetas:
        if not t.get("vence") or t.get("hecha_at") or t.get("archivada"):
            continue
        mia = any(int(a.get("id") or 0) == user_id for a in t.get("asignados") or [])
        if solo_mias and not mia:
            continue
        salida.append({**t, "mia": mia, "vencida": t["vence"][:10] < hoy})
    return sorted(salida, key=lambda t: (t["vence"], t["id"]))


async def proximas(org_id: int, user_id: int, solo_mias: bool, db: AsyncSession) -> list[dict]:
    tableros = {t.id: t for t in await _todas(db, ProdTablero, ProdTablero.org_id == org_id) if not t.archivado}
    cursos = {c.id: c for c in await _todas(db, ProdCurso, ProdCurso.org_id == org_id) if not c.archivado}
    filas = await _todas(db, ProdTarjeta, ProdTarjeta.org_id == org_id, ProdTarjeta.archivada == False)  # noqa: E712
    resumen = [tarjeta_resumen(x) for x in filas if x.tablero_id in tableros and tableros[x.tablero_id].curso_id in cursos]
    hoy = date.today().isoformat()
    salida = proximas_de(resumen, user_id, hoy, solo_mias)
    for t in salida:
        tb = tableros[t["tablero_id"]]
        t["tablero"] = tb.titulo
        t["tablero_color"] = tb.color
        t["curso"] = cursos[tb.curso_id].nombre
        t["curso_id"] = tb.curso_id
    return salida[:200]


async def buscar(org_id: int, q: str, db: AsyncSession) -> list[dict]:
    q = _sin_acentos((q or "").strip())
    if len(q) < 2:
        return []
    tableros = {t.id: t for t in await _todas(db, ProdTablero, ProdTablero.org_id == org_id)}
    cursos = {c.id: c for c in await _todas(db, ProdCurso, ProdCurso.org_id == org_id)}
    salida = []
    for x in await _todas(db, ProdTarjeta, ProdTarjeta.org_id == org_id):
        en_titulo = q in _sin_acentos(x.titulo)
        if not en_titulo and q not in _sin_acentos(texto_plano(x.descripcion)):
            continue
        tb = tableros.get(x.tablero_id)
        if tb is None:
            continue
        r = tarjeta_resumen(x)
        r.update({"tablero": tb.titulo, "tablero_color": tb.color, "curso": cursos[tb.curso_id].nombre if tb.curso_id in cursos else "", "curso_id": tb.curso_id, "en_titulo": en_titulo})
        salida.append(r)
    salida.sort(key=lambda r: (not r["en_titulo"], r["archivada"], r["titulo"].lower()))
    return salida[:60]


# ── cursos ─────────────────────────────────────────────────────────────────


async def crear_curso(org_id: int, nombre: str, color: str, db: AsyncSession) -> dict:
    nombre = (nombre or "").strip()[:120]
    if not nombre:
        raise ProduccionError("Ponle un nombre al curso (por ejemplo «A1-A2»)")
    ahora = _ahora()
    orden = _orden_al_final(c.orden for c in await _todas(db, ProdCurso, ProdCurso.org_id == org_id))
    c = ProdCurso(org_id=org_id, nombre=nombre, color=color_ok(color), plantilla=PLANTILLA_DE_FABRICA, orden=orden, created_at=ahora, updated_at=ahora)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    for i, (n, col) in enumerate(ETIQUETAS_DE_FABRICA):
        db.add(ProdEtiqueta(org_id=org_id, curso_id=c.id, nombre=n, color=col, orden=i + 1))
    await db.commit()
    return curso_dict(c)


async def cambiar_curso(org_id: int, curso_id: int, datos: dict, db: AsyncSession) -> dict:
    c = await _curso(org_id, curso_id, db)
    if "nombre" in datos and datos["nombre"] is not None:
        n = str(datos["nombre"]).strip()[:120]
        if not n:
            raise ProduccionError("El curso necesita un nombre")
        c.nombre = n
    if datos.get("color") is not None:
        c.color = color_ok(datos["color"], c.color)
    if datos.get("plantilla") is not None:
        c.plantilla = str(datos["plantilla"])[:MAX_DESCRIPCION]
    if datos.get("orden") is not None:
        c.orden = float(datos["orden"])
    if datos.get("archivado") is not None:
        c.archivado = bool(datos["archivado"])
    c.updated_at = _ahora()
    db.add(c)
    await db.commit()
    return curso_dict(c)


async def _borrar_tarjetas(db: AsyncSession, tarjetas: list[ProdTarjeta]) -> None:
    ids = [t.id for t in tarjetas]
    for t in tarjetas:
        for a in _lista(t.adjuntos):
            if isinstance(a, dict):
                _borrar_del_disco(a.get("ruta", ""))
    if ids:
        await db.execute(delete(ProdComentario).where(ProdComentario.tarjeta_id.in_(ids)))  # type: ignore[attr-defined]
        await db.execute(delete(ProdTarjeta).where(ProdTarjeta.id.in_(ids)))  # type: ignore[attr-defined]


async def _borrar_tablero_entero(db: AsyncSession, t: ProdTablero) -> None:
    await _borrar_tarjetas(db, await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id == t.id))
    await db.execute(delete(ProdColumna).where(ProdColumna.tablero_id == t.id))
    await db.delete(t)


async def borrar_curso(org_id: int, curso_id: int, db: AsyncSession) -> None:
    c = await _curso(org_id, curso_id, db)
    for t in await _todas(db, ProdTablero, ProdTablero.curso_id == c.id):
        await _borrar_tablero_entero(db, t)
    await db.execute(delete(ProdEtiqueta).where(ProdEtiqueta.curso_id == c.id))
    await db.delete(c)
    await db.commit()


# ── etiquetas ──────────────────────────────────────────────────────────────


async def crear_etiqueta(org_id: int, curso_id: int, nombre: str, color: str, db: AsyncSession) -> dict:
    c = await _curso(org_id, curso_id, db)
    nombre = (nombre or "").strip()[:60]
    if not nombre:
        raise ProduccionError("La etiqueta necesita un nombre")
    existentes = await _todas(db, ProdEtiqueta, ProdEtiqueta.curso_id == c.id)
    for e in existentes:
        if _sin_acentos(e.nombre) == _sin_acentos(nombre):
            return etiqueta_dict(e)
    e = ProdEtiqueta(org_id=org_id, curso_id=c.id, nombre=nombre, color=color_ok(color, COLORES[len(existentes) % len(COLORES)]), orden=_orden_al_final(x.orden for x in existentes))
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return etiqueta_dict(e)


async def cambiar_etiqueta(org_id: int, etiqueta_id: int, datos: dict, db: AsyncSession) -> dict:
    e = await db.get(ProdEtiqueta, etiqueta_id)
    if e is None or e.org_id != org_id:
        raise ProduccionError("Esa etiqueta no existe", 404)
    if datos.get("nombre") is not None:
        n = str(datos["nombre"]).strip()[:60]
        if n:
            e.nombre = n
    if datos.get("color") is not None:
        e.color = color_ok(datos["color"], e.color)
    if datos.get("orden") is not None:
        e.orden = float(datos["orden"])
    db.add(e)
    await db.commit()
    return etiqueta_dict(e)


async def borrar_etiqueta(org_id: int, etiqueta_id: int, db: AsyncSession) -> None:
    e = await db.get(ProdEtiqueta, etiqueta_id)
    if e is None or e.org_id != org_id:
        raise ProduccionError("Esa etiqueta no existe", 404)
    tableros = [t.id for t in await _todas(db, ProdTablero, ProdTablero.curso_id == e.curso_id)]
    if tableros:
        for t in await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id.in_(tableros)):  # type: ignore[attr-defined]
            ids = [int(x) for x in _lista(t.etiquetas) if str(x).isdigit()]
            if e.id in ids:
                t.etiquetas = _json([x for x in ids if x != e.id])
                db.add(t)
    await db.delete(e)
    await db.commit()


async def _etiquetas_en(org_id: int, curso_destino: int, ids: list[int], db: AsyncSession) -> list[int]:
    """Las etiquetas de una tarjeta que pasa a otro curso: las mismas por
    nombre (se crean si faltan)."""
    if not ids:
        return []
    origen = {e.id: e for e in await _todas(db, ProdEtiqueta, ProdEtiqueta.id.in_(ids))}  # type: ignore[attr-defined]
    destino = await _todas(db, ProdEtiqueta, ProdEtiqueta.curso_id == curso_destino)
    salida = []
    for i in ids:
        e = origen.get(i)
        if e is None:
            continue
        if e.curso_id == curso_destino:
            salida.append(e.id)
            continue
        igual = next((d for d in destino if _sin_acentos(d.nombre) == _sin_acentos(e.nombre)), None)
        if igual is None:
            igual = ProdEtiqueta(org_id=org_id, curso_id=curso_destino, nombre=e.nombre, color=e.color, orden=_orden_al_final(d.orden for d in destino))
            db.add(igual)
            await db.flush()
            destino.append(igual)
        salida.append(igual.id)
    return salida


# ── tableros ───────────────────────────────────────────────────────────────


async def crear_tablero(org_id: int, curso_id: int, titulo: str, color: str, db: AsyncSession, columnas: Optional[list[str]] = None) -> dict:
    c = await _curso(org_id, curso_id, db)
    titulo = (titulo or "").strip()[:160]
    if not titulo:
        raise ProduccionError("Ponle un título al tablero (por ejemplo «Module 1: Over jou»)")
    ahora = _ahora()
    hermanos = await _todas(db, ProdTablero, ProdTablero.curso_id == c.id)
    t = ProdTablero(
        org_id=org_id,
        curso_id=c.id,
        titulo=titulo,
        color=color_ok(color, COLORES[len(hermanos) % len(COLORES)]),
        orden=_orden_al_final(h.orden for h in hermanos),
        created_at=ahora,
        updated_at=ahora,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    nombres = [n.strip()[:80] for n in (columnas if columnas is not None else COLUMNAS_DE_FABRICA) if n and n.strip()]
    for i, n in enumerate(nombres):
        db.add(ProdColumna(org_id=org_id, tablero_id=t.id, titulo=n, orden=i + 1))
    await db.commit()
    return tablero_dict(t)


async def cambiar_tablero(org_id: int, tablero_id: int, datos: dict, db: AsyncSession) -> dict:
    t = await _tablero(org_id, tablero_id, db)
    if datos.get("titulo") is not None:
        n = str(datos["titulo"]).strip()[:160]
        if not n:
            raise ProduccionError("El tablero necesita un título")
        t.titulo = n
    if datos.get("color") is not None:
        t.color = color_ok(datos["color"], t.color)
    if datos.get("orden") is not None:
        t.orden = float(datos["orden"])
    if datos.get("archivado") is not None:
        t.archivado = bool(datos["archivado"])
    nuevo = datos.get("curso_id")
    if nuevo is not None and int(nuevo) != t.curso_id:
        c = await _curso(org_id, int(nuevo), db)
        for x in await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id == t.id):
            x.etiquetas = _json(await _etiquetas_en(org_id, c.id, [int(i) for i in _lista(x.etiquetas) if str(i).isdigit()], db))
            db.add(x)
        t.curso_id = c.id
        t.orden = _orden_al_final(h.orden for h in await _todas(db, ProdTablero, ProdTablero.curso_id == c.id))
    t.updated_at = _ahora()
    db.add(t)
    await db.commit()
    return tablero_dict(t)


async def borrar_tablero(org_id: int, tablero_id: int, db: AsyncSession) -> None:
    t = await _tablero(org_id, tablero_id, db)
    await _borrar_tablero_entero(db, t)
    await db.commit()


async def duplicar_tablero(org_id: int, tablero_id: int, titulo: str, curso_id: Optional[int], con_tarjetas: bool, db: AsyncSession, autor: Any = None) -> dict:
    """Una copia del tablero: sus columnas y, si se pide, sus tarjetas con el
    título, la descripción, las etiquetas y los enlaces (sin fechas, personas,
    adjuntos ni comentarios: es para preparar otro módulo u otro nivel)."""
    t = await _tablero(org_id, tablero_id, db)
    destino = await _curso(org_id, int(curso_id or t.curso_id), db)
    nuevo = await crear_tablero(org_id, destino.id, titulo or f"{t.titulo} (copia)", t.color, db, columnas=[])
    columnas = sorted(await _todas(db, ProdColumna, ProdColumna.tablero_id == t.id), key=lambda c: (c.orden, c.id))
    mapa: dict[int, int] = {}
    for c in columnas:
        n = ProdColumna(org_id=org_id, tablero_id=nuevo["id"], titulo=c.titulo, orden=c.orden)
        db.add(n)
        await db.flush()
        mapa[c.id] = n.id
    if con_tarjetas:
        ahora = _ahora()
        for x in sorted(await _todas(db, ProdTarjeta, ProdTarjeta.tablero_id == t.id, ProdTarjeta.archivada == False), key=lambda x: (x.orden, x.id)):  # noqa: E712
            if x.columna_id not in mapa:
                continue
            db.add(
                ProdTarjeta(
                    org_id=org_id,
                    tablero_id=nuevo["id"],
                    columna_id=mapa[columnas[0].id] if columnas else mapa[x.columna_id],
                    titulo=x.titulo,
                    descripcion=x.descripcion,
                    orden=x.orden,
                    etiquetas=_json(await _etiquetas_en(org_id, destino.id, [int(i) for i in _lista(x.etiquetas) if str(i).isdigit()], db)),
                    enlaces=x.enlaces or "[]",
                    creado_por_id=int(getattr(autor, "id", 0) or 0),
                    creado_por=_nombre(autor) if autor else "",
                    created_at=ahora,
                    updated_at=ahora,
                )
            )
    await db.commit()
    return nuevo


# ── columnas ───────────────────────────────────────────────────────────────


async def crear_columna(org_id: int, tablero_id: int, titulo: str, db: AsyncSession) -> dict:
    t = await _tablero(org_id, tablero_id, db)
    titulo = (titulo or "").strip()[:80]
    if not titulo:
        raise ProduccionError("La columna necesita un nombre")
    c = ProdColumna(org_id=org_id, tablero_id=t.id, titulo=titulo, orden=_orden_al_final(x.orden for x in await _todas(db, ProdColumna, ProdColumna.tablero_id == t.id)))
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return columna_dict(c)


async def cambiar_columna(org_id: int, columna_id: int, datos: dict, db: AsyncSession) -> dict:
    c = await _columna(org_id, columna_id, db)
    if datos.get("titulo") is not None:
        n = str(datos["titulo"]).strip()[:80]
        if not n:
            raise ProduccionError("La columna necesita un nombre")
        c.titulo = n
    if datos.get("orden") is not None:
        c.orden = float(datos["orden"])
    db.add(c)
    await db.commit()
    return columna_dict(c)


async def borrar_columna(org_id: int, columna_id: int, db: AsyncSession) -> None:
    """Solo vacía: con tarjetas a la vista, primero hay que moverlas o
    archivarlas. Las archivadas pasan a otra columna del tablero."""
    c = await _columna(org_id, columna_id, db)
    suyas = await _todas(db, ProdTarjeta, ProdTarjeta.columna_id == c.id)
    if any(not t.archivada for t in suyas):
        raise ProduccionError("Esta columna aún tiene tarjetas: muévelas o archívalas antes de quitarla.", 409)
    otras = sorted((x for x in await _todas(db, ProdColumna, ProdColumna.tablero_id == c.tablero_id) if x.id != c.id), key=lambda x: (x.orden, x.id))
    if otras:
        for t in suyas:
            t.columna_id = otras[0].id
            db.add(t)
    else:
        await _borrar_tarjetas(db, suyas)
    await db.delete(c)
    await db.commit()


# ── tarjetas ───────────────────────────────────────────────────────────────


async def crear_tarjeta(org_id: int, tablero_id: int, columna_id: int, titulo: str, autor: Any, db: AsyncSession) -> dict:
    t = await _tablero(org_id, tablero_id, db)
    c = await _columna(org_id, columna_id, db)
    if c.tablero_id != t.id:
        raise ProduccionError("Esa columna no es de este tablero")
    titulo = (titulo or "").strip()[:300]
    if not titulo:
        raise ProduccionError("La tarjeta necesita un título")
    curso = await db.get(ProdCurso, t.curso_id)
    ahora = _ahora()
    x = ProdTarjeta(
        org_id=org_id,
        tablero_id=t.id,
        columna_id=c.id,
        titulo=titulo,
        descripcion=(curso.plantilla if curso else "") or "",
        orden=_orden_al_final(y.orden for y in await _todas(db, ProdTarjeta, ProdTarjeta.columna_id == c.id)),
        creado_por_id=int(getattr(autor, "id", 0) or 0),
        creado_por=_nombre(autor),
        actualizado_por=_nombre(autor),
        created_at=ahora,
        updated_at=ahora,
    )
    db.add(x)
    t.updated_at = ahora
    db.add(t)
    await db.commit()
    await db.refresh(x)
    return tarjeta_completa(x)


def asignados_ok(lista: Any, equipo: list[dict], antes: list[dict]) -> list[dict]:
    """Personas de una tarjeta (función pura, con test). Del equipo, por su id
    (con el nombre de ahora); las de fuera que ya estaban (importadas de
    Nextcloud, id 0), por su nombre, solo si siguen en la lista."""
    por_id = {int(m["id"]): m for m in equipo}
    fuera_antes = {(a.get("nombre") or "").strip().lower() for a in antes if not int(a.get("id") or 0)}
    salida: list[dict] = []
    vistos: set = set()
    for a in lista or []:
        if isinstance(a, (int, str)) and str(a).isdigit():
            a = {"id": int(a)}
        if not isinstance(a, dict):
            continue
        i = int(a.get("id") or 0)
        if i:
            if i in por_id and i not in vistos:
                salida.append({"id": i, "nombre": por_id[i]["nombre"]})
                vistos.add(i)
        else:
            n = (a.get("nombre") or "").strip()[:120]
            if n and n.lower() in fuera_antes and n.lower() not in vistos:
                salida.append({"id": 0, "nombre": n})
                vistos.add(n.lower())
    return salida[:20]


def enlaces_ok(lista: Any) -> list[dict]:
    salida = []
    for e in lista or []:
        if not isinstance(e, dict):
            continue
        url = url_ok(e.get("url"))
        if not url:
            continue
        salida.append({"id": str(e.get("id") or uuid.uuid4().hex[:10])[:20], "titulo": str(e.get("titulo") or "").strip()[:200], "url": url})
    return salida[:40]


async def cambiar_tarjeta(org_id: int, tarjeta_id: int, datos: dict, autor: Any, equipo: list[dict], db: AsyncSession) -> dict:
    x = await _tarjeta(org_id, tarjeta_id, db)
    t = await _tablero(org_id, x.tablero_id, db)
    if datos.get("titulo") is not None:
        n = str(datos["titulo"]).strip()[:300]
        if not n:
            raise ProduccionError("La tarjeta necesita un título")
        x.titulo = n
    if datos.get("descripcion") is not None:
        d = str(datos["descripcion"])
        if len(d) > MAX_DESCRIPCION:
            raise ProduccionError("La descripción es demasiado larga")
        x.descripcion = d
    if "vence" in datos and datos["vence"] is not None:
        x.vence = vence_ok(datos["vence"])
    if datos.get("hecha") is not None:
        x.hecha_at = (x.hecha_at or _ahora()) if datos["hecha"] else ""
    if datos.get("archivada") is not None:
        x.archivada = bool(datos["archivada"])
    if datos.get("enlaces") is not None:
        x.enlaces = _json(enlaces_ok(datos["enlaces"]))
    if datos.get("asignados") is not None:
        x.asignados = _json(asignados_ok(datos["asignados"], equipo, [a for a in _lista(x.asignados) if isinstance(a, dict)]))

    # Mover a otro tablero (y quizá a otro curso).
    nuevo_tablero = datos.get("tablero_id")
    if nuevo_tablero is not None and int(nuevo_tablero) != x.tablero_id:
        destino = await _tablero(org_id, int(nuevo_tablero), db)
        cols = sorted(await _todas(db, ProdColumna, ProdColumna.tablero_id == destino.id), key=lambda c: (c.orden, c.id))
        if not cols:
            raise ProduccionError("Ese tablero no tiene columnas")
        quiere = int(datos.get("columna_id") or 0)
        col = next((c for c in cols if c.id == quiere), cols[0])
        if destino.curso_id != t.curso_id:
            x.etiquetas = _json(await _etiquetas_en(org_id, destino.curso_id, [int(i) for i in _lista(x.etiquetas) if str(i).isdigit()], db))
        x.tablero_id = destino.id
        x.columna_id = col.id
        x.orden = _orden_al_final(y.orden for y in await _todas(db, ProdTarjeta, ProdTarjeta.columna_id == col.id))
        t = destino
    elif datos.get("columna_id") is not None and int(datos["columna_id"]) != x.columna_id:
        c = await _columna(org_id, int(datos["columna_id"]), db)
        if c.tablero_id != x.tablero_id:
            raise ProduccionError("Esa columna no es de este tablero")
        x.columna_id = c.id
    if datos.get("orden") is not None and nuevo_tablero is None:
        x.orden = float(datos["orden"])

    if datos.get("etiquetas") is not None:
        validas = {e.id for e in await _todas(db, ProdEtiqueta, ProdEtiqueta.curso_id == t.curso_id)}
        ids = []
        for i in datos["etiquetas"]:
            if str(i).isdigit() and int(i) in validas and int(i) not in ids:
                ids.append(int(i))
        x.etiquetas = _json(ids)

    ahora = _ahora()
    x.updated_at = ahora
    x.actualizado_por = _nombre(autor)
    t.updated_at = ahora
    db.add(x)
    db.add(t)
    await db.commit()
    return tarjeta_completa(x)


async def borrar_tarjeta(org_id: int, tarjeta_id: int, user_id: int, es_admin: bool, db: AsyncSession) -> None:
    x = await _tarjeta(org_id, tarjeta_id, db)
    if not es_admin and x.creado_por_id != user_id:
        raise ProduccionError("Esta tarjeta solo la puede borrar quien la creó o un administrador. Puedes archivarla.", 403)
    await _borrar_tarjetas(db, [x])
    await db.commit()


# ── adjuntos ───────────────────────────────────────────────────────────────


def _ruta_segura(relativa: str) -> Optional[Path]:
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith("privado/produccion/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


def _borrar_del_disco(relativa: str) -> None:
    ruta = _ruta_segura(relativa)
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


async def subir_adjunto(org_id: int, tarjeta_id: int, nombre: str, datos: bytes, autor: Any, db: AsyncSession) -> dict:
    x = await _tarjeta(org_id, tarjeta_id, db)
    ext = Path(nombre or "").suffix.lower()
    if ext not in EXTENSIONES:
        raise ProduccionError("Ese tipo de archivo no se admite (PDF, imágenes, documentos, presentaciones, audio, vídeo o zip)")
    if not datos:
        raise ProduccionError("El archivo está vacío")
    if len(datos) > MAX_ADJUNTO_BYTES:
        raise ProduccionError("El archivo pasa de 50 MB. Para algo más grande, pega su enlace (Drive, Bunny…).")
    ident = uuid.uuid4().hex
    relativa = f"privado/produccion/{org_id}/{ident}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    adj = [a for a in _lista(x.adjuntos) if isinstance(a, dict)]
    adj.append({"id": ident, "nombre": Path(nombre).name[:200], "ext": ext, "tamano": len(datos), "subido": _ahora(), "por": _nombre(autor), "ruta": relativa})
    x.adjuntos = _json(adj)
    x.updated_at = _ahora()
    x.actualizado_por = _nombre(autor)
    db.add(x)
    await db.commit()
    return tarjeta_completa(x)


async def adjunto(org_id: int, tarjeta_id: int, adjunto_id: str, db: AsyncSession) -> Optional[tuple[Path, str]]:
    x = await _tarjeta(org_id, tarjeta_id, db)
    for a in _lista(x.adjuntos):
        if isinstance(a, dict) and a.get("id") == adjunto_id:
            ruta = _ruta_segura(a.get("ruta", ""))
            if ruta and ruta.is_file():
                return ruta, a.get("nombre") or ruta.name
    return None


async def borrar_adjunto(org_id: int, tarjeta_id: int, adjunto_id: str, db: AsyncSession) -> dict:
    x = await _tarjeta(org_id, tarjeta_id, db)
    quedan = []
    for a in _lista(x.adjuntos):
        if isinstance(a, dict) and a.get("id") == adjunto_id:
            _borrar_del_disco(a.get("ruta", ""))
        elif isinstance(a, dict):
            quedan.append(a)
    x.adjuntos = _json(quedan)
    x.updated_at = _ahora()
    db.add(x)
    await db.commit()
    return tarjeta_completa(x)


# ── comentarios ────────────────────────────────────────────────────────────


async def _contar_comentarios(db: AsyncSession, x: ProdTarjeta) -> None:
    x.n_comentarios = len(await _todas(db, ProdComentario, ProdComentario.tarjeta_id == x.id))
    db.add(x)


async def comentar(org_id: int, tarjeta_id: int, texto: str, autor: Any, db: AsyncSession) -> dict:
    x = await _tarjeta(org_id, tarjeta_id, db)
    texto = (texto or "").strip()[:8000]
    if not texto:
        raise ProduccionError("Escribe algo")
    c = ProdComentario(org_id=org_id, tarjeta_id=x.id, user_id=int(getattr(autor, "id", 0) or 0), autor=_nombre(autor), texto=texto, created_at=_ahora())
    db.add(c)
    await db.flush()
    await _contar_comentarios(db, x)
    await db.commit()
    await db.refresh(c)
    return comentario_dict(c)


async def cambiar_comentario(org_id: int, comentario_id: int, texto: str, user_id: int, db: AsyncSession) -> dict:
    c = await db.get(ProdComentario, comentario_id)
    if c is None or c.org_id != org_id:
        raise ProduccionError("Ese comentario no existe", 404)
    if c.user_id != user_id:
        raise ProduccionError("Solo quien lo escribió puede cambiarlo", 403)
    texto = (texto or "").strip()[:8000]
    if not texto:
        raise ProduccionError("Escribe algo")
    c.texto = texto
    c.editado_at = _ahora()
    db.add(c)
    await db.commit()
    return comentario_dict(c)


async def borrar_comentario(org_id: int, comentario_id: int, user_id: int, es_admin: bool, db: AsyncSession) -> None:
    c = await db.get(ProdComentario, comentario_id)
    if c is None or c.org_id != org_id:
        raise ProduccionError("Ese comentario no existe", 404)
    if c.user_id != user_id and not es_admin:
        raise ProduccionError("Solo quien lo escribió o un administrador puede borrarlo", 403)
    x = await db.get(ProdTarjeta, c.tarjeta_id)
    await db.delete(c)
    await db.flush()
    if x is not None:
        await _contar_comentarios(db, x)
    await db.commit()


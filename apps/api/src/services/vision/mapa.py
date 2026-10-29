"""
El mapa de Visión: lienzos, tarjetas (nodos), flechas, submapas y archivos.

- Hay UN mapa de arriba del todo por escuela («Inicio», sin padre). Se crea
  la primera vez que se abre, con el negocio dividido en verticales
  (Marketing, Ventas, Formación, Equipo, Dinero, Legal) y una de Campañas,
  todas colgando de una tarjeta central. Se pueden cambiar o borrar.
- Cualquier vertical o campaña se "abre" como submapa: el lienzo de dentro se
  crea al abrirlo por primera vez y queda en `submapa_id`.
- Borrar una tarjeta borra también su submapa (con todo lo de dentro), sus
  flechas, sus archivos y, si es una campaña, sus datos y pagos. La pantalla
  avisa antes.
- Los archivos van a `content/privado/vision/<org>/` (dentro del volumen: entran
  en la copia diaria) y NUNCA se sirven por /content: se bajan solo por la
  ruta de Visión, que pide ser administrador. Mismo esquema que las facturas
  de la empresa (`services/stats/gastos.py`).
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.vision import VisionDato, VisionFlecha, VisionMapa, VisionNodo, VisionPago

TIPOS = {
    "vertical": "Vertical",
    "campana": "Campaña",
    "anuncio": "Anuncio / creativo",
    "contenido": "Contenido",
    "embudo": "Paso del embudo",
    "tarea": "Tarea",
    "nota": "Nota",
    "metrica": "Métrica",
    # 29/10 (el mapa de Black Friday): un correo de verdad de la campaña (se
    # previsualiza), una decisión de la persona («¿Compra?») y el rótulo de
    # una etapa del embudo.
    "correo": "Correo",
    "decision": "Decisión",
    "etapa": "Etapa",
}
ESTADOS = {
    "idea": "Idea",
    "pendiente": "Pendiente",
    "en-curso": "En curso",
    "hecho": "Hecho",
    "bloqueado": "Bloqueado",
}
#: Los que se pueden abrir como submapa.
CON_SUBMAPA = {"vertical", "campana"}

CONTENT_DIR = Path("content")
EXTENSIONES = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".svg",
    ".txt", ".md", ".csv", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".mp3", ".m4a", ".mp4", ".mov", ".zip",
}
MAX_ARCHIVO_BYTES = 25 * 1024 * 1024

# La primera vez: el negocio en verticales alrededor de una tarjeta central.
_SEMILLA = [
    ("vertical", "Marketing", -420, -220),
    ("vertical", "Ventas", 0, -300),
    ("vertical", "Formación", 420, -220),
    ("vertical", "Equipo", 460, 160),
    ("vertical", "Dinero", 0, 300),
    ("vertical", "Legal", -460, 160),
    ("vertical", "Campañas", -820, -40),
]


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def hoy_nl() -> str:
    """El día de hoy en Países Bajos ("AAAA-MM-DD")."""
    return datetime.now(ZoneInfo("Europe/Amsterdam")).date().isoformat()


def personas_de(texto) -> list[str]:
    """Los encargados de una tarjeta: «Rida, Laura» → ["Rida", "Laura"].

    Van en la columna `responsable` separados por comas (sin columna nueva).
    Sin repetidos (sin mirar mayúsculas) y cada nombre de 40 letras como mucho.
    """
    partes = texto if isinstance(texto, list) else re.split(r"[,;]", str(texto or ""))
    vistos: set[str] = set()
    salida: list[str] = []
    for p in partes:
        nombre = " ".join(str(p or "").split())[:40]
        if nombre and nombre.lower() not in vistos:
            vistos.add(nombre.lower())
            salida.append(nombre)
    return salida


def juntar_personas(nombres: list[str], largo: int = 120) -> str:
    """Al revés que `personas_de`, sin pasar del largo de la columna."""
    texto = ""
    for n in nombres:
        siguiente = f"{texto}, {n}" if texto else n
        if len(siguiente) > largo:
            break
        texto = siguiente
    return texto


def _lista(texto: str) -> list:
    try:
        v = json.loads(texto or "[]")
    except (TypeError, ValueError):
        return []
    return v if isinstance(v, list) else []


def _dict(texto: str) -> dict:
    try:
        v = json.loads(texto or "{}")
    except (TypeError, ValueError):
        return {}
    return v if isinstance(v, dict) else {}


def _fecha(texto) -> str:
    t = str(texto or "").strip()[:10]
    try:
        datetime.strptime(t, "%Y-%m-%d")
    except ValueError:
        return ""
    return t


def nodo_dict(n: VisionNodo) -> dict:
    checklist = _lista(n.checklist)
    return {
        "id": n.id,
        "mapa_id": n.mapa_id,
        "tipo": n.tipo,
        "titulo": n.titulo,
        "estado": n.estado,
        "urgente": bool(n.urgente),
        "importante": bool(n.importante),
        "etiquetas": [str(e) for e in _lista(n.etiquetas)],
        "responsable": n.responsable,
        "inicio": n.inicio,
        "fin": n.fin,
        "vence": n.vence,
        "x": n.x,
        "y": n.y,
        "color": n.color,
        "cuerpo": n.cuerpo or "",
        "enlaces": _lista(n.enlaces),
        "checklist": checklist,
        "hechas": sum(1 for c in checklist if isinstance(c, dict) and c.get("hecho")),
        "archivos": [{k: a.get(k) for k in ("id", "nombre", "ext", "tamano", "subido")} for a in _lista(n.archivos) if isinstance(a, dict)],
        "submapa_id": n.submapa_id,
        "utm_campaign": n.utm_campaign,
        "metrica": _dict(n.metrica),
        "updated_at": n.updated_at,
    }


def flecha_dict(f: VisionFlecha) -> dict:
    return {"id": f.id, "origen": f.origen, "destino": f.destino, "etiqueta": f.etiqueta}


async def _mapa(org_id: int, mapa_id: int, db: AsyncSession) -> Optional[VisionMapa]:
    return (await db.execute(select(VisionMapa).where(VisionMapa.id == mapa_id, VisionMapa.org_id == org_id))).scalars().first()


async def nodo(org_id: int, nodo_id: int, db: AsyncSession) -> Optional[VisionNodo]:
    return (await db.execute(select(VisionNodo).where(VisionNodo.id == nodo_id, VisionNodo.org_id == org_id))).scalars().first()


async def mapa_inicio(org_id: int, db: AsyncSession) -> VisionMapa:
    """El mapa de Inicio; si no existe, lo crea con las verticales."""
    m = (
        await db.execute(
            select(VisionMapa).where(VisionMapa.org_id == org_id, VisionMapa.nodo_padre_id == None).order_by(VisionMapa.id)  # noqa: E711
        )
    ).scalars().first()
    if m is not None:
        return m
    ahora = _ahora()
    m = VisionMapa(org_id=org_id, nombre="Inicio", created_at=ahora, updated_at=ahora)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    centro = VisionNodo(
        org_id=org_id, mapa_id=m.id, tipo="nota", titulo="Holandés Nawar", estado="en-curso",
        importante=True, x=0, y=0, created_at=ahora, updated_at=ahora,
    )
    db.add(centro)
    await db.commit()
    await db.refresh(centro)
    for tipo, titulo, x, y in _SEMILLA:
        n = VisionNodo(org_id=org_id, mapa_id=m.id, tipo=tipo, titulo=titulo, x=x, y=y, created_at=ahora, updated_at=ahora)
        db.add(n)
        await db.commit()
        await db.refresh(n)
        db.add(VisionFlecha(org_id=org_id, mapa_id=m.id, origen=centro.id, destino=n.id, created_at=ahora))
    await db.commit()
    return m


async def migas(org_id: int, m: VisionMapa, db: AsyncSession) -> list[dict]:
    """De Inicio al mapa abierto: [{mapa_id, nombre}]."""
    camino = [m]
    vistos = {m.id}
    actual = m
    while actual.nodo_padre_id:
        padre = await nodo(org_id, actual.nodo_padre_id, db)
        if padre is None:
            break
        arriba = await _mapa(org_id, padre.mapa_id, db)
        if arriba is None or arriba.id in vistos:
            break
        vistos.add(arriba.id)
        camino.append(arriba)
        actual = arriba
    camino.reverse()
    salida = []
    for i, mapa in enumerate(camino):
        nombre = mapa.nombre
        if mapa.nodo_padre_id:
            padre = await nodo(org_id, mapa.nodo_padre_id, db)
            nombre = padre.titulo if padre else nombre
        salida.append({"mapa_id": mapa.id, "nombre": nombre or ("Inicio" if i == 0 else "Mapa")})
    return salida


async def leer_mapa(org_id: int, mapa_id: Optional[int], db: AsyncSession) -> Optional[dict]:
    m = await mapa_inicio(org_id, db) if not mapa_id else await _mapa(org_id, mapa_id, db)
    if m is None:
        return None
    nodos = (await db.execute(select(VisionNodo).where(VisionNodo.mapa_id == m.id, VisionNodo.org_id == org_id))).scalars().all()
    flechas = (await db.execute(select(VisionFlecha).where(VisionFlecha.mapa_id == m.id, VisionFlecha.org_id == org_id))).scalars().all()
    padre = await nodo(org_id, m.nodo_padre_id, db) if m.nodo_padre_id else None
    return {
        "mapa": {"id": m.id, "nombre": padre.titulo if padre else (m.nombre or "Inicio"), "nodo_padre_id": m.nodo_padre_id, "vista": _dict(m.vista)},
        "nodos": [nodo_dict(n) for n in nodos],
        "flechas": [flecha_dict(f) for f in flechas],
        "migas": await migas(org_id, m, db),
    }


async def guardar_vista(org_id: int, mapa_id: int, vista: dict, db: AsyncSession) -> bool:
    m = await _mapa(org_id, mapa_id, db)
    if m is None:
        return False
    limpia = {k: float(vista.get(k) or 0) for k in ("x", "y", "zoom") if isinstance(vista.get(k), (int, float))}
    m.vista = json.dumps(limpia)
    m.updated_at = _ahora()
    db.add(m)
    await db.commit()
    return True


def _texto(v, largo: int) -> str:
    return str(v or "").strip()[:largo]


def _aplicar(n: VisionNodo, datos: dict) -> None:
    """Pone en el nodo los campos que vengan, ya limpios.

    Al pasar una tarjeta a «Hecho» sin fecha de fin, la fecha de fin es hoy:
    así la línea de tiempo de Visión la pone en la semana en que se terminó.
    """
    antes = n.estado
    if "tipo" in datos and datos["tipo"] in TIPOS:
        n.tipo = datos["tipo"]
    if "titulo" in datos:
        n.titulo = _texto(datos["titulo"], 200)
    if "estado" in datos and datos["estado"] in ESTADOS:
        n.estado = datos["estado"]
    for b in ("urgente", "importante"):
        if b in datos:
            setattr(n, b, bool(datos[b]))
    if "etiquetas" in datos and isinstance(datos["etiquetas"], list):
        n.etiquetas = json.dumps([_texto(e, 40) for e in datos["etiquetas"] if _texto(e, 40)][:20], ensure_ascii=False)
    if "responsable" in datos:
        n.responsable = juntar_personas(personas_de(datos["responsable"]))
    for f in ("inicio", "fin", "vence"):
        if f in datos:
            setattr(n, f, _fecha(datos[f]))
    if n.estado == "hecho" and antes != "hecho" and not n.fin and "fin" not in datos:
        n.fin = hoy_nl()
    for c in ("x", "y"):
        if c in datos and isinstance(datos[c], (int, float)):
            setattr(n, c, float(datos[c]))
    if "color" in datos:
        n.color = _texto(datos["color"], 20)
    if "cuerpo" in datos:
        cuerpo = datos["cuerpo"]
        texto = cuerpo if isinstance(cuerpo, str) else json.dumps(cuerpo or {}, ensure_ascii=False)
        n.cuerpo = texto[:200_000]
    if "enlaces" in datos and isinstance(datos["enlaces"], list):
        enlaces = []
        for e in datos["enlaces"][:50]:
            if not isinstance(e, dict):
                continue
            url = _texto(e.get("url"), 1000)
            if url and not url.lower().startswith(("http://", "https://", "mailto:", "/")):
                url = "https://" + url
            if url:
                enlaces.append({"titulo": _texto(e.get("titulo"), 200), "url": url})
        n.enlaces = json.dumps(enlaces, ensure_ascii=False)
    if "checklist" in datos and isinstance(datos["checklist"], list):
        n.checklist = json.dumps(
            [
                {"texto": _texto(c.get("texto"), 300), "hecho": bool(c.get("hecho"))}
                for c in datos["checklist"][:200]
                if isinstance(c, dict) and _texto(c.get("texto"), 300)
            ],
            ensure_ascii=False,
        )
    if "utm_campaign" in datos:
        n.utm_campaign = _texto(datos["utm_campaign"], 120).lower()
    if "metrica" in datos and isinstance(datos["metrica"], dict):
        m = datos["metrica"]
        limpio: dict = {"campana_id": int(m.get("campana_id") or 0), "clave": _texto(m.get("clave"), 40)}
        # De dónde sale la cifra («black-friday»: la campaña del ebook, en
        # vivo) y, en las tarjetas de correo, cuál de la campaña es.
        for extra in ("fuente", "correo"):
            if _texto(m.get(extra), 30):
                limpio[extra] = _texto(m.get(extra), 30)
        n.metrica = json.dumps(limpio)


async def crear_nodo(org_id: int, mapa_id: int, datos: dict, db: AsyncSession) -> Optional[dict]:
    if await _mapa(org_id, mapa_id, db) is None:
        return None
    ahora = _ahora()
    n = VisionNodo(org_id=org_id, mapa_id=mapa_id, created_at=ahora, updated_at=ahora)
    _aplicar(n, {"titulo": TIPOS.get(datos.get("tipo") or "nota", "Nota"), **datos})
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return nodo_dict(n)


async def cambiar_nodo(org_id: int, nodo_id: int, datos: dict, db: AsyncSession) -> Optional[dict]:
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return None
    _aplicar(n, datos)
    n.updated_at = _ahora()
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return nodo_dict(n)


async def mover_nodos(org_id: int, posiciones: list[dict], db: AsyncSession) -> int:
    """Guarda de golpe dónde está cada tarjeta (al soltar después de arrastrar)."""
    hechos = 0
    for p in posiciones[:500]:
        if not isinstance(p, dict):
            continue
        n = await nodo(org_id, int(p.get("id") or 0), db)
        if n is None or not isinstance(p.get("x"), (int, float)) or not isinstance(p.get("y"), (int, float)):
            continue
        n.x, n.y = float(p["x"]), float(p["y"])
        db.add(n)
        hechos += 1
    await db.commit()
    return hechos


async def abrir_submapa(org_id: int, nodo_id: int, db: AsyncSession) -> Optional[int]:
    """El lienzo de dentro de una vertical o campaña; si no existe, se crea."""
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return None
    if n.submapa_id and await _mapa(org_id, n.submapa_id, db) is not None:
        return n.submapa_id
    ahora = _ahora()
    m = VisionMapa(org_id=org_id, nombre=n.titulo, nodo_padre_id=n.id, created_at=ahora, updated_at=ahora)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    n.submapa_id = m.id
    if n.tipo not in CON_SUBMAPA:
        n.tipo = "vertical"
    db.add(n)
    await db.commit()
    return m.id


async def _borrar_mapa_entero(org_id: int, mapa_id: int, db: AsyncSession, vistos: set[int]) -> None:
    if mapa_id in vistos:
        return
    vistos.add(mapa_id)
    for n in (await db.execute(select(VisionNodo).where(VisionNodo.mapa_id == mapa_id, VisionNodo.org_id == org_id))).scalars().all():
        await _borrar_nodo(org_id, n, db, vistos)
    m = await _mapa(org_id, mapa_id, db)
    if m is not None:
        await db.delete(m)


async def _borrar_nodo(org_id: int, n: VisionNodo, db: AsyncSession, vistos: set[int]) -> None:
    if n.submapa_id:
        await _borrar_mapa_entero(org_id, n.submapa_id, db, vistos)
    for f in (
        await db.execute(
            select(VisionFlecha).where(VisionFlecha.org_id == org_id, (VisionFlecha.origen == n.id) | (VisionFlecha.destino == n.id))
        )
    ).scalars().all():
        await db.delete(f)
    for d in (await db.execute(select(VisionDato).where(VisionDato.nodo_id == n.id, VisionDato.org_id == org_id))).scalars().all():
        await db.delete(d)
    for p in (await db.execute(select(VisionPago).where(VisionPago.nodo_id == n.id, VisionPago.org_id == org_id))).scalars().all():
        await db.delete(p)
    for a in _lista(n.archivos):
        if isinstance(a, dict):
            _borrar_del_disco(a.get("ruta", ""))
    await db.delete(n)


async def borrar_nodo(org_id: int, nodo_id: int, db: AsyncSession) -> bool:
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return False
    await _borrar_nodo(org_id, n, db, set())
    await db.commit()
    return True


async def crear_flecha(org_id: int, mapa_id: int, origen: int, destino: int, db: AsyncSession) -> Optional[dict]:
    if origen == destino:
        return None
    a, b = await nodo(org_id, origen, db), await nodo(org_id, destino, db)
    if a is None or b is None or a.mapa_id != mapa_id or b.mapa_id != mapa_id:
        return None
    ya = (
        await db.execute(
            select(VisionFlecha).where(VisionFlecha.mapa_id == mapa_id, VisionFlecha.origen == origen, VisionFlecha.destino == destino)
        )
    ).scalars().first()
    if ya is not None:
        return flecha_dict(ya)
    f = VisionFlecha(org_id=org_id, mapa_id=mapa_id, origen=origen, destino=destino, created_at=_ahora())
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return flecha_dict(f)


async def cambiar_flecha(org_id: int, flecha_id: int, etiqueta: str, db: AsyncSession) -> Optional[dict]:
    f = (await db.execute(select(VisionFlecha).where(VisionFlecha.id == flecha_id, VisionFlecha.org_id == org_id))).scalars().first()
    if f is None:
        return None
    f.etiqueta = _texto(etiqueta, 120)
    db.add(f)
    await db.commit()
    return flecha_dict(f)


async def borrar_flecha(org_id: int, flecha_id: int, db: AsyncSession) -> bool:
    f = (await db.execute(select(VisionFlecha).where(VisionFlecha.id == flecha_id, VisionFlecha.org_id == org_id))).scalars().first()
    if f is None:
        return False
    await db.delete(f)
    await db.commit()
    return True


async def urgentes(org_id: int, db: AsyncSession) -> list[dict]:
    """Todo lo marcado urgente y sin hacer, de todos los mapas, con dónde está."""
    nodos = (
        await db.execute(select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.urgente == True))  # noqa: E712
    ).scalars().all()
    salida = []
    for n in nodos:
        if n.estado == "hecho":
            continue
        m = await _mapa(org_id, n.mapa_id, db)
        d = nodo_dict(n)
        d["ruta"] = " › ".join(c["nombre"] for c in await migas(org_id, m, db)) if m else ""
        salida.append(d)
    salida.sort(key=lambda d: (not d["importante"], d["vence"] or "9999", d["titulo"].lower()))
    return salida


# ── archivos ────────────────────────────────────────────────────────────────


def _ruta_segura(relativa: str) -> Optional[Path]:
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith("privado/vision/"):
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


async def subir_archivo(org_id: int, nodo_id: int, nombre: str, datos: bytes, db: AsyncSession) -> dict:
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return {"ok": False, "motivo": "No existe esa tarjeta"}
    ext = Path(nombre or "").suffix.lower()
    if ext not in EXTENSIONES:
        return {"ok": False, "motivo": "Ese tipo de archivo no se admite (PDF, imágenes, documentos, audio, vídeo o zip)"}
    if not datos:
        return {"ok": False, "motivo": "El archivo está vacío"}
    if len(datos) > MAX_ARCHIVO_BYTES:
        return {"ok": False, "motivo": "El archivo pasa de 25 MB"}
    ident = uuid.uuid4().hex
    relativa = f"privado/vision/{org_id}/{ident}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    archivos = [a for a in _lista(n.archivos) if isinstance(a, dict)]
    archivos.append({"id": ident, "nombre": Path(nombre).name[:200], "ext": ext, "tamano": len(datos), "subido": _ahora(), "ruta": relativa})
    n.archivos = json.dumps(archivos, ensure_ascii=False)
    n.updated_at = _ahora()
    db.add(n)
    await db.commit()
    return {"ok": True, "nodo": nodo_dict(n)}


async def archivo(org_id: int, nodo_id: int, archivo_id: str, db: AsyncSession) -> Optional[tuple[Path, str]]:
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return None
    for a in _lista(n.archivos):
        if isinstance(a, dict) and a.get("id") == archivo_id:
            ruta = _ruta_segura(a.get("ruta", ""))
            if ruta and ruta.is_file():
                return ruta, a.get("nombre") or ruta.name
    return None


async def borrar_archivo(org_id: int, nodo_id: int, archivo_id: str, db: AsyncSession) -> Optional[dict]:
    n = await nodo(org_id, nodo_id, db)
    if n is None:
        return None
    quedan = []
    for a in _lista(n.archivos):
        if isinstance(a, dict) and a.get("id") == archivo_id:
            _borrar_del_disco(a.get("ruta", ""))
        elif isinstance(a, dict):
            quedan.append(a)
    n.archivos = json.dumps(quedan, ensure_ascii=False)
    n.updated_at = _ahora()
    db.add(n)
    await db.commit()
    return nodo_dict(n)

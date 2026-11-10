"""
El Estudio (10/11/2026): la pizarra del negocio y el banco de ideas.

Pedido del usuario: "algo que marque la diferencia en los procesos y
operaciones… un área para contenido con generador de ideas (alcance,
comunidad, ventas), reels y carruseles, y cuando se hizo se marca: se subió a
Instagram, check; TikTok, check; blog, check… tener todo en un sitio, que el
equipo de ventas pueda dejar cosas guardadas ahí, lo que falta en la
formación, planes para la siguiente, mi pizarra para escribir fácil; el mapa
mental da pereza".

Qué es:

- **La pizarra**: notas apuntadas deprisa (una línea e Intro), cada una en su
  ÁREA (contenido, clases, lo que falta en la formación, la próxima formación,
  ventas, comunidad, producto y procesos, otros). Se fijan arriba, se marcan
  hechas y una nota se puede convertir en idea de contenido.
- **Las ideas**: piezas de contenido (reel, carrusel, artículo…) con su
  OBJETIVO (alcance, comunidad o ventas), su guion y los sitios donde ya se
  publicó (`canales`: {"instagram": "2026-11-10"}). Se pueden pegar varias de
  golpe (una por línea): es lo que devuelve Claude con el prompt del Estudio.
- Los PROMPTS no se guardan aquí: los arma la pantalla
  (`apps/web/lib/nawar/estudioPrompts.ts`). Sin clave de IA en la escuela, a
  propósito (usuario: "por ahora sin clave").

Quién:

- Los administradores lo ven y lo cambian todo.
- El closer (quien pasa la puerta de contactos sin ser administrador) ve y
  escribe SOLO en el área de ventas, y cambia o borra solo lo suyo.

No es Visión (el mapa y su tablero, que son del trabajo con fechas y
encargados) ni las tareas del panel (ventas, con persona): aquí se apunta y se
guardan ideas. Si una nota pasa a ser trabajo de verdad, se lleva a Visión a
mano.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.estudio import EstudioItem

AREAS = [
    {"id": "contenido", "nombre": "Contenido"},
    {"id": "clases", "nombre": "Clases"},
    {"id": "formacion", "nombre": "Lo que falta en la formación"},
    {"id": "proxima", "nombre": "Próxima formación"},
    {"id": "ventas", "nombre": "Ventas"},
    {"id": "comunidad", "nombre": "Comunidad"},
    {"id": "producto", "nombre": "Producto y procesos"},
    {"id": "otros", "nombre": "Otros"},
]
_AREAS = {a["id"] for a in AREAS}
AREA_DEL_CLOSER = "ventas"

FORMATOS = [
    {"id": "reel", "nombre": "Reel"},
    {"id": "carrusel", "nombre": "Carrusel"},
    {"id": "historia", "nombre": "Historia"},
    {"id": "tiktok", "nombre": "TikTok"},
    {"id": "blog", "nombre": "Artículo del blog"},
    {"id": "youtube", "nombre": "YouTube"},
    {"id": "comunidad", "nombre": "Publicación en la comunidad"},
    {"id": "correo", "nombre": "Correo"},
    {"id": "otro", "nombre": "Otro"},
]
_FORMATOS = {f["id"] for f in FORMATOS}

OBJETIVOS = [
    {"id": "alcance", "nombre": "Alcance"},
    {"id": "comunidad", "nombre": "Comunidad"},
    {"id": "ventas", "nombre": "Ventas"},
]
_OBJETIVOS = {o["id"] for o in OBJETIVOS}

#: Dónde se puede marcar una idea como publicada.
CANALES = [
    {"id": "instagram", "nombre": "Instagram"},
    {"id": "tiktok", "nombre": "TikTok"},
    {"id": "youtube", "nombre": "YouTube"},
    {"id": "blog", "nombre": "Blog"},
    {"id": "comunidad", "nombre": "Comunidad"},
]
_CANALES = {c["id"] for c in CANALES}

ESTADOS = ["idea", "en-curso", "hecho"]
TIPOS = {"nota", "idea"}
#: Cuántas ideas se pueden pegar de una vez.
TOPE_DE_GOLPE = 60


class EstudioError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fecha(texto) -> str:
    texto = str(texto or "").strip()
    if not texto:
        return ""
    try:
        return date.fromisoformat(texto[:10]).isoformat()
    except ValueError:
        return ""


def nombre_de(u) -> str:
    n = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
    return n or getattr(u, "username", "") or "Equipo"


def leer_canales(texto: str) -> dict[str, str]:
    """{"instagram": "2026-11-10"}: solo canales que existen y con su día. Pura."""
    try:
        d = json.loads(texto or "{}")
    except (ValueError, TypeError):
        return {}
    if not isinstance(d, dict):
        return {}
    return {k: _fecha(v) or "" for k, v in d.items() if k in _CANALES and v}


def marcar_canales(antes: dict[str, str], pedido: dict, hoy: str) -> dict[str, str]:
    """Aplica lo que se marca y se desmarca: True (o una fecha) = publicado ese
    día (hoy si no se dice); False o vacío = se quita. Lo demás se queda. Pura."""
    salida = dict(antes)
    for canal, valor in (pedido or {}).items():
        if canal not in _CANALES:
            continue
        if not valor:
            salida.pop(canal, None)
        else:
            salida[canal] = (_fecha(valor) if isinstance(valor, str) else "") or salida.get(canal) or hoy
    return salida


def partir_lineas(texto: str) -> list[str]:
    """Las ideas pegadas de golpe: una por línea, sin el número ni la viñeta de
    delante («1. », «- », «• », «**…**»). Líneas vacías y repetidas, fuera. Pura."""
    import re

    vistas: set[str] = set()
    salida: list[str] = []
    for linea in str(texto or "").splitlines():
        limpia = re.sub(r"^\s*(?:[-•*·]+|\d+[.)])\s*", "", linea).strip()
        limpia = re.sub(r"^\*\*(.+?)\*\*", r"\1", limpia).strip()
        if len(limpia) < 3:
            continue
        clave = limpia.lower()
        if clave in vistas:
            continue
        vistas.add(clave)
        salida.append(limpia[:300])
    return salida[:TOPE_DE_GOLPE]


#: Cómo empieza una línea pegada según su formato («Reel · …», «Carrusel: …»).
_PALABRA_DE_FORMATO = {
    "reel": "reel",
    "reels": "reel",
    "carrusel": "carrusel",
    "carousel": "carrusel",
    "historia": "historia",
    "story": "historia",
    "tiktok": "tiktok",
    "blog": "blog",
    "artículo": "blog",
    "articulo": "blog",
    "youtube": "youtube",
    "vídeo": "youtube",
    "correo": "correo",
    "email": "correo",
}


def formato_de_linea(linea: str) -> str:
    """El formato que dice la propia línea al empezar («Reel · «…»» → reel).
    Vacío si no lo dice. Pura."""
    import re

    m = re.match(r"\s*([A-Za-zÁÉÍÓÚáéíóúñ]+)\s*[·:\-–—|]", linea or "")
    return _PALABRA_DE_FORMATO.get(m.group(1).lower(), "") if m else ""


def item_dict(i: EstudioItem) -> dict:
    return {
        "id": i.id,
        "tipo": i.tipo,
        "area": i.area,
        "titulo": i.titulo,
        "texto": i.texto or "",
        "formato": i.formato,
        "objetivo": i.objetivo,
        "estado": i.estado,
        "canales": leer_canales(i.canales),
        "fijada": bool(i.fijada),
        "fecha": i.fecha,
        "autor_id": i.autor_id,
        "autor": i.autor,
        "created_at": i.created_at,
        "updated_at": i.updated_at,
    }


def puede_ver(item: dict, admin: bool) -> bool:
    return admin or item.get("area") == AREA_DEL_CLOSER


def puede_cambiar(item: dict, admin: bool, user_id: int) -> bool:
    return admin or (item.get("area") == AREA_DEL_CLOSER and item.get("autor_id") == user_id)


def _aplicar(i: EstudioItem, datos: dict, admin: bool) -> None:
    if "titulo" in datos and datos["titulo"] is not None:
        titulo = str(datos["titulo"]).strip()
        if not titulo:
            raise EstudioError("Escribe algo")
        i.titulo = titulo[:300]
    if "texto" in datos and datos["texto"] is not None:
        i.texto = str(datos["texto"])[:20000]
    if "tipo" in datos and datos["tipo"] in TIPOS:
        i.tipo = datos["tipo"]
    if "area" in datos and datos["area"] is not None:
        # El closer escribe siempre en ventas.
        i.area = (datos["area"] if datos["area"] in _AREAS else "otros") if admin else AREA_DEL_CLOSER
    if "formato" in datos and datos["formato"] is not None:
        i.formato = datos["formato"] if datos["formato"] in _FORMATOS else ""
    if "objetivo" in datos and datos["objetivo"] is not None:
        i.objetivo = datos["objetivo"] if datos["objetivo"] in _OBJETIVOS else ""
    if "estado" in datos and datos["estado"] in ESTADOS:
        i.estado = datos["estado"]
    if "fijada" in datos and datos["fijada"] is not None:
        i.fijada = bool(datos["fijada"])
    if "fecha" in datos and datos["fecha"] is not None:
        i.fecha = _fecha(datos["fecha"])
    if isinstance(datos.get("canales"), dict):
        i.canales = json.dumps(marcar_canales(leer_canales(i.canales), datos["canales"], date.today().isoformat()))


async def listar(org_id: int, admin: bool, db: AsyncSession) -> list[dict]:
    filas = (
        await db.execute(select(EstudioItem).where(EstudioItem.org_id == org_id).order_by(EstudioItem.created_at.desc()))  # type: ignore[attr-defined]
    ).scalars().all()
    return [d for d in (item_dict(f) for f in filas) if puede_ver(d, admin)]


async def crear(org_id: int, datos: dict, autor, admin: bool, db: AsyncSession) -> dict:
    if not str(datos.get("titulo") or "").strip():
        raise EstudioError("Escribe algo")
    i = EstudioItem(org_id=org_id, autor_id=int(getattr(autor, "id", 0) or 0), autor=nombre_de(autor)[:120])
    i.created_at = i.updated_at = _ahora()
    i.area = AREA_DEL_CLOSER if not admin else "otros"
    _aplicar(i, {"tipo": "nota", **datos}, admin)
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return item_dict(i)


async def crear_varias(org_id: int, texto: str, datos: dict, autor, admin: bool, db: AsyncSession) -> list[dict]:
    """Varias ideas de golpe, una por línea: lo que devuelve Claude con el
    prompt del Estudio. Todas con el mismo formato, objetivo y área."""
    lineas = partir_lineas(texto)
    if not lineas:
        raise EstudioError("Pega al menos una idea, una por línea")
    creadas = []
    ahora = datetime.now(timezone.utc)
    # La primera línea pegada tiene que quedar arriba: se crean al revés.
    for n, linea in enumerate(reversed(lineas)):
        i = EstudioItem(org_id=org_id, autor_id=int(getattr(autor, "id", 0) or 0), autor=nombre_de(autor)[:120])
        i.created_at = i.updated_at = (ahora + timedelta(microseconds=n)).isoformat()
        i.area = AREA_DEL_CLOSER if not admin else "contenido"
        _aplicar(i, {**datos, "tipo": "idea", "titulo": linea, "estado": "idea"}, admin)
        # Una tanda mezclada (reels y carruseles): cada línea dice el suyo.
        if not i.formato:
            i.formato = formato_de_linea(linea)
        db.add(i)
        creadas.append(i)
    await db.commit()
    for i in creadas:
        await db.refresh(i)
    return [item_dict(i) for i in reversed(creadas)]


async def _el_item(org_id: int, item_id: int, db: AsyncSession) -> EstudioItem:
    i = (await db.execute(select(EstudioItem).where(EstudioItem.id == item_id, EstudioItem.org_id == org_id))).scalars().first()
    if i is None:
        raise EstudioError("Eso ya no está", 404)
    return i


async def cambiar(org_id: int, item_id: int, datos: dict, user_id: int, admin: bool, db: AsyncSession) -> dict:
    i = await _el_item(org_id, item_id, db)
    if not puede_cambiar(item_dict(i), admin, user_id):
        raise EstudioError("Solo puedes cambiar lo que apuntaste tú", 403)
    _aplicar(i, datos, admin)
    i.updated_at = _ahora()
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return item_dict(i)


async def borrar(org_id: int, item_id: int, user_id: int, admin: bool, db: AsyncSession) -> None:
    i = await _el_item(org_id, item_id, db)
    if not puede_cambiar(item_dict(i), admin, user_id):
        raise EstudioError("Solo puedes borrar lo que apuntaste tú", 403)
    await db.delete(i)
    await db.commit()


def catalogo(admin: bool) -> dict:
    """Las listas que pinta la pantalla. Al closer, solo su área."""
    return {
        "areas": AREAS if admin else [a for a in AREAS if a["id"] == AREA_DEL_CLOSER],
        "formatos": FORMATOS,
        "objetivos": OBJETIVOS,
        "canales": CANALES,
        "estados": ESTADOS,
    }

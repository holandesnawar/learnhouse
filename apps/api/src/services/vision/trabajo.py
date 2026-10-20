"""
El tablero y las semanas de Visión (20/10/2026): las MISMAS tarjetas del mapa,
vistas como lista de trabajo. Pedido del usuario: el mapa "es un coñazo de
llevar al día"; quería columnas tipo kanban, encargados escribiendo su nombre
y una línea de tiempo por semanas "para ver qué voy haciendo y qué tengo
pendiente".

- No hay tabla nueva: una tarjeta del tablero ES una tarjeta del mapa
  (`vision_node`). Moverla de columna cambia su `estado`; lo de dentro se edita
  en la misma página de siempre (PaginaNodo).
- Qué sale (`es_de_trabajo`): tareas, campañas, anuncios, contenidos y pasos del
  embudo, siempre. Las notas solo si alguien se encarga, tienen fecha o se les
  puso un estado que dice algo (idea, bloqueado, hecho): una nota suelta del
  mapa ("por decidir…", la tarjeta central) no es trabajo. Verticales y
  métricas, nunca.
- El ÁREA de una tarjeta es la tarjeta del mapa de Inicio de la que cuelga su
  mapa (Marketing, Ventas…). Lo que está en el propio Inicio va sin área.
- Los encargados van en `responsable` separados por comas (`personas_de`).
- Crear desde el tablero (`crear_tarea`): va al mapa de dentro de su área (se
  crea si no existía), debajo de lo que ya haya, para no taparlo.
"""

from __future__ import annotations

from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.vision import VisionMapa, VisionNodo
from src.services.vision.mapa import (
    CON_SUBMAPA,
    ESTADOS,
    abrir_submapa,
    crear_nodo,
    hoy_nl,
    mapa_inicio,
    nodo,
    nodo_dict,
    personas_de,
)

#: Siempre en el tablero.
TIPOS_DE_TRABAJO = {"tarea", "campana", "anuncio", "contenido", "embudo"}
#: Tipos que se pueden crear desde el tablero.
TIPOS_NUEVOS = {"tarea", "contenido", "anuncio", "embudo", "nota"}


def es_de_trabajo(n: dict) -> bool:
    """Si una tarjeta del mapa sale en el tablero."""
    if n.get("tipo") in TIPOS_DE_TRABAJO:
        return True
    if n.get("tipo") != "nota":
        return False
    return bool(
        (n.get("responsable") or "").strip()
        or n.get("inicio")
        or n.get("fin")
        or n.get("vence")
        or n.get("estado") in {"idea", "bloqueado", "hecho"}
    )


def areas_de_los_mapas(mapas: list[dict], nodos: list[dict], inicio_id: int) -> dict[int, dict]:
    """Para cada mapa, de qué área es y su camino: {mapa_id: {area_id, area, ruta}}.

    `mapas`: [{id, nodo_padre_id}]; `nodos`: [{id, mapa_id, titulo}]. Pura.
    """
    por_id = {n["id"]: n for n in nodos}
    padre_de = {m["id"]: m.get("nodo_padre_id") for m in mapas}
    salida: dict[int, dict] = {}
    for m in mapas:
        camino: list[dict] = []
        actual = m["id"]
        vistos: set[int] = set()
        while actual and actual != inicio_id and actual not in vistos:
            vistos.add(actual)
            padre = por_id.get(padre_de.get(actual) or 0)
            if padre is None:
                break
            camino.append(padre)
            actual = padre["mapa_id"]
        camino.reverse()
        if actual == inicio_id and camino:
            salida[m["id"]] = {
                "area_id": camino[0]["id"],
                "area": camino[0]["titulo"],
                "ruta": " › ".join(c["titulo"] for c in camino),
            }
        else:
            salida[m["id"]] = {"area_id": None, "area": "", "ruta": ""}
    return salida


def _sin_cuerpo(d: dict) -> dict:
    d = dict(d)
    d.pop("cuerpo", None)
    return d


async def listar(org_id: int, db: AsyncSession, equipo: Optional[list[str]] = None) -> dict:
    """Todas las tarjetas de trabajo de todos los mapas, con su área.

    `equipo`: nombres del equipo del panel, para proponerlos como encargados.
    """
    inicio = await mapa_inicio(org_id, db)
    mapas = (await db.execute(select(VisionMapa).where(VisionMapa.org_id == org_id))).scalars().all()
    filas = (await db.execute(select(VisionNodo).where(VisionNodo.org_id == org_id))).scalars().all()
    nodos = [nodo_dict(n) for n in filas]
    areas = areas_de_los_mapas(
        [{"id": m.id, "nodo_padre_id": m.nodo_padre_id} for m in mapas],
        [{"id": n["id"], "mapa_id": n["mapa_id"], "titulo": n["titulo"]} for n in nodos],
        inicio.id,
    )
    tarjetas = []
    personas: dict[str, str] = {}
    for n in nodos:
        if not es_de_trabajo(n):
            continue
        d = _sin_cuerpo(n)
        d.update(areas.get(n["mapa_id"]) or {"area_id": None, "area": "", "ruta": ""})
        d["personas"] = personas_de(n["responsable"])
        for p in d["personas"]:
            personas.setdefault(p.lower(), p)
        tarjetas.append(d)
    for p in equipo or []:
        personas.setdefault(p.lower(), p)
    # Las áreas para elegir: lo que cuelga del mapa de Inicio y puede tener mapa dentro.
    elegibles = [
        {"id": n["id"], "titulo": n["titulo"]}
        for n in nodos
        if n["mapa_id"] == inicio.id and (n["tipo"] in CON_SUBMAPA or n["submapa_id"])
    ]
    elegibles.sort(key=lambda a: a["titulo"].lower())
    return {
        "tarjetas": tarjetas,
        "areas": elegibles,
        "personas": sorted(personas.values(), key=str.lower),
        "inicio_id": inicio.id,
        "hoy": hoy_nl(),
    }


def sitio_debajo(posiciones: list[tuple[float, float]]) -> tuple[float, float]:
    """Dónde poner una tarjeta nueva en un mapa: debajo de todo, a la izquierda."""
    if not posiciones:
        return 0.0, 0.0
    return min(x for x, _ in posiciones), max(y for _, y in posiciones) + 140


async def crear_tarea(org_id: int, datos: dict, db: AsyncSession) -> Optional[dict]:
    """Una tarjeta nueva desde el tablero, en el mapa de dentro de su área."""
    titulo = str(datos.get("titulo") or "").strip()
    if not titulo:
        return None
    area_id = int(datos.get("area_id") or 0)
    inicio = await mapa_inicio(org_id, db)
    mapa_id = inicio.id
    area = await nodo(org_id, area_id, db) if area_id else None
    if area is not None and area.tipo in CON_SUBMAPA:
        mapa_id = await abrir_submapa(org_id, area.id, db) or inicio.id
    posiciones = [
        (n.x, n.y)
        for n in (await db.execute(select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.mapa_id == mapa_id))).scalars().all()
    ]
    x, y = sitio_debajo(posiciones)
    tipo = datos.get("tipo") if datos.get("tipo") in TIPOS_NUEVOS else "tarea"
    campos = {"tipo": tipo, "titulo": titulo, "x": x, "y": y}
    if datos.get("estado") in ESTADOS:
        campos["estado"] = datos["estado"]
    for c in ("responsable", "vence", "inicio", "fin"):
        if datos.get(c):
            campos[c] = datos[c]
    if "urgente" in datos:
        campos["urgente"] = bool(datos["urgente"])
    return await crear_nodo(org_id, mapa_id, campos, db)

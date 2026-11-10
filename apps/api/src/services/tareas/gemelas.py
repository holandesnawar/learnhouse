"""
La misma semana en los dos grupos (10/11/2026).

Pedido: "en clase semanal, al crear una semana se crea un capítulo por curso y
veo dos «Mijn huis» idénticos". Cada grupo (Groep rood, Groep blauw) es un
curso, y cada semana existe dos veces: una por grupo, con su día, su
grabación, sus entregas y su lista. Eso tiene que seguir así (son alumnos
distintos). Lo que NO tiene sentido es prepararla dos veces.

Aquí: la semana **gemela** de una semana es la de una clase hermana (otra
clase en directo con el mismo nombre) con el mismo tema, a 6 días o menos; si
ninguna tiene el mismo tema, la única de la misma semana del calendario.
`igualar` copia a la gemela lo que es de la CLASE y no del grupo: el tema, la
tarea (enunciado y, corrido los mismos días, su plazo), las notas para el
profe y la presentación completa (los mismos archivos: no se duplican en
disco). Se queda como estaba lo que es de cada grupo: el día, quién la da, el
mensaje al profe, la pizarra, la grabación, la lista y las entregas.

La pantalla lo ofrece como una casilla al guardar («Cambiar también en Groep
blauw»): se edita UNA vez.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Iterable, Optional

from src.services.tareas import material_profe as MP
from src.services.tareas.tareas import mismo_tema


def _dias(a: str, b: str) -> Optional[int]:
    try:
        return (date.fromisoformat(b) - date.fromisoformat(a)).days
    except (ValueError, TypeError):
        return None


def _lunes(dia: str) -> str:
    try:
        d = date.fromisoformat(dia)
    except (ValueError, TypeError):
        return ""
    return (d - timedelta(days=d.weekday())).isoformat()


def elegir_gemela(semana: dict, candidatas: Iterable[dict]) -> Optional[dict]:
    """De las semanas de las clases hermanas (`id`, `tema`, `fecha`), la gemela."""
    cerca = [c for c in candidatas if (d := _dias(semana.get("fecha", ""), c.get("fecha", ""))) is not None and abs(d) <= 6]
    con_tema = [c for c in cerca if (semana.get("tema") or "").strip() and mismo_tema(semana.get("tema"), c.get("tema"))]
    if con_tema:
        return min(con_tema, key=lambda c: abs(_dias(semana["fecha"], c["fecha"]) or 0))
    misma = [c for c in cerca if _lunes(c.get("fecha", "")) and _lunes(c.get("fecha", "")) == _lunes(semana.get("fecha", ""))]
    return misma[0] if len(misma) == 1 else None


def plazo_corrido(fecha_origen: str, limite_origen: str, fecha_destino: str) -> str:
    """El plazo de la tarea en el otro grupo: los mismos días después de SU clase."""
    if not limite_origen:
        return ""
    d = _dias(fecha_origen, limite_origen)
    try:
        return (date.fromisoformat(fecha_destino) + timedelta(days=d)).isoformat() if d is not None else ""
    except (ValueError, TypeError):
        return ""


def material_igualado(origen: str, destino: str) -> str:
    """El material del otro grupo con las notas y la presentación completa de
    este, sin tocar lo que es suyo (quién la da, el mensaje, su pizarra)."""
    o = MP.leer(origen)
    d = MP.leer(destino)
    nuevo = {**d, "notas": o["notas"], "archivos": [dict(a) for a in o["archivos"]]}
    return json.dumps(nuevo, ensure_ascii=False)


def igualar(origen, destino, ahora: str) -> list[str]:
    """Copia a `destino` (la gemela) lo que es de la clase. Devuelve qué cambió."""
    cambios: list[str] = []
    if (destino.tema or "") != (origen.tema or ""):
        destino.tema = origen.tema
        cambios.append("tema")
    if (destino.enunciado or "") != (origen.enunciado or ""):
        destino.enunciado = origen.enunciado
        cambios.append("tarea")
    plazo = plazo_corrido(origen.fecha, origen.fecha_limite, destino.fecha)
    if (destino.fecha_limite or "") != plazo:
        destino.fecha_limite = plazo
        cambios.append("plazo")
    material = material_igualado(origen.material_profe, destino.material_profe)
    if json.loads(material) != MP.leer(destino.material_profe):
        destino.material_profe = material
        cambios.append("material")
    if cambios:
        destino.updated_at = ahora
    return cambios

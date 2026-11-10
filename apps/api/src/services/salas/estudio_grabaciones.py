"""
Las grabaciones de la sala: aparecen solas, se recortan y se publican con un
botón (10/11/2026).

Pedido del usuario: "las grabaciones de Daily que entren automáticamente en la
escuela, con una línea de tiempo con zoom para cortar partes y un botón de
publicar". Hasta ahora las grabaciones se quedaban en Daily y el equipo las
bajaba a mano desde la página del curso para subirlas después a otro sitio.

Cómo va
-------
- **Sin procesar vídeo.** El recorte es VIRTUAL: la grabación se queda en
  Daily tal cual y la escuela guarda QUÉ TROZOS se enseñan. Recortar es
  instantáneo, se deshace cuando se quiera y no hace falta Bunny ni ffmpeg. El
  reproductor del alumno (`ReproductorRecortado.tsx`) se salta lo cortado y su
  barra solo mide lo que se ve.
- **Aparecen solas**: `estudio` lee las grabaciones de la sala del curso
  (`GET /recordings?room_name=` de Daily) y las junta POR DÍA (hora de Países
  Bajos). Si la sala cortó y volvió a grabar (pasa: ver «si la grabación se
  para sola…» en CLAUDE.md), ese día tiene varias PARTES, en orden. Cada día
  se empareja con la semana de la clase del mismo día y, si no hay, con la más
  cercana a un día de distancia (`semana_del_dia`).
- **Publicar** = escribir en `tarea_semana.grabacion_sala` (JSON):
  `{partes: [{id, dur, trozos: [[desde, hasta], …]}], titulo, publicada_at,
  por, vistas: {user_id: iso}}`. `trozos` es lo que SE VE, en segundos de esa
  parte. Una parte que no se quiere enseñar no se manda. Publicar NO borra ni
  cambia nada en Daily; «Quitar» solo vacía la columna.
- **El vídeo**: `enlace_video` pide a Daily un enlace fresco (caducan) y la
  ruta `/grabaciones/video/{id}` redirige a él. Se guarda 20 minutos en
  memoria: el reproductor pide el vídeo a trozos (cada salto es otra petición)
  y sin esa copia cada una serían dos llamadas a Daily.
- **Quién lo ve**: el equipo, cualquier grabación de la sala de ESE curso. Un
  alumno, solo las partes publicadas en una semana de una clase que ve y cuya
  clase ya ha llegado (`publicada_para_alumnos`).
- **«Vista»**: la grabación de la sala no es una clase del curso, así que el
  recorrido (`trail_step`) no sabe quién la vio. El reproductor avisa cuando
  el alumno pasa de la mitad (`marcar_vista`) y se apunta dentro del mismo
  JSON (`vistas`); el Seguimiento semanal lo cuenta en su columna «Grabación».

Lo que NO hace (dicho, para no creerlo hecho)
---------------------------------------------
- No copia el vídeo a ningún sitio: si la grabación se borra en Daily (o Daily
  la caduca según el plan), deja de verse.
- La campana «Ya está la grabación» (`aviso_grabacion` en tareas.py) solo mira
  las clases de vídeo del curso: una grabación publicada desde aquí no avisa
  sola. Para avisar, «Avisar a la clase».
- No se ha probado contra Daily de verdad (no se alcanza desde el entorno de
  desarrollo): con un Daily falso, sí (test_estudio_grabaciones.py).
"""

import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional
from zoneinfo import ZoneInfo

from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.tareas import TareaSemana
from src.services.salas import salas

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
#: Lo mínimo que dura un trozo que se enseña (menos, se tira).
MINIMO_SEG = 1.0
#: Cuánto vale la copia del enlace del vídeo. Daily los da para una hora.
_ENLACE_SEG = 20 * 60
_enlaces: dict[str, tuple[float, str, str]] = {}
_ID = re.compile(r"[A-Za-z0-9-]{8,64}")


class GrabacionError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def limpiar_trozos(trozos: Any, dur: float = 0) -> list[list[float]]:
    """Los trozos que se ven, en orden, sin solapes, dentro de la duración y
    sin trozos de menos de un segundo. Con duración conocida y nada válido, la
    grabación entera. Sin duración (0), una lista vacía quiere decir «entera»."""
    dur = max(0.0, float(dur or 0))
    pares: list[tuple[float, float]] = []
    for t in trozos if isinstance(trozos, (list, tuple)) else []:
        try:
            a, b = float(t[0]), float(t[1])
        except (TypeError, ValueError, IndexError):
            continue
        if a != a or b != b:  # NaN
            continue
        a = max(0.0, a)
        if dur:
            b = min(dur, b)
        if b - a >= MINIMO_SEG:
            pares.append((a, b))
    pares.sort()
    fundidos: list[list[float]] = []
    for a, b in pares:
        if fundidos and a <= fundidos[-1][1]:
            fundidos[-1][1] = max(fundidos[-1][1], b)
        else:
            fundidos.append([a, b])
    salida = [[round(a, 2), round(b, 2)] for a, b in fundidos]
    if not salida and dur >= MINIMO_SEG:
        return [[0.0, round(dur, 2)]]
    return salida


def duracion_visible(trozos: Iterable[Iterable[float]], dur: float = 0) -> float:
    """Los segundos que se ven. Sin trozos, la duración entera."""
    lista = [list(t) for t in trozos or []]
    if not lista:
        return float(dur or 0)
    return round(sum(b - a for a, b in lista), 2)


def a_real(trozos: Iterable[Iterable[float]], visible: float) -> float:
    """El segundo de la grabación que corresponde a un segundo de lo que se ve."""
    lista = [list(t) for t in trozos or []]
    v = max(0.0, float(visible or 0))
    if not lista:
        return v
    for a, b in lista:
        if v <= b - a:
            return round(a + v, 2)
        v -= b - a
    return lista[-1][1]


def a_visible(trozos: Iterable[Iterable[float]], real: float) -> float:
    """Al revés: dónde cae en lo que se ve un segundo de la grabación. Un
    segundo cortado cae al principio del trozo siguiente."""
    lista = [list(t) for t in trozos or []]
    r = max(0.0, float(real or 0))
    if not lista:
        return r
    antes = 0.0
    for a, b in lista:
        if r < a:
            return round(antes, 2)
        if r <= b:
            return round(antes + (r - a), 2)
        antes += b - a
    return round(antes, 2)


def dia_nl(inicio: Any) -> str:
    """El día (AAAA-MM-DD, hora de Países Bajos) en que empezó una grabación.
    Vale el `start_ts` de Daily o una fecha en texto."""
    if not inicio:
        return ""
    try:
        if isinstance(inicio, (int, float)) or str(inicio).isdigit():
            momento = datetime.fromtimestamp(int(inicio), tz=timezone.utc)
        else:
            momento = datetime.fromisoformat(str(inicio).replace("Z", "+00:00"))
            if momento.tzinfo is None:
                momento = momento.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, OSError):
        return ""
    return momento.astimezone(ZONA).date().isoformat()


def hora_nl(inicio: str) -> str:
    try:
        momento = datetime.fromisoformat(str(inicio).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return ""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(ZONA).strftime("%H:%M")


def _dias_entre(a: str, b: str) -> Optional[int]:
    try:
        return abs((datetime.fromisoformat(a[:10]) - datetime.fromisoformat(b[:10])).days)
    except (TypeError, ValueError):
        return None


def semana_del_dia(dia: str, semanas: Iterable[dict]) -> Optional[dict]:
    """La semana de la clase a la que corresponde lo grabado ese día: la del
    mismo día; si no, la más cercana a UN día de distancia (una clase que
    acaba pasada la medianoche, o movida de día a última hora). Si hay dos a
    un día, la anterior (lo normal es grabar después de la fecha, no antes)."""
    if not dia:
        return None
    lista = [s for s in semanas if s.get("fecha")]
    for s in lista:
        if s["fecha"] == dia:
            return s
    cerca = [s for s in lista if _dias_entre(s["fecha"], dia) == 1]
    if not cerca:
        return None
    return sorted(cerca, key=lambda s: (s["fecha"] > dia, s["fecha"]))[0]


def leer(texto: Any) -> dict:
    """Lo guardado en `tarea_semana.grabacion_sala`, limpio. Vacío = {}."""
    if isinstance(texto, dict):
        datos = texto
    else:
        try:
            datos = json.loads(texto) if texto else {}
        except (TypeError, ValueError):
            datos = {}
    if not isinstance(datos, dict):
        return {}
    partes = []
    for p in datos.get("partes") or []:
        if not isinstance(p, dict) or not _ID.fullmatch(str(p.get("id") or "")):
            continue
        dur = max(0.0, float(p.get("dur") or 0))
        partes.append({"id": str(p["id"]), "dur": dur, "trozos": limpiar_trozos(p.get("trozos"), dur)})
    if not partes:
        return {}
    vistas = datos.get("vistas") if isinstance(datos.get("vistas"), dict) else {}
    return {
        "partes": partes,
        "titulo": str(datos.get("titulo") or "")[:160],
        "publicada_at": str(datos.get("publicada_at") or ""),
        "por": str(datos.get("por") or "")[:120],
        "vistas": {str(k): str(v) for k, v in vistas.items()},
    }


def segundos_de(g: dict) -> float:
    """Lo que dura lo publicado, sumando sus partes."""
    return round(sum(duracion_visible(p["trozos"], p["dur"]) for p in g.get("partes") or []), 2)


def para_la_semana(texto: Any, user_id: Optional[int] = None, equipo: bool = False) -> Optional[dict]:
    """Lo que la semana le da a la pantalla: las partes y sus trozos, cuánto
    dura y si ESA persona ya la vio. Al equipo, además, quién la publicó y
    cuántos la han visto. None si no hay nada publicado."""
    g = leer(texto)
    if not g:
        return None
    salida: dict = {
        "partes": g["partes"],
        "titulo": g["titulo"],
        "segundos": segundos_de(g),
        "vista": str(user_id) in g["vistas"] if user_id else False,
    }
    if equipo:
        salida.update({"publicada_at": g["publicada_at"], "por": g["por"], "vistas": len(g["vistas"])})
    return salida


def quienes_la_vieron(texto: Any) -> set[int]:
    return {int(k) for k in leer(texto).get("vistas", {}) if str(k).isdigit()}


def agrupar(grabaciones: Iterable[dict], semanas: list[dict], publicadas: dict[str, dict]) -> list[dict]:
    """Las grabaciones de la sala, por día y con su semana. `grabaciones` son
    las de `salas.grabacion_de`; `publicadas`, {id de la grabación: {semana_id,
    tema, trozos}} de lo ya publicado. El día más reciente, primero; dentro,
    las partes en el orden en que se grabaron."""
    por_dia: dict[str, list[dict]] = {}
    for g in grabaciones:
        dia = dia_nl(g.get("inicio"))
        if not dia or not g.get("id"):
            continue
        por_dia.setdefault(dia, []).append(g)
    dias = []
    for dia in sorted(por_dia, reverse=True):
        partes = []
        for g in sorted(por_dia[dia], key=lambda x: x.get("inicio") or ""):
            pub = publicadas.get(g["id"])
            partes.append(
                {
                    "id": g["id"],
                    "inicio": g.get("inicio") or "",
                    "hora": hora_nl(g.get("inicio") or ""),
                    "dur": int(g.get("duracion_seg") or 0),
                    "estado": g.get("estado") or "",
                    "lista": (g.get("estado") or "") == "finished" and int(g.get("duracion_seg") or 0) > 0,
                    "personas": int(g.get("personas") or 0),
                    "trozos": pub["trozos"] if pub else None,
                }
            )
        semana = semana_del_dia(dia, semanas)
        en = next((publicadas[p["id"]] for p in partes if p["id"] in publicadas), None)
        dias.append(
            {
                "dia": dia,
                "partes": partes,
                "dur": sum(p["dur"] for p in partes),
                "semana": {"id": semana["id"], "tema": semana.get("tema") or "", "fecha": semana["fecha"]} if semana else None,
                "publicada": {"semana_id": en["semana_id"], "tema": en["tema"], "fecha": en["fecha"], "segundos": en["segundos"]} if en else None,
            }
        )
    return dias


def publicada_para_alumnos(filas: Iterable[Any], grabacion_id: str, hoy: str) -> bool:
    """¿Esa grabación está publicada en alguna semana cuya clase ya ha llegado?"""
    for s in filas:
        fecha = getattr(s, "fecha", "") or ""
        if fecha and fecha > hoy:
            continue
        if any(p["id"] == grabacion_id for p in leer(getattr(s, "grabacion_sala", "")).get("partes", [])):
            return True
    return False


# ── Con Daily y la base de datos ────────────────────────────────────────────


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Modo de ejemplo (la escuela de pruebas) ─────────────────────────────────
#
# La escuela de pruebas no tiene clave de Daily (a propósito: ninguna clave de
# fuera), así que ahí no habría nada que recortar. Con los datos de prueba
# encendidos (`LEARNHOUSE_DATOS_DE_PRUEBA=si`) y SIN clave de Daily, cada clase
# ya dada de las últimas semanas trae una «grabación» de mentira: un vídeo de 3
# minutos con un reloj en pantalla (`services/demo/grabacion_de_ejemplo.mp4`),
# para probar el recorte y lo que ve el alumno. En producción (con clave de
# Daily, o sin los datos de prueba) esto no hace nada.

_DEMO = "demo-"
VIDEO_DE_EJEMPLO = Path(__file__).resolve().parent.parent / "demo" / "grabacion_de_ejemplo.mp4"
_DEMO_SEG = 180


def modo_ejemplo() -> bool:
    import os

    return (os.environ.get("LEARNHOUSE_DATOS_DE_PRUEBA") or "").strip().lower() == "si" and not salas.clave_api() and VIDEO_DE_EJEMPLO.is_file()


def _id_de_ejemplo(course_uuid: str, fecha: str) -> str:
    return f"{_DEMO}{fecha.replace('-', '')}-{salas.nombre_sala(course_uuid)[-8:]}"


def es_de_ejemplo(course_uuid: str, grabacion_id: str) -> bool:
    return modo_ejemplo() and (grabacion_id or "").startswith(_DEMO) and (grabacion_id or "").endswith(salas.nombre_sala(course_uuid)[-8:])


def grabaciones_de_ejemplo(course_uuid: str, semanas: Iterable[dict], hoy: str) -> list[dict]:
    """Una grabación de mentira por cada clase ya dada de las últimas 4 semanas."""
    out = []
    for s in semanas:
        fecha = s.get("fecha") or ""
        try:
            dias = (datetime.fromisoformat(hoy) - datetime.fromisoformat(fecha)).days
        except ValueError:
            continue
        if dias < 0 or dias > 28:
            continue
        try:
            inicio = datetime.fromisoformat(f"{fecha}T19:00:00").replace(tzinfo=ZoneInfo("Europe/Amsterdam"))
        except ValueError:
            continue
        out.append(
            salas.grabacion_de(
                {
                    "id": _id_de_ejemplo(course_uuid, fecha),
                    "room_name": salas.nombre_sala(course_uuid),
                    "start_ts": int(inicio.timestamp()),
                    "duration": _DEMO_SEG,
                    "status": "finished",
                    "max_participants": 6,
                }
            )
        )
    return out


async def _de_la_sala(course_uuid: str) -> list[dict]:
    """Las grabaciones de la sala de este curso, como las da `salas`."""
    datos = await salas._daily("GET", "/recordings", params={"room_name": salas.nombre_sala(course_uuid), "limit": 100})
    return [salas.grabacion_de(r) for r in (datos.get("data") or []) if isinstance(r, dict)]


async def estudio(course: Course, db_session: AsyncSession) -> dict:
    """Todo lo que pinta el estudio de grabaciones de una clase. Si Daily
    falla, las semanas salen igual y `aviso` lleva el motivo tal cual."""
    from src.services.tareas import tareas as T

    filas = await T.semanas_de(course.org_id, course.course_uuid, db_session)
    semanas = T._orden_reciente([T._semana_dict(s) for s in filas])
    clases = await T._clases([s["chapter_uuid"] for s in semanas], db_session)
    publicadas: dict[str, dict] = {}
    lista_semanas = []
    for s in filas:
        g = leer(getattr(s, "grabacion_sala", ""))
        d = next((x for x in semanas if x["id"] == s.id), None)
        if d is None:
            continue
        for p in g.get("partes", []):
            publicadas[p["id"]] = {
                "semana_id": s.id, "tema": s.tema, "fecha": s.fecha, "trozos": p["trozos"], "segundos": segundos_de(g),
            }
    for d in semanas:
        fila = next((f for f in filas if f.id == d["id"]), None)
        lista_semanas.append(
            {
                "id": d["id"],
                "tema": d["tema"],
                "fecha": d["fecha"],
                "grabacion_sala": para_la_semana(getattr(fila, "grabacion_sala", "") if fila else "", equipo=True),
                # Ya tiene una grabación subida a mano como clase del curso.
                "subida": any(c["tipo"] == "grabacion" for c in clases.get(d["chapter_uuid"], [])),
            }
        )
    aviso = ""
    grabadas: list[dict] = []
    if modo_ejemplo():
        from src.services.panel.tandas import hoy_nl

        grabadas = grabaciones_de_ejemplo(course.course_uuid, semanas, hoy_nl())
        aviso = "Escuela de pruebas: estas grabaciones son un vídeo de ejemplo (3 minutos con un reloj) para probar el recorte. En la escuela de verdad salen las que graba la sala."
    elif not salas.clave_api():
        aviso = "Falta la clave de Daily en Railway (LEARNHOUSE_DAILY_API_KEY): no se pueden leer las grabaciones."
    else:
        try:
            grabadas = await _de_la_sala(course.course_uuid)
        except salas.SalaError as exc:
            aviso = f"No se pudieron leer las grabaciones de la sala. {exc.mensaje}"
    return {
        "curso": course.name,
        "course_uuid": salas.uuid_curso(course.course_uuid),
        "dias": agrupar(grabadas, semanas, publicadas),
        "semanas": lista_semanas,
        "aviso": aviso,
    }


async def _info(course_uuid: str, grabacion_id: str) -> dict:
    """La grabación en Daily, si es de la sala de ESTE curso."""
    if not _ID.fullmatch(grabacion_id or ""):
        raise GrabacionError("Grabación no válida.", 400)
    if es_de_ejemplo(course_uuid, grabacion_id):
        return {"id": grabacion_id, "room_name": salas.nombre_sala(course_uuid), "duration": _DEMO_SEG, "status": "finished"}
    try:
        info = await salas._daily("GET", f"/recordings/{grabacion_id}")
    except salas.SalaError as exc:
        raise GrabacionError(exc.mensaje, exc.status if 400 <= exc.status < 600 else 502) from exc
    if str(info.get("room_name") or "") != salas.nombre_sala(course_uuid):
        raise GrabacionError("Esa grabación no es de esta clase.", 404)
    return info


async def enlace_video(course_uuid: str, grabacion_id: str) -> str:
    """Un enlace de Daily al vídeo, para reproducirlo. Solo de una grabación
    de ESTA sala. Se guarda 20 minutos (ver la cabecera)."""
    sala = salas.nombre_sala(course_uuid)
    guardado = _enlaces.get(grabacion_id)
    if guardado and guardado[2] == sala and time.time() - guardado[0] < _ENLACE_SEG:
        return guardado[1]
    await _info(course_uuid, grabacion_id)
    if es_de_ejemplo(course_uuid, grabacion_id):
        return "/api/v1/grabaciones/ejemplo.mp4"
    try:
        datos = await salas._daily("GET", f"/recordings/{grabacion_id}/access-link")
    except salas.SalaError as exc:
        raise GrabacionError(exc.mensaje, exc.status if 400 <= exc.status < 600 else 502) from exc
    enlace = str(datos.get("download_link") or "")
    if not enlace:
        raise GrabacionError("Daily aún no da el vídeo de esa grabación (¿se está procesando?).", 409)
    if len(_enlaces) > 300:
        _enlaces.clear()
    _enlaces[grabacion_id] = (time.time(), enlace, sala)
    return enlace


def olvidar_enlace(grabacion_id: str) -> None:
    _enlaces.pop(grabacion_id, None)


async def publicar(s: TareaSemana, course: Course, datos: dict, autor: str, db_session: AsyncSession) -> dict:
    """Publica en la semana las partes que llegan, con sus trozos. Cada parte
    se comprueba en Daily: tiene que ser de la sala de esta clase y estar
    terminada. La duración es la que dice Daily, no la que mande la pantalla."""
    pedidas = datos.get("partes") if isinstance(datos.get("partes"), list) else []
    partes = []
    vistos: set[str] = set()
    for p in pedidas[:12]:
        gid = str((p or {}).get("id") or "") if isinstance(p, dict) else ""
        if gid in vistos:
            continue
        vistos.add(gid)
        info = await _info(course.course_uuid, gid)
        if str(info.get("status") or "") not in ("finished", ""):
            raise GrabacionError("Esa grabación aún no ha terminado de procesarse en Daily. Prueba en unos minutos.", 409)
        dur = float(info.get("duration") or 0)
        trozos = limpiar_trozos(p.get("trozos"), dur)
        if dur and not trozos:
            continue
        partes.append({"id": gid, "dur": dur, "trozos": trozos})
    if not partes:
        raise GrabacionError("No hay nada que publicar: elige al menos una parte de la grabación.", 400)
    antes = leer(getattr(s, "grabacion_sala", ""))
    # Si son las mismas grabaciones (solo cambia el recorte), quien ya la vio sigue contando.
    mismas = {p["id"] for p in antes.get("partes", [])} == {p["id"] for p in partes}
    nuevo = {
        "partes": partes,
        "titulo": str(datos.get("titulo") or "").strip()[:160],
        "publicada_at": _ahora(),
        "por": (autor or "")[:120],
        "vistas": antes.get("vistas", {}) if mismas else {},
    }
    s.grabacion_sala = json.dumps(nuevo, ensure_ascii=False)
    s.updated_at = _ahora()
    db_session.add(s)
    await db_session.commit()
    return para_la_semana(nuevo, equipo=True) or {}


async def quitar(s: TareaSemana, db_session: AsyncSession) -> dict:
    """Deja de enseñarla. En Daily no se toca nada."""
    s.grabacion_sala = ""
    s.updated_at = _ahora()
    db_session.add(s)
    await db_session.commit()
    return {"ok": True}


async def marcar_vista(s: TareaSemana, user_id: int, db_session: AsyncSession) -> dict:
    """El alumno pasó de la mitad: cuenta como vista (una vez)."""
    g = leer(getattr(s, "grabacion_sala", ""))
    if not g:
        raise GrabacionError("Esa semana no tiene grabación publicada.", 404)
    if str(user_id) not in g["vistas"]:
        g["vistas"][str(user_id)] = _ahora()
        s.grabacion_sala = json.dumps(g, ensure_ascii=False)
        db_session.add(s)
        await db_session.commit()
    return {"ok": True, "vista": True}

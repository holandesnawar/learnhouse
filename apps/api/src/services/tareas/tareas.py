"""
Cada semana de una clase en directo, su tarea y el seguimiento (28/10/2026).

Pedido del usuario: "¿dónde encuentran los alumnos la presentación con
antelación, y después los ejercicios, y dónde entregan su tarea para que la
podamos corregir? … el punto medio entre que no me cueste 2 horas cada semana
y poder acompañar al alumno cada semana". Decidido con él (boceto del 28/10):

- **Una semana = un capítulo del curso de la clase en directo** (Masterclass,
  Clase semanal de cada grupo). Dentro, las clases de siempre: la presentación
  (PDF), la grabación, los ejercicios (`nawar:` de la formación). Lo que no
  existía es la fila `tarea_semana`, que dice qué capítulo es una semana, de
  qué día y qué tarea pide. Así el alumno ve en la página de su clase «Esta
  semana» con sus cuatro cosas y si las ha hecho, y el equipo, una tabla.
- **La tarea** se entrega con texto y/o nota de voz (`tarea_entrega`), sin
  salir de la escuela. La corrige el equipo (administradores, moderadores y
  profes: `STAFF_ROLE_IDS`) con texto y/o nota de voz. Hoy corrige el
  administrador; el profe podrá en cuanto lo tenga. Sin correo: el aviso va
  por la campana (al alumno, cuando sale la presentación de su clase y cuando
  su tarea está corregida; al equipo, lo que queda por corregir).
- **Las notas de voz son privadas**: `content/privado/tareas/<org>/`, que
  `/content` no sirve nunca (local_content.py). Se bajan por
  `/tareas/audio/{entrega}/{cual}`: el alumno las suyas, el equipo todas.
- **Seguimiento semanal** (equipo): por clase y semana, quién vio la
  presentación, quién fue a la clase (solo con la sala de la escuela: Daily
  dice quién estuvo; con Zoom no se sabe), cuántos ejercicios hizo y la tarea.
  Y «semanas sin nada»: cuántas semanas cerradas seguidas lleva alguien sin
  hacer nada, para escribirle antes de que se vaya del todo.
- **Check-in cada 4 semanas** (semanas 4, 8 y 12 de su camino de 16, el de
  `panel/camino.py`): la lista de a quién le toca y «Hecho». Se apunta como
  evento de su ficha (`contact_event`, `kind = "check-in"`), sin tabla nueva.

La semana «en curso» es la de la última clase ya dada cuyo plazo de entrega
no ha pasado (`semana_actual`); la «próxima», la primera clase que aún no ha
llegado: su presentación se ve antes.

**Antes del día de la clase, el alumno solo ve la presentación** (usuario,
28/10: "los ejercicios después de la clase, antes solo la presentación"). La
grabación, los ejercicios y la tarea se abren el día de la clase, en hora de
Países Bajos (`abierta`): se le quitan de la lista y no puede entregar la
tarea antes. El equipo lo ve todo siempre, para comprobar la semana. Las
clases siguen siendo las del curso: quien entre por la barra lateral de la
presentación podría abrir un ejercicio, pero son los de la formación.
"""

from __future__ import annotations

import json
import logging
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent
from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.enrollment import Enrollment
from src.db.organization_config import OrganizationConfig
from src.db.tareas import TareaEntrega, TareaSemana
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User

logger = logging.getLogger(__name__)

ROL_ALUMNO = 4
# La clase semanal de siempre (el mismo que `lib/nawar/cursos.ts`).
CLASE_SEMANAL_UUID = "bfbcb42b-7dc3-4448-9df8-5d7b96135859"
HITOS_CHECKIN = (4, 8, 12)
KIND_CHECKIN = "check-in"
CONTENT_DIR = Path("content")
CARPETA = "privado/tareas"
AUDIO_EXT = {".webm", ".ogg", ".oga", ".mp3", ".m4a", ".mp4", ".wav", ".aac"}
MIME = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
}
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_TEXTO = 6000
# La campana avisa de las correcciones de las últimas 3 semanas.
DIAS_AVISO = 21


class TareaError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def uuid_curso(course_uuid: str) -> str:
    return str(course_uuid or "").strip().replace("course_", "", 1)


def _extra(texto: str) -> dict:
    try:
        d = json.loads(texto) if texto else {}
        return d if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _fecha_valida(texto: Any) -> str:
    try:
        return date.fromisoformat(str(texto or "")[:10]).isoformat()
    except (TypeError, ValueError):
        return ""


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def limite_de(fecha: str, fecha_limite: str = "") -> str:
    """Último día para entregar: el que se puso, o el domingo de la semana de
    la clase (si la clase es en domingo, el domingo siguiente)."""
    puesto = _fecha_valida(fecha_limite)
    if puesto:
        return puesto
    try:
        d = date.fromisoformat(str(fecha or "")[:10])
    except (TypeError, ValueError):
        return ""
    dias = 6 - d.weekday() or 7
    return (d + timedelta(days=dias)).isoformat()


def semana_actual(semanas: Iterable[dict], hoy: str) -> tuple[Optional[int], Optional[int]]:
    """(la semana en curso, la próxima clase), por id.

    En curso: la de la última clase ya dada (fecha ≤ hoy) cuyo plazo no ha
    pasado. Próxima: la primera clase que aún no ha llegado."""
    orden = sorted((s for s in semanas if s.get("fecha")), key=lambda s: (s["fecha"], s.get("id") or 0))
    actual = None
    for s in orden:
        if s["fecha"] <= hoy and limite_de(s["fecha"], s.get("fecha_limite", "")) >= hoy:
            actual = s.get("id")
    proxima = next((s.get("id") for s in orden if s["fecha"] > hoy), None)
    return actual, proxima


def abierta(fecha: str, hoy: str) -> bool:
    """¿Ya ha llegado el día de la clase? Hasta entonces el alumno solo ve la
    presentación. Sin fecha, abierta (no hay día que esperar)."""
    return not fecha or fecha <= hoy


def solo_antes_de_la_clase(semana: dict) -> dict:
    """Lo que ve el alumno de una semana cuya clase aún no ha llegado: las
    presentaciones, cuántas cosas se abrirán ese día (`ocultas`) y la tarea
    sin enunciado (sigue diciendo que hay tarea)."""
    clases = semana.get("clases") or []
    ver = [c for c in clases if c.get("tipo") == "presentacion"]
    return {**semana, "clases": ver, "ocultas": len(clases) - len(ver), "enunciado": ""}


def tipo_de_clase(activity_type: Any, sub_type: Any, content: Any) -> str:
    """Qué es cada clase de una semana: presentación, grabación, ejercicios u
    otra cosa. Por el tipo de LearnHouse y, en las incrustadas, por la
    dirección (`nawar:` = ejercicios de la formación)."""
    t = str(getattr(activity_type, "value", activity_type) or "")
    st = str(getattr(sub_type, "value", sub_type) or "")
    datos = content if isinstance(content, dict) else {}
    if t == "TYPE_DOCUMENT":
        return "presentacion"
    if t == "TYPE_VIDEO":
        return "grabacion"
    if t == "TYPE_DYNAMIC":
        embed = str(datos.get("embed_url") or "").strip().lower()
        if embed.startswith(("nawar:", "nawar-video:", "nawar-guia:")):
            return "ejercicios"
        if st == "SUBTYPE_DYNAMIC_EMBED" and any(
            x in embed for x in ("mediadelivery.net", "bunny", "youtube.com", "youtu.be", "vimeo.com", "loom.com")
        ):
            return "grabacion"
        # Una página con un vídeo de Bunny dentro: así se suben las grabaciones.
        crudo = json.dumps(datos, ensure_ascii=False).lower() if datos else ""
        if "mediadelivery.net" in crudo or '"type": "blockbunny"' in crudo or "bunny" in crudo:
            return "grabacion"
    return "otra"


def estado_entrega(tiene_tarea: bool, entrega: Optional[dict]) -> str:
    """sin-tarea, pendiente, entregada (falta corregir) o corregida."""
    if not tiene_tarea:
        return "sin-tarea"
    if not entrega:
        return "pendiente"
    return "corregida" if entrega.get("estado") == "corregida" else "entregada"


def racha(semanas: Iterable[bool]) -> dict:
    """Las semanas YA CERRADAS de un alumno, la más reciente primero: True si
    hizo algo (presentación, ejercicios, clase o tarea). Cuántas seguidas lleva
    haciendo algo y cuántas seguidas sin nada."""
    lista = list(semanas)
    seguidas = 0
    for hizo in lista:
        if not hizo:
            break
        seguidas += 1
    sin_nada = 0
    for hizo in lista:
        if hizo:
            break
        sin_nada += 1
    return {"seguidas": seguidas, "sin_nada": sin_nada}


def hito_pendiente(semana: int, hechos: Iterable[int], hitos: Iterable[int] = HITOS_CHECKIN) -> Optional[int]:
    """El check-in que le toca a quien va por la semana `semana` de su camino:
    el último hito ya alcanzado, si no se ha hecho y no han pasado 4 semanas
    (pasadas 4 semanas, ya toca el siguiente)."""
    hechos = set(int(h) for h in hechos)
    alcanzados = [h for h in hitos if h <= (semana or 0)]
    if not alcanzados:
        return None
    h = max(alcanzados)
    if h in hechos or semana >= h + 4:
        return None
    return h


def asistentes_el_dia(sesiones: Iterable[dict], dia: str, minimo_seg: int = 600) -> set[str]:
    """Quién estuvo en la sala ese día (hora de Países Bajos), con el mismo
    criterio que el Camino: una sesión cuenta con 10 min o más."""
    from src.services.panel.camino import asistencias
    from src.services.panel.tandas import dia_nl

    del_dia = []
    for s in sesiones or []:
        if not isinstance(s, dict):
            continue
        inicio = s.get("start_time")
        try:
            cuando = datetime.fromtimestamp(int(inicio), tz=timezone.utc).isoformat() if inicio else ""
        except (TypeError, ValueError, OverflowError, OSError):
            cuando = str(inicio or "")
        if dia_nl(cuando) == dia:
            del_dia.append(s)
    return set(asistencias(del_dia, minimo_seg).keys())


# ── Lectura ─────────────────────────────────────────────────────────────────


async def curso_de(course_uuid: str, db_session: AsyncSession) -> Optional[Course]:
    limpio = uuid_curso(course_uuid)
    if not limpio:
        return None
    return (
        await db_session.execute(
            select(Course).where(Course.course_uuid.in_([f"course_{limpio}", limpio]))  # type: ignore[attr-defined]
        )
    ).scalars().first()


def _semana_dict(s: TareaSemana) -> dict:
    return {
        "id": s.id,
        "course_uuid": s.course_uuid,
        "chapter_uuid": s.chapter_uuid,
        "tema": s.tema,
        "fecha": s.fecha,
        "fecha_limite": s.fecha_limite,
        "limite": limite_de(s.fecha, s.fecha_limite),
        "enunciado": s.enunciado,
        "tiene_tarea": bool((s.enunciado or "").strip()),
    }


def _entrega_dict(e: Optional[TareaEntrega]) -> Optional[dict]:
    if e is None:
        return None
    return {
        "id": e.id,
        "texto": e.texto,
        "tiene_audio": bool(e.audio),
        "audio_seg": e.audio_seg or 0,
        "entregada_at": e.entregada_at,
        "actualizada_at": e.actualizada_at,
        "estado": e.estado,
        "correccion_texto": e.correccion_texto,
        "tiene_correccion_audio": bool(e.correccion_audio),
        "correccion_audio_seg": e.correccion_audio_seg or 0,
        "corregida_por": e.corregida_por,
        "corregida_at": e.corregida_at,
        "vista_at": e.vista_at,
    }


async def semanas_de(org_id: int, course_uuid: str, db_session: AsyncSession) -> list[TareaSemana]:
    limpio = uuid_curso(course_uuid)
    return list(
        (
            await db_session.execute(
                select(TareaSemana).where(TareaSemana.org_id == org_id, TareaSemana.course_uuid == limpio)
            )
        ).scalars().all()
    )


async def _clases(chapter_uuids: list[str], db_session: AsyncSession) -> dict[str, list[dict]]:
    """Las clases publicadas de cada semana (capítulo), en su orden y con su tipo."""
    if not chapter_uuids:
        return {}
    filas = (
        await db_session.execute(
            select(
                Chapter.chapter_uuid,
                Activity.id,
                Activity.activity_uuid,
                Activity.name,
                Activity.activity_type,
                Activity.activity_sub_type,
                Activity.content,
                ChapterActivity.order,
                Activity.creation_date,
            )
            .join(ChapterActivity, ChapterActivity.chapter_id == Chapter.id)
            .join(Activity, Activity.id == ChapterActivity.activity_id)
            .where(Chapter.chapter_uuid.in_(chapter_uuids), Activity.published == True)  # type: ignore[attr-defined]  # noqa: E712
        )
    ).all()
    salida: dict[str, list[dict]] = {}
    vistas: set[tuple[str, int]] = set()
    for cu, aid, auuid, nombre, tipo, sub, content, orden, creada in sorted(filas, key=lambda f: (f[0], f[7] or 0, f[1])):
        if (cu, aid) in vistas:
            continue
        vistas.add((cu, aid))
        salida.setdefault(cu, []).append(
            {
                "id": int(aid),
                "activity_uuid": auuid or "",
                "nombre": nombre or "",
                "tipo": tipo_de_clase(tipo, sub, content),
                "creada": creada or "",
            }
        )
    return salida


async def _hechas(course_id: int, user_ids: list[int], activity_ids: list[int], db_session: AsyncSession) -> dict[int, set[int]]:
    if not user_ids or not activity_ids:
        return {}
    salida: dict[int, set[int]] = {}
    for uid, aid in (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.activity_id).where(
                TrailStep.course_id == course_id,
                TrailStep.complete == True,  # noqa: E712
                TrailStep.user_id.in_(user_ids),  # type: ignore[attr-defined]
                TrailStep.activity_id.in_(activity_ids),  # type: ignore[attr-defined]
            )
        )
    ).all():
        salida.setdefault(int(uid), set()).add(int(aid))
    return salida


async def _entregas(tarea_ids: list[int], db_session: AsyncSession, user_ids: Optional[list[int]] = None) -> list[TareaEntrega]:
    if not tarea_ids:
        return []
    consulta = select(TareaEntrega).where(TareaEntrega.tarea_id.in_(tarea_ids))  # type: ignore[attr-defined]
    if user_ids is not None:
        if not user_ids:
            return []
        consulta = consulta.where(TareaEntrega.user_id.in_(user_ids))  # type: ignore[attr-defined]
    return list((await db_session.execute(consulta)).scalars().all())


def _orden_reciente(semanas: list[dict]) -> list[dict]:
    return sorted(semanas, key=lambda s: (s.get("fecha") or "", s.get("id") or 0), reverse=True)


# ── El alumno ───────────────────────────────────────────────────────────────


async def semanas_para_alumno(course: Course, user_id: int, db_session: AsyncSession, equipo: bool = False) -> dict:
    """Las semanas de una clase para la página del curso: sus clases con «hecha»
    o no, y el estado de su tarea. Al alumno, de las semanas cuya clase aún no
    ha llegado, solo la presentación (`solo_antes_de_la_clase`); al equipo, todo."""
    from src.services.panel.tandas import hoy_nl

    hoy = hoy_nl()
    filas = await semanas_de(course.org_id, course.course_uuid, db_session)
    semanas = [_semana_dict(s) for s in filas]
    clases = await _clases([s["chapter_uuid"] for s in semanas], db_session)
    ids = [c["id"] for lista in clases.values() for c in lista]
    hechas = (await _hechas(course.id or 0, [user_id], ids, db_session)).get(user_id, set())
    suyas = {e.tarea_id: e for e in await _entregas([s["id"] for s in semanas], db_session, [user_id])}
    for s in semanas:
        s["abierta"] = abierta(s["fecha"], hoy)
        s["ocultas"] = 0
        s["clases"] = [
            {"activity_uuid": c["activity_uuid"], "nombre": c["nombre"], "tipo": c["tipo"], "hecha": c["id"] in hechas}
            for c in clases.get(s["chapter_uuid"], [])
        ]
        e = _entrega_dict(suyas.get(s["id"]))
        s["tarea"] = {
            "estado": estado_entrega(s["tiene_tarea"], e),
            "corregida_at": (e or {}).get("corregida_at", ""),
            "vista": bool((e or {}).get("vista_at")),
        }
    actual, proxima = semana_actual(semanas, hoy)
    if not equipo:
        semanas = [s if s["abierta"] else solo_antes_de_la_clase(s) for s in semanas]
    return {
        "hoy": hoy,
        "actual": actual,
        "proxima": proxima,
        "semanas": _orden_reciente(semanas),
    }


async def mi_semana(
    org_id: int,
    user_id: int,
    puede_ver: Callable[[Course], Awaitable[bool]],
    db_session: AsyncSession,
) -> dict:
    """Para «Tu semana» del Inicio: la semana en curso (o la próxima) de cada
    clase en directo que ve, y las correcciones que aún no ha escuchado."""
    uuids = sorted(
        set(
            (
                await db_session.execute(select(TareaSemana.course_uuid).where(TareaSemana.org_id == org_id))
            ).scalars().all()
        )
    )
    salida: list[dict] = []
    for u in uuids:
        course = await curso_de(u, db_session)
        if course is None or not await puede_ver(course):
            continue
        datos = await semanas_para_alumno(course, user_id, db_session)
        elegida = datos["actual"] or datos["proxima"]
        s = next((x for x in datos["semanas"] if x["id"] == elegida), None)
        if s is None:
            continue
        salida.append(
            {
                "course_uuid": uuid_curso(course.course_uuid),
                "curso": course.name,
                "proxima": elegida != datos["actual"],
                "semana": s,
            }
        )
    return {"clases": salida, "corregidas": await corregidas_sin_ver(user_id, db_session)}


async def corregidas_sin_ver(user_id: int, db_session: AsyncSession) -> list[dict]:
    desde = (datetime.now(timezone.utc) - timedelta(days=DIAS_AVISO)).isoformat()
    filas = (
        await db_session.execute(
            select(TareaEntrega, TareaSemana)
            .join(TareaSemana, TareaSemana.id == TareaEntrega.tarea_id)
            .where(
                TareaEntrega.user_id == user_id,
                TareaEntrega.estado == "corregida",
                TareaEntrega.vista_at == "",
                TareaEntrega.corregida_at >= desde,
            )
        )
    ).all()
    return [
        {
            "tarea_id": t.id,
            "tema": t.tema,
            "corregida_por": e.corregida_por,
            "corregida_at": e.corregida_at,
            "tiene_audio": bool(e.correccion_audio),
            "audio_seg": e.correccion_audio_seg or 0,
            "entrega_id": e.id,
        }
        for e, t in sorted(filas, key=lambda f: f[0].corregida_at, reverse=True)
    ]


async def tarea(tarea_id: int, db_session: AsyncSession) -> TareaSemana:
    t = (await db_session.execute(select(TareaSemana).where(TareaSemana.id == tarea_id))).scalars().first()
    if t is None:
        raise TareaError("No existe esa tarea", 404)
    return t


async def tarea_para(t: TareaSemana, course: Course, user_id: int, db_session: AsyncSession, equipo: bool = False) -> dict:
    """La tarea para su página. Antes del día de la clase, al alumno sin el
    enunciado (la página dice cuándo se abre)."""
    from src.services.panel.tandas import hoy_nl

    e = (
        await db_session.execute(
            select(TareaEntrega).where(TareaEntrega.tarea_id == t.id, TareaEntrega.user_id == user_id)
        )
    ).scalars().first()
    semana = {**_semana_dict(t), "abierta": abierta(t.fecha, hoy_nl())}
    if not semana["abierta"] and not equipo:
        semana["enunciado"] = ""
    return {
        **semana,
        "curso": course.name,
        "course_uuid": uuid_curso(course.course_uuid),
        "entrega": _entrega_dict(e),
    }


def ruta_segura(relativa: str) -> Optional[Path]:
    """La ruta en disco de una nota de voz, solo si está dentro de privado/tareas/."""
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith(CARPETA + "/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


def _borrar(relativa: str) -> None:
    ruta = ruta_segura(relativa)
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


def _guardar_audio(org_id: int, nombre: str, datos: bytes) -> str:
    if not datos:
        raise TareaError("La nota de voz está vacía")
    if len(datos) > MAX_AUDIO_BYTES:
        raise TareaError("La nota de voz es demasiado larga")
    ext = Path(nombre or "").suffix.lower()
    if ext not in AUDIO_EXT:
        ext = ".webm"
    relativa = f"{CARPETA}/{org_id}/{_uuid.uuid4().hex}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    return relativa


async def entregar(
    t: TareaSemana,
    user_id: int,
    texto: str,
    audio: Optional[tuple[str, bytes]],
    audio_seg: int,
    quitar_audio: bool,
    db_session: AsyncSession,
    equipo: bool = False,
) -> dict:
    """Entrega (o cambia) la tarea. Mientras no esté corregida se puede cambiar.
    El alumno, desde el día de la clase."""
    from src.services.panel.tandas import hoy_nl

    if not (t.enunciado or "").strip():
        raise TareaError("Esta semana no tiene tarea")
    if not equipo and not abierta(t.fecha, hoy_nl()):
        raise TareaError("La tarea se abre el día de la clase", 409)
    e = (
        await db_session.execute(
            select(TareaEntrega).where(TareaEntrega.tarea_id == t.id, TareaEntrega.user_id == user_id)
        )
    ).scalars().first()
    if e is not None and e.estado == "corregida":
        raise TareaError("Ya está corregida. Si quieres añadir algo, escríbele a tu profe por mensajes.", 409)
    nuevo_texto = (texto or "").strip()[:MAX_TEXTO]
    nueva_ruta = _guardar_audio(t.org_id, audio[0], audio[1]) if audio else ""
    audio_final = nueva_ruta or ("" if quitar_audio else (e.audio if e else ""))
    if not nuevo_texto and not audio_final:
        _borrar(nueva_ruta)
        raise TareaError("Escribe algo o graba una nota de voz antes de entregar")
    ahora = _ahora()
    if e is None:
        e = TareaEntrega(tarea_id=t.id or 0, user_id=user_id, entregada_at=ahora)
    if e.audio and e.audio != audio_final:
        _borrar(e.audio)
    e.texto = nuevo_texto
    e.audio = audio_final
    e.audio_seg = max(0, min(int(audio_seg or 0), 60 * 10)) if nueva_ruta else (e.audio_seg if audio_final else 0)
    e.actualizada_at = ahora
    e.estado = "entregada"
    db_session.add(e)
    await db_session.commit()
    await db_session.refresh(e)
    return {"ok": True, "entrega": _entrega_dict(e)}


async def marcar_vista(t: TareaSemana, user_id: int, db_session: AsyncSession) -> dict:
    e = (
        await db_session.execute(
            select(TareaEntrega).where(TareaEntrega.tarea_id == t.id, TareaEntrega.user_id == user_id)
        )
    ).scalars().first()
    if e is not None and e.estado == "corregida" and not e.vista_at:
        e.vista_at = _ahora()
        db_session.add(e)
        await db_session.commit()
    return {"ok": True}


async def entrega(entrega_id: int, db_session: AsyncSession) -> TareaEntrega:
    e = (await db_session.execute(select(TareaEntrega).where(TareaEntrega.id == entrega_id))).scalars().first()
    if e is None:
        raise TareaError("No existe esa entrega", 404)
    return e


async def entrega_con_tarea(e: TareaEntrega, db_session: AsyncSession) -> dict:
    """Una entrega con su tarea y el nombre del alumno, para corregirla."""
    t = await tarea(e.tarea_id, db_session)
    u = (await db_session.execute(select(User).where(User.id == e.user_id))).scalars().first()
    return {
        "entrega": _entrega_dict(e),
        "tarea_id": t.id,
        "tema": t.tema,
        "enunciado": t.enunciado,
        "fecha": t.fecha,
        "user_id": e.user_id,
        "nombre": (" ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username) if u else "",
    }


def audio_de(e: TareaEntrega, cual: str) -> Optional[tuple[Path, str]]:
    relativa = e.correccion_audio if cual == "correccion" else e.audio
    ruta = ruta_segura(relativa)
    if ruta is None or not ruta.is_file():
        return None
    return ruta, MIME.get(ruta.suffix.lower(), "application/octet-stream")


# ── El equipo ───────────────────────────────────────────────────────────────


async def _excluidos(org_id: int, db_session: AsyncSession) -> set[int]:
    from src.services.contactos.metricas import ids_excluidos
    from src.services.panel.testers import ids_testers

    return await ids_excluidos(db_session) | await ids_testers(org_id, db_session)


async def alumnos_del_curso(org_id: int, course: Course, db_session: AsyncSession) -> list[dict]:
    """Los alumnos (rol 4) que ven esta clase: los de sus grupos si los tiene y
    no es pública; si no, todos. Sin pruebas ni Testers."""
    fuera = await _excluidos(org_id, db_session)
    grupos_curso = [
        int(g)
        for g in (
            await db_session.execute(
                select(UserGroupResource.usergroup_id).where(
                    UserGroupResource.resource_uuid.in_([course.course_uuid, uuid_curso(course.course_uuid)])  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    ]
    consulta = (
        select(UserOrganization, User)
        .join(User, User.id == UserOrganization.user_id)
        .where(UserOrganization.org_id == org_id, UserOrganization.role_id == ROL_ALUMNO)
    )
    if grupos_curso and not course.public:
        consulta = consulta.where(
            UserOrganization.user_id.in_(  # type: ignore[attr-defined]
                select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id.in_(grupos_curso))  # type: ignore[attr-defined]
            )
        )
    filas = [(m, u) for m, u in (await db_session.execute(consulta)).all() if m.user_id not in fuera]
    ids = [int(m.user_id) for m, _ in filas]
    grupos: dict[int, list[str]] = {}
    if ids:
        for uid, nombre in (
            await db_session.execute(
                select(UserGroupUser.user_id, UserGroup.name)
                .join(UserGroup, UserGroup.id == UserGroupUser.usergroup_id)
                .where(UserGroup.org_id == org_id, UserGroupUser.user_id.in_(ids))  # type: ignore[attr-defined]
            )
        ).all():
            grupos.setdefault(int(uid), []).append(str(nombre))
    return sorted(
        (
            {
                "user_id": int(m.user_id),
                "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
                "email": (u.email or "").strip().lower(),
                "grupos": sorted(grupos.get(int(m.user_id), [])),
                "entro": m.creation_date or "",
            }
            for m, u in filas
        ),
        key=lambda a: a["nombre"].lower(),
    )


async def _sala_del_curso(org_id: int, course: Course, db_session: AsyncSession) -> str:
    """El nombre de la sala de Daily si el curso la ha tenido encendida alguna vez."""
    from src.services.salas import salas

    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    todas = (fila.config or {}).get(salas.CLAVE) if fila and isinstance(fila.config, dict) else None
    ajustes = (todas or {}).get(uuid_curso(course.course_uuid)) if isinstance(todas, dict) else None
    if isinstance(ajustes, dict) and (ajustes.get("activo") or ajustes.get("directo")):
        return salas.nombre_sala(uuid_curso(course.course_uuid))
    return ""


async def clases_en_directo(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Las clases que pueden tener semanas: las que ya las tienen, las de la
    sala de la escuela y la clase semanal de siempre."""
    from src.services.panel.camino import _cursos_con_sala

    uuids = set(
        (
            await db_session.execute(select(TareaSemana.course_uuid).where(TareaSemana.org_id == org_id))
        ).scalars().all()
    )
    uuids |= {c["uuid"] for c in await _cursos_con_sala(org_id, db_session)}
    uuids.add(CLASE_SEMANAL_UUID)
    from src.db.organization_config import OrganizationConfig
    from src.services.salas.salas import nombre_con_etiqueta

    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    salida = []
    for u in sorted(uuids):
        c = await curso_de(u, db_session)
        if c is not None and c.org_id == org_id:
            # Dos copias de la clase semanal se llaman igual: la etiqueta las distingue.
            salida.append({"uuid": uuid_curso(c.course_uuid), "nombre": nombre_con_etiqueta(fila.config if fila else {}, c.course_uuid, c.name)})
    return sorted(salida, key=lambda c: c["nombre"].lower())


async def seguimiento(org_id: int, course_uuid: str, semana_id: Optional[int], db_session: AsyncSession) -> dict:
    """La tabla del equipo: una semana de una clase, alumno a alumno."""
    from src.services.panel.camino import _sesiones_de
    from src.services.panel.tandas import hoy_nl
    from src.services.salas import salas

    course = await curso_de(course_uuid, db_session)
    if course is None or course.org_id != org_id:
        raise TareaError("No existe esa clase", 404)
    hoy = hoy_nl()
    semanas = _orden_reciente([_semana_dict(s) for s in await semanas_de(org_id, course.course_uuid, db_session)])
    base = {"curso": course.name, "course_uuid": uuid_curso(course.course_uuid), "hoy": hoy}
    if not semanas:
        return {**base, "semanas": [], "semana": None, "alumnos": [], "cifras": None, "aviso": ""}
    actual, proxima = semana_actual(semanas, hoy)
    elegida = next((s for s in semanas if s["id"] == semana_id), None)
    if elegida is None:
        pasadas = [s for s in semanas if s["fecha"] <= hoy]
        elegida = next((s for s in semanas if s["id"] == actual), None) or (pasadas[0] if pasadas else semanas[-1])

    alumnos = await alumnos_del_curso(org_id, course, db_session)
    ids = [a["user_id"] for a in alumnos]
    clases = await _clases([s["chapter_uuid"] for s in semanas], db_session)
    todas = [c["id"] for lista in clases.values() for c in lista]
    hechas = await _hechas(course.id or 0, ids, todas, db_session)
    entregas: dict[tuple[int, int], TareaEntrega] = {
        (e.tarea_id, e.user_id): e for e in await _entregas([s["id"] for s in semanas], db_session, ids)
    }

    # Quién fue a cada clase: solo con la sala de la escuela.
    sala = await _sala_del_curso(org_id, course, db_session)
    asistencia: dict[int, set[str]] = {}
    aviso = ""
    if sala and salas.clave_api():
        try:
            sesiones = await _sesiones_de(sala)
            for s in semanas:
                if s["fecha"] <= hoy:
                    asistencia[s["id"]] = asistentes_el_dia(sesiones, s["fecha"])
        except salas.SalaError as exc:
            aviso = f"No se pudo leer la asistencia de la sala: {exc.mensaje}"
    elif not sala:
        aviso = "La clase no es en la sala de la escuela: no se sabe quién fue (con Zoom no lo dice nadie)."
    else:
        aviso = "Falta la clave de Daily en Railway: no se sabe quién fue a la clase."

    def de_tipo(s: dict, tipo: str) -> list[int]:
        return [c["id"] for c in clases.get(s["chapter_uuid"], []) if c["tipo"] == tipo]

    cerradas = [s for s in semanas if s["limite"] < hoy]
    filas = []
    for a in alumnos:
        uid = a["user_id"]
        suyas = hechas.get(uid, set())
        pres = de_tipo(elegida, "presentacion")
        ejer = de_tipo(elegida, "ejercicios")
        e = entregas.get((elegida["id"], uid))
        fue = None
        if elegida["id"] in asistencia:
            fue = str(uid) in asistencia[elegida["id"]]

        def hizo_algo(s: dict) -> bool:
            ids_semana = [c["id"] for c in clases.get(s["chapter_uuid"], [])]
            return (
                any(i in suyas for i in ids_semana)
                or (s["id"], uid) in entregas
                or str(uid) in asistencia.get(s["id"], set())
            )

        filas.append(
            {
                **a,
                "presentacion": (any(i in suyas for i in pres) if pres else None),
                "clase": fue,
                "ejercicios": {"hechos": sum(1 for i in ejer if i in suyas), "total": len(ejer)},
                "tarea": estado_entrega(elegida["tiene_tarea"], _entrega_dict(e)),
                "entrega_id": e.id if e else None,
                **racha(hizo_algo(s) for s in cerradas),
            }
        )

    con_tarea = elegida["tiene_tarea"]
    cifras = {
        "alumnos": len(filas),
        "presentacion": sum(1 for f in filas if f["presentacion"]),
        "con_presentacion": bool(de_tipo(elegida, "presentacion")),
        "clase": sum(1 for f in filas if f["clase"]),
        "sabe_clase": elegida["id"] in asistencia,
        "ejercicios": sum(1 for f in filas if f["ejercicios"]["total"] and f["ejercicios"]["hechos"] >= f["ejercicios"]["total"]),
        "con_ejercicios": bool(de_tipo(elegida, "ejercicios")),
        "entregadas": sum(1 for f in filas if f["tarea"] in ("entregada", "corregida")) if con_tarea else 0,
        "por_corregir": sum(1 for f in filas if f["tarea"] == "entregada"),
        "con_tarea": con_tarea,
    }
    return {
        **base,
        "semanas": [{"id": s["id"], "tema": s["tema"], "fecha": s["fecha"]} for s in semanas],
        "actual": actual,
        "proxima": proxima,
        "semana": elegida,
        "alumnos": filas,
        "cifras": cifras,
        "aviso": aviso,
    }


async def por_corregir(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Todas las entregas sin corregir de la escuela, la más antigua primero."""
    filas = (
        await db_session.execute(
            select(TareaEntrega, TareaSemana, User)
            .join(TareaSemana, TareaSemana.id == TareaEntrega.tarea_id)
            .join(User, User.id == TareaEntrega.user_id)
            .where(TareaSemana.org_id == org_id, TareaEntrega.estado == "entregada")
        )
    ).all()
    nombres = {}
    for _e, t, _u in filas:
        if t.course_uuid not in nombres:
            c = await curso_de(t.course_uuid, db_session)
            nombres[t.course_uuid] = c.name if c else ""
    salida = [
        {
            "entrega": _entrega_dict(e),
            "tarea_id": t.id,
            "tema": t.tema,
            "enunciado": t.enunciado,
            "fecha": t.fecha,
            "curso": nombres.get(t.course_uuid, ""),
            "course_uuid": t.course_uuid,
            "user_id": u.id,
            "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
        }
        for e, t, u in filas
    ]
    return sorted(salida, key=lambda x: x["entrega"]["entregada_at"] or "")


async def corregir(
    e: TareaEntrega,
    texto: str,
    audio: Optional[tuple[str, bytes]],
    audio_seg: int,
    autor_id: int,
    autor: str,
    db_session: AsyncSession,
) -> dict:
    t = await tarea(e.tarea_id, db_session)
    nuevo = (texto or "").strip()[:MAX_TEXTO]
    # Sin texto ni nota de voz también vale: «visto, todo bien».
    ruta = _guardar_audio(t.org_id, audio[0], audio[1]) if audio else ""
    if ruta:
        _borrar(e.correccion_audio)
        e.correccion_audio = ruta
        e.correccion_audio_seg = max(0, min(int(audio_seg or 0), 60 * 10))
    e.correccion_texto = nuevo
    e.estado = "corregida"
    e.corregida_por_id = autor_id
    e.corregida_por = (autor or "")[:120]
    e.corregida_at = _ahora()
    e.vista_at = ""
    db_session.add(e)
    await db_session.commit()
    await db_session.refresh(e)
    return {"ok": True, "entrega": _entrega_dict(e)}


async def reabrir(e: TareaEntrega, db_session: AsyncSession) -> dict:
    """Quita la corrección (vuelve a «por corregir»). La nota de voz se borra."""
    _borrar(e.correccion_audio)
    e.correccion_audio = ""
    e.correccion_audio_seg = 0
    e.correccion_texto = ""
    e.estado = "entregada"
    e.corregida_por = ""
    e.corregida_por_id = 0
    e.corregida_at = ""
    e.vista_at = ""
    db_session.add(e)
    await db_session.commit()
    return {"ok": True}


# ── Crear y cambiar semanas (administradores) ──────────────────────────────


def _limpiar_semana(datos: dict) -> dict:
    salida: dict = {}
    if "tema" in datos:
        salida["tema"] = str(datos.get("tema") or "").strip()[:160]
    if "fecha" in datos:
        salida["fecha"] = _fecha_valida(datos.get("fecha"))
    if "enunciado" in datos:
        salida["enunciado"] = str(datos.get("enunciado") or "").strip()[:4000]
    if "fecha_limite" in datos:
        salida["fecha_limite"] = _fecha_valida(datos.get("fecha_limite"))
    return salida


async def crear_semana(org_id: int, course: Course, datos: dict, autor: str, db_session: AsyncSession) -> dict:
    limpio = _limpiar_semana(datos)
    capitulo = str(datos.get("chapter_uuid") or "").strip()
    if not capitulo:
        raise TareaError("Falta el capítulo de la semana")
    if not limpio.get("tema"):
        raise TareaError("Ponle un tema a la semana")
    if not limpio.get("fecha"):
        raise TareaError("Falta el día de la clase")
    cap = (await db_session.execute(select(Chapter).where(Chapter.chapter_uuid == capitulo))).scalars().first()
    if cap is None or cap.course_id != course.id:
        raise TareaError("Ese capítulo no es de esta clase")
    ya = (await db_session.execute(select(TareaSemana).where(TareaSemana.chapter_uuid == capitulo))).scalars().first()
    if ya is not None:
        raise TareaError("Ese capítulo ya es una semana", 409)
    ahora = _ahora()
    s = TareaSemana(
        org_id=org_id,
        course_uuid=uuid_curso(course.course_uuid),
        chapter_uuid=capitulo,
        creada_por=(autor or "")[:120],
        created_at=ahora,
        updated_at=ahora,
        **limpio,
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return {"ok": True, "semana": _semana_dict(s)}


async def editar_semana(s: TareaSemana, datos: dict, db_session: AsyncSession) -> dict:
    limpio = _limpiar_semana(datos)
    if "tema" in limpio and not limpio["tema"]:
        raise TareaError("Ponle un tema a la semana")
    if "fecha" in limpio and not limpio["fecha"]:
        raise TareaError("Falta el día de la clase")
    for k, v in limpio.items():
        setattr(s, k, v)
    s.updated_at = _ahora()
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return {"ok": True, "semana": _semana_dict(s)}


async def borrar_semana(s: TareaSemana, db_session: AsyncSession) -> dict:
    """Deja de ser una semana: se borran la tarea y sus entregas (con sus
    notas de voz). El capítulo y sus clases se quedan en el curso."""
    n = 0
    for e in await _entregas([s.id or 0], db_session):
        _borrar(e.audio)
        _borrar(e.correccion_audio)
        await db_session.delete(e)
        n += 1
    await db_session.delete(s)
    await db_session.commit()
    return {"ok": True, "entregas_borradas": n}


# ── Check-in cada 4 semanas ─────────────────────────────────────────────────


async def checkins(org_id: int, db_session: AsyncSession) -> dict:
    """A quién le toca el check-in (semanas 4, 8 y 12 de su camino)."""
    from src.services.panel.camino import semana_del_camino
    from src.services.panel.tandas import dia_nl, hoy_nl

    fuera = await _excluidos(org_id, db_session)
    filas = [
        (m, u)
        for m, u in (
            await db_session.execute(
                select(UserOrganization, User)
                .join(User, User.id == UserOrganization.user_id)
                .where(UserOrganization.org_id == org_id, UserOrganization.role_id == ROL_ALUMNO)
            )
        ).all()
        if m.user_id not in fuera
    ]
    correos = [(u.email or "").strip().lower() for _, u in filas if u.email]
    hechos: dict[str, set[int]] = {}
    ultimo: dict[str, dict] = {}
    if correos:
        for ev in (
            await db_session.execute(
                select(ContactEvent).where(ContactEvent.kind == KIND_CHECKIN, ContactEvent.email.in_(correos))  # type: ignore[attr-defined]
            )
        ).scalars().all():
            x = _extra(ev.extra)
            try:
                hechos.setdefault(ev.email, set()).add(int(x.get("hito") or 0))
            except (TypeError, ValueError):
                continue
            if ev.created_at >= (ultimo.get(ev.email) or {}).get("cuando", ""):
                ultimo[ev.email] = {"cuando": ev.created_at, "hito": x.get("hito"), "autor": x.get("autor") or "", "nota": x.get("nota") or ""}
    telefonos: dict[str, str] = {}
    if correos:
        for email, tel in (
            await db_session.execute(
                select(Enrollment.email, Enrollment.phone).where(Enrollment.email.in_(correos))  # type: ignore[attr-defined]
            )
        ).all():
            if tel and email:
                telefonos[email.strip().lower()] = tel
    hoy = hoy_nl()
    toca = []
    for m, u in filas:
        email = (u.email or "").strip().lower()
        camino = semana_del_camino(dia_nl(m.creation_date), hoy)
        if camino["estado"] in ("sin-fecha", "sin-empezar"):
            continue
        hito = hito_pendiente(camino["semana"], hechos.get(email, set()))
        if hito is None:
            continue
        toca.append(
            {
                "user_id": int(m.user_id),
                "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
                "email": email,
                "telefono": telefonos.get(email, ""),
                "semana": camino["semana"],
                "hito": hito,
                "atrasado": camino["semana"] > hito,
                "ultimo": ultimo.get(email),
            }
        )
    toca.sort(key=lambda a: (-a["semana"], a["nombre"].lower()))
    return {"hitos": list(HITOS_CHECKIN), "toca": toca}


async def marcar_checkin(org_id: int, user_id: int, hito: int, nota: str, autor: str, db_session: AsyncSession) -> dict:
    if hito not in HITOS_CHECKIN:
        raise TareaError("Ese check-in no existe")
    u = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    m = (
        await db_session.execute(
            select(UserOrganization).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    if u is None or m is None or not u.email:
        raise TareaError("No existe ese alumno", 404)
    ev = ContactEvent(
        email=u.email.strip().lower(),
        kind=KIND_CHECKIN,
        first_name=(u.first_name or "")[:120],
        last_name=(u.last_name or "")[:120],
        source="equipo",
        extra=json.dumps({"hito": hito, "nota": (nota or "").strip()[:500], "autor": (autor or "")[:120]}, ensure_ascii=False),
        created_at=_ahora(),
    )
    db_session.add(ev)
    await db_session.commit()
    return {"ok": True}


# ── La campana ──────────────────────────────────────────────────────────────


_DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def dia_largo(dia: str) -> str:
    """«2026-11-02» → «lunes 2 de noviembre»."""
    try:
        d = date.fromisoformat((dia or "")[:10])
    except (TypeError, ValueError):
        return dia or ""
    return f"{_DIAS[d.weekday()]} {d.day} de {_MESES[d.month - 1]}"


def _iso(texto: str) -> str:
    """La fecha de una clase del curso (`str(datetime.now())`, sin zona: el
    servidor va en UTC) con la misma forma que el resto de la campana, que
    ordena y compara las fechas como texto."""
    try:
        d = datetime.fromisoformat((texto or "").strip().replace(" ", "T"))
    except ValueError:
        return ""
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()


def aviso_presentacion(semana: dict, presentacion: dict, curso: str, course_uuid: str, hoy: str) -> dict:
    """El aviso de la campana de una presentación nueva («Nueva clase: …»)."""
    fecha = semana.get("fecha") or ""
    if not fecha or fecha > hoy:
        texto = f"Ya puedes ver la presentación para prepararte la clase del {dia_largo(fecha)}." if fecha else (
            "Ya puedes ver la presentación de la clase."
        )
    elif fecha == hoy:
        texto = "Ya puedes ver la presentación de la clase de hoy."
    else:
        texto = f"Ya tienes la presentación de la clase del {dia_largo(fecha)}."
    return {
        "id": f"semana:{semana['id']}:{presentacion['activity_uuid']}",
        "kind": "semana",
        "title": f"Nueva clase: {semana['tema']}",
        "excerpt": f"{curso} · {texto}" if curso else texto,
        "url": f"/course/{course_uuid}/activity/{presentacion['activity_uuid'].replace('activity_', '')}",
        "date": _iso(presentacion.get("creada") or "") or (semana.get("created_at") or ""),
    }


async def _ve_el_curso(user_id: int, course: Course, db_session: AsyncSession) -> bool:
    """Lo mismo que `alumnos_del_curso`, para una persona: con grupos y sin ser
    pública, solo la ven los de sus grupos; si no, todos."""
    grupos = [
        int(g)
        for g in (
            await db_session.execute(
                select(UserGroupResource.usergroup_id).where(
                    UserGroupResource.resource_uuid.in_([course.course_uuid, uuid_curso(course.course_uuid)])  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    ]
    if not grupos or course.public:
        return True
    return (
        await db_session.execute(
            select(UserGroupUser.id).where(
                UserGroupUser.user_id == user_id,
                UserGroupUser.usergroup_id.in_(grupos),  # type: ignore[attr-defined]
            )
        )
    ).first() is not None


async def presentaciones_nuevas(user_id: int, db_session: AsyncSession) -> list[dict]:
    """La campana del alumno cuando se abre una semana con su presentación
    (usuario, 28/10: "lo importante es cuando abro nueva semana y meto
    presentación, y cuando se le corrige algo"). Solo a los alumnos (rol 4) y de
    las clases que ven; de las semanas cuya clase es de los últimos 7 días o
    está por venir, y de presentaciones subidas en las últimas 3 semanas. En
    cuanto la abre, el aviso se va, como el de la corrección al escucharla."""
    from src.services.panel.tandas import hoy_nl

    orgs = [
        int(o)
        for o in (
            await db_session.execute(
                select(UserOrganization.org_id).where(
                    UserOrganization.user_id == user_id, UserOrganization.role_id == ROL_ALUMNO
                )
            )
        ).scalars().all()
    ]
    if not orgs:
        return []
    hoy = hoy_nl()
    desde_clase = (date.fromisoformat(hoy) - timedelta(days=7)).isoformat()
    desde_subida = (datetime.now(timezone.utc) - timedelta(days=DIAS_AVISO)).isoformat()
    filas = (
        await db_session.execute(
            select(TareaSemana).where(
                TareaSemana.org_id.in_(orgs),  # type: ignore[attr-defined]
                TareaSemana.fecha >= desde_clase,
            )
        )
    ).scalars().all()
    por_curso: dict[str, list[TareaSemana]] = {}
    for s in filas:
        por_curso.setdefault(s.course_uuid, []).append(s)
    salida: list[dict] = []
    for u, semanas in por_curso.items():
        course = await curso_de(u, db_session)
        if course is None or not await _ve_el_curso(user_id, course, db_session):
            continue
        clases = await _clases([s.chapter_uuid for s in semanas], db_session)
        presentaciones = {
            s.id: next((c for c in clases.get(s.chapter_uuid, []) if c["tipo"] == "presentacion"), None)
            for s in semanas
        }
        ids = [p["id"] for p in presentaciones.values() if p]
        vistas = (await _hechas(course.id or 0, [user_id], ids, db_session)).get(user_id, set())
        for s in semanas:
            p = presentaciones.get(s.id)
            if not p or p["id"] in vistas:
                continue
            aviso = aviso_presentacion({**_semana_dict(s), "created_at": s.created_at}, p, course.name or "", uuid_curso(course.course_uuid), hoy)
            if aviso["date"] >= desde_subida:
                salida.append(aviso)
    return salida


async def avisos_alumno(user_id: int, db_session: AsyncSession) -> list[dict]:
    """La campana del alumno: la presentación nueva de su clase y sus
    correcciones sin escuchar."""
    return await presentaciones_nuevas(user_id, db_session) + [
        {
            "id": f"tarea:{c['entrega_id']}:{c['corregida_at']}",
            "kind": "tarea",
            "title": f"Tu tarea de {c['tema']} está corregida",
            "excerpt": f"{c['corregida_por'] or 'Tu profe'} te ha dejado la corrección"
            + (" con una nota de voz." if c["tiene_audio"] else "."),
            "url": f"/tarea/{c['tarea_id']}",
            "date": c["corregida_at"],
        }
        for c in await corregidas_sin_ver(user_id, db_session)
    ]


async def avisos_equipo(org_id: int, admin: bool, db_session: AsyncSession) -> list[dict]:
    """Para el equipo: lo que queda por corregir y, a los administradores, los
    check-in que tocan. Una línea de cada; el id lleva la fecha de lo último,
    para que quitarla no la silencie para siempre."""
    url = "/dash/estadisticas?tab=seguimiento" if admin else "/seguimiento"
    out: list[dict] = []
    pendientes = await por_corregir(org_id, db_session)
    if pendientes:
        ultima = max(p["entrega"]["entregada_at"] or "" for p in pendientes)
        n = len(pendientes)
        out.append(
            {
                "id": f"corregir:{org_id}:{ultima}",
                "kind": "corregir",
                "title": "1 tarea por corregir" if n == 1 else f"{n} tareas por corregir",
                "excerpt": "La última, de " + pendientes[-1]["nombre"] + f" ({pendientes[-1]['tema']}).",
                "url": url,
                "date": ultima,
            }
        )
    if admin:
        datos = await checkins(org_id, db_session)
        if datos["toca"]:
            n = len(datos["toca"])
            from src.services.panel.tandas import hoy_nl

            hoy = hoy_nl()
            anio, semana_iso, _ = date.fromisoformat(hoy).isocalendar()
            out.append(
                {
                    "id": f"checkin:{org_id}:{anio}-{semana_iso}:{n}",
                    "kind": "checkin",
                    "title": "1 check-in esta semana" if n == 1 else f"{n} check-in esta semana",
                    "excerpt": ", ".join(a["nombre"].split(" ")[0] for a in datos["toca"][:4])
                    + ("…" if n > 4 else "")
                    + ": un mensaje para ver cómo van.",
                    "url": url,
                    "date": hoy + "T07:00:00+00:00",
                }
            )
    return out

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
import re
import unicodedata
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


# ── La lista que pasa el profe (07/11/2026) ─────────────────────────────────
#
# Usuario: "que puedan poner ellos quien asistió a la clase, con check, así veo
# quien asiste y se guarda en la escuela como progreso para saber cuándo
# terminó su camino de clases". La sala de Daily ya decía quién estuvo, pero
# solo si la clase es en la sala de la escuela (con Zoom no lo sabe nadie) y
# no distingue a quien entró con la cámara apagada y se fue a hacer la cena.
# Lo que marca el profe MANDA sobre la sala; donde no ha marcado, vale la sala.
# Se guarda en `tarea_semana.asistencia` (JSON por alumno, con quién lo marcó)
# y lo leen el Seguimiento semanal y el Camino de 16 semanas.


def leer_asistencia(texto: Any) -> dict[str, dict]:
    """{user_id: {"fue": bool, "por", "at"}} de la columna; lo raro se tira."""
    try:
        datos = json.loads(texto) if texto else {}
    except (TypeError, ValueError):
        return {}
    if not isinstance(datos, dict):
        return {}
    return {
        str(k): v for k, v in datos.items()
        if isinstance(v, dict) and isinstance(v.get("fue"), bool)
    }


def fue_a_clase(user_id: Any, marcas: dict, sala: Optional[set]) -> Optional[bool]:
    """Si fue: lo que marcó el profe y, si no marcó, lo que diga la sala.
    None = no se sabe (ni lista ni sala)."""
    m = (marcas or {}).get(str(user_id))
    if m is not None:
        return bool(m.get("fue"))
    if sala is None:
        return None
    return str(user_id) in sala


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
        "avisar_presentacion": bool(getattr(s, "aviso_presentacion", "si") or ""),
        "avisar_grabacion": bool(getattr(s, "aviso_grabacion", "") or ""),
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


# ── Las grabaciones de antes de las semanas (06/11/2026) ────────────────────
#
# Usuario: "lo de sesiones grabadas está bien, pero ahora no sirve de mucho,
# debe ser estilo próxima semana y esta semana como ahora". Antes del 28/10 las
# grabaciones iban en un capítulo por mes («OCTUBRE - 2026») con el día en el
# nombre («14-10 Het Weer | Paul Plaat»). Ahora todo va por semanas: cada
# grabación suelta se coloca en la semana de su día (o de su tema, la misma
# semana) y la que no tiene semana sale como una clase más de la lista, con su
# día, su tema y su profe. Nada se mueve en el curso: solo cambia cómo se pinta.

_RE_DIA = re.compile(r"^\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})(?:\s*[-/.]\s*(\d{2,4}))?\b\s*[-–—·|:,]*\s*(.*)$")
_MESES_NUM = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


def normal(texto: Any) -> str:
    """Para comparar temas: sin mayúsculas, sin acentos, solo letras y números. Pura."""
    t = unicodedata.normalize("NFD", str(texto or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", t).split())


def anio_del_capitulo(nombre: Any) -> Optional[int]:
    """«OCTUBRE - 2026» → 2026 (None si el nombre no es un mes con su año). Pura."""
    m = re.search(r"([a-z]+)\s*[-–—·/,]?\s*(\d{4})", normal(nombre))
    if not m or m.group(1) not in _MESES_NUM:
        return None
    return int(m.group(2))


def fecha_en_titulo(nombre: Any, anio: int) -> dict:
    """«14-10 Het Weer | Paul Plaat» → fecha 2026-10-14, tema «Het Weer»,
    profe «Paul Plaat». Sin día en el nombre, fecha vacía. Pura."""
    texto = " ".join(str(nombre or "").split())
    fecha = ""
    m = _RE_DIA.match(texto)
    if m:
        dia, mes, a, resto = m.group(1), m.group(2), m.group(3), m.group(4)
        y = int(a) if a else anio
        if y < 100:
            y += 2000
        try:
            fecha = date(y, int(mes), int(dia)).isoformat()
            texto = resto
        except ValueError:
            fecha = ""
    partes = [p.strip() for p in texto.split("|")]
    return {"fecha": fecha, "tema": partes[0] if partes else "", "profe": partes[1] if len(partes) > 1 else ""}


def _misma_semana(a: str, b: str) -> bool:
    try:
        return date.fromisoformat(a).isocalendar()[:2] == date.fromisoformat(b).isocalendar()[:2]
    except (TypeError, ValueError):
        return False


def _dias_entre(a: str, b: str) -> int:
    try:
        return abs((date.fromisoformat(a) - date.fromisoformat(b)).days)
    except (TypeError, ValueError):
        return 999


def mismo_tema(a: Any, b: Any) -> bool:
    """«De kleding» y «Kleding» son el mismo tema. Pura."""
    x, y = normal(a), normal(b)
    if not x or not y:
        return False
    if x == y:
        return True
    corto, largo = sorted((x, y), key=len)
    return len(corto) >= 4 and corto in largo


def semana_de_la_grabacion(semanas: list[dict], suelta: dict) -> Optional[dict]:
    """La semana a la que pertenece una grabación suelta: la de su mismo día o,
    con el mismo tema, la de su misma semana (±6 días). Pura."""
    f = suelta.get("fecha") or ""
    if not f:
        return None
    for s in semanas:
        if s.get("fecha") == f:
            return s
    for s in semanas:
        if mismo_tema(s.get("tema"), suelta.get("tema")) and (
            _misma_semana(s.get("fecha") or "", f) or _dias_entre(s.get("fecha") or "", f) <= 6
        ):
            return s
    return None


#: Nombres que no dicen de qué clase es una grabación de antes sin día.
_NOMBRES_SUELTOS = {"presentacion", "grabacion", "clase", "video", "la clase grabada", "clase grabada", "sesion"}


def colocar_sueltas(semanas: list[dict], sueltas: list[dict]) -> list[dict]:
    """Mete cada grabación suelta en su semana (en `clases`, marcada `suelta`)
    y devuelve las que no tienen semana: el archivo, la más nueva primero (las
    que no dicen su día, al final). Cambia `semanas` en el sitio. Pura."""
    archivo = []
    for c in sueltas:
        destino = semana_de_la_grabacion(semanas, c) if c.get("tipo") == "grabacion" else None
        if destino is not None:
            # 06/11: «salen dobles». Si la semana ya tiene su grabación, la de
            # los meses de antes es la misma clase subida dos veces: no se
            # añade (ni se deja suelta en «Clases anteriores»).
            if not any((x or {}).get("tipo") == "grabacion" for x in destino.get("clases") or []):
                destino.setdefault("clases", []).append({**c, "suelta": True})
        elif not c.get("fecha") and normal(c.get("tema") or c.get("nombre")) in _NOMBRES_SUELTOS:
            # Una «Presentación» o «Grabación» sin día no dice de qué clase es:
            # en «Clases anteriores» solo ensucia. Sigue en el editor.
            continue
        else:
            archivo.append(c)
    return sorted(archivo, key=lambda c: (bool(c.get("fecha")), c.get("fecha") or "", c.get("id") or 0), reverse=True)


async def _sueltas(course: Course, de_semanas: set[str], db_session: AsyncSession) -> list[dict]:
    """Las clases publicadas de los capítulos que NO son semanas (los meses de
    antes), con el día, el tema y el profe que dice su nombre."""
    capitulos = (
        await db_session.execute(select(Chapter.chapter_uuid, Chapter.name).where(Chapter.course_id == course.id))
    ).all()
    fuera = {cu: nombre for cu, nombre in capitulos if cu and cu not in de_semanas}
    if not fuera:
        return []
    clases = await _clases(list(fuera.keys()), db_session)
    salida = []
    for cu, lista in clases.items():
        anio_cap = anio_del_capitulo(fuera.get(cu))
        for c in lista:
            anio = anio_cap or (int(str(c.get("creada") or "")[:4]) if str(c.get("creada") or "")[:4].isdigit() else date.today().year)
            datos = fecha_en_titulo(c["nombre"], anio)
            salida.append({**c, **datos, "capitulo": fuera.get(cu) or ""})
    return salida


# ── El alumno ───────────────────────────────────────────────────────────────


async def semanas_para_alumno(
    course: Course, user_id: int, db_session: AsyncSession, equipo: bool = False, con_archivo: bool = False
) -> dict:
    """Las semanas de una clase para la página del curso: sus clases con «hecha»
    o no, y el estado de su tarea. Al alumno, de las semanas cuya clase aún no
    ha llegado, solo la presentación (`solo_antes_de_la_clase`); al equipo, todo.

    Con `con_archivo` (la página del curso, 06/11/2026), además las grabaciones
    de los meses de antes: cada una en su semana y, la que no tiene, en
    `archivo` (`colocar_sueltas`)."""
    from src.services.panel.tandas import hoy_nl

    hoy = hoy_nl()
    filas = await semanas_de(course.org_id, course.course_uuid, db_session)
    semanas = [_semana_dict(s) for s in filas]
    clases = await _clases([s["chapter_uuid"] for s in semanas], db_session)
    sueltas = await _sueltas(course, {s["chapter_uuid"] for s in semanas}, db_session) if con_archivo else []
    ids = [c["id"] for lista in clases.values() for c in lista] + [c["id"] for c in sueltas]
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
    archivo = colocar_sueltas(
        semanas,
        [
            {
                "id": c["id"], "activity_uuid": c["activity_uuid"], "nombre": c["nombre"], "tipo": c["tipo"],
                "hecha": c["id"] in hechas, "fecha": c["fecha"], "tema": c["tema"], "profe": c["profe"],
            }
            for c in sueltas
        ],
    )
    if not equipo:
        semanas = [s if s["abierta"] else solo_antes_de_la_clase(s) for s in semanas]
    else:
        # Al equipo, si ya se pasó la lista y cuántos vinieron (07/11/2026).
        listas = {f.id: leer_asistencia(getattr(f, "asistencia", "")) for f in filas}
        for s in semanas:
            m = listas.get(s["id"]) or {}
            s["lista"] = {"pasada": bool(m), "vinieron": sum(1 for x in m.values() if x.get("fue"))}
    for s in semanas:
        for c in s.get("clases") or []:
            c.pop("id", None)
    for c in archivo:
        c.pop("id", None)
    salida = {
        "hoy": hoy,
        "actual": actual,
        "proxima": proxima,
        "semanas": _orden_reciente(semanas),
    }
    if con_archivo:
        salida["archivo"] = archivo
    return salida


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
    filas_semana = await semanas_de(org_id, course.course_uuid, db_session)
    marcas: dict[int, dict] = {int(s.id or 0): leer_asistencia(getattr(s, "asistencia", "")) for s in filas_semana}
    semanas = _orden_reciente([_semana_dict(s) for s in filas_semana])
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
    # Las grabaciones de los meses de antes que caen en una semana (06/11).
    sueltas = await _sueltas(course, {s["chapter_uuid"] for s in semanas}, db_session)
    colocadas = [{"id": s["id"], "fecha": s["fecha"], "tema": s["tema"], "clases": []} for s in semanas]
    colocar_sueltas(colocadas, [dict(c) for c in sueltas])
    grab_sueltas = {s["id"]: [c["id"] for c in s["clases"]] for s in colocadas}
    todas = [c["id"] for lista in clases.values() for c in lista] + [c["id"] for c in sueltas]
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
        propias = [c["id"] for c in clases.get(s["chapter_uuid"], []) if c["tipo"] == tipo]
        return propias + (grab_sueltas.get(s["id"], []) if tipo == "grabacion" else [])

    cerradas = [s for s in semanas if s["limite"] < hoy]
    filas = []
    for a in alumnos:
        uid = a["user_id"]
        suyas = hechas.get(uid, set())
        pres = de_tipo(elegida, "presentacion")
        grab = de_tipo(elegida, "grabacion")
        ejer = de_tipo(elegida, "ejercicios")
        e = entregas.get((elegida["id"], uid))
        fue = fue_a_clase(uid, marcas.get(elegida["id"], {}), asistencia.get(elegida["id"]))
        marca = marcas.get(elegida["id"], {}).get(str(uid))

        def hizo_algo(s: dict) -> bool:
            ids_semana = [c["id"] for c in clases.get(s["chapter_uuid"], [])]
            return (
                any(i in suyas for i in ids_semana)
                or (s["id"], uid) in entregas
                or fue_a_clase(uid, marcas.get(s["id"], {}), asistencia.get(s["id"])) is True
            )

        filas.append(
            {
                **a,
                "presentacion": (any(i in suyas for i in pres) if pres else None),
                "grabacion": (any(i in suyas for i in grab) if grab else None),
                "clase": fue,
                # Quién lo dice: el profe (la lista) o la sala de Daily.
                "clase_origen": ("lista" if marca is not None else ("sala" if fue is not None else "")),
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
        "grabacion": sum(1 for f in filas if f["grabacion"]),
        "con_grabacion": bool(de_tipo(elegida, "grabacion")),
        "clase": sum(1 for f in filas if f["clase"]),
        "sabe_clase": elegida["id"] in asistencia or bool(marcas.get(elegida["id"])),
        "ejercicios": sum(1 for f in filas if f["ejercicios"]["total"] and f["ejercicios"]["hechos"] >= f["ejercicios"]["total"]),
        "con_ejercicios": bool(de_tipo(elegida, "ejercicios")),
        "entregadas": sum(1 for f in filas if f["tarea"] in ("entregada", "corregida")) if con_tarea else 0,
        "por_corregir": sum(1 for f in filas if f["tarea"] == "entregada"),
        "con_tarea": con_tarea,
    }
    lista = marcas.get(elegida["id"], {})
    if lista:
        # Con la lista pasada, ya se sabe quién fue aunque la clase fuera por Zoom.
        aviso = ""
    return {
        **base,
        "semanas": [{"id": s["id"], "tema": s["tema"], "fecha": s["fecha"]} for s in semanas],
        "actual": actual,
        "lista_pasada": bool(lista),
        "lista_por": sorted({str(m.get("por") or "") for m in lista.values() if m.get("por")}),
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


def marca_aviso(actual: str, quiere: Any, ahora: str) -> str:
    """La casilla «avisar en la campana» de una semana: lo que se guarda.
    `quiere` None = no se tocó (se queda como estaba); falso = "" (no avisar);
    verdadero = se queda la marca que hubiera o, si no había, `ahora` (desde
    cuándo avisa: así, marcarla más tarde le enciende el punto de la campana).
    Función pura."""
    if quiere is None:
        return actual or ""
    if not quiere:
        return ""
    return actual or ahora


def desde_cuando(marca: str, subida: str) -> str:
    """La fecha del aviso: cuando se subió la clase o, si la casilla se marcó
    después, cuando se marcó. Función pura."""
    m = _iso(marca) if marca and marca not in ("si",) else ""
    return max(subida or "", m)


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
    # Sin decir nada (una pantalla vieja): la presentación avisa y la
    # grabación no, como hasta el 05/11.
    quiere_p, quiere_g = datos.get("avisar_presentacion"), datos.get("avisar_grabacion")
    s.aviso_presentacion = marca_aviso("", True if quiere_p is None else quiere_p, ahora)
    s.aviso_grabacion = marca_aviso("", False if quiere_g is None else quiere_g, ahora)
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
    ahora = _ahora()
    s.aviso_presentacion = marca_aviso(s.aviso_presentacion or "", datos.get("avisar_presentacion"), ahora)
    s.aviso_grabacion = marca_aviso(s.aviso_grabacion or "", datos.get("avisar_grabacion"), ahora)
    s.updated_at = ahora
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


def aviso_grabacion(semana: dict, grabacion: dict, curso: str, course_uuid: str, desde: str) -> dict:
    """El aviso de la campana de una grabación nueva (05/11/2026)."""
    fecha = semana.get("fecha") or ""
    texto = f"Ya puedes ver la grabación de la clase del {dia_largo(fecha)}." if fecha else "Ya puedes ver la grabación de la clase."
    return {
        "id": f"grabacion:{semana['id']}:{grabacion['activity_uuid']}",
        "kind": "grabacion",
        "title": f"Ya está la grabación: {semana['tema']}",
        "excerpt": f"{curso} · {texto}" if curso else texto,
        "url": f"/course/{course_uuid}/activity/{grabacion['activity_uuid'].replace('activity_', '')}",
        "date": desde,
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
    """La campana del alumno con lo nuevo de su clase: la presentación
    (usuario, 28/10: "lo importante es cuando abro nueva semana y meto
    presentación, y cuando se le corrige algo") y la grabación (05/11). Cada
    semana tiene su casilla para cada una (`aviso_presentacion`,
    `aviso_grabacion`): sin marcar, no avisa. Solo a los alumnos (rol 4) y de
    las clases que ven (su grupo). La presentación, de las semanas cuya clase
    es de los últimos 7 días o está por venir; la grabación, de las clases ya
    dadas de las últimas 3 semanas. Las dos, si se subieron (o se marcó la
    casilla) en las últimas 3 semanas. En cuanto la abre, el aviso se va."""
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
    desde_grabada = (date.fromisoformat(hoy) - timedelta(days=DIAS_AVISO)).isoformat()
    desde_subida = (datetime.now(timezone.utc) - timedelta(days=DIAS_AVISO)).isoformat()
    filas = (
        await db_session.execute(
            select(TareaSemana).where(
                TareaSemana.org_id.in_(orgs),  # type: ignore[attr-defined]
                TareaSemana.fecha >= desde_grabada,
            )
        )
    ).scalars().all()
    por_curso: dict[str, list[TareaSemana]] = {}
    for s in filas:
        if not (s.aviso_presentacion or s.aviso_grabacion or getattr(s, "avisos", "")):
            continue
        por_curso.setdefault(s.course_uuid, []).append(s)
    salida: list[dict] = []
    for u, semanas in por_curso.items():
        course = await curso_de(u, db_session)
        if course is None or not await _ve_el_curso(user_id, course, db_session):
            continue
        clases = await _clases([s.chapter_uuid for s in semanas], db_session)
        ids = [c["id"] for s in semanas for c in clases.get(s.chapter_uuid, []) if c["tipo"] in ("presentacion", "grabacion")]
        vistas = (await _hechas(course.id or 0, [user_id], ids, db_session)).get(user_id, set())
        nombre, cu = course.name or "", uuid_curso(course.course_uuid)
        for s in semanas:
            # Lo que el equipo le mandó a la clase desde esta semana (06/11).
            salida.extend(avisos_de_clase_para(s, user_id, nombre, cu, desde_subida))
            de_la_semana = clases.get(s.chapter_uuid, [])
            p = next((c for c in de_la_semana if c["tipo"] == "presentacion"), None)
            if s.aviso_presentacion and p and p["id"] not in vistas and (s.fecha or "") >= desde_clase:
                aviso = aviso_presentacion({**_semana_dict(s), "created_at": s.created_at}, p, nombre, cu, hoy)
                aviso["date"] = desde_cuando(s.aviso_presentacion, aviso["date"])
                if aviso["date"] >= desde_subida:
                    salida.append(aviso)
            # La grabación, solo de una clase que ya se ha dado (antes del día
            # de la clase el alumno no la ve).
            g = next((c for c in de_la_semana if c["tipo"] == "grabacion"), None)
            if s.aviso_grabacion and g and g["id"] not in vistas and abierta(s.fecha, hoy):
                subida = _iso(g.get("creada") or "") or (s.updated_at or "")
                aviso = aviso_grabacion(_semana_dict(s), g, nombre, cu, desde_cuando(s.aviso_grabacion, subida))
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


# ── «Mira también»: la clase del otro grupo (06/11/2026) ────────────────────
#
# Usuario: "algunos alumnos quieren ver la clase grabada de los otros… es el
# mismo tema para ambas clases. Que no se vea tan claro la grabación del otro
# grupo, que esté en el lateral como: mira también esto". Las dos clases
# semanales (Groep rood y Groep blauw) son dos cursos con el mismo nombre,
# cada uno cerrado a su grupo: son «hermanas». En el lateral de la página de
# una clase salen las grabaciones de la hermana, y se ven en una ventana de la
# misma página: del otro grupo no se abre nada más (ni su tarea, ni su sala,
# ni sus clases). Se apaga por clase en sus ajustes (`salas[uuid].mira_tambien`
# = false).

_RE_BUNNY = re.compile(r"mediadelivery\.net/embed/(\d+)/([0-9a-fA-F-]{8,})")
_RE_YOUTUBE = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|live/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})")
_RE_VIMEO = re.compile(r"vimeo\.com/(?:video/)?(\d+)")


def video_de(activity_type: Any, sub_type: Any, content: Any) -> Optional[dict]:
    """Cómo se ve una grabación fuera de su curso: el reproductor de Bunny, de
    YouTube o de Vimeo, o el archivo subido a la escuela (`archivo`). None si
    no se reconoce. Pura."""
    t = str(getattr(activity_type, "value", activity_type) or "")
    st = str(getattr(sub_type, "value", sub_type) or "")
    datos = content if isinstance(content, dict) else {}
    if t == "TYPE_VIDEO" and st == "SUBTYPE_VIDEO_HOSTED":
        return {"tipo": "archivo", "url": ""}
    crudo = json.dumps(datos, ensure_ascii=False) if datos else ""
    m = _RE_BUNNY.search(crudo)
    if m:
        return {"tipo": "bunny", "url": f"https://iframe.mediadelivery.net/embed/{m.group(1)}/{m.group(2)}?responsive=true&preload=true"}
    m = _RE_YOUTUBE.search(crudo)
    if m:
        return {"tipo": "youtube", "url": f"https://www.youtube-nocookie.com/embed/{m.group(1)}"}
    m = _RE_VIMEO.search(crudo)
    if m:
        return {"tipo": "vimeo", "url": f"https://player.vimeo.com/video/{m.group(1)}"}
    return None


def es_hermana(nombre_a: Any, nombre_b: Any) -> bool:
    """Dos clases con el mismo nombre (sin mayúsculas ni acentos). Pura."""
    a, b = normal(nombre_a), normal(nombre_b)
    return bool(a) and a == b


def dia_habitual(fechas: Iterable[str]) -> str:
    """El día de la semana en que más se da una clase («jueves»). Pura."""
    cuenta: dict[int, int] = {}
    for f in fechas:
        try:
            d = date.fromisoformat(str(f or "")[:10]).weekday()
        except (TypeError, ValueError):
            continue
        cuenta[d] = cuenta.get(d, 0) + 1
    if not cuenta:
        return ""
    return _DIAS[max(cuenta, key=lambda d: (cuenta[d], -d))]


def _ajustes_sala(config: Any, course_uuid: str) -> dict:
    from src.services.salas import salas

    todas = (config or {}).get(salas.CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid_curso(course_uuid)) if isinstance(todas, dict) else None
    return propia if isinstance(propia, dict) else {}


def comparte(config: Any, course_uuid: str) -> bool:
    """¿Enseña esta clase «Mira también»? Sí, salvo que se haya apagado. Pura."""
    return _ajustes_sala(config, course_uuid).get("mira_tambien") is not False


async def _config(org_id: int, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    return fila.config if fila and isinstance(fila.config, dict) else {}


async def hermanas(course: Course, db_session: AsyncSession, config: Optional[dict] = None) -> list[Course]:
    """Las otras clases en directo de la escuela que se llaman igual."""
    from src.services.salas.salas import es_clase_en_directo

    config = config if config is not None else await _config(course.org_id, db_session)
    if not es_clase_en_directo(config, course.course_uuid):
        return []
    otras = (
        await db_session.execute(select(Course).where(Course.org_id == course.org_id, Course.id != course.id))
    ).scalars().all()
    return [c for c in otras if es_hermana(c.name, course.name) and es_clase_en_directo(config, c.course_uuid)]


async def hermanas_para_el_equipo(course: Course, db_session: AsyncSession) -> list[dict]:
    """Para «Nueva semana» (crear también en la otra clase) y los ajustes: cada
    hermana con su id, su etiqueta y el día en que se da."""
    from src.services.salas.salas import nombre_con_etiqueta

    config = await _config(course.org_id, db_session)
    salida = []
    for h in await hermanas(course, db_session, config):
        fechas = [s.fecha for s in await semanas_de(h.org_id, h.course_uuid, db_session)]
        banner = _ajustes_sala(config, h.course_uuid).get("banner") or {}
        salida.append(
            {
                "id": h.id,
                "org_id": h.org_id,
                "course_uuid": uuid_curso(h.course_uuid),
                "nombre": nombre_con_etiqueta(config, h.course_uuid, h.name),
                "dia": dia_habitual(fechas),
                "weekday": str(banner.get("next_weekday") or "") if isinstance(banner, dict) else "",
            }
        )
    return salida


async def mira_tambien(course: Course, db_session: AsyncSession, limite: int = 8) -> dict:
    """Las grabaciones de las clases hermanas, ya dadas, la más nueva primero:
    tema, día, profe (el del recuadro de esa clase) y cómo se ven."""
    from src.services.panel.tandas import hoy_nl

    config = await _config(course.org_id, db_session)
    if not comparte(config, course.course_uuid):
        return {"clases": []}
    hoy = hoy_nl()
    salida = []
    for h in await hermanas(course, db_session, config):
        semanas = [_semana_dict(s) for s in await semanas_de(h.org_id, h.course_uuid, db_session)]
        dadas = [s for s in semanas if s["fecha"] and s["fecha"] <= hoy]
        clases = await _clases([s["chapter_uuid"] for s in dadas], db_session)
        uuids = [c["activity_uuid"] for s in dadas for c in clases.get(s["chapter_uuid"], []) if c["tipo"] == "grabacion"]
        contenido = {}
        if uuids:
            for a in (await db_session.execute(select(Activity).where(Activity.activity_uuid.in_(uuids)))).scalars().all():  # type: ignore[attr-defined]
                contenido[a.activity_uuid] = video_de(a.activity_type, a.activity_sub_type, a.content)
        grabaciones = []
        for s in _orden_reciente(dadas):
            for c in clases.get(s["chapter_uuid"], []):
                v = contenido.get(c["activity_uuid"]) if c["tipo"] == "grabacion" else None
                if v:
                    grabaciones.append(
                        {"tema": s["tema"], "fecha": s["fecha"], "activity_uuid": c["activity_uuid"], "nombre": c["nombre"], "video": v}
                    )
        banner = _ajustes_sala(config, h.course_uuid).get("banner") or {}
        if grabaciones:
            salida.append(
                {
                    "course_uuid": uuid_curso(h.course_uuid),
                    "dia": dia_habitual(s["fecha"] for s in semanas),
                    "profe": str(banner.get("teacher") or "").strip() if isinstance(banner, dict) else "",
                    "grabaciones": grabaciones[:limite],
                }
            )
    return {"clases": salida}


async def archivo_de_hermana(course: Course, activity_uuid: str, db_session: AsyncSession) -> Optional[Path]:
    """El archivo de vídeo de una grabación de una clase hermana, si lo es (y
    es de una semana ya dada). None si no."""
    from src.services.panel.tandas import hoy_nl

    a = (await db_session.execute(select(Activity).where(Activity.activity_uuid == activity_uuid))).scalars().first()
    if a is None or (video_de(a.activity_type, a.activity_sub_type, a.content) or {}).get("tipo") != "archivo":
        return None
    config = await _config(course.org_id, db_session)
    if not comparte(config, course.course_uuid):
        return None
    hoy = hoy_nl()
    for h in await hermanas(course, db_session, config):
        if h.id != a.course_id:
            continue
        semanas = [s for s in await semanas_de(h.org_id, h.course_uuid, db_session) if s.fecha and s.fecha <= hoy]
        clases = await _clases([s.chapter_uuid for s in semanas], db_session)
        if not any(c["activity_uuid"] == activity_uuid for lista in clases.values() for c in lista):
            return None
        from src.db.organizations import Organization

        org = (await db_session.execute(select(Organization).where(Organization.id == h.org_id))).scalars().first()
        nombre = str((a.content or {}).get("filename") or "") if isinstance(a.content, dict) else ""
        if org is None or not nombre or "/" in nombre or ".." in nombre:
            return None
        ruta = CONTENT_DIR / "orgs" / org.org_uuid / "courses" / h.course_uuid / "activities" / a.activity_uuid / "video" / nombre
        return ruta if ruta.is_file() else None
    return None


# ── «Avisar a la clase» desde cada semana (06/11/2026) ──────────────────────
#
# Usuario: "poder yo ver todo más claro para las clases, estilo enviar mail o
# avisos sobre lo que hacemos, y tener más control sobre lo que los alumnos van
# viendo". Desde cada semana, el equipo escribe un aviso y elige a quién (toda
# la clase o los que aún no han hecho algo de ESA semana: la presentación, la
# grabación, los ejercicios, la tarea, o no fueron a la clase) y por dónde: la
# campana de la escuela y/o el correo. Nunca sale nada solo, y «Mandármelo a
# mí» lo enseña antes. Lo de la campana se guarda en la propia semana
# (`tarea_semana.avisos`, con los alumnos a los que fue), así cada aviso sale
# solo a esos.

FILTROS = {
    "todos": "Toda la clase",
    "sin_presentacion": "Los que no han abierto la presentación",
    "sin_grabacion": "Los que no han visto la grabación",
    "sin_ejercicios": "Los que no han terminado los ejercicios",
    "sin_tarea": "Los que no han entregado la tarea",
    "sin_clase": "Los que no fueron a la clase",
}
MAX_AVISOS = 30


def quien_recibe(filas: Iterable[dict], filtro: str) -> list[dict]:
    """De la tabla del seguimiento, a quién le llega un aviso. Pura."""
    def entra(f: dict) -> bool:
        if filtro == "sin_presentacion":
            return f.get("presentacion") is False
        if filtro == "sin_grabacion":
            return f.get("grabacion") is False
        if filtro == "sin_ejercicios":
            e = f.get("ejercicios") or {}
            return bool(e.get("total")) and (e.get("hechos") or 0) < e["total"]
        if filtro == "sin_tarea":
            return f.get("tarea") == "pendiente"
        if filtro == "sin_clase":
            return f.get("clase") is False
        return True

    return [f for f in filas if entra(f)]


def leer_avisos(texto: Any) -> list[dict]:
    try:
        datos = json.loads(texto) if texto else []
    except (TypeError, ValueError):
        return []
    return [a for a in datos if isinstance(a, dict)] if isinstance(datos, list) else []


def aviso_de_clase(semana: dict, aviso: dict, curso: str, course_uuid: str) -> dict:
    """El aviso de la campana de un «Avisar a la clase». Pura."""
    texto = " ".join(str(aviso.get("texto") or "").split())
    return {
        "id": f"clase:{semana['id']}:{aviso.get('id')}",
        "kind": "clase",
        "title": aviso.get("titulo") or f"Aviso de la clase: {semana.get('tema') or ''}",
        "excerpt": (f"{curso} · {texto}" if curso else texto)[:280],
        "url": f"/course/{course_uuid}",
        "date": aviso.get("at") or "",
    }


def _cuerpo_html(texto: str) -> str:
    import html as _html

    parrafos = [p.strip() for p in str(texto or "").split("\n\n") if p.strip()]
    return "".join(f"<p>{_html.escape(p).replace(chr(10), '<br>')}</p>" for p in parrafos)


async def destinatarios(org_id: int, s: TareaSemana, db_session: AsyncSession) -> dict:
    """Cuántos y quiénes recibirían un aviso con cada filtro, y los avisos ya
    mandados desde esta semana."""
    seg = await seguimiento(org_id, s.course_uuid, s.id, db_session)
    filas = seg["alumnos"]
    cifras = seg.get("cifras") or {}
    disponibles = {"todos": True, "sin_presentacion": cifras.get("con_presentacion"), "sin_grabacion": cifras.get("con_grabacion"),
                   "sin_ejercicios": cifras.get("con_ejercicios"), "sin_tarea": cifras.get("con_tarea"), "sin_clase": cifras.get("sabe_clase")}
    return {
        "filtros": [
            {
                "id": k,
                "nombre": nombre,
                "alumnos": [{"user_id": f["user_id"], "nombre": f["nombre"]} for f in quien_recibe(filas, k)],
            }
            for k, nombre in FILTROS.items()
            if disponibles.get(k)
        ],
        "avisos": [
            {k: a.get(k) for k in ("id", "titulo", "texto", "filtro", "at", "por", "campana", "correos")}
            | {"alumnos": len(a.get("user_ids") or [])}
            for a in reversed(leer_avisos(s.avisos))
        ],
    }


async def avisar_clase(org_id: int, s: TareaSemana, datos: dict, autor: str, db_session: AsyncSession) -> dict:
    """Prepara un aviso a la clase. Apunta lo de la campana y devuelve a quién
    hay que mandar el correo (lo manda el router, en segundo plano)."""
    from src.services.users.emails import ACADEMY_URL

    filtro = str(datos.get("filtro") or "todos")
    if filtro not in FILTROS:
        raise TareaError("No sé a quién mandarlo")
    titulo = " ".join(str(datos.get("titulo") or "").split())[:140]
    texto = str(datos.get("texto") or "").strip()[:3000]
    if not titulo:
        raise TareaError("Ponle un título al aviso")
    if not texto:
        raise TareaError("Escribe el aviso")
    campana, correo = bool(datos.get("campana")), bool(datos.get("correo"))
    if not campana and not correo:
        raise TareaError("Elige por dónde: la campana, el correo o los dos")
    course = await curso_de(s.course_uuid, db_session)
    if course is None or course.org_id != org_id:
        raise TareaError("No existe esa clase", 404)
    url = f"{ACADEMY_URL.rstrip('/')}/course/{uuid_curso(course.course_uuid)}"
    correo_de = {"titulo": titulo, "html": _cuerpo_html(texto), "boton": "Ver la clase", "url": url}
    if datos.get("prueba"):
        return {"ok": True, "prueba": True, "correo": correo_de, "alumnos": 0}
    seg = await seguimiento(org_id, s.course_uuid, s.id, db_session)
    filas = quien_recibe(seg["alumnos"], filtro)
    if not filas:
        raise TareaError("No hay ningún alumno a quien mandarlo con ese filtro")
    ahora = _ahora()
    aviso = {
        "id": _uuid.uuid4().hex[:10],
        "titulo": titulo,
        "texto": texto,
        "filtro": filtro,
        "at": ahora,
        "por": (autor or "")[:120],
        "campana": campana,
        "correos": len(filas) if correo else 0,
        "user_ids": [f["user_id"] for f in filas] if campana else [],
    }
    lista = (leer_avisos(s.avisos) + [aviso])[-MAX_AVISOS:]
    s.avisos = json.dumps(lista, ensure_ascii=False)
    s.updated_at = ahora
    db_session.add(s)
    await db_session.commit()
    return {
        "ok": True,
        "alumnos": len(filas),
        "campana": campana,
        "correo": correo_de if correo else None,
        "destinos": [(f["email"], (f["nombre"] or "").split(" ")[0]) for f in filas if f.get("email")] if correo else [],
    }


def avisos_de_clase_para(semana: TareaSemana, user_id: int, curso: str, course_uuid: str, desde: str) -> list[dict]:
    """Los avisos de la campana de esta semana que le tocan a un alumno. Pura."""
    d = {"id": semana.id, "tema": semana.tema}
    return [
        aviso_de_clase(d, a, curso, course_uuid)
        for a in leer_avisos(getattr(semana, "avisos", ""))
        if a.get("campana") and user_id in (a.get("user_ids") or []) and (a.get("at") or "") >= desde
    ]


async def resumen_clases(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Las clases lado a lado (06/11/2026): la semana en curso de cada una con
    sus cifras, para ver de un vistazo cómo va cada grupo."""
    salida = []
    for c in await clases_en_directo(org_id, db_session):
        try:
            seg = await seguimiento(org_id, c["uuid"], None, db_session)
        except TareaError:
            continue
        if not seg.get("semana"):
            continue
        salida.append(
            {
                "course_uuid": c["uuid"],
                "nombre": c["nombre"],
                "semana": {k: seg["semana"].get(k) for k in ("id", "tema", "fecha", "limite", "tiene_tarea")},
                "cifras": seg["cifras"],
            }
        )
    return salida



# ── Pasar lista ─────────────────────────────────────────────────────────────


async def lista_de_clase(org_id: int, s: TareaSemana, db_session: AsyncSession) -> dict:
    """La lista de una semana para marcarla: cada alumno de la clase con lo que
    marcó el profe y, como pista, si la sala de Daily le vio."""
    from src.services.panel.camino import _sesiones_de
    from src.services.panel.tandas import hoy_nl
    from src.services.salas import salas

    course = await curso_de(s.course_uuid, db_session)
    if course is None or course.org_id != org_id:
        raise TareaError("No existe esa clase", 404)
    hoy = hoy_nl()
    marcas = leer_asistencia(getattr(s, "asistencia", ""))
    en_sala: Optional[set] = None
    if s.fecha and s.fecha <= hoy:
        sala = await _sala_del_curso(org_id, course, db_session)
        if sala and salas.clave_api():
            try:
                en_sala = asistentes_el_dia(await _sesiones_de(sala), s.fecha)
            except salas.SalaError:
                en_sala = None
    alumnos = await alumnos_del_curso(org_id, course, db_session)
    filas = []
    for a in alumnos:
        m = marcas.get(str(a["user_id"]))
        filas.append(
            {
                "user_id": a["user_id"],
                "nombre": a["nombre"],
                "fue": (bool(m["fue"]) if m is not None else None),
                "en_sala": (None if en_sala is None else str(a["user_id"]) in en_sala),
            }
        )
    ultima = max((m.get("at") or "" for m in marcas.values()), default="")
    por = next((m.get("por") for m in marcas.values() if (m.get("at") or "") == ultima), "") if ultima else ""
    return {
        "semana": {"id": s.id, "tema": s.tema, "fecha": s.fecha},
        "se_puede": bool(s.fecha) and s.fecha <= hoy,
        "alumnos": filas,
        "pasada": bool(marcas),
        "por": por or "",
        "at": ultima,
        "vinieron": sum(1 for f in filas if f["fue"]),
        "sala_conocida": en_sala is not None,
    }


async def pasar_lista(org_id: int, s: TareaSemana, marcas: dict, autor: str, db_session: AsyncSession) -> dict:
    """Guarda quién vino. `marcas`: {user_id: True/False/None}; None quita la
    marca (vuelve a valer la sala). Solo alumnos de esa clase y solo el día de
    la clase o después."""
    from src.services.panel.tandas import hoy_nl

    if not s.fecha or s.fecha > hoy_nl():
        raise TareaError("La lista se pasa el día de la clase o después", 409)
    course = await curso_de(s.course_uuid, db_session)
    if course is None or course.org_id != org_id:
        raise TareaError("No existe esa clase", 404)
    de_la_clase = {a["user_id"] for a in await alumnos_del_curso(org_id, course, db_session)}
    actual = leer_asistencia(getattr(s, "asistencia", ""))
    ahora = _ahora()
    for k, v in (marcas or {}).items():
        try:
            uid = int(k)
        except (TypeError, ValueError):
            continue
        if uid not in de_la_clase:
            continue
        if v is None:
            actual.pop(str(uid), None)
        else:
            actual[str(uid)] = {"fue": bool(v), "por": (autor or "Equipo")[:80], "at": ahora}
    s.asistencia = json.dumps(actual, ensure_ascii=False)
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return await lista_de_clase(org_id, s, db_session)

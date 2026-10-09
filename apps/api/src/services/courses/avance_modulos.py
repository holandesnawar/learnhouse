"""
Apertura de los módulos de la formación POR AVANCE (decidido el 09/10/2026).

Hasta ahora los módulos se abrían en fechas fijas iguales para todos
(`drip_content.fechas`: M3 el 21/09, M4 el 12/10…). Eso sirve para una
convocatoria que empieza junta, pero no para la entrada continua: quien entra
en noviembre se encontraría todo abierto de golpe.

**A quién se le aplica.** Solo a los ALUMNOS (rol 4) que entran en la escuela desde
`drip_content.avance.desde` (de serie, el 10/10/2026, en hora de Países
Bajos). La primera convocatoria se queda con sus fechas fijas, tal cual: el
usuario no quería tocar a los que ya están. "Entrar" es la fecha en que se
creó su enlace con la escuela (`user_organization.creation_date`), la misma
que usa el desfase por días, y que en la práctica es el día del pago (la
cuenta se crea al cobrar). Solo afecta a la FORMACIÓN (`FORMACION_UUID`): la
clase semanal y cualquier otro curso siguen con su goteo de siempre.

**Las reglas** (están aquí y en ningún otro sitio):

- La introducción y los módulos 1 y 2 se abren al entrar.
- El 3 se abre cuando han pasado **2 semanas** desde la entrada **y** el
  alumno ha terminado el 1 y el 2.
- Del 4 en adelante, cada uno se abre cuando ha terminado el anterior **y** ha
  pasado **1 semana** desde que se le abrió el anterior. Tras el 5 y el 7, la
  espera mínima es de **2 semanas**. La espera cuenta desde que se ABRIÓ el
  anterior, no desde que lo terminó: quien va rápido no espera de más.
- "Terminado" = el **80 %** de las clases del módulo hechas (`trail_step`).
  Con el 100 %, una sola clase sin marcar dejaba al alumno atascado.
- Un capítulo sin número que va después de los módulos (un "Examen final",
  si algún día se añade) sigue la regla general: 1 semana después del
  anterior y con el anterior terminado.
- El más rápido abre el 10 a los 77 días (semana 11-12).

**Lo que se abre no se cierra.** La tarea diaria apunta cada apertura en
`modulo_abierto`, y lo apuntado manda sobre el cálculo (ver la tabla). El
equipo también puede abrir un módulo a mano desde Progreso.

`calcular_aperturas` es pura y tiene test (`test_avance_modulos.py`).
"""

import logging
import math
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.modulo_abierto import ModuloAbierto
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization

logger = logging.getLogger(__name__)

#: El mismo que `apps/web/lib/nawar/cursos.ts` y `services/panel/avance.py`.
FORMACION_UUID = "8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"

UMBRAL = 0.8
ABIERTOS_AL_ENTRAR = (1, 2)
DIAS_PRIMERA_ESPERA = 14
DIAS_ESPERA = 7
DIAS_ESPERA_LARGA = 14
#: Tras estos módulos, el siguiente espera 2 semanas en vez de 1.
TRAS_ESPERA_LARGA = (5, 7)
#: Si nadie lo ha cambiado en el panel: quien entra desde el 10/10/2026.
DESDE_POR_DEFECTO = "2026-10-10"

ZONA = ZoneInfo("Europe/Amsterdam")
_NUM_MODULO = re.compile(r"^\s*(?:m[oó]dulo|module)\s*(\d+)", re.IGNORECASE)


# ── Piezas puras ─────────────────────────────────────────────────────────────


def ahora_utc() -> datetime:
    """Ahora en UTC sin zona, que es como se guardan las fechas en la base."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def leer_fecha(valor) -> datetime | None:
    """"2026-10-03 14:22:11.123456" (o ISO con T) → datetime sin zona, UTC."""
    if not valor:
        return None
    try:
        d = datetime.fromisoformat(str(valor).strip().replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if d.tzinfo is not None:
        d = d.astimezone(timezone.utc).replace(tzinfo=None)
    return d


def para_el_navegador(d: datetime | None) -> str | None:
    """ISO con la Z: el navegador la pasa a la hora de quien mira."""
    return f"{d.isoformat(timespec='seconds')}Z" if d else None


def numero_de_modulo(nombre) -> int | None:
    m = _NUM_MODULO.match(str(nombre or ""))
    return int(m.group(1)) if m else None


def ajustes_avance(drip: dict | None) -> dict:
    """`{"activo": bool, "desde": "AAAA-MM-DD"}`. Sin nada guardado, activo
    desde el 10/10/2026, que es lo que decidió el usuario."""
    bloque = (drip or {}).get("avance")
    if not isinstance(bloque, dict):
        return {"activo": True, "desde": DESDE_POR_DEFECTO}
    desde = str(bloque.get("desde") or "").strip()[:10]
    try:
        datetime.fromisoformat(desde)
    except (ValueError, TypeError):
        desde = DESDE_POR_DEFECTO
    return {"activo": bool(bloque.get("activo", True)), "desde": desde}


def dia_en_holanda(d: datetime) -> str:
    return d.replace(tzinfo=timezone.utc).astimezone(ZONA).date().isoformat()


def usa_avance(entrada: datetime | None, ajustes: dict) -> bool:
    """¿A quien entró en esta fecha le toca la apertura por avance?"""
    if entrada is None or not ajustes.get("activo"):
        return False
    return dia_en_holanda(entrada) >= ajustes["desde"]


def necesarias(total: int) -> int:
    """Clases que hay que hacer para dar un módulo por terminado (80 %)."""
    return math.ceil(total * UMBRAL - 1e-9) if total > 0 else 0


def terminado_el(clases: list[int], hechas: dict[int, datetime]) -> datetime | None:
    """Cuándo llegó al 80 % de estas clases, o None si aún no. Un módulo sin
    clases no se puede terminar: se queda abierto pero no abre el siguiente."""
    n = necesarias(len(clases))
    if n == 0:
        return None
    fechas = sorted(hechas[c] for c in set(clases) if c in hechas)
    return fechas[n - 1] if len(fechas) >= n else None


def _etiqueta(paso: dict) -> str:
    return f"el módulo {paso['numero']}" if paso["numero"] is not None else f"«{paso['nombre']}»"


def _lista(pasos: list[dict]) -> str:
    if len(pasos) == 1:
        return _etiqueta(pasos[0])
    numeros = [p["numero"] for p in pasos]
    if all(n is not None for n in numeros):
        return "los módulos " + ", ".join(str(n) for n in numeros[:-1]) + f" y {numeros[-1]}"
    return ", ".join(_etiqueta(p) for p in pasos[:-1]) + f" y {_etiqueta(pasos[-1])}"


def _despues_de(texto: str) -> str:
    """"después de el módulo 5" → "después del módulo 5"."""
    return ("después de " + texto).replace("después de el ", "después del ")


def _motivo(pendientes: list[dict]) -> str:
    # Si lo que falta ni siquiera está abierto todavía, contar clases confunde
    # ("¿cómo hago 4 clases de un módulo cerrado?"): basta con el orden.
    if any(not p["abierto"] for p in pendientes):
        return f"Se abre {_despues_de(_lista(pendientes))}."
    con_clases = [p for p in pendientes if p["total"] > 0]
    if not con_clases:
        return f"Se abre {_despues_de(_lista(pendientes))}, que estamos terminando de preparar."
    faltan = sum(max(0, p["necesarias"] - p["hechas"]) for p in con_clases)
    clases = "te falta 1 clase" if faltan == 1 else f"te faltan {faltan} clases"
    return f"Se abre cuando termines {_lista(pendientes)}: {clases}."


def calcular_aperturas(
    modulos: list[dict],
    entrada: datetime,
    hechas: dict[int, datetime],
    guardadas: dict[str, tuple[datetime, str]],
    ahora: datetime,
) -> dict[str, dict]:
    """Función pura, con test.

    `modulos`: los capítulos de la formación EN ORDEN, cada uno
    `{uuid, nombre, numero, clases: [ids de clase publicadas]}`.
    `hechas`: id de clase → cuándo la terminó. `guardadas`: chapter_uuid →
    (fecha, "avance"|"mano") de `modulo_abierto`.

    Devuelve, por módulo: `abierto`, `abre` (cuándo se abrió, o cuándo se
    abrirá si ya solo falta tiempo), `como` (entrada/avance/mano), `motivo`
    (por qué sigue cerrado, para el alumno) y las cuentas de clases.
    """
    out: dict[str, dict] = {}
    al_entrar: list[dict] = []
    anterior: dict | None = None
    en_entrada = True

    for m in modulos:
        clases = list(m.get("clases") or [])
        paso = {
            "uuid": m["uuid"],
            "nombre": m.get("nombre") or "",
            "numero": m.get("numero"),
            "total": len(clases),
            "necesarias": necesarias(len(clases)),
            "hechas": sum(1 for c in set(clases) if c in hechas),
            "terminado": terminado_el(clases, hechas),
            "abre": None,
            "abierto": False,
            "como": None,
            "motivo": None,
            "fecha_minima": None,
        }

        if en_entrada and (paso["numero"] is None or paso["numero"] in ABIERTOS_AL_ENTRAR):
            paso.update(abre=entrada, abierto=True, como="entrada")
            if paso["numero"] is not None:
                al_entrar.append(paso)
        else:
            if en_entrada:
                en_entrada = False
                requisitos = al_entrar or ([anterior] if anterior else [])
                minimo: datetime | None = entrada + timedelta(days=DIAS_PRIMERA_ESPERA)
            else:
                requisitos = [anterior] if anterior else []
                dias = DIAS_ESPERA_LARGA if anterior and anterior["numero"] in TRAS_ESPERA_LARGA else DIAS_ESPERA
                minimo = anterior["abre"] + timedelta(days=dias) if anterior and anterior["abre"] else None

            pendientes = [r for r in requisitos if r["terminado"] is None]
            if minimo is not None and not pendientes:
                paso.update(abre=max([minimo] + [r["terminado"] for r in requisitos]), como="avance")
            else:
                if pendientes:
                    paso["motivo"] = _motivo(pendientes)
                elif anterior is not None:
                    paso["motivo"] = f"Se abre {_despues_de(_etiqueta(anterior))}."
            if minimo is not None and minimo > ahora:
                paso["fecha_minima"] = minimo

            guardada = guardadas.get(paso["uuid"])
            # Lo apuntado (por la tarea diaria o a mano) manda si es antes.
            if guardada and (paso["abre"] is None or guardada[0] < paso["abre"]):
                paso.update(abre=guardada[0], como=guardada[1] or "avance", motivo=None)
            paso["abierto"] = paso["abre"] is not None and paso["abre"] <= ahora
            if paso["abierto"]:
                paso["motivo"] = None
                paso["fecha_minima"] = None

        out[paso["uuid"]] = paso
        anterior = paso
    return out


# ── Con la base de datos ─────────────────────────────────────────────────────


async def curso_formacion(db_session: AsyncSession) -> Course | None:
    return (
        await db_session.execute(
            select(Course).where(
                Course.course_uuid.in_([f"course_{FORMACION_UUID}", FORMACION_UUID])  # type: ignore[attr-defined]
            )
        )
    ).scalars().first()


async def modulos_en_orden(course_id: int, db_session: AsyncSession) -> list[dict]:
    """Los capítulos del curso en su orden, cada uno con sus clases publicadas.
    Los capítulos vacíos también salen: un módulo en preparación existe."""
    capitulos = (
        await db_session.execute(
            select(Chapter.id, Chapter.chapter_uuid, Chapter.name, CourseChapter.order)
            .join(CourseChapter, CourseChapter.chapter_id == Chapter.id)
            .where(CourseChapter.course_id == course_id)
        )
    ).all()
    capitulos = sorted(capitulos, key=lambda f: (f[3] if f[3] is not None else 10**6, f[0]))

    clases: dict[int, list[tuple[int, int]]] = {}
    for chapter_id, activity_id, orden in (
        await db_session.execute(
            select(ChapterActivity.chapter_id, ChapterActivity.activity_id, ChapterActivity.order)
            .join(Activity, Activity.id == ChapterActivity.activity_id)
            .where(ChapterActivity.course_id == course_id, Activity.published == True)  # noqa: E712
        )
    ).all():
        clases.setdefault(int(chapter_id), []).append((orden or 0, int(activity_id)))

    vistos: set[int] = set()
    out: list[dict] = []
    for chapter_id, chapter_uuid, nombre, _orden in capitulos:
        if chapter_id in vistos:
            continue
        vistos.add(chapter_id)
        out.append(
            {
                "uuid": chapter_uuid,
                "nombre": nombre or "",
                "numero": numero_de_modulo(nombre),
                "clases": [aid for _o, aid in sorted(clases.get(int(chapter_id), []))],
            }
        )
    return out


#: Solo los alumnos van por avance. El equipo (profes, moderadores, closer)
#: que entre después sigue las fechas de la convocatoria: el profe da la clase
#: compartiendo pantalla y tiene que ver lo mismo que la convocatoria.
ROL_ALUMNO = 4


async def fecha_de_entrada(user_id: int, org_id: int, db_session: AsyncSession) -> datetime | None:
    uo = (
        await db_session.execute(
            select(UserOrganization.creation_date).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    return leer_fecha(uo)


async def entrada_de_alumno(user_id: int, org_id: int, db_session: AsyncSession) -> datetime | None:
    """La fecha de entrada si es alumno; None si no lo es (o no está)."""
    fila = (
        await db_session.execute(
            select(UserOrganization.creation_date, UserOrganization.role_id).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).first()
    if not fila or fila[1] != ROL_ALUMNO:
        return None
    return leer_fecha(fila[0])


async def clases_hechas(user_id: int, course_id: int, db_session: AsyncSession) -> dict[int, datetime]:
    hechas: dict[int, datetime] = {}
    for aid, fecha in (
        await db_session.execute(
            select(TrailStep.activity_id, TrailStep.creation_date).where(
                TrailStep.course_id == course_id,
                TrailStep.user_id == user_id,
                TrailStep.complete == True,  # noqa: E712
            )
        )
    ).all():
        d = leer_fecha(fecha)
        if d is None:
            continue
        if int(aid) not in hechas or d < hechas[int(aid)]:
            hechas[int(aid)] = d
    return hechas


async def aperturas_guardadas(user_id: int, db_session: AsyncSession) -> dict[str, tuple[datetime, str]]:
    out: dict[str, tuple[datetime, str]] = {}
    for fila in (
        await db_session.execute(select(ModuloAbierto).where(ModuloAbierto.user_id == user_id))
    ).scalars().all():
        d = leer_fecha(fila.abierto_at)
        if d is None:
            continue
        if fila.chapter_uuid not in out or d < out[fila.chapter_uuid][0]:
            out[fila.chapter_uuid] = (d, fila.como or "avance")
    return out


async def estado_avance(
    user_id: int,
    org_id: int,
    db_session: AsyncSession,
    *,
    drip: dict | None = None,
    ahora: datetime | None = None,
) -> dict[str, dict] | None:
    """Los módulos de la formación de este alumno, con su apertura por avance.

    None si no le toca (entró antes de la fecha de corte, el goteo está
    apagado o no hay formación). Si algo falla al leer, también None: el
    alumno se queda con el goteo de siempre en vez de con todo cerrado.
    """
    try:
        if drip is None:
            from src.services.courses.locks import get_drip_settings

            drip = await get_drip_settings(org_id, db_session)
        if not drip:
            return None
        ajustes = ajustes_avance(drip)
        entrada = await entrada_de_alumno(user_id, org_id, db_session)
        if not usa_avance(entrada, ajustes):
            return None
        curso = await curso_formacion(db_session)
        if curso is None or curso.id is None or curso.org_id != org_id:
            return None
        modulos = await modulos_en_orden(curso.id, db_session)
        if not modulos:
            return None
        return calcular_aperturas(
            modulos,
            entrada,  # type: ignore[arg-type]
            await clases_hechas(user_id, curso.id, db_session),
            await aperturas_guardadas(user_id, db_session),
            ahora or ahora_utc(),
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo calcular la apertura por avance (usuario %s)", user_id)
        return None


async def ids_con_avance(org_id: int, db_session: AsyncSession, drip: dict | None = None) -> set[int]:
    """Quién de la escuela está en la apertura por avance (por su fecha de
    entrada). Sirve para que los avisos de las fechas fijas no le lleguen."""
    if drip is None:
        from src.services.courses.locks import get_drip_settings

        drip = await get_drip_settings(org_id, db_session)
    if not drip:
        return set()
    ajustes = ajustes_avance(drip)
    if not ajustes["activo"]:
        return set()
    out: set[int] = set()
    for user_id, creada in (
        await db_session.execute(
            select(UserOrganization.user_id, UserOrganization.creation_date).where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == ROL_ALUMNO,
            )
        )
    ).all():
        if usa_avance(leer_fecha(creada), ajustes):
            out.add(int(user_id))
    return out


async def uuids_de_la_formacion(org_id: int, db_session: AsyncSession) -> set[str]:
    curso = await curso_formacion(db_session)
    if curso is None or curso.id is None or curso.org_id != org_id:
        return set()
    return {m["uuid"] for m in await modulos_en_orden(curso.id, db_session)}


async def guardar_aperturas(org_id: int, user_ids: list[int], db_session: AsyncSession) -> list[tuple[int, str, datetime]]:
    """Apunta en `modulo_abierto` lo que el avance ya le ha abierto a cada
    alumno y aún no estaba apuntado. Lo llama la tarea diaria. Devuelve lo
    apuntado hoy (alumno, módulo, cuándo se abrió) para avisarles."""
    from src.services.courses.locks import get_drip_settings

    drip = await get_drip_settings(org_id, db_session)
    nuevas: list[tuple[int, str, datetime]] = []
    for user_id in user_ids:
        estado = await estado_avance(user_id, org_id, db_session, drip=drip)
        if not estado:
            continue
        guardadas = await aperturas_guardadas(user_id, db_session)
        for cu, paso in estado.items():
            if paso["como"] != "avance" or not paso["abierto"] or cu in guardadas:
                continue
            db_session.add(
                ModuloAbierto(
                    user_id=user_id,
                    chapter_uuid=cu,
                    abierto_at=paso["abre"].isoformat(timespec="seconds"),
                    como="avance",
                )
            )
            nuevas.append((user_id, cu, paso["abre"]))
    if nuevas:
        await db_session.commit()
    return nuevas


# ── Para el panel (Alumnos → Progreso) ───────────────────────────────────────


def _para_el_equipo(motivo: str | None) -> str | None:
    """El motivo está escrito para el alumno ("te faltan"); en el panel se lee
    en tercera persona."""
    if not motivo:
        return motivo
    return (
        motivo.replace("cuando termines", "cuando termine")
        .replace("te faltan", "le faltan")
        .replace("te falta", "le falta")
    )


def resumen_para_el_panel(estado: dict[str, dict]) -> list[dict]:
    return [
        {
            "uuid": p["uuid"],
            "nombre": p["nombre"],
            "numero": p["numero"],
            "abierto": p["abierto"],
            "como": p["como"],
            "abre": para_el_navegador(p["abre"]),
            "fecha_minima": para_el_navegador(p["fecha_minima"]),
            "motivo": _para_el_equipo(p["motivo"]),
            "hechas": p["hechas"],
            "necesarias": p["necesarias"],
            "total": p["total"],
        }
        for p in estado.values()
    ]


async def _comprobar(org_id: int, user_id: int, chapter_uuid: str, db_session: AsyncSession) -> str | None:
    """Motivo por el que no se puede tocar, o None si vale."""
    if await fecha_de_entrada(user_id, org_id, db_session) is None:
        return "Ese alumno no está en la escuela"
    if chapter_uuid not in await uuids_de_la_formacion(org_id, db_session):
        return "Ese módulo no es de la formación"
    return None


def _olvidar_cache() -> None:
    try:
        from src.services.courses.cache import invalidate_course_meta_cache

        invalidate_course_meta_cache(f"course_{FORMACION_UUID}")
        invalidate_course_meta_cache(FORMACION_UUID)
    except Exception:  # noqa: BLE001
        pass


async def abrir_a_mano(org_id: int, user_id: int, chapter_uuid: str, por: str, db_session: AsyncSession) -> dict:
    """El equipo le abre un módulo a un alumno sin esperar a la regla. Desde
    ahí cuenta como abierto ese día: el siguiente espera su semana desde hoy."""
    error = await _comprobar(org_id, user_id, chapter_uuid, db_session)
    if error:
        return {"ok": False, "motivo": error}
    ya = (
        await db_session.execute(
            select(ModuloAbierto).where(
                ModuloAbierto.user_id == user_id,
                ModuloAbierto.chapter_uuid == chapter_uuid,
            )
        )
    ).scalars().first()
    if ya is None:
        db_session.add(
            ModuloAbierto(
                user_id=user_id,
                chapter_uuid=chapter_uuid,
                abierto_at=ahora_utc().isoformat(timespec="seconds"),
                como="mano",
                por=(por or "")[:120],
            )
        )
        await db_session.commit()
    _olvidar_cache()
    return {"ok": True}


async def quitar_apertura_a_mano(org_id: int, user_id: int, chapter_uuid: str, db_session: AsyncSession) -> dict:
    """Deshace "Abrir ya". Solo lo abierto A MANO: lo que abrió el avance no
    se cierra (ver la cabecera)."""
    error = await _comprobar(org_id, user_id, chapter_uuid, db_session)
    if error:
        return {"ok": False, "motivo": error}
    filas = (
        await db_session.execute(
            select(ModuloAbierto).where(
                ModuloAbierto.user_id == user_id,
                ModuloAbierto.chapter_uuid == chapter_uuid,
                ModuloAbierto.como == "mano",
            )
        )
    ).scalars().all()
    for f in filas:
        await db_session.delete(f)
    if filas:
        await db_session.commit()
    _olvidar_cache()
    return {"ok": True, "quitadas": len(filas)}

"""
El camino de 16 semanas de cada alumno (27/10/2026): Panel → Alumnos → Camino.

Pedido del usuario: "ver en columnas cada alumno: cuándo entró y cuántas
clases tomó ya, así veo cuál es cuál y cuándo se termina su camino de 16
clases". Decidido con él: una TABLA, una fila por alumno, con las DOS cosas:

- **La semana del camino**: desde el día que entró (el del pago,
  `user_organization.creation_date`, en hora de Países Bajos, el mismo que usa
  la apertura por avance), «Semana 6 de 16» y el día en que termina (el último
  de la semana 16). No mira si ha ido a clase o no.
- **Clases en directo a las que ha ido de verdad**: las cuenta la sala de la
  escuela (Daily). Cada entrada lleva el id del alumno (`user_id` en la
  entrada que firma la escuela, `salas.py`), y Daily guarda cada sesión con
  quién estuvo y cuánto rato (`GET /meetings`). Cuenta una vez por sesión y
  solo si estuvo al menos `MINIMO_SEG` (10 min: entrar y salir no es ir a
  clase). ⚠️ **Solo desde que se usan las salas de la escuela** (27/10/2026):
  lo que se hizo antes en Zoom no lo sabe nadie aquí.

Salen los alumnos (rol 4) sin las pruebas (fuera de los números) ni el grupo
Testers, con sus grupos (Beta · Grupo 1, Programa nuevo…) para saber quién es
quién. Solo administradores (la ruta lo comprueba).

La asistencia es en blando: si Daily no contesta, la tabla sale igual con las
semanas y dice por qué falta lo otro. Caché de 5 min por sala.
"""

import logging
import time
from datetime import date, timedelta
from typing import Any, Iterable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.organization_config import OrganizationConfig
from src.db.tareas import TareaSemana
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User
from src.services.panel.tandas import dia_nl, hoy_nl
from src.services.salas import salas

logger = logging.getLogger(__name__)

SEMANAS = 16
MINIMO_SEG = 600
ROL_ALUMNO = 4
_CACHE_SEG = 300
_cache: dict[str, tuple[float, list[dict]]] = {}


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def semana_del_camino(entro: str, hoy: str, semanas: int = SEMANAS) -> dict:
    """En qué semana va y cuándo termina. `entro` y `hoy`: AAAA-MM-DD.

    La semana 1 es el día que entra y los seis siguientes. Termina el último
    día de la semana `semanas`. Pasado ese día: «terminado».
    """
    try:
        d0 = date.fromisoformat(entro[:10])
        d1 = date.fromisoformat(hoy[:10])
    except (TypeError, ValueError):
        return {"semana": 0, "termina": "", "estado": "sin-fecha", "dias_quedan": None}
    termina = d0 + timedelta(days=semanas * 7 - 1)
    dias = (d1 - d0).days
    if dias < 0:
        return {"semana": 0, "termina": termina.isoformat(), "estado": "sin-empezar", "dias_quedan": (termina - d1).days}
    semana = dias // 7 + 1
    if d1 > termina:
        estado = "terminado"
    elif semana >= semanas - 1:
        estado = "ultimas"
    else:
        estado = "en-curso"
    return {
        "semana": min(semana, semanas),
        "termina": termina.isoformat(),
        "estado": estado,
        "dias_quedan": (termina - d1).days,
    }


def asistencias(sesiones: Iterable[dict], minimo_seg: int = MINIMO_SEG) -> dict[str, set[str]]:
    """{id del alumno: {ids de las sesiones a las que fue}} a partir de lo que
    devuelve Daily. Una vez por sesión, y solo si estuvo `minimo_seg` o más
    (sumando si entró y salió varias veces de la misma sesión)."""
    rato: dict[tuple[str, str], int] = {}
    for s in sesiones or []:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "")
        for p in s.get("participants") or []:
            uid = str((p or {}).get("user_id") or "").strip()
            if not sid or not uid:
                continue
            try:
                seg = int((p or {}).get("duration") or 0)
            except (TypeError, ValueError):
                seg = 0
            rato[(uid, sid)] = rato.get((uid, sid), 0) + seg
    salida: dict[str, set[str]] = {}
    for (uid, sid), seg in rato.items():
        if seg >= minimo_seg:
            salida.setdefault(uid, set()).add(sid)
    return salida


def dias_en_sala(sesiones: Iterable[dict], minimo_seg: int = MINIMO_SEG) -> dict[str, set[str]]:
    """{id del alumno: {días (AAAA-MM-DD, hora NL) en que estuvo en la sala}}.
    Mismo criterio que `asistencias` (10 min por sesión), pero por DÍA: así se
    puede juntar con la lista que pasa el profe, que es por clase y día, sin
    contar dos veces la misma clase (07/11/2026)."""
    from datetime import datetime, timezone

    dia_de: dict[str, str] = {}
    for s in sesiones or []:
        if not isinstance(s, dict) or not s.get("id"):
            continue
        inicio = s.get("start_time")
        try:
            cuando = datetime.fromtimestamp(int(inicio), tz=timezone.utc).isoformat() if inicio else ""
        except (TypeError, ValueError, OverflowError, OSError):
            cuando = str(inicio or "")
        # Sin hora de inicio, la sesión cuenta igual, una vez (por su id).
        dia_de[str(s["id"])] = dia_nl(cuando) or f"sesion:{s['id']}"
    salida: dict[str, set[str]] = {}
    for uid, sids in asistencias(sesiones, minimo_seg).items():
        dias = {dia_de.get(sid, "") for sid in sids} - {""}
        if dias:
            salida[uid] = dias
    return salida


def juntar_con_la_lista(en_sala: dict[str, set[str]], listas: dict[str, dict[str, bool]]) -> dict[str, set[str]]:
    """Los días que fue cada alumno: los de la sala y, por encima, lo que marcó
    el profe en la lista de cada clase (`listas` = {día: {id: fue}}). Si el
    profe dice que no vino, no cuenta aunque la sala le viera."""
    salida = {uid: set(dias) for uid, dias in (en_sala or {}).items()}
    for dia, marcas in (listas or {}).items():
        for uid, fue in (marcas or {}).items():
            if fue:
                salida.setdefault(str(uid), set()).add(dia)
            elif str(uid) in salida:
                salida[str(uid)].discard(dia)
    return {uid: dias for uid, dias in salida.items() if dias}


# ── Daily ───────────────────────────────────────────────────────────────────


async def _sesiones_de(sala: str) -> list[dict]:
    """Las sesiones de una sala, con quién estuvo (caché de 5 min)."""
    ahora = time.time()
    guardado = _cache.get(sala)
    if guardado and ahora - guardado[0] < _CACHE_SEG:
        return guardado[1]
    todas: list[dict] = []
    despues = ""
    for _ in range(20):  # 20 páginas de 100 sesiones: de sobra
        params: dict[str, Any] = {"room": sala, "limit": 100}
        if despues:
            params["starting_after"] = despues
        datos = await salas._daily("GET", "/meetings", params=params)
        pagina = [s for s in (datos.get("data") or []) if isinstance(s, dict)]
        for s in pagina:
            if "participants" not in s and s.get("id"):
                # Por si Daily no manda la lista dentro (sesiones grandes).
                try:
                    p = await salas._daily("GET", f"/meetings/{s['id']}/participants")
                    s["participants"] = p.get("data") or []
                except salas.SalaError:
                    s["participants"] = []
        todas.extend(pagina)
        if len(pagina) < 100:
            break
        despues = str(pagina[-1].get("id") or "")
        if not despues:
            break
    _cache[sala] = (ahora, todas)
    return todas


async def _cursos_con_sala(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Los cursos que han tenido alguna vez la sala encendida."""
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    todas = (fila.config or {}).get(salas.CLAVE) if fila and isinstance(fila.config, dict) else None
    if not isinstance(todas, dict):
        return []
    uuids = [u for u, a in todas.items() if isinstance(a, dict) and (a.get("activo") or a.get("directo"))]
    if not uuids:
        return []
    nombres = {
        salas.uuid_curso(c.course_uuid): c.name
        for c in (
            await db_session.execute(
                select(Course).where(Course.org_id == org_id, Course.course_uuid.in_([f"course_{u}" for u in uuids]))  # type: ignore[attr-defined]
            )
        ).scalars().all()
    }
    return [
        {"uuid": u, "nombre": salas.nombre_con_etiqueta(fila.config, u, nombres[u]), "sala": salas.nombre_sala(u)}
        for u in uuids
        if u in nombres
    ]


# ── La tabla ────────────────────────────────────────────────────────────────


async def camino(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.contactos.metricas import ids_excluidos
    from src.services.panel.testers import ids_testers

    fuera = await ids_excluidos(db_session) | await ids_testers(org_id, db_session)
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

    # Asistencia a las clases en directo, curso a curso: la sala de Daily y,
    # por encima, la lista que pasa el profe (07/11/2026). Por días.
    from src.services.tareas.tareas import leer_asistencia

    cursos = await _cursos_con_sala(org_id, db_session)
    listas: dict[str, dict[str, dict[str, bool]]] = {}
    for sem in (
        await db_session.execute(select(TareaSemana).where(TareaSemana.org_id == org_id))
    ).scalars().all():
        marcas = leer_asistencia(getattr(sem, "asistencia", ""))
        if marcas and sem.fecha:
            del_dia = listas.setdefault(salas.uuid_curso(sem.course_uuid), {}).setdefault(sem.fecha, {})
            del_dia.update({uid: bool(m["fue"]) for uid, m in marcas.items()})
    # Las clases con lista pero sin sala (las de Zoom) también cuentan.
    con_sala = {c["uuid"] for c in cursos}
    faltan = [u for u in listas if u not in con_sala]
    if faltan:
        fila_cfg = (
            await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
        ).scalars().first()
        for c in (
            await db_session.execute(
                select(Course).where(Course.org_id == org_id, Course.course_uuid.in_([f"course_{u}" for u in faltan]))  # type: ignore[attr-defined]
            )
        ).scalars().all():
            u = salas.uuid_curso(c.course_uuid)
            cursos.append({"uuid": u, "nombre": salas.nombre_con_etiqueta(fila_cfg.config if fila_cfg else {}, u, c.name), "sala": ""})
    por_curso: dict[str, dict[str, set[str]]] = {}
    aviso = ""
    sin_clave = bool([c for c in cursos if c["sala"]]) and not salas.clave_api()
    if sin_clave:
        aviso = "Falta la clave de Daily en Railway: solo cuentan las clases con la lista pasada por el profe."
    for c in cursos:
        en_sala: dict[str, set[str]] = {}
        if c["sala"] and not sin_clave:
            try:
                en_sala = dias_en_sala(await _sesiones_de(c["sala"]))
            except salas.SalaError as exc:
                logger.info("Asistencia de %s: %s", c["sala"], exc.mensaje)
                aviso = f"No se pudo leer la asistencia de Daily: {exc.mensaje}"
        por_curso[c["uuid"]] = juntar_con_la_lista(en_sala, listas.get(c["uuid"], {}))

    hoy = hoy_nl()
    alumnos = []
    for m, u in filas:
        uid = int(m.user_id)
        entro = dia_nl(m.creation_date)
        detalle = []
        total = 0
        for c in cursos:
            n = len(por_curso.get(c["uuid"], {}).get(str(uid), set()))
            if n:
                detalle.append({"curso": c["nombre"], "n": n})
                total += n
        alumnos.append(
            {
                "user_id": uid,
                "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
                "email": (u.email or "").strip().lower(),
                "grupos": sorted(grupos.get(uid, [])),
                "entro": entro,
                **semana_del_camino(entro, hoy),
                "clases_directo": total,
                "clases_por_curso": detalle,
            }
        )
    alumnos.sort(key=lambda a: (a["entro"] or "9999"), reverse=True)
    return {
        "semanas": SEMANAS,
        "hoy": hoy,
        "alumnos": alumnos,
        "cursos": [{"uuid": c["uuid"], "nombre": c["nombre"]} for c in cursos],
        "minimo_min": MINIMO_SEG // 60,
        "con_lista": bool(listas),
        "aviso": aviso,
    }

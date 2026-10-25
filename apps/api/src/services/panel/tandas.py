"""
Tandas de alumnos y grupos automáticos (25/10/2026).

Pedido del usuario: "a partir de mañana, los nuevos van en un grupo nuevo; no
ven la clase semanal como los de la beta… separar con etiquetas, por ejemplo
matrículas noviembre… reciben una masterclass en directo y spreekuren… si
alguien hace el pago, me gustaría recibir un mail yo primero".

Decidido con él ese día:
- **La bienvenida sale AL MOMENTO** (no se retrasa una semana): el alumno entra
  ya metido en sus grupos y solo ve lo suyo.
- **Dos grupos a la vez**: el de la TANDA («Matrícula octubre 2026», para saber
  de qué tanda es; se crea solo cada mes, o se fija a mano con `tanda`) y el
  del PROGRAMA («Programa nuevo»: el que abre la masterclass y los spreekuren).
- **La comunidad, separada del todo**: cada canal se cierra a su grupo desde el
  panel (Comunidad → canal → Acceso). Esto NO lo hace el código: así se ve y
  se puede deshacer.

Cómo va:
- org_config `tandas`: `activo`, `desde` (AAAA-MM-DD, hora de Países Bajos),
  `programa_id` (el grupo del programa; si no existe, se crea «Programa nuevo»
  y se apunta su id, así que renombrarlo en el panel no rompe nada) y `tanda`
  (nombre fijo; vacío = por el mes en que paga).
- Al dar de alta tras un pago (`_provision_after_payment`, la primera vez; y el
  alta a mano de quien no tenía cuenta), `al_entrar` mete al alumno en los dos
  grupos y avisa a los administradores con el correo «Alumno nuevo». El correo
  sale SIEMPRE, también con los grupos apagados. Nunca lanza: el alumno ya ha
  pagado y su alta no puede fallar por esto.
- **Beta**: `meter_en_beta` crea el grupo «Beta» y mete a todos los alumnos
  (rol 4) que no están en el programa nuevo. Se usa una vez y ANTES de cerrar
  la clase semanal al grupo Beta: si se cierra antes, la beta se queda sin su
  clase. Se puede repetir sin miedo (no duplica).
- `resumen` enseña cada grupo con su gente y QUIÉN VE cada curso y cada canal
  (todos, o solo tal grupo), y avisa del error que más se va a cometer: un
  curso o canal con grupo pero marcado como público, que lo ve todo el mundo
  igual (`quien_lo_ve`).
"""

import json
import logging
import unicodedata
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
CLAVE = "tandas"
NOMBRE_PROGRAMA = "Programa nuevo"
NOMBRE_BETA = "Beta"
ROL_ALUMNO = 4

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


# ── lógica pura (con test) ─────────────────────────────────────────────────


def normalizar(nombre: str) -> str:
    return unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode().strip().lower()


def leer_config(guardado: Any) -> dict:
    """La configuración de las tandas, con valores seguros."""
    g = guardado if isinstance(guardado, dict) else {}
    try:
        programa_id = int(g.get("programa_id") or 0)
    except (TypeError, ValueError):
        programa_id = 0
    desde = str(g.get("desde") or "")[:10]
    return {
        "activo": bool(g.get("activo")),
        "desde": desde,
        "programa_id": programa_id,
        "tanda": str(g.get("tanda") or "").strip()[:100],
    }


def nombre_tanda(dia: str, fija: str = "") -> str:
    """«Matrícula octubre 2026» para un día AAAA-MM-DD, o el nombre fijo."""
    if (fija or "").strip():
        return fija.strip()[:100]
    anio, mes = int(dia[:4]), int(dia[5:7])
    return f"Matrícula {MESES[mes - 1]} {anio}"


def toca(config: dict, hoy: str) -> bool:
    """Si a quien paga hoy (AAAA-MM-DD, hora NL) se le meten los grupos."""
    return bool(config.get("activo")) and (not config.get("desde") or hoy >= config["desde"])


def quien_lo_ve(publico: bool, grupos: list[str], publicado: bool = True) -> dict:
    """Quién ve un curso o un canal, con las reglas de LearnHouse
    (security/rbac/resource_access.py): público y publicado = todo el mundo,
    aunque tenga grupos; sin grupos = cualquiera que haya entrado; con grupos y
    no público = solo esos grupos (y el equipo)."""
    if not publicado:
        return {"texto": "Sin publicar: solo el equipo", "aviso": ""}
    if publico:
        return {
            "texto": "Todo el mundo",
            "aviso": "Tiene grupos, pero está marcado como público: lo ve todo el mundo igual." if grupos else "",
        }
    if not grupos:
        return {"texto": "Todos los que han entrado", "aviso": ""}
    return {"texto": "Solo " + ", ".join(grupos), "aviso": ""}


def hoy_nl(ahora: Optional[datetime] = None) -> str:
    return (ahora or datetime.now(ZONA)).astimezone(ZONA).date().isoformat()


# ── configuración ──────────────────────────────────────────────────────────


async def _fila_config(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    q = select(OrganizationConfig)
    if org_id is not None:
        q = q.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


async def config(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    fila = await _fila_config(db_session, org_id)
    return leer_config((fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None)


async def guardar(org_id: int, cambios: dict, db_session: AsyncSession) -> dict:
    fila = await _fila_config(db_session, org_id)
    if fila is None:
        return {"ok": False, "motivo": "La escuela no tiene configuración"}
    datos = json.loads(json.dumps(fila.config or {}))
    nuevo = leer_config({**leer_config(datos.get(CLAVE)), **cambios})
    datos[CLAVE] = nuevo
    fila.config = datos
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, **nuevo}


# ── grupos ─────────────────────────────────────────────────────────────────


async def _grupos(org_id: int, db_session: AsyncSession) -> list[UserGroup]:
    return list((await db_session.execute(select(UserGroup).where(UserGroup.org_id == org_id))).scalars().all())


async def _crear_grupo(org_id: int, nombre: str, descripcion: str, db_session: AsyncSession) -> UserGroup:
    ahora = str(datetime.now())
    grupo = UserGroup(
        name=nombre,
        description=descripcion,
        org_id=org_id,
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=ahora,
        update_date=ahora,
    )
    db_session.add(grupo)
    await db_session.commit()
    await db_session.refresh(grupo)
    return grupo


async def _grupo_por_nombre(org_id: int, nombre: str, descripcion: str, db_session: AsyncSession) -> UserGroup:
    buscado = normalizar(nombre)
    for g in await _grupos(org_id, db_session):
        if normalizar(g.name) == buscado:
            return g
    return await _crear_grupo(org_id, nombre, descripcion, db_session)


async def grupo_del_programa(org_id: int, db_session: AsyncSession, crear: bool = True) -> Optional[UserGroup]:
    """El grupo del programa nuevo: el apuntado en la configuración; si no hay
    o se borró, «Programa nuevo» (se crea y se apunta)."""
    cfg = await config(db_session, org_id)
    if cfg["programa_id"]:
        for g in await _grupos(org_id, db_session):
            if g.id == cfg["programa_id"]:
                return g
    if not crear:
        return None
    grupo = await _grupo_por_nombre(
        org_id, NOMBRE_PROGRAMA, "Alumnos con masterclass semanal y spreekuren (desde el 26/10/2026).", db_session
    )
    await guardar(org_id, {"programa_id": grupo.id}, db_session)
    return grupo


async def _miembros(grupo_id: int, db_session: AsyncSession) -> set[int]:
    return {
        int(u)
        for u in (
            await db_session.execute(select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == grupo_id))
        ).scalars().all()
    }


async def _meter(user_ids: list[int], grupo: UserGroup, db_session: AsyncSession) -> int:
    """Mete a esas personas en el grupo (las que ya estaban, no). Cuántas entran."""
    ya = await _miembros(grupo.id, db_session)
    ahora = str(datetime.now())
    nuevos = 0
    for uid in user_ids:
        if uid in ya:
            continue
        db_session.add(
            UserGroupUser(usergroup_id=grupo.id, user_id=uid, org_id=grupo.org_id, creation_date=ahora, update_date=ahora)
        )
        ya.add(uid)
        nuevos += 1
    if nuevos:
        await db_session.commit()
    return nuevos


async def asignar(user_id: int, org_id: int, db_session: AsyncSession, ahora: Optional[datetime] = None) -> list[str]:
    """Mete a un alumno que acaba de pagar en el programa y en su tanda, si las
    tandas están encendidas. Devuelve los nombres de los grupos."""
    cfg = await config(db_session, org_id)
    hoy = hoy_nl(ahora)
    if not toca(cfg, hoy):
        return []
    programa = await grupo_del_programa(org_id, db_session)
    tanda = await _grupo_por_nombre(
        org_id, nombre_tanda(hoy, cfg["tanda"]), "Alumnos que se matricularon en esta tanda.", db_session
    )
    for grupo in (programa, tanda):
        if grupo is not None:
            await _meter([user_id], grupo, db_session)
    return [g.name for g in (programa, tanda) if g is not None]


async def _org_de(user_id: int, db_session: AsyncSession) -> Optional[int]:
    from src.db.user_organizations import UserOrganization

    return (
        await db_session.execute(select(UserOrganization.org_id).where(UserOrganization.user_id == user_id))
    ).scalars().first()


async def _telefono(email: str, db_session: AsyncSession) -> str:
    from src.db.enrollment import Enrollment

    try:
        filas = (
            await db_session.execute(select(Enrollment).where(Enrollment.email == email))
        ).scalars().all()
        for fila in sorted(filas, key=lambda f: f.updated_at or f.created_at or "", reverse=True):
            if (fila.phone or "").strip():
                return fila.phone.strip()
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo leer el teléfono de %s", email, exc_info=True)
    return ""


async def al_entrar(user, nombre: str, email: str, db_session: AsyncSession, avisar: bool = True) -> list[str]:
    """Lo que pasa cuando un alumno nuevo entra tras pagar: sus grupos y el
    correo al equipo. Nunca lanza."""
    grupos: list[str] = []
    try:
        org_id = await _org_de(user.id, db_session)
        if org_id:
            grupos = await asignar(user.id, org_id, db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo meter a %s en sus grupos", email)
    if not avisar:
        return grupos
    try:
        from src.services.contactos.llamadas import emails_de_administradores
        from src.services.users.emails import send_alumno_nuevo_email

        datos = {
            "nombre": (nombre or getattr(user, "first_name", "") or "").strip(),
            "email": email,
            "telefono": await _telefono(email, db_session),
            "grupos": grupos,
        }
        for destino in await emails_de_administradores(db_session):
            try:
                send_alumno_nuevo_email(destino, datos)
            except Exception:  # noqa: BLE001
                logger.exception("No salió el aviso de alumno nuevo a un administrador")
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar del alumno nuevo %s", email)
    return grupos


async def meter_en_beta(org_id: int, db_session: AsyncSession) -> dict:
    """Crea «Beta» y mete a todos los alumnos que no están en el programa nuevo."""
    from src.db.user_organizations import UserOrganization

    alumnos = [
        int(u)
        for u in (
            await db_session.execute(
                select(UserOrganization.user_id).where(
                    UserOrganization.org_id == org_id, UserOrganization.role_id == ROL_ALUMNO
                )
            )
        ).scalars().all()
    ]
    programa = await grupo_del_programa(org_id, db_session, crear=False)
    del_programa = await _miembros(programa.id, db_session) if programa else set()
    beta = await _grupo_por_nombre(org_id, NOMBRE_BETA, "Alumnos de la primera convocatoria (clase semanal).", db_session)
    entran = await _meter([u for u in alumnos if u not in del_programa], beta, db_session)
    return {"ok": True, "grupo": beta.name, "entran": entran, "total": len(await _miembros(beta.id, db_session))}


async def resumen(org_id: int, db_session: AsyncSession) -> dict:
    """La pantalla de Tandas: la configuración, cada grupo con su gente y quién
    ve cada curso y cada canal."""
    from src.db.communities.communities import Community
    from src.db.courses.courses import Course
    from src.db.user_organizations import UserOrganization

    cfg = await config(db_session, org_id)
    grupos = await _grupos(org_id, db_session)
    por_id = {g.id: g for g in grupos}
    alumnos = {
        int(u)
        for u in (
            await db_session.execute(
                select(UserOrganization.user_id).where(
                    UserOrganization.org_id == org_id, UserOrganization.role_id == ROL_ALUMNO
                )
            )
        ).scalars().all()
    }
    lista = []
    con_grupo_clave: set[int] = set()
    for g in sorted(grupos, key=lambda x: normalizar(x.name)):
        miembros = await _miembros(g.id, db_session)
        clave = g.id == cfg["programa_id"] or normalizar(g.name) == normalizar(NOMBRE_BETA)
        if clave:
            con_grupo_clave |= miembros
        lista.append(
            {
                "id": g.id,
                "nombre": g.name,
                "personas": len(miembros),
                "alumnos": len(miembros & alumnos),
                "es_programa": g.id == cfg["programa_id"],
                "es_beta": normalizar(g.name) == normalizar(NOMBRE_BETA),
                "es_tanda": normalizar(g.name).startswith("matricula "),
            }
        )

    enlaces = (await db_session.execute(select(UserGroupResource).where(UserGroupResource.org_id == org_id))).scalars().all()
    grupos_de: dict[str, list[str]] = {}
    for e in enlaces:
        if e.usergroup_id in por_id:
            grupos_de.setdefault(e.resource_uuid, []).append(por_id[e.usergroup_id].name)

    cursos = []
    for c in (await db_session.execute(select(Course).where(Course.org_id == org_id))).scalars().all():
        g = sorted(grupos_de.get(c.course_uuid, []))
        cursos.append(
            {
                "nombre": c.name,
                "uuid": c.course_uuid.replace("course_", "", 1),
                "grupos": g,
                **quien_lo_ve(bool(c.public), g, bool(c.published)),
            }
        )
    canales = []
    for c in (await db_session.execute(select(Community).where(Community.org_id == org_id))).scalars().all():
        g = sorted(grupos_de.get(c.community_uuid, []))
        canales.append({"nombre": c.name, "uuid": c.community_uuid, "grupos": g, **quien_lo_ve(bool(c.public), g)})

    return {
        **cfg,
        "tanda_de_hoy": nombre_tanda(hoy_nl(), cfg["tanda"]),
        "grupos": lista,
        "alumnos": len(alumnos),
        "alumnos_sin_grupo": len(alumnos - con_grupo_clave),
        "cursos": sorted(cursos, key=lambda x: normalizar(x["nombre"])),
        "canales": sorted(canales, key=lambda x: normalizar(x["nombre"])),
    }

"""
Tareas del equipo: lo que hay que hacer, para quién y para cuándo.

- Cualquiera con acceso al panel (administradores y closer) crea tareas, para
  sí o para otro del equipo, y puede colgarlas de una persona (correo).
- El closer ve las suyas y las que ha creado; los administradores, todas.
- Se marcan hechas, no se editan a medias en el historial: se puede cambiar
  el título, la fecha o a quién va, y borrar.
"""

from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.panel_negocio import PanelTask
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS, CLOSER_ROLE_ID

#: Quien puede recibir tareas: quien entra al panel.
ROLES_EQUIPO = set(ADMIN_OR_MAINTAINER_ROLE_IDS) | {CLOSER_ROLE_ID}
_NOMBRE_ROL = {1: "Administrador", 2: "Administrador", CLOSER_ROLE_ID: "Closer"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def fecha_ok(texto: str) -> str:
    texto = (texto or "").strip()
    if not texto:
        return ""
    try:
        return date.fromisoformat(texto).isoformat()
    except ValueError:
        return ""


def a_dict(t: PanelTask) -> dict:
    return {
        "id": t.id,
        "titulo": t.titulo,
        "notas": t.notas,
        "fecha": t.fecha,
        "prioridad": t.prioridad,
        "estado": t.estado,
        "asignado_id": t.asignado_id,
        "asignado": t.asignado,
        "creado_por_id": t.creado_por_id,
        "creado_por": t.creado_por,
        "email": t.email,
        "created_at": t.created_at,
        "done_at": t.done_at,
    }


def _nombre(u: User) -> str:
    n = f"{u.first_name or ''} {u.last_name or ''}".strip()
    return n or u.username or u.email


async def equipo(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (
        await db_session.execute(
            select(User, UserOrganization.role_id)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(UserOrganization.org_id == org_id)
            .where(UserOrganization.role_id.in_(list(ROLES_EQUIPO)))  # type: ignore[attr-defined]
        )
    ).all()
    vistos: dict[int, dict] = {}
    for u, rol in filas:
        vistos[u.id] = {"id": u.id, "nombre": _nombre(u), "rol": _NOMBRE_ROL.get(rol, ""), "email": u.email}
    return sorted(vistos.values(), key=lambda x: x["nombre"].lower())


async def _nombre_de(user_id: int, org_id: int, db_session: AsyncSession) -> Optional[str]:
    for m in await equipo(org_id, db_session):
        if m["id"] == user_id:
            return m["nombre"]
    return None


async def listar(
    db_session: AsyncSession,
    user_id: int,
    es_admin: bool,
    email: str = "",
    solo_pendientes: bool = False,
) -> list[dict]:
    q = select(PanelTask)
    if not es_admin:
        q = q.where(or_(PanelTask.asignado_id == user_id, PanelTask.creado_por_id == user_id))
    if email:
        q = q.where(PanelTask.email == email.strip().lower())
    if solo_pendientes:
        q = q.where(PanelTask.estado == "pendiente")
    filas = (await db_session.execute(q)).scalars().all()
    # Pendientes primero; dentro, las que tienen fecha antes (la más cercana
    # arriba) y las altas antes que las normales. Hechas al final, las últimas
    # hechas arriba.
    pend = [t for t in filas if t.estado != "hecha"]
    hechas = [t for t in filas if t.estado == "hecha"]
    pend.sort(key=lambda t: (t.fecha == "", t.fecha or "", t.prioridad != "alta", t.id or 0))
    hechas.sort(key=lambda t: t.done_at or "", reverse=True)
    return [a_dict(t) for t in pend + hechas[:100]]


async def crear(data: dict, org_id: int, autor_id: int, autor: str, db_session: AsyncSession) -> dict:
    titulo = (data.get("titulo") or "").strip()
    if not titulo:
        return {"ok": False, "motivo": "La tarea necesita un título"}
    asignado_id = int(data.get("asignado_id") or 0) or autor_id
    asignado = await _nombre_de(asignado_id, org_id, db_session)
    if asignado is None:
        return {"ok": False, "motivo": "Esa persona no es del equipo del panel"}
    t = PanelTask(
        titulo=titulo[:200],
        notas=(data.get("notas") or "").strip()[:2000],
        fecha=fecha_ok(data.get("fecha") or ""),
        prioridad="alta" if data.get("prioridad") == "alta" else "normal",
        estado="pendiente",
        asignado_id=asignado_id,
        asignado=asignado,
        creado_por_id=autor_id,
        creado_por=(autor or "")[:120],
        email=(data.get("email") or "").strip().lower()[:255],
        created_at=_ahora(),
    )
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return {"ok": True, "tarea": a_dict(t)}


async def cambiar(
    tarea_id: int, data: dict, org_id: int, user_id: int, es_admin: bool, db_session: AsyncSession
) -> dict:
    t = await db_session.get(PanelTask, tarea_id)
    if t is None:
        return {"ok": False, "motivo": "No existe esa tarea"}
    if not es_admin and user_id not in (t.asignado_id, t.creado_por_id):
        return {"ok": False, "motivo": "Esa tarea no es tuya"}
    if "titulo" in data and (data["titulo"] or "").strip():
        t.titulo = data["titulo"].strip()[:200]
    if "notas" in data:
        t.notas = (data["notas"] or "").strip()[:2000]
    if "fecha" in data:
        t.fecha = fecha_ok(data["fecha"] or "")
    if "prioridad" in data:
        t.prioridad = "alta" if data["prioridad"] == "alta" else "normal"
    if "asignado_id" in data and data["asignado_id"]:
        nombre = await _nombre_de(int(data["asignado_id"]), org_id, db_session)
        if nombre is None:
            return {"ok": False, "motivo": "Esa persona no es del equipo del panel"}
        t.asignado_id, t.asignado = int(data["asignado_id"]), nombre
    if "estado" in data and data["estado"] in ("pendiente", "hecha"):
        t.estado = data["estado"]
        t.done_at = _ahora() if t.estado == "hecha" else ""
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return {"ok": True, "tarea": a_dict(t)}


async def borrar(tarea_id: int, user_id: int, es_admin: bool, db_session: AsyncSession) -> dict:
    t = await db_session.get(PanelTask, tarea_id)
    if t is None:
        return {"ok": True}
    if not es_admin and user_id != t.creado_por_id:
        return {"ok": False, "motivo": "Solo la borra quien la creó o un administrador"}
    await db_session.delete(t)
    await db_session.commit()
    return {"ok": True}

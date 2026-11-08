"""
Organizar clases (rediseño, rama `diseno`, 08/11/2026).

Pedido del usuario: «que la parte de atrás no se vuelva un caos»: ver y cambiar
en un sitio qué clase ve cada grupo, quién la da (profe o monitor, p. ej. el
Spreekclub), Groep rood y Groep blauw como UNA clase con dos grupos, sus
semanas y tareas, y mover alumnos de un grupo a otro.

No hay tablas nuevas. Todo sale de lo que ya existe:
  - las clases en directo (`tareas.clases_en_directo`);
  - quién ve cada clase = los grupos enlazados al curso (`UserGroupResource`),
    con las mismas reglas que la lista de cursos (público y publicado lo ve
    todo el mundo; no público con grupos, solo esos grupos);
  - quién la da = el «profe» del recuadro de la clase (`salas[uuid].banner.teacher`),
    lo mismo que ya usa «Mis clases» de los profes para «Solo las mías»;
  - la semana en curso y sus cifras = `tareas.resumen_clases`.

Las clases «hermanas» (las copias con el mismo nombre, una por grupo) se
enseñan juntas, como una «familia»: es lo que el usuario llama «la clase
semanal, Groep rood y Groep blauw». «Nueva semana» ya las crea a la vez.

Leer: el equipo (profes incluidos). Cambiar: solo administradores.
"""
from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User

ROL_ALUMNO = 4
ROLES_EQUIPO = {1: "Administrador", 2: "Moderador", 5: "Profe"}


class OrganizarError(Exception):
    def __init__(self, motivo: str, status: int = 400):
        super().__init__(motivo)
        self.motivo = motivo
        self.status = status


# ── Lógica pura ─────────────────────────────────────────────────────────────


def normal(texto: Any) -> str:
    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    return " ".join(t.split())


def ve_la_clase(publico: bool, grupos_clase: Iterable[int], grupos_alumno: Iterable[int]) -> bool:
    """Las reglas de la lista de cursos: pública o sin grupos = todo el que
    entra; con grupos y no pública = solo esos grupos."""
    g = set(grupos_clase)
    if publico or not g:
        return True
    return bool(g & set(grupos_alumno))


def familias(clases: list[dict]) -> list[dict]:
    """Junta las clases que se llaman igual (las copias de cada grupo). Cada
    familia: nombre y sus clases, ordenadas por día de la semana."""
    por: dict[str, dict] = {}
    for c in clases:
        clave = normal(c.get("base") or c.get("nombre"))
        f = por.setdefault(clave, {"nombre": c.get("base") or c.get("nombre"), "clases": []})
        f["clases"].append(c)
    salida = []
    for f in por.values():
        f["clases"].sort(key=lambda c: (str(c.get("dia") or "9"), normal(c.get("etiqueta"))))
        salida.append(f)
    return sorted(salida, key=lambda f: normal(f["nombre"]))


def avisos_de(clases_que_ve: list[dict]) -> str:
    """Lo que hay que mirar de un alumno: ninguna clase, o dos copias de la
    misma (vería las dos «Clase semanal»)."""
    if not clases_que_ve:
        return "No ve ninguna clase en directo"
    nombres: dict[str, int] = {}
    for c in clases_que_ve:
        k = normal(c.get("base") or c.get("nombre"))
        nombres[k] = nombres.get(k, 0) + 1
    dobles = [c.get("base") or c.get("nombre") for c in clases_que_ve if nombres.get(normal(c.get("base") or c.get("nombre")), 0) > 1]
    if dobles:
        return f"Ve dos veces «{dobles[0]}» (está en los dos grupos)"
    return ""


def ajustes_de(config: Any, course_uuid: str) -> dict:
    """Lo guardado de esa clase en `salas` (etiqueta, recuadro, sala)."""
    from src.services.salas.salas import CLAVE, uuid_curso

    todas = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid_curso(course_uuid)) if isinstance(todas, dict) else None
    return propia if isinstance(propia, dict) else {}


def nombre_de(u: User) -> str:
    n = " ".join(x for x in [u.first_name or "", u.last_name or ""] if x).strip()
    return n or u.username or u.email or f"#{u.id}"


# ── Lectura ─────────────────────────────────────────────────────────────────


async def _config(org_id: int, db_session: AsyncSession) -> dict:
    from src.db.organization_config import OrganizationConfig

    fila = (await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    return (fila.config if fila else None) or {}


async def _curso(uuid: str, org_id: int, db_session: AsyncSession) -> Course:
    from src.services.salas.salas import uuid_curso

    u = uuid_curso(uuid)
    c = (
        await db_session.execute(select(Course).where(Course.course_uuid.in_([f"course_{u}", u])))  # type: ignore[attr-defined]
    ).scalars().first()
    if c is None or c.org_id != org_id:
        raise OrganizarError("No existe esa clase", 404)
    return c


async def panel(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.salas.salas import limpiar_etiqueta, uuid_curso
    from src.services.tareas import tareas

    config = await _config(org_id, db_session)
    excluidos = await tareas._excluidos(org_id, db_session)

    grupos = (await db_session.execute(select(UserGroup).where(UserGroup.org_id == org_id))).scalars().all()
    por_id = {g.id: g for g in grupos}
    miembros: dict[int, set[int]] = {g.id: set() for g in grupos}
    for gid, uid in (
        await db_session.execute(
            select(UserGroupUser.usergroup_id, UserGroupUser.user_id).where(UserGroupUser.usergroup_id.in_(list(por_id) or [0]))  # type: ignore[attr-defined]
        )
    ).all():
        miembros.setdefault(int(gid), set()).add(int(uid))

    # Personas de la escuela: alumnos y equipo.
    personas: dict[int, dict] = {}
    for m, u in (
        await db_session.execute(
            select(UserOrganization, User).join(User, User.id == UserOrganization.user_id).where(UserOrganization.org_id == org_id)
        )
    ).all():
        personas[int(u.id)] = {"id": int(u.id), "nombre": nombre_de(u), "email": u.email or "", "rol": int(m.role_id or 0)}
    grupos_de: dict[int, list[int]] = {}
    for gid, ids in miembros.items():
        for uid in ids:
            grupos_de.setdefault(uid, []).append(gid)

    # Las clases en directo, con sus grupos, quién la da y la semana en curso.
    resumen = {r["course_uuid"]: r for r in await tareas.resumen_clases(org_id, db_session)}
    enlaces = (await db_session.execute(select(UserGroupResource).where(UserGroupResource.org_id == org_id))).scalars().all()
    clases = []
    for c in await tareas.clases_en_directo(org_id, db_session):
        curso = await _curso(c["uuid"], org_id, db_session)
        u = uuid_curso(curso.course_uuid)
        ids = sorted({e.usergroup_id for e in enlaces if uuid_curso(e.resource_uuid) == u and e.usergroup_id in por_id})
        ajustes = ajustes_de(config, curso.course_uuid)
        banner = ajustes.get("banner") if isinstance(ajustes.get("banner"), dict) else {}
        alumnos = [
            p["id"]
            for p in personas.values()
            if p["rol"] == ROL_ALUMNO and p["id"] not in excluidos and ve_la_clase(bool(curso.public), ids, grupos_de.get(p["id"], []))
        ]
        r = resumen.get(u)
        clases.append(
            {
                "uuid": u,
                "base": curso.name,
                "nombre": c["nombre"],
                "etiqueta": limpiar_etiqueta(ajustes.get("etiqueta")),
                "publico": bool(curso.public),
                "publicado": bool(curso.published),
                "grupos": ids,
                "profe": str(banner.get("teacher") or "").strip(),
                "hora": str(banner.get("schedule") or "").strip(),
                "dia": str(banner.get("next_weekday") or "").strip(),
                "sala": bool(ajustes.get("activo")),
                "alumnos": len(alumnos),
                "semana": (r or {}).get("semana"),
                "cifras": (r or {}).get("cifras"),
            }
        )

    lista_grupos = []
    for g in sorted(grupos, key=lambda x: normal(x.name)):
        gente = [personas[uid] for uid in miembros.get(g.id, set()) if uid in personas]
        lista_grupos.append(
            {
                "id": g.id,
                "nombre": g.name,
                "alumnos": sorted(
                    [{"id": p["id"], "nombre": p["nombre"]} for p in gente if p["rol"] == ROL_ALUMNO],
                    key=lambda p: normal(p["nombre"]),
                ),
                "otros": len([p for p in gente if p["rol"] != ROL_ALUMNO]),
                "clases": [c["uuid"] for c in clases if g.id in c["grupos"]],
            }
        )

    alumnos = []
    for p in personas.values():
        if p["rol"] != ROL_ALUMNO or p["id"] in excluidos:
            continue
        mios = grupos_de.get(p["id"], [])
        ve = [c for c in clases if ve_la_clase(c["publico"], c["grupos"], mios)]
        alumnos.append(
            {
                "id": p["id"],
                "nombre": p["nombre"],
                "email": p["email"],
                "grupos": sorted(mios),
                "clases": [c["uuid"] for c in ve],
                "aviso": avisos_de(ve),
            }
        )

    equipo = sorted(
        [{"id": p["id"], "nombre": p["nombre"], "rol": ROLES_EQUIPO[p["rol"]]} for p in personas.values() if p["rol"] in ROLES_EQUIPO],
        key=lambda p: normal(p["nombre"]),
    )
    return {
        "familias": familias(clases),
        "grupos": lista_grupos,
        "alumnos": sorted(alumnos, key=lambda a: normal(a["nombre"])),
        "equipo": equipo,
    }


# ── Cambios (solo administradores) ──────────────────────────────────────────


async def _olvidar(org_id: int, curso: Optional[Course], db_session: AsyncSession) -> None:
    """Que la lista de cursos y la ficha del curso se lean de nuevo."""
    try:
        from src.db.organizations import Organization
        from src.services.courses.cache import invalidate_course_meta_cache, invalidate_courses_cache

        org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
        if org is not None:
            invalidate_courses_cache(org.slug)
        if curso is not None:
            invalidate_course_meta_cache(curso.course_uuid)
    except Exception:
        pass


async def poner_grupos(org_id: int, uuid: str, grupo_ids: list[int], db_session: AsyncSession) -> dict:
    """Deja la clase vista por esos grupos y solo esos. Con algún grupo, la
    clase deja de ser pública (si no, la vería todo el mundo igual)."""
    from src.services.salas.salas import uuid_curso

    curso = await _curso(uuid, org_id, db_session)
    validos = {g.id for g in (await db_session.execute(select(UserGroup).where(UserGroup.org_id == org_id))).scalars().all()}
    queridos = {int(g) for g in grupo_ids if int(g) in validos}
    u = uuid_curso(curso.course_uuid)
    actuales = (
        await db_session.execute(
            select(UserGroupResource).where(
                UserGroupResource.org_id == org_id,
                UserGroupResource.resource_uuid.in_([curso.course_uuid, u]),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    tiene = set()
    for e in actuales:
        if e.usergroup_id in queridos and e.usergroup_id not in tiene:
            tiene.add(e.usergroup_id)
        else:
            await db_session.delete(e)
    ahora = str(datetime.now())
    for gid in queridos - tiene:
        db_session.add(UserGroupResource(usergroup_id=gid, resource_uuid=curso.course_uuid, org_id=org_id, creation_date=ahora, update_date=ahora))
    if queridos and curso.public:
        curso.public = False
        db_session.add(curso)
    await db_session.commit()
    await _olvidar(org_id, curso, db_session)
    return {"uuid": u, "grupos": sorted(queridos), "publico": bool(curso.public)}


async def poner_profe(org_id: int, uuid: str, profe: str, db_session: AsyncSession) -> dict:
    """Quién da la clase (profe o monitor): el «profe» del recuadro."""
    from src.services.salas.salas import guardar_recuadro

    curso = await _curso(uuid, org_id, db_session)
    actual = ajustes_de(await _config(org_id, db_session), curso.course_uuid).get("banner") or {}
    nuevo = {**(actual if isinstance(actual, dict) else {}), "teacher": str(profe or "").strip()[:80]}
    banner = await guardar_recuadro(org_id, curso.course_uuid, nuevo, db_session)
    return {"uuid": curso.course_uuid.replace("course_", "", 1), "profe": banner.get("teacher", "")}


async def mover_alumno(org_id: int, user_id: int, sacar_de: list[int], meter_en: list[int], db_session: AsyncSession) -> dict:
    """Saca al alumno de unos grupos y lo mete en otros (p. ej. de Groep rood
    a Groep blauw). Sus tareas y entregas no se tocan: cuelgan de él."""
    from src.services.panel.tandas import _meter, _sacar

    grupos = {g.id: g for g in (await db_session.execute(select(UserGroup).where(UserGroup.org_id == org_id))).scalars().all()}
    socio = (
        await db_session.execute(
            select(UserOrganization).where(UserOrganization.org_id == org_id, UserOrganization.user_id == user_id)
        )
    ).scalars().first()
    if socio is None:
        raise OrganizarError("Esa persona no es de la escuela", 404)
    fuera = [g for g in sacar_de if g in grupos]
    dentro = [g for g in meter_en if g in grupos]
    await _sacar(user_id, fuera, db_session)
    for g in dentro:
        await _meter([user_id], grupos[g], db_session)
    await _olvidar(org_id, None, db_session)
    return {"ok": True}

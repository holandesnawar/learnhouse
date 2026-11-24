"""
Procesos del equipo, los SOP (24/11/2026).

Pedido del usuario: "en alguna parte de la escuela, SOPs con instrucciones
para yo asignarle a x personas del equipo, y dividir dentro con procesos, así
puedo bajar mi conocimiento a un sitio fijo y que todos vean, como hicimos
para los closers".

No es una tabla nueva: es el manual de la sala de profes (`equipo_documento`)
abierto a TODO el equipo. Así lo que ya se había escrito para los profes no se
pierde ni sale dos veces.

- **Área** (`seccion`): el gran bloque («Ventas», «Clases», «Operaciones»).
  Dentro de cada área, sus **procesos** (cada página es uno) y, dentro de cada
  proceso, sus pasos (el texto, con el formato sencillo del guion de llamada:
  `## ` título, `- ` punto, `1. ` paso, `**negrita**`).
- **Quién lo ve**: el equipo entero, es decir administradores, moderadores,
  profes (y monitores) y closers. `visible = "asignados"` lo deja solo para las
  personas asignadas (y los administradores): para algo que no es de todos.
- **Asignar** (solo administradores): a una o varias personas del equipo. A
  cada una le sale en la campana «Te han asignado un proceso» y, en la lista,
  «Asignados a ti».
- **«Lo he leído»**: cada asignado lo marca. Si después cambia el título o el
  texto (`cambiado_at`), le vuelve a tocar: «Ha cambiado: léelo otra vez». El
  administrador ve quién lo ha leído y quién no.
- Lo escriben los administradores. Lo lee quien lo vea.

Los alumnos no ven nada de esto.
"""

import json
from datetime import datetime, timezone

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.equipo import EquipoDocumento
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS, CLOSER_ROLE_ID, PROFE_ROLE_ID, STAFF_ROLE_IDS
from src.services.equipo.equipo import EquipoError, _avatar, nombre_de

#: Quién es «del equipo» para los procesos: el equipo de clases y los closers.
ROLES_DEL_EQUIPO = frozenset(STAFF_ROLE_IDS | {CLOSER_ROLE_ID})


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(texto: str) -> dict:
    try:
        d = json.loads(texto or "{}")
    except (TypeError, ValueError):
        return {}
    return d if isinstance(d, dict) else {}


def asignados_de(d) -> dict[int, str]:
    """{user_id: cuándo se le asignó}. Tolera lo guardado a medias."""
    out: dict[int, str] = {}
    for k, v in _json(getattr(d, "asignados", "") or "").items():
        try:
            out[int(k)] = str(v or "")
        except (TypeError, ValueError):
            continue
    return out


def lecturas_de(d) -> dict[int, str]:
    out: dict[int, str] = {}
    for k, v in _json(getattr(d, "lecturas", "") or "").items():
        try:
            out[int(k)] = str(v or "")
        except (TypeError, ValueError):
            continue
    return out


def cambio_de(d) -> str:
    return getattr(d, "cambiado_at", "") or d.created_at or ""


def estado_lectura(d, user_id: int) -> str:
    """'leido', 'cambiado' (lo leyó, pero ha cambiado después) o 'pendiente'."""
    leido = lecturas_de(d).get(user_id, "")
    if not leido:
        return "pendiente"
    return "leido" if leido >= cambio_de(d) else "cambiado"


def puede_ver(d, user_id: int, admin: bool) -> bool:
    if admin:
        return True
    if (getattr(d, "visible", "") or "") == "asignados":
        return user_id in asignados_de(d)
    return True


def visible_ok(texto: str) -> str:
    return "asignados" if (texto or "").strip() == "asignados" else ""


# ── Quién es quién ───────────────────────────────────────────────────────


async def quien_soy(user, org_id: int, db_session: AsyncSession) -> dict:
    """{equipo, admin, closer}. `equipo` = puede ver los procesos."""
    from src.security.superadmin import is_user_superadmin

    if not getattr(user, "id", 0):
        return {"equipo": False, "admin": False, "closer": False}
    roles = set(
        (
            await db_session.execute(
                select(UserOrganization.role_id).where(
                    UserOrganization.user_id == user.id, UserOrganization.org_id == org_id
                )
            )
        ).scalars().all()
    )
    admin = bool(roles & ADMIN_OR_MAINTAINER_ROLE_IDS) or await is_user_superadmin(user.id, db_session)
    return {
        "equipo": admin or bool(roles & ROLES_DEL_EQUIPO),
        "admin": admin,
        "closer": CLOSER_ROLE_ID in roles and not admin,
    }


def papel(rol: int) -> str:
    if rol in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return "Dirección"
    if rol == PROFE_ROLE_ID:
        return "Profe"
    if rol == CLOSER_ROLE_ID:
        return "Closer"
    return ""


async def miembros(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Todo el equipo: dirección, profes, monitores y closers."""
    filas = (
        await db_session.execute(
            select(User, UserOrganization.role_id)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(UserOrganization.org_id == org_id)
            .where(UserOrganization.role_id.in_(list(ROLES_DEL_EQUIPO)))  # type: ignore[attr-defined]
        )
    ).all()
    from src.services.equipo.monitores import es_monitor

    vistos: dict[int, dict] = {}
    for u, rol in filas:
        p = papel(rol)
        if p == "Profe" and await es_monitor(u.id, org_id, db_session):
            p = "Monitor"
        vistos[u.id] = {"id": u.id, "nombre": nombre_de(u), "rol": p, "avatar": _avatar(u)}
    orden = {"Dirección": 0, "Closer": 1, "Profe": 2, "Monitor": 3}
    return sorted(vistos.values(), key=lambda m: (orden.get(m["rol"], 4), m["nombre"].lower()))


# ── La lista ─────────────────────────────────────────────────────────────


def proceso_a_dict(d, user_id: int, admin: bool, nombres: dict[int, str]) -> dict:
    asign = asignados_de(d)
    lect = lecturas_de(d)
    cambio = cambio_de(d)
    out = {
        "id": d.id,
        "titulo": d.titulo,
        "seccion": d.seccion,
        "resumen": getattr(d, "resumen", "") or "",
        "texto": d.texto or "",
        "orden": d.orden,
        "visible": getattr(d, "visible", "") or "",
        "creado_por": d.creado_por,
        "actualizado_por": d.actualizado_por,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "cambiado_at": cambio,
        "mio": user_id in asign,
        "lectura": estado_lectura(d, user_id) if user_id in asign else "",
        "leido_at": lect.get(user_id, ""),
    }
    if admin:
        out["asignados"] = [
            {
                "id": uid,
                "nombre": nombres.get(uid, "Alguien que ya no está en el equipo"),
                "estado": estado_lectura(d, uid),
                "leido_at": lect.get(uid, ""),
                "asignado_at": at,
            }
            for uid, at in sorted(asign.items(), key=lambda x: nombres.get(x[0], "").lower())
        ]
    else:
        # El resto del equipo ve a quién va, sin el detalle de quién lo ha leído.
        out["asignados"] = [{"id": uid, "nombre": nombres.get(uid, "")} for uid in asign if nombres.get(uid)]
    return out


async def _filas(org_id: int, db_session: AsyncSession) -> list[EquipoDocumento]:
    filas = (await db_session.execute(select(EquipoDocumento).where(EquipoDocumento.org_id == org_id))).scalars().all()
    return sorted(filas, key=lambda d: (d.orden, d.id or 0))


async def listar(org_id: int, user_id: int, admin: bool, db_session: AsyncSession, gente: list[dict] | None = None) -> list[dict]:
    gente = gente if gente is not None else await miembros(org_id, db_session)
    nombres = {m["id"]: m["nombre"] for m in gente}
    return [proceso_a_dict(d, user_id, admin, nombres) for d in await _filas(org_id, db_session) if puede_ver(d, user_id, admin)]


async def _uno(org_id: int, doc_id: int, db_session: AsyncSession) -> EquipoDocumento:
    d = await db_session.get(EquipoDocumento, doc_id)
    if not d or d.org_id != org_id:
        raise EquipoError("Ese proceso ya no existe", 404)
    return d


def _limpiar_asignados(ids, validos: set[int], antes: dict[int, str]) -> dict[int, str]:
    """Los nuevos se apuntan con la hora de ahora; los que ya estaban,
    conservan la suya (así no les vuelve a salir en la campana)."""
    ahora = _ahora()
    out: dict[int, str] = {}
    for x in ids or []:
        try:
            uid = int(x)
        except (TypeError, ValueError):
            continue
        if uid in validos:
            out[uid] = antes.get(uid) or ahora
    return out


async def guardar(org_id: int, doc_id: int | None, datos: dict, autor, db_session: AsyncSession) -> dict:
    """Crea (doc_id None) o cambia un proceso. Solo administradores (lo mira
    el router)."""
    if doc_id is None:
        titulo = str(datos.get("titulo") or "").strip()[:200]
        if not titulo:
            raise EquipoError("Ponle un título al proceso")
        filas = await _filas(org_id, db_session)
        ahora = _ahora()
        d = EquipoDocumento(
            org_id=org_id,
            titulo=titulo,
            orden=(max((f.orden for f in filas), default=0) + 1),
            creado_por=nombre_de(autor),
            created_at=ahora,
            cambiado_at=ahora,
        )
    else:
        d = await _uno(org_id, doc_id, db_session)
    cambio = doc_id is None
    if "titulo" in datos and doc_id is not None:
        titulo = str(datos.get("titulo") or "").strip()[:200]
        if not titulo:
            raise EquipoError("Ponle un título al proceso")
        if titulo != d.titulo:
            cambio = True
        d.titulo = titulo
    if "seccion" in datos:
        d.seccion = str(datos.get("seccion") or "").strip()[:80]
    if "resumen" in datos:
        d.resumen = str(datos.get("resumen") or "").strip()[:300]
    if "texto" in datos:
        texto = str(datos.get("texto") or "")[:40000]
        if texto != (d.texto or ""):
            cambio = True
        d.texto = texto
    if "visible" in datos:
        d.visible = visible_ok(str(datos.get("visible") or ""))
    if "orden" in datos:
        try:
            d.orden = float(datos.get("orden"))
        except (TypeError, ValueError):
            pass
    if "asignados" in datos and datos.get("asignados") is not None:
        validos = {m["id"] for m in await miembros(org_id, db_session)}
        d.asignados = json.dumps(
            {str(k): v for k, v in _limpiar_asignados(datos.get("asignados"), validos, asignados_de(d)).items()}
        )
    ahora = _ahora()
    if cambio and doc_id is not None:
        d.cambiado_at = ahora
    d.actualizado_por = nombre_de(autor)
    d.updated_at = ahora
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    nombres = {m["id"]: m["nombre"] for m in await miembros(org_id, db_session)}
    return proceso_a_dict(d, autor.id, True, nombres)


async def marcar_leido(org_id: int, doc_id: int, user, admin: bool, leido: bool, db_session: AsyncSession) -> dict:
    """«Lo he leído» (o deshacerlo). Vale para cualquiera que lo vea, no solo
    para los asignados: así el administrador sabe quién más lo ha mirado."""
    d = await _uno(org_id, doc_id, db_session)
    if not puede_ver(d, user.id, admin):
        raise EquipoError("Ese proceso no es para ti", 403)
    lect = lecturas_de(d)
    if leido:
        lect[user.id] = _ahora()
    else:
        lect.pop(user.id, None)
    d.lecturas = json.dumps({str(k): v for k, v in lect.items()})
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    nombres = {m["id"]: m["nombre"] for m in await miembros(org_id, db_session)}
    return proceso_a_dict(d, user.id, admin, nombres)


# ── La campana ───────────────────────────────────────────────────────────


def avisos_de(filas, user_id: int, url_de) -> list[dict]:
    """Pura: los procesos asignados a esta persona que le toca leer."""
    out = []
    for d in filas:
        asign = asignados_de(d)
        if user_id not in asign:
            continue
        estado = estado_lectura(d, user_id)
        if estado == "leido":
            continue
        if estado == "cambiado":
            titulo = f"Ha cambiado el proceso «{d.titulo}»"
            texto = "Léelo otra vez y marca «Lo he leído»."
            fecha = cambio_de(d)
        else:
            titulo = f"Te han asignado un proceso: «{d.titulo}»"
            texto = (getattr(d, "resumen", "") or "").strip() or "Léelo y marca «Lo he leído»."
            fecha = asign.get(user_id) or cambio_de(d)
        out.append(
            {
                "id": f"proceso:{d.id}:{fecha}",
                "kind": "proceso",
                "title": titulo,
                "excerpt": texto,
                "url": url_de(d.id),
                "date": fecha,
            }
        )
    return out


async def avisos(user_id: int, org_ids: list[int], db_session: AsyncSession) -> list[dict]:
    out: list[dict] = []
    for org_id in org_ids:
        roles = set(
            (
                await db_session.execute(
                    select(UserOrganization.role_id).where(
                        UserOrganization.user_id == user_id, UserOrganization.org_id == org_id
                    )
                )
            ).scalars().all()
        )
        if not roles & (ROLES_DEL_EQUIPO | ADMIN_OR_MAINTAINER_ROLE_IDS):
            continue
        # Quien tiene panel (administradores y closers) lo abre allí; el profe,
        # en la sala de profesores.
        en_panel = bool(roles & (ADMIN_OR_MAINTAINER_ROLE_IDS | {CLOSER_ROLE_ID}))

        def url_de(doc_id: int, en_panel=en_panel) -> str:
            return f"/dash/estadisticas?tab=procesos&p={doc_id}" if en_panel else f"/equipo?vista=manual&doc={doc_id}"

        out.extend(avisos_de(await _filas(org_id, db_session), user_id, url_de))
    return out

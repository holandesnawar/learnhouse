"""
Tandas de alumnos: cada alumno nuevo, en su grupo, elegido por el equipo
(25/10/2026).

Pedido del usuario: "a partir de mañana, los nuevos van en un grupo nuevo; no
ven la clase semanal como los de la beta… separar con etiquetas, por ejemplo
matrículas noviembre… reciben una masterclass en directo y spreekuren".

⚠️ **Desde el 31/10/2026, cada alumno nuevo entra SOLO en el programa nuevo**
(usuario: "ahora cada alumno que entre nuevo tiene que entrar en el grupo de
Programa nuevo"). Al darle de alta tras pagar (`payments._create_paid_user`,
que usan el pago, la señal completada, los plazos y el alta a mano) se llama a
`al_pagar`, y la tarea diaria repasa a quien se haya quedado sin grupo
(`entrar_solos`). **Menos uno**: a quien ANTES del cambio estaba en «Por
pagar», reservó con señal o tenía un enlace de pago (`motivo_beta`) se le
vendió la clase de conversación, y ese se queda en «Han pagado: elige su
grupo» para que lo decida el equipo (lo dijo el usuario el 25/10). Sin correo
al equipo, como siempre.

(Antes, del 25/10 al 31/10, NADIE entraba solo: el usuario quería elegir uno a
uno. Hubo también una versión con correo «Alumno nuevo» al equipo, quitada.)

Cómo va:
- org_config `tandas`: `activo` (avisar para elegir), `desde` (AAAA-MM-DD,
  hora de Países Bajos: el día del cambio), `programa_id` (el grupo del
  programa nuevo; si no existe, se crea «Programa nuevo» y se apunta su id,
  así que renombrarlo en el panel no rompe nada) y `tanda` (nombre fijo del
  grupo de la tanda; vacío = por el mes en que pagó).
- **Por decidir** (`por_decidir`): todo alumno (rol 4) que pagó desde
  `desde` y no está ni en el programa nuevo ni en la beta. Sin Testers ni
  quien está fuera de los números. No se guarda nada: sale de los grupos.
- **El aviso es en la escuela, no por correo**: en la campana de los
  administradores (`_decidir_items` en engagement.py), en el inicio del panel
  y arriba de Tandas y grupos, con dos botones: «Programa nuevo» y «Beta»
  (`decidir`). Desaparece al elegir.
- **La sugerencia** (`sugerencia` en cada alumno): Beta si ANTES del cambio
  estaba en «Por pagar», reservó plaza con señal o el equipo le creó un enlace
  de pago (`motivo_beta`): a esos se les vendió la clase de conversación. Si
  no, el programa nuevo. Solo marca el botón; decide el equipo.
- `decidir`: «nuevo» = el grupo del programa y el de su tanda (por el día en
  que entró); «beta» = el grupo Beta, y fuera del programa y de su tanda. Se
  puede cambiar cuantas veces haga falta.
- Mientras no se elige, el alumno ve la formación, pero ni la clase semanal
  ni la masterclass (cada una cerrada a su grupo en su Acceso).
- **La bienvenida no cambia y sale al momento**: no habla de la clase semanal
  ni de la masterclass (formación, contraseña y «Primeros pasos»), así que vale
  para los dos y nadie se queda esperando su correo tras pagar.
- **Beta**: `meter_en_beta` crea el grupo «Beta» y mete a los alumnos (rol 4)
  que entraron ANTES del día del cambio y no están en el programa nuevo. Se
  usa una vez y ANTES de cerrar la clase semanal al grupo Beta: si se cierra
  antes, la beta se queda sin su clase. Se puede repetir sin miedo (no
  duplica, y no toca a los que entran desde el cambio: esos se eligen uno a
  uno).
- `resumen` enseña los alumnos nuevos con su programa, cada grupo con su
  gente y QUIÉN VE cada curso y cada canal (todos, o solo tal grupo), y avisa
  del error que más se va a cometer: un curso o canal con grupo pero marcado
  como público, que lo ve todo el mundo igual (`quien_lo_ve`).
"""

import json
import logging
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlmodel import func, select
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


def leer_instante(texto: Any) -> Optional[datetime]:
    """Una fecha guardada en texto, con o sin zona (sin zona = UTC, que es como
    escribe el servidor), o None si no se entiende."""
    if not texto:
        return None
    try:
        d = datetime.fromisoformat(str(texto).strip().replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def dia_nl(texto: Any) -> str:
    """El día (AAAA-MM-DD, hora de Países Bajos) de una fecha guardada; "" si no hay."""
    d = leer_instante(texto)
    return d.astimezone(ZONA).date().isoformat() if d else ""


def _ddmm(dia: str) -> str:
    return f"{dia[8:10]}/{dia[5:7]}" if len(dia) >= 10 else dia


def motivo_beta(desde: str, por_pagar_el: str = "", senal_el: str = "", enlace_el: str = "") -> str:
    """Por qué alguien que acaba de pagar podría ser de la beta, o "" si no.

    Cuenta lo que pasó ANTES del día del cambio (`desde`): estar en la columna
    «Por pagar», reservar plaza con señal o que el equipo le creara un enlace
    de pago. Eso se le vendió con la clase semanal. Lo que pase desde el
    cambio no cuenta: desde ese día «Por pagar» también se llena con gente del
    programa nuevo. Sin día del cambio, nadie es candidato."""
    if not desde:
        return ""
    for cuando, texto in (
        (por_pagar_el, "Estaba en «Por pagar» desde el {}"),
        (senal_el, "Reservó plaza con señal el {}"),
        (enlace_el, "Le creasteis un enlace de pago el {}"),
    ):
        dia = dia_nl(cuando)
        if dia and dia < desde:
            return texto.format(_ddmm(dia)) + ", antes del cambio."
    return ""


def programa_de(grupos: set[int], programa_id: int, beta_id: int) -> str:
    """En qué programa está alguien por sus grupos: nuevo, beta, los dos o ""."""
    en_nuevo = bool(programa_id) and programa_id in grupos
    en_beta = bool(beta_id) and beta_id in grupos
    if en_nuevo and en_beta:
        return "los dos"
    return "nuevo" if en_nuevo else "beta" if en_beta else ""


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


async def _sacar(user_id: int, grupo_ids: list[int], db_session: AsyncSession) -> None:
    """Saca a esa persona de esos grupos (si estaba)."""
    if not grupo_ids:
        return
    filas = (
        await db_session.execute(
            select(UserGroupUser).where(
                UserGroupUser.user_id == user_id,
                UserGroupUser.usergroup_id.in_(grupo_ids),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    for f in filas:
        await db_session.delete(f)
    if filas:
        await db_session.commit()


async def motivo_beta_de(email: str, desde: str, db_session: AsyncSession) -> str:
    """`motivo_beta` con los datos de esa persona. En blando: si algo falla, ""
    (la sugerencia queda en el programa nuevo; decide igual el equipo)."""
    from src.db.contact_event import ContactEvent
    from src.db.reservas import ReservaPlaza
    from src.services.panel.pipeline import etapa_guardada, filas_de

    clave = (email or "").strip().lower()
    if not clave or not desde:
        return ""
    try:
        por_pagar = ""
        filas = await filas_de(clave, db_session)
        if filas and etapa_guardada(filas[0].etapa) == "pendiente-pago":
            por_pagar = filas[0].updated_at or ""
        senales = (
            await db_session.execute(
                select(ReservaPlaza.created_at).where(
                    func.lower(ReservaPlaza.email) == clave, ReservaPlaza.estado != "cancelada"
                )
            )
        ).scalars().all()
        enlaces = (
            await db_session.execute(
                select(ContactEvent.created_at).where(
                    func.lower(ContactEvent.email) == clave, ContactEvent.kind == "enlace-pago"
                )
            )
        ).scalars().all()
        primero = lambda fechas: min((f for f in fechas if leer_instante(f)), key=lambda f: leer_instante(f), default="")  # noqa: E731
        return motivo_beta(desde, por_pagar, primero(senales), primero(enlaces))
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo mirar si un alumno nuevo venía de la beta", exc_info=True)
        return ""


async def _alumnos(org_id: int, db_session: AsyncSession) -> dict[int, str]:
    """Los alumnos (rol 4) de la escuela con su fecha de entrada."""
    from src.db.user_organizations import UserOrganization

    return {
        int(uid): str(creado or "")
        for uid, creado in (
            await db_session.execute(
                select(UserOrganization.user_id, UserOrganization.creation_date).where(
                    UserOrganization.org_id == org_id, UserOrganization.role_id == ROL_ALUMNO
                )
            )
        ).all()
    }


async def _grupo_beta(org_id: int, db_session: AsyncSession) -> Optional[UserGroup]:
    for g in await _grupos(org_id, db_session):
        if normalizar(g.name) == normalizar(NOMBRE_BETA):
            return g
    return None


async def meter_en_beta(org_id: int, db_session: AsyncSession) -> dict:
    """Crea «Beta» y mete a todos los alumnos de ANTES del cambio que no están
    en el programa nuevo. Los que entran desde el cambio no se tocan: quien
    está por decidir se decide uno a uno (`decidir`)."""
    cfg = await config(db_session, org_id)
    alumnos = await _alumnos(org_id, db_session)
    if cfg["desde"]:
        alumnos = {u: c for u, c in alumnos.items() if not dia_nl(c) or dia_nl(c) < cfg["desde"]}
    programa = await grupo_del_programa(org_id, db_session, crear=False)
    del_programa = await _miembros(programa.id, db_session) if programa else set()
    beta = await _grupo_por_nombre(org_id, NOMBRE_BETA, "Alumnos de la primera convocatoria (clase semanal).", db_session)
    entran = await _meter([u for u in alumnos if u not in del_programa], beta, db_session)
    return {"ok": True, "grupo": beta.name, "entran": entran, "total": len(await _miembros(beta.id, db_session))}


async def alumnos_nuevos(org_id: int, db_session: AsyncSession, con_motivo: bool = True) -> list[dict]:
    """Los alumnos que han entrado desde el cambio, el último arriba, con su
    programa ("" = por decidir). Sin las cuentas de prueba (Testers) ni quien
    está fuera de los números. Vacío con las tandas apagadas o sin día."""
    from src.db.users import User
    from src.services.contactos.metricas import ids_excluidos
    from src.services.panel.testers import ids_testers

    cfg = await config(db_session, org_id)
    if not cfg["activo"] or not cfg["desde"]:
        return []
    fuera = await ids_testers(org_id, db_session)
    try:
        fuera |= await ids_excluidos(db_session)
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo leer quién está fuera de los números", exc_info=True)
    nuevos = {
        u: c for u, c in (await _alumnos(org_id, db_session)).items() if u not in fuera and dia_nl(c) >= cfg["desde"]
    }
    if not nuevos:
        return []
    programa = await grupo_del_programa(org_id, db_session, crear=False)
    beta = await _grupo_beta(org_id, db_session)
    claves = [g.id for g in (programa, beta) if g is not None]
    grupos_de: dict[int, set[int]] = {}
    if claves:
        for uid, gid in (
            await db_session.execute(
                select(UserGroupUser.user_id, UserGroupUser.usergroup_id).where(
                    UserGroupUser.usergroup_id.in_(claves),  # type: ignore[attr-defined]
                    UserGroupUser.user_id.in_(list(nuevos)),  # type: ignore[attr-defined]
                )
            )
        ).all():
            grupos_de.setdefault(int(uid), set()).add(int(gid))
    usuarios = {
        u.id: u
        for u in (await db_session.execute(select(User).where(User.id.in_(list(nuevos))))).scalars().all()  # type: ignore[attr-defined]
    }
    salida = []
    for uid, creado in nuevos.items():
        u = usuarios.get(uid)
        if u is None:
            continue
        nombre = " ".join(x for x in ((u.first_name or "").strip(), (u.last_name or "").strip()) if x) or u.username or u.email
        programa_actual = programa_de(grupos_de.get(uid, set()), programa.id if programa else 0, beta.id if beta else 0)
        d = leer_instante(creado)
        motivo = (await motivo_beta_de(u.email, cfg["desde"], db_session)) if con_motivo else ""
        salida.append(
            {
                "id": uid,
                "nombre": nombre,
                "email": u.email,
                "entro": d.astimezone(timezone.utc).isoformat() if d else "",
                "programa": programa_actual,
                "motivo": motivo,
                # Qué botón se marca: la beta a quien se le vendió la clase de
                # conversación antes del cambio. Decide igual el equipo.
                "sugerencia": "beta" if motivo else "nuevo",
            }
        )
    return sorted(salida, key=lambda x: x["entro"], reverse=True)


async def por_decidir(org_id: int, db_session: AsyncSession, con_motivo: bool = False) -> list[dict]:
    """Los alumnos nuevos que aún no tienen programa: el aviso del
    administrador. Con `con_motivo`, también por qué se sugiere la beta."""
    return [a for a in await alumnos_nuevos(org_id, db_session, con_motivo=con_motivo) if not a["programa"]]


async def entrar_solos(org_id: int, db_session: AsyncSession, solo: Optional[int] = None) -> dict:
    """Mete en el programa nuevo a los alumnos nuevos que aún no tienen
    programa (31/10/2026). Los que tienen sugerencia de beta (`motivo_beta`)
    se quedan por decidir: eso lo elige el equipo. Con `solo`, únicamente ese
    alumno. Con las tandas apagadas o sin día del cambio, no hace nada."""
    entran, se_quedan = [], 0
    for a in await por_decidir(org_id, db_session, con_motivo=True):
        if solo is not None and a["id"] != solo:
            continue
        if a["motivo"]:
            se_quedan += 1
            continue
        if (await decidir(org_id, a["id"], "nuevo", db_session)).get("ok"):
            entran.append(a["id"])
    return {"entran": len(entran), "por_decidir": se_quedan, "ids": entran}


async def al_pagar(org_id: int, user_id: int, db_session: AsyncSession) -> str:
    """Lo que se hace con un alumno al darle de alta tras pagar: «nuevo» si
    ha entrado solo en el programa nuevo, "" si no (tandas apagadas, de
    antes del cambio, Tester, sugerencia de beta…). En blando: un fallo aquí
    nunca puede tumbar el alta; se queda por decidir y lo recoge la tarea
    diaria o el equipo."""
    try:
        r = await entrar_solos(org_id, db_session, solo=user_id)
        return "nuevo" if r["entran"] else ""
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo meter al alumno nuevo en el programa nuevo")
        try:
            await db_session.rollback()
        except Exception:  # noqa: BLE001
            pass
        return ""


async def decidir(org_id: int, user_id: int, a: str, db_session: AsyncSession) -> dict:
    """Pone a un alumno en el programa nuevo («nuevo»: el grupo del programa y
    el de su tanda, por el día en que entró) o en la beta («beta»: fuera del
    programa y de su tanda). Se puede cambiar cuantas veces haga falta."""
    if a not in ("nuevo", "beta"):
        return {"ok": False, "motivo": "Elige «nuevo» o «beta»"}
    creado = (await _alumnos(org_id, db_session)).get(user_id)
    if creado is None:
        return {"ok": False, "motivo": "No es alumno de la escuela"}
    cfg = await config(db_session, org_id)
    tanda = nombre_tanda(dia_nl(creado) or hoy_nl(), cfg["tanda"])
    programa = await grupo_del_programa(org_id, db_session)
    if a == "nuevo":
        grupo_tanda = await _grupo_por_nombre(org_id, tanda, "Alumnos que se matricularon en esta tanda.", db_session)
        for grupo in (programa, grupo_tanda):
            if grupo is not None:
                await _meter([user_id], grupo, db_session)
        beta = await _grupo_beta(org_id, db_session)
        await _sacar(user_id, [beta.id] if beta else [], db_session)
        return {"ok": True, "programa": "nuevo", "grupos": [g.name for g in (programa, grupo_tanda) if g is not None]}
    beta = await _grupo_por_nombre(org_id, NOMBRE_BETA, "Alumnos de la primera convocatoria (clase semanal).", db_session)
    await _meter([user_id], beta, db_session)
    quitar = [programa.id] if programa else []
    quitar += [
        g.id
        for g in await _grupos(org_id, db_session)
        if normalizar(g.name) == normalizar(tanda) or normalizar(g.name).startswith("matricula ")
    ]
    await _sacar(user_id, quitar, db_session)
    return {"ok": True, "programa": "beta", "grupos": [beta.name]}


async def resumen(org_id: int, db_session: AsyncSession) -> dict:
    """La pantalla de Tandas: la configuración, los alumnos nuevos con su
    programa, cada grupo con su gente y quién ve cada curso y cada canal."""
    from src.db.communities.communities import Community
    from src.db.courses.courses import Course

    cfg = await config(db_session, org_id)
    grupos = await _grupos(org_id, db_session)
    por_id = {g.id: g for g in grupos}
    entradas = await _alumnos(org_id, db_session)
    alumnos = set(entradas)
    # Los que entran desde el cambio no cuentan como «sin grupo»: van en su
    # propia lista (`nuevos`), con los botones para decidir.
    corte = cfg["desde"] if cfg["activo"] else ""
    de_antes = {u for u, c in entradas.items() if not corte or not dia_nl(c) or dia_nl(c) < corte}
    nuevos = await alumnos_nuevos(org_id, db_session)
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

    from src.services.salas.salas import nombre_con_etiqueta

    fila_cfg = await _fila_config(db_session, org_id)
    cursos = []
    for c in (await db_session.execute(select(Course).where(Course.org_id == org_id))).scalars().all():
        g = sorted(grupos_de.get(c.course_uuid, []))
        cursos.append(
            {
                # Dos copias de la clase semanal se llaman igual: la etiqueta
                # (Groep rood / Groep blauw) dice cuál es cuál (29/10).
                "nombre": nombre_con_etiqueta(fila_cfg.config if fila_cfg else {}, c.course_uuid, c.name),
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
        "alumnos_sin_grupo": len(de_antes - con_grupo_clave),
        "nuevos": nuevos,
        "por_decidir": sum(1 for a in nuevos if not a["programa"]),
        "cursos": sorted(cursos, key=lambda x: normalizar(x["nombre"])),
        "canales": sorted(canales, key=lambda x: normalizar(x["nombre"])),
    }

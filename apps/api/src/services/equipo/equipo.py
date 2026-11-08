"""
La sala de profes (08/11/2026, rama diseno).

Pedido del usuario: "que los profes y monitores no tengan el mismo inicio que
los alumnos, que vean directamente lo que tienen que hacer y se vea más como
que están en el grupo de profes, como Teams… ser profe no es ser alumno… no
solo preparar la clase, sino ver clases anteriores, presentaciones antiguas,
nuevas, mejor orden de cómo pasó todo, SOPs, mejor kanban, tareas".

Aquí viven las dos cosas que la escuela no tenía guardadas:

- **Las tareas del equipo** (`equipo_tarea`): un tablero compartido, como el
  Planner de Teams. Tres columnas (por hacer · en curso · hecho). Las ve TODO
  el equipo de clases (administradores, moderadores y profes, que incluye a los
  monitores): es un equipo pequeño y el tablero es de todos. Cualquiera crea,
  mueve y cambia; borra quien la creó o un administrador. Puede ir para una
  persona o para todo el equipo, y colgar de una clase en directo.
  No son las tareas del panel (`panel_task`): esas son de ventas (closer y
  administradores) y van colgadas de un lead.

- **El manual del equipo** (`equipo_documento`): los SOP, cómo se hace cada
  cosa. Los lee el equipo; los escribe un administrador. Formato sencillo, el
  mismo del guion de llamada: `## ` título, `- ` punto, `1. ` paso, `**negrita**`.
  «Empezar con la plantilla» crea unas páginas con el proceso que la escuela ya
  sigue (preparar la semana, el día de la clase, después, check-in, consultas,
  el Spreekclub); son para editarlas, no verdades fijas.

Lo demás de la sala de profes (lo que toca hoy, las clases por semanas, el
archivo de presentaciones y grabaciones) sale de lo que la escuela ya tiene
(`services/tareas/tareas.py`): aquí no se guarda.
"""

from datetime import date, datetime, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.equipo import EquipoDocumento, EquipoTarea
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS, PROFE_ROLE_ID, STAFF_ROLE_IDS

ESTADOS = ("por-hacer", "en-curso", "hecho")
PRIORIDADES = ("normal", "alta")


class EquipoError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def fecha_ok(texto: str) -> str:
    texto = (texto or "").strip()
    if not texto:
        return ""
    try:
        return date.fromisoformat(texto[:10]).isoformat()
    except ValueError:
        return ""


def estado_ok(texto: str) -> str:
    texto = (texto or "").strip().lower()
    return texto if texto in ESTADOS else "por-hacer"


def prioridad_ok(texto: str) -> str:
    texto = (texto or "").strip().lower()
    return texto if texto in PRIORIDADES else "normal"


def curso_ok(texto: str) -> str:
    texto = (texto or "").strip()
    return texto[len("course_"):] if texto.startswith("course_") else texto[:80]


def nombre_de(u) -> str:
    n = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
    return n or getattr(u, "username", "") or "Equipo"


def _avatar(u: User) -> str:
    av = u.avatar_image or ""
    if not av:
        return ""
    if av.startswith("http://") or av.startswith("https://"):
        return av
    return f"/content/users/{u.user_uuid}/avatars/{av}" if u.user_uuid else ""


def nombre_rol(rol: int) -> str:
    if rol in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return "Dirección"
    if rol == PROFE_ROLE_ID:
        return "Profe"
    return ""


# ── El equipo ────────────────────────────────────────────────────────────


async def miembros(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Quién está en el equipo de clases: administradores, moderadores y profes."""
    filas = (
        await db_session.execute(
            select(User, UserOrganization.role_id)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(UserOrganization.org_id == org_id)
            .where(UserOrganization.role_id.in_(list(STAFF_ROLE_IDS)))  # type: ignore[attr-defined]
        )
    ).all()
    from src.services.equipo.monitores import es_monitor

    vistos: dict[int, dict] = {}
    for u, rol in filas:
        papel = nombre_rol(rol)
        if papel == "Profe" and await es_monitor(u.id, org_id, db_session):
            papel = "Monitor"
        vistos[u.id] = {"id": u.id, "nombre": nombre_de(u), "rol": papel, "avatar": _avatar(u)}
    # Primero la dirección, luego los profes y los monitores; dentro, por nombre.
    orden = {"Dirección": 0, "Profe": 1, "Monitor": 2}
    return sorted(vistos.values(), key=lambda m: (orden.get(m["rol"], 3), m["nombre"].lower()))


# ── Las tareas ───────────────────────────────────────────────────────────


def tarea_a_dict(t: EquipoTarea) -> dict:
    return {
        "id": t.id,
        "titulo": t.titulo,
        "notas": t.notas,
        "estado": t.estado,
        "prioridad": t.prioridad,
        "fecha": t.fecha,
        "asignado_id": t.asignado_id,
        "asignado": t.asignado,
        "course_uuid": t.course_uuid,
        "orden": t.orden,
        "creado_por_id": t.creado_por_id,
        "creado_por": t.creado_por,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "done_at": t.done_at,
    }


def ordenar_tareas(tareas: list[dict]) -> list[dict]:
    """Por columna y por su orden; a igual orden, la más nueva arriba."""
    pos = {e: i for i, e in enumerate(ESTADOS)}
    return sorted(tareas, key=lambda t: (pos.get(t["estado"], 0), t["orden"], -(t["id"] or 0)))


def orden_arriba(ordenes: list[float]) -> float:
    """Un orden para ponerla la primera de su columna."""
    return (min(ordenes) - 1) if ordenes else 0.0


async def listar_tareas(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (await db_session.execute(select(EquipoTarea).where(EquipoTarea.org_id == org_id))).scalars().all()
    return ordenar_tareas([tarea_a_dict(t) for t in filas])


async def _tarea(org_id: int, tarea_id: int, db_session: AsyncSession) -> EquipoTarea:
    t = await db_session.get(EquipoTarea, tarea_id)
    if not t or t.org_id != org_id:
        raise EquipoError("Esa tarea ya no existe", 404)
    return t


async def _asignado(org_id: int, user_id: int, db_session: AsyncSession) -> tuple[int, str]:
    """(id, nombre) de a quién va; 0 = todo el equipo. Solo alguien del equipo."""
    if not user_id:
        return 0, ""
    for m in await miembros(org_id, db_session):
        if m["id"] == user_id:
            return m["id"], m["nombre"]
    raise EquipoError("Esa persona no está en el equipo de clases")


async def _ordenes(org_id: int, estado: str, db_session: AsyncSession) -> list[float]:
    filas = (
        await db_session.execute(
            select(EquipoTarea.orden).where(EquipoTarea.org_id == org_id).where(EquipoTarea.estado == estado)
        )
    ).all()
    return [float(f[0] or 0) for f in filas]


async def crear_tarea(org_id: int, datos: dict, autor, db_session: AsyncSession) -> dict:
    titulo = str(datos.get("titulo") or "").strip()[:200]
    if not titulo:
        raise EquipoError("Escribe qué hay que hacer")
    estado = estado_ok(datos.get("estado") or "")
    asignado_id, asignado = await _asignado(org_id, int(datos.get("asignado_id") or 0), db_session)
    ahora = _ahora()
    t = EquipoTarea(
        org_id=org_id,
        titulo=titulo,
        notas=str(datos.get("notas") or "").strip()[:4000],
        estado=estado,
        prioridad=prioridad_ok(datos.get("prioridad") or ""),
        fecha=fecha_ok(datos.get("fecha") or ""),
        asignado_id=asignado_id,
        asignado=asignado,
        course_uuid=curso_ok(datos.get("course_uuid") or ""),
        orden=orden_arriba(await _ordenes(org_id, estado, db_session)),
        creado_por_id=autor.id,
        creado_por=nombre_de(autor),
        created_at=ahora,
        updated_at=ahora,
        done_at=ahora if estado == "hecho" else "",
    )
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return tarea_a_dict(t)


async def cambiar_tarea(org_id: int, tarea_id: int, datos: dict, db_session: AsyncSession) -> dict:
    """Cambia lo que venga en `datos` (solo esos campos). Mover de columna es
    cambiar `estado` (y `orden`, si se suelta en un sitio concreto)."""
    t = await _tarea(org_id, tarea_id, db_session)
    if "titulo" in datos:
        titulo = str(datos.get("titulo") or "").strip()[:200]
        if not titulo:
            raise EquipoError("Escribe qué hay que hacer")
        t.titulo = titulo
    if "notas" in datos:
        t.notas = str(datos.get("notas") or "").strip()[:4000]
    if "prioridad" in datos:
        t.prioridad = prioridad_ok(datos.get("prioridad") or "")
    if "fecha" in datos:
        t.fecha = fecha_ok(datos.get("fecha") or "")
    if "course_uuid" in datos:
        t.course_uuid = curso_ok(datos.get("course_uuid") or "")
    if "asignado_id" in datos:
        t.asignado_id, t.asignado = await _asignado(org_id, int(datos.get("asignado_id") or 0), db_session)
    if "estado" in datos:
        nuevo = estado_ok(datos.get("estado") or "")
        if nuevo != t.estado:
            t.done_at = _ahora() if nuevo == "hecho" else ""
            if "orden" not in datos:
                t.orden = orden_arriba(await _ordenes(org_id, nuevo, db_session))
            t.estado = nuevo
    if "orden" in datos:
        try:
            t.orden = float(datos.get("orden"))
        except (TypeError, ValueError):
            pass
    t.updated_at = _ahora()
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return tarea_a_dict(t)


async def borrar_tarea(org_id: int, tarea_id: int, user_id: int, es_admin: bool, db_session: AsyncSession) -> None:
    t = await _tarea(org_id, tarea_id, db_session)
    if not es_admin and t.creado_por_id != user_id:
        raise EquipoError("Solo quien la creó o un administrador puede borrarla", 403)
    await db_session.delete(t)
    await db_session.commit()


# ── El manual ────────────────────────────────────────────────────────────


def doc_a_dict(d: EquipoDocumento) -> dict:
    return {
        "id": d.id,
        "titulo": d.titulo,
        "seccion": d.seccion,
        "texto": d.texto or "",
        "orden": d.orden,
        "creado_por": d.creado_por,
        "actualizado_por": d.actualizado_por,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


async def listar_docs(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (await db_session.execute(select(EquipoDocumento).where(EquipoDocumento.org_id == org_id))).scalars().all()
    return sorted((doc_a_dict(d) for d in filas), key=lambda d: (d["orden"], d["id"] or 0))


async def _doc(org_id: int, doc_id: int, db_session: AsyncSession) -> EquipoDocumento:
    d = await db_session.get(EquipoDocumento, doc_id)
    if not d or d.org_id != org_id:
        raise EquipoError("Esa página ya no existe", 404)
    return d


async def crear_doc(org_id: int, datos: dict, autor, db_session: AsyncSession) -> dict:
    titulo = str(datos.get("titulo") or "").strip()[:200]
    if not titulo:
        raise EquipoError("Ponle un título a la página")
    existentes = await listar_docs(org_id, db_session)
    ahora = _ahora()
    d = EquipoDocumento(
        org_id=org_id,
        titulo=titulo,
        seccion=str(datos.get("seccion") or "").strip()[:80],
        texto=str(datos.get("texto") or "")[:40000],
        orden=(max((e["orden"] for e in existentes), default=0) + 1),
        creado_por=nombre_de(autor),
        actualizado_por=nombre_de(autor),
        created_at=ahora,
        updated_at=ahora,
    )
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    return doc_a_dict(d)


async def cambiar_doc(org_id: int, doc_id: int, datos: dict, autor, db_session: AsyncSession) -> dict:
    d = await _doc(org_id, doc_id, db_session)
    if "titulo" in datos:
        titulo = str(datos.get("titulo") or "").strip()[:200]
        if not titulo:
            raise EquipoError("Ponle un título a la página")
        d.titulo = titulo
    if "seccion" in datos:
        d.seccion = str(datos.get("seccion") or "").strip()[:80]
    if "texto" in datos:
        d.texto = str(datos.get("texto") or "")[:40000]
    if "orden" in datos:
        try:
            d.orden = float(datos.get("orden"))
        except (TypeError, ValueError):
            pass
    d.actualizado_por = nombre_de(autor)
    d.updated_at = _ahora()
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    return doc_a_dict(d)


async def borrar_doc(org_id: int, doc_id: int, db_session: AsyncSession) -> None:
    d = await _doc(org_id, doc_id, db_session)
    await db_session.delete(d)
    await db_session.commit()


#: La plantilla del manual: el proceso que la escuela ya sigue, escrito para
#: editarlo. Nada de datos que no se sepan (horarios, nombres, sueldos).
PLANTILLA: list[tuple[str, str, str]] = [
    (
        "Cada semana de clase",
        "Preparar la semana",
        "## Antes de la clase\n"
        "1. En la página de la clase, «Nueva semana»: tema, día de la clase, la presentación en PDF, la lección de la que salen los ejercicios y la tarea.\n"
        "2. Si la clase tiene dos grupos, deja marcado «Crearla también en…»: la misma semana sale en los dos.\n"
        "3. Deja marcada la casilla de la campana para que los alumnos sepan que ya está la presentación.\n"
        "\n"
        "## Qué ven los alumnos\n"
        "- Antes del día de la clase solo ven la presentación.\n"
        "- El día de la clase se abren la grabación, los ejercicios y la tarea.\n",
    ),
    (
        "Cada semana de clase",
        "El día de la clase",
        "## Antes de empezar\n"
        "1. Enciende la sala con tiempo: página de la clase → «Encender la sala».\n"
        "2. Prueba a compartir pantalla en el ordenador desde el que vas a dar la clase (en Mac, el permiso de «Grabación de pantalla» obliga a reiniciar el navegador).\n"
        "3. Para que se oiga un vídeo, comparte una pestaña del navegador con «Compartir audio».\n"
        "\n"
        "## Durante la clase\n"
        "- La clase se graba sola de principio a fin: no hay que hacer nada.\n"
        "- Pasa lista: «Preparar clases» → la tarjeta de la clase → «Pasar lista».\n",
    ),
    (
        "Cada semana de clase",
        "Después de la clase",
        "1. Sube la grabación a la semana y **publícala** (una clase añadida a mano nace sin publicar y los alumnos no la ven).\n"
        "2. Corrige las tareas: «Seguimiento» → «Por corregir». Puedes corregir por escrito o con una nota de voz.\n"
        "3. Si hace falta, «Avisar a la clase»: a todos o solo a quien no ha entregado la tarea.\n",
    ),
    (
        "Alumnos",
        "Check-in cada 4 semanas",
        "- En las semanas 4, 8 y 12 de su camino, cada alumno sale arriba de «Seguimiento».\n"
        "- El mensaje de WhatsApp ya va escrito: mándalo, habla con él y marca «Hecho» con una nota de lo que te ha contado.\n",
    ),
    (
        "Alumnos",
        "Responder consultas",
        "- Las consultas están en «Responder consultas».\n"
        "- En la web prometemos respuesta en menos de 24 horas: mira las consultas cada día.\n",
    ),
    (
        "Spreekclub",
        "Hablar por parejas o en grupos de 3",
        "1. Entra en la sala del Spreekclub: como parte del equipo entras como anfitrión.\n"
        "2. En la barra de la llamada, abre las salas pequeñas (en Daily se llaman «Breakout rooms»).\n"
        "3. Elige cuántas salas quieres o cuántas personas por sala y repártelas. Puedes mover a alguien de una sala a otra.\n"
        "4. Para volver a juntar a todos, cierra las salas pequeñas.\n"
        "\n"
        "- Los alumnos no ven ese botón: solo el equipo.\n",
    ),
]


async def sembrar_plantilla(org_id: int, autor, db_session: AsyncSession) -> list[dict]:
    """Crea las páginas de la plantilla. Solo si el manual está vacío: nunca
    pisa ni duplica lo que ya se haya escrito."""
    if await listar_docs(org_id, db_session):
        raise EquipoError("El manual ya tiene páginas", 409)
    ahora = _ahora()
    for i, (seccion, titulo, texto) in enumerate(PLANTILLA):
        db_session.add(
            EquipoDocumento(
                org_id=org_id,
                titulo=titulo,
                seccion=seccion,
                texto=texto,
                orden=float(i + 1),
                creado_por=nombre_de(autor),
                actualizado_por=nombre_de(autor),
                created_at=ahora,
                updated_at=ahora,
            )
        )
    await db_session.commit()
    return await listar_docs(org_id, db_session)


def para_quien(t: dict, user_id: int) -> bool:
    """Si una tarea le toca a esta persona: suya o de todo el equipo."""
    return not t.get("asignado_id") or t.get("asignado_id") == user_id


def mias_pendientes(tareas: list[dict], user_id: int, hoy: str) -> list[dict]:
    """Las tareas sin hacer de esta persona (y las de todo el equipo), primero
    las que vencen antes; las sin fecha, al final."""
    lista = [t for t in tareas if t["estado"] != "hecho" and para_quien(t, user_id)]
    return sorted(lista, key=lambda t: (t["fecha"] or "9999-99-99", t["prioridad"] != "alta", t["orden"]))


def vencida(t: dict, hoy: str) -> bool:
    return bool(t.get("fecha")) and t["fecha"] < hoy and t.get("estado") != "hecho"


__all__ = [
    "EquipoError",
    "ESTADOS",
    "PLANTILLA",
    "borrar_doc",
    "borrar_tarea",
    "cambiar_doc",
    "cambiar_tarea",
    "crear_doc",
    "crear_tarea",
    "listar_docs",
    "listar_tareas",
    "mias_pendientes",
    "miembros",
    "sembrar_plantilla",
    "vencida",
]

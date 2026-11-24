"""El vídeo de bienvenida para los alumnos nuevos (24/11/2026).

Pedido del usuario: el vídeo de onboarding «para que lo vean todos los que
entran a partir de hoy». Se decidió con él:

- **Sin ventana nueva**: quien entra ya ve la visita guiada y la de «Tu plan».
  El vídeo va en una tarjeta fija arriba del Inicio («Empieza por aquí»), solo
  para los ALUMNOS (rol 4) que entraron desde `DESDE` (el día en que pagaron,
  hora de Países Bajos, como el resto de reglas de la escuela). Se va cuando lo
  marca visto. A los que ya estaban no les sale: lo tienen en la introducción
  de la formación (la clase «Welkom!») y en «Empieza aquí».
- **Visto** = pulsó «Ya lo he visto» en la tarjeta (se guarda en
  `student_progress.onboarding_state.bienvenida_video`, la fecha) o terminó la
  clase «Welkom!» de la formación (el recorrido, `trail_step`). Lo uno o lo
  otro: quien lo vio dentro del curso no vuelve a tenerlo en el Inicio.
- El vídeo y el día se pueden cambiar sin desplegar con org_config
  `video_bienvenida` = {url, desde, titulo}. Sin nada guardado, los de abajo.

El servidor MEZCLA en `onboarding_state` (no lo reemplaza): la visita guiada y
la bienvenida vieja guardan ahí sus marcas y no se pueden perder.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.student_progress import StudentProgress

logger = logging.getLogger(__name__)

#: El vídeo de Bunny que pasó el usuario (biblioteca de las lecciones).
URL_POR_DEFECTO = "https://iframe.mediadelivery.net/embed/675650/de687ced-b59d-4abd-8e3b-95591b3cdfc6"
#: Desde qué día de entrada se enseña la tarjeta.
DESDE_POR_DEFECTO = "2026-11-24"
TITULO_POR_DEFECTO = "Welkom! Tu bienvenida a la escuela"
#: El nombre de la clase del vídeo en la introducción de la formación.
NOMBRE_CLASE = "welkom"
ALUMNO = 4
CLAVE = "bienvenida_video"


def url_de_reproductor(url: str) -> str:
    """El enlace que da Bunny para compartir (`player.mediadelivery.net/play/…`)
    no se puede meter en la página: el que sí es `iframe.mediadelivery.net/embed/…`.
    Se le añaden los parámetros del código oficial de Bunny (ver CLAUDE.md:
    sin `responsive=true` el vídeo se ve encogido al empezar)."""
    u = (url or "").strip()
    if not u:
        return ""
    u = u.replace("player.mediadelivery.net/play/", "iframe.mediadelivery.net/embed/")
    if "iframe.mediadelivery.net/embed/" in u and "responsive=" not in u:
        u += ("&" if "?" in u else "?") + "autoplay=false&preload=true&responsive=true"
    return u


def toca(rol: Optional[int], dia_entrada: str, desde: str, visto: bool) -> bool:
    """Puro. ¿Le sale la tarjeta del vídeo en el Inicio?"""
    if rol != ALUMNO or visto:
        return False
    if not dia_entrada or not desde:
        return False
    return dia_entrada >= desde


async def ajustes(org_id: int, db_session: AsyncSession) -> dict:
    url, desde, titulo = URL_POR_DEFECTO, DESDE_POR_DEFECTO, TITULO_POR_DEFECTO
    try:
        from src.db.organization_config import OrganizationConfig

        fila = (
            await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
        ).scalars().first()
        cfg = (getattr(fila, "config", None) or {}).get("video_bienvenida") or {}
        if isinstance(cfg, dict):
            url = str(cfg.get("url") or url)
            desde = str(cfg.get("desde") or desde)[:10]
            titulo = str(cfg.get("titulo") or titulo)[:120]
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer el ajuste del vídeo de bienvenida")
    return {"url": url_de_reproductor(url), "desde": desde, "titulo": titulo}


async def _org_y_rol(user_id: int, db_session: AsyncSession) -> tuple[Optional[int], Optional[int], str]:
    from src.db.user_organizations import UserOrganization
    from src.services.panel.tandas import dia_nl

    fila = (
        await db_session.execute(select(UserOrganization).where(UserOrganization.user_id == user_id))
    ).scalars().first()
    if not fila:
        return None, None, ""
    return fila.org_id, fila.role_id, dia_nl(fila.creation_date) if fila.creation_date else ""


async def vistos_en_el_curso(user_ids: list, db_session: AsyncSession) -> set:
    """Quién terminó la clase «Welkom!» de la formación (por el recorrido)."""
    if not user_ids:
        return set()
    try:
        from sqlalchemy import func

        from src.db.courses.activities import Activity
        from src.db.courses.courses import Course
        from src.db.trail_steps import TrailStep
        from src.services.courses.avance_modulos import FORMACION_UUID

        filas = (
            await db_session.execute(
                select(TrailStep.user_id)
                .join(Activity, Activity.id == TrailStep.activity_id)  # type: ignore[arg-type]
                .join(Course, Course.id == Activity.course_id)  # type: ignore[arg-type]
                .where(
                    TrailStep.user_id.in_(user_ids),  # type: ignore[attr-defined]
                    TrailStep.complete == True,  # noqa: E712
                    Course.course_uuid.in_([f"course_{FORMACION_UUID}", FORMACION_UUID]),  # type: ignore[attr-defined]
                    func.lower(Activity.name).like(f"{NOMBRE_CLASE}%"),
                )
            )
        ).scalars().all()
        return {int(u) for u in filas}
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo mirar quién vio la clase de bienvenida")
        return set()


async def vistos_de(user_ids: list, db_session: AsyncSession) -> dict:
    """{user_id: fecha} de quien lo marcó visto en la tarjeta; los que lo vieron
    solo en el curso salen con "curso". Para Progreso."""
    salida: dict = {}
    if not user_ids:
        return salida
    try:
        filas = (
            await db_session.execute(
                select(StudentProgress.user_id, StudentProgress.onboarding_state).where(
                    StudentProgress.user_id.in_(user_ids)  # type: ignore[attr-defined]
                )
            )
        ).all()
        for uid, estado in filas:
            if isinstance(estado, dict) and estado.get(CLAVE):
                salida[int(uid)] = str(estado.get(CLAVE))
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer quién vio el vídeo de bienvenida")
    for uid in await vistos_en_el_curso([u for u in user_ids if u not in salida], db_session):
        salida.setdefault(uid, "curso")
    return salida


async def estado(user_id: int, db_session: AsyncSession) -> dict:
    """`GET /student/bienvenida`."""
    org_id, rol, dia = await _org_y_rol(user_id, db_session)
    if not org_id:
        return {"toca": False, "visto": False, "url": "", "titulo": ""}
    aj = await ajustes(org_id, db_session)
    # «Empieza aquí» lo enseña a todos (también a quien ya estaba): por eso se
    # devuelven siempre el vídeo y si lo vio; `toca` es solo la tarjeta del Inicio.
    visto = user_id in await vistos_de([user_id], db_session)
    return {"toca": toca(rol, dia, aj["desde"], visto), "visto": visto, "url": aj["url"], "titulo": aj["titulo"]}


async def marcar_visto(user_id: int, db_session: AsyncSession) -> dict:
    """`POST /student/bienvenida/visto`. Mezcla, no reemplaza."""
    fila = (
        await db_session.execute(select(StudentProgress).where(StudentProgress.user_id == user_id))
    ).scalars().first()
    if fila is None:
        fila = StudentProgress(user_id=user_id)
    nuevo = dict(fila.onboarding_state or {})
    if not nuevo.get(CLAVE):
        nuevo[CLAVE] = datetime.now(timezone.utc).isoformat()
    fila.onboarding_state = nuevo
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "visto": True}

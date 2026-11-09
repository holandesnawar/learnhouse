"""
Las presentaciones de los alumnos, de chat a tablón (09/11/2026).

Pedido: "activa el diseño nuevo con los mensajes de los alumnos de
presentaciones ya como posts… con cuidado".

Cómo es por dentro (estudiado antes de tocar nada): los mensajes del chat y
las publicaciones del tablón son la MISMA tabla (`discussion`), y lo único que
decide cómo se pinta un canal es `community.kind` ("chat" o "posts"). Así que
pasar el canal a tablón es cambiar esa columna y nada más:

- **No se toca ni se borra ningún mensaje.** Cada mensaje sale como una
  publicación con su foto y su audio; las respuestas en hilo (`threadParent`
  dentro del contenido) salen debajo de su presentación como respuestas
  (ChannelPosts / DiscussionDetail), no como publicaciones sueltas.
- **Se hace UNA vez** (`_MARCA` en org_config `migraciones`), al arrancar, solo
  con los canales que se llaman como de presentaciones (`es_de_presentaciones`)
  y que siguen siendo chat. Si después alguien lo devuelve a chat, no se vuelve
  a cambiar solo.
- **Vuelta atrás**: `UPDATE community SET kind='chat' WHERE community_uuid IN
  (…)` con los uuid que guarda la marca. Los mensajes siguen ahí.
- Nunca rompe el arranque: cualquier fallo queda en el registro.
"""

from __future__ import annotations

import logging
import unicodedata
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

_MARCA = "presentaciones_posts"


def _plano(t: str) -> str:
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()


def es_de_presentaciones(nombre: str) -> bool:
    """«👋 Presentaciones», «Preséntate», «Presentate aquí»… (sin tildes)."""
    n = _plano(nombre)
    return "presenta" in n or "presentate" in n


async def pasar(db: AsyncSession) -> dict:
    from src.db.communities.communities import Community
    from src.db.organization_config import OrganizationConfig

    hechos: dict = {}
    configs = (await db.execute(select(OrganizationConfig))).scalars().all()
    for oc in configs:
        config = dict(oc.config or {}) if isinstance(oc.config, dict) else {}
        migraciones = dict(config.get("migraciones") or {}) if isinstance(config.get("migraciones"), dict) else {}
        if migraciones.get(_MARCA):
            continue
        canales = (
            await db.execute(select(Community).where(Community.org_id == oc.org_id))
        ).scalars().all()
        cambiados = []
        for c in canales:
            if (getattr(c, "kind", "chat") or "chat") == "chat" and es_de_presentaciones(c.name or ""):
                c.kind = "posts"
                c.update_date = str(datetime.now())
                db.add(c)
                cambiados.append(c.community_uuid)
        migraciones[_MARCA] = {"fecha": datetime.now().isoformat(timespec="seconds"), "canales": cambiados}
        config["migraciones"] = migraciones
        oc.config = config
        db.add(oc)
        hechos[oc.org_id] = cambiados
    await db.commit()
    return hechos


async def pasar_si_toca() -> None:
    """Lo llama el arranque. Nunca rompe el arranque."""
    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from config.config import get_learnhouse_config

        url = str(get_learnhouse_config().database_config.sql_connection_string)  # type: ignore
        url = url.replace("postgresql+psycopg2://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")
        motor = create_async_engine(url, echo=False, pool_pre_ping=True)
        try:
            async with async_sessionmaker(motor, class_=AsyncSession, expire_on_commit=False)() as db:
                hechos = await pasar(db)
                if any(hechos.values()):
                    logger.warning("Presentaciones a tablón: %s", hechos)
        finally:
            await motor.dispose()
        try:
            from src.services.orgs.cache import invalidate_org_config_cache

            for org_id in hechos:
                invalidate_org_config_cache(org_id)
        except Exception:  # noqa: BLE001
            pass
    except Exception as e:  # noqa: BLE001
        logger.warning("Presentaciones a tablón: no se pudo (%s)", e)

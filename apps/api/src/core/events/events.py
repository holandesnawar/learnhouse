import asyncio
import logging
from typing import Callable
from fastapi import FastAPI
from config.config import LearnHouseConfig, get_learnhouse_config
from src.core.events.autoinstall import auto_install
from src.core.events.content import check_content_directory
from src.core.events.database import close_database, connect_to_db
from src.core.events.logs import create_logs_dir
from src.core.ee_hooks import run_ee_startup

logger = logging.getLogger(__name__)

_cleanup_task = None
_bunny_task = None


async def _grabaciones_a_bunny_cada_15_min():
    """Pide a Bunny las grabaciones de la sala recién terminadas (26/11/2026).

    Lo hace la propia escuela, sin depender de GitHub Actions (que se puede
    apagar): la primera vuelta a los 2 minutos de arrancar y luego cada 15.
    La tarea `grabaciones-bunny.yaml` llama a lo mismo; repetirlo no pide nada
    dos veces (Bunny es la memoria). Ver `copiar_las_nuevas` en
    services/salas/estudio_grabaciones.py."""
    await asyncio.sleep(120)
    while True:
        try:
            from src.core.events.database import _async_session_factory
            from src.services.salas.estudio_grabaciones import copiar_las_nuevas

            async with _async_session_factory() as db_session:
                resultado = await copiar_las_nuevas(1, db_session)
            if resultado.get("pedidas") or resultado.get("reintentadas"):
                logger.info("Grabaciones a Bunny: %s", resultado)
        except Exception as e:  # noqa: BLE001 - nunca tirar la escuela por esto
            logger.warning("Grabaciones a Bunny: %s", e)
        await asyncio.sleep(900)


async def _periodic_migration_cleanup():
    """Run migration temp cleanup every 10 minutes."""
    from src.services.courses.migration.migration_service import cleanup_old_temp_migrations
    while True:
        await asyncio.sleep(600)  # 10 minutes
        try:
            cleanup_old_temp_migrations()
        except Exception as e:
            logger.warning("Periodic migration cleanup failed: %s", e)


async def _reconcile_packs():
    """Reconcile Redis pack credits with DB state on startup."""
    try:
        from src.core.events.database import _async_session_factory
        from src.services.packs.packs import reconcile_pack_credits
        async with _async_session_factory() as db_session:
            result = await reconcile_pack_credits(db_session)
            logger.info("Pack reconciliation on startup: %s", result)
    except Exception as e:
        logger.warning("Pack reconciliation skipped (non-fatal): %s", e)


def startup_app(app: FastAPI) -> Callable:
    async def start_app() -> None:
        # Get LearnHouse Config
        learnhouse_config: LearnHouseConfig = get_learnhouse_config()
        app.learnhouse_config = learnhouse_config  # type: ignore

        # Connect to database
        await connect_to_db(app)

        # Create logs directory
        await create_logs_dir()

        # Create content directory
        await check_content_directory()

        # Check if auto-installation is needed
        await auto_install()

        # Solo en la escuela de pruebas, con LEARNHOUSE_DATOS_DE_PRUEBA=si:
        # alumnos, clases y comunidad inventados (src/services/demo/datos_prueba.py).
        from src.services.demo.datos_prueba import sembrar_si_toca
        await sembrar_si_toca()

        # Las presentaciones de los alumnos, de chat a tablón, una sola vez
        # (09/11/2026, src/services/communities/presentaciones_posts.py).
        from src.services.communities.presentaciones_posts import pasar_si_toca
        await pasar_si_toca()

        # Reconcile pack credits (Redis ↔ DB)
        await _reconcile_packs()

        # Clean up stale migration temp directories (on startup + every 10 min)
        from src.services.courses.migration.migration_service import cleanup_old_temp_migrations
        cleanup_old_temp_migrations()
        global _cleanup_task
        _cleanup_task = asyncio.create_task(_periodic_migration_cleanup())
        global _bunny_task
        _bunny_task = asyncio.create_task(_grabaciones_a_bunny_cada_15_min())

        # Start Enterprise Edition Startup tasks if available
        run_ee_startup(app)

    return start_app


def shutdown_app(app: FastAPI) -> Callable:
    async def close_app() -> None:
        if _bunny_task:
            _bunny_task.cancel()
        if _cleanup_task:
            _cleanup_task.cancel()
            try:
                await _cleanup_task
            except asyncio.CancelledError:
                pass
        # Wait for in-flight webhook deliveries before closing the HTTP client
        from src.services.webhooks.dispatch import close_webhook_client, _background_tasks as _webhook_tasks
        if _webhook_tasks:  # pragma: no cover
            await asyncio.gather(*list(_webhook_tasks), return_exceptions=True)
        await close_webhook_client()
        await close_database(app)

    return close_app

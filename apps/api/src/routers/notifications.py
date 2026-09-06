"""Avisos por email a los alumnos (solo administradores)."""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.notifications.broadcast import _send_many, broadcast

logger = logging.getLogger(__name__)

router = APIRouter()

#: ⚠️ CON GUIONES. nginx tira por defecto las cabeceras con `_`
#: (`underscores_in_headers off`) y es la puerta del contenedor, así que una
#: cabecera con guiones bajos no llega hasta aquí. Mismo motivo y misma forma
#: que el token de las copias de seguridad.
CABECERA_SECRETO = "X-Cron-Token"


def _mismo_secreto(a: str, b: str) -> bool:
    """Compara sin filtrar por dónde dejan de parecerse ni cuánto miden."""
    ha = hashlib.sha256(a.encode("utf-8")).digest()
    hb = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(ha, hb)


class BroadcastPayload(BaseModel):
    org_id: int
    # "announcement" = novedad rápida · "class" = clase confirmada
    # "news" = aviso redactado en el panel, con formato
    kind: str = "announcement"
    title: str
    body: str = ""
    when_text: str = ""
    url: str = ""
    # Enlace al evento dentro de la plataforma (respaldo del botón).
    event_url: str = ""
    # Cuerpo con formato (HTML del editor) para los avisos "news".
    body_html: str = ""
    cta_label: str = ""
    cta_url: str = ""
    # true = enviar solo a quien lo escribe, para probar.
    test_only: bool = False


@router.post(
    "/broadcast",
    summary="Avisar por email a los alumnos de la organización.",
)
async def api_broadcast(
    request: Request,
    payload: BroadcastPayload,
    background_tasks: BackgroundTasks,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    data = payload.model_dump()
    prepared = await broadcast(
        request, payload.org_id, payload.kind, data, current_user, db_session
    )
    # Los textos cambiados desde el panel se leen AQUÍ, con la sesión todavía
    # abierta: el envío corre en segundo plano y allí ya no hay base de datos.
    from src.services.orgs.orgs import get_org_email_texts

    textos_correo = await get_org_email_texts(payload.org_id, db_session)
    # El envío no bloquea la respuesta: quien pulsa el botón no espera 40 correos.
    background_tasks.add_task(
        _send_many, payload.kind, prepared["recipients"], data, textos_correo
    )
    return {"queued": prepared["count"], "test": bool(prepared.get("test"))}


@router.post(
    "/drip-diario",
    summary="Avisa por email de los módulos que se abren hoy. La llama una tarea diaria.",
)
async def api_drip_diario(
    request: Request,
    org_id: int = 1,
    db_session: AsyncSession = Depends(get_db_session),
):
    """El correo de «se te ha abierto un módulo».

    Va sin sesión y con un secreto compartido porque quien la llama es una
    tarea programada, no una persona: igual que el workflow de las copias.
    Sin `LEARNHOUSE_CRON_TOKEN` puesto, la ruta queda cerrada — nunca abierta
    de par en par por olvidar una variable.

    Es idempotente: se puede lanzar dos veces el mismo día sin repetirle el
    correo a nadie (ver `drip_email_sent`).
    """
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")

    recibido = (
        request.headers.get(CABECERA_SECRETO)
        or request.headers.get("LEARNHOUSE_CRON_TOKEN")
        or ""
    ).strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")

    from src.services.notifications.drip import avisar_modulos_abiertos_hoy

    resultado = await avisar_modulos_abiertos_hoy(org_id, db_session)
    logger.info("Goteo diario: %s", resultado)
    return resultado

"""
Contactos — la ficha de cada persona que ha tratado con la escuela.

Dos puertas:
- `POST /evento`: la web (nawar-web) avisa de un alta que no tiene tabla
  propia (guías, Instagram…). Pública como `/payments/solicitudes`, pero con
  un candado opcional: si `LEARNHOUSE_WEB_TOKEN` está puesta en Railway, hace
  falta la cabecera `X-Web-Token` con el mismo valor (y `SCHOOL_WEB_TOKEN` en
  Vercel). Sin la variable, entra sin candado, como hoy las solicitudes.
  ⚠️ La cabecera va con GUIONES: nginx tira las que llevan `_`.
- `GET /org/{org_id}…`: la lista y el detalle, solo administradores.
"""

import hmac
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.contact_event import ContactEventCreate
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.contactos.contactos import (
    detalle_contacto,
    listar_contactos,
    registrar_evento,
)
from src.services.contactos.llamadas import listar_llamadas
from src.services.orgs.acceso import exigir_acceso

logger = logging.getLogger(__name__)

router = APIRouter()


def _candado_web(request: Request) -> None:
    esperado = (os.environ.get("LEARNHOUSE_WEB_TOKEN") or "").strip()
    if not esperado:
        return
    dado = (request.headers.get("X-Web-Token") or "").strip()
    if not dado or not hmac.compare_digest(dado, esperado):
        raise HTTPException(status_code=401, detail="Token de la web incorrecto")


@router.post(
    "/evento",
    summary="La web avisa de algo que hizo una persona (guía descargada, DM…).",
)
async def api_evento(
    request: Request,
    data: ContactEventCreate,
    db_session: AsyncSession = Depends(get_db_session),
):
    _candado_web(request)
    fila = await registrar_evento(data, db_session)
    return {"ok": True, "id": fila.id}


@router.get(
    "/org/{org_id}",
    summary="Todos los contactos, una ficha por persona, el más reciente primero.",
)
async def api_contactos(
    request: Request,
    org_id: int,
    q: str = "",
    limit: int = 300,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # Administradores y el closer (CONTACTOS_ROLE_IDS). El profe no: no vende.
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await listar_contactos(q, min(max(limit, 1), 2000), db_session)


@router.get(
    "/org/{org_id}/llamadas",
    summary="Quién ha pedido una llamada (la cualificación de /agendar), con sus respuestas.",
)
async def api_llamadas(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return {"llamadas": await listar_llamadas(db_session)}


@router.get(
    "/org/{org_id}/detalle",
    summary="La ficha completa de una persona, con su historial y sus etiquetas del CRM.",
)
async def api_contacto(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    ficha = await detalle_contacto(email, db_session)
    if ficha is None:
        raise HTTPException(status_code=404, detail="No hay nada de ese correo")
    return ficha

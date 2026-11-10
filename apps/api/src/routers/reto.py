"""
«Mijn eerste week» (10/11/2026): el reto personalizado de 7 días. La
explicación entera, en `src/services/reto/reto.py`.

- Las opciones del formulario, apuntarse, leer el plan y terminar un día:
  PÚBLICO (son leads, sin cuenta). Apuntarse lleva tope por IP y campo trampa;
  leer y terminar van con el enlace personal firmado.
- Un administrador con la sesión abierta ve los siete días abiertos, para
  poder revisarlo entero sin esperar una semana.
- La lista de quién lo ha empezado: la puerta de contactos (administradores y
  closer).
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.reto import reto as R
from src.services.security.rate_limiting import check_rate_limit, get_client_ip

router = APIRouter()


def _error(exc: R.RetoError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


async def _es_admin(current_user, db_session: AsyncSession) -> bool:
    """Si quien mira es un administrador de la escuela (o superadmin)."""
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        return False
    try:
        from src.db.user_organizations import UserOrganization
        from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
        from src.security.rbac.rbac import is_user_superadmin

        if await is_user_superadmin(current_user.id, db_session):
            return True
        roles = (await db_session.execute(select(UserOrganization.role_id).where(UserOrganization.user_id == current_user.id))).scalars().all()
        return any(r in ADMIN_OR_MAINTAINER_ROLE_IDS for r in roles)
    except Exception:  # noqa: BLE001
        return False


class EmpezarIn(BaseModel):
    nombre: str = ""
    email: str = ""
    telefono: str = ""
    respuestas: dict = {}
    recorrido: Any = ""
    referrer: str = ""
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""
    utm_term: str = ""
    utm_placement: str = ""
    # Campo trampa: una persona no lo ve; un robot lo rellena.
    website: str = ""


class DiaIn(BaseModel):
    dia: int


@router.get("/opciones", summary="Las preguntas del reto (público).")
async def api_opciones():
    return R.opciones()


@router.post("/empezar", summary="Apuntarse al reto y recibir el enlace personal (público).")
async def api_empezar(request: Request, datos: EmpezarIn, db_session: AsyncSession = Depends(get_db_session)):
    permitido, _n, espera = check_rate_limit(key=f"reto:{get_client_ip(request)}", max_attempts=10, window_seconds=3600)
    if not permitido:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Vuelve a probar en unos minutos.", headers={"Retry-After": str(max(1, espera))})
    if datos.website.strip():
        return {"ok": True, "nuevo": False, "token": ""}
    cuerpo = datos.model_dump()
    if isinstance(cuerpo.get("recorrido"), list):
        cuerpo["recorrido"] = ",".join(str(x) for x in cuerpo["recorrido"])
    try:
        return await R.empezar(cuerpo, db_session)
    except R.RetoError as exc:
        raise _error(exc)


@router.get("/plan/{token}", summary="El plan de esa persona: sus siete días (con el enlace personal).")
async def api_plan(
    token: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        return await R.leer(token, db_session, todo=await _es_admin(current_user, db_session))
    except R.RetoError as exc:
        raise _error(exc)


@router.post("/plan/{token}/hecho", summary="Terminar un día.")
async def api_hecho(
    token: str,
    body: DiaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        return await R.terminar_dia(token, body.dia, db_session, todo=await _es_admin(current_user, db_session))
    except R.RetoError as exc:
        raise _error(exc)


@router.post("/plan/{token}/llamada", summary="Pulsó el botón de la llamada (para la ficha del closer).")
async def api_llamada(token: str, db_session: AsyncSession = Depends(get_db_session)):
    await R.pulso_la_llamada(token, db_session)
    return {"ok": True}


@router.get("/org/{org_id}/personas", summary="Quién ha empezado el reto y cuántos días lleva.")
async def api_personas(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.orgs.acceso import exigir_acceso

    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return {"personas": await R.todos(db_session)}

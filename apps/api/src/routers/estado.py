"""
Estado de la escuela (10/11/2026): lo que falla y lo que va lento. La
explicación entera, en `src/services/estado/estado.py`.

- `POST /estado/pantalla`: PÚBLICA. El navegador avisa de que una pantalla se
  rompió. Va como texto (sin consulta previa de CORS), con tope por IP, y
  contesta siempre 204: es un aviso, no le importa a quien navega.
- `GET /estado/org/{org_id}`: el panel. Solo administradores.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.estado import estado as E

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/pantalla",
    status_code=204,
    summary="El navegador avisa de que una pantalla se ha roto (sin datos personales).",
)
async def api_pantalla(request: Request):
    try:
        from src.services.security.rate_limiting import check_rate_limit, get_client_ip

        permitido, _, _ = check_rate_limit(f"estado-pantalla:{get_client_ip(request)}", 30, 3600)
        if permitido and E.activo():
            datos = json.loads((await request.body())[:4000] or b"{}")
            evento = E.evento_de_pantalla(datos, request.headers.get("user-agent", "")[:300])
            if evento:
                try:
                    from src.security.auth import extract_jwt_from_request

                    evento["token"] = extract_jwt_from_request(request) or ""
                except Exception:  # noqa: BLE001
                    pass
                E.asegurar_tarea()
                E.apuntar(evento)
    except Exception:  # noqa: BLE001
        logger.debug("No se pudo apuntar una pantalla rota", exc_info=True)
    return Response(status_code=204)


@router.get("/org/{org_id}", summary="Estado de la escuela: comprobaciones en vivo y lo que ha fallado (solo administradores).")
async def api_estado(
    request: Request,
    org_id: int,
    dias: int = 7,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.routers.contactos import _es_admin

    if not getattr(current_user, "id", None) or not await _es_admin(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return await E.panel(db_session, max(1, min(int(dias or 7), 30)))

"""
El ebook de Black Friday a 1 € (28/10/2026). La explicación entera está en
`src/services/ebook/ebook.py`.

- Pagar y comprobar la compra: público (lo llama la página del ebook, en
  blackfriday.holandesnawar.com). Pagar tiene tope por IP: el navegador llama
  directamente a la escuela, así que la IP es la de quien compra.
- Apuntarse a la lista para desbloquear la oferta: público, con el mismo tope
  (lo llama la portada de blackfriday.holandesnawar.com).
- Descargar el PDF y darse de baja: con el enlace firmado del correo.
- Lo demás (textos, el PDF, los números): administradores.
"""

import html
import logging
import re
from typing import Any, Optional, Union

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, field_validator
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.panel import _admin_progreso
from src.security.auth import get_current_user
from src.services.ebook import ebook as E
from src.services.security.rate_limiting import check_rate_limit, get_client_ip

logger = logging.getLogger(__name__)

router = APIRouter()


def _error(exc: E.EbookError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


class PagoIn(BaseModel):
    nombre: str = ""
    email: str = ""
    canal: str = "organico"
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""
    utm_term: str = ""
    utm_placement: str = ""
    # La web lo manda como lista de marcas (como a /payments/solicitudes);
    # se guarda como texto separado por comas.
    recorrido: Union[str, list[str]] = ""
    referrer: str = ""
    vuelta: str = ""

    @field_validator("recorrido", mode="before")
    @classmethod
    def _recorrido_en_texto(cls, v: Any) -> str:
        marcas = v if isinstance(v, list) else str(v or "").split(",")
        limpias = [m.strip() for m in marcas if isinstance(m, str) and re.fullmatch(r"[a-z-]{1,24}", m.strip())]
        return ",".join(limpias[-12:])[:400]

    @field_validator(
        "nombre", "email", "canal", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
        "utm_placement", "referrer", "vuelta", mode="before",
    )
    @classmethod
    def _texto(cls, v: Any) -> str:
        return "" if v is None else str(v)


@router.post("/pago", summary="Abre la caja de pago (embebida) del ebook a 1 €.")
async def api_pago(request: Request, datos: PagoIn, db_session: AsyncSession = Depends(get_db_session)):
    permitido, _n, espera = check_rate_limit(key=f"ebook:{get_client_ip(request)}", max_attempts=10, window_seconds=3600)
    if not permitido:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Vuelve a probar en unos minutos.",
            headers={"Retry-After": str(max(1, espera))},
        )
    try:
        return await E.crear_pago(datos.model_dump(), db_session)
    except E.EbookError as exc:
        raise _error(exc)


class ListaIn(PagoIn):
    telefono: str = ""
    # El campo trampa: un bot lo rellena; una persona no lo ve.
    website: str = ""

    @field_validator("telefono", "website", mode="before")
    @classmethod
    def _texto_lista(cls, v: Any) -> str:
        return "" if v is None else str(v)


@router.post("/lista", summary="Apuntarse para desbloquear la oferta de Black Friday (sin comprar el ebook).")
async def api_lista(request: Request, datos: ListaIn, db_session: AsyncSession = Depends(get_db_session)):
    permitido, _n, espera = check_rate_limit(key=f"bf-lista:{get_client_ip(request)}", max_attempts=10, window_seconds=3600)
    if not permitido:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Vuelve a probar en unos minutos.",
            headers={"Retry-After": str(max(1, espera))},
        )
    if datos.website.strip():
        return {"ok": True, "nuevo": False}
    try:
        return await E.apuntar_lista(datos.model_dump(), db_session)
    except E.EbookError as exc:
        raise _error(exc)


@router.get("/compra/{session_id}", summary="¿Está pagada esta compra del ebook? (la página de vuelta)")
async def api_compra(session_id: str, db_session: AsyncSession = Depends(get_db_session)):
    try:
        return await E.estado_compra(session_id, db_session)
    except E.EbookError as exc:
        raise _error(exc)


def _pagina(titulo: str, texto: str, boton: str = "", enlace: str = "") -> HTMLResponse:
    """Una página suelta y sencilla, con la marca (para la baja y los enlaces
    caducados)."""
    accion = (
        f'<a href="{html.escape(enlace)}" style="display:inline-block;margin-top:22px;padding:13px 26px;'
        f'background:#4da3ff;color:#0a1656;border-radius:10px;font-weight:700;text-decoration:none">'
        f"{html.escape(boton)}</a>"
        if boton and enlace
        else ""
    )
    return HTMLResponse(
        f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{html.escape(titulo)} · Holandés Nawar</title></head>
<body style="margin:0;background:#F0F5FF;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171a2e">
<main style="max-width:520px;margin:12vh auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #DDE6F5">
<h1 style="margin:0 0 12px;font-size:24px;color:#1D0084">{html.escape(titulo)}</h1>
<p style="margin:0;font-size:16px;line-height:1.6">{html.escape(texto)}</p>{accion}
</main></body></html>"""
    )


@router.get("/descarga/{token}", summary="Descargar el ebook (enlace del correo).")
async def api_descarga(token: str, db_session: AsyncSession = Depends(get_db_session)):
    if not E.leer_token(token, "ebook"):
        return _pagina(
            "Este enlace no vale",
            "El enlace de descarga está mal copiado o ha caducado. Escríbenos a info@holandesnawar.com y te lo "
            "mandamos de nuevo.",
        )
    ruta = await E.pdf_para_descargar(db_session)
    if ruta is None:
        return _pagina(
            "El ebook se está preparando",
            "Estamos subiendo el PDF. Vuelve a abrir este enlace en un rato; si sigue sin funcionar, escríbenos a "
            "info@holandesnawar.com.",
        )
    return FileResponse(
        ruta,
        media_type="application/pdf",
        filename=f"{E.NOMBRE_EBOOK} - Holandes Nawar.pdf",
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/baja/{token}", summary="Darse de baja de la campaña del ebook (enlace del correo).")
async def api_baja(token: str, db_session: AsyncSession = Depends(get_db_session)):
    email = E.leer_token(token, "baja")
    if not email:
        return _pagina("Este enlace no vale", "Escríbenos a info@holandesnawar.com y te damos de baja a mano.")
    await E.baja(email, db_session)
    return _pagina(
        "Hecho",
        "Ya no te mandaremos más correos de esta campaña. Tu ebook sigue siendo tuyo: el enlace de descarga de "
        "tu primer correo sigue funcionando.",
    )


# ── Administradores ─────────────────────────────────────────────────────────


class AjustesIn(BaseModel):
    activo: Optional[bool] = None
    campana: Optional[bool] = None
    desde: Optional[str] = None
    hasta: Optional[str] = None
    systeme_desde: Optional[str] = None
    entrega: Optional[dict] = None
    pendiente: Optional[dict] = None
    acceso: Optional[dict] = None
    formulario: Optional[dict] = None
    correos: Optional[list[dict[str, Any]]] = None


class VistaIn(BaseModel):
    cual: str = "entrega"
    a_mi: bool = False


async def _todo(org_id: int, db_session: AsyncSession) -> dict:
    cfg = await E.leer(db_session, org_id)
    return {
        **cfg,
        "pdf_listo": bool((await E.pdf_para_descargar(db_session)) and cfg.get("pdf")),
        "nombre_ebook": E.NOMBRE_EBOOK,
        "huecos": list(E.HUECOS),
        "bf_url": E.bf_url(),
        "numeros": await E.resumen(org_id, db_session),
    }


@router.get("/org/{org_id}", summary="El ebook de Black Friday: ajustes, correos, PDF y números.")
async def api_ajustes(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_progreso(request, org_id, current_user, db_session)
    return await _todo(org_id, db_session)


@router.put("/org/{org_id}", summary="Guardar los ajustes y los textos de los correos.")
async def api_guardar(
    request: Request,
    org_id: int,
    datos: AjustesIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_progreso(request, org_id, current_user, db_session)
    try:
        await E.guardar(org_id, datos.model_dump(exclude_none=True), db_session)
    except E.EbookError as exc:
        raise _error(exc)
    return await _todo(org_id, db_session)


@router.post("/org/{org_id}/pdf", summary="Subir el PDF del ebook.")
async def api_pdf(
    request: Request,
    org_id: int,
    archivo: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_progreso(request, org_id, current_user, db_session)
    datos = await archivo.read(E.MAX_PDF + 1)
    try:
        await E.guardar_pdf(org_id, archivo.filename or "ebook.pdf", datos, db_session)
    except E.EbookError as exc:
        raise _error(exc)
    return await _todo(org_id, db_session)


@router.post("/org/{org_id}/vista", summary="Ver cómo queda un correo (o mandármelo a mí).")
async def api_vista(
    request: Request,
    org_id: int,
    datos: VistaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _admin_progreso(request, org_id, current_user, db_session)
    a_mi = (current_user.email or "") if datos.a_mi else ""
    if datos.a_mi and not a_mi:
        raise HTTPException(status_code=400, detail="Tu cuenta no tiene correo")
    try:
        return await E.vista(
            org_id, datos.cual, db_session, enviar_a=a_mi, nombre=getattr(current_user, "first_name", "") or "Ana"
        )
    except E.EbookError as exc:
        raise _error(exc)

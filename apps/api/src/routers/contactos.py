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
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.contact_event import ContactEventCreate
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.contactos.contactos import (
    borrar_contacto,
    detalle_contacto,
    listar_contactos,
    registrar_evento,
)
from src.services.contactos.agenda import agenda
from src.services.contactos.embudo_agendar import embudo_agendar
from src.services.contactos.metricas import excluir, volver_a_contar
from src.services.contactos.guion import guardar_guion, leer_guion
from src.services.contactos.seguimiento import (
    anadir_nota,
    borrar_nota,
    fecha_valida,
    poner_recordatorio,
    resumen_seguimiento,
    seguimiento_de,
    todos_los_recordatorios,
)
from src.services.contactos.llamadas import listar_llamadas, marcar_llamada
from src.security.rbac.constants import CLOSER_ROLE_ID
from src.services.orgs.acceso import exigir_acceso, rol_en_la_escuela
from src.services.orgs.orgs import rbac_check
from src.db.organizations import Organization

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
    # Al closer solo le llegan las matrículas: quién bajó una guía no es cosa suya.
    es_closer = (await rol_en_la_escuela(current_user.id, org_id, db_session)) == CLOSER_ROLE_ID
    return await listar_contactos(q, min(max(limit, 1), 2000), db_session, solo_matriculas=es_closer)


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
    "/org/{org_id}/agenda",
    summary="Las llamadas reservadas en Calendly, con día, hora y persona.",
)
async def api_agenda(
    request: Request,
    org_id: int,
    forzar: bool = False,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await agenda(forzar=forzar)


class PedidoEnlace(BaseModel):
    email: str
    first_name: str
    last_name: str = ""
    phone: str = ""


@router.post(
    "/org/{org_id}/enlace-pago",
    summary="Crea un enlace de pago personal (el checkout de la escuela, ya rellenado).",
)
async def api_enlace_pago(
    request: Request,
    org_id: int,
    data: PedidoEnlace,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # El closer también: es su herramienta para cerrar después de la llamada.
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    from config.config import get_learnhouse_config
    from src.services.payments.enlace import DIAS_VALIDEZ, firmar
    from src.services.payments.payments import _academy_url

    email = data.email.strip().lower()
    if "@" not in email or not data.first_name.strip():
        raise HTTPException(status_code=400, detail="Hacen falta el nombre y un correo válido")
    secreto = get_learnhouse_config().security_config.auth_jwt_secret_key
    token = firmar(
        {"e": email, "f": data.first_name.strip()[:120], "l": data.last_name.strip()[:120], "p": data.phone.strip()[:40]},
        secreto,
    )
    return {"url": f"{_academy_url()}/api/v1/payments/pagar/{token}", "dias": DIAS_VALIDEZ}


# ── Seguimiento: notas y "volver a llamar" (closer y administradores) ──────


def _nombre(user) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or getattr(user, "email", "") or "Equipo"


async def _es_admin(user, org_id: int, db_session: AsyncSession) -> bool:
    from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
    from src.security.rbac.rbac import is_user_superadmin

    if await is_user_superadmin(user.id, db_session):
        return True
    return (await rol_en_la_escuela(user.id, org_id, db_session)) in ADMIN_OR_MAINTAINER_ROLE_IDS


@router.get("/org/{org_id}/seguimiento", summary="Notas y fecha de volver a llamar de una persona.")
async def api_seguimiento(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await seguimiento_de(email, db_session)


class NuevaNota(BaseModel):
    email: str
    texto: str


@router.post("/org/{org_id}/notas", summary="Añade una nota a una persona.")
async def api_nueva_nota(
    request: Request,
    org_id: int,
    data: NuevaNota,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    if "@" not in data.email or not data.texto.strip():
        raise HTTPException(status_code=400, detail="Falta el correo o el texto de la nota")
    return await anadir_nota(data.email, data.texto, current_user.id, _nombre(current_user), db_session)


@router.delete("/org/{org_id}/notas/{nota_id}", summary="Borra una nota (la tuya, o cualquiera si eres administrador).")
async def api_borrar_nota(
    request: Request,
    org_id: int,
    nota_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    res = await borrar_nota(nota_id, current_user.id, await _es_admin(current_user, org_id, db_session), db_session)
    if res is None:
        raise HTTPException(status_code=404, detail="No existe esa nota")
    if res is False:
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias notas")
    return {"ok": True}


class Recordatorio(BaseModel):
    email: str
    fecha: str = ""
    motivo: str = ""


@router.put("/org/{org_id}/recordatorio", summary="Pone o quita la fecha de volver a llamar.")
async def api_recordatorio(
    request: Request,
    org_id: int,
    data: Recordatorio,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    if "@" not in data.email:
        raise HTTPException(status_code=400, detail="Falta el correo")
    if data.fecha and not fecha_valida(data.fecha):
        raise HTTPException(status_code=400, detail="La fecha no es válida")
    return {"volver_a_llamar": await poner_recordatorio(data.email, data.fecha, data.motivo, _nombre(current_user), db_session)}


@router.get("/org/{org_id}/seguimiento-resumen", summary="Fechas de volver a llamar, notas por persona y últimas notas del equipo.")
async def api_seguimiento_resumen(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await resumen_seguimiento(db_session)


@router.get("/org/{org_id}/agendar-embudo", summary="Números de /agendar: empiezan, terminan, encajan, reservan.")
async def api_agendar_embudo(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await embudo_agendar(db_session)


class Exclusion(BaseModel):
    email: str
    motivo: str = ""


async def _solo_admin(request: Request, org_id: int, current_user, db_session: AsyncSession) -> None:
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)


@router.post("/org/{org_id}/metricas/excluir", summary="Quita a una persona de los números (sigue pudiendo entrar).")
async def api_excluir(
    request: Request,
    org_id: int,
    data: Exclusion,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await excluir(data.email, data.motivo, db_session):
        raise HTTPException(status_code=400, detail="Falta un correo válido")
    return {"ok": True}


@router.delete("/org/{org_id}/metricas/excluir", summary="Vuelve a contar a una persona en los números.")
async def api_volver_a_contar(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    await volver_a_contar(email, db_session)
    return {"ok": True}


@router.get("/org/{org_id}/recordatorios", summary="Todas las fechas de volver a llamar (correo → fecha).")
async def api_recordatorios(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return {"recordatorios": await todos_los_recordatorios(db_session)}


# ── Guion de llamada ────────────────────────────────────────────────────────


@router.get("/org/{org_id}/guion", summary="El guion de llamada del closer.")
async def api_guion(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return await leer_guion(org_id, db_session)


class GuionWrite(BaseModel):
    texto: str = ""


@router.put("/org/{org_id}/guion", summary="Cambia el guion de llamada (administradores y closer).")
async def api_guardar_guion(
    request: Request,
    org_id: int,
    data: GuionWrite,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # El closer también lo edita (24/09): es quien lo usa y quien sabe qué
    # funciona en la llamada. Misma puerta que el resto de Contactos.
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    try:
        return await guardar_guion(org_id, data.texto, db_session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class MarcaLlamada(BaseModel):
    atendida: bool


@router.put(
    "/org/{org_id}/llamadas/{event_id}",
    summary="Marca como atendida una llamada sin solicitud (p. ej. las que no terminaron).",
)
async def api_marcar_llamada(
    request: Request,
    org_id: int,
    event_id: int,
    data: MarcaLlamada,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    res = await marcar_llamada(event_id, data.atendida, db_session)
    if res is None:
        raise HTTPException(status_code=404, detail="No existe esa llamada")
    return res


@router.delete(
    "/org/{org_id}/contacto",
    summary="Borra el rastro de una persona que era una prueba (no toca pagos ni cuentas).",
)
async def api_borrar_contacto(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    # Solo administradores: el closer ve y marca, pero no borra.
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)
    res = await borrar_contacto(email, db_session)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("motivo") or "No se ha podido borrar")
    return res


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

"""
Panel de negocio: kanban de matrículas, ficha completa de cada persona y
tareas del equipo.

Todo con la puerta de contactos (`exigir_acceso(..., "contactos")`):
administradores, moderadores y el closer. El closer ve en el tablero lo mismo
que en su Contactos (las matrículas) y en Tareas solo las suyas.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.contactos import _es_admin, _nombre
from src.security.auth import get_current_user
from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
from src.services.contactos.metricas import emails_excluidos
from src.services.orgs.acceso import exigir_acceso
from src.services.panel import ads, pipeline, tareas
from src.services.panel.cliente import ficha_cliente
from src.services.panel.clientes import listar_clientes

router = APIRouter()


@router.get("/org/{org_id}/tablero", summary="El kanban de matrículas: columnas y una tarjeta por persona.")
async def api_tablero(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    fuera = await emails_excluidos(db_session)
    for f in fichas:
        f["fuera_de_metricas"] = f["email"] in fuera
    datos = await pipeline.tablero(fichas, db_session)
    # Cuántas tareas pendientes tiene cada persona, para la tarjeta.
    pendientes: dict[str, int] = {}
    for t in await tareas.listar(db_session, current_user.id, True, solo_pendientes=True):
        if t["email"]:
            pendientes[t["email"]] = pendientes.get(t["email"], 0) + 1
    # Notas del equipo: cuántas y la última, para que la tarjeta avise de que
    # hay algo apuntado sin tener que abrirla (pedido del usuario, 28/09).
    from sqlmodel import select as _select

    from src.db.contact_seguimiento import ContactNota

    notas: dict[str, dict] = {}
    for n in (await db_session.execute(_select(ContactNota).order_by(ContactNota.created_at))).scalars().all():
        clave = (n.email or "").strip().lower()
        d = notas.setdefault(clave, {"n": 0, "ultima": ""})
        d["n"] += 1
        d["ultima"] = (n.texto or "")[:160]
    for c in datos["tarjetas"]:
        c["tareas"] = pendientes.get(c["email"], 0)
        c["notas"] = notas.get(c["email"], {}).get("n", 0)
        c["ultima_nota"] = notas.get(c["email"], {}).get("ultima", "")
    return datos


class Movimiento(BaseModel):
    email: str
    etapa: str
    canal: Optional[str] = None
    motivo: Optional[str] = None


@router.put("/org/{org_id}/tablero", summary="Mueve a una persona de columna o cambia su canal.")
async def api_mover(
    request: Request,
    org_id: int,
    data: Movimiento,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    r = await pipeline.mover(data.email, data.etapa, data.canal, data.motivo, _nombre(current_user), db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


class Ocultar(BaseModel):
    email: str
    oculto: bool = True


@router.put("/org/{org_id}/tablero/ocultar", summary="Quita a alguien del tablero (o lo devuelve) sin borrar nada.")
async def api_ocultar(
    request: Request,
    org_id: int,
    data: Ocultar,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    # Solo administradores, como borrar: el closer mueve, no quita.
    if not await _es_admin(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo los administradores pueden quitar a alguien del tablero")
    r = await pipeline.ocultar(data.email, data.oculto, _nombre(current_user), db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.get("/org/{org_id}/cliente", summary="Todo de una persona: tablero, páginas, correos, pagos, notas y tareas.")
async def api_cliente(
    request: Request,
    org_id: int,
    email: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    ficha = await ficha_cliente(email, current_user.id, await _es_admin(current_user, org_id, db_session), db_session)
    if ficha is None:
        raise HTTPException(status_code=404, detail="No hay nadie con ese correo")
    return ficha


# ── Tareas ─────────────────────────────────────────────────────────────────


@router.get("/org/{org_id}/equipo", summary="Quién puede recibir tareas (el equipo del panel).")
async def api_equipo(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    return {"equipo": await tareas.equipo(org_id, db_session), "yo": current_user.id}


@router.get("/org/{org_id}/tareas", summary="Las tareas: todas (administradores) o las tuyas.")
async def api_tareas(
    request: Request,
    org_id: int,
    email: str = "",
    pendientes: bool = False,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    es_admin = await _es_admin(current_user, org_id, db_session)
    return {
        "tareas": await tareas.listar(db_session, current_user.id, es_admin, email=email, solo_pendientes=pendientes),
        "yo": current_user.id,
        "es_admin": es_admin,
    }


class TareaIn(BaseModel):
    titulo: Optional[str] = None
    notas: Optional[str] = None
    fecha: Optional[str] = None
    prioridad: Optional[str] = None
    asignado_id: Optional[int] = None
    email: Optional[str] = None
    estado: Optional[str] = None


@router.post("/org/{org_id}/tareas", summary="Crea una tarea (para ti o para otro del equipo).")
async def api_crear_tarea(
    request: Request,
    org_id: int,
    data: TareaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    r = await tareas.crear(data.model_dump(exclude_none=True), org_id, current_user.id, _nombre(current_user), db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.patch("/org/{org_id}/tareas/{tarea_id}", summary="Cambia una tarea o la marca hecha.")
async def api_cambiar_tarea(
    request: Request,
    org_id: int,
    tarea_id: int,
    data: TareaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    r = await tareas.cambiar(
        tarea_id, data.model_dump(exclude_none=True), org_id, current_user.id,
        await _es_admin(current_user, org_id, db_session), db_session,
    )
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.delete("/org/{org_id}/tareas/{tarea_id}", summary="Borra una tarea (quien la creó o un administrador).")
async def api_borrar_tarea(
    request: Request,
    org_id: int,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    r = await tareas.borrar(tarea_id, current_user.id, await _es_admin(current_user, org_id, db_session), db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=403, detail=r.get("motivo"))
    return r


@router.get("/org/{org_id}/clientes", summary="Quien ha pagado, con lo que pagó y si sigue entrando (administradores).")
async def api_clientes(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    # Es dinero: solo administradores (el closer no ve ingresos).
    if not await _es_admin(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return await listar_clientes(db_session)


# ── Anuncios (solo administradores: es dinero) ─────────────────────────────


async def _solo_admin(request: Request, org_id: int, current_user, db_session: AsyncSession) -> None:
    await exigir_acceso(request, org_id, current_user, "contactos", db_session)
    if not await _es_admin(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo administradores")


@router.get("/org/{org_id}/ads", summary="Campañas de anuncios con los leads, matrículas y ventas que trajo cada una.")
async def api_ads(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    return await ads.panel_ads(org_id, db_session)


class CampanaIn(BaseModel):
    nombre: Optional[str] = None
    plataforma: Optional[str] = None
    utm_campaign: Optional[str] = None
    inicio: Optional[str] = None
    fin: Optional[str] = None
    gasto: Optional[float] = None
    notas: Optional[str] = None


@router.post("/org/{org_id}/ads", summary="Apunta una campaña.")
async def api_nueva_campana(
    request: Request,
    org_id: int,
    data: CampanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await ads.guardar(org_id, data.model_dump(exclude_none=True), db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.put("/org/{org_id}/ads/{campana_id}", summary="Cambia una campaña (gasto, fechas…).")
async def api_cambiar_campana(
    request: Request,
    org_id: int,
    campana_id: int,
    data: CampanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await ads.guardar(org_id, data.model_dump(exclude_none=True), db_session, campana_id)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.delete("/org/{org_id}/ads/{campana_id}", summary="Borra una campaña (los leads no se tocan).")
async def api_borrar_campana(
    request: Request,
    org_id: int,
    campana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await ads.borrar(org_id, campana_id, db_session):
        raise HTTPException(status_code=404, detail="No existe esa campaña")
    return {"ok": True}

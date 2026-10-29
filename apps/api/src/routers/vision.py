"""
Visión (17/10/2026): el mapa del negocio y el centro de campañas.

Solo administradores, comprobado en el servidor en CADA ruta (el closer y los
alumnos reciben 403). Es el equivalente a las reglas de "solo mi usuario" que
se pedían para Supabase: aquí los datos viven en el Postgres de la escuela y
la puerta es la de la escuela. Ver `src/services/vision/`.
"""

import mimetypes
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.panel import _solo_admin
from src.security.auth import get_current_user
from src.services.vision import campanas, mapa, trabajo

router = APIRouter()


# ── mapas ───────────────────────────────────────────────────────────────────


async def _con_cifras(org_id: int, datos: dict, db: AsyncSession) -> dict:
    """Pone las cifras de las campañas en las tarjetas que las enseñan."""
    ids = {n["id"] for n in datos["nodos"] if n["tipo"] == "campana"}
    ids |= {int(n["metrica"].get("campana_id") or 0) for n in datos["nodos"] if n["tipo"] == "metrica" and n.get("metrica")}
    ids.discard(0)
    try:
        datos["cifras"] = {str(k): v for k, v in (await campanas.cifras_para_el_mapa(org_id, db, ids)).items()}
    except Exception:  # noqa: BLE001
        await db.rollback()
        datos["cifras"] = {}
    # Las tarjetas de correo y las métricas de Black Friday: los correos de
    # verdad de la campaña y sus cifras, en vivo (29/10).
    if any(
        n["tipo"] == "correo" or (n["tipo"] == "metrica" and (n.get("metrica") or {}).get("fuente") == "black-friday")
        for n in datos["nodos"]
    ):
        try:
            from src.services.correos.correos import para_el_mapa

            datos["bf"] = await para_el_mapa(org_id, db)
        except Exception:  # noqa: BLE001
            await db.rollback()
            datos["bf"] = None
    return datos


@router.get("/org/{org_id}/mapa", summary="El mapa de Inicio (se crea la primera vez).")
async def api_inicio(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    return await _con_cifras(org_id, await mapa.leer_mapa(org_id, None, db_session), db_session)


@router.get("/org/{org_id}/mapa/{mapa_id}", summary="Un mapa con sus tarjetas, flechas y migas de pan.")
async def api_mapa(request: Request, org_id: int, mapa_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    datos = await mapa.leer_mapa(org_id, mapa_id, db_session)
    if datos is None:
        raise HTTPException(status_code=404, detail="Ese mapa no existe")
    return await _con_cifras(org_id, datos, db_session)


class VistaIn(BaseModel):
    x: float = 0
    y: float = 0
    zoom: float = 1


@router.put("/org/{org_id}/mapa/{mapa_id}/vista", summary="Dónde se quedó la vista del mapa.")
async def api_vista(request: Request, org_id: int, mapa_id: int, data: VistaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await mapa.guardar_vista(org_id, mapa_id, data.model_dump(), db_session):
        raise HTTPException(status_code=404, detail="Ese mapa no existe")
    return {"ok": True}


@router.get("/org/{org_id}/urgente", summary="Todo lo urgente sin hacer, de todos los mapas.")
async def api_urgente(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    return {"nodos": await mapa.urgentes(org_id, db_session)}


# ── el tablero y las semanas ────────────────────────────────────────────────


async def _nombres_del_equipo(org_id: int, db_session: AsyncSession) -> list[str]:
    """El nombre de pila de cada persona del equipo del panel, para proponerlo."""
    from src.services.panel.tareas import equipo

    try:
        miembros = await equipo(org_id, db_session)
    except Exception:  # noqa: BLE001
        await db_session.rollback()
        return []
    nombres = []
    for m in miembros:
        nombre = (m.get("nombre") or "").strip()
        if nombre and "@" not in nombre:
            nombres.append(nombre.split()[0])
    return nombres


@router.get("/org/{org_id}/trabajo", summary="Las tarjetas de trabajo de todos los mapas, con su área y sus encargados.")
async def api_trabajo(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    return await trabajo.listar(org_id, db_session, equipo=await _nombres_del_equipo(org_id, db_session))


class TareaIn(BaseModel):
    titulo: str
    area_id: Optional[int] = None
    tipo: str = "tarea"
    estado: str = "pendiente"
    responsable: str = ""
    vence: str = ""
    inicio: str = ""
    fin: str = ""
    urgente: bool = False


@router.post("/org/{org_id}/trabajo", summary="Una tarjeta nueva desde el tablero, en el mapa de su área.")
async def api_crear_tarea(request: Request, org_id: int, data: TareaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    n = await trabajo.crear_tarea(org_id, data.model_dump(), db_session)
    if n is None:
        raise HTTPException(status_code=400, detail="Ponle un título")
    return n


# ── tarjetas ────────────────────────────────────────────────────────────────


class NodoIn(BaseModel):
    mapa_id: int
    tipo: str = "nota"
    titulo: Optional[str] = None
    x: float = 0
    y: float = 0


@router.post("/org/{org_id}/nodos", summary="Una tarjeta nueva en un mapa.")
async def api_crear_nodo(request: Request, org_id: int, data: NodoIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    campos = {"tipo": data.tipo, "x": data.x, "y": data.y}
    if data.titulo:
        campos["titulo"] = data.titulo
    n = await mapa.crear_nodo(org_id, data.mapa_id, campos, db_session)
    if n is None:
        raise HTTPException(status_code=404, detail="Ese mapa no existe")
    return n


@router.get("/org/{org_id}/nodos/{nodo_id}", summary="Una tarjeta con todo lo de dentro.")
async def api_leer_nodo(request: Request, org_id: int, nodo_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    n = await mapa.nodo(org_id, nodo_id, db_session)
    if n is None:
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe")
    return mapa.nodo_dict(n)


@router.patch("/org/{org_id}/nodos/{nodo_id}", summary="Cambia lo que venga de una tarjeta.")
async def api_cambiar_nodo(request: Request, org_id: int, nodo_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    n = await mapa.cambiar_nodo(org_id, nodo_id, data or {}, db_session)
    if n is None:
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe")
    return n


class Posicion(BaseModel):
    id: int
    x: float
    y: float


@router.put("/org/{org_id}/nodos/posiciones", summary="Dónde está cada tarjeta (al soltarlas).")
async def api_posiciones(request: Request, org_id: int, data: list[Posicion], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    return {"ok": True, "guardadas": await mapa.mover_nodos(org_id, [p.model_dump() for p in data], db_session)}


@router.delete("/org/{org_id}/nodos/{nodo_id}", summary="Borra una tarjeta, su submapa, sus flechas, archivos y datos.")
async def api_borrar_nodo(request: Request, org_id: int, nodo_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await mapa.borrar_nodo(org_id, nodo_id, db_session):
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe")
    return {"ok": True}


@router.post("/org/{org_id}/nodos/{nodo_id}/submapa", summary="Abre el mapa de dentro de una tarjeta (se crea si no existe).")
async def api_submapa(request: Request, org_id: int, nodo_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    mapa_id = await mapa.abrir_submapa(org_id, nodo_id, db_session)
    if mapa_id is None:
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe")
    return {"mapa_id": mapa_id}


@router.post("/org/{org_id}/nodos/{nodo_id}/archivos", summary="Sube un archivo a una tarjeta (25 MB como mucho).")
async def api_subir(request: Request, org_id: int, nodo_id: int, archivo: UploadFile = File(...), current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    datos = await archivo.read(mapa.MAX_ARCHIVO_BYTES + 1)
    r = await mapa.subir_archivo(org_id, nodo_id, archivo.filename or "", datos, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["nodo"]


@router.get("/org/{org_id}/nodos/{nodo_id}/archivos/{archivo_id}", summary="Baja un archivo de una tarjeta (solo administradores).")
async def api_bajar(request: Request, org_id: int, nodo_id: int, archivo_id: str, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await mapa.archivo(org_id, nodo_id, archivo_id, db_session)
    if r is None:
        raise HTTPException(status_code=404, detail="Ese archivo no está")
    ruta, nombre = r
    return FileResponse(
        path=str(ruta),
        media_type=mimetypes.guess_type(nombre)[0] or "application/octet-stream",
        filename=nombre,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/org/{org_id}/nodos/{nodo_id}/archivos/{archivo_id}", summary="Quita un archivo de una tarjeta.")
async def api_borrar_archivo(request: Request, org_id: int, nodo_id: int, archivo_id: str, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    n = await mapa.borrar_archivo(org_id, nodo_id, archivo_id, db_session)
    if n is None:
        raise HTTPException(status_code=404, detail="Esa tarjeta no existe")
    return n


# ── flechas ─────────────────────────────────────────────────────────────────


class FlechaIn(BaseModel):
    mapa_id: int
    origen: int
    destino: int


@router.post("/org/{org_id}/flechas", summary="Une dos tarjetas del mismo mapa con una flecha.")
async def api_crear_flecha(request: Request, org_id: int, data: FlechaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    f = await mapa.crear_flecha(org_id, data.mapa_id, data.origen, data.destino, db_session)
    if f is None:
        raise HTTPException(status_code=400, detail="Esas tarjetas no se pueden unir")
    return f


class EtiquetaIn(BaseModel):
    etiqueta: str = ""


@router.patch("/org/{org_id}/flechas/{flecha_id}", summary="Pone o quita el texto de una flecha.")
async def api_cambiar_flecha(request: Request, org_id: int, flecha_id: int, data: EtiquetaIn, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    f = await mapa.cambiar_flecha(org_id, flecha_id, data.etiqueta, db_session)
    if f is None:
        raise HTTPException(status_code=404, detail="Esa flecha no existe")
    return f


@router.delete("/org/{org_id}/flechas/{flecha_id}", summary="Borra una flecha.")
async def api_borrar_flecha(request: Request, org_id: int, flecha_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await mapa.borrar_flecha(org_id, flecha_id, db_session):
        raise HTTPException(status_code=404, detail="Esa flecha no existe")
    return {"ok": True}


# ── campañas: cuadro de mando, datos, pagos y ajustes ───────────────────────


@router.get("/org/{org_id}/campanas", summary="Todas las campañas con sus cifras, semáforo y semanas, y el total del negocio.")
async def api_campanas(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    return await campanas.cuadro_de_mando(org_id, db_session)


@router.get("/org/{org_id}/campanas/{nodo_id}", summary="Una campaña con todo: cifras, datos apuntados, pagos y ventas.")
async def api_campana(request: Request, org_id: int, nodo_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.cuadro_de_mando(org_id, db_session, solo=nodo_id)
    if not r["campanas"]:
        raise HTTPException(status_code=404, detail="Esa campaña no existe")
    return {**r["campanas"][0], "ajustes": r["ajustes"], "metricas": r["metricas"], "avisos_escuela": r["avisos"]}


@router.post("/org/{org_id}/campanas/{nodo_id}/datos", summary="Apunta los números de un día o una semana.")
async def api_crear_dato(request: Request, org_id: int, nodo_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.guardar_dato(org_id, nodo_id, data or {}, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["dato"]


@router.put("/org/{org_id}/campanas/{nodo_id}/datos/{dato_id}", summary="Cambia unos números apuntados.")
async def api_cambiar_dato(request: Request, org_id: int, nodo_id: int, dato_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.guardar_dato(org_id, nodo_id, data or {}, db_session, dato_id=dato_id)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["dato"]


@router.delete("/org/{org_id}/campanas/datos/{dato_id}", summary="Borra unos números apuntados.")
async def api_borrar_dato(request: Request, org_id: int, dato_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await campanas.borrar_dato(org_id, dato_id, db_session):
        raise HTTPException(status_code=404, detail="No existe ese dato")
    return {"ok": True}


@router.post("/org/{org_id}/campanas/{nodo_id}/pagos", summary="Apunta un pago de la campaña.")
async def api_crear_pago(request: Request, org_id: int, nodo_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.guardar_pago(org_id, nodo_id, data or {}, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["pago"]


@router.put("/org/{org_id}/campanas/{nodo_id}/pagos/{pago_id}", summary="Cambia un pago apuntado.")
async def api_cambiar_pago(request: Request, org_id: int, nodo_id: int, pago_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.guardar_pago(org_id, nodo_id, data or {}, db_session, pago_id=pago_id)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["pago"]


@router.delete("/org/{org_id}/campanas/pagos/{pago_id}", summary="Borra un pago apuntado.")
async def api_borrar_pago(request: Request, org_id: int, pago_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    if not await campanas.borrar_pago(org_id, pago_id, db_session):
        raise HTTPException(status_code=404, detail="No existe ese pago")
    return {"ok": True}


@router.get("/org/{org_id}/ajustes", summary="Precio, comisiones, profe y umbrales del semáforo.")
async def api_ajustes(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    from src.services.vision.calculo import AJUSTES_POR_DEFECTO, METRICAS

    return {"ajustes": await campanas.leer_ajustes(org_id, db_session), "de_fabrica": AJUSTES_POR_DEFECTO, "metricas": METRICAS}


@router.put("/org/{org_id}/ajustes", summary="Guarda los ajustes de Visión.")
async def api_guardar_ajustes(request: Request, org_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    r = await campanas.guardar_ajustes(org_id, data or {}, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r["ajustes"]


# ── plantillas ──────────────────────────────────────────────────────────────


@router.post("/org/{org_id}/plantillas/clase-gratuita", summary="Crea una campaña de clase gratuita con todo su embudo.")
async def api_plantilla_clase(request: Request, org_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    from src.services.vision.plantillas import crear_clase_gratuita

    r = await crear_clase_gratuita(org_id, data or {}, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.post("/org/{org_id}/plantillas/black-friday", summary="Crea el mapa de la campaña de Black Friday, de arriba abajo.")
async def api_plantilla_black_friday(request: Request, org_id: int, data: dict[str, Any], current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    from src.services.vision.plantillas import crear_black_friday

    r = await crear_black_friday(org_id, data or {}, db_session)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("motivo"))
    return r


@router.get("/org/{org_id}/black-friday", summary="Los correos y las cifras de la campaña de Black Friday, para elegirlos en una tarjeta.")
async def api_black_friday(request: Request, org_id: int, current_user: PublicUser = Depends(get_current_user), db_session: AsyncSession = Depends(get_db_session)):
    await _solo_admin(request, org_id, current_user, db_session)
    from src.services.correos.correos import para_el_mapa

    return await para_el_mapa(org_id, db_session)

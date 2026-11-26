"""
El asistente de ventas: una puerta de SOLO LECTURA a lo que ve el equipo en
Matrículas (26/11/2026).

Para qué: una sesión de Claude dedicada a ventas cruza las llamadas grabadas
en Google Drive (`herramientas/zoom-a-drive.gs`) con lo que dice la escuela de
cada lead (columna, closer, notas, si ya pagó) y propone a quién recuperar y
qué escribirle. Esa sesión no tiene cuenta en la escuela: entra con un secreto
compartido, como el workflow de las copias (`routers/backup.py`).

Qué se puede hacer por aquí: LEER. Ni mover, ni escribir notas, ni borrar.
Las rutas son todas GET. Al leer el tablero la escuela pone al día la lista
de Llamadas por dentro (`templadas.sincronizar`), igual que cuando alguien
abre Matrículas en el panel: eso no cambia nada que decida el equipo.

Lo que abre, dicho claro: quien tenga el secreto lee los datos de los leads y
alumnos (nombre, correo, teléfono, notas, pagos). Se activa poniendo
`LEARNHOUSE_VENTAS_TOKEN` en Railway y se revoca cambiándolo o quitándolo.
Sin la variable, las rutas contestan 503 y no entra nadie.

⚠️ La cabecera va con GUIONES (`X-Ventas-Token`): nginx tira las cabeceras con
guion bajo (ver `routers/backup.py`).
"""

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter()

CABECERA = "X-Ventas-Token"
VARIABLE = "LEARNHOUSE_VENTAS_TOKEN"


def _mismo_secreto(a: str, b: str) -> bool:
    ha = hashlib.sha256(a.encode("utf-8")).digest()
    hb = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(ha, hb)


def _autorizar(request: Request) -> None:
    esperado = (os.environ.get(VARIABLE) or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail=f"Falta {VARIABLE} en Railway")
    recibido = (request.headers.get(CABECERA) or "").strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Secreto del asistente de ventas no válido")


async def _org_id(db_session: AsyncSession) -> int:
    """La escuela es una sola organización (single-tenancy)."""
    from src.db.organizations import Organization

    org = (await db_session.execute(select(Organization).order_by(Organization.id).limit(1))).scalars().first()  # type: ignore[arg-type]
    if not org:
        raise HTTPException(status_code=404, detail="No hay escuela")
    return int(org.id)


_NOMBRE_ETAPA: dict[str, str] = {}


def _nombre_etapa(etapa: str) -> str:
    if not _NOMBRE_ETAPA:
        from src.services.panel.pipeline import ETAPAS

        _NOMBRE_ETAPA.update({e["id"]: e["nombre"] for e in ETAPAS})
    return _NOMBRE_ETAPA.get(etapa, etapa)


def tarjeta_para_el_asistente(t: dict) -> dict:
    """Lo que necesita el asistente de cada tarjeta, sin lo interno de la
    pantalla. Función pura (tiene test)."""
    reserva = t.get("reserva") or None
    cita = t.get("cita") or None
    return {
        "email": t.get("email", ""),
        "nombre": t.get("nombre", ""),
        "telefono": t.get("telefono", ""),
        "columna": _nombre_etapa(t.get("etapa", "")),
        "etapa": t.get("etapa", ""),
        "mesa": t.get("mesa", ""),
        "closer": t.get("closer", ""),
        "desde": t.get("desde", ""),
        "llegada": t.get("llegada", ""),
        "temperatura": t.get("temperatura", ""),
        "origen": t.get("origen", ""),
        "vio_precio": bool(t.get("vio_precio")),
        "que_hizo": t.get("que_hizo", ""),
        "black_friday": t.get("black_friday", ""),
        "notas": int(t.get("notas") or 0),
        "ultima_nota": t.get("ultima_nota", ""),
        "volver_a_llamar": t.get("volver_a_llamar"),
        "cita": {
            "inicio": cita.get("inicio", ""),
            "confirmada": bool(cita.get("confirmada")),
            "whatsapp_enviados": int(cita.get("whatsapp") or 0),
        }
        if cita
        else None,
        "seguimientos": int(t.get("intentos") or 0),
        "senal": {
            "pagado_eur": round((reserva.get("pagado_cents") or 0) / 100, 2),
            "total_eur": round((reserva.get("total_cents") or 0) / 100, 2),
            "falta_eur": round((reserva.get("pendiente_cents") or 0) / 100, 2),
        }
        if reserva
        else None,
    }


def coincide(t: dict, q: str) -> bool:
    """Busca por nombre, correo o teléfono (las cifras), sin mayúsculas."""
    q = (q or "").strip().lower()
    if not q:
        return True
    cifras = "".join(ch for ch in q if ch.isdigit())
    if cifras and len(cifras) >= 6:
        tel = "".join(ch for ch in (t.get("telefono") or "") if ch.isdigit())
        if cifras in tel or tel.endswith(cifras[-9:]):
            return True
    texto = f"{t.get('nombre', '')} {t.get('email', '')}".lower()
    return all(parte in texto for parte in q.split())


@router.get("/estado", summary="Comprueba el secreto y cuenta cuántas personas hay en cada columna.")
async def api_estado(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    _autorizar(request)
    from src.services.panel.tablero_datos import datos_tablero

    org_id = await _org_id(db_session)
    datos = await datos_tablero(org_id, 0, db_session)
    por: dict[str, int] = {}
    for t in datos["tarjetas"]:
        if t.get("oculto"):
            continue
        nombre = _nombre_etapa(t.get("etapa", ""))
        por[nombre] = por.get(nombre, 0) + 1
    return {"ok": True, "ahora": datetime.now(timezone.utc).isoformat(), "por_columna": por}


@router.get("/leads", summary="Las tarjetas de Matrículas, para el asistente de ventas.")
async def api_leads(
    request: Request,
    columna: Optional[str] = None,
    closer: Optional[str] = None,
    q: Optional[str] = None,
    alumnos: int = 0,
    db_session: AsyncSession = Depends(get_db_session),
):
    """`columna`: ids o nombres separados por comas (seguimiento, «Por pagar»,
    no-show…). `closer`: su nombre (o parte). `q`: nombre, correo o teléfono.
    Sin `alumnos=1`, quien ya es alumno no sale. Las pruebas y las quitadas
    del tablero, nunca."""
    _autorizar(request)
    from src.services.panel.tablero_datos import datos_tablero

    org_id = await _org_id(db_session)
    datos = await datos_tablero(org_id, 0, db_session)
    quiero = {c.strip().lower() for c in (columna or "").split(",") if c.strip()}
    salida = []
    for t in datos["tarjetas"]:
        if t.get("oculto") or t.get("suelta"):
            continue
        if t.get("etapa") == "alumno" and not alumnos:
            continue
        if quiero and t.get("etapa", "") not in quiero and _nombre_etapa(t.get("etapa", "")).lower() not in quiero:
            continue
        if closer and closer.strip().lower() not in (t.get("closer") or "").lower():
            continue
        if not coincide(t, q or ""):
            continue
        salida.append(tarjeta_para_el_asistente(t))
    return {"total": len(salida), "leads": salida}


@router.get("/buscar", summary="Busca a cualquier persona de Contactos por nombre, correo o teléfono.")
async def api_buscar(request: Request, q: str, db_session: AsyncSession = Depends(get_db_session)):
    """Para cruzar una carpeta de Drive («2026-11-18 18.00 · Ana») con su
    ficha. Busca en TODOS los contactos, no solo en el tablero."""
    _autorizar(request)
    if len((q or "").strip()) < 2:
        raise HTTPException(status_code=400, detail="Escribe al menos dos letras")
    from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos

    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    encontrados = [
        {
            "email": f.get("email", ""),
            "nombre": f.get("nombre", ""),
            "telefono": f.get("telefono", ""),
            "etapa_contacto": f.get("etapa", ""),
            "ultimo": (f.get("ultimo_contacto") or {}).get("que", ""),
            "cuando": (f.get("ultimo_contacto") or {}).get("when", ""),
        }
        for f in fichas
        if coincide(f, q)
    ]
    return {"total": len(encontrados), "personas": encontrados[:50]}


@router.get("/ficha", summary="La ficha completa de una persona: notas, llamadas, pagos y línea de tiempo.")
async def api_ficha(request: Request, email: str, db_session: AsyncSession = Depends(get_db_session)):
    _autorizar(request)
    from src.services.panel import ads
    from src.services.panel.cliente import ficha_cliente

    org_id = await _org_id(db_session)
    ficha = await ficha_cliente(
        email, 0, True, db_session, await ads.leer_nombres(org_id, db_session), org_id=org_id
    )
    if not ficha:
        raise HTTPException(status_code=404, detail="No hay nadie con ese correo")
    return ficha

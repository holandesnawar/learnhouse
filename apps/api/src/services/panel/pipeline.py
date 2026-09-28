"""
Kanban de matrículas: en qué punto está cada persona que pidió plaza, llegó al
pago o pidió una llamada, y por dónde se la está contactando.

Lo que entra en el tablero: quien está en la etapa "pidio", "en-pago" o
"alumno" de Contactos. Quien solo bajó una guía no: eso es captación, no
matrícula (misma regla que el Contactos del closer).

Columnas: nuevo → contactado → revision → propuesta → alumno, y perdido
aparte. "Alumno" no se elige: sale sola en cuanto paga, y en cuanto paga se
va ahí aunque alguien la hubiera dejado en otra columna.

La colocación es una función pura (`colocar`), con test.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment_request import EnrollmentRequest
from src.db.panel_negocio import LeadPipeline

ETAPAS = [
    {"id": "nuevo", "nombre": "Nuevo"},
    {"id": "contactado", "nombre": "Contactado"},
    {"id": "revision", "nombre": "En revisión"},
    {"id": "propuesta", "nombre": "Propuesta"},
    {"id": "alumno", "nombre": "Alumno"},
    {"id": "perdido", "nombre": "Perdido"},
]
ETAPAS_MOVIBLES = {"nuevo", "contactado", "revision", "propuesta", "perdido"}
CANALES = {"", "whatsapp", "llamada", "email", "instagram", "otro"}

#: Etapas de Contactos que entran en el tablero.
_EN_TABLERO = {"pidio", "en-pago", "alumno"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def colocar(ficha: dict, guardada: Optional[dict]) -> dict:
    """Dónde va una ficha de Contactos en el tablero.

    - Si ya es alumno: columna "alumno", pase lo que pase.
    - Si alguien la movió: donde la dejaron.
    - Si no: "contactado" si ya estaba marcada como atendida, y si no "nuevo".
    """
    guardada = guardada or {}
    if ficha.get("etapa") == "alumno":
        etapa = "alumno"
    elif guardada.get("etapa") in ETAPAS_MOVIBLES:
        etapa = guardada["etapa"]
    else:
        etapa = "contactado" if ficha.get("atendida") else "nuevo"
    return {
        "email": ficha.get("email", ""),
        "nombre": ficha.get("nombre", ""),
        "telefono": ficha.get("telefono", ""),
        "etapa": etapa,
        "canal": guardada.get("canal", ""),
        "motivo": guardada.get("motivo", ""),
        # Desde cuándo está en esa columna: el último movimiento, o si nadie
        # la ha movido, el día que se matriculó.
        "desde": guardada.get("updated_at") or ficha.get("matricula_at") or (ficha.get("ultimo_contacto") or {}).get("when", ""),
        "movido_por": guardada.get("updated_by", ""),
        "vio_precio": bool(ficha.get("vio_precio")),
        "vino_de": ficha.get("vino_de", ""),
        "que_hizo": (ficha.get("ultimo_contacto") or {}).get("que", ""),
        "utm_campaign": ficha.get("utm_campaign", ""),
        "fuera_de_metricas": bool(ficha.get("fuera_de_metricas")),
    }


def en_tablero(ficha: dict) -> bool:
    return ficha.get("etapa") in _EN_TABLERO


async def guardadas(db_session: AsyncSession) -> dict[str, dict]:
    filas = (await db_session.execute(select(LeadPipeline))).scalars().all()
    return {
        f.email: {"etapa": f.etapa, "canal": f.canal, "motivo": f.motivo, "updated_at": f.updated_at, "updated_by": f.updated_by}
        for f in filas
    }


async def tablero(fichas: list[dict], db_session: AsyncSession) -> dict:
    ya = await guardadas(db_session)
    tarjetas = [colocar(f, ya.get(f["email"])) for f in fichas if en_tablero(f)]
    return {"etapas": ETAPAS, "tarjetas": tarjetas}


async def mover(email: str, etapa: str, canal: Optional[str], motivo: Optional[str], autor: str, db_session: AsyncSession) -> dict:
    """Mueve a alguien de columna (y/o cambia el canal).

    De paso deja la marca de "atendida" de sus solicitudes a juego, para que
    Contactos y Llamadas digan lo mismo que el tablero: salir de "nuevo" es
    haberla atendido; volver a "nuevo", no.
    """
    clave = (email or "").strip().lower()
    if not clave or "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    if etapa not in ETAPAS_MOVIBLES:
        return {"ok": False, "motivo": "Esa columna no se puede elegir (Alumno sale sola al pagar)"}
    if canal is not None and canal not in CANALES:
        return {"ok": False, "motivo": "Canal desconocido"}

    fila = (
        await db_session.execute(select(LeadPipeline).where(LeadPipeline.email == clave))
    ).scalars().first()
    if fila is None:
        fila = LeadPipeline(email=clave)
    fila.etapa = etapa
    if canal is not None:
        fila.canal = canal
    if motivo is not None:
        fila.motivo = motivo.strip()[:200]
    fila.updated_at = _ahora()
    fila.updated_by = (autor or "")[:120]
    db_session.add(fila)

    atendida = etapa != "nuevo"
    for s in (
        await db_session.execute(select(EnrollmentRequest).where(func.lower(EnrollmentRequest.email) == clave))
    ).scalars().all():
        if atendida and not s.contacted_at:
            s.contacted_at = _ahora()
            db_session.add(s)
        elif not atendida and s.contacted_at:
            s.contacted_at = ""
            db_session.add(s)

    await db_session.commit()
    return {"ok": True, "etapa": etapa, "canal": fila.canal}


async def borrar_de_tablero(email: str, db_session: AsyncSession) -> None:
    for f in (
        await db_session.execute(select(LeadPipeline).where(LeadPipeline.email == email))
    ).scalars().all():
        await db_session.delete(f)

"""
Solicitudes de plaza: quien deja sus datos para que le llamemos.

El formulario de la web no cobra nada, así que esto no toca Stripe. Lo único
que hace es guardar el contacto para que salga en Panel → Estadísticas y el
equipo pueda escribirle.

El alta en systeme.io la sigue haciendo la web (que es donde vive la clave del
CRM y la automatización de seguimiento); aquí solo se guarda la copia que el
panel necesita para enseñarla.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment_request import EnrollmentRequest, EnrollmentRequestCreate

logger = logging.getLogger(__name__)


# Dos envíos del mismo correo dentro de esta ventana son la misma persona
# dándole dos veces al botón, no dos solicitudes. Mismo criterio que las
# matrículas sin pagar (`_VENTANA_MISMO_INTENTO` en payments.py).
_VENTANA_MISMO_ENVIO = timedelta(hours=24)


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


async def crear_solicitud(
    data: EnrollmentRequestCreate, db_session: AsyncSession
) -> EnrollmentRequest:
    """Guarda la solicitud. Si ese correo ya envió una hace poco, actualiza la
    suya en vez de crear otra: en la lista del panel una persona es una línea."""
    email = str(data.email).strip().lower()

    reciente: Optional[EnrollmentRequest] = None
    try:
        previa = (
            await db_session.execute(
                select(EnrollmentRequest)
                .where(EnrollmentRequest.email == email)
                .order_by(EnrollmentRequest.id.desc())  # type: ignore[attr-defined]
            )
        ).scalars().first()
        if previa is not None and previa.created_at:
            creada = datetime.fromisoformat(previa.created_at)
            if creada.tzinfo is None:
                creada = creada.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - creada <= _VENTANA_MISMO_ENVIO:
                reciente = previa
    except Exception:
        # Una fecha rara guardada no puede impedir que entre un contacto.
        logger.exception("No se pudo comprobar la solicitud previa de %s", email)

    fila = reciente or EnrollmentRequest(email=email, created_at=_ahora())
    fila.first_name = (data.first_name or "").strip() or fila.first_name
    fila.last_name = (data.last_name or "").strip() or fila.last_name
    fila.phone = (data.phone or "").strip() or fila.phone
    fila.source = (data.source or "web").strip() or "web"
    # El recorrido solo se escribe si viene con algo. Un formulario reenviado
    # sin contexto no debe borrar lo que ya se sabía de esa persona.
    recorrido = ",".join(x for x in (data.recorrido or []) if x)[:400]
    if recorrido:
        fila.recorrido = recorrido
    if (data.referrer or "").strip():
        fila.referrer = data.referrer.strip()[:120]

    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    return fila


#: Cómo se llama en cristiano cada página por la que pudo pasar.
_NOMBRES = {
    "home": "el inicio de la web",
    "landing": "la página de la formación (sin precio)",
    "landing-precio": "la página de la formación CON el precio",
    "guia-bases": "la guía de las bases",
    "gracias-bases": "la descarga de la guía de las bases",
    "guia-hebben": "la guía hebben/zijn",
    "gracias-hebben": "la descarga de la guía hebben/zijn",
}

#: La única página que enseña la cifra. Si no pasó por aquí, no ha visto nunca
#: el precio, y ese es el dato que cambia cómo se le escribe.
_CON_PRECIO = "landing-precio"


def resumen_del_lead(recorrido: str, referrer: str, source: str) -> dict:
    """De la lista de páginas a las dos frases que se leen en el panel.

    Función pura a propósito: es la que decide qué se le dice al usuario y no
    depende de la base de datos, así que se puede razonar y probar sola.

    `vio_precio` es lo importante. Con él, el mensaje empieza por el precio y
    la garantía; sin él, hay que contarle antes qué es la formación, porque
    puede haber dejado sus datos sin saber siquiera cuánto cuesta.
    """
    pasos = [p for p in (recorrido or "").split(",") if p]
    vio_precio = _CON_PRECIO in pasos

    if pasos:
        entrada = _NOMBRES.get(pasos[0], pasos[0])
    elif referrer:
        entrada = referrer
    elif source == "ads":
        # Sin recorrido y del formulario de anuncios: lo más probable es que
        # aterrizara directamente ahí, que es lo que hace el tráfico de pago.
        entrada = "el anuncio"
    else:
        entrada = ""

    camino = " → ".join(_NOMBRES.get(p, p) for p in pasos)

    return {
        "vino_de": entrada,
        "vio_precio": vio_precio,
        "camino": camino,
        "pasos": pasos,
    }


async def listar_solicitudes(db_session: AsyncSession, limite: int = 100) -> list[dict]:
    """Las solicitudes para el panel: las pendientes primero, luego las ya
    atendidas, y dentro de cada grupo la más reciente arriba."""
    filas = (
        await db_session.execute(
            select(EnrollmentRequest)
            .order_by(EnrollmentRequest.id.desc())  # type: ignore[attr-defined]
            .limit(limite)
        )
    ).scalars().all()

    salida = [
        {
            "id": f.id,
            "name": f"{f.first_name or ''} {f.last_name or ''}".strip(),
            "email": f.email,
            "phone": f.phone or "",
            "source": f.source or "web",
            **resumen_del_lead(f.recorrido or "", f.referrer or "", f.source or "web"),
            "created_at": f.created_at or "",
            "contacted_at": f.contacted_at or "",
        }
        for f in filas
    ]
    salida.sort(key=lambda s: (bool(s["contacted_at"]), ), reverse=False)
    return salida


async def marcar_contactada(
    request_id: int, contactada: bool, db_session: AsyncSession
) -> Optional[dict]:
    """Marca (o desmarca) una solicitud como ya atendida."""
    fila = (
        await db_session.execute(
            select(EnrollmentRequest).where(EnrollmentRequest.id == request_id)
        )
    ).scalars().first()
    if fila is None:
        return None

    fila.contacted_at = _ahora() if contactada else ""
    db_session.add(fila)
    await db_session.commit()
    return {"id": fila.id, "contacted_at": fila.contacted_at}

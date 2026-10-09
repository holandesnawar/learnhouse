"""
Kanban de matrículas: en qué punto está cada persona que pidió plaza, llegó al
pago o pidió una llamada, y por dónde se la está contactando.

Lo que entra en el tablero: quien está en la etapa "pidio", "en-pago" o
"alumno" de Contactos, a quien el equipo le creó un enlace de pago, y quien
está pendiente en la lista de Llamadas. Quien solo bajó una guía, se apuntó a
la lista de espera o escribió por Instagram, no: eso es captación, no
matrícula (08/10, "solo gente que haya mostrado interés").

Columnas: nuevo → contactado → revision → propuesta → seguimiento → perdido →
alumno. "Alumno" no se elige: sale sola en cuanto paga, y en cuanto paga se
va ahí aunque alguien la hubiera dejado en otra columna.

SEGUIMIENTO = la lista de Llamadas (08/10, "métela en matrículas para ver las
que tocan"). Quien está pendiente allí sale en esta columna, y las dos van a
juego en los dos sentidos:
- mover a alguien a Seguimiento lo apunta en Llamadas, pendiente;
- sacarlo de Seguimiento (a cualquier columna) lo marca como hecho allí, o
  como quitado si va a Perdido;
- marcarlo como hecho en Llamadas lo saca de Seguimiento (a Contactado).
Lo último que pasó manda: si alguien que ya estaba en una columna vuelve a
la lista de Llamadas (dejó otra vez sus datos, o lo mandaron desde su
ficha), vuelve a Seguimiento. Los de Llamadas sin ficha (apuntados a mano
solo con el móvil) salen como tarjetas sueltas en Seguimiento.

Orden: lo más nuevo arriba (`llegada` = el día que pidió plaza o llegó al
pago). Una tarjeta puede quitarse del tablero sin borrar nada (`oculto`), y
quien está fuera de los números (pruebas) tampoco sale: si no, un alumno de
prueba se quedaba en "Alumno" para siempre, porque a quien ha pagado no se le
borra.

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
    {"id": "seguimiento", "nombre": "Seguimiento"},
    {"id": "perdido", "nombre": "Perdido"},
    {"id": "alumno", "nombre": "Alumno"},
]
ETAPAS_MOVIBLES = {"nuevo", "contactado", "revision", "propuesta", "seguimiento", "perdido"}
CANALES = {"", "whatsapp", "llamada", "email", "instagram", "otro"}

#: Etapas de Contactos que entran en el tablero.
_EN_TABLERO = {"pidio", "en-pago", "alumno"}
#: Pasos que también meten a alguien en el tablero aunque su etapa sea "lead".
_TAMBIEN_ENTRAN = {"enlace-pago"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instante(texto: str) -> float:
    """Fecha en texto → número comparable (con o sin zona; rota = 0)."""
    if not texto:
        return 0.0
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.timestamp()
    except Exception:  # noqa: BLE001
        return 0.0


def _cuando_paso(ficha: dict, kinds: set[str]) -> str:
    """La primera vez que la persona hizo alguno de esos pasos."""
    for e in ficha.get("eventos") or []:
        if e.get("kind") in kinds:
            return e.get("when") or ""
    return ""


def colocar(ficha: dict, guardada: Optional[dict], llamada: Optional[dict] = None) -> dict:
    """Dónde va una ficha de Contactos en el tablero.

    `llamada`: su fila en la lista de Llamadas, si la tiene: {"estado",
    "desde"}. "estado" llega vacío si la lista no la enseña (ya pagó, o reservó
    hora). "desde" es cuándo entró (o volvió a entrar) en la lista.

    - Si ya es alumno: columna "alumno", pase lo que pase.
    - Si alguien la movió: donde la dejaron, salvo que haya vuelto a la lista
      de Llamadas DESPUÉS de ese movimiento: entonces, "seguimiento".
    - Si está pendiente en Llamadas: "seguimiento".
    - Si estaba en "seguimiento" y en Llamadas ya no está pendiente: alguien
      la ha llamado (o la ha quitado de la lista): "contactado".
    - Si no: "contactado" si ya estaba marcada como atendida (o hecha en
      Llamadas), y si no "nuevo".
    """
    guardada = guardada or {}
    llamada = llamada or {}
    movida = guardada.get("etapa") if guardada.get("etapa") in ETAPAS_MOVIBLES else ""
    en_llamadas = llamada.get("estado", "")
    pendiente = en_llamadas == "pendiente"
    if ficha.get("etapa") == "alumno":
        etapa = "alumno"
    elif movida and movida != "seguimiento":
        volvio = pendiente and _instante(llamada.get("desde", "")) > _instante(guardada.get("updated_at", ""))
        etapa = "seguimiento" if volvio else movida
    elif pendiente:
        etapa = "seguimiento"
    elif movida == "seguimiento":
        etapa = "contactado" if en_llamadas else "seguimiento"
    else:
        etapa = "contactado" if ficha.get("atendida") or en_llamadas == "hecha" else "nuevo"
    return {
        "id": ficha.get("email", ""),
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
        # El día que llegó (pidió plaza, llegó al pago, le crearon un enlace
        # de pago o entró en Llamadas): ordena las columnas.
        "llegada": ficha.get("matricula_at")
        or _cuando_paso(ficha, _TAMBIEN_ENTRAN)
        or (llamada.get("desde") if pendiente else "")
        or (ficha.get("primer_contacto") or {}).get("when", ""),
        # Fuera del tablero: quitada a mano, o fuera de los números (prueba).
        "oculto": bool(guardada.get("oculto")) or bool(ficha.get("fuera_de_metricas")),
    }


def en_tablero(ficha: dict, en_llamadas: bool = False, movida: bool = False) -> bool:
    """Quien mostró interés de verdad. `en_llamadas`: pendiente en la lista
    de Llamadas (la persona entra aunque solo hubiera bajado una guía: si el
    equipo la ha apuntado para llamarla, es trabajo del closer). `movida`:
    alguien la ha movido de columna; si entró por Llamadas y la pasan a
    Contactado, no puede desaparecer del tablero."""
    if en_llamadas or movida or ficha.get("etapa") in _EN_TABLERO:
        return True
    return bool(_cuando_paso(ficha, _TAMBIEN_ENTRAN))


def tarjeta_suelta(llamada: dict) -> dict:
    """Una persona de Llamadas sin ficha (apuntada a mano solo con el móvil, o
    con un correo que no ha dejado ningún otro rastro): tarjeta en
    "seguimiento" que no se arrastra. Función pura."""
    return {
        "id": f"llamada:{llamada.get('id')}",
        "email": llamada.get("email", ""),
        "nombre": llamada.get("nombre", ""),
        "telefono": llamada.get("telefono", ""),
        "etapa": "seguimiento",
        "canal": "",
        "motivo": "",
        "desde": llamada.get("created_at", ""),
        "movido_por": "",
        "vio_precio": False,
        "vino_de": "",
        "que_hizo": llamada.get("detalle") or llamada.get("origen_nombre", ""),
        "utm_campaign": "",
        "fuera_de_metricas": False,
        "llegada": llamada.get("entro") or llamada.get("created_at", ""),
        "oculto": False,
        "suelta": True,
        "llamada": llamada,
    }


async def guardadas(db_session: AsyncSession) -> dict[str, dict]:
    filas = (await db_session.execute(select(LeadPipeline))).scalars().all()
    return {
        f.email: {
            "etapa": f.etapa, "canal": f.canal, "motivo": f.motivo, "oculto": bool(getattr(f, "oculto", False)),
            "updated_at": f.updated_at, "updated_by": f.updated_by,
        }
        for f in filas
    }


async def tablero(fichas: list[dict], db_session: AsyncSession) -> dict:
    from src.services.contactos.templadas import para_el_tablero

    ya = await guardadas(db_session)
    por_email = {f["email"]: f for f in fichas}
    llamadas, sueltas = await para_el_tablero(por_email, db_session)
    tarjetas = []
    for f in fichas:
        llamada = llamadas.get(f["email"])
        movida = (ya.get(f["email"]) or {}).get("etapa") in ETAPAS_MOVIBLES
        if not en_tablero(f, bool(llamada and llamada.get("estado") == "pendiente"), movida):
            continue
        t = colocar(f, ya.get(f["email"]), llamada)
        # En Seguimiento, la tarjeta enseña lo de Llamadas: temperatura y
        # dónde se quedó.
        t["llamada"] = llamada if t["etapa"] == "seguimiento" and llamada and llamada.get("estado") == "pendiente" else None
        t["suelta"] = False
        tarjetas.append(t)
    tarjetas += [tarjeta_suelta(s) for s in sueltas]
    tarjetas.sort(key=lambda t: _instante(t["llegada"]), reverse=True)
    return {"etapas": ETAPAS, "tarjetas": tarjetas}


async def mover(
    email: str,
    etapa: str,
    canal: Optional[str],
    motivo: Optional[str],
    autor: str,
    db_session: AsyncSession,
    nombre: str = "",
    telefono: str = "",
) -> dict:
    """Mueve a alguien de columna (y/o cambia el canal).

    De paso deja la marca de "atendida" de sus solicitudes a juego, para que
    Contactos y Llamadas digan lo mismo que el tablero: salir de "nuevo" es
    haberla atendido; volver a "nuevo", no. Ir a "seguimiento" no la toca
    (se puede ir ahí sin haberle escrito nunca).

    Y la lista de Llamadas, también a juego: ir a "seguimiento" la apunta
    allí, pendiente (`nombre` y `telefono`, por si entra nueva); ir a
    cualquier otra columna marca como hecha su llamada pendiente (o como
    quitada, si va a "perdido").
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

    if etapa != "seguimiento":
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

    from src.services.contactos.templadas import cerrar_pendientes_de, mandar_a_templadas

    if etapa == "seguimiento":
        await mandar_a_templadas(clave, nombre, telefono, autor, db_session)
    else:
        await cerrar_pendientes_de(clave, "descartada" if etapa == "perdido" else "hecha", db_session)
    return {"ok": True, "etapa": etapa, "canal": fila.canal}


async def ocultar(email: str, oculto: bool, autor: str, db_session: AsyncSession) -> dict:
    """Quita a alguien del tablero (o lo devuelve) sin tocar nada más: ni su
    columna, ni sus pagos, ni los números. Es lo que se hace con un alumno que
    ya no hace falta ver en el kanban."""
    clave = (email or "").strip().lower()
    if not clave or "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    fila = (
        await db_session.execute(select(LeadPipeline).where(func.lower(LeadPipeline.email) == clave))
    ).scalars().first()
    if fila is None:
        if not oculto:
            return {"ok": True, "oculto": False}
        fila = LeadPipeline(email=clave, etapa="")
    fila.oculto = bool(oculto)
    fila.updated_by = (autor or "")[:120]
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "oculto": fila.oculto}


async def borrar_de_tablero(email: str, db_session: AsyncSession) -> None:
    for f in (
        await db_session.execute(select(LeadPipeline).where(func.lower(LeadPipeline.email) == (email or "").strip().lower()))
    ).scalars().all():
        await db_session.delete(f)

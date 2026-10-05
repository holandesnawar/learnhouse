"""
Llamadas templadas — la lista de Panel → Llamadas con la gente que mostró
interés y se quedó ahí (05/10/2026).

Dos maneras de entrar:

- **Sola**: quien empezó un formulario y no lo terminó. El de /agendar (dejó
  nombre, correo y teléfono y se fue a mitad de las preguntas) y el del
  proceso de admisión (dejó sus datos para ver el vídeo y no llegó al final
  de las preguntas). Hasta hoy los de /agendar salían en «Solicitudes de
  llamada» como «No terminó», mezclados con quien sí pidió la llamada; ahora
  viven aquí.
- **A mano**: el closer o un administrador apunta a alguien con nombre, móvil,
  notas y un día aproximado para llamar. El correo es opcional.

Las automáticas se guardan como filas de verdad la primera vez que se abre la
lista (`sincronizar`): así se les pueden poner notas y fecha igual que a las
de mano. La `clave` única ("auto:<correo>") impide que entren dos veces.

Quién deja de salir solo: quien termina las preguntas (ya está en
«Solicitudes de llamada», con sus respuestas) y quien paga (ya es alumno).
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent
from src.db.enrollment_request import EnrollmentRequest
from src.db.llamadas_templadas import LlamadaTemplada

logger = logging.getLogger(__name__)

ORIGENES = {"mano": "Apuntada a mano", "agendar": "Agendar llamada", "admision": "Proceso de admisión"}
ESTADOS = ("pendiente", "hecha", "descartada")

#: Quien dejó sus datos hace menos de esto puede estar rellenando todavía.
ESPERA_ANTES_DE_LISTAR = timedelta(minutes=30)

_ZONA = ZoneInfo("Europe/Amsterdam")


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def hoy_local() -> date:
    return datetime.now(_ZONA).date()


def _fecha(iso: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(iso or "").replace("Z", "+00:00").replace(" ", "T"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def fecha_valida(texto: str) -> bool:
    try:
        datetime.strptime(texto, "%Y-%m-%d")
        return True
    except (TypeError, ValueError):
        return False


def _extra(texto) -> dict:
    if isinstance(texto, dict):
        return texto
    try:
        valor = json.loads(texto) if texto else {}
    except Exception:  # noqa: BLE001
        return {}
    return valor if isinstance(valor, dict) else {}


def origen_de(kind: str, extra: dict) -> str:
    """Los primeros del proceso de admisión (02/10) se guardaron como
    "agendar-empezado" con la marca `embudo: admision`."""
    if kind == "admision" or extra.get("embudo") == "admision":
        return "admision"
    return "agendar"


def detalle_de(origen: str, extra: dict) -> str:
    """Qué dejó a medias, en una línea para el closer. Función pura."""
    ultima = str(extra.get("ultima") or "").strip()
    if origen == "admision":
        texto = "Dejó sus datos y vio el vídeo entero" if extra.get("video") == "visto" else "Dejó sus datos y no terminó el vídeo"
        return texto + (f"; en las preguntas se quedó en «{ultima}»" if ultima else "")
    if ultima:
        return f"Dejó sus datos y se fue después de «{ultima}»"
    return "Dejó sus datos y no contestó ninguna pregunta"


def filas_automaticas(
    eventos: list[dict],
    terminaron: set[str],
    pagaron: set[str],
    ya_estan: set[str],
    atendidos: dict[str, str],
    ahora: datetime,
) -> list[dict]:
    """Quién entra solo en la lista. Función pura, con test.

    `eventos`: los "agendar-empezado" y "admision", el más nuevo primero, como
    dicts con kind, email, nombre, telefono, created_at y extra.
    `ya_estan`: correos que ya tienen su fila automática (sea cual sea su
    estado: una descartada no vuelve).
    `atendidos`: correo → cuándo se marcó atendido en la lista vieja; entran
    ya como hechos, para no volver a pedir que se llame a quien ya se llamó.
    """
    salida: list[dict] = []
    vistos: set[str] = set()
    for e in eventos:
        email = str(e.get("email") or "").strip().lower()
        if not email or email in vistos:
            continue
        vistos.add(email)
        if email in terminaron or email in pagaron or email in ya_estan:
            continue
        cuando = _fecha(e.get("created_at") or "")
        if cuando is not None and ahora - cuando < ESPERA_ANTES_DE_LISTAR:
            continue
        extra = _extra(e.get("extra"))
        origen = origen_de(str(e.get("kind") or ""), extra)
        atendido = atendidos.get(email) or str(extra.get("atendida_at") or "")
        salida.append(
            {
                "clave": f"auto:{email}",
                "email": email,
                "nombre": str(e.get("nombre") or "").strip(),
                "telefono": str(e.get("telefono") or "").strip(),
                "origen": origen,
                "detalle": detalle_de(origen, extra),
                "estado": "hecha" if atendido else "pendiente",
                "hecha_at": atendido,
                "created_at": e.get("created_at") or "",
            }
        )
    return salida


def toca(llamar_el: str, hoy: date) -> str:
    """"vencida", "hoy", "proxima" o "" (sin fecha). Función pura."""
    if not fecha_valida(llamar_el):
        return ""
    d = date.fromisoformat(llamar_el)
    if d < hoy:
        return "vencida"
    return "hoy" if d == hoy else "proxima"


def ordenar_pendientes(filas: list[dict], hoy: date) -> list[dict]:
    """Primero lo que toca hoy o ya se pasó (lo más atrasado arriba), luego las
    que tienen fecha (la más cercana arriba) y al final las que no tienen
    fecha (la más nueva arriba). Función pura, con test."""

    con_fecha = sorted((f for f in filas if toca(f.get("llamar_el") or "", hoy)), key=lambda f: f["llamar_el"])
    sin_fecha = sorted(
        (f for f in filas if not toca(f.get("llamar_el") or "", hoy)),
        key=lambda f: f.get("created_at") or "",
        reverse=True,
    )
    return con_fecha + sin_fecha


def _dict(f: LlamadaTemplada, hoy: date) -> dict:
    return {
        "id": f.id,
        "nombre": f.nombre,
        "telefono": f.telefono,
        "email": f.email,
        "notas": f.notas,
        "llamar_el": f.llamar_el,
        "toca": toca(f.llamar_el, hoy),
        "origen": f.origen,
        "origen_nombre": ORIGENES.get(f.origen, f.origen),
        "detalle": f.detalle,
        "estado": f.estado,
        "creado_por": f.creado_por,
        "created_at": f.created_at,
        "updated_at": f.updated_at,
        "hecha_at": f.hecha_at,
    }


async def _atendidos_en_solicitudes(emails: set[str], db_session: AsyncSession) -> dict[str, str]:
    if not emails:
        return {}
    salida: dict[str, str] = {}
    for email, contacted in (
        await db_session.execute(
            select(EnrollmentRequest.email, EnrollmentRequest.contacted_at)
            .where(EnrollmentRequest.email.in_(emails))  # type: ignore[attr-defined]
            .where(EnrollmentRequest.source.in_(["llamada", "admision"]))  # type: ignore[attr-defined]
        )
    ).all():
        if contacted:
            salida[str(email).lower()] = str(contacted)
    return salida


async def _terminaron(db_session: AsyncSession) -> set[str]:
    return {
        str(e).strip().lower()
        for (e,) in (
            await db_session.execute(select(ContactEvent.email).where(ContactEvent.kind == "cualificacion"))
        ).all()
        if e
    }


async def sincronizar(db_session: AsyncSession) -> int:
    """Mete en la lista a quien se quedó a medias y aún no está. Devuelve
    cuántos entraron. También pone al día el «qué dejó a medias» de los
    automáticos pendientes (alguien puede haber contestado una pregunta más)."""
    from src.services.contactos.contactos import emails_que_pagaron

    eventos = (
        await db_session.execute(
            select(ContactEvent)
            .where(ContactEvent.kind.in_(["agendar-empezado", "admision"]))  # type: ignore[attr-defined]
            .order_by(ContactEvent.id.desc())  # type: ignore[attr-defined]
            .limit(2000)
        )
    ).scalars().all()
    if not eventos:
        return 0

    todas = (await db_session.execute(select(LlamadaTemplada))).scalars().all()
    existentes = {f.clave: f for f in todas if f.clave}
    # Quien ya está en la lista, de la forma que sea (automática, a mano o
    # mandada desde su ficha), no entra otra vez.
    ya_estan = {(f.email or "").lower() for f in todas if f.email}
    como_dict = [
        {
            "kind": e.kind,
            "email": e.email,
            "nombre": f"{e.first_name or ''} {e.last_name or ''}".strip(),
            "telefono": e.phone,
            "created_at": e.created_at,
            "extra": e.extra,
        }
        for e in eventos
    ]

    # El «qué dejó a medias» de los que ya están y siguen pendientes.
    cambiadas = False
    vistos: set[str] = set()
    for e in como_dict:
        email = (e["email"] or "").strip().lower()
        if email in vistos:
            continue
        vistos.add(email)
        fila = existentes.get(f"auto:{email}")
        if fila is not None and fila.estado == "pendiente":
            extra = _extra(e["extra"])
            nuevo = detalle_de(origen_de(e["kind"], extra), extra)
            if nuevo != fila.detalle:
                fila.detalle = nuevo
                db_session.add(fila)
                cambiadas = True
    if cambiadas:
        await db_session.commit()

    emails = {(e["email"] or "").strip().lower() for e in como_dict} - ya_estan
    nuevas = filas_automaticas(
        como_dict,
        await _terminaron(db_session),
        await emails_que_pagaron(db_session),
        ya_estan,
        await _atendidos_en_solicitudes(emails, db_session),
        datetime.now(timezone.utc),
    )
    entraron = 0
    for datos in nuevas:
        db_session.add(LlamadaTemplada(**datos, creado_por="Automático", updated_at=_ahora()))
        try:
            await db_session.commit()
            entraron += 1
        except IntegrityError:
            # Otra pantalla la ha metido a la vez: ya está, que es lo que se quería.
            await db_session.rollback()
    return entraron


async def listar_templadas(db_session: AsyncSession) -> dict:
    """Las pendientes en orden de llamada, y las hechas o descartadas aparte."""
    try:
        await sincronizar(db_session)
    except Exception:  # noqa: BLE001
        # La lista de mano tiene que salir aunque falle meter las automáticas.
        logger.exception("No se han podido meter las llamadas templadas automáticas")
        await db_session.rollback()

    from src.services.contactos.contactos import emails_que_pagaron

    pagaron = await emails_que_pagaron(db_session)
    terminaron = await _terminaron(db_session)
    hoy = hoy_local()
    pendientes: list[dict] = []
    cerradas: list[dict] = []
    for f in (await db_session.execute(select(LlamadaTemplada))).scalars().all():
        email = (f.email or "").lower()
        if f.estado == "pendiente":
            # Ya pagó: es alumno, no hay que llamarle para venderle nada.
            if email and email in pagaron:
                continue
            # Una automática que luego terminó las preguntas ya sale en
            # «Solicitudes de llamada», con sus respuestas.
            if f.origen != "mano" and email in terminaron:
                continue
            pendientes.append(_dict(f, hoy))
        else:
            cerradas.append(_dict(f, hoy))
    cerradas.sort(key=lambda x: x["updated_at"] or x["hecha_at"] or "", reverse=True)
    return {"pendientes": ordenar_pendientes(pendientes, hoy), "cerradas": cerradas[:150]}


def _limpio(texto: Optional[str], tope: int) -> str:
    return str(texto or "").strip()[:tope]


async def _nota_a_la_ficha(email: str, notas: str, autor_id: int, autor: str, db_session: AsyncSession) -> None:
    """Las notas de aquí también quedan en la ficha de la persona (05/10:
    "que las notas vayan también a la ficha"). La ficha es un historial: cada
    vez que cambian, entra una nota nueva con el texto entero. Solo si hay
    correo, que es lo que une a la persona con su ficha."""
    if not email or not notas.strip():
        return
    from src.services.contactos.seguimiento import anadir_nota

    try:
        await anadir_nota(email, f"Llamadas templadas: {notas.strip()}", autor_id, autor, db_session)
    except Exception:  # noqa: BLE001
        # La nota de la lista ya está guardada; la copia no debe tumbarla.
        logger.exception("No se ha podido copiar la nota de la llamada templada a la ficha")
        await db_session.rollback()


async def crear_templada(datos: dict, autor: str, db_session: AsyncSession, autor_id: int = 0) -> dict:
    nombre = _limpio(datos.get("nombre"), 160)
    telefono = _limpio(datos.get("telefono"), 40)
    email = _limpio(datos.get("email"), 255).lower()
    llamar_el = _limpio(datos.get("llamar_el"), 10)
    if not nombre and not telefono:
        return {"ok": False, "motivo": "Pon al menos el nombre o el móvil"}
    if email and "@" not in email:
        return {"ok": False, "motivo": "El correo no es válido"}
    if llamar_el and not fecha_valida(llamar_el):
        return {"ok": False, "motivo": "La fecha no es válida"}
    ahora = _ahora()
    fila = LlamadaTemplada(
        nombre=nombre,
        telefono=telefono,
        email=email,
        notas=_limpio(datos.get("notas"), 4000),
        llamar_el=llamar_el,
        origen="mano",
        estado="pendiente",
        clave=None,
        creado_por=autor[:120],
        created_at=ahora,
        updated_at=ahora,
    )
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    resultado = {"ok": True, "templada": _dict(fila, hoy_local())}
    await _nota_a_la_ficha(fila.email, fila.notas, autor_id, autor, db_session)
    return resultado


async def actualizar_templada(
    templada_id: int, cambios: dict, db_session: AsyncSession, autor: str = "", autor_id: int = 0
) -> dict:
    """Cambia solo lo que llega (los campos que no vienen se quedan)."""
    fila = (
        await db_session.execute(select(LlamadaTemplada).where(LlamadaTemplada.id == templada_id))
    ).scalars().first()
    if fila is None:
        return {"ok": False, "motivo": "No existe", "codigo": 404}
    antes = (fila.email, fila.notas)
    if "nombre" in cambios:
        fila.nombre = _limpio(cambios["nombre"], 160)
    if "telefono" in cambios:
        fila.telefono = _limpio(cambios["telefono"], 40)
    if "email" in cambios:
        email = _limpio(cambios["email"], 255).lower()
        if email and "@" not in email:
            return {"ok": False, "motivo": "El correo no es válido"}
        # Las automáticas van atadas a su correo: cambiarlo las desataría.
        if fila.origen == "mano":
            fila.email = email
    if "notas" in cambios:
        fila.notas = _limpio(cambios["notas"], 4000)
    if "llamar_el" in cambios:
        f = _limpio(cambios["llamar_el"], 10)
        if f and not fecha_valida(f):
            return {"ok": False, "motivo": "La fecha no es válida"}
        fila.llamar_el = f
    if "estado" in cambios:
        estado = str(cambios["estado"] or "")
        if estado not in ESTADOS:
            return {"ok": False, "motivo": "Estado no válido"}
        if estado != fila.estado:
            fila.estado = estado
            fila.hecha_at = _ahora() if estado != "pendiente" else ""
    if not fila.nombre and not fila.telefono:
        return {"ok": False, "motivo": "Pon al menos el nombre o el móvil"}
    fila.updated_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    resultado = {"ok": True, "templada": _dict(fila, hoy_local())}
    # A la ficha, si cambiaron las notas o si acaba de ponérsele el correo.
    if (fila.email, fila.notas) != antes and fila.notas and (fila.notas != antes[1] or not antes[0]):
        await _nota_a_la_ficha(fila.email, fila.notas, autor_id, autor, db_session)
    return resultado


async def templada_de(email: str, db_session: AsyncSession) -> Optional[dict]:
    """La fila de esa persona en la lista, si la tiene (la más reciente)."""
    clave = (email or "").strip().lower()
    if not clave:
        return None
    fila = (
        await db_session.execute(
            select(LlamadaTemplada).where(LlamadaTemplada.email == clave).order_by(LlamadaTemplada.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().first()
    return _dict(fila, hoy_local()) if fila else None


async def mandar_a_templadas(
    email: str, nombre: str, telefono: str, llamar_el: str, autor: str, db_session: AsyncSession
) -> dict:
    """El botón de la ficha: pone a la persona en la lista para llamarla. Si
    ya estaba (pendiente, hecha o quitada) no se duplica: se vuelve a poner
    pendiente con la fecha nueva, y sus notas se quedan."""
    clave = _limpio(email, 255).lower()
    if "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    llamar_el = _limpio(llamar_el, 10) or hoy_local().isoformat()
    if not fecha_valida(llamar_el):
        return {"ok": False, "motivo": "La fecha no es válida"}
    fila = (
        await db_session.execute(
            select(LlamadaTemplada).where(LlamadaTemplada.email == clave).order_by(LlamadaTemplada.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().first()
    ahora = _ahora()
    ya_estaba = fila is not None and fila.estado == "pendiente"
    if fila is None:
        fila = LlamadaTemplada(
            nombre=_limpio(nombre, 160),
            telefono=_limpio(telefono, 40),
            email=clave,
            origen="mano",
            detalle="Mandada desde su ficha",
            estado="pendiente",
            clave=None,
            creado_por=autor[:120],
            created_at=ahora,
        )
    else:
        fila.estado = "pendiente"
        fila.hecha_at = ""
        fila.nombre = fila.nombre or _limpio(nombre, 160)
        fila.telefono = fila.telefono or _limpio(telefono, 40)
    fila.llamar_el = llamar_el
    fila.updated_at = ahora
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    return {"ok": True, "ya_estaba": ya_estaba, "templada": _dict(fila, hoy_local())}


async def quitar_templada(templada_id: int, db_session: AsyncSession) -> dict:
    """Las de mano SIN correo se borran. Las demás se quedan como descartadas:
    si se borraran, la persona volvería a entrar sola la próxima vez que se
    abra la lista (si dejó un formulario a medias)."""
    fila = (
        await db_session.execute(select(LlamadaTemplada).where(LlamadaTemplada.id == templada_id))
    ).scalars().first()
    if fila is None:
        return {"ok": False, "motivo": "No existe", "codigo": 404}
    if fila.origen == "mano" and not fila.email:
        await db_session.delete(fila)
        await db_session.commit()
        return {"ok": True, "borrada": True}
    fila.estado = "descartada"
    fila.hecha_at = fila.updated_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "borrada": False}


async def borrar_templadas_de(email: str, db_session: AsyncSession) -> None:
    """Para `borrar_contacto`: si se borra a la persona, también de aquí. No
    hace commit (lo hace quien llama)."""
    clave = (email or "").strip().lower()
    if not clave:
        return
    for f in (
        await db_session.execute(select(LlamadaTemplada).where(LlamadaTemplada.email == clave))
    ).scalars().all():
        await db_session.delete(f)

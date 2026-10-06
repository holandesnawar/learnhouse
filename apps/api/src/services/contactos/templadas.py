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
  y notas. El correo es opcional. Sin fechas: cada persona está pendiente o
  hecha (05/10, "pendiente o hecho y ya").
- Las NOTAS: con correo, son las mismas de su ficha (una sola lista, la de
  `contact_nota`); sin correo, viven en la propia fila.

Las automáticas se guardan como filas de verdad la primera vez que se abre la
lista (`sincronizar`): así se les pueden poner notas y fecha igual que a las
de mano. La `clave` única ("auto:<correo>") impide que entren dos veces.

Quién deja de salir solo: quien termina las preguntas (ya está en
«Solicitudes de llamada», con sus respuestas) y quien paga (ya es alumno).
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent
from src.db.contact_seguimiento import ContactNota
from src.db.enrollment_request import EnrollmentRequest
from src.db.llamadas_templadas import LlamadaTemplada

logger = logging.getLogger(__name__)

ORIGENES = {
    "mano": "Apuntada a mano",
    "agendar": "Agendar llamada",
    "admision": "Proceso de admisión",
    # Terminó las preguntas (pidió la llamada) y no reservó hora (06/10).
    "llamada": "Pidió llamada, sin hora",
}
ESTADOS = ("pendiente", "hecha", "descartada")

#: Quien dejó sus datos hace menos de esto puede estar rellenando todavía.
ESPERA_ANTES_DE_LISTAR = timedelta(minutes=30)


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fecha(iso: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(iso or "").replace("Z", "+00:00").replace(" ", "T"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


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
    if origen == "llamada":
        que = "Terminó la admisión" if extra.get("embudo") == "admision" else "Pidió la llamada"
        if extra.get("apto"):
            encaje = "encaja"
        else:
            motivo = str(extra.get("motivo_fuera") or "").strip()
            encaje = f"no encaja: {motivo}" if motivo else "no encaja"
        return f"{que} ({encaje}) y no reservó hora"
    ultima = str(extra.get("ultima") or "").strip()
    if origen == "admision":
        texto = "Dejó sus datos y vio el vídeo entero" if extra.get("video") == "visto" else "Dejó sus datos y no terminó el vídeo"
        return texto + (f"; en las preguntas se quedó en «{ultima}»" if ultima else "")
    if ultima:
        return f"Dejó sus datos y se fue después de «{ultima}»"
    return "Dejó sus datos y no contestó ninguna pregunta"


def reservaron_de(eventos: list[dict]) -> set[str]:
    """Quién reservó hora DESPUÉS de su última cualificación (evento
    "reunion", lo manda la web cuando Calendly avisa). Función pura."""
    ultima_cual: dict[str, datetime] = {}
    reuniones: dict[str, list[datetime]] = {}
    for e in eventos:
        email = str(e.get("email") or "").strip().lower()
        cuando = _fecha(e.get("created_at") or "")
        if not email or cuando is None:
            continue
        if e.get("kind") == "cualificacion":
            if email not in ultima_cual or cuando > ultima_cual[email]:
                ultima_cual[email] = cuando
        elif e.get("kind") == "reunion":
            reuniones.setdefault(email, []).append(cuando)
    return {
        email
        for email, horas in reuniones.items()
        if email not in ultima_cual or any(h >= ultima_cual[email] for h in horas)
    }


def filas_automaticas(
    eventos: list[dict],
    reservaron: set[str],
    pagaron: set[str],
    ya_estan: set[str],
    atendidos: dict[str, str],
    ahora: datetime,
) -> list[dict]:
    """Quién entra solo en la lista. Función pura, con test.

    `eventos`: los "agendar-empezado", "admision" y "cualificacion", el más
    nuevo primero, como dicts con kind, email, nombre, telefono, created_at y
    extra. Entra:
    - quien dejó sus datos y no terminó las preguntas, y
    - (06/10) quien SÍ las terminó, o sea, pidió la llamada, pero no reservó
      hora (`reservaron`).
    `ya_estan`: correos que ya tienen su fila (sea cual sea su estado: una
    descartada no vuelve).
    `atendidos`: correo → cuándo se marcó atendido en la lista vieja; entran
    ya como hechos, para no volver a pedir que se llame a quien ya se llamó.
    """
    por_email: dict[str, dict] = {}
    orden: list[str] = []
    for e in eventos:
        email = str(e.get("email") or "").strip().lower()
        if not email:
            continue
        if email not in por_email:
            por_email[email] = {}
            orden.append(email)
        clave = "cual" if e.get("kind") == "cualificacion" else "medias"
        por_email[email].setdefault(clave, e)

    salida: list[dict] = []
    for email in orden:
        if email in pagaron or email in ya_estan or email in reservaron:
            continue
        info = por_email[email]
        e = info.get("cual") or info.get("medias")
        cuando = _fecha(e.get("created_at") or "")
        # Puede estar rellenando todavía (o a punto de reservar hora).
        if cuando is not None and ahora - cuando < ESPERA_ANTES_DE_LISTAR:
            continue
        extra = _extra(e.get("extra"))
        origen = "llamada" if info.get("cual") else origen_de(str(e.get("kind") or ""), extra)
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


#: Temperatura de un lead pendiente (06/10, usuario: "el que hizo matrícula
#: ayer y no agendó está más caliente: rojo, llamar lo antes posible; amarillo
#: templado; verde más frío").
#: ⚠️ Se mide por CUÁNDO ENTRÓ EN EL FLUJO según su ficha (su primera
#: matrícula: pidió plaza, dejó datos en /agendar o en la admisión, llegó al
#: pago), no por "la última señal". Esa fue la primera versión y salían todos
#: rojos, de hoy o de ayer: cualquier cosa reciente con su correo (un enlace de
#: pago del equipo, un reenvío del formulario) los recalentaba. Lo que hizo
#: después se enseña al lado, para que el equipo decida, y el color se puede
#: poner a mano (`temperatura_manual`).
HORAS_CALIENTE = 48
DIAS_TEMPLADO = 7
TEMPERATURAS = ("caliente", "templado", "frio")
_ORDEN_TEMPERATURA = {"caliente": 0, "templado": 1, "frio": 2}


def temperatura(entro: str, ahora: datetime) -> str:
    """"caliente" (entró hace menos de 48 h), "templado" (hasta 7 días) o
    "frio". Sin fecha que leer, frío. Función pura, con test."""
    cuando = _fecha(entro)
    if cuando is None:
        return "frio"
    horas = (ahora - cuando).total_seconds() / 3600
    if horas < HORAS_CALIENTE:
        return "caliente"
    if horas < DIAS_TEMPLADO * 24:
        return "templado"
    return "frio"


def ordenar_pendientes(filas: list[dict]) -> list[dict]:
    """La más caliente arriba; dentro de cada temperatura, quien entró más
    recientemente. Función pura, con test."""
    por_fecha = sorted(filas, key=lambda f: _fecha(f.get("entro") or f.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return sorted(por_fecha, key=lambda f: _ORDEN_TEMPERATURA.get(f.get("temperatura") or "frio", 2))


def con_temperatura(fila: dict, ficha: Optional[dict], manual: str, ahora: datetime) -> dict:
    """Le pone a una fila lo que dice su ficha (cuándo entró en el flujo y qué
    fue lo último que hizo) y su temperatura. Función pura, con test."""
    entro = ""
    if ficha:
        entro = ficha.get("matricula_at") or (ficha.get("primer_contacto") or {}).get("when") or ""
    entro = entro or fila.get("created_at") or ""
    ultimo = (ficha or {}).get("ultimo_contacto") or {}
    auto = temperatura(entro, ahora)
    fila.update(
        {
            "entro": entro,
            "que_hizo": ultimo.get("que") or "",
            "que_hizo_at": ultimo.get("when") or "",
            "temperatura_auto": auto,
            "temperatura_manual": manual if manual in TEMPERATURAS else "",
            "temperatura": manual if manual in TEMPERATURAS else auto,
        }
    )
    return fila


def _dict(f: LlamadaTemplada, notas: Optional[dict] = None) -> dict:
    """`notas`: {correo: (cuántas, la última)} de la ficha. Con correo, las
    notas SON las de la ficha; sin correo, las de la propia fila."""
    n, ultima = (notas or {}).get((f.email or "").lower(), (0, ""))
    if not f.email:
        n, ultima = (1 if f.notas else 0), f.notas
    return {
        "id": f.id,
        "nombre": f.nombre,
        "telefono": f.telefono,
        "email": f.email,
        # Solo las de quien no tiene correo (no tiene ficha donde guardarlas).
        "notas": "" if f.email else f.notas,
        "n_notas": n,
        "ultima_nota": ultima,
        "origen": f.origen,
        "origen_nombre": ORIGENES.get(f.origen, f.origen),
        "detalle": f.detalle,
        "estado": f.estado,
        "creado_por": f.creado_por,
        "created_at": f.created_at,
        "updated_at": f.updated_at,
        "hecha_at": f.hecha_at,
    }


async def _notas_por_email(emails: set[str], db_session: AsyncSession) -> dict[str, tuple[int, str]]:
    """Cuántas notas tiene cada correo en su ficha y la última."""
    if not emails:
        return {}
    salida: dict[str, tuple[int, str]] = {}
    for email, texto in (
        await db_session.execute(
            select(ContactNota.email, ContactNota.texto)
            .where(ContactNota.email.in_(emails))  # type: ignore[attr-defined]
            .order_by(ContactNota.id.desc())  # type: ignore[attr-defined]
        )
    ).all():
        clave = str(email).lower()
        n, ultima = salida.get(clave, (0, ""))
        salida[clave] = (n + 1, ultima or str(texto or ""))
    return salida


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


async def _eventos_de_llamada(db_session: AsyncSession) -> list[dict]:
    filas = (
        await db_session.execute(
            select(ContactEvent)
            .where(ContactEvent.kind.in_(["agendar-empezado", "admision", "cualificacion", "reunion"]))  # type: ignore[attr-defined]
            .order_by(ContactEvent.id.desc())  # type: ignore[attr-defined]
            .limit(4000)
        )
    ).scalars().all()
    return [
        {
            "kind": e.kind,
            "email": e.email,
            "nombre": f"{e.first_name or ''} {e.last_name or ''}".strip(),
            "telefono": e.phone,
            "created_at": e.created_at,
            "extra": e.extra,
        }
        for e in filas
    ]


async def sincronizar(db_session: AsyncSession) -> int:
    """Mete en la lista a quien se quedó a medias (o pidió llamada y no
    reservó hora) y aún no está. Devuelve cuántos entraron. También pone al
    día el «qué dejó a medias» de los automáticos pendientes (alguien puede
    haber contestado una pregunta más, o haber terminado)."""
    from src.services.contactos.contactos import emails_que_pagaron

    todos = await _eventos_de_llamada(db_session)
    reservaron = reservaron_de(todos)
    como_dict = [e for e in todos if e["kind"] != "reunion"]
    if not como_dict:
        return 0

    filas = (await db_session.execute(select(LlamadaTemplada))).scalars().all()
    existentes = {f.clave: f for f in filas if f.clave}
    # Quien ya está en la lista, de la forma que sea (automática, a mano o
    # mandada desde su ficha), no entra otra vez.
    ya_estan = {(f.email or "").lower() for f in filas if f.email}

    # El «qué dejó a medias» de los que ya están y siguen pendientes. Si ha
    # terminado las preguntas desde entonces, pasa a «Pidió llamada, sin hora».
    por_email: dict[str, dict] = {}
    for e in como_dict:
        email = (e["email"] or "").strip().lower()
        clave = "cual" if e["kind"] == "cualificacion" else "medias"
        por_email.setdefault(email, {}).setdefault(clave, e)
    cambiadas = False
    for email, info in por_email.items():
        fila = existentes.get(f"auto:{email}")
        if fila is None or fila.estado != "pendiente":
            continue
        e = info.get("cual") or info.get("medias")
        extra = _extra(e["extra"])
        origen = "llamada" if info.get("cual") else origen_de(e["kind"], extra)
        nuevo = detalle_de(origen, extra)
        if nuevo != fila.detalle or origen != fila.origen:
            fila.detalle, fila.origen = nuevo, origen
            db_session.add(fila)
            cambiadas = True
    if cambiadas:
        await db_session.commit()

    emails = set(por_email) - ya_estan
    nuevas = filas_automaticas(
        como_dict,
        reservaron,
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


async def _fichas_por_email(emails: set[str], db_session: AsyncSession) -> dict[str, dict]:
    """La ficha de cada correo, la MISMA que se ve en Contactos y en la ficha
    del cliente (`fusionar_contactos`), para que la lista diga lo mismo."""
    if not emails:
        return {}
    from src.services.contactos.contactos import _todos_los_eventos, fusionar_contactos

    eventos = [e for e in await _todos_los_eventos(db_session) if (e.get("email") or "").strip().lower() in emails]
    return {f["email"]: f for f in fusionar_contactos(eventos, set())}


async def listar_templadas(db_session: AsyncSession) -> dict:
    """Las pendientes (lo más nuevo arriba) y las hechas o quitadas aparte."""
    try:
        await sincronizar(db_session)
    except Exception:  # noqa: BLE001
        # La lista de mano tiene que salir aunque falle meter las automáticas.
        logger.exception("No se han podido meter las llamadas templadas automáticas")
        await db_session.rollback()

    from src.services.contactos.contactos import emails_que_pagaron

    pagaron = await emails_que_pagaron(db_session)
    reservaron = reservaron_de(await _eventos_de_llamada(db_session))
    filas = (await db_session.execute(select(LlamadaTemplada))).scalars().all()
    correos = {(f.email or "").lower() for f in filas if f.email}
    notas = await _notas_por_email(correos, db_session)
    fichas = await _fichas_por_email(correos, db_session)
    ahora = datetime.now(timezone.utc)
    pendientes: list[dict] = []
    cerradas: list[dict] = []
    for f in filas:
        email = (f.email or "").lower()
        if f.estado == "pendiente":
            # Ya pagó: es alumno, no hay que llamarle para venderle nada.
            if email and email in pagaron:
                continue
            # Una automática que ya reservó hora en el calendario está en la
            # agenda: aquí sobra.
            if f.origen != "mano" and email in reservaron:
                continue
            # Quien no tiene correo no tiene ficha: cuenta desde que se apuntó.
            pendientes.append(con_temperatura(_dict(f, notas), fichas.get(email), f.temperatura_manual or "", ahora))
        else:
            cerradas.append(_dict(f, notas))
    cerradas.sort(key=lambda x: x["hecha_at"] or x["updated_at"] or "", reverse=True)
    return {"pendientes": ordenar_pendientes(pendientes), "cerradas": cerradas[:150]}


def _limpio(texto: Optional[str], tope: int) -> str:
    return str(texto or "").strip()[:tope]


async def _pasar_notas_a_la_ficha(fila: LlamadaTemplada, autor_id: int, autor: str, db_session: AsyncSession) -> None:
    """Con correo, las notas de la persona son UNA sola lista: la de su ficha
    (05/10: "si le añado notas a un lead, son las mismas que salen en llamada
    templada"). Lo que se escribiera en la fila antes de tener correo se pasa a
    la ficha y la fila se queda vacía."""
    if not fila.email or not (fila.notas or "").strip():
        return
    from src.services.contactos.seguimiento import anadir_nota

    texto = fila.notas.strip()
    fila.notas = ""
    db_session.add(fila)
    await db_session.commit()
    await anadir_nota(fila.email, texto, autor_id, autor, db_session)


async def crear_templada(datos: dict, autor: str, db_session: AsyncSession, autor_id: int = 0) -> dict:
    nombre = _limpio(datos.get("nombre"), 160)
    telefono = _limpio(datos.get("telefono"), 40)
    email = _limpio(datos.get("email"), 255).lower()
    if not nombre and not telefono:
        return {"ok": False, "motivo": "Pon al menos el nombre o el móvil"}
    if email and "@" not in email:
        return {"ok": False, "motivo": "El correo no es válido"}
    ahora = _ahora()
    fila = LlamadaTemplada(
        nombre=nombre,
        telefono=telefono,
        email=email,
        notas=_limpio(datos.get("notas"), 4000),
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
    await _pasar_notas_a_la_ficha(fila, autor_id, autor, db_session)
    return {"ok": True, "templada": await _con_notas(fila, db_session)}


async def _con_notas(fila: LlamadaTemplada, db_session: AsyncSession) -> dict:
    email = (fila.email or "").lower()
    return _dict(fila, await _notas_por_email({email} if email else set(), db_session))


async def actualizar_templada(
    templada_id: int, cambios: dict, db_session: AsyncSession, autor: str = "", autor_id: int = 0
) -> dict:
    """Cambia solo lo que llega (los campos que no vienen se quedan)."""
    fila = (
        await db_session.execute(select(LlamadaTemplada).where(LlamadaTemplada.id == templada_id))
    ).scalars().first()
    if fila is None:
        return {"ok": False, "motivo": "No existe", "codigo": 404}
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
        # Con correo, una nota nueva va a la ficha (ver _pasar_notas_a_la_ficha).
        fila.notas = _limpio(cambios["notas"], 4000)
    if "temperatura" in cambios:
        t = str(cambios["temperatura"] or "")
        if t and t not in TEMPERATURAS:
            return {"ok": False, "motivo": "Temperatura no válida"}
        # Vacía = vuelve a la automática.
        fila.temperatura_manual = t
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
    await _pasar_notas_a_la_ficha(fila, autor_id, autor, db_session)
    return {"ok": True, "templada": await _con_notas(fila, db_session)}


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
    return await _con_notas(fila, db_session) if fila else None


async def mandar_a_templadas(email: str, nombre: str, telefono: str, autor: str, db_session: AsyncSession) -> dict:
    """El botón de la ficha: pone a la persona en la lista, pendiente. Si ya
    estaba (pendiente, hecha o quitada) no se duplica: vuelve a pendiente y
    sube arriba de la lista."""
    clave = _limpio(email, 255).lower()
    if "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
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
    elif not ya_estaba:
        fila.estado = "pendiente"
        fila.hecha_at = ""
        # Vuelve a entrar: arriba de la lista.
        fila.created_at = ahora
        fila.nombre = fila.nombre or _limpio(nombre, 160)
        fila.telefono = fila.telefono or _limpio(telefono, 40)
    fila.updated_at = ahora
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    return {"ok": True, "ya_estaba": ya_estaba, "templada": await _con_notas(fila, db_session)}

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

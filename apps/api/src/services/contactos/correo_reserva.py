"""
El correo de Rida a quien acaba de reservar una llamada (27/10/2026).

Pedido del usuario: "que cuando alguien nuevo reserve le llegue el correo desde
la escuela… si lo hago por Calendly no es marca… eso sí, hay que controlar que
no se envíe otra vez cuando cambiemos de hora un evento". Es el correo «Un
mensaje de Rida antes de tu llamada» (como el de Andy en Conquer): quién es el
fundador, por qué existe Nawar y dos avisos (la llamada es por Zoom, y te
llamaremos para confirmarla).

Cómo
----
1. **Calendly avisa a la escuela** de cada reserva (webhook `invitee.created`).
   El aviso llega firmado y se comprueba la firma (`firma_valida`): sin eso,
   cualquiera podría hacer que la escuela mandara correos.
2. **La escuela le pide a Calendly ese aviso ella misma**, con el token de
   siempre (`LEARNHOUSE_CALENDLY_TOKEN`): al encender el correo en Avisos, o
   con «Volver a conectar» (`conectar`). La clave de la firma no se guarda en
   ningún sitio: sale del secreto de la escuela (`clave_firma`). ⚠️ Si se
   cambia `LEARNHOUSE_AUTH_JWT_SECRET_KEY`, la firma deja de cuadrar y los
   avisos se rechazan: «Volver a conectar» en Avisos → «Al reservar».
3. **Solo el evento de las llamadas** (`llamada-de-consultoria`, el mismo que
   agenda el panel, `reservar._tipo`). Si en el Calendly hay otros eventos (una
   reunión con un proveedor), a esa gente no le llega nada.
4. **Una vez por persona, para siempre.** Un cambio de hora no es una reserva
   nueva: Calendly la marca (`old_invitee`) y se salta; el que hace el equipo
   desde la escuela (31/10) no la trae, y se reconoce por su marca en la ficha
   (`reservar.lo_cambio_el_equipo`). Y quien cancela y
   vuelve a reservar tampoco lo recibe otra vez: la marca es un evento
   `correo-reserva` en su ficha («Le llegó el correo de Rida»), que se apunta
   ANTES de mandar y se quita si el envío falla, para que el reintento de
   Calendly lo vuelva a intentar.
5. **Apagado de serie** (org_config `correo_reserva`): el texto se edita y se
   prueba con «Mandármelo a mí» antes de encenderlo. Con él apagado, la
   escuela no manda nada (pero sigue recibiendo los avisos).

Con Calendly Teams (31/10), el aviso llega para TODA la organización (cada
closer es un usuario de Calendly y el evento es «por turnos»): la suscripción
se pide con `scope: organization` y, si el token no puede, con `scope: user`
como antes. Cada aviso trae quién atiende la cita (`event_memberships`): si es
un closer, la tarjeta pasa a ser suya (`reparto.asignar_por_anfitrion`) y no
sale el «repártela». Calendly ya le manda a ese closer la reserva y la pone en
su calendario.

De paso, a quien reparte las llamadas le llega el «llamada nueva, repártela»
también cuando alguien reserva directamente en la página de Calendly, sin pasar
por la web (antes solo avisaba la web). Si la web avisa de la misma reserva,
`avisar_llamada_nueva` no lo repite.

`api.calendly.com` no se alcanza desde el entorno donde se escribió esto: la
forma de los avisos está sacada de la documentación de Calendly y lo puro
tiene test (`test_correo_reserva.py`).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.contactos import agenda as A
from src.services.contactos import reservar as R

logger = logging.getLogger(__name__)

CLAVE = "correo_reserva"
#: El evento de la ficha que dice que ya le llegó (y que no le vuelva a llegar).
TIPO_EVENTO = "correo-reserva"
#: Donde Calendly deja los avisos (público: lo protege la firma).
RUTA_AVISO = "/api/v1/contactos/calendly/aviso"
EVENTOS = ["invitee.created", "invitee.canceled"]
#: Cuánto puede tardar en llegar un aviso firmado (Calendly pide 3 minutos).
TOLERANCIA_SEG = 300
#: Los huecos que se pueden poner en el texto y el asunto.
HUECOS = ("nombre", "dia", "hora", "enlace", "cambiar")
ZONA = ZoneInfo("Europe/Amsterdam")

DE_FABRICA = {
    "asunto": "Un mensaje de Rida antes de tu llamada",
    "texto": (
        "¡Hola, {nombre}!\n\n"
        "Soy Rida Nawar, el fundador de Holandés Nawar.\n\n"
        "Te escribo porque acabas de reservar tu llamada con nuestro equipo para el {dia} a las {hora}.\n\n"
        "Quiero agradecerte de corazón la confianza. Estoy seguro de que la llamada te ayudará a aclarar "
        "un montón tus ideas.\n\n"
        "En mi caso, empezar con el neerlandés nunca fue una decisión, sino una obligación. Me quemaba tener "
        "que depender de otros para las cosas más normales, y probablemente es lo que te pasa a ti también.\n\n"
        "Aquí lo normal es la «drukte», ir siempre con prisas. Por eso estoy deseando que conozcas nuestro "
        "método, pensado para los que siempre dicen «Ik heb het druk» («estoy muy liado»), como era yo.\n\n"
        "En la llamada queremos entender tu situación y decirte con sinceridad si podemos ayudarte. "
        "Si no es para ti, te lo diremos.\n\n"
        "Dos cosas importantes:\n\n"
        "1️⃣ La llamada es por Zoom y el enlace te acaba de llegar por correo. Si no lo encuentras, no pasa "
        "nada: nuestro asesor también te lo mandará por WhatsApp.\n\n"
        "2️⃣ Estate pendiente del teléfono: antes de la llamada te llamaremos para confirmar la cita. Es muy "
        "importante que la confirmes para que no se cancele.\n\n"
        "Un abrazo,\n"
        "Rida Nawar\n"
        "Fundador de Holandés Nawar"
    ),
}

_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


# ── lógica pura (con test) ─────────────────────────────────────────────────


def clave_firma(secreto: str) -> str:
    """La clave con la que Calendly firma los avisos. Sale del secreto de la
    escuela, así que no hay que guardarla en ningún sitio."""
    return hmac.new((secreto or "").encode(), b"calendly-aviso-v1", hashlib.sha256).hexdigest()


def firmar(cuerpo: bytes, clave: str, t: int) -> str:
    """La cabecera `Calendly-Webhook-Signature` que pondría Calendly."""
    firma = hmac.new(clave.encode(), f"{t}.".encode() + cuerpo, hashlib.sha256).hexdigest()
    return f"t={t},v1={firma}"


def firma_valida(cabecera: str, cuerpo: bytes, clave: str, ahora: Optional[float] = None, tolerancia: int = TOLERANCIA_SEG) -> bool:
    """`t=<segundos>,v1=<hmac>`: el HMAC-SHA256 de «t.cuerpo» con la clave, y
    reciente (un aviso viejo reenviado por otro no vale)."""
    if not cabecera or not clave:
        return False
    partes: dict[str, list[str]] = {}
    for trozo in cabecera.split(","):
        k, _, v = trozo.strip().partition("=")
        partes.setdefault(k, []).append(v)
    t = (partes.get("t") or [""])[0]
    if not t.isdigit():
        return False
    ahora = time.time() if ahora is None else ahora
    if abs(ahora - int(t)) > tolerancia:
        return False
    esperada = hmac.new(clave.encode(), f"{t}.".encode() + cuerpo, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(esperada, v) for v in partes.get("v1", []))


def nombre_pila(nombre: str) -> str:
    """«ana lópez» → «Ana»."""
    primero = (nombre or "").strip().split(" ")[0] if (nombre or "").strip() else ""
    return primero[:1].upper() + primero[1:]


def reserva_de(aviso: dict) -> Optional[dict]:
    """Lo que hace falta de un aviso `invitee.created`. None si es otro aviso
    o no trae correo."""
    if not isinstance(aviso, dict) or aviso.get("event") != "invitee.created":
        return None
    p = aviso.get("payload") or {}
    email = str(p.get("email") or "").strip().lower()
    if not email:
        return None
    ev = p.get("scheduled_event") if isinstance(p.get("scheduled_event"), dict) else {}
    ubicacion = ev.get("location") or {}
    enlace = ubicacion.get("join_url") or ""
    if not enlace and str(ubicacion.get("location") or "").startswith("http"):
        enlace = ubicacion["location"]
    telefono = str(p.get("text_reminder_number") or "")
    for qa in p.get("questions_and_answers") or []:
        if "tel" in str(qa.get("question", "")).lower() and qa.get("answer"):
            telefono = telefono or str(qa["answer"])
    nombre = str(p.get("name") or " ".join(x for x in (p.get("first_name"), p.get("last_name")) if x) or "")
    return {
        "email": email,
        "nombre": nombre.strip(),
        "nombre_pila": nombre_pila(str(p.get("first_name") or "") or nombre),
        "telefono": telefono.strip(),
        "inicio": str(ev.get("start_time") or ""),
        "zona": str(p.get("timezone") or ""),
        "enlace": enlace,
        "cambiar": str(p.get("reschedule_url") or ""),
        "tipo_evento": str(ev.get("event_type") or ""),
        "evento": str(ev.get("uri") or p.get("event") or ""),
        # Quién la atiende (con el evento por turnos, el closer que le tocó).
        "anfitrion_email": A.anfitrion_de(ev)[0],
        # Un cambio de hora llega como una reserva nueva que apunta a la vieja.
        "cambio_de_hora": bool(p.get("old_invitee")),
    }


def cuando(inicio: str, zona: str = "") -> tuple[str, str]:
    """(«jueves 30 de octubre», «18:00») en la hora de la persona (la que eligió
    en Calendly); si no se sabe, la de Países Bajos."""
    try:
        d = datetime.fromisoformat(str(inicio).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return "", ""
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    try:
        tz = ZoneInfo(zona) if zona else ZONA
    except Exception:  # noqa: BLE001
        tz = ZONA
    d = d.astimezone(tz)
    return f"{_DIAS[d.weekday()]} {d.day} de {_MESES[d.month - 1]}", d.strftime("%H:%M")


def huecos_que_no_valen(texto: str) -> list[str]:
    """Los {huecos} escritos que no existen: se avisa al guardar, porque si
    no saldrían tal cual en el correo."""
    return sorted({h for h in re.findall(r"\{([^{}]*)\}", texto or "") if h not in HUECOS})


def rellenar(texto: str, valores: dict) -> str:
    """Pone los huecos a mano (sin .format(): unas llaves sueltas en el texto
    no pueden romper el correo). Sin nombre, «¡Hola, {nombre}!» queda «¡Hola!»."""
    salida = texto or ""
    for h in HUECOS:
        salida = salida.replace("{" + h + "}", str(valores.get(h) or ""))
    if not valores.get("nombre"):
        salida = re.sub(r"\s*,\s*(?=[!.:])", "", salida)
    return salida


def valores_de(reserva: dict) -> dict:
    dia, hora = cuando(reserva.get("inicio", ""), reserva.get("zona", ""))
    return {
        "nombre": reserva.get("nombre_pila", ""),
        "dia": dia,
        "hora": hora,
        "enlace": reserva.get("enlace", ""),
        "cambiar": reserva.get("cambiar", ""),
    }


def config_limpia(guardado) -> dict:
    g = guardado if isinstance(guardado, dict) else {}
    asunto = str(g.get("asunto") or "").strip()
    texto = str(g.get("texto") or "").strip()
    return {
        "activo": bool(g.get("activo")),
        "asunto": asunto or DE_FABRICA["asunto"],
        "texto": texto or DE_FABRICA["texto"],
        "cambiado_en": str(g.get("cambiado_en") or ""),
        "por": str(g.get("por") or ""),
    }


# ── la configuración (org_config) ──────────────────────────────────────────


async def _fila(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    q = select(OrganizationConfig)
    if org_id is not None:
        q = q.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


async def leer(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    """Sin `org_id`, la de la escuela (single-tenancy): así lo lee el aviso de
    Calendly, que no sabe de escuelas."""
    fila = await _fila(db_session, org_id)
    guardado = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    return {**config_limpia(guardado), "de_fabrica": DE_FABRICA, "huecos": list(HUECOS)}


async def guardar(org_id: int, datos: dict, quien: str, db_session: AsyncSession) -> dict:
    fila = await _fila(db_session, org_id)
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    actual = config_limpia((fila.config or {}).get(CLAVE) if isinstance(fila.config, dict) else None)
    nuevo = dict(actual)
    if datos.get("asunto") is not None:
        nuevo["asunto"] = str(datos["asunto"]).strip()[:200] or DE_FABRICA["asunto"]
    if datos.get("texto") is not None:
        nuevo["texto"] = str(datos["texto"]).strip()[:6000] or DE_FABRICA["texto"]
    malos = huecos_que_no_valen(nuevo["asunto"] + nuevo["texto"])
    if malos:
        raise ValueError(
            "Estos huecos no existen: " + ", ".join("{" + m + "}" for m in malos)
            + ". Valen: " + ", ".join("{" + h + "}" for h in HUECOS)
        )
    if datos.get("activo") is not None and bool(datos["activo"]) != actual["activo"]:
        nuevo["activo"] = bool(datos["activo"])
        nuevo["cambiado_en"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        nuevo["por"] = (quien or "")[:120]
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = {k: nuevo[k] for k in ("activo", "asunto", "texto", "cambiado_en", "por")}
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer(db_session, org_id)


# ── el correo ──────────────────────────────────────────────────────────────


def armar(reserva: dict, asunto: str, texto: str, *, preview: bool) -> dict:
    """Rellena y lo manda (o lo devuelve, con `preview`)."""
    from src.services.users.emails import send_correo_reserva_email

    valores = valores_de(reserva)
    asunto_final = rellenar(asunto, valores)
    r = send_correo_reserva_email(reserva["email"], asunto_final, rellenar(texto, valores), preview=preview)
    return {"para": reserva["email"], "asunto": asunto_final, "html": (r or {}).get("html", "") if preview else ""}


def reserva_de_ejemplo(email: str, nombre: str = "Ana") -> dict:
    """Para «Ver cómo queda» y «Mandármelo a mí»: el próximo jueves a las 18:00."""
    hoy = datetime.now(ZONA)
    jueves = (hoy + timedelta(days=(3 - hoy.weekday()) % 7 or 7)).replace(hour=18, minute=0, second=0, microsecond=0)
    return {
        "email": email,
        "nombre": nombre,
        "nombre_pila": nombre_pila(nombre),
        "inicio": jueves.isoformat(),
        "zona": "Europe/Amsterdam",
        "enlace": "https://zoom.us/j/0000000000",
        "cambiar": "https://calendly.com/reschedulings/ejemplo",
    }


async def vista(org_id: int, asunto: str, texto: str, db_session: AsyncSession, *, enviar_a: str = "", nombre: str = "") -> dict:
    """El correo con una reserva de ejemplo. Con `enviar_a`, se manda ahí."""
    estado = await leer(db_session, org_id)
    asunto = (asunto or "").strip() or estado["asunto"]
    texto = (texto or "").strip() or estado["texto"]
    malos = huecos_que_no_valen(asunto + texto)
    if malos:
        raise ValueError("Estos huecos no existen: " + ", ".join("{" + m + "}" for m in malos))
    reserva = reserva_de_ejemplo(enviar_a or "ejemplo@ejemplo.com", nombre or "Ana")
    return armar(reserva, asunto, texto, preview=not enviar_a)


# ── los avisos de Calendly ─────────────────────────────────────────────────


def _secreto() -> str:
    from config.config import get_learnhouse_config

    return get_learnhouse_config().security_config.auth_jwt_secret_key or ""


def url_aviso() -> str:
    from src.services.users.emails import _school_url

    return _school_url().rstrip("/") + RUTA_AVISO


def _redis():
    try:
        from src.core.redis import get_redis_client

        return get_redis_client()
    except Exception:  # noqa: BLE001
        return None


_ULTIMO = "calendly:ultimo-aviso"
_FIRMA_MAL = "calendly:firma-mal"


def _apuntar_ultimo(ok: bool, que: str) -> None:
    """El último aviso bueno que llegó (y, aparte, el último con la firma mal),
    para que el panel diga si llegan. En Redis y en blando."""
    r = _redis()
    if r is None:
        return
    try:
        r.set(_ULTIMO if ok else _FIRMA_MAL, json.dumps({"at": datetime.now(timezone.utc).isoformat(), "ok": ok, "que": que}))
    except Exception:  # noqa: BLE001
        pass


def ultimo_aviso() -> Optional[dict]:
    """El último aviso. Uno con la firma mal solo cuenta si es posterior al
    último bueno (al conectar se borra): cualquiera puede llamar a esa
    dirección, y un intento suyo no debe parecer que Calendly falla."""
    r = _redis()
    if r is None:
        return None
    try:
        bueno = json.loads(r.get(_ULTIMO) or "null")
        malo = json.loads(r.get(_FIRMA_MAL) or "null")
    except Exception:  # noqa: BLE001
        return None
    if malo and (not bueno or malo.get("at", "") > bueno.get("at", "")):
        return malo
    return bueno


def _olvidar_firma_mal() -> None:
    r = _redis()
    if r is not None:
        try:
            r.delete(_FIRMA_MAL)
        except Exception:  # noqa: BLE001
            pass


async def _yo(cliente) -> dict:
    return (await R._pedir(cliente, "GET", f"{A.API}/users/me")).get("resource") or {}


async def _nuestras(cliente, yo: dict) -> list[dict]:
    """Las suscripciones de Calendly que avisan a esta escuela, de la
    organización y del usuario."""
    url = url_aviso()
    salida: list[dict] = []
    for alcance in ("organization", "user"):
        params = {"organization": yo.get("current_organization", ""), "scope": alcance, "count": 100}
        if alcance == "user":
            params["user"] = yo.get("uri", "")
        try:
            datos = await R._pedir(cliente, "GET", f"{A.API}/webhook_subscriptions", params=params)
        except R.FalloCalendly as exc:
            # Sin permiso para ver las de la organización: solo las suyas.
            if alcance == "organization" and exc.codigo in (400, 403, 404):
                continue
            raise
        salida += [s for s in datos.get("collection") or [] if str(s.get("callback_url") or "").rstrip("/") == url]
    return salida


async def estado_conexion() -> dict:
    """¿Avisa Calendly a la escuela? Falla en blando: lo dice y ya."""
    if not A._token():
        return {"conectado": False, "motivo": "Falta el token de Calendly (LEARNHOUSE_CALENDLY_TOKEN en Railway)."}
    try:
        async with R._cliente() as cliente:
            nuestras = await _nuestras(cliente, await _yo(cliente))
    except R.FalloCalendly as e:
        return {"conectado": False, "motivo": f"Calendly dijo: {e.motivo}", "plan": e.codigo == 403}
    except Exception as e:  # noqa: BLE001
        return {"conectado": False, "motivo": f"Calendly no contesta: {e}"}
    if not nuestras:
        return {"conectado": False, "motivo": "Calendly todavía no avisa a la escuela de las reservas."}
    activas = [s for s in nuestras if (s.get("state") or "active") == "active"]
    if not activas:
        return {
            "conectado": False,
            "motivo": "Calendly tiene el aviso desactivado (suele pasar si la escuela no contestó durante un tiempo). Vuelve a conectar.",
        }
    # «user» = solo avisa de las reservas del usuario del token. Con varios
    # closers en Calendly, hay que volver a conectar para que avise de todas.
    alcance = "organization" if any(s.get("scope") == "organization" for s in activas) else "user"
    return {"conectado": True, "motivo": "", "alcance": alcance}


async def conectar(forzar: bool = False) -> dict:
    """Le pide a Calendly que avise a la escuela de cada reserva. Con `forzar`
    (o si la que había está desactivada), borra la vieja y crea otra: así
    vale también después de cambiar el secreto de la escuela."""
    if not A._token():
        return {"conectado": False, "motivo": "Falta el token de Calendly (LEARNHOUSE_CALENDLY_TOKEN en Railway)."}
    try:
        async with R._cliente() as cliente:
            yo = await _yo(cliente)
            nuestras = await _nuestras(cliente, yo)
            if nuestras and not forzar and any((s.get("state") or "active") == "active" for s in nuestras):
                return {"conectado": True, "motivo": ""}
            for s in nuestras:
                await R._pedir(cliente, "DELETE", str(s.get("uri")))
            base = {"url": url_aviso(), "events": EVENTOS, "signing_key": clave_firma(_secreto())}
            # De toda la organización (los dos closers) si el token puede;
            # si no, del usuario, como antes.
            try:
                await R._pedir(
                    cliente, "POST", f"{A.API}/webhook_subscriptions",
                    json={**base, "organization": yo.get("current_organization", ""), "scope": "organization"},
                )
            except R.FalloCalendly as exc:
                if exc.codigo not in (400, 403, 404):
                    raise
                await R._pedir(
                    cliente, "POST", f"{A.API}/webhook_subscriptions",
                    json={**base, "organization": yo.get("current_organization", ""), "user": yo.get("uri", ""), "scope": "user"},
                )
    except R.FalloCalendly as e:
        return {"conectado": False, "motivo": f"Calendly dijo: {e.motivo}", "plan": e.codigo == 403}
    except Exception as e:  # noqa: BLE001
        logger.exception("No se pudo conectar el aviso de Calendly")
        return {"conectado": False, "motivo": f"Calendly no contesta: {e}"}
    _olvidar_firma_mal()
    return {"conectado": True, "motivo": ""}


_tipo_cache: dict = {"uris": set(), "hasta": 0.0}


async def _tipos_de_llamada() -> set[str]:
    """Las direcciones de los eventos que son la llamada (una hora en
    memoria): el por turnos, el enlace de cada closer y el viejo."""
    if _tipo_cache["uris"] and _tipo_cache["hasta"] > time.time():
        return _tipo_cache["uris"]
    async with R._cliente() as cliente:
        uris = R.tipos_de_llamada(await R._tipos(cliente), R._preferido())
    _tipo_cache.update(uris=uris, hasta=time.time() + 3600)
    return uris


def calendly_avisa(dias: int = 14) -> bool:
    """¿Llegó un aviso bueno de Calendly en los últimos días? Si es así, el
    aviso de la web (`reunion`) no manda el «repártela»: lo manda este, que
    sabe a qué closer se la dio Calendly (y no lo manda si ya tiene)."""
    ultimo = ultimo_aviso() or {}
    if not ultimo.get("ok"):
        return False
    try:
        cuando_ = datetime.fromisoformat(str(ultimo.get("at") or "").replace("Z", "+00:00"))
    except ValueError:
        return False
    if cuando_.tzinfo is None:
        cuando_ = cuando_.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - cuando_ <= timedelta(days=dias)


async def _completar(reserva: dict) -> dict:
    """Si el aviso no trae la cita dentro (día, evento), se le pide a Calendly."""
    # El aviso trae la cita entera (con `event_memberships`, el anfitrión):
    # solo se pide a Calendly si le falta el día o el evento.
    if reserva.get("inicio") and reserva.get("tipo_evento"):
        return reserva
    uri = reserva.get("evento") or ""
    if not uri.startswith("http"):
        return reserva
    async with R._cliente() as cliente:
        ev = (await R._pedir(cliente, "GET", uri)).get("resource") or {}
    ubicacion = ev.get("location") or {}
    return {
        **reserva,
        "inicio": reserva.get("inicio") or str(ev.get("start_time") or ""),
        "tipo_evento": reserva.get("tipo_evento") or str(ev.get("event_type") or ""),
        "enlace": reserva.get("enlace") or str(ubicacion.get("join_url") or ""),
        "anfitrion_email": reserva.get("anfitrion_email") or A.anfitrion_de(ev)[0],
    }


def _cuando_corto(inicio: str) -> str:
    """«jue 30 oct · 18:00» en hora de Países Bajos, para el correo al equipo."""
    try:
        d = datetime.fromisoformat(str(inicio).replace("Z", "+00:00")).astimezone(ZONA)
    except (TypeError, ValueError):
        return ""
    dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
    return f"{dias[d.weekday()]} {d.day} {_MESES[d.month - 1][:3]} · {d.strftime('%H:%M')}"


async def _avisar_reparto(reserva: dict, db_session: AsyncSession) -> None:
    """El «llamada nueva, repártela» también para quien reserva directamente
    en Calendly. Si la web ya avisó de esta reserva, `avisar_llamada_nueva`
    no lo repite. Si Calendly se la dio a un closer (evento por turnos), la
    tarjeta pasa a ser suya y no se manda nada: Calendly ya le avisó a él."""
    from src.services.crm.systeme import marcar_llamada_reservada
    from src.services.panel.reparto import asignar_por_anfitrion, avisar_llamada_nueva

    # La reserva hecha directamente en Calendly también saca a la persona de
    # las campañas de systeme.io.
    marcar_llamada_reservada(reserva.get("email") or "", reserva.get("nombre") or "")
    if await asignar_por_anfitrion(reserva.get("email") or "", reserva.get("anfitrion_email") or "", db_session):
        return
    try:
        telefono = reserva.get("telefono") or ""
        if not telefono:
            telefono = (await R.telefonos_por_email({reserva["email"]}, db_session)).get(reserva["email"], "")
        await avisar_llamada_nueva(
            {
                "nombre": reserva.get("nombre") or "",
                "email": reserva["email"],
                "telefono": telefono,
                "cuando": _cuando_corto(reserva.get("inicio", "")),
            },
            db_session,
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar al equipo de la reserva de Calendly")


async def mandar_una_vez(reserva: dict, estado: dict, db_session: AsyncSession) -> str:
    """El correo de Rida, una vez por persona. Devuelve qué pasó."""
    from src.db.contact_event import ContactEvent

    email = reserva["email"]
    r = _redis()
    if r is not None:
        try:
            # Dos avisos de la misma reserva a la vez: solo pasa uno.
            if not r.set(f"correo-reserva:{email}", "1", nx=True, ex=600):
                return "en-curso"
        except Exception:  # noqa: BLE001
            pass

    ya = (
        await db_session.execute(
            select(ContactEvent.id).where(ContactEvent.email == email, ContactEvent.kind == TIPO_EVENTO).limit(1)
        )
    ).first()
    if ya:
        return "ya-lo-tenia"

    partes = (reserva.get("nombre") or "").split(" ", 1)
    marca = ContactEvent(
        email=email,
        kind=TIPO_EVENTO,
        first_name=partes[0][:120],
        last_name=(partes[1] if len(partes) > 1 else "")[:120],
        phone=(reserva.get("telefono") or "")[:40],
        source="calendly",
        extra=json.dumps({"inicio": reserva.get("inicio", ""), "evento": reserva.get("evento", "")}),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db_session.add(marca)
    await db_session.commit()
    try:
        armar(reserva, estado["asunto"], estado["texto"], preview=False)
    except Exception:
        # Sin correo, sin marca: el reintento de Calendly lo vuelve a intentar.
        await db_session.delete(marca)
        await db_session.commit()
        if r is not None:
            try:
                r.delete(f"correo-reserva:{email}")
            except Exception:  # noqa: BLE001
                pass
        raise
    return "enviado"


async def atender_aviso(cuerpo: bytes, cabecera: str, db_session: AsyncSession) -> str:
    """Lo que hace la escuela con un aviso de Calendly. Devuelve qué pasó;
    lanza PermissionError si la firma no vale (→ 401) y cualquier otro error si
    hay que reintentar (→ 503: Calendly lo vuelve a mandar)."""
    if not firma_valida(cabecera, cuerpo, clave_firma(_secreto())):
        _apuntar_ultimo(False, "La firma no cuadra")
        raise PermissionError("Firma no válida")
    try:
        aviso = json.loads(cuerpo or b"{}")
    except ValueError:
        return "ignorado"
    _apuntar_ultimo(True, str(aviso.get("event") or "") if isinstance(aviso, dict) else "")
    reserva = reserva_de(aviso)
    if reserva is None:
        return "ignorado"
    if reserva["cambio_de_hora"]:
        return "cambio-de-hora"
    reserva = await _completar(reserva)
    # (Después de `_completar`, que trae la hora si el aviso no la traía.)
    # Un cambio de hora hecho desde la escuela (31/10, `reservar.cambiar_hora`)
    # llega como una reserva nueva, sin `old_invitee`: tampoco se repite nada.
    if await R.lo_cambio_el_equipo(reserva["email"], reserva.get("inicio") or "", db_session):
        return "cambio-de-hora"
    tipos = await _tipos_de_llamada()
    if tipos and reserva.get("tipo_evento") and reserva["tipo_evento"] not in tipos:
        return "otro-evento"

    await _avisar_reparto(reserva, db_session)

    estado = await leer(db_session)
    if not estado["activo"]:
        return "apagado"
    return await mandar_una_vez(reserva, estado, db_session)

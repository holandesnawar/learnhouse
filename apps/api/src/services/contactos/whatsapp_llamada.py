"""
Los tres WhatsApp de cada llamada, en orden (02/11/2026).

Pedido del usuario: "que desde el CRM sea más fácil el orden por el que se
envían los recordatorios":

1. **Presentarte** (en cuanto reserva): «Hola Ana, soy Diego, de Holandés
   Nawar. Vi que tienes una llamada agendada mañana a las 18:00. En ella vamos
   a conocer tu situación… Es por Google Meet: unas horas antes te mando el
   enlace.»
2. **El método en PDF** (después, mejor la víspera): «Hola Ana, soy Diego otra
   vez. Te quería mandar nuestro método en PDF para que le eches un vistazo
   antes de la llamada: <enlace al PDF>».
3. **El enlace** (unas horas antes, 3 de serie): «¡Hola Ana! Nuestra llamada
   es en 3 horas, a las 18:00. Te dejo por aquí el enlace para entrar:
   <meet.google.com/…>».

Siguen sin mandarse solos (eso pediría la API de WhatsApp Business: se decidió
el 27/10 que el seteo lo haga el closer a mano). Lo que hace la escuela:

- Los textos, uno por paso, iguales para todo el equipo (org_config
  `whatsapp_llamada`). Firman con el nombre de quien los manda (`{yo}`), así
  que no hace falta uno por persona. Lo editan el administrador y el closer,
  como el guion. Un texto igual al de fábrica no se guarda: si mañana cambia
  el de fábrica, cambia también para la escuela.
- El PDF del método: se sube aquí y la escuela lo sirve en una dirección
  pública con nombre de archivo (`/api/v1/contactos/metodo/<org>/Metodo-…pdf`),
  la que va en el mensaje. Es material de venta: público a propósito. Vive en
  `content/privado/whatsapp/<org>/` (dentro del volumen: entra en la copia;
  `/content` nunca sirve `privado/`, solo esta ruta, y solo ese archivo). Si
  no se sube, vale un enlace pegado (Drive, la web…).
- Qué paso se ha mandado de cada cita: un evento de contacto
  (`kind = "whatsapp-llamada"`, el id de la cita de Calendly y el paso en
  `extra`), uno por cita y paso. Se apunta al pulsar el botón (abrir WhatsApp
  es la señal: desde aquí no se puede saber si luego pulsó «enviar»), y se
  quita con «No lo envié». Sale en la línea de tiempo de su ficha.
- El orden y cuándo toca cada uno los calcula la pantalla
  (`lib/nawar/recordatorioLlamada.ts`, con test): aquí solo se guarda.

El enlace de Google Meet sale de la cita de Calendly (`agenda.py`,
`location.join_url`): con Calendly Teams cada closer lleva su Meet, y la
escuela lo une a la persona por el correo de la reserva.
"""

import json
import re
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent
from src.db.organization_config import OrganizationConfig

KIND = "whatsapp-llamada"
CLAVE = "whatsapp_llamada"

PASOS: list[dict] = [
    {"id": "presentacion", "numero": 1, "nombre": "Presentarte", "cuando": "En cuanto reserva"},
    {"id": "recurso", "numero": 2, "nombre": "El método en PDF", "cuando": "Después del primero, mejor la víspera"},
    {"id": "enlace", "numero": 3, "nombre": "El enlace de la llamada", "cuando": "Unas horas antes"},
]
IDS = [p["id"] for p in PASOS]

DE_FABRICA: dict[str, str] = {
    "presentacion": (
        "Hola {nombre}, soy {yo}, de Holandés Nawar 😊\n\n"
        "Vi que tienes una llamada agendada con nosotros {dia} a las {hora}. En ella vamos a conocer tu situación: "
        "para qué necesitas el neerlandés, cómo vas ahora y qué te gustaría conseguir. Y te contamos cómo te "
        "podemos ayudar.\n\n"
        "La llamada es por Google Meet. Unas horas antes te mando por aquí el enlace para entrar.\n\n"
        "¿Me confirmas que te viene bien esa hora?"
    ),
    "recurso": (
        "Hola {nombre}, soy {yo} otra vez 👋\n\n"
        "Te quería mandar nuestro método en PDF, para que le eches un vistazo antes de la llamada:\n\n"
        "{pdf}\n\n"
        "Así {dia} vamos directos a lo que más te interesa."
    ),
    "enlace": (
        "¡Hola {nombre}! Nuestra llamada es {falta}, a las {hora}.\n\n"
        "Te dejo por aquí el enlace para entrar: {enlace}\n\n"
        "Nos vemos ahí 🙌"
    ),
}

#: Los huecos que entiende la pantalla. Uno mal escrito no deja guardar: si
#: no, saldría tal cual («{Nombre}») en el WhatsApp de alguien.
HUECOS = ("nombre", "yo", "dia", "hora", "falta", "enlace", "pdf", "cuando")

HORAS_ANTES = 3
MAX_PDF = 25 * 1024 * 1024
CONTENT_DIR = Path("content")
CARPETA = "privado/whatsapp"
NOMBRE_PUBLICO = "Metodo-Holandes-Nawar.pdf"


class WhatsAppError(Exception):
    pass


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extra(texto: str) -> dict:
    try:
        d = json.loads(texto) if texto else {}
        return d if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def huecos_que_no_valen(texto: str) -> list[str]:
    malos: list[str] = []
    for h in re.findall(r"\{([^{}]*)\}", texto or ""):
        if h not in HUECOS and h not in malos:
            malos.append(h)
    return malos


def config_limpia(guardado: Optional[dict]) -> dict:
    """Lo guardado, con todo en su sitio. Función pura."""
    g = guardado if isinstance(guardado, dict) else {}
    textos_g = g.get("textos") if isinstance(g.get("textos"), dict) else {}
    textos = {i: str(textos_g.get(i) or "").strip()[:4000] for i in IDS}
    try:
        horas = int(g.get("horas_antes") or HORAS_ANTES)
    except (TypeError, ValueError):
        horas = HORAS_ANTES
    return {
        "textos": {i: t for i, t in textos.items() if t and t != DE_FABRICA[i]},
        "pdf": str(g.get("pdf") or ""),
        "pdf_nombre": str(g.get("pdf_nombre") or "")[:200],
        "pdf_subido_en": str(g.get("pdf_subido_en") or ""),
        "pdf_enlace": str(g.get("pdf_enlace") or "").strip()[:500],
        "horas_antes": min(max(horas, 1), 12),
    }


def ruta_pdf(relativa: str) -> Optional[Path]:
    """El PDF en disco, solo si está dentro de privado/whatsapp/."""
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith(CARPETA + "/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


def url_publica(org_id: int) -> str:
    from src.services.users.emails import _school_url

    return f"{_school_url()}/api/v1/contactos/metodo/{org_id}/{NOMBRE_PUBLICO}"


def para_la_pantalla(org_id: int, cfg: dict) -> dict:
    """Lo que necesita la pantalla: cada paso con su texto (el guardado o el
    de fábrica) y el PDF que va en el mensaje 2. Función pura salvo la URL."""
    subido = bool(cfg.get("pdf"))
    return {
        "pasos": [
            {
                **p,
                "texto": cfg["textos"].get(p["id"]) or DE_FABRICA[p["id"]],
                "de_fabrica": p["id"] not in cfg["textos"],
            }
            for p in PASOS
        ],
        "fabrica": dict(DE_FABRICA),
        "huecos": list(HUECOS),
        "horas_antes": cfg["horas_antes"],
        # El que va en el mensaje: el subido manda sobre el pegado.
        "pdf": url_publica(org_id) if subido else cfg["pdf_enlace"],
        "pdf_subido": subido,
        "pdf_nombre": cfg["pdf_nombre"],
        "pdf_subido_en": cfg["pdf_subido_en"],
        "pdf_enlace": cfg["pdf_enlace"],
    }


async def _fila(org_id: int, db_session: AsyncSession) -> Optional[OrganizationConfig]:
    return (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()


async def leer(org_id: int, db_session: AsyncSession) -> dict:
    fila = await _fila(org_id, db_session)
    guardado = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    return config_limpia(guardado)


async def _escribir(org_id: int, cfg: dict, db_session: AsyncSession) -> None:
    fila = await _fila(org_id, db_session)
    if fila is None:
        raise WhatsAppError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = cfg
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()


async def guardar(org_id: int, cambios: dict, db_session: AsyncSession) -> dict:
    """`textos` ({paso: texto}; vacío = el de fábrica), `pdf_enlace` y
    `horas_antes`. Lo que no venga se queda como estaba."""
    actual = await leer(org_id, db_session)
    nuevo = dict(actual)
    if isinstance(cambios.get("textos"), dict):
        textos = dict(actual["textos"])
        for i in IDS:
            if i in cambios["textos"]:
                textos[i] = str(cambios["textos"][i] or "").strip()
        malos = huecos_que_no_valen("".join(textos.values()))
        if malos:
            raise WhatsAppError(
                "Estos huecos no existen: " + ", ".join("{" + m + "}" for m in malos)
                + ". Valen: " + ", ".join("{" + h + "}" for h in HUECOS)
            )
        nuevo["textos"] = textos
    if "pdf_enlace" in cambios:
        enlace = str(cambios.get("pdf_enlace") or "").strip()
        if enlace and not re.match(r"^https?://", enlace):
            raise WhatsAppError("El enlace del PDF tiene que empezar por https://")
        nuevo["pdf_enlace"] = enlace
    if "horas_antes" in cambios:
        nuevo["horas_antes"] = cambios.get("horas_antes")
    limpio = config_limpia(nuevo)
    await _escribir(org_id, limpio, db_session)
    return para_la_pantalla(org_id, limpio)


async def guardar_pdf(org_id: int, nombre: str, datos: bytes, db_session: AsyncSession) -> dict:
    if not datos:
        raise WhatsAppError("El archivo está vacío")
    if len(datos) > MAX_PDF:
        raise WhatsAppError("El PDF pesa demasiado (máximo 25 MB): por WhatsApp, cuanto más ligero, mejor")
    if not datos.startswith(b"%PDF"):
        raise WhatsAppError("Eso no es un PDF")
    relativa = f"{CARPETA}/{org_id}/{_uuid.uuid4().hex}.pdf"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    actual = await leer(org_id, db_session)
    viejo = ruta_pdf(actual.get("pdf") or "")
    actual.update(pdf=relativa, pdf_nombre=(nombre or "metodo.pdf")[:200], pdf_subido_en=_ahora())
    await _escribir(org_id, config_limpia(actual), db_session)
    if viejo and viejo.is_file() and viejo != ruta.resolve():
        try:
            viejo.unlink()
        except OSError:
            pass
    return para_la_pantalla(org_id, config_limpia(actual))


async def quitar_pdf(org_id: int, db_session: AsyncSession) -> dict:
    actual = await leer(org_id, db_session)
    viejo = ruta_pdf(actual.get("pdf") or "")
    actual.update(pdf="", pdf_nombre="", pdf_subido_en="")
    await _escribir(org_id, config_limpia(actual), db_session)
    if viejo and viejo.is_file():
        try:
            viejo.unlink()
        except OSError:
            pass
    return para_la_pantalla(org_id, config_limpia(actual))


async def pdf_publico(org_id: int, db_session: AsyncSession) -> Optional[Path]:
    ruta = ruta_pdf((await leer(org_id, db_session)).get("pdf") or "")
    return ruta if ruta and ruta.is_file() else None


# ── Qué se ha mandado de cada cita ──────────────────────────────────────────


def enviados_de_fichas(fichas: Iterable[dict]) -> dict[str, set[str]]:
    """{cita_id: {pasos}} a partir de los eventos de las fichas (las de
    `fusionar_contactos`). Función pura: la usa el tablero."""
    salida: dict[str, set[str]] = {}
    for f in fichas or []:
        for e in f.get("eventos") or []:
            if e.get("kind") == KIND:
                extra = e.get("extra") or {}
                cid, paso = str(extra.get("cita_id") or ""), str(extra.get("paso") or "")
                if cid and paso in IDS:
                    salida.setdefault(cid, set()).add(paso)
    return salida


async def _filas(db_session: AsyncSession) -> list[ContactEvent]:
    return list((await db_session.execute(select(ContactEvent).where(ContactEvent.kind == KIND))).scalars().all())


async def enviados(db_session: AsyncSession) -> dict[str, dict[str, dict]]:
    """{cita_id: {paso: {"autor", "cuando"}}} de todas las citas."""
    salida: dict[str, dict[str, dict]] = {}
    for f in await _filas(db_session):
        extra = _extra(f.extra)
        cid, paso = str(extra.get("cita_id") or ""), str(extra.get("paso") or "")
        if cid and paso in IDS:
            salida.setdefault(cid, {})[paso] = {"autor": extra.get("autor") or "", "cuando": f.created_at or ""}
    return salida


async def marcar(cita_id: str, email: str, paso: str, inicio: str, autor: str, db_session: AsyncSession) -> dict:
    clave = (email or "").strip().lower()
    cita_id = (cita_id or "").strip()
    if paso not in IDS:
        return {"ok": False, "motivo": "Ese mensaje no existe"}
    if not cita_id or "@" not in clave:
        return {"ok": False, "motivo": "Falta la cita o el correo"}
    filas = [
        f for f in await _filas(db_session)
        if str(_extra(f.extra).get("cita_id") or "") == cita_id and _extra(f.extra).get("paso") == paso
    ]
    fila = filas[0] if filas else ContactEvent(email=clave, kind=KIND)
    for sobra in filas[1:]:
        await db_session.delete(sobra)
    fila.email = clave
    fila.source = "equipo"
    fila.extra = json.dumps(
        {"cita_id": cita_id, "paso": paso, "inicio": (inicio or "")[:40], "autor": (autor or "")[:120]},
        ensure_ascii=False,
    )
    fila.created_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "paso": paso, "enviado": {"autor": (autor or "")[:120], "cuando": fila.created_at}}


async def desmarcar(cita_id: str, paso: str, db_session: AsyncSession) -> dict:
    cita_id = (cita_id or "").strip()
    if not cita_id or paso not in IDS:
        return {"ok": False, "motivo": "Falta la cita o el mensaje"}
    n = 0
    for f in await _filas(db_session):
        extra = _extra(f.extra)
        if str(extra.get("cita_id") or "") == cita_id and extra.get("paso") == paso:
            await db_session.delete(f)
            n += 1
    await db_session.commit()
    return {"ok": True, "quitados": n}


def texto_linea_de_tiempo(extra: dict, dia_y_hora) -> str:
    """«Diego le mandó el WhatsApp 2 de 3 («El método en PDF») de su llamada
    del jue 6 nov, 18:00». `dia_y_hora` es el formateador de contactos.py."""
    paso = next((p for p in PASOS if p["id"] == extra.get("paso")), None)
    quien = extra.get("autor") or "El equipo"
    texto = f"{quien} le mandó el WhatsApp"
    if paso:
        texto += f" {paso['numero']} de {len(PASOS)} («{paso['nombre']}»)"
    cuando = dia_y_hora(extra.get("inicio") or "")
    return texto + (f" de su llamada del {cuando}" if cuando else "")

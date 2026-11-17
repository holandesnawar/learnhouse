"""
La analítica de las webs, en Panel → Web → Analítica (17/11/2026).

Pedido del usuario: "ver las analíticas más importantes de las webs dentro
del panel… filtrar y ver de dónde viene x tráfico, cuántos leads se
convirtieron por paid vs orgánico, quién agendó llamada gracias a qué utm…
que esté bien hecho". Y la campaña de Black Friday como filtro (el
subdominio blackfriday.holandesnawar.com).

Por qué NO Google Analytics: no une la visita con la persona (diría "120
visitas de Instagram", nunca "Ana llegó por Instagram, reservó y pagó") y,
desde el aviso de cookies del 10/11, solo cuenta a quien pulsa «Aceptar».

Dos unidades que no se mezclan:

1. **Visitas** (`web_visita`, una fila por sesión del navegador, sin datos
   personales): las manda `nawar-web/src/lib/visitas.ts` desde el Layout de
   TODAS las páginas, también las del subdominio de Black Friday. Se cuentan
   desde el día que se encendió (no hay visitas de antes).
2. **Personas** (las fichas de Contactos, `fusionar_contactos`): quien dejó
   sus datos en el periodo (cohorte: entró entre esas fechas) y, de ellas,
   cuántas reservaron llamada, cuántas se presentaron y cuántas pagaron, AUNQUE
   lo hicieran después. Así cada % es sobre la misma gente y no se descuadra.

**De dónde viene cada uno** (`clasificar`, pura): el canal (anuncio de pago u
orgánico), la fuente (Meta · anuncios, Instagram, Google, Correo, Web propia,
Otras webs, Directo…), la campaña (`utm_campaign`; lo de Black Friday se junta
en `black-friday` aunque llegue sin campaña, por el subdominio o por sus
páginas) y el anuncio (`utm_content`, con el nombre de la escuela si se le
puso uno en Panel → Anuncios). La misma función para visitas y personas: así
la columna de visitas y la de leads hablan de lo mismo.

**A quién se le da el mérito** de una persona que llegó varias veces
(`toque_de`, pura), a elegir en la pantalla:
- `ficha` (de serie): como la etiqueta «Ads» / «Orgánico» de la ficha. Si un
  anuncio la trajo alguna vez, el anuncio; si no, la primera vez que se sabe.
- `primera`: la primera vez que se sabe de dónde vino.
- `ultima`: lo último que se sabe ANTES de reservar la llamada (o de pagar).

Quien reserva directo en Calendly (el enlace de un setter, sin pasar por la
web) entra por la campaña que Calendly guarda de su enlace (`tracking`, la
lee `agenda.cita_desde_calendly`).

Quien está fuera de los números (`metric_exclusion`) no cuenta en nada.
`calcular` es pura (con test, `test_analitica.py`); `analitica` reúne los datos.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Optional
from urllib.parse import unquote
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

ZONA = ZoneInfo("Europe/Amsterdam")

#: Desde cuándo se cuentan las visitas de toda la web.
VISITAS_DESDE = "2026-11-17"

# ── leer lo que manda la web ────────────────────────────────────────────────

_SESION = re.compile(r"^[A-Za-z0-9_-]{8,40}$")
_BOT = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|python|curl|wget|httpclient|monitor|scan",
    re.I,
)
_MAX_PAGINAS = 30


def _corto(valor: Any, largo: int = 120) -> str:
    return str(valor or "").strip()[:largo]


def ruta_logica(host: str, ruta: str) -> str:
    """La página como la ve la web. En el subdominio de Black Friday las
    páginas viven en la raíz (/, /ebook…) pero son las de /black-friday/…
    (igual que `rutaDeLaPagina` de nawar-web). Sin la barra del final."""
    ruta = "/" + (ruta or "").split("?")[0].split("#")[0].strip().lstrip("/")
    ruta = re.sub(r"/{2,}", "/", ruta)
    if len(ruta) > 1:
        ruta = ruta.rstrip("/")
    ruta = ruta.lower()[:200]
    if (host or "").startswith("blackfriday.") and not ruta.startswith("/black-friday"):
        ruta = "/black-friday" if ruta == "/" else f"/black-friday{ruta}"
    return ruta


def leer_visita(datos: dict, user_agent: str = "") -> Optional[dict]:
    """Lo que manda la web, validado. None si no vale (un bot, otra web, una
    sesión mal escrita): se ignora sin error, es un contador."""
    if _BOT.search(user_agent or ""):
        return None
    sesion = str(datos.get("s") or "")
    host = _corto(datos.get("h"), 60).lower()
    if not _SESION.match(sesion) or not (host == "holandesnawar.com" or host.endswith(".holandesnawar.com")):
        return None
    referrer = _corto(datos.get("ref"), 120).lower()
    if "holandesnawar" in referrer:
        referrer = ""
    try:
        ancho = int(float(datos.get("w") or 0))
    except (TypeError, ValueError):
        ancho = 0
    return {
        "sesion": sesion,
        "host": host,
        "pagina": ruta_logica(host, str(datos.get("r") or "/")),
        "referrer": referrer.removeprefix("www."),
        "dispositivo": "" if ancho <= 0 else ("movil" if ancho < 768 else "ordenador"),
        **{c: _corto(datos.get(c)) for c in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")},
    }


def aplicar_visita(fila: Any, visita: dict, ahora: str) -> None:
    """Suma una página a la sesión. La campaña y la web de origen son las de la
    primera página que las trae."""
    try:
        paginas = json.loads(fila.paginas or "[]")
        if not isinstance(paginas, list):
            paginas = []
    except ValueError:
        paginas = []
    if visita["pagina"] not in paginas and len(paginas) < _MAX_PAGINAS:
        paginas.append(visita["pagina"])
    fila.paginas = json.dumps(paginas)
    fila.vistas = int(fila.vistas or 0) + 1
    if not fila.entrada:
        fila.entrada = visita["pagina"]
    if not fila.host:
        fila.host = visita["host"]
    if not fila.referrer and visita["referrer"]:
        fila.referrer = visita["referrer"]
    if not fila.dispositivo and visita["dispositivo"]:
        fila.dispositivo = visita["dispositivo"]
    if not (fila.utm_source or fila.utm_medium or fila.utm_campaign) and (
        visita["utm_source"] or visita["utm_medium"] or visita["utm_campaign"]
    ):
        for c in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"):
            setattr(fila, c, visita[c])
    fila.updated_at = ahora


async def apuntar_visita(datos: dict, user_agent: str, db_session: AsyncSession) -> bool:
    from sqlalchemy.exc import IntegrityError

    from src.db.web_visita import WebVisita

    visita = leer_visita(datos, user_agent)
    if visita is None:
        return False
    ahora = datetime.now(timezone.utc).isoformat()

    async def buscar():
        return (
            await db_session.execute(select(WebVisita).where(WebVisita.sesion == visita["sesion"]))
        ).scalars().first()

    fila = await buscar()
    if fila is None:
        fila = WebVisita(sesion=visita["sesion"], dia=datetime.now(ZONA).strftime("%Y-%m-%d"), created_at=ahora)
        aplicar_visita(fila, visita, ahora)
        db_session.add(fila)
        try:
            await db_session.commit()
            return True
        except IntegrityError:
            # Dos páginas de la misma sesión a la vez: la otra ya creó la fila.
            await db_session.rollback()
            fila = await buscar()
            if fila is None:
                return False
    aplicar_visita(fila, visita, ahora)
    db_session.add(fila)
    await db_session.commit()
    return True


# ── de dónde viene cada uno ─────────────────────────────────────────────────

_MEDIOS_DE_PAGO = {"paid", "cpc", "ppc", "ads", "paid_social", "paidsocial", "paid-social", "cpm"}
_META = {"facebook", "fb", "instagram", "ig", "meta", "an", "audience_network"}
#: Las páginas a las que solo se llega desde un anuncio (rutas de la web y
#: marcas del recorrido, `nawar-web/src/lib/recorrido.ts`).
_RUTAS_DE_ANUNCIO = ("/formacion-nawar-fb", "/black-friday/ebook-ads", "/formacion/v2")
_MARCAS_DE_ANUNCIO = {"anuncio-fb", "landing-metodo", "bf-ebook-ads"}
_REDES = {
    "instagram": "Instagram", "ig": "Instagram", "inro": "Instagram", "facebook": "Facebook", "fb": "Facebook",
    "meta": "Facebook", "tiktok": "TikTok", "youtube": "YouTube", "yt": "YouTube", "whatsapp": "WhatsApp",
    "wa": "WhatsApp", "google": "Google", "bing": "Bing", "chatgpt": "ChatGPT", "email": "Correo",
    "mail": "Correo", "correo": "Correo", "newsletter": "Correo", "systeme": "Correo", "web": "Web propia",
    "nawar": "Web propia", "escuela": "Web propia", "linkedin": "LinkedIn", "telegram": "Telegram",
}
_WEBS = (
    ("instagram", "Instagram"), ("facebook", "Facebook"), ("fb.", "Facebook"), ("tiktok", "TikTok"),
    ("youtube", "YouTube"), ("youtu.be", "YouTube"), ("whatsapp", "WhatsApp"), ("wa.me", "WhatsApp"),
    ("google", "Google"), ("bing", "Bing"), ("chatgpt", "ChatGPT"), ("openai", "ChatGPT"),
    ("perplexity", "Perplexity"), ("linkedin", "LinkedIn"), ("t.me", "Telegram"),
    ("mail.", "Correo"), ("outlook", "Correo"), ("systeme", "Correo"),
)
#: Lo que hace el equipo o la escuela, no la persona: no dice por dónde llegó.
_NO_DICEN = {
    "datos-editados", "enlace-pago", "llamada-equipo", "alta-manual", "pago", "senal", "correo-reserva",
    "llamada-confirmada", "whatsapp-llamada", "llamada-cambiada", "llamada-cancelada", "check-in", "correo-bf",
    "baja-bf", "intento-contacto",
}
#: Lo que manda la escuela: no es que la persona llegara ese día.
_DE_LA_ESCUELA = {"correo-bf", "whatsapp-llamada", "datos-editados", "intento-contacto", "llamada-confirmada", "check-in", "baja-bf"}
_TIPOS_BF = {"bf-lista", "ebook", "ebook-empezado"}
_RESERVA = {"reunion", "llamada-equipo", "correo-reserva"}
#: Se presentó a la llamada (los resultados de «¿Qué pasó?» menos «No vino»).
VINO = {"pagado", "compra", "piensa", "no-encaja"}

BLACK_FRIDAY = "black-friday"
FUENTE_DIRECTO = "Directo"


def limpiar(texto: str) -> str:
    t = (texto or "").strip()
    for _ in range(2):
        if not re.search(r"%[0-9A-Fa-f]{2}", t):
            break
        t = unquote(t)
    t = re.sub(r"\s+", " ", t).strip()
    return "" if "{{" in t else t


def campana_de(utm_campaign: str) -> str:
    c = limpiar(utm_campaign).lower()
    if re.search(r"black.?friday", c) or c == "bf" or c.startswith(("bf-", "bf_")):
        return BLACK_FRIDAY
    return c


def _es_bf(toque: dict) -> bool:
    if (toque.get("host") or "").startswith("blackfriday.") or toque.get("kind") in _TIPOS_BF:
        return True
    if any(p.startswith("/black-friday") for p in toque.get("paginas") or []):
        return True
    return any(m == "black-friday" or m.startswith("bf-") for m in (toque.get("recorrido") or "").split(","))


def _paso_por_anuncio(toque: dict) -> bool:
    if any(p.startswith(_RUTAS_DE_ANUNCIO) for p in toque.get("paginas") or []):
        return True
    return any(m in _MARCAS_DE_ANUNCIO for m in (toque.get("recorrido") or "").split(","))


def es_de_pago(toque: dict) -> bool:
    return limpiar(toque.get("utm_medium") or "").lower() in _MEDIOS_DE_PAGO or _paso_por_anuncio(toque)


def _web_de(referrer: str) -> str:
    web = (referrer or "").strip().lower()
    if not web:
        return ""
    if "holandesnawar" in web:
        return "Web propia"
    for trozo, nombre in _WEBS:
        if trozo in web:
            return nombre
    return "Otras webs"


def clasificar(toque: dict) -> dict:
    """De dónde viene una visita o un paso de una persona. Función pura.

    `toque`: `utm_*`, `referrer`, y lo que haya de `paginas` (rutas de la
    web), `recorrido` (marcas), `kind` (el tipo de evento) y `host`.
    Devuelve `canal` (ads / organico), `fuente`, `campana` y `anuncio`.
    """
    fuente_utm = limpiar(toque.get("utm_source") or "").lower()
    campana = campana_de(toque.get("utm_campaign") or "")
    if not campana and _es_bf(toque):
        campana = BLACK_FRIDAY
    anuncio = limpiar(toque.get("utm_content") or "")
    if es_de_pago(toque):
        if not fuente_utm or fuente_utm in _META:
            red = "Meta"
        else:
            red = _REDES.get(fuente_utm, fuente_utm.capitalize())
        return {"canal": "ads", "fuente": f"{red} · anuncios", "campana": campana, "anuncio": anuncio}
    if fuente_utm:
        fuente = _REDES.get(fuente_utm, fuente_utm.capitalize()[:40])
    elif toque.get("kind") == "instagram":
        fuente = "Instagram"
    else:
        fuente = _web_de(toque.get("referrer") or "") or FUENTE_DIRECTO
    return {"canal": "organico", "fuente": fuente, "campana": campana, "anuncio": anuncio}


def _dice_de_donde(toque: dict) -> bool:
    """Si ese paso dice algo de por dónde llegó (un enlace con campaña, la web
    de la que venía, un DM de Instagram o la página del anuncio)."""
    if toque.get("kind") in _NO_DICEN or limpiar(toque.get("utm_medium") or "").lower() == "enlace-pago":
        return False
    return bool(
        limpiar(toque.get("utm_source") or "") or limpiar(toque.get("utm_medium") or "")
        or limpiar(toque.get("utm_campaign") or "") or (toque.get("referrer") or "").strip()
        or toque.get("kind") == "instagram" or _paso_por_anuncio(toque)
    )


def _instante(texto: str) -> Optional[datetime]:
    if not texto:
        return None
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def dia_nl(texto: str) -> str:
    d = _instante(texto)
    return d.astimezone(ZONA).strftime("%Y-%m-%d") if d else ""


def _orden(t: dict) -> float:
    d = _instante(t.get("when") or "")
    return d.timestamp() if d else 0.0


MODELOS = {
    "ficha": "Como en la ficha: si un anuncio la trajo alguna vez, el anuncio",
    "primera": "La primera vez que llegó",
    "ultima": "Lo último antes de reservar la llamada",
}


def toque_de(toques: list[dict], modelo: str, hasta: str = "") -> Optional[dict]:
    """El paso al que se le da el mérito. Función pura.

    `toques` en orden; `hasta`: cuándo reservó (o pagó), para `ultima`.
    Si ningún paso dice de dónde vino, el primero (sale como «Directo»), y si
    no hay ninguno, None.
    """
    personas = [t for t in toques if t.get("kind") not in _DE_LA_ESCUELA]
    informan = [t for t in personas if _dice_de_donde(t)]
    if modelo == "ultima":
        limite = _instante(hasta)
        antes = [t for t in informan if limite is None or (_instante(t.get("when") or "") or limite) <= limite]
        if antes:
            return antes[-1]
    elif modelo == "ficha":
        pago = next((t for t in informan if es_de_pago(t)), None)
        if pago:
            return pago
    if informan:
        return informan[0]
    return personas[0] if personas else (toques[0] if toques else None)


# ── el cálculo ──────────────────────────────────────────────────────────────


def _pct(parte: int, total: int) -> Optional[float]:
    return round(parte * 100 / total, 1) if total else None


def personas_de(
    fichas: list[dict],
    citas: list[dict],
    resultados: list[dict],
    pagaron: set[str],
    importes: dict[str, int],
    fuera: set[str],
    modelo: str,
    ahora: datetime,
) -> list[dict]:
    """Una línea por persona con cuándo entró, de dónde viene (según el
    modelo) y hasta dónde llegó. Función pura."""
    citas_por: dict[str, list[dict]] = {}
    for c in citas or []:
        email = (c.get("email") or "").strip().lower()
        if email:
            citas_por.setdefault(email, []).append(c)
    resultados_por: dict[str, list[dict]] = {}
    for r in resultados or []:
        email = (r.get("email") or "").strip().lower()
        if email:
            resultados_por.setdefault(email, []).append(r)
    quitadas = {r.get("cita_id") for r in resultados or [] if r.get("resultado") == "quitada"}

    por_email: dict[str, dict] = {(f.get("email") or "").lower(): f for f in fichas}
    # Quien solo está en Calendly (reservó directo, sin pasar por la web).
    for email in citas_por:
        por_email.setdefault(email, {"email": email, "nombre": "", "eventos": [], "pasos": []})

    salida = []
    for email, f in por_email.items():
        if not email or email in fuera:
            continue
        suyas = [c for c in citas_por.get(email, []) if c.get("id") not in quitadas]
        toques: list[dict] = []
        for e in f.get("eventos") or []:
            toques.append(dict(e))
        for c in suyas:
            utm = c.get("utm") or {}
            toques.append({"kind": "calendly", "when": c.get("reservada") or c.get("inicio") or "", **utm})
        toques.sort(key=_orden)
        de_ella = [t for t in toques if t.get("kind") not in _DE_LA_ESCUELA]
        if not de_ella:
            continue
        entro = de_ella[0].get("when") or ""
        dia = dia_nl(entro)
        if not dia:
            continue

        reservas = [t.get("when") or "" for t in toques if t.get("kind") in _RESERVA or t.get("kind") == "calendly"]
        reservas = sorted((r for r in reservas if _instante(r)), key=lambda r: _instante(r))
        reservo = reservas[0] if reservas else ""
        pago = next((t.get("when") or "" for t in toques if t.get("kind") == "pago"), "")
        pago_ok = email in pagaron
        suyos_res = resultados_por.get(email, [])
        vino = any(r.get("resultado") in VINO for r in suyos_res)
        if not vino and pago_ok and reservo:
            # Una llamada ya pasada sin «¿Qué pasó?» pero con pago: vino.
            vino = any((_instante(c.get("inicio") or "") or ahora) < ahora for c in suyas) or not suyas
        no_vino = not vino and any(r.get("resultado") == "no-vino" for r in suyos_res)

        toque = toque_de(toques, modelo, reservo or pago) or {}
        donde = clasificar(toque)
        pasos = f.get("pasos") or []
        salida.append(
            {
                "email": email,
                "nombre": f.get("nombre") or "",
                "entro": entro,
                "dia": dia,
                **donde,
                "primera_pagina": next((p for p in pasos if p and p != "enlace-pago"), ""),
                "reservo": reservo,
                "vino": vino,
                "no_vino": no_vino,
                "pago": pago_ok,
                "pago_at": pago,
                "cents": int(importes.get(email, 0)) if pago_ok else 0,
                "etapa": f.get("etapa") or "",
                "bf": any(_es_bf(t) or campana_de(t.get("utm_campaign") or "") == BLACK_FRIDAY for t in toques),
            }
        )
    return salida


def visitas_de(filas: Iterable[Any]) -> list[dict]:
    """Las sesiones con su clasificación. Función pura."""
    salida = []
    for f in filas:
        try:
            paginas = json.loads(getattr(f, "paginas", "") or "[]")
            if not isinstance(paginas, list):
                paginas = []
        except ValueError:
            paginas = []
        toque = {
            "utm_source": f.utm_source, "utm_medium": f.utm_medium, "utm_campaign": f.utm_campaign,
            "utm_content": f.utm_content, "referrer": f.referrer, "paginas": paginas, "host": f.host,
        }
        salida.append(
            {
                "dia": f.dia,
                "entrada": f.entrada or (paginas[0] if paginas else "/"),
                "paginas": paginas,
                "vistas": int(f.vistas or 0),
                "dispositivo": f.dispositivo or "",
                **clasificar(toque),
                "bf": _es_bf(toque) or campana_de(f.utm_campaign or "") == BLACK_FRIDAY,
            }
        )
    return salida


def _pasa(x: dict, filtros: dict) -> bool:
    if filtros.get("canal") in ("ads", "organico") and x.get("canal") != filtros["canal"]:
        return False
    if filtros.get("fuente") and x.get("fuente") != filtros["fuente"]:
        return False
    campana = filtros.get("campana") or ""
    if campana == BLACK_FRIDAY:
        # Black Friday entera: quien llegó por su campaña o por sus páginas.
        if x.get("campana") != BLACK_FRIDAY and not (filtros.get("bf_todo") and x.get("bf")):
            return False
    elif campana == "-":
        if x.get("campana"):
            return False
    elif campana and x.get("campana") != campana:
        return False
    anuncio = filtros.get("anuncio") or ""
    if anuncio and (x.get("anuncio") or "").lower() != anuncio.lower():
        return False
    return True


def _cifras(personas: list[dict], visitas: Optional[list[dict]]) -> dict:
    leads = len(personas)
    reservaron = sum(1 for p in personas if p["reservo"])
    vinieron = sum(1 for p in personas if p["vino"])
    no_vinieron = sum(1 for p in personas if p["no_vino"])
    pagaron = sum(1 for p in personas if p["pago"])
    cents = sum(p["cents"] for p in personas)
    n_visitas = len(visitas) if visitas is not None else None
    return {
        "visitas": n_visitas,
        "leads": leads,
        "reservaron": reservaron,
        "vinieron": vinieron,
        "no_vinieron": no_vinieron,
        "pagaron": pagaron,
        "cents": cents,
        "pct_lead": _pct(leads, n_visitas) if n_visitas else None,
        "pct_reserva": _pct(reservaron, leads),
        "pct_vino": _pct(vinieron, reservaron),
        "pct_pago_llamada": _pct(sum(1 for p in personas if p["pago"] and p["vino"]), vinieron),
        "pct_pago": _pct(pagaron, leads),
    }


def _por(clave: str, personas: list[dict], visitas: list[dict], etiqueta=lambda v: v) -> list[dict]:
    valores: dict[str, None] = {}
    for x in [*personas, *visitas]:
        valores.setdefault(x.get(clave) or "", None)
    filas = []
    for v in valores:
        ps = [p for p in personas if (p.get(clave) or "") == v]
        vs = [x for x in visitas if (x.get(clave) or "") == v]
        filas.append({"valor": v, "nombre": etiqueta(v), **_cifras(ps, vs)})
    filas.sort(key=lambda f: (f["pagaron"], f["reservaron"], f["leads"], f["visitas"] or 0), reverse=True)
    return filas


def _dias(desde: str, hasta: str) -> list[str]:
    salida = []
    d = date.fromisoformat(desde)
    while d.isoformat() <= hasta:
        salida.append(d.isoformat())
        d += timedelta(days=1)
    return salida


def _gasto_en(campana: dict, desde: str, hasta: str, hoy: str) -> int:
    """Lo gastado en una campaña de Panel → Anuncios dentro de estas fechas,
    repartido por igual entre sus días (lo apuntado es el total)."""
    total = int(campana.get("gasto_cents") or 0)
    inicio = campana.get("inicio") or ""
    if not total:
        return 0
    if not inicio:
        return total
    fin = campana.get("fin") or hoy
    if fin < inicio:
        fin = inicio
    dias = len(_dias(inicio, fin)) or 1
    a, b = max(inicio, desde), min(fin, hasta)
    if a > b:
        return 0
    return round(total * len(_dias(a, b)) / dias)


def calcular(
    *,
    personas: list[dict],
    visitas: list[dict],
    desde: str,
    hasta: str,
    filtros: dict,
    nombres_anuncios: Optional[dict] = None,
    nombres_paginas: Optional[dict] = None,
    campanas_apuntadas: Optional[list[dict]] = None,
    hoy: str = "",
) -> dict:
    """Todo lo de la pantalla. Función pura."""
    from src.services.panel.ads import nombre_del_anuncio

    hoy = hoy or hasta
    del_periodo = [p for p in personas if desde <= p["dia"] <= hasta]
    visitas_periodo = [v for v in visitas if desde <= (v.get("dia") or "") <= hasta]
    apuntadas = {campana_de(c.get("utm_campaign") or ""): c for c in campanas_apuntadas or [] if c.get("utm_campaign")}

    def nombre_campana(v: str) -> str:
        if not v:
            return "Sin campaña"
        if v == BLACK_FRIDAY:
            return "Black Friday"
        return (apuntadas.get(v) or {}).get("nombre") or v

    # Las opciones de los filtros: lo que hay en estas fechas, sin el resto de
    # filtros (si no, al elegir una fuente desaparecerían las demás).
    opciones = {
        "fuentes": sorted({x["fuente"] for x in [*del_periodo, *visitas_periodo] if x.get("fuente")}),
        "campanas": [
            {"valor": v, "nombre": nombre_campana(v)}
            for v in sorted({x["campana"] for x in [*del_periodo, *visitas_periodo] if x.get("campana")},
                            key=lambda v: (v != BLACK_FRIDAY, nombre_campana(v).lower()))
        ],
        "anuncios": [
            {"valor": v, "nombre": nombre_del_anuncio(v, nombres_anuncios)}
            for v in sorted({x["anuncio"] for x in del_periodo if x.get("anuncio")}, key=str.lower)
        ],
    }
    if BLACK_FRIDAY not in {c["valor"] for c in opciones["campanas"]}:
        opciones["campanas"].insert(0, {"valor": BLACK_FRIDAY, "nombre": "Black Friday"})

    ps = [p for p in del_periodo if _pasa(p, filtros)]
    vs = [v for v in visitas_periodo if _pasa(v, filtros)]

    por_canal = []
    for canal, nombre in (("ads", "Anuncios de pago"), ("organico", "Orgánico")):
        por_canal.append(
            {"valor": canal, "nombre": nombre,
             **_cifras([p for p in ps if p["canal"] == canal], [v for v in vs if v["canal"] == canal])}
        )

    por_campana = _por("campana", ps, vs, nombre_campana)
    for fila in por_campana:
        c = apuntadas.get(fila["valor"])
        gasto = _gasto_en(c, desde, hasta, hoy) if c else 0
        fila["gasto_cents"] = gasto
        fila["coste_lead_cents"] = round(gasto / fila["leads"]) if gasto and fila["leads"] else None
        fila["coste_venta_cents"] = round(gasto / fila["pagaron"]) if gasto and fila["pagaron"] else None
        fila["retorno"] = round(fila["cents"] / gasto, 2) if gasto else None

    por_anuncio = [
        f for f in _por("anuncio", ps, [], lambda v: nombre_del_anuncio(v, nombres_anuncios) or "Sin anuncio")
        if f["valor"]
    ]
    for f in por_anuncio:
        f["meta"] = f["valor"]

    # Las páginas: cuántas sesiones vieron cada una y por cuántas entraron.
    vistas_pag: dict[str, dict] = {}
    for v in vs:
        for p in v["paginas"] or [v["entrada"]]:
            vistas_pag.setdefault(p, {"pagina": p, "sesiones": 0, "entradas": 0})["sesiones"] += 1
        vistas_pag.setdefault(v["entrada"], {"pagina": v["entrada"], "sesiones": 0, "entradas": 0})["entradas"] += 1
    paginas = sorted(vistas_pag.values(), key=lambda x: (x["sesiones"], x["entradas"]), reverse=True)

    primeras: dict[str, dict] = {}
    for p in ps:
        clave = p.get("primera_pagina") or ""
        fila = primeras.setdefault(clave, {"marca": clave, "nombre": (nombres_paginas or {}).get(clave, clave) or "Sin páginas apuntadas", "leads": 0, "reservaron": 0, "pagaron": 0})
        fila["leads"] += 1
        fila["reservaron"] += 1 if p["reservo"] else 0
        fila["pagaron"] += 1 if p["pago"] else 0
    donde_dejan = sorted(primeras.values(), key=lambda x: x["leads"], reverse=True)

    serie = []
    for dia in _dias(desde, hasta):
        serie.append(
            {
                "dia": dia,
                "visitas": sum(1 for v in vs if v["dia"] == dia),
                "leads": sum(1 for p in ps if p["dia"] == dia),
                "leads_ads": sum(1 for p in ps if p["dia"] == dia and p["canal"] == "ads"),
                "reservas": sum(1 for p in ps if dia_nl(p["reservo"]) == dia),
                "ventas": sum(1 for p in ps if p["pago"] and dia_nl(p["pago_at"]) == dia),
            }
        )

    dispositivos = {
        "movil": sum(1 for v in vs if v["dispositivo"] == "movil"),
        "ordenador": sum(1 for v in vs if v["dispositivo"] == "ordenador"),
    }

    lista = sorted(ps, key=lambda p: _orden({"when": p["entro"]}), reverse=True)
    personas_salida = [
        {
            "email": p["email"], "nombre": p["nombre"], "entro": p["entro"], "canal": p["canal"],
            "fuente": p["fuente"], "campana": p["campana"], "campana_nombre": nombre_campana(p["campana"]) if p["campana"] else "",
            "anuncio": nombre_del_anuncio(p["anuncio"], nombres_anuncios) if p["anuncio"] else "",
            "primera_pagina": (nombres_paginas or {}).get(p["primera_pagina"], p["primera_pagina"]),
            "reservo": p["reservo"], "vino": p["vino"], "no_vino": p["no_vino"], "pago": p["pago"], "cents": p["cents"],
        }
        for p in lista[:600]
    ]

    return {
        "desde": desde,
        "hasta": hasta,
        "filtros": filtros,
        "opciones": opciones,
        "resumen": _cifras(ps, vs),
        "por_canal": por_canal,
        "por_fuente": _por("fuente", ps, vs),
        "por_campana": por_campana,
        "por_anuncio": por_anuncio,
        "paginas": paginas[:60],
        "donde_dejan": donde_dejan,
        "dispositivos": dispositivos,
        "serie": serie,
        "personas": personas_salida,
        "personas_total": len(lista),
    }


def _fecha(texto: str, defecto: str) -> str:
    try:
        return date.fromisoformat((texto or "")[:10]).isoformat()
    except ValueError:
        return defecto


async def analitica(org_id: int, params: dict, db_session: AsyncSession) -> dict:
    from src.db.contact_seguimiento import CallOutcome
    from src.db.enrollment import Enrollment
    from src.db.panel_negocio import AdCampaign
    from src.db.web_visita import WebVisita
    from src.services.contactos.agenda import agenda
    from src.services.contactos.contactos import (
        _emails_con_cuenta,
        _todos_los_eventos,
        emails_que_pagaron,
        fusionar_contactos,
    )
    from src.services.contactos.metricas import emails_excluidos
    from src.services.panel.ads import leer_nombres
    from src.services.payments.payments import _desde_cuando
    from src.services.payments.solicitudes import _NOMBRES

    hoy = datetime.now(ZONA).date()
    hasta = _fecha(params.get("hasta") or "", hoy.isoformat())
    desde = _fecha(params.get("desde") or "", (hoy - timedelta(days=29)).isoformat())
    if desde > hasta:
        desde, hasta = hasta, desde
    # Como mucho dos años de golpe (la serie por día).
    if (date.fromisoformat(hasta) - date.fromisoformat(desde)).days > 730:
        desde = (date.fromisoformat(hasta) - timedelta(days=730)).isoformat()
    modelo = params.get("modelo") if params.get("modelo") in MODELOS else "ficha"
    filtros = {
        "canal": params.get("canal") if params.get("canal") in ("ads", "organico") else "",
        "fuente": _corto(params.get("fuente"), 60),
        "campana": _corto(params.get("campana"), 120).lower(),
        "anuncio": _corto(params.get("anuncio"), 120),
        "bf_todo": str(params.get("bf_todo") or "") in ("1", "true", "si"),
    }

    fuera = await emails_excluidos(db_session)
    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    pagaron = await emails_que_pagaron(db_session)

    try:
        datos_agenda = await agenda()
    except Exception:  # noqa: BLE001
        datos_agenda = {"configurado": False, "citas": []}
    calendly_ok = bool(datos_agenda.get("configurado")) and not datos_agenda.get("error")
    citas = [c for c in (datos_agenda.get("citas") or []) if not c.get("reprogramada")] if calendly_ok else []

    resultados = [
        {"cita_id": r.cita_id, "email": r.email, "resultado": r.resultado, "inicio": r.inicio}
        for r in (await db_session.execute(select(CallOutcome))).scalars().all()
    ]
    corte = _desde_cuando()
    importes: dict[str, int] = {}
    for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all():
        if corte and (r.paid_at or "")[:10] < corte:
            continue
        email = (r.email or "").strip().lower()
        importes[email] = importes.get(email, 0) + int(r.amount_cents or 0)

    personas = personas_de(fichas, citas, resultados, pagaron, importes, fuera, modelo, datetime.now(timezone.utc))
    filas = (
        await db_session.execute(select(WebVisita).where(WebVisita.dia >= desde, WebVisita.dia <= hasta))
    ).scalars().all()
    visitas = visitas_de(filas)
    campanas = [
        {"nombre": c.nombre, "utm_campaign": c.utm_campaign, "inicio": c.inicio, "fin": c.fin, "gasto_cents": c.gasto_cents}
        for c in (await db_session.execute(select(AdCampaign).where(AdCampaign.org_id == org_id))).scalars().all()
    ]
    primera = (await db_session.execute(select(WebVisita.dia).order_by(WebVisita.dia).limit(1))).first()

    salida = calcular(
        personas=personas, visitas=visitas, desde=desde, hasta=hasta, filtros=filtros,
        nombres_anuncios=await leer_nombres(org_id, db_session), nombres_paginas=_NOMBRES,
        campanas_apuntadas=campanas, hoy=hoy.isoformat(),
    )
    salida["modelo"] = modelo
    salida["modelos"] = MODELOS
    salida["visitas_desde"] = (primera[0] if primera else "") or ""
    salida["calendly"] = {"conectado": calendly_ok, "error": datos_agenda.get("error") or ""}
    return salida

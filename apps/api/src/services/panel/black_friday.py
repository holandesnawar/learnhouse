"""
Black Friday para los closers (29/10/2026): quién viene de la campaña, qué
hizo y qué correos le han llegado, sin salir del tablero ni de la ficha.

Pedido: "un tablero para Black Friday… que vean de dónde vienen, qué vieron
los leads, qué mails leyeron, si tienen el ebook". Decidido: NO un tablero
aparte (las notas y las fichas ya se juntaron una vez por estar repartidas),
sino Black Friday dentro de Matrículas:

- Entran en Leads quien compró el ebook (Nuevo las primeras 48 h, como todo
  el mundo) y quien desbloqueó la oferta dejando su WhatsApp (Por llamar: es
  más frío y, con las newsletters, pueden ser cientos). Quien entra por el
  botón de un correo no deja teléfono y no entra.
- Cada tarjeta lleva «Black Friday · ebook» o «Black Friday · sin ebook», y
  arriba hay un filtro con solo los de la campaña.
- La ficha lleva un bloque «Black Friday» (`resumen`).

⚠️ «Qué correos leyó» no se puede saber: el iPhone marca todos como abiertos y
systeme.io no le da a la escuela lo de cada persona. Lo que sí se sabe:
- Qué correos le han llegado, por el CALENDARIO de las dos campañas de
  systeme.io (`CAMPANAS`, los mismos días que tienen allí). Si se cambian los
  días en systeme.io, hay que cambiarlos aquí.
- En qué correo pulsó el botón: los botones llevan `utm_content` (sys-n0,
  nl-recuerdas…) y la web lo guarda en lo que hace la persona.

Las reglas de systeme.io solo meten a quien recibe la etiqueta DESPUÉS de
crearlas: quien se apuntó antes de encender los correos no está en ninguna
campaña. Por eso hace falta el día en que se encendieron, que se pone en
Avisos → Ebook Black Friday (`systeme_desde` de org_config `ebook_bf`). Sin
ese día, la ficha dice que los correos aún no están encendidos.

Todo son funciones puras sobre la ficha de Contactos (`fusionar_contactos`):
tienen test en `test_black_friday_closer.py`.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

#: Las dos campañas de systeme.io, paso a paso: (utm_content del botón, asunto,
#: día desde que entra). «No compradores» empieza al apuntarse a la lista
#: (etiqueta «Black Friday - lista»); «Compradores», al comprar el ebook.
CAMPANAS: dict[str, list[tuple[str, str, int]]] = {
    "no-compradores": [
        ("sys-n0", "Tu oferta de Black Friday está desbloqueada", 0),
        ("sys-n1", "La «e» que delata a los hispanohablantes", 1),
        ("sys-n3", "Lo que hemos preparado para este Black Friday", 3),
        ("sys-n5", "Cuando otros tienen que hablar por ti", 5),
        ("sys-n7", "Último aviso: tu ebook a 1 €", 7),
    ],
    "compradores": [
        ("sys-c1", "Ya tienes tu ebook. Ahora, lo que de verdad hemos preparado", 1),
        ("sys-c3", "Por qué el neerlandés se atasca (y no es culpa tuya)", 3),
        ("sys-c5", "«No tengo tiempo», «a mi edad», «ya lo intenté»", 5),
        ("sys-c7", "Así es una semana dentro de la escuela", 7),
    ],
}
NOMBRE_CAMPANA = {"no-compradores": "No compradores", "compradores": "Compradores"}

#: Las newsletters (se mandan a mano, con fecha): solo se sabe quién volvió.
NEWSLETTERS = {
    "nl-abrimos-1": "Este Black Friday no lo vamos a anunciar en público",
    "nl-abrimos-2": "Este Black Friday no lo vamos a anunciar en público",
    "nl-recuerdas": "¿Recuerdas qué te compraste el Black Friday pasado?",
    "nl-lista": "Tenemos algo importante que contarte",
}

#: Dónde se edita cada correo en systeme.io: el paso de su campaña o la
#: newsletter (las dos de «abrimos» son dos botones del MISMO correo).
SYSTEME_CAMPANA_ID = {"no-compradores": 1222373, "compradores": 1222372}
SYSTEME_PASO_ID = {
    "sys-n0": 6231026, "sys-n1": 6231032, "sys-n3": 6231033, "sys-n5": 6231034, "sys-n7": 6231035,
    "sys-c1": 6231036, "sys-c3": 6231037, "sys-c5": 6231038, "sys-c7": 6231039,
}
SYSTEME_NEWSLETTER_ID = {"nl-abrimos-1": 5508957, "nl-abrimos-2": 5508957, "nl-recuerdas": 5508958, "nl-lista": 5508959}


def enlace_systeme(ident: str) -> str:
    """La página de systeme.io donde se edita ese correo ("" si no es suyo)."""
    ident = (ident or "").strip().lower()
    if ident in SYSTEME_PASO_ID:
        campana = "no-compradores" if ident.startswith("sys-n") else "compradores"
        return f"https://systeme.io/dashboard/campaigns/{SYSTEME_CAMPANA_ID[campana]}/campaign-step/{SYSTEME_PASO_ID[ident]}/edit"
    if ident in SYSTEME_NEWSLETTER_ID:
        return f"https://systeme.io/dashboard/newsletters/{SYSTEME_NEWSLETTER_ID[ident]}/edit"
    return ""


#: Todos los asuntos por el `utm_content` de su botón.
ASUNTOS: dict[str, str] = {
    **{ident: asunto for pasos in CAMPANAS.values() for ident, asunto, _dia in pasos},
    **NEWSLETTERS,
}

_CORREO_FUENTES = {"email", "systeme", "newsletter", "correo", "mail"}
_CORREO_MEDIOS = {"email", "newsletter", "correo", "mail"}
_RESERVO = {"reunion", "llamada-equipo", "correo-reserva"}
_FORMULARIO = {"admision", "agendar-empezado", "cualificacion"}
_PAGINAS_BF = ("bf-desbloquear", "bf-ebook", "bf-ebook-ads", "black-friday", "bf-admision")


def _instante(texto: str) -> Optional[datetime]:
    if not texto:
        return None
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
    except ValueError:
        try:
            d = datetime.fromisoformat(str(texto)[:10])
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _primero(eventos: list[dict], kinds: set[str]) -> Optional[dict]:
    for e in eventos:
        if e.get("kind") in kinds:
            return e
    return None


def _extra(e: dict) -> dict:
    x = e.get("extra")
    return x if isinstance(x, dict) else {}


def es_de_correo(utm_source: str, utm_medium: str) -> bool:
    """Un enlace que viene de un correo (de systeme.io o de la escuela)."""
    return (utm_source or "").strip().lower() in _CORREO_FUENTES or (utm_medium or "").strip().lower() in _CORREO_MEDIOS


def asunto_de(utm_content: str) -> str:
    """El asunto del correo por el `utm_content` de su botón ("" si no se
    conoce). Vale también para los correos que mandaba la escuela."""
    ident = (utm_content or "").strip().lower()
    if ident in ASUNTOS:
        return ASUNTOS[ident]
    try:
        from src.services.ebook.ebook import DE_FABRICA

        for c in DE_FABRICA.get("correos") or []:
            if str(c.get("id", "")).lower() == ident:
                return str(c.get("asunto", ""))
    except Exception:  # noqa: BLE001
        pass
    return ""


def _con_telefono(e: Optional[dict]) -> bool:
    return bool(e and "".join(ch for ch in str(e.get("phone") or "") if ch.isdigit()))


def marca(ficha: dict) -> str:
    """«ebook» si compró el ebook, «lista» si solo desbloqueó la oferta; "" si
    no pasó por Black Friday. La tarjeta y el filtro del tablero."""
    eventos = ficha.get("eventos") or []
    if _primero(eventos, {"ebook"}):
        return "ebook"
    if _primero(eventos, {"bf-lista"}):
        return "lista"
    return ""


def entra_por_black_friday(ficha: dict) -> bool:
    """Entra en el tablero: compró el ebook, o desbloqueó la oferta dejando su
    WhatsApp."""
    eventos = ficha.get("eventos") or []
    if _primero(eventos, {"ebook"}):
        return True
    return any(e.get("kind") == "bf-lista" and _con_telefono(e) for e in eventos)


def solo_lista(ficha: dict) -> bool:
    """Está en el tablero solo por haber desbloqueado la oferta: sin ebook, sin
    matrícula y sin enlace de pago. Va a Por llamar, no a Nuevo."""
    eventos = ficha.get("eventos") or []
    return (
        marca(ficha) == "lista"
        and not ficha.get("matricula_at")
        and not _primero(eventos, {"enlace-pago"})
    )


def cuando_entro(ficha: dict) -> str:
    """Cuándo entró por Black Friday: compró el ebook o, si no, desbloqueó."""
    eventos = ficha.get("eventos") or []
    e = _primero(eventos, {"ebook"}) or _primero(eventos, {"bf-lista"})
    return (e or {}).get("when", "")


def _via(e: dict) -> str:
    """Por dónde llegó en ese paso: un correo, un anuncio o lo orgánico."""
    if es_de_correo(e.get("utm_source", ""), e.get("utm_medium", "")):
        asunto = asunto_de(e.get("utm_content", ""))
        return f"un correo («{asunto}»)" if asunto else "un correo"
    from src.services.panel.pipeline import _es_de_pago, _pista_organica

    if _es_de_pago(e) or "bf-ebook-ads" in (e.get("recorrido") or ""):
        from src.services.panel.ads import limpiar_anuncio

        anuncio = limpiar_anuncio(e.get("utm_content", ""))
        return f"un anuncio ({anuncio})" if anuncio else "un anuncio"
    pista = _pista_organica(e)
    return pista or "sin enlace (directo)"


def _salida(eventos: list[dict], ficha: dict, desde: Optional[datetime]) -> Optional[dict]:
    """Lo primero (después de `desde`) que le saca de las campañas de
    systeme.io: reservar la llamada, pagar la formación, no encajar o darse de
    baja."""
    candidatos: list[tuple[datetime, str]] = []
    for e in eventos:
        t = _instante(e.get("when", ""))
        if t is None or (desde and t < desde):
            continue
        k = e.get("kind")
        if k in _RESERVO:
            candidatos.append((t, "Reservó su llamada"))
        elif k == "pago":
            candidatos.append((t, "Pagó la formación"))
        elif k == "cualificacion" and _extra(e).get("apto") is False and _extra(e).get("embudo") == "black-friday":
            candidatos.append((t, "No encaja (terminó las preguntas)"))
        elif k == "baja-bf":
            candidatos.append((t, "Se dio de baja"))
    if not candidatos and ficha.get("etapa") == "alumno":
        return {"motivo": "Ya es alumno", "cuando": ""}
    if not candidatos:
        return None
    t, motivo = min(candidatos, key=lambda c: c[0])
    return {"motivo": motivo, "cuando": t.isoformat()}


def _pasos(campana: str, entra: datetime, hasta: Optional[datetime], ahora: datetime) -> tuple[list[dict], Optional[dict]]:
    """Los correos de una campaña que ya le han llegado y el próximo."""
    llegados: list[dict] = []
    proximo = None
    for ident, asunto, dia in CAMPANAS[campana]:
        sale = entra + timedelta(days=dia)
        if hasta and sale >= hasta:
            break
        if sale <= ahora:
            llegados.append({"id": ident, "asunto": asunto, "cuando": sale.isoformat()})
        elif proximo is None:
            proximo = {"id": ident, "asunto": asunto, "cuando": sale.isoformat()}
    return llegados, proximo


def resumen(ficha: dict, ahora: datetime, encendidos_desde: str = "") -> Optional[dict]:
    """El bloque «Black Friday» de la ficha (None si no pasó por la campaña)."""
    eventos = sorted(ficha.get("eventos") or [], key=lambda e: str(e.get("when") or ""))
    lista = _primero(eventos, {"bf-lista"})
    ebook = _primero(eventos, {"ebook"})
    empezo = _primero(eventos, {"ebook-empezado"})
    pasos = [p for p in (ficha.get("pasos") or []) if p in _PAGINAS_BF]
    volvio: list[dict] = []
    vistos: set[str] = set()
    for e in eventos:
        if (e.get("utm_campaign") or "").strip().lower() != "black-friday":
            continue
        if not es_de_correo(e.get("utm_source", ""), e.get("utm_medium", "")):
            continue
        ident = (e.get("utm_content") or "").strip().lower()
        if not ident or ident in vistos:
            continue
        vistos.add(ident)
        volvio.append({"id": ident, "asunto": asunto_de(ident) or ident, "cuando": e.get("when", "")})
    if not (lista or ebook or empezo or pasos or volvio):
        return None

    from src.services.payments.solicitudes import _NOMBRES

    encendidos = _instante(encendidos_desde) if encendidos_desde else None
    # Desde el 31/10, abrir la caja de pago del ebook también pone la
    # etiqueta de la lista en systeme.io: entra en «No compradores» con lo
    # primero de las dos cosas.
    t_lista = min(
        [t for t in (_instante((lista or {}).get("when", "")), _instante((empezo or {}).get("when", ""))) if t],
        default=None,
    )
    t_ebook = _instante((ebook or {}).get("when", ""))
    entra_lista = t_lista if (encendidos and t_lista and t_lista >= encendidos) else None
    entra_ebook = t_ebook if (encendidos and t_ebook and t_ebook >= encendidos) else None
    primera_entrada = min([t for t in (entra_lista, entra_ebook) if t], default=None)
    salida = _salida(eventos, ficha, primera_entrada) if primera_entrada else _salida(eventos, ficha, t_lista or t_ebook)
    t_salida = _instante((salida or {}).get("cuando", "")) if salida else None

    correos: list[dict] = []
    proximo = None
    campana = ""
    if entra_lista:
        corte = min([t for t in (entra_ebook, t_salida) if t], default=None)
        hechos, prox = _pasos("no-compradores", entra_lista, corte, ahora)
        correos += [{**c, "campana": NOMBRE_CAMPANA["no-compradores"]} for c in hechos]
        if not entra_ebook and not t_salida:
            campana, proximo = "no-compradores", prox
    if entra_ebook:
        hechos, prox = _pasos("compradores", entra_ebook, t_salida, ahora)
        correos += [{**c, "campana": NOMBRE_CAMPANA["compradores"]} for c in hechos]
        if not t_salida:
            campana, proximo = "compradores", prox
    if salida and salida.get("motivo") == "Ya es alumno" and campana:
        campana, proximo = "", None

    if not encendidos:
        aviso = "Los correos de systeme.io aún no están encendidos."
    elif (lista or ebook or empezo) and not (entra_lista or entra_ebook):
        aviso = "Entró antes de encender los correos de systeme.io: no está en ninguna campaña."
    else:
        aviso = ""

    if ebook:
        titulo = "Compró el ebook"
    elif empezo:
        titulo = "Abrió el pago del ebook y no lo compró"
    elif lista:
        titulo = "Desbloqueó la oferta, sin comprar el ebook"
    else:
        titulo = "Pasó por la campaña de Black Friday"

    formulario = None
    for e in eventos:
        if e.get("kind") in _FORMULARIO and _extra(e).get("embudo") == "black-friday":
            formulario = e
    if formulario:
        if formulario.get("kind") == "cualificacion":
            llamada = "Terminó las preguntas de la llamada" + ("" if _extra(formulario).get("apto") is not False else ": no encaja")
        else:
            llamada = "Empezó el formulario de la llamada y no lo terminó"
    else:
        llamada = ""
    if _primero(eventos, _RESERVO):
        llamada = "Reservó su llamada"

    return {
        "estado": marca(ficha) or ("empezo-ebook" if empezo else ""),
        "titulo": titulo,
        "desbloqueo": {"cuando": lista.get("when", ""), "via": _via(lista)} if lista else None,
        "ebook": {"cuando": ebook.get("when", ""), "via": _via(ebook)} if ebook else None,
        "empezo_ebook": (empezo or {}).get("when", "") if not ebook else "",
        "campana": NOMBRE_CAMPANA.get(campana, ""),
        "aviso": aviso,
        "salida": salida if (salida and (entra_lista or entra_ebook)) else None,
        "correos": correos,
        "proximo": proximo,
        "volvio_por": volvio,
        "paginas": [{"id": p, "nombre": _NOMBRES.get(p, p)} for p in pasos],
        "llamada": llamada,
    }

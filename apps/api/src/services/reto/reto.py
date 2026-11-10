"""
«Mijn eerste week» (10/11/2026): tu primera semana en neerlandés, a tu medida.

Pedido del usuario: "crear algo brutal como lead magnet, que no sea un ebook,
medio personalizado, que pase por la escuela; así cualificamos mucho más… ya
con su mail, número y nombre listos… que den sus primeros pasos antes de
entrar con nosotros". Y el ángulo: "el dolor de que siempre hay que pagar
para todo".

Qué es:

- La persona deja nombre, correo y WhatsApp y contesta cinco cosas (dónde
  vive, de dónde es, para qué necesita el neerlandés, a qué se dedica y cuánto
  sabe). Con eso la escuela le arma SIETE DÍAS de 10 minutos: las frases de SU
  situación con SUS datos ya puestos («Ik ben Ana, ik kom uit Colombia en ik
  woon in Utrecht»), con audio, una práctica corta y un reto para la calle.
- Se abre UN DÍA CADA DÍA (hora de Países Bajos), para que vuelva. El día 7 es
  su presentación entera y el botón de la llamada.
- Entra con un ENLACE PERSONAL firmado (como la descarga del ebook): sin
  cuenta ni contraseña, y sin tocar nada de los alumnos. Rotar el secreto JWT
  invalida esos enlaces.
- El plan NO se guarda: `armar` lo calcula con las respuestas. Es texto fijo
  con huecos, sin IA en vivo (sin clave en la escuela, a propósito).

Para el equipo:

- Al apuntarse queda en su ficha (`contact_event` de tipo `reto`, con sus utm):
  sale en Contactos con su origen.
- `para_la_ficha` da al closer para qué lo quiere, a qué se dedica, cuánto
  sabe, cuántos días ha hecho y si pulsó el botón de la llamada. Quien hace
  cinco de siete es a quien se llama primero.

⚠️ El neerlandés de `armar` tiene que ser el de la calle y correcto: antes de
cambiar una frase, pasarla por la skill `dutch-content-checker` o por un profe.
Las frases con barra («de moeder / de vader») llevan `practica: False`: no
entran en los ejercicios.

Por decidir con el usuario (10/11): los correos de cada día (hoy solo sale el
del enlace), la etiqueta de systeme.io y si quien se apunta entra en Matrículas.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.reto import RetoSemana

logger = logging.getLogger(__name__)

TIPO = "reto"
DIAS = 7
#: Cuánto vale el enlace personal.
DIAS_ENLACE = 120
_CORREO_OK = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

VIVE = [
    {"id": "nl", "nombre": "En Países Bajos"},
    {"id": "be", "nombre": "En Bélgica"},
    {"id": "fuera", "nombre": "Todavía no, me mudo pronto"},
]
_PAIS_NL = {"nl": "Nederland", "be": "België"}

#: País de origen: su nombre en español y en neerlandés.
ORIGENES = [
    ("espana", "España", "Spanje"),
    ("mexico", "México", "Mexico"),
    ("colombia", "Colombia", "Colombia"),
    ("venezuela", "Venezuela", "Venezuela"),
    ("argentina", "Argentina", "Argentinië"),
    ("peru", "Perú", "Peru"),
    ("chile", "Chile", "Chili"),
    ("ecuador", "Ecuador", "Ecuador"),
    ("dominicana", "República Dominicana", "de Dominicaanse Republiek"),
    ("cuba", "Cuba", "Cuba"),
    ("bolivia", "Bolivia", "Bolivia"),
    ("uruguay", "Uruguay", "Uruguay"),
    ("paraguay", "Paraguay", "Paraguay"),
    ("guatemala", "Guatemala", "Guatemala"),
    ("honduras", "Honduras", "Honduras"),
    ("elsalvador", "El Salvador", "El Salvador"),
    ("nicaragua", "Nicaragua", "Nicaragua"),
    ("costarica", "Costa Rica", "Costa Rica"),
    ("panama", "Panamá", "Panama"),
    ("puertorico", "Puerto Rico", "Puerto Rico"),
    ("otro", "Otro país", ""),
]
_ORIGEN_NL = {i: nl for i, _es, nl in ORIGENES}

MOTIVOS = [
    {"id": "trabajo", "nombre": "El trabajo", "detalle": "Entender a mis compañeros y a mi jefe"},
    {"id": "medico", "nombre": "El médico y la farmacia", "detalle": "Ir sin que nadie me acompañe"},
    {"id": "tramites", "nombre": "Las cartas y los trámites", "detalle": "El gemeente, los impuestos, el seguro"},
    {"id": "colegio", "nombre": "El colegio de mis hijos", "detalle": "Hablar con los profes y otros padres"},
    {"id": "pareja", "nombre": "Mi pareja y su familia", "detalle": "Dejar de quedarme fuera de la conversación"},
    {"id": "dia", "nombre": "El día a día", "detalle": "El súper, los vecinos, la calle"},
]
_MOTIVOS = {m["id"]: m["nombre"] for m in MOTIVOS}

#: A qué se dedica: lo que elige, y cómo lo dice en neerlandés.
TRABAJOS = [
    ("zorg", "Sanidad o cuidados", "Ik werk in de zorg.", "Trabajo en el sector de los cuidados."),
    ("horeca", "Hostelería", "Ik werk in de horeca.", "Trabajo en la hostelería."),
    ("magazijn", "Almacén o logística", "Ik werk in een magazijn.", "Trabajo en un almacén."),
    ("schoonmaak", "Limpieza", "Ik werk in de schoonmaak.", "Trabajo en la limpieza."),
    ("bouw", "Construcción", "Ik werk in de bouw.", "Trabajo en la construcción."),
    ("kantoor", "Oficina", "Ik werk op kantoor.", "Trabajo en una oficina."),
    ("it", "Informática", "Ik werk in de IT.", "Trabajo en informática."),
    ("winkel", "Tienda o supermercado", "Ik werk in een winkel.", "Trabajo en una tienda."),
    ("studie", "Estudio", "Ik studeer.", "Estudio."),
    ("zoek", "Busco trabajo", "Ik zoek werk.", "Estoy buscando trabajo."),
    ("thuis", "Cuido de mi familia", "Ik zorg voor mijn gezin.", "Cuido de mi familia."),
    ("anders", "Otra cosa", "Ik heb een baan.", "Tengo trabajo."),
]
_TRABAJO = {i: (es, nl, tr) for i, es, nl, tr in TRABAJOS}
#: Quien no tiene compañeros de trabajo a quien saludar.
_SIN_COMPANEROS = {"studie", "zoek", "thuis"}

NIVELES = [
    {"id": "nada", "nombre": "Nada todavía"},
    {"id": "palabras", "nombre": "Algunas palabras sueltas"},
    {"id": "algo", "nombre": "Me defiendo un poco"},
]
_NIVELES = {n["id"]: n["nombre"] for n in NIVELES}


class RetoError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def opciones() -> dict:
    """Lo que pinta el formulario."""
    return {
        "vive": VIVE,
        "origenes": [{"id": i, "nombre": es, "nl": nl} for i, es, nl in ORIGENES],
        "motivos": MOTIVOS,
        "trabajos": [{"id": i, "nombre": es} for i, es, _nl, _tr in TRABAJOS],
        "niveles": NIVELES,
    }


def limpiar_respuestas(r: Any) -> dict:
    """Solo lo que la escuela conoce. Lo que no valga, a su valor de serie. Pura."""
    r = r if isinstance(r, dict) else {}
    ciudad = re.sub(r"[^\w\s\-'.áéíóúÁÉÍÓÚñÑüÜ]", "", str(r.get("ciudad") or "")).strip()[:40]
    return {
        "vive": r.get("vive") if r.get("vive") in {v["id"] for v in VIVE} else "nl",
        "ciudad": ciudad,
        "origen": r.get("origen") if r.get("origen") in _ORIGEN_NL else "otro",
        "motivo": r.get("motivo") if r.get("motivo") in _MOTIVOS else "dia",
        "trabajo": r.get("trabajo") if r.get("trabajo") in _TRABAJO else "anders",
        "nivel": r.get("nivel") if r.get("nivel") in _NIVELES else "nada",
    }


# ── El plan: siete días con sus frases ───────────────────────────────────


def _f(nl: str, es: str, practica: bool = True, oyes: bool = False) -> dict:
    """Una frase. `oyes` = no la dices tú: es lo que te van a decir."""
    return {"nl": nl, "es": es, "practica": practica, "oyes": oyes}


_SITUACIONES: dict[str, dict] = {
    "trabajo": {
        "nl": "Op het werk",
        "titulo": "En el trabajo",
        "intro": "Las cinco frases que más vas a usar con tus compañeros. Con estas ya no hace falta cambiar al inglés.",
        "frases": [
            _f("Goedemorgen allemaal!", "¡Buenos días a todos!"),
            _f("Ik heb een vraag.", "Tengo una pregunta."),
            _f("Kun je me even helpen?", "¿Me puedes ayudar un momento?"),
            _f("Wat moet ik nu doen?", "¿Qué tengo que hacer ahora?"),
            _f("Ik ben klaar.", "Ya he terminado."),
        ],
        "ojo": "Con los compañeros se dice «je». El «u» se queda para clientes y para gente que no conoces.",
        "reto": "Mañana, saluda al entrar con «Goedemorgen allemaal!». Solo eso. Mira qué cara ponen.",
    },
    "medico": {
        "nl": "Bij de huisarts",
        "titulo": "En el médico",
        "intro": "Para pedir cita y decir qué te pasa sin que nadie tenga que acompañarte.",
        "frases": [
            _f("Ik wil graag een afspraak maken.", "Quería pedir una cita."),
            _f("Ik heb hoofdpijn.", "Me duele la cabeza."),
            _f("Ik heb koorts.", "Tengo fiebre."),
            _f("Sinds gisteren.", "Desde ayer."),
            _f("Kan ik vandaag nog komen?", "¿Puedo ir hoy mismo?"),
            _f("Wat zijn uw klachten?", "¿Qué le pasa? (lo que te van a preguntar)", practica=False, oyes=True),
        ],
        "ojo": "El dolor se pega a la parte del cuerpo: hoofdpijn (cabeza), buikpijn (barriga), keelpijn (garganta), rugpijn (espalda).",
        "reto": "Di en voz alta cómo pedirías cita ahora mismo: «Ik wil graag een afspraak maken». La próxima vez, llama tú.",
    },
    "tramites": {
        "nl": "Bij de gemeente",
        "titulo": "En el ayuntamiento",
        "intro": "Para la ventanilla del gemeente y para cuando llega una carta que no entiendes.",
        "frases": [
            _f("Ik heb een afspraak.", "Tengo una cita."),
            _f("Ik wil me inschrijven.", "Quiero empadronarme."),
            _f("Welke documenten heb ik nodig?", "¿Qué documentos necesito?"),
            _f("Ik heb een brief gekregen.", "He recibido una carta."),
            _f("Kunt u dit uitleggen?", "¿Me lo puede explicar?"),
        ],
        "ojo": "En una ventanilla se habla de «u»: Kunt u…? Con «je» suena demasiado directo.",
        "reto": "Coge la última carta que te llegó en neerlandés y busca en ella tres palabras: brief, afspraak y datum.",
    },
    "colegio": {
        "nl": "Op school",
        "titulo": "En el colegio",
        "intro": "Para hablar con la profe de tus hijos y con los otros padres en la puerta.",
        "frases": [
            _f("Ik ben de moeder / de vader van …", "Soy la madre / el padre de …", practica=False),
            _f("Hoe gaat het op school?", "¿Cómo le va en el colegio?"),
            _f("Mijn kind is vandaag ziek.", "Mi hijo está enfermo hoy."),
            _f("Hoe laat is de school uit?", "¿A qué hora termina el colegio?"),
            _f("Ik heb een vraag over het huiswerk.", "Tengo una pregunta sobre los deberes."),
        ],
        "ojo": "«Mijn kind» vale para hijo y para hija. Si quieres decirlo: mijn zoon (mi hijo), mijn dochter (mi hija).",
        "reto": "Mañana en la puerta del colegio, saluda a otro padre con «Goedemorgen!» y pregunta «Hoe gaat het?».",
    },
    "pareja": {
        "nl": "Bij de familie",
        "titulo": "Con su familia",
        "intro": "Para la próxima comida familiar: saludar, decir que está rico y dar las gracias.",
        "frases": [
            _f("Leuk om jullie te zien!", "¡Qué bien veros!"),
            _f("Hoe gaat het met jullie?", "¿Cómo estáis?"),
            _f("Het eten is heel lekker.", "La comida está muy rica."),
            _f("Mag ik nog een beetje?", "¿Puedo repetir un poco?"),
            _f("Bedankt voor de uitnodiging.", "Gracias por la invitación."),
        ],
        "ojo": "«Jullie» es vosotros. Con la familia, siempre «je» y «jullie», nunca «u» (salvo con los abuelos, si ellos lo prefieren).",
        "reto": "En la próxima comida, di «Het eten is heel lekker». Es la frase que más puntos da en una mesa holandesa.",
    },
    "dia": {
        "nl": "In de supermarkt",
        "titulo": "En el súper",
        "intro": "La caja del supermercado: la conversación en neerlandés que vas a tener más veces este mes.",
        "frases": [
            _f("Waar staat de melk?", "¿Dónde está la leche?"),
            _f("Mag ik pinnen?", "¿Puedo pagar con tarjeta?"),
            _f("Een tasje, alstublieft.", "Una bolsa, por favor."),
            _f("Wilt u het bonnetje?", "¿Quiere el recibo? (lo que te van a preguntar)", practica=False, oyes=True),
            _f("Nee, dank u.", "No, gracias."),
            _f("Fijne dag!", "¡Que tenga un buen día!"),
        ],
        "ojo": "«Pinnen» es pagar con tarjeta. En Países Bajos casi nadie paga en efectivo: la vas a oír todos los días.",
        "reto": "Hoy, en la caja, contesta en neerlandés: «Nee, dank u. Fijne dag!». Aunque te hablen en inglés.",
    },
}


def _donde_vive(r: dict) -> list[dict]:
    if r["vive"] == "fuera":
        return [
            _f("Ik woon nog niet in Nederland.", "Todavía no vivo en Países Bajos."),
            _f("Ik ga binnenkort verhuizen.", "Me mudo pronto."),
        ]
    if r["ciudad"]:
        return [_f(f"Ik woon in {r['ciudad']}.", f"Vivo en {r['ciudad']}.")]
    pais = _PAIS_NL[r["vive"]]
    return [_f(f"Ik woon in {pais}.", f"Vivo en {'Países Bajos' if r['vive'] == 'nl' else 'Bélgica'}.")]


def presentacion(nombre: str, r: dict) -> dict:
    """Su presentación entera, en una pieza, con su traducción. Pura."""
    origen = _ORIGEN_NL.get(r["origen"], "")
    origen_es = next((es for i, es, _nl in ORIGENES if i == r["origen"]), "")
    _es, trabajo_nl, trabajo_es = _TRABAJO[r["trabajo"]]
    nl = [f"Hoi, ik ben {nombre}."]
    es = [f"Hola, soy {nombre}."]
    if r["vive"] == "fuera":
        if origen:
            nl.append(f"Ik kom uit {origen}.")
            es.append(f"Soy de {origen_es}.")
        nl.append("Ik ga binnenkort in Nederland wonen.")
        es.append("Pronto voy a vivir en Países Bajos.")
    else:
        sitio = r["ciudad"] or _PAIS_NL[r["vive"]]
        sitio_es = r["ciudad"] or ("Países Bajos" if r["vive"] == "nl" else "Bélgica")
        if origen:
            nl.append(f"Ik kom uit {origen} en ik woon in {sitio}.")
            es.append(f"Soy de {origen_es} y vivo en {sitio_es}.")
        else:
            nl.append(f"Ik woon in {sitio}.")
            es.append(f"Vivo en {sitio_es}.")
    nl.append(trabajo_nl)
    es.append(trabajo_es)
    nl.append("Ik spreek Spaans en ik leer Nederlands.")
    es.append("Hablo español y estoy aprendiendo neerlandés.")
    nl.append("Ik spreek nog niet zo goed Nederlands, maar ik oefen elke dag.")
    es.append("Todavía no hablo muy bien neerlandés, pero practico cada día.")
    return {"nl": " ".join(nl), "es": " ".join(es), "frases": [_f(a, b) for a, b in zip(nl, es)]}


def armar(nombre: str, respuestas: dict) -> list[dict]:
    """Los siete días de esa persona. Pura: mismas respuestas, mismo plan."""
    r = limpiar_respuestas(respuestas)
    nombre = (nombre or "").strip().split(" ")[0] or "Ana"
    origen = _ORIGEN_NL.get(r["origen"], "")
    origen_es = next((es for i, es, _nl in ORIGENES if i == r["origen"]), "")
    trabajo_es, trabajo_nl, trabajo_tr = _TRABAJO[r["trabajo"]]

    d1 = [_f(f"Hoi, ik ben {nombre}.", f"Hola, soy {nombre}.")]
    if origen:
        d1.append(_f(f"Ik kom uit {origen}.", f"Soy de {origen_es}."))
    d1 += _donde_vive(r)
    d1 += [
        _f("Ik spreek Spaans.", "Hablo español."),
        _f("Ik leer Nederlands.", "Estoy aprendiendo neerlandés."),
        _f("En jij?", "¿Y tú?"),
    ]

    d2 = [
        _f("Sorry, ik begrijp het niet.", "Perdona, no lo entiendo."),
        _f("Kunt u dat herhalen, alstublieft?", "¿Puede repetirlo, por favor?"),
        _f("Kunt u wat langzamer praten?", "¿Puede hablar un poco más despacio?"),
        _f("Wat betekent dat?", "¿Qué significa eso?"),
        _f("Hoe zeg je dat in het Nederlands?", "¿Cómo se dice eso en neerlandés?"),
        _f("Ik spreek nog niet zo goed Nederlands.", "Todavía no hablo muy bien neerlandés."),
    ]
    if r["nivel"] == "algo":
        d2.append(_f("Zeg ik dat goed?", "¿Lo digo bien?"))

    d3 = [_f(trabajo_nl, trabajo_tr), _f("Wat voor werk doe jij?", "¿A qué te dedicas tú?")]
    if r["trabajo"] in _SIN_COMPANEROS:
        d3 += [_f("Ik ben overdag thuis.", "Durante el día estoy en casa."), _f("Ik heb het druk.", "Estoy muy ocupado.")]
    else:
        d3 += [_f("Ik werk van maandag tot en met vrijdag.", "Trabajo de lunes a viernes."), _f("Ik heb vandaag vrij.", "Hoy tengo el día libre.")]
    d3 += [_f("Tot morgen!", "¡Hasta mañana!"), _f("Fijn weekend!", "¡Buen fin de semana!")]

    principal = _SITUACIONES[r["motivo"]]
    # La segunda situación: el súper le sirve a todo el mundo; a quien ya lo
    # eligió, el médico.
    segunda = _SITUACIONES["medico" if r["motivo"] == "dia" else "dia"]

    d5 = [
        _f("Kan het op dinsdag?", "¿Puede ser el martes?"),
        _f("Hoe laat?", "¿A qué hora?"),
        _f("Om tien uur.", "A las diez."),
        _f("Morgen kan ik niet.", "Mañana no puedo."),
        _f("Dat is goed.", "Está bien."),
        _f("Tot donderdag!", "¡Hasta el jueves!"),
    ]

    p = presentacion(nombre, r)

    return [
        {
            "n": 1,
            "nl": "Wie ben ik?",
            "titulo": "Preséntate",
            "intro": f"Empezamos por ti, {nombre}. Estas frases son las tuyas: ya llevan tu nombre y tu sitio. Son las primeras que te van a pedir en cualquier parte.",
            "frases": d1,
            "ojo": "Para decir de dónde eres se usa «Ik kom uit…». Traducir «soy de» palabra por palabra («Ik ben van…») es el error número uno de quien habla español.",
            "reto": "Dilo tres veces en voz alta, de corrido. Y hoy, díselo a una persona: un vecino, alguien del trabajo, quien te atienda en una tienda.",
        },
        {
            "n": 2,
            "nl": "Sorry, wat zegt u?",
            "titulo": "Las frases salvavidas",
            "intro": "Lo que hace que cambies al inglés no es que no sepas: es que te hablan rápido y te quedas en blanco. Con estas frases, la conversación sigue en neerlandés.",
            "frases": d2,
            "ojo": "«Kunt u…?» es de usted y «Kun je…?» es de tú. Con desconocidos, en tiendas y en trámites, empieza siempre por «u».",
            "reto": "Hoy, cuando alguien te hable deprisa, no cambies al inglés. Di: «Kunt u wat langzamer praten?».",
        },
        {
            "n": 3,
            "nl": "Wat doe je?",
            "titulo": "Tu día",
            "intro": f"Después de tu nombre, lo siguiente que te preguntan es a qué te dedicas. Elegiste «{trabajo_es}»: así se dice lo tuyo.",
            "frases": d3,
            "ojo": "La profesión va sin artículo: «Ik ben kok» (soy cocinero), no «Ik ben een kok».",
            "reto": "Hoy despídete en neerlandés de una persona: «Tot morgen!» o «Fijn weekend!».",
        },
        {"n": 4, **{k: principal[k] for k in ("nl", "titulo", "intro", "frases", "ojo", "reto")}},
        {
            "n": 5,
            "nl": "Wanneer?",
            "titulo": "Quedar: días y horas",
            "intro": "Una cita en el médico, una entrega, un café: todo acaba en un día y una hora. Con seis frases lo resuelves.",
            "frases": d5,
            "ojo": "La hora lleva siempre «om» (om tien uur). Y cuidado: «half drie» son las dos y media, no las tres y media.",
            "extra": {
                "titulo": "Los días de la semana",
                "palabras": ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
            },
            "reto": "Mira tu agenda de esta semana y di en voz alta el día y la hora de una cosa que tengas: «Op vrijdag, om negen uur».",
        },
        {"n": 6, **{k: segunda[k] for k in ("nl", "titulo", "intro", "frases", "ojo", "reto")}},
        {
            "n": 7,
            "nl": "Dit ben ik",
            "titulo": "Tu presentación entera",
            "intro": f"Hace una semana no podías decir esto, {nombre}. Hoy lo juntas todo en una sola presentación. Léela, escúchala y dila sin mirar.",
            "frases": p["frases"],
            "presentacion": {"nl": p["nl"], "es": p["es"]},
            "ojo": "Fíjate en «maar ik oefen elke dag»: después de «maar» (pero) la frase sigue en su orden normal. No hace falta más gramática para sonar bien.",
            "reto": "Grábate diciéndola con el móvil y escúchate. Guarda ese audio: dentro de unas semanas vas a notar la diferencia.",
        },
    ]


# ── El reloj: un día cada día ────────────────────────────────────────────


def hoy_nl() -> str:
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("Europe/Amsterdam")).date().isoformat()


def leer_hechos(texto: str) -> dict[int, str]:
    try:
        d = json.loads(texto or "{}")
    except (ValueError, TypeError):
        return {}
    salida: dict[int, str] = {}
    if isinstance(d, dict):
        for k, v in d.items():
            if str(k).isdigit() and 1 <= int(k) <= DIAS and v:
                salida[int(k)] = str(v)
    return salida


def se_abre(inicio: str, n: int) -> str:
    """El día (AAAA-MM-DD) en que se abre el día `n`. Pura."""
    try:
        base = date.fromisoformat((inicio or "")[:10])
    except ValueError:
        base = date.today()
    return (base + timedelta(days=n - 1)).isoformat()


def esta_abierto(inicio: str, n: int, hoy: str, todo: bool = False) -> bool:
    return todo or se_abre(inicio, n) <= hoy


def siguiente(hechos: dict[int, str], inicio: str, hoy: str, todo: bool = False) -> int:
    """El día que le toca: el primero abierto sin hacer; si no hay, el último abierto. Pura."""
    abiertos = [n for n in range(1, DIAS + 1) if esta_abierto(inicio, n, hoy, todo)]
    for n in abiertos:
        if n not in hechos:
            return n
    return abiertos[-1] if abiertos else 1


# ── El enlace personal ───────────────────────────────────────────────────


def _secreto() -> str:
    from config.config import get_learnhouse_config

    return get_learnhouse_config().security_config.auth_jwt_secret_key or ""


def token_de(email: str) -> str:
    from src.services.payments.enlace import firmar

    return firmar({"e": email, "t": TIPO}, _secreto(), dias=DIAS_ENLACE)


def email_de(token: str) -> str:
    from src.services.payments.enlace import verificar

    datos = verificar(token or "", _secreto()) or {}
    return str(datos.get("e") or "") if datos.get("t") == TIPO else ""


def url_del_reto(token: str) -> str:
    from src.services.users.emails import _school_url

    return f"{_school_url()}/auth/primera-semana?t={token}"


def url_de_la_llamada(nombre: str, email: str, hoy: Optional[str] = None) -> str:
    """A dónde lleva el botón de la llamada: durante Black Friday, a su
    formulario (que ya admite nombre y correo); después, al proceso de admisión."""
    from urllib.parse import urlencode

    utm = {"utm_source": "reto", "utm_medium": "escuela", "utm_campaign": "mijn-eerste-week"}
    if (hoy or hoy_nl()) <= "2026-11-30":
        return "https://blackfriday.holandesnawar.com/admision?" + urlencode({"nombre": nombre, "email": email, **utm})
    return "https://www.holandesnawar.com/proceso-de-admision?" + urlencode(utm)


# ── Apuntarse, leer y avanzar ────────────────────────────────────────────


def _telefono(texto: Any) -> str:
    t = re.sub(r"[^\d+]", "", str(texto or ""))[:24]
    return "+" + t[2:] if t.startswith("00") else t


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _la_fila(email: str, db: AsyncSession) -> Optional[RetoSemana]:
    return (await db.execute(select(RetoSemana).where(RetoSemana.email == email).order_by(RetoSemana.id).limit(1))).scalars().first()  # type: ignore[arg-type]


def vista(fila: RetoSemana, todo: bool = False, hoy: Optional[str] = None) -> dict:
    """Lo que ve la persona: sus siete días, cuáles están abiertos y hechos.
    De un día cerrado solo salen el título y cuándo se abre: las frases, no."""
    hoy = hoy or hoy_nl()
    try:
        respuestas = json.loads(fila.respuestas or "{}")
    except (ValueError, TypeError):
        respuestas = {}
    hechos = leer_hechos(fila.hechos)
    dias = []
    for d in armar(fila.nombre, respuestas):
        abierto = esta_abierto(fila.inicio, d["n"], hoy, todo)
        base = {"n": d["n"], "nl": d["nl"], "titulo": d["titulo"], "abierto": abierto, "hecho": d["n"] in hechos, "se_abre": se_abre(fila.inicio, d["n"])}
        dias.append({**d, **base} if abierto else base)
    return {
        "nombre": (fila.nombre or "").split(" ")[0],
        "dias": dias,
        "hechos": len(hechos),
        "toca": siguiente(hechos, fila.inicio, hoy, todo),
        "frases": sum(len(d.get("frases") or []) for d in dias if d["hecho"]),
        "llamada": url_de_la_llamada(fila.nombre, fila.email, hoy),
        "todo_abierto": todo,
        "hoy": hoy,
    }


async def empezar(datos: dict, db: AsyncSession) -> dict:
    """Apuntarse al reto. El mismo correo otra vez no empieza de cero: se le
    devuelve su plan (con las respuestas nuevas solo si aún no ha hecho nada)."""
    email = str(datos.get("email") or "").strip().lower()[:255]
    nombre = re.sub(r"\s+", " ", str(datos.get("nombre") or "")).strip()[:120]
    if not nombre:
        raise RetoError("Escribe tu nombre")
    if not _CORREO_OK.match(email):
        raise RetoError("Escribe un correo válido")
    telefono = _telefono(datos.get("telefono"))
    if len(re.sub(r"\D", "", telefono)) < 6:
        raise RetoError("Escribe tu WhatsApp con el prefijo del país")
    respuestas = limpiar_respuestas(datos.get("respuestas"))

    fila = await _la_fila(email, db)
    nuevo = fila is None
    if fila is None:
        fila = RetoSemana(email=email, inicio=hoy_nl(), created_at=_ahora())
    if nuevo or not leer_hechos(fila.hechos):
        fila.respuestas = json.dumps(respuestas, ensure_ascii=False)
        fila.nombre = nombre
    fila.telefono = telefono or fila.telefono
    fila.updated_at = _ahora()
    db.add(fila)
    await db.commit()
    await db.refresh(fila)

    token = token_de(email)
    if nuevo:
        await _a_la_ficha(email, nombre, telefono, datos, respuestas, db)
        _mandar_enlace(email, nombre, token)
    return {"ok": True, "nuevo": nuevo, "token": token}


async def _a_la_ficha(email: str, nombre: str, telefono: str, datos: dict, respuestas: dict, db: AsyncSession) -> None:
    """Queda en Contactos, con de dónde vino. En blando: sin esto, el reto funciona igual."""
    try:
        from src.db.contact_event import ContactEvent

        def corto(campo: str, n: int = 120) -> str:
            return str(datos.get(campo) or "").strip()[:n]

        partes = nombre.split(" ", 1)
        db.add(
            ContactEvent(
                email=email,
                kind=TIPO,
                source="reto",
                first_name=partes[0][:120],
                last_name=(partes[1] if len(partes) > 1 else "")[:120],
                phone=telefono,
                recorrido=corto("recorrido", 400),
                referrer=corto("referrer"),
                extra=json.dumps({"respuestas": respuestas}, ensure_ascii=False)[:2000],
                **{c: corto(c) for c in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_placement")},
                created_at=_ahora(),
            )
        )
        await db.commit()
    except Exception as exc:  # pragma: no cover - en blando
        logger.warning("Reto: no se pudo apuntar en la ficha: %s", exc)
        await db.rollback()


def _mandar_enlace(email: str, nombre: str, token: str) -> None:
    """Su enlace personal, por si cierra la pestaña. En blando: lo tiene en pantalla."""
    try:
        from src.services.users.emails import send_carta_ebook_email

        pila = (nombre or "").split(" ")[0]
        send_carta_ebook_email(
            email,
            "Tu primera semana en neerlandés empieza hoy",
            (
                f"Hola {pila}:\n\n"
                "Ya está montada tu primera semana en neerlandés. Son siete días, diez minutos al día, "
                "con las frases de tu situación y con tus datos ya puestos.\n\n"
                "Guarda este correo: el botón de abajo es tu enlace personal. Con él entras siempre, sin contraseña.\n\n"
                "[boton]\n\n"
                "Cada día se abre uno nuevo. El de hoy ya te está esperando.\n\n"
                "Rida"
            ),
            botones=[("boton", "Abrir mi primera semana", url_del_reto(token))],
            por_que="Te escribimos porque te apuntaste a «Mijn eerste week», tu primera semana en neerlandés.",
        )
    except Exception as exc:  # pragma: no cover - en blando
        logger.warning("Reto: no se pudo mandar el enlace: %s", exc)


async def leer(token: str, db: AsyncSession, todo: bool = False) -> dict:
    email = email_de(token)
    fila = await _la_fila(email, db) if email else None
    if fila is None:
        raise RetoError("Este enlace ya no vale. Vuelve a apuntarte con tu correo y te damos uno nuevo.", 404)
    return vista(fila, todo)


async def terminar_dia(token: str, n: int, db: AsyncSession, todo: bool = False) -> dict:
    email = email_de(token)
    fila = await _la_fila(email, db) if email else None
    if fila is None:
        raise RetoError("Este enlace ya no vale.", 404)
    if not 1 <= n <= DIAS:
        raise RetoError("Ese día no existe")
    if not esta_abierto(fila.inicio, n, hoy_nl(), todo):
        raise RetoError("Ese día todavía no está abierto", 409)
    hechos = leer_hechos(fila.hechos)
    if n not in hechos:
        hechos[n] = _ahora()
        fila.hechos = json.dumps({str(k): v for k, v in sorted(hechos.items())})
        fila.updated_at = _ahora()
        db.add(fila)
        await db.commit()
        await db.refresh(fila)
    return vista(fila, todo)


async def pulso_la_llamada(token: str, db: AsyncSession) -> None:
    email = email_de(token)
    fila = await _la_fila(email, db) if email else None
    if fila is not None and not fila.llamada_at:
        fila.llamada_at = _ahora()
        db.add(fila)
        await db.commit()


# ── Para el closer ───────────────────────────────────────────────────────


def resumen(fila: RetoSemana, hoy: Optional[str] = None) -> dict:
    """Lo que ve el closer en la ficha. Pura sobre la fila."""
    try:
        r = limpiar_respuestas(json.loads(fila.respuestas or "{}"))
    except (ValueError, TypeError):
        r = limpiar_respuestas({})
    hechos = leer_hechos(fila.hechos)
    ultimo = max(hechos.values()) if hechos else ""
    origen_es = next((es for i, es, _nl in ORIGENES if i == r["origen"]), "")
    vive = next((v["nombre"] for v in VIVE if v["id"] == r["vive"]), "")
    return {
        "empezo": fila.inicio,
        "hechos": len(hechos),
        "de": DIAS,
        "dias": sorted(hechos),
        "ultimo": ultimo,
        "motivo": _MOTIVOS.get(r["motivo"], ""),
        "trabajo": _TRABAJO[r["trabajo"]][0],
        "nivel": _NIVELES.get(r["nivel"], ""),
        "vive": f"{vive}{' · ' + r['ciudad'] if r['ciudad'] else ''}",
        "origen": origen_es if r["origen"] != "otro" else "",
        "pulso_llamada": bool(fila.llamada_at),
        # A quién se llama primero: quien ha hecho cinco o más, o pidió la llamada.
        "caliente": len(hechos) >= 5 or bool(fila.llamada_at),
    }


async def para_la_ficha(email: str, db: AsyncSession) -> Optional[dict]:
    fila = await _la_fila((email or "").strip().lower(), db)
    return resumen(fila) if fila is not None else None


async def todos(db: AsyncSession) -> list[dict]:
    """Todos los que han empezado, lo más reciente arriba (para el panel)."""
    filas = (await db.execute(select(RetoSemana).order_by(RetoSemana.created_at.desc()))).scalars().all()  # type: ignore[attr-defined]
    return [{"email": f.email, "nombre": f.nombre, "telefono": f.telefono, **resumen(f)} for f in filas]

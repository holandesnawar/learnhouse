"""
El ebook de Black Friday a 1 € y la campaña de correos que le sigue
(28/10/2026).

Pedido del usuario: "la página del ebook, dos (una orgánico y otra ads), de
ahí hacen la compra y en la página de gracias vamos a
blackfriday.holandesnawar.com, la landing de la formación… que les llegue el
mail cuando compre… y al comprar apuntarse a una campaña de mails para ir
calentando a los que aún no compraron". El ebook es el «Ebook A0-A1» de
siempre con otro nombre, «Neerlandés sin miedo», a 1 € (imán de leads). La
campaña va del 29/10 al 30/11/2026.

Por qué en la escuela y no en systeme.io (decidido con el usuario)
------------------------------------------------------------------
- **Cada comprador sale en el panel** (Contactos, con «Ads» u «Orgánico»), y
  cuando rellena el formulario pasa a Matrículas como cualquier otro: se ve
  cuántos compran el ebook, cuántos agendan y cuántos pagan.
- **La campaña se para sola** en cuanto alguien reserva la llamada o paga la
  formación: la escuela lo sabe. En systeme.io eso era el lío de etiquetas
  de siempre.
- **La caja de pago es la de Stripe de siempre**, embebida en la página del
  ebook (la monta la web, `nawar-web/src/pages/black-friday/`): iDEAL,
  Bancontact, tarjeta y la factura NAWAR que emite Stripe.
- systeme.io solo recibe la etiqueta «Ebook Black Friday», para que la
  persona siga en la lista del usuario.

Qué NO es
---------
- **No es una matrícula ni da cuenta de alumno.** No se toca `enrollment`
  (medio panel lee una fila `paid` como "es alumno"). La compra se apunta como
  un `contact_event` de tipo `ebook`, con la campaña de la que vino y la
  sesión de Stripe en `extra`; así sale en la ficha y no cuenta como venta de
  la formación.
- No entra en el tablero de Matrículas por comprar el ebook (igual que quien
  baja una guía gratis): entra cuando empieza el formulario de la llamada.

La entrega
----------
Al pagar (`al_pagar`, desde el webhook de Stripe y también desde la página
de vuelta, por si el aviso tarda) sale el correo con el enlace de descarga.
Una vez por compra: la marca es el propio `contact_event`, que se apunta
antes de mandar y se borra si el envío falla (como el correo de Rida). El
PDF lo sube el administrador en Panel → Avisos → «Ebook Black Friday» y vive
en `content/privado/ebook/` (dentro del volumen, entra en la copia diaria;
`/content` nunca sirve `privado/`). Se baja con un enlace firmado que dura un
año (`/api/v1/ebook/descarga/{token}`).

La campaña, por segmentos (28/10, quinta vuelta: "segmentar bien")
------------------------------------------------------------------
- **Dejó sus datos y no compró el ebook** (portada o caja abierta): el
  recordatorio del ebook al día siguiente (`pendiente`) y, el Black Friday y el
  último día, los dos correos del ebook (`para: sin_comprar`). Nada de la
  formación.
- **Compró el ebook**: la campaña de la formación (c1…último), que lleva a la
  llamada.
  - Si **empieza el formulario de la llamada y no reserva** (o lo termina y no
    reserva), al día siguiente «Te quedaste a un paso de tu llamada»
    (`formulario`), en lugar del de la campaña de ese día. Después, sigue.
  - Si **termina las preguntas y no encaja** (`cualificacion` con `apto`
    false), sale de la campaña: ya se le dijo que ahora no es para él.
- **Reservó, pagó la formación o se dio de baja**: no recibe nada más.

La lanza la tarea diaria del goteo (`/notifications/drip-diario`, 07:00 UTC).
Cada correo lleva `dia` (días después de la compra) o `fecha` (un día fijo:
el Black Friday y el último día). Reglas (`que_toca`, pura con test):
- **Uno al día como mucho**, y ninguno el día de la compra (ya le llegó el
  ebook). El de fecha fija gana ese día; los de `dia` esperan.
- Un correo de `dia` que llega con más de `RETRASO_MAX` días de retraso se
  salta: un «¿has abierto la lección 1?» a las dos semanas no pinta nada.
- Nada después de `hasta`.
- **Se para** si ha reservado una llamada (`reunion`, `llamada-equipo`,
  `correo-reserva`), si ya pagó la formación o si se ha dado de baja (enlace
  al pie de cada correo, `baja-bf`).
Cada correo enviado deja un `contact_event` `correo-bf` (con su id en
`extra`): es la marca de que ya salió y lo que se cuenta en el panel. El
registro de la tarea diaria solo lleva números (el repo es público).

Quien deja sus datos y no paga (28/10)
--------------------------------------
Al abrir la caja de pago (`crear_pago`) se apunta un `ebook-empezado` con su
nombre, su correo y de dónde vino (`_apuntar_empezado`, uno por persona y
día). Sale en su ficha. Si no llega a comprar, al día siguiente le llega UN
correo, «Tu ebook de 1 € te está esperando» (`pendiente`, editable en el panel
y con su baja al pie), con el botón a la página del ebook y sus datos puestos
(`toca_pendiente`, pura con test). Lo mismo a quien se apuntó en la portada
y no compró: uno por persona, cuente lo que cuente. No le llega si compra, reserva llamada,
paga la formación o se da de baja. Antes de esto, esa gente se perdía: solo
quedaba como cliente en Stripe.

La portada: desbloquear la oferta, que ES el ebook (28/10, como YouTalk)
------------------------------------------------------------------------
La portada de blackfriday.holandesnawar.com es solo un formulario (nombre,
correo y WhatsApp) para desbloquear la oferta, sin una palabra de la
formación. La oferta desbloqueada es el ebook a 1 € (usuario: "todo gira al
inicio en torno al ebook"). `apuntar_lista` lo apunta en su ficha (`bf-lista`,
uno por persona), le manda al momento el correo de acceso (`acceso`, con el
botón a la página del ebook y sus datos puestos) y le etiqueta en systeme.io
(«Black Friday - lista»). Si al día siguiente no ha comprado, le llega el
recordatorio (`pendiente`, el mismo de quien abrió la caja y no pagó).
**La campaña es solo para quien compra el ebook**: tras pagar, Stripe le lleva
a /oferta («¡No cierres esta página!», nuestra mejor oferta y el botón a la
llamada), y los correos de la campaña le llevan a la llamada.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode, urlparse

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

CLAVE = "ebook_bf"
PRODUCTO = "ebook-bf"
TIPO_COMPRA = "ebook"
TIPO_CORREO = "correo-bf"
TIPO_BAJA = "baja-bf"
# Dejó nombre y correo en la ventanita y se abrió la caja de pago (28/10):
# para el recordatorio de quien no termina de pagar.
TIPO_EMPEZADO = "ebook-empezado"
ID_PENDIENTE = "pendiente"
# Se apuntó en blackfriday.holandesnawar.com para desbloquear la oferta, sin
# comprar el ebook (28/10, como YouTalk).
TIPO_LISTA = "bf-lista"
ID_ACCESO = "acceso"
# Compró el ebook y empezó el formulario de la llamada (o lo terminó) sin
# reservar hora: un correo para que lo termine (28/10, quinta vuelta).
ID_FORMULARIO = "formulario"
TIPOS_FORMULARIO = ("agendar-empezado", "cualificacion")
#: A quién va cada correo de la campaña.
PARA_COMPRADORES = "compradores"
PARA_SIN_COMPRAR = "sin_comprar"
#: Lo que cuenta como "ya ha reservado su llamada": la campaña se para.
TIPOS_RESERVO = ("reunion", "llamada-equipo", "correo-reserva")

NOMBRE_EBOOK = "Neerlandés sin miedo"
SUBTITULO_EBOOK = "7 lecciones para arrancar desde cero (nivel A0-A1)"
PRODUCTO_STRIPE = f"{NOMBRE_EBOOK} · Ebook A0-A1"

DIAS_DESCARGA = 365
RETRASO_MAX = 2
TOPE_POR_DIA = 400
CONTENT_DIR = Path("content")
CARPETA = "privado/ebook"
MAX_PDF = 40 * 1024 * 1024
HUECOS = ("nombre", "hasta")

_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

_FIRMA = "Un abrazo,\nRida Nawar\nFundador de Holandés Nawar"

DE_FABRICA: dict = {
    "activo": True,
    "campana": True,
    "desde": "2026-10-29",
    "hasta": "2026-11-30",
    "precio_cents": 100,
    "entrega": {
        "asunto": "Tu ebook «Neerlandés sin miedo» ya está aquí",
        "texto": (
            "¡Hola, {nombre}!\n\n"
            "Gracias por tu compra. Aquí tienes tu ebook *Neerlandés sin miedo*: 7 lecciones para arrancar "
            "desde cero, con su vocabulario, sus ejercicios y todas las respuestas para que te corrijas tú.\n\n"
            "[descarga]\n\n"
            "Un consejo para sacarle partido: una lección al día y en voz alta. Leer el neerlandés en silencio "
            "engaña, porque crees que lo sabes hasta que lo tienes que decir.\n\n"
            "Y una cosa más. Hasta el {hasta} tenemos condiciones especiales de Black Friday para la "
            "Formación Nawar A0-A1, el camino completo de cero al A1 en 16 semanas. Si quieres saber si "
            "encaja contigo, mira cómo funciona y pide tu llamada gratuita.\n\n"
            "[boton]\n\n" + _FIRMA
        ),
        "boton": "Ver la Formación Nawar",
        "destino": "landing",
    },
    # Para quien dejó sus datos (en la portada o en la caja de pago) y no
    # compró el ebook: uno, al día siguiente.
    "pendiente": {
        "asunto": "Tu ebook de 1 € te está esperando",
        "texto": (
            "¡Hola, {nombre}!\n\n"
            "Te quedaste a un paso de *Neerlandés sin miedo*, el ebook para arrancar con el neerlandés desde "
            "cero. Si se te cortó el pago o simplemente se te pasó, te lo he dejado preparado: con un clic "
            "vuelves y es tuyo.\n\n"
            "Sigue a 1 € hasta el {hasta}.\n\n"
            "[boton]\n\n"
            "Si tuviste algún problema al pagar, contesta a este correo y te ayudamos.\n\n" + _FIRMA
        ),
        "boton": "Conseguir mi ebook",
        "destino": "ebook",
    },
    # Al apuntarse en la portada para desbloquear la oferta: al momento. La
    # oferta desbloqueada ES el ebook a 1 €.
    "acceso": {
        "asunto": "Tu oferta de Black Friday está desbloqueada",
        "texto": (
            "¡Hola, {nombre}!\n\n"
            "Ya tienes desbloqueada tu oferta de Black Friday: *Neerlandés sin miedo*, nuestro ebook para "
            "arrancar con el neerlandés desde cero, por solo 1 €.\n\n"
            "Son 7 lecciones explicadas en español, con el vocabulario, los ejercicios y todas las respuestas "
            "para que te corrijas tú. En PDF y para siempre.\n\n"
            "La oferta vale hasta el {hasta}.\n\n"
            "[boton]\n\n" + _FIRMA
        ),
        "boton": "Conseguir mi ebook por 1 €",
        "destino": "ebook",
    },
    # A quien compró el ebook, empezó a pedir su llamada y no reservó hora:
    # uno, al día siguiente de lo último que hizo en el formulario.
    "formulario": {
        "asunto": "Te quedaste a un paso de tu llamada",
        "texto": (
            "¡Hola, {nombre}!\n\n"
            "Empezaste a pedir tu llamada de admisión, pero no llegaste a reservar la hora. Te lo he dejado "
            "preparado: entras, terminas en un minuto y eliges el día que mejor te venga.\n\n"
            "En la llamada te contamos las condiciones de Black Friday de la Formación Nawar A0-A1, que valen "
            "hasta el {hasta}. Es gratuita, de media hora y sin compromiso.\n\n"
            "[boton]\n\n" + _FIRMA
        ),
        "boton": "Terminar mi solicitud",
        "destino": "admision",
    },
    "correos": [
        {
            "id": "c1",
            "dia": 1,
            "asunto": "Cómo sacarle partido a tu ebook",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Ayer te llegó *Neerlandés sin miedo*. Te cuento cómo aprovecharlo, porque un PDF se queda "
                "muy fácil olvidado en la carpeta de descargas.\n\n"
                "*Una lección al día.* Siete lecciones, siete días. No hace falta más.\n\n"
                "*En voz alta.* Leer el neerlandés en silencio engaña: crees que lo sabes hasta que lo "
                "tienes que decir.\n\n"
                "*Los ejercicios, sin mirar las respuestas.* Están al final para que te corrijas tú, no para "
                "leerlas antes.\n\n"
                "Si te atascas con algo, contesta a este correo y te echamos una mano.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Abrir el ebook",
            "destino": "descarga",
        },
        {
            "id": "c2",
            "dia": 3,
            "asunto": "Por qué el neerlandés se atasca (y no es culpa tuya)",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Hay una frase que oímos mucho: «Llevo años aquí y sigo sin atreverme a hablar».\n\n"
                "Casi nunca es por falta de ganas. Es porque se estudia a ratos, sin un orden y sin nadie que "
                "te diga qué está bien y qué no. Así se acumulan palabras sueltas, pero cuando toca llamar al "
                "médico, leer una carta del ayuntamiento o hablar con el profe de tus hijos, sigues "
                "dependiendo de otros.\n\n"
                "Yo empecé con el neerlandés por obligación. Me quemaba tener que depender de otros para las "
                "cosas más normales. Por eso la Formación Nawar A0-A1 es un camino: 16 semanas, 10 módulos, "
                "y cada semana sabes qué toca y alguien revisa lo que haces.\n\n"
                "Hasta el {hasta} tenemos condiciones especiales de Black Friday. No te las cuento aquí: te "
                "las explica nuestro equipo en una llamada gratuita, después de entender tu situación y ver si "
                "de verdad podemos ayudarte.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Pedir mi llamada gratuita",
            "destino": "admision",
        },
        {
            "id": "c3",
            "dia": 5,
            "asunto": "Así es una semana dentro de la escuela",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Te enseño cómo es una semana normal en la Formación Nawar, para que no te lo tengas que "
                "imaginar:\n\n"
                "1️⃣ Lecciones cortas con su vídeo, el vocabulario con audio y ejercicios interactivos. Las "
                "haces cuando te va bien, desde el móvil o el ordenador.\n\n"
                "2️⃣ Una masterclass en directo cada semana sobre un tema concreto, para usarlo esa misma "
                "semana. Si no puedes ir, queda grabada.\n\n"
                "3️⃣ Grupos de conversación para hablar de verdad, sin vergüenza, con gente de tu nivel.\n\n"
                "4️⃣ Una tarea cada semana que entregas por escrito o con una nota de voz, y que te devolvemos "
                "corregida.\n\n"
                "5️⃣ Y si te surge una duda, la preguntas en Consultas y te contestamos.\n\n"
                "Así, semana a semana, durante 16 semanas, hasta el A1.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Quiero saber si encaja conmigo",
            "destino": "admision",
        },
        {
            "id": "c4",
            "dia": 7,
            "asunto": "Las tres dudas que más nos llegan",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Antes de dar el paso, casi todo el mundo nos pregunta lo mismo. Te dejo las tres dudas que "
                "más se repiten:\n\n"
                "*«No tengo tiempo.»* La formación está pensada para quien va con prisas. Las lecciones son "
                "cortas y las haces cuando puedes; lo que cuenta es la constancia, no las horas.\n\n"
                "*«Empiezo desde cero.»* Perfecto: el camino empieza por lo más básico y va subiendo poco a "
                "poco hasta el A1.\n\n"
                "*«¿Y si no es para mí?»* Tienes 15 días de garantía. Y antes de nada hablamos contigo: si "
                "vemos que no podemos ayudarte, te lo decimos.\n\n"
                "Si tienes otra duda, la resolvemos en la llamada. Es gratuita y sin compromiso.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Pedir mi llamada gratuita",
            "destino": "admision",
        },
        {
            "id": "bf",
            "fecha": "2026-11-27",
            "asunto": "Hoy es Black Friday",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Hoy es Black Friday, y queda poco para que se acaben las condiciones especiales de la "
                "Formación Nawar A0-A1: valen hasta el {hasta} a medianoche.\n\n"
                "Si llevas tiempo pensando en ponerte en serio con el neerlandés, este es el momento. Pide tu "
                "llamada gratuita: nuestro equipo de admisiones verá tu caso y te contará las condiciones.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Pedir mi llamada gratuita",
            "destino": "admision",
        },
        {
            "id": "ultimo",
            "fecha": "2026-11-30",
            "asunto": "Último día",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Hoy es el último día. A medianoche se acaban las condiciones especiales de Black Friday de "
                "la Formación Nawar A0-A1.\n\n"
                "Si quieres que veamos tu caso, pide hoy tu llamada. Y si no es tu momento, no pasa nada: "
                "sigue con tu ebook, que ahí tienes las bases.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Pedir mi llamada hoy",
            "destino": "admision",
        },
        # Para quien dejó sus datos y NO compró el ebook: la oferta que
        # desbloqueó es el ebook, así que de eso hablan (nada de la formación).
        {
            "id": "e-bf",
            "fecha": "2026-11-27",
            "para": PARA_SIN_COMPRAR,
            "asunto": "Hoy es Black Friday: tu ebook sigue a 1 €",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Hoy es Black Friday, y tu oferta sigue desbloqueada: *Neerlandés sin miedo*, el ebook para "
                "arrancar con el neerlandés desde cero, por 1 €.\n\n"
                "Son 7 lecciones explicadas en español, con el vocabulario, los ejercicios y todas las "
                "respuestas. La oferta termina el {hasta}.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Conseguir mi ebook por 1 €",
            "destino": "ebook",
        },
        {
            "id": "e-ultimo",
            "fecha": "2026-11-30",
            "para": PARA_SIN_COMPRAR,
            "asunto": "Último día para tu ebook a 1 €",
            "texto": (
                "¡Hola, {nombre}!\n\n"
                "Hoy es el último día. A medianoche *Neerlandés sin miedo* deja de estar a 1 €.\n\n"
                "Si quieres empezar con el neerlandés con una base clara y en español, este es el momento.\n\n"
                "[boton]\n\n" + _FIRMA
            ),
            "boton": "Conseguir mi ebook por 1 €",
            "destino": "ebook",
        },
    ],
}

DESTINOS = ("admision", "landing", "descarga", "ebook")

#: Los textos de fábrica de antes del 28/10 (tercera vuelta). Si están
#: guardados TAL CUAL (el panel guarda las cartas enteras aunque no se toquen),
#: se usan los de ahora: el de acceso llevaba a la formación y ya no toca. Uno
#: retocado en el panel se respeta.
_FABRICA_ANTERIOR = {
    "acceso": (
        "¡Hola, {nombre}!\n\n"
        "Ya tienes acceso anticipado a las condiciones de Black Friday de la Formación Nawar A0-A1: "
        "el camino completo de cero al A1 en 16 semanas, explicado en español y con clases en directo "
        "cada semana.\n\n"
        "Las condiciones no te las cuento por aquí: te las explica nuestro equipo en una llamada "
        "gratuita de media hora, después de entender tu situación. Valen hasta el {hasta}.\n\n"
        "Aquí tienes tu oferta, con todo lo que incluye la formación:\n\n"
        "[boton]\n\n" + _FIRMA
    ),
    "pendiente": (
        "¡Hola, {nombre}!\n\n"
        "Empezaste a pedir *Neerlandés sin miedo*, pero el pago no llegó a terminarse. A veces es la "
        "tarjeta, a veces se corta la conexión. Pasa.\n\n"
        "Si todavía lo quieres, te lo he dejado preparado: con un clic vuelves y lo terminas. Sigue a "
        "1 € hasta el {hasta}.\n\n"
        "[boton]\n\n"
        "Si tuviste algún problema al pagar, contesta a este correo y te ayudamos.\n\n" + _FIRMA
    ),
}


def _sin_espacios(t: Any) -> str:
    return re.sub(r"\s+", " ", str(t or "")).strip()


class EbookError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def _fecha(texto: Any) -> str:
    try:
        return date.fromisoformat(str(texto or "")[:10]).isoformat()
    except (TypeError, ValueError):
        return ""


def dia_largo(dia: str) -> str:
    """«2026-11-30» → «lunes 30 de noviembre»."""
    try:
        d = date.fromisoformat(dia[:10])
    except (TypeError, ValueError):
        return dia or ""
    return f"{_DIAS[d.weekday()]} {d.day} de {_MESES[d.month - 1]}"


def ventas_abiertas(cfg: dict, hoy: str) -> tuple[bool, str]:
    """¿Se puede comprar hoy? Encendido y sin haber pasado `hasta`. El
    `desde` no cierra: así se puede probar el día antes de empezar."""
    if not cfg.get("activo"):
        return False, "La venta del ebook está cerrada ahora mismo."
    if cfg.get("hasta") and hoy > cfg["hasta"]:
        return False, "La oferta de Black Friday ya ha terminado."
    return True, ""


def que_toca(compra: str, hoy: str, correos: list[dict], enviados: set[str], hasta: str, ultimo_envio: str = "") -> Optional[dict]:
    """El correo de la campaña que le toca HOY a quien compró el día `compra`
    (AAAA-MM-DD, hora de Países Bajos), o None. Ver la cabecera del módulo."""
    if not compra or hoy <= compra or (hasta and hoy > hasta) or ultimo_envio == hoy:
        return None
    for c in correos:
        if c.get("fecha") and c["fecha"] == hoy and c["id"] not in enviados:
            return c
    for c in sorted((c for c in correos if not c.get("fecha")), key=lambda c: int(c.get("dia") or 0)):
        if c["id"] in enviados:
            continue
        cuando = (date.fromisoformat(compra) + timedelta(days=int(c.get("dia") or 0))).isoformat()
        if cuando > hoy:
            return None
        if (date.fromisoformat(hoy) - date.fromisoformat(cuando)).days > RETRASO_MAX:
            continue
        return c
    return None


def para_quien(c: dict) -> str:
    """A quién va un correo de la campaña: a quien compró el ebook (de serie)
    o a quien dejó sus datos y no lo compró."""
    return PARA_SIN_COMPRAR if c.get("para") == PARA_SIN_COMPRAR else PARA_COMPRADORES


def toca_formulario(ultimo: str, hoy: str, enviados: set[str], hasta: str, ultimo_envio: str = "") -> bool:
    """¿Le toca hoy el «te quedaste a un paso de tu llamada» a quien compró el
    ebook y tocó el formulario de la llamada por última vez el día `ultimo` sin
    reservar? Al día siguiente (o hasta RETRASO_MAX días tarde), una vez."""
    if not ultimo or ID_FORMULARIO in enviados or ultimo_envio == hoy or (hasta and hoy > hasta):
        return False
    dias = (date.fromisoformat(hoy) - date.fromisoformat(ultimo)).days
    return 1 <= dias <= 1 + RETRASO_MAX


def toca_pendiente(empezo: str, hoy: str, enviados: set[str], hasta: str, ultimo_envio: str = "") -> bool:
    """¿Le toca hoy el recordatorio a quien empezó a pedir el ebook el día
    `empezo` y no lo pagó? Al día siguiente (o hasta RETRASO_MAX días tarde,
    si la tarea diaria falló), una sola vez y nunca después del final."""
    if not empezo or ID_PENDIENTE in enviados or ultimo_envio == hoy or (hasta and hoy > hasta):
        return False
    dias = (date.fromisoformat(hoy) - date.fromisoformat(empezo)).days
    return 1 <= dias <= 1 + RETRASO_MAX


def huecos_que_no_valen(texto: str) -> list[str]:
    return sorted({h for h in re.findall(r"\{([^{}]*)\}", texto or "") if h not in HUECOS})


def rellenar(texto: str, valores: dict) -> str:
    """Los huecos a mano (sin .format()). Sin nombre, «¡Hola, {nombre}!» queda
    «¡Hola!»."""
    salida = texto or ""
    for h in HUECOS:
        salida = salida.replace("{" + h + "}", str(valores.get(h) or ""))
    if not valores.get("nombre"):
        salida = re.sub(r"\s*,\s*(?=[!.:])", "", salida)
    return salida


def nombre_pila(nombre: str) -> str:
    n = (nombre or "").strip().split(" ")[0]
    return n[:1].upper() + n[1:].lower() if n else ""


def vuelta_segura(vuelta: str, por_defecto: str) -> str:
    """A dónde vuelve Stripe tras pagar: solo una página nuestra (o local, para
    probar). Cualquier otra cosa, la de Black Friday de siempre."""
    try:
        u = urlparse((vuelta or "").strip())
    except ValueError:
        return por_defecto
    host = (u.hostname or "").lower()
    nuestra = host == "holandesnawar.com" or host.endswith(".holandesnawar.com") or host in ("localhost", "127.0.0.1")
    return vuelta.strip() if u.scheme in ("http", "https") and nuestra else por_defecto


def con_compra(vuelta: str) -> str:
    """La vuelta con el hueco que rellena Stripe (sin codificar: Stripe busca
    el texto literal)."""
    return f"{vuelta}{'&' if '?' in vuelta else '?'}compra={{CHECKOUT_SESSION_ID}}"


def correos_limpios(guardados: Any) -> list[dict]:
    """Los de fábrica, con lo que se haya cambiado en el panel encima (por id).
    Un correo guardado sin asunto o sin texto vuelve al de fábrica."""
    por_id = {c.get("id"): c for c in guardados if isinstance(c, dict)} if isinstance(guardados, list) else {}
    salida = []
    for base in DE_FABRICA["correos"]:
        g = por_id.get(base["id"]) or {}
        c = dict(base)
        for campo in ("asunto", "texto", "boton"):
            v = str(g.get(campo) or "").strip()
            if v:
                c[campo] = v
        if g.get("destino") in DESTINOS:
            c["destino"] = g["destino"]
        if "fecha" in base:
            c["fecha"] = _fecha(g.get("fecha")) or base["fecha"]
        else:
            try:
                c["dia"] = max(1, min(60, int(g.get("dia") or base["dia"])))
            except (TypeError, ValueError):
                c["dia"] = base["dia"]
        c["apagado"] = bool(g.get("apagado"))
        salida.append(c)
    return salida


def _carta_limpia(guardada: Any, clave: str) -> dict:
    """Un correo suelto (el de entrega, el de «se quedó a medias»): el de
    fábrica con lo cambiado en el panel encima."""
    g = guardada if isinstance(guardada, dict) else {}
    if clave in _FABRICA_ANTERIOR and _sin_espacios(g.get("texto")) == _sin_espacios(_FABRICA_ANTERIOR[clave]):
        g = {}
    carta = dict(DE_FABRICA[clave])
    for campo in ("asunto", "texto", "boton"):
        v = str(g.get(campo) or "").strip()
        if v:
            carta[campo] = v
    if g.get("destino") in DESTINOS:
        carta["destino"] = g["destino"]
    return carta


def config_limpia(guardado: Any) -> dict:
    g = guardado if isinstance(guardado, dict) else {}
    entrega = _carta_limpia(g.get("entrega"), "entrega")
    pendiente = _carta_limpia(g.get("pendiente"), "pendiente")
    pendiente["apagado"] = bool(g["pendiente"].get("apagado")) if isinstance(g.get("pendiente"), dict) else False
    acceso = _carta_limpia(g.get("acceso"), "acceso")
    acceso["apagado"] = bool(g["acceso"].get("apagado")) if isinstance(g.get("acceso"), dict) else False
    formulario = _carta_limpia(g.get(ID_FORMULARIO), ID_FORMULARIO)
    formulario["apagado"] = bool(g[ID_FORMULARIO].get("apagado")) if isinstance(g.get(ID_FORMULARIO), dict) else False
    try:
        precio = int(g.get("precio_cents") or DE_FABRICA["precio_cents"])
    except (TypeError, ValueError):
        precio = DE_FABRICA["precio_cents"]
    return {
        "activo": bool(g.get("activo", DE_FABRICA["activo"])),
        "campana": bool(g.get("campana", DE_FABRICA["campana"])),
        "desde": _fecha(g.get("desde")) or DE_FABRICA["desde"],
        "hasta": _fecha(g.get("hasta")) or DE_FABRICA["hasta"],
        "precio_cents": max(50, precio),
        "entrega": entrega,
        "pendiente": pendiente,
        "acceso": acceso,
        ID_FORMULARIO: formulario,
        "correos": correos_limpios(g.get("correos")),
        "pdf": str(g.get("pdf") or ""),
        "pdf_nombre": str(g.get("pdf_nombre") or ""),
        "pdf_subido_en": str(g.get("pdf_subido_en") or ""),
    }


# ── Enlaces ─────────────────────────────────────────────────────────────────


def bf_url() -> str:
    """La página de Black Friday (sin barra al final)."""
    return (os.environ.get("LEARNHOUSE_BLACKFRIDAY_URL") or "https://blackfriday.holandesnawar.com").rstrip("/")


def _secreto() -> str:
    from config.config import get_learnhouse_config

    return get_learnhouse_config().security_config.auth_jwt_secret_key or ""


def _api_url() -> str:
    from src.services.users.emails import _school_url

    return _school_url().rstrip("/") + "/api/v1/ebook"


def enlace_descarga(email: str) -> str:
    from src.services.payments.enlace import firmar

    return f"{_api_url()}/descarga/{firmar({'e': email, 't': 'ebook'}, _secreto(), dias=DIAS_DESCARGA)}"


def enlace_baja(email: str) -> str:
    from src.services.payments.enlace import firmar

    return f"{_api_url()}/baja/{firmar({'e': email, 't': 'baja'}, _secreto(), dias=DIAS_DESCARGA)}"


def leer_token(token: str, tipo: str) -> str:
    """El correo de un enlace firmado de ese tipo, o ""."""
    from src.services.payments.enlace import verificar

    datos = verificar(token or "", _secreto()) or {}
    return str(datos.get("e") or "") if datos.get("t") == tipo else ""


def url_destino(destino: str, email: str, nombre: str, contenido: str) -> str:
    """El botón de cada correo, con nombre y correo para que el formulario
    salga relleno y con la campaña para saber qué correo trajo a quién."""
    if destino == "descarga":
        return enlace_descarga(email)
    base = bf_url() + {"admision": "/admision", "ebook": "/ebook"}.get(destino, "/oferta")
    q = {
        "nombre": nombre or "",
        "email": email,
        "utm_source": "email",
        "utm_medium": "email",
        "utm_campaign": "black-friday",
        "utm_content": contenido,
    }
    return f"{base}?{urlencode({k: v for k, v in q.items() if v})}"


# ── La configuración (org_config) ───────────────────────────────────────────


async def _fila(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    q = select(OrganizationConfig)
    if org_id is not None:
        q = q.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


async def leer(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    """Sin `org_id`, la de la escuela (single-tenancy): así lo leen el pago y
    el webhook, que no saben de escuelas."""
    fila = await _fila(db_session, org_id)
    guardado = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    return config_limpia(guardado)


async def _escribir(org_id: int, nuevo: dict, db_session: AsyncSession) -> None:
    fila = await _fila(db_session, org_id)
    if fila is None:
        raise EbookError("La escuela no tiene configuración", 500)
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = nuevo
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()


async def guardar(org_id: int, datos: dict, db_session: AsyncSession) -> dict:
    actual = await leer(db_session, org_id)
    nuevo = dict(actual)
    for campo in ("activo", "campana"):
        if datos.get(campo) is not None:
            nuevo[campo] = bool(datos[campo])
    for campo in ("desde", "hasta"):
        if datos.get(campo) is not None:
            nuevo[campo] = _fecha(datos[campo]) or actual[campo]
    for clave in ("entrega", "pendiente", ID_ACCESO, ID_FORMULARIO):
        if isinstance(datos.get(clave), dict):
            e = dict(actual[clave])
            for campo in ("asunto", "texto", "boton"):
                if datos[clave].get(campo) is not None:
                    e[campo] = str(datos[clave][campo]).strip()[:6000]
            if datos[clave].get("destino") in DESTINOS:
                e["destino"] = datos[clave]["destino"]
            if clave != "entrega" and datos[clave].get("apagado") is not None:
                e["apagado"] = bool(datos[clave]["apagado"])
            nuevo[clave] = e
    if isinstance(datos.get("correos"), list):
        nuevo["correos"] = datos["correos"]
    limpio = config_limpia(nuevo)
    textos = "".join(limpio[k]["asunto"] + limpio[k]["texto"] for k in ("entrega", "pendiente", ID_ACCESO, ID_FORMULARIO))
    textos += "".join(c["asunto"] + c["texto"] for c in limpio["correos"])
    malos = huecos_que_no_valen(textos)
    if malos:
        raise EbookError(
            "Estos huecos no existen: " + ", ".join("{" + m + "}" for m in malos)
            + ". Valen: " + ", ".join("{" + h + "}" for h in HUECOS)
        )
    if "[descarga]" not in limpio["entrega"]["texto"]:
        raise EbookError("El correo de entrega tiene que llevar «[descarga]» en una línea: es donde va el botón del PDF.")
    await _escribir(org_id, limpio, db_session)
    return limpio


def ruta_pdf(relativa: str) -> Optional[Path]:
    """El PDF en disco, solo si está dentro de privado/ebook/."""
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith(CARPETA + "/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


async def guardar_pdf(org_id: int, nombre: str, datos: bytes, db_session: AsyncSession) -> dict:
    if not datos:
        raise EbookError("El archivo está vacío")
    if len(datos) > MAX_PDF:
        raise EbookError("El PDF pesa demasiado (máximo 40 MB)")
    if not datos.startswith(b"%PDF"):
        raise EbookError("Eso no es un PDF")
    relativa = f"{CARPETA}/{org_id}/{_uuid.uuid4().hex}.pdf"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    actual = await leer(db_session, org_id)
    viejo = ruta_pdf(actual.get("pdf") or "")
    actual.update(
        pdf=relativa,
        pdf_nombre=(nombre or "ebook.pdf")[:200],
        pdf_subido_en=datetime.now(timezone.utc).isoformat(),
    )
    await _escribir(org_id, actual, db_session)
    if viejo and viejo.is_file() and viejo != ruta.resolve():
        try:
            viejo.unlink()
        except OSError:
            pass
    return actual


async def pdf_para_descargar(db_session: AsyncSession) -> Optional[Path]:
    cfg = await leer(db_session)
    ruta = ruta_pdf(cfg.get("pdf") or "")
    return ruta if ruta and ruta.is_file() else None


# ── El cobro ────────────────────────────────────────────────────────────────


def _plano(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    try:
        return json.loads(str(obj))
    except (TypeError, ValueError):
        return {}


_PRECIOS: dict[int, str] = {}


def _precio_stripe(cents: int) -> str:
    """El Price del ebook, buscado por `lookup_key` y creado (con su propio
    producto, que es el nombre que sale en el recibo) si no existe."""
    import stripe

    if cents in _PRECIOS:
        return _PRECIOS[cents]
    clave = f"nawar-ebook-sin-miedo-{cents}"

    def buscar() -> str:
        datos = _plano(stripe.Price.list(lookup_keys=[clave], active=True, limit=1)).get("data") or []
        return str(datos[0].get("id") or "") if datos else ""

    precio = buscar()
    if not precio:
        try:
            precio = str(
                _plano(
                    stripe.Price.create(
                        currency="eur",
                        unit_amount=int(cents),
                        lookup_key=clave,
                        nickname=f"Ebook Black Friday {cents / 100:.2f} €",
                        product_data={"name": PRODUCTO_STRIPE},
                        metadata={"producto": PRODUCTO},
                    )
                ).get("id")
                or ""
            )
        except Exception:  # noqa: BLE001
            precio = buscar()
            if not precio:
                raise
    _PRECIOS[cents] = precio
    return precio


_CORREO_OK = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def crear_pago(datos: dict, db_session: AsyncSession) -> dict:
    """Abre la sesión de pago (embebida) del ebook. Devuelve lo que la web
    necesita para pintar la caja: `client_secret` y `publishable_key`."""
    import stripe

    from src.services.panel.tandas import hoy_nl
    from src.services.payments.payments import _stripe_publishable, _usar_stripe

    cfg = await leer(db_session)
    abiertas, motivo = ventas_abiertas(cfg, hoy_nl())
    if not abiertas:
        raise EbookError(motivo, 503)
    email = str(datos.get("email") or "").strip().lower()[:255]
    nombre = re.sub(r"\s+", " ", str(datos.get("nombre") or "")).strip()[:120]
    if not _CORREO_OK.match(email):
        raise EbookError("Escribe un correo válido")
    if not nombre:
        raise EbookError("Escribe tu nombre")
    canal = "ads" if str(datos.get("canal") or "") == "ads" else "organico"

    _usar_stripe()
    try:
        precio = _precio_stripe(cfg["precio_cents"])
        cliente = _plano(stripe.Customer.create(email=email, name=nombre, metadata={"source": PRODUCTO}))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ebook: no se pudo preparar el cobro")
        raise EbookError(f"No se pudo preparar el pago: {exc}", 502)

    def corto(campo: str, n: int = 120) -> str:
        return str(datos.get(campo) or "").strip()[:n]

    meta = {
        "producto": PRODUCTO,
        "nombre": nombre,
        "email": email,
        "canal": canal,
        "recorrido": corto("recorrido", 400),
        "referrer": corto("referrer"),
        **{c: corto(c) for c in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_placement")},
    }
    vuelta = vuelta_segura(str(datos.get("vuelta") or ""), bf_url() + "/oferta")
    try:
        sesion = _plano(
            stripe.checkout.Session.create(
                # Ver enroll_and_checkout_session: `embedded_page` es el modo
                # embebido de siempre con su nombre nuevo.
                ui_mode="embedded_page",
                mode="payment",
                line_items=[{"price": precio, "quantity": 1}],
                customer=cliente.get("id"),
                return_url=con_compra(vuelta),
                invoice_creation={
                    "enabled": True,
                    "invoice_data": {
                        "description": f"Ebook «{NOMBRE_EBOOK}»",
                        "footer": "Gracias por confiar en Holandés Nawar.",
                        "metadata": {"producto": PRODUCTO},
                    },
                },
                allow_promotion_codes=False,
                # Sin Klarna: a 1 € no tiene sentido. Sin Link, como la matrícula.
                payment_method_types=["card", "ideal", "bancontact"],
                metadata={k: v for k, v in meta.items() if v},
                # El webhook del PaymentIntent mira esto para no tocar nada:
                # el ebook lo atiende solo la sesión (`al_pagar`).
                payment_intent_data={"metadata": {"producto": PRODUCTO, "factura_stripe": "1"}},
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ebook: no se pudo crear la sesión de pago")
        raise EbookError(f"No se pudo crear el pago: {exc}", 502)
    if not sesion.get("client_secret"):
        raise EbookError("Stripe no devolvió la caja de pago", 502)
    try:
        await _apuntar_empezado(email, nombre, canal, meta, str(sesion.get("id") or ""), db_session)
    except Exception:  # noqa: BLE001
        # Que no apuntarlo no deje a nadie sin poder pagar.
        logger.warning("Ebook: no se pudo apuntar el pedido empezado", exc_info=True)
    return {
        "client_secret": sesion["client_secret"],
        "publishable_key": _stripe_publishable(),
        "importe_cents": cfg["precio_cents"],
        "moneda": "eur",
    }


async def _apuntar_empezado(email: str, nombre: str, canal: str, meta: dict, session_id: str, db_session: AsyncSession) -> None:
    """Quien abre la caja de pago queda en su ficha («Empezó a pedir el
    ebook»), pague o no: así no se pierde quien deja sus datos y no termina, y
    la campaña le manda el recordatorio. Una línea por persona y día: si vuelve
    a abrir la caja el mismo día, se reescribe la misma."""
    from src.db.contact_event import ContactEvent

    ahora = datetime.now(timezone.utc)
    reciente = (
        await db_session.execute(
            select(ContactEvent)
            .where(
                ContactEvent.email == email,
                ContactEvent.kind == TIPO_EMPEZADO,
                ContactEvent.created_at >= (ahora - timedelta(hours=24)).isoformat(),
            )
            .limit(1)
        )
    ).scalars().first()
    fila = reciente or ContactEvent(email=email, kind=TIPO_EMPEZADO, created_at=ahora.isoformat())
    partes = nombre.split(" ", 1)
    fila.first_name = partes[0][:120]
    fila.last_name = (partes[1] if len(partes) > 1 else "")[:120]
    fila.source = ("ebook-ads" if canal == "ads" else "ebook")[:40]
    for campo in ("recorrido", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_placement"):
        valor = str(meta.get(campo) or "")
        if valor or reciente is None:
            setattr(fila, campo, valor[: 400 if campo == "recorrido" else 120])
    fila.extra = json.dumps({"session_id": session_id, "canal": canal})
    db_session.add(fila)
    await db_session.commit()


def _redis():
    try:
        from src.core.redis import get_redis_client

        return get_redis_client()
    except Exception:  # noqa: BLE001
        return None


async def _ya_atendida(session_id: str, db_session: AsyncSession) -> bool:
    from src.db.contact_event import ContactEvent

    return bool(
        (
            await db_session.execute(
                select(ContactEvent.id)
                .where(ContactEvent.kind == TIPO_COMPRA, ContactEvent.extra.contains(session_id))  # type: ignore[attr-defined]
                .limit(1)
            )
        ).first()
    )


async def al_pagar(sesion: dict, db_session: AsyncSession) -> str:
    """Una compra pagada: se apunta en su ficha, le llega el ebook y se le
    etiqueta en systeme.io. Una sola vez por sesión de pago, la llame el
    webhook o la página de vuelta. Devuelve qué pasó."""
    from src.db.contact_event import ContactEvent

    meta = sesion.get("metadata") or {}
    if meta.get("producto") != PRODUCTO:
        return "no-es-ebook"
    if sesion.get("payment_status") != "paid":
        return "sin-pagar"
    session_id = str(sesion.get("id") or "")
    detalles = sesion.get("customer_details") or {}
    email = str(detalles.get("email") or meta.get("email") or sesion.get("customer_email") or "").strip().lower()
    if not session_id or not email:
        return "sin-datos"
    nombre = str(meta.get("nombre") or detalles.get("name") or "").strip()

    r = _redis()
    clave = f"ebook-compra:{session_id}"
    if r is not None:
        try:
            if not r.set(clave, "1", nx=True, ex=600):
                return "en-curso"
        except Exception:  # noqa: BLE001
            r = None
    if await _ya_atendida(session_id, db_session):
        return "ya-atendida"

    partes = nombre.split(" ", 1)
    canal = meta.get("canal") or "organico"
    marca = ContactEvent(
        email=email,
        kind=TIPO_COMPRA,
        first_name=partes[0][:120],
        last_name=(partes[1] if len(partes) > 1 else "")[:120],
        source=("ebook-ads" if canal == "ads" else "ebook")[:40],
        recorrido=str(meta.get("recorrido") or "")[:400],
        referrer=str(meta.get("referrer") or "")[:120],
        utm_source=str(meta.get("utm_source") or "")[:120],
        utm_medium=str(meta.get("utm_medium") or "")[:120],
        utm_campaign=str(meta.get("utm_campaign") or "")[:120],
        utm_content=str(meta.get("utm_content") or "")[:120],
        utm_term=str(meta.get("utm_term") or "")[:120],
        utm_placement=str(meta.get("utm_placement") or "")[:120],
        extra=json.dumps(
            {
                "session_id": session_id,
                "importe_cents": int(sesion.get("amount_total") or 0),
                "moneda": (sesion.get("currency") or "eur").lower(),
                "canal": canal,
            }
        ),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db_session.add(marca)
    await db_session.commit()
    try:
        cfg = await leer(db_session)
        armar_entrega(cfg, email, nombre, preview=False)
    except Exception:
        # Sin correo, sin marca: el reintento de Stripe (o la página de
        # vuelta) lo vuelve a intentar.
        await db_session.delete(marca)
        await db_session.commit()
        if r is not None:
            try:
                r.delete(clave)
            except Exception:  # noqa: BLE001
                pass
        raise
    try:
        from src.services.crm.systeme import etiquetar

        await etiquetar(email, nombre, "Ebook Black Friday")
    except Exception:  # noqa: BLE001
        logger.warning("Ebook: no se pudo etiquetar en systeme.io", exc_info=True)
    return "enviado"


async def estado_compra(session_id: str, db_session: AsyncSession) -> dict:
    """Para la página de vuelta: si está pagado y a nombre de quién. De paso
    atiende la compra si el aviso de Stripe aún no ha llegado."""
    import stripe

    from src.services.payments.payments import _usar_stripe

    if not re.match(r"^cs_[A-Za-z0-9_]+$", session_id or ""):
        raise EbookError("No existe esa compra", 404)
    _usar_stripe()
    try:
        sesion = _plano(stripe.checkout.Session.retrieve(session_id))
    except Exception:  # noqa: BLE001
        raise EbookError("No existe esa compra", 404)
    meta = sesion.get("metadata") or {}
    if meta.get("producto") != PRODUCTO:
        raise EbookError("No existe esa compra", 404)
    pagado = sesion.get("payment_status") == "paid"
    if pagado:
        try:
            await al_pagar(sesion, db_session)
        except Exception:  # noqa: BLE001
            logger.exception("Ebook: la entrega desde la página de vuelta falló")
    detalles = sesion.get("customer_details") or {}
    return {
        "pagado": pagado,
        "nombre": str(meta.get("nombre") or detalles.get("name") or ""),
        "email": str(detalles.get("email") or meta.get("email") or ""),
        "importe_cents": int(sesion.get("amount_total") or 0),
        "moneda": (sesion.get("currency") or "eur").lower(),
    }


# ── La lista: desbloquear la oferta sin comprar el ebook ────────────────────


def _telefono(texto: Any) -> str:
    """Como en /agendar: sin espacios, 00 → +. Sin convertir a +31 (hay
    números de otros países)."""
    t = re.sub(r"[^\d+]", "", str(texto or ""))[:24]
    return "+" + t[2:] if t.startswith("00") else t


async def apuntar_lista(datos: dict, db_session: AsyncSession) -> dict:
    """Quien rellena el formulario de blackfriday.holandesnawar.com (nombre,
    correo y WhatsApp): queda en su ficha (`bf-lista`, uno por persona), le
    llega al momento el correo de acceso con el botón a la página del ebook y
    se le etiqueta en systeme.io. Si no compra, al día siguiente le llega el
    recordatorio. Repetirlo no duplica nada: actualiza el nombre y el
    teléfono. Devuelve si es nuevo."""
    from src.db.contact_event import ContactEvent
    from src.services.panel.tandas import hoy_nl

    cfg = await leer(db_session)
    if cfg.get("hasta") and hoy_nl() > cfg["hasta"]:
        raise EbookError("La oferta de Black Friday ya ha terminado.", 503)
    email = str(datos.get("email") or "").strip().lower()[:255]
    nombre = re.sub(r"\s+", " ", str(datos.get("nombre") or "")).strip()[:120]
    if not _CORREO_OK.match(email):
        raise EbookError("Escribe un correo válido")
    if not nombre:
        raise EbookError("Escribe tu nombre")
    telefono = _telefono(datos.get("telefono"))

    def corto(campo: str, n: int = 120) -> str:
        return str(datos.get(campo) or "").strip()[:n]

    fila = (
        await db_session.execute(
            select(ContactEvent).where(ContactEvent.email == email, ContactEvent.kind == TIPO_LISTA).limit(1)
        )
    ).scalars().first()
    nuevo = fila is None
    if fila is None:
        fila = ContactEvent(
            email=email,
            kind=TIPO_LISTA,
            source="black-friday",
            recorrido=corto("recorrido", 400),
            referrer=corto("referrer"),
            **{c: corto(c) for c in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_placement")},
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    partes = nombre.split(" ", 1)
    fila.first_name = partes[0][:120]
    fila.last_name = (partes[1] if len(partes) > 1 else "")[:120]
    if telefono:
        fila.phone = telefono
    db_session.add(fila)
    await db_session.commit()

    if nuevo and not cfg[ID_ACCESO].get("apagado"):
        # El correo de acceso, una vez. Si falla, la persona ya está dentro y
        # ve el ebook en pantalla: se apunta en el registro y sigue.
        try:
            armar_acceso(cfg, email, nombre, preview=False)
            db_session.add(
                ContactEvent(
                    email=email,
                    kind=TIPO_CORREO,
                    source="email",
                    extra=json.dumps({"id": ID_ACCESO, "asunto": cfg[ID_ACCESO]["asunto"][:120]}),
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            await db_session.commit()
        except Exception:  # noqa: BLE001
            logger.warning("Lista de Black Friday: el correo de acceso no salió", exc_info=True)
    try:
        from src.services.crm.systeme import etiquetar

        await etiquetar(email, nombre, "Black Friday - lista")
    except Exception:  # noqa: BLE001
        logger.warning("Lista de Black Friday: no se pudo etiquetar en systeme.io", exc_info=True)
    return {"ok": True, "nuevo": nuevo}


# ── Los correos ─────────────────────────────────────────────────────────────


def _valores(cfg: dict, nombre: str) -> dict:
    return {"nombre": nombre_pila(nombre), "hasta": dia_largo(cfg["hasta"])}


def armar_entrega(cfg: dict, email: str, nombre: str, *, preview: bool) -> dict:
    from src.services.users.emails import send_carta_ebook_email

    e = cfg["entrega"]
    valores = _valores(cfg, nombre)
    asunto = rellenar(e["asunto"], valores)
    botones = [
        ("descarga", "Descargar el ebook", enlace_descarga(email)),
        ("boton", e.get("boton") or "", url_destino(e.get("destino") or "landing", email, nombre, "entrega")),
    ]
    r = send_carta_ebook_email(email, asunto, rellenar(e["texto"], valores), botones=botones, preview=preview)
    return {"asunto": asunto, "html": (r or {}).get("html", "") if preview else ""}


def armar_correo(cfg: dict, c: dict, email: str, nombre: str, *, preview: bool) -> dict:
    from src.services.users.emails import send_carta_ebook_email

    valores = _valores(cfg, nombre)
    asunto = rellenar(c["asunto"], valores)
    botones = [("boton", c.get("boton") or "", url_destino(c.get("destino") or "admision", email, nombre, c["id"]))]
    r = send_carta_ebook_email(
        email, asunto, rellenar(c["texto"], valores), botones=botones, baja_url=enlace_baja(email), preview=preview
    )
    return {"asunto": asunto, "html": (r or {}).get("html", "") if preview else ""}


def armar_pendiente(cfg: dict, email: str, nombre: str, *, preview: bool) -> dict:
    """«Tu ebook se quedó a medio camino»: con su baja al pie, como la campaña."""
    from src.services.users.emails import send_carta_ebook_email

    p = cfg["pendiente"]
    valores = _valores(cfg, nombre)
    asunto = rellenar(p["asunto"], valores)
    botones = [("boton", p.get("boton") or "", url_destino(p.get("destino") or "ebook", email, nombre, ID_PENDIENTE))]
    r = send_carta_ebook_email(
        email, asunto, rellenar(p["texto"], valores), botones=botones, baja_url=enlace_baja(email), preview=preview
    )
    return {"asunto": asunto, "html": (r or {}).get("html", "") if preview else ""}


def armar_acceso(cfg: dict, email: str, nombre: str, *, preview: bool) -> dict:
    """«Tu acceso a la oferta de Black Friday», al apuntarse a la lista."""
    from src.services.users.emails import send_carta_ebook_email

    a = cfg[ID_ACCESO]
    valores = _valores(cfg, nombre)
    asunto = rellenar(a["asunto"], valores)
    botones = [("boton", a.get("boton") or "", url_destino(a.get("destino") or "landing", email, nombre, ID_ACCESO))]
    r = send_carta_ebook_email(
        email, asunto, rellenar(a["texto"], valores), botones=botones, baja_url=enlace_baja(email), preview=preview
    )
    return {"asunto": asunto, "html": (r or {}).get("html", "") if preview else ""}


def armar_formulario(cfg: dict, email: str, nombre: str, *, preview: bool) -> dict:
    """«Te quedaste a un paso de tu llamada»: con su baja al pie."""
    from src.services.users.emails import send_carta_ebook_email

    f = cfg[ID_FORMULARIO]
    valores = _valores(cfg, nombre)
    asunto = rellenar(f["asunto"], valores)
    botones = [("boton", f.get("boton") or "", url_destino(f.get("destino") or "admision", email, nombre, ID_FORMULARIO))]
    r = send_carta_ebook_email(
        email, asunto, rellenar(f["texto"], valores), botones=botones, baja_url=enlace_baja(email), preview=preview
    )
    return {"asunto": asunto, "html": (r or {}).get("html", "") if preview else ""}


async def vista(org_id: int, cual: str, db_session: AsyncSession, *, enviar_a: str = "", nombre: str = "Ana") -> dict:
    """«Ver cómo queda» (sin `enviar_a`) o «Mandármelo a mí». Con lo guardado."""
    cfg = await leer(db_session, org_id)
    email = enviar_a or "ana@ejemplo.com"
    if cual == "entrega":
        return armar_entrega(cfg, email, nombre, preview=not enviar_a)
    if cual == ID_PENDIENTE:
        return armar_pendiente(cfg, email, nombre, preview=not enviar_a)
    if cual == ID_ACCESO:
        return armar_acceso(cfg, email, nombre, preview=not enviar_a)
    if cual == ID_FORMULARIO:
        return armar_formulario(cfg, email, nombre, preview=not enviar_a)
    c = next((c for c in cfg["correos"] if c["id"] == cual), None)
    if c is None:
        raise EbookError("No existe ese correo", 404)
    return armar_correo(cfg, c, email, nombre, preview=not enviar_a)


async def baja(email: str, db_session: AsyncSession) -> None:
    from src.db.contact_event import ContactEvent

    ya = (
        await db_session.execute(
            select(ContactEvent.id).where(ContactEvent.email == email, ContactEvent.kind == TIPO_BAJA).limit(1)
        )
    ).first()
    if ya:
        return
    db_session.add(
        ContactEvent(email=email, kind=TIPO_BAJA, source="email", created_at=datetime.now(timezone.utc).isoformat())
    )
    await db_session.commit()


# ── La campaña (tarea diaria) ───────────────────────────────────────────────


async def _personas(db_session: AsyncSession) -> dict:
    """Por correo: cuándo compró (el primer ebook), se apuntó a la lista o
    empezó a pedir el ebook (el último intento), su nombre, qué correos le han
    llegado y el último día que recibió uno; y quién se ha dado de baja o ha
    reservado su llamada. `a_medias` = dejó sus datos (en la portada o en la
    caja de pago) y no ha comprado nunca, con el día de su último intento.
    `gente` = todos los que han dejado sus datos, para la lista del panel.
    `formulario` = el día de lo último que hizo en el formulario de la llamada
    (empezarlo o terminarlo) y si al terminarlo NO encajaba (`no_encaja`)."""
    from src.db.contact_event import ContactEvent
    from src.services.panel.tandas import dia_nl

    filas = (
        await db_session.execute(
            select(ContactEvent.email, ContactEvent.kind, ContactEvent.first_name, ContactEvent.last_name,
                   ContactEvent.extra, ContactEvent.created_at).where(
                ContactEvent.kind.in_([TIPO_COMPRA, TIPO_EMPEZADO, TIPO_LISTA, TIPO_CORREO, TIPO_BAJA, *TIPOS_RESERVO, *TIPOS_FORMULARIO])  # type: ignore[attr-defined]
            )
        )
    ).all()
    compras: dict[str, dict] = {}
    empezados: dict[str, dict] = {}
    listas: dict[str, dict] = {}
    enviados: dict[str, set] = {}
    ultimo: dict[str, str] = {}
    bajas: set[str] = set()
    reservaron: set[str] = set()
    formulario: dict[str, dict] = {}
    for email, kind, fn, ln, extra, creado in filas:
        email = (email or "").strip().lower()
        if not email:
            continue
        dia = dia_nl(creado)
        if kind == TIPO_COMPRA:
            c = compras.get(email)
            if c is None or (creado or "") < c["creado"]:
                compras[email] = {"creado": creado or "", "dia": dia, "nombre": f"{fn or ''} {ln or ''}".strip()}
        elif kind == TIPO_LISTA:
            c = listas.get(email)
            if c is None or (creado or "") < c["creado"]:
                listas[email] = {"creado": creado or "", "dia": dia, "nombre": f"{fn or ''} {ln or ''}".strip()}
        elif kind == TIPO_EMPEZADO:
            c = empezados.get(email)
            if c is None or (creado or "") > c["creado"]:
                empezados[email] = {"creado": creado or "", "dia": dia, "nombre": f"{fn or ''} {ln or ''}".strip()}
        elif kind == TIPO_CORREO:
            try:
                ident = str(json.loads(extra or "{}").get("id") or "")
            except (TypeError, ValueError):
                ident = ""
            enviados.setdefault(email, set()).add(ident)
            if dia > ultimo.get(email, ""):
                ultimo[email] = dia
        elif kind == TIPO_BAJA:
            bajas.add(email)
        elif kind in TIPOS_FORMULARIO:
            f = formulario.get(email)
            if f is None or (creado or "") > f["creado"]:
                no_encaja = False
                if kind == "cualificacion":
                    try:
                        no_encaja = json.loads(extra or "{}").get("apto") is False
                    except (TypeError, ValueError, AttributeError):
                        no_encaja = False
                formulario[email] = {"creado": creado or "", "dia": dia, "no_encaja": no_encaja}
        else:
            reservaron.add(email)
    # A medias = dejó sus datos y no ha comprado nunca (ni antes ni después).
    # Cuenta su último intento: el recordatorio sale al día siguiente.
    a_medias: dict[str, dict] = {}
    for email in (set(empezados) | set(listas)) - set(compras):
        ultimo_intento = max((x for x in (empezados.get(email), listas.get(email)) if x), key=lambda x: x["creado"])
        a_medias[email] = {
            **ultimo_intento,
            "nombre": ultimo_intento["nombre"] or (listas.get(email) or empezados.get(email) or {}).get("nombre", ""),
        }
    gente: dict[str, dict] = {}
    for email in set(compras) | set(listas) | set(empezados):
        uno = sorted((x for x in (compras.get(email), listas.get(email), empezados.get(email)) if x), key=lambda x: x["creado"])
        gente[email] = {
            "creado": uno[0]["creado"],
            "nombre": (compras.get(email) or {}).get("nombre") or uno[-1]["nombre"],
            "ebook": email in compras,
            "lista": email in listas,
        }
    return {
        "compras": compras, "listas": listas, "a_medias": a_medias, "gente": gente, "formulario": formulario,
        "enviados": enviados, "ultimo": ultimo, "bajas": bajas, "reservaron": reservaron,
    }


async def enviar_campana(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    """Lo de hoy. Solo números en lo que devuelve: va al registro público."""
    from src.db.contact_event import ContactEvent
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.panel.tandas import hoy_nl

    cfg = await leer(db_session, org_id)
    p = await _personas(db_session)
    salida = {
        "compradores": len(p["compras"]), "lista": len(p["listas"]), "enviados": 0, "errores": 0, "parados": 0,
        "a_medias": len(p["a_medias"]), "recordatorios": 0, "formulario": 0, "no_encajan": 0,
    }
    if not cfg["campana"]:
        salida["activa"] = False
        return salida
    hoy = hoy_nl()
    activos = [c for c in cfg["correos"] if not c.get("apagado")]
    correos = [c for c in activos if para_quien(c) == PARA_COMPRADORES]
    sin_comprar = [c for c in activos if para_quien(c) == PARA_SIN_COMPRAR]
    form = cfg[ID_FORMULARIO]
    pagaron = await emails_que_pagaron(db_session)

    async def mandar(email: str, ident: str, asunto: str, armar) -> bool:
        marca = ContactEvent(
            email=email,
            kind=TIPO_CORREO,
            source="email",
            extra=json.dumps({"id": ident, "asunto": asunto[:120]}),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db_session.add(marca)
        await db_session.commit()
        try:
            armar()
            salida["enviados"] += 1
            return True
        except Exception:  # noqa: BLE001
            # Sin correo, sin marca: mañana se reintenta.
            await db_session.delete(marca)
            await db_session.commit()
            salida["errores"] += 1
            logger.warning("Campaña del ebook: un envío falló", exc_info=True)
            return False

    # La campaña, solo a quien compró el ebook: es lo que le lleva a la llamada.
    for email, quien in sorted(p["compras"].items(), key=lambda kv: kv[1]["creado"]):
        if email in p["bajas"] or email in p["reservaron"] or email in pagaron:
            salida["parados"] += 1
            continue
        hizo = p["formulario"].get(email)
        # Terminó las preguntas y no encaja: ya se le dijo que ahora no es para
        # él. Seguir pidiéndole la llamada sería contradecirse.
        if hizo and hizo["no_encaja"] and hizo["creado"] >= quien["creado"]:
            salida["no_encajan"] += 1
            continue
        enviados = p["enviados"].get(email, set())
        # Empezó a pedir su llamada después de comprar y no reservó: ese día,
        # «te quedaste a un paso», en lugar del de la campaña.
        if (
            hizo and hizo["creado"] >= quien["creado"] and not form.get("apagado")
            and toca_formulario(hizo["dia"], hoy, enviados, cfg["hasta"], p["ultimo"].get(email, ""))
        ):
            if salida["enviados"] >= TOPE_POR_DIA:
                break
            if await mandar(email, ID_FORMULARIO, form["asunto"],
                            lambda email=email, n=quien["nombre"]: armar_formulario(cfg, email, n, preview=False)):
                salida["formulario"] += 1
            continue
        c = que_toca(quien["dia"], hoy, correos, enviados, cfg["hasta"], p["ultimo"].get(email, ""))
        if c is None:
            continue
        if salida["enviados"] >= TOPE_POR_DIA:
            break
        await mandar(email, c["id"], c["asunto"], lambda c=c, email=email, n=quien["nombre"]: armar_correo(cfg, c, email, n, preview=False))

    # Quien dejó sus datos (en la portada o en la caja de pago) y no compró el
    # ebook: el recordatorio al día siguiente y, después, los del ebook de
    # fecha fija (el Black Friday y el último día). Nada de la formación.
    pendiente = cfg["pendiente"]
    for email, empezo in sorted(p["a_medias"].items(), key=lambda kv: kv[1]["creado"]):
        if email in p["bajas"] or email in p["reservaron"] or email in pagaron:
            continue
        if salida["enviados"] >= TOPE_POR_DIA:
            break
        enviados = p["enviados"].get(email, set())
        if not pendiente.get("apagado") and toca_pendiente(empezo["dia"], hoy, enviados, cfg["hasta"], p["ultimo"].get(email, "")):
            if await mandar(email, ID_PENDIENTE, pendiente["asunto"],
                            lambda email=email, n=empezo["nombre"]: armar_pendiente(cfg, email, n, preview=False)):
                salida["recordatorios"] += 1
            continue
        c = que_toca(empezo["dia"], hoy, sin_comprar, enviados, cfg["hasta"], p["ultimo"].get(email, ""))
        if c is not None:
            await mandar(email, c["id"], c["asunto"], lambda c=c, email=email, n=empezo["nombre"]: armar_correo(cfg, c, email, n, preview=False))
    return salida


async def resumen(org_id: int, db_session: AsyncSession) -> dict:
    """Los números de la pestaña del panel. Los de la campaña (en campaña,
    reservaron, pagaron, bajas) cuentan a quien compró el ebook; la lista de
    abajo, a todos los que dejaron sus datos."""
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.contactos.metricas import emails_excluidos

    p = await _personas(db_session)
    fuera = await emails_excluidos(db_session)
    inscritos = {e: c for e, c in p["compras"].items() if e not in fuera}
    gente = {e: c for e, c in p["gente"].items() if e not in fuera}
    pagaron = await emails_que_pagaron(db_session)
    por_correo: dict[str, int] = {}
    for email, ids in p["enviados"].items():
        if email in fuera:
            continue
        for i in ids:
            por_correo[i] = por_correo.get(i, 0) + 1
    reservaron = [e for e in inscritos if e in p["reservaron"]]
    alumnos = [e for e in inscritos if e in pagaron]
    bajas = [e for e in inscritos if e in p["bajas"]]

    def hizo_tras_comprar(e: str) -> Optional[dict]:
        f = p["formulario"].get(e)
        return f if f and f["creado"] >= inscritos[e]["creado"] else None

    no_encajan = [e for e in inscritos if (hizo_tras_comprar(e) or {}).get("no_encaja")]
    parados = set(reservaron) | set(alumnos) | set(bajas) | set(no_encajan)
    sin_reservar = [e for e in inscritos if e not in parados and hizo_tras_comprar(e)]

    def via(c: dict) -> str:
        if c["lista"]:
            return "desbloqueó y compró" if c["ebook"] else "desbloqueó"
        return "compró" if c["ebook"] else "abrió el pago"

    def estado(e: str, c: dict) -> str:
        if e in pagaron:
            return "pagó"
        if e in p["reservaron"]:
            return "reservó"
        if e in p["bajas"]:
            return "de baja"
        if not c["ebook"]:
            return "sin comprar"
        if e in no_encajan:
            return "no encaja"
        return "empezó la llamada" if e in sin_reservar else "en campaña"

    return {
        "a_medias": len([e for e in p["a_medias"] if e not in fuera]),
        "compradores": len([e for e in p["compras"] if e not in fuera]),
        "lista": len([e for e in p["listas"] if e not in fuera]),
        "en_campana": len([e for e in inscritos if e not in parados]),
        "reservaron": len(reservaron),
        "sin_reservar": len(sin_reservar),
        "no_encajan": len(no_encajan),
        "pagaron": len(alumnos),
        "bajas": len(bajas),
        "por_correo": por_correo,
        "ultimos": [
            {"email": e, "nombre": c["nombre"], "creado": c["creado"], "via": via(c), "estado": estado(e, c)}
            for e, c in sorted(gente.items(), key=lambda kv: kv[1]["creado"], reverse=True)[:30]
        ],
    }

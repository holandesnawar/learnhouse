"""
Kanban de matrículas: en qué punto está cada persona que pidió plaza, llegó al
pago o pidió una llamada, y por dónde se la está contactando.

Lo que entra en el tablero: quien está en la etapa "pidio", "en-pago" o
"alumno" de Contactos, a quien el equipo le creó un enlace de pago, y quien
está pendiente en la lista de Llamadas. Quien solo bajó una guía, se apuntó a
la lista de espera o escribió por Instagram, no: eso es captación, no
matrícula (08/10, "solo gente que haya mostrado interés").

Columnas (09/10): nuevo → llamar ("Por llamar") → no-contesta → contactado →
agendado → seguimiento → pendiente-pago → no-show → descartado → alumno.
"No contesta" (14/10, "una columna más de no contesta") es de las de llamar:
se la ha llamado y no cogió, así que sigue pendiente en Llamadas, con su
temperatura, y no cuenta como atendida (`POR_LLAMAR`). Solo a mano. "Por pagar"
(13/10, quien dijo que sí y aún no ha pagado) solo se llena a mano: ni una
señal cobrada coloca a nadie ahí. "Agendado" nació igual (13/10, "déjala
vacía, yo meto todo") y desde el 14/10 se llena TAMBIÉN sola con Calendly
("si ese mail tiene una reunión agendada en futuro, que se mueva a agendado"):
ver `cita_que_manda`. "No show" (13/10) es quien no se
presentó a su llamada: se mueve a mano o al apuntar «No vino» en Llamadas
(`resultado_llamada.py`). "Alumno" no se elige: sale sola en cuanto paga, y en cuanto paga se
va ahí aunque alguien la hubiera dejado en otra columna. "Propuesta" se quitó
(se decide en la llamada) y "En revisión" se juntó con Seguimiento (lo que
había en las dos está en Seguimiento: «va a pagar» o «lo piensa» se apunta
en una nota, que la tarjeta enseña sin abrirla); "Perdido" se llama ahora
Descartado. Las filas viejas se leen con `_ANTES` (no se reescribe
nada en la base de datos).

TODO LO QUE ENTRA, A LLAMAR (09/10, "me da igual que sea por llamada o por
formulario"; "nuevo pero ¿y qué?… los antiguos leads más fríos tienen que
ser llamar"). A quien nadie ha movido le toca una de las dos primeras, por
cuándo llegó:
- **Nuevo**: llegó hace menos de 48 h (`HORAS_CALIENTE`): en rojo, llamar ya;
- **Por llamar**: más antiguo y sin hablar con él todavía, o a quien se manda
  a mano.
Quien se quedó a medias en la admisión o pidió llamada y no reservó hora
también entra así, con su temperatura (rojo, amarillo, verde) como en
Llamadas. Con la lista de Llamadas va a juego:
- sacar a alguien de Nuevo / Por llamar lo marca como hecho en Llamadas (o
  como quitado si va a Descartado): ya se ha hablado con él;
- marcarlo como hecho en Llamadas lo pasa a Contactado si nadie lo había
  movido;
- lo último que pasó manda: si alguien ya movido vuelve a Llamadas DESPUÉS
  (dejó otra vez sus datos, «A pendiente», «Mandar a Llamadas»), vuelve a
  Nuevo o Por llamar. Con un margen (`_MARGEN_SEG`) para que mover y apuntar
  a la vez no cuente como "volver".
Los de Llamadas sin ficha (apuntados a mano solo con el móvil) salen como
tarjetas sueltas en Nuevo o Por llamar.

Orden: lo más nuevo arriba (`llegada` = el día que pidió plaza o llegó al
pago). Una tarjeta puede quitarse del tablero sin borrar nada (`oculto`), y
quien está fuera de los números (pruebas) tampoco sale: si no, un alumno de
prueba se quedaba en "Alumno" para siempre, porque a quien ha pagado no se le
borra.

La colocación es una función pura (`colocar`), con test.

DOS MESAS (22/10/2026, "uno para el seguimiento del lead y otro desde la
llamada hasta la venta"; entra un segundo closer). No son dos sistemas: es la
misma tarjeta, la misma ficha y las mismas notas, y la columna decide en qué
mesa sale (`mesa_de`):
- **Leads** (del embudo a la llamada): Nuevo, Por llamar, No contesta,
  Contactado y Descartado.
- **Ventas** (de la llamada al cobro): Agendado, No show, Seguimiento, Por
  pagar, Alumno y Descartado. La pantalla separa de Agendado las que aún no
  tienen closer («Por asignar»).
Descartado sale en Ventas si la persona llegó a tener una llamada (una cita de
Calendly no cancelada, un «¿Qué pasó?», un closer asignado o una reserva
avisada por la web) y en Leads si no.

Cada tarjeta lleva su closer (`closer_id`, `asignar`). Lo reparte el closer
principal (o quien tenga el panel) desde «Por asignar», y al asignado le llega
un correo. Asignar no cambia la columna ni la fecha del último movimiento.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment_request import EnrollmentRequest
from src.db.panel_negocio import LeadPipeline
from src.services.contactos.templadas import temperatura

ETAPAS = [
    {"id": "nuevo", "nombre": "Nuevo"},
    {"id": "llamar", "nombre": "Por llamar"},
    {"id": "no-contesta", "nombre": "No contesta"},
    {"id": "contactado", "nombre": "Contactado"},
    {"id": "agendado", "nombre": "Agendado"},
    {"id": "seguimiento", "nombre": "Seguimiento"},
    {"id": "pendiente-pago", "nombre": "Por pagar"},
    {"id": "no-show", "nombre": "No show"},
    {"id": "descartado", "nombre": "Descartado"},
    {"id": "alumno", "nombre": "Alumno"},
]
ETAPAS_MOVIBLES = {"nuevo", "llamar", "no-contesta", "contactado", "agendado", "seguimiento", "pendiente-pago", "no-show", "descartado"}
#: Las columnas de "hay que llamarle": salir de ellas es haberle atendido.
#: "No contesta" también: se le llamó y no cogió, sigue por atender.
POR_LLAMAR = {"nuevo", "llamar", "no-contesta"}
#: Columnas que ya no existen, y a dónde va lo que quedó guardado en ellas.
_ANTES = {"propuesta": "seguimiento", "revision": "seguimiento", "perdido": "descartado"}
#: Mover a alguien y apuntarlo en Llamadas en el mismo momento no es "volver".
_MARGEN_SEG = 120
CANALES = {"", "whatsapp", "llamada", "email", "instagram", "otro"}

#: Las dos mesas: en cuál sale cada columna (Descartado depende, `mesa_de`).
MESA_LEADS = {"nuevo", "llamar", "no-contesta", "contactado"}
MESA_VENTAS = {"agendado", "no-show", "seguimiento", "pendiente-pago", "alumno"}
#: Pasos de la ficha que dicen que tuvo (o reservó) una llamada.
_PASOS_DE_LLAMADA = {"reunion", "llamada-equipo"}


def mesa_de(etapa: str, tuvo_llamada: bool) -> str:
    """«leads» o «ventas». Descartado va a Ventas solo si llegó a tener una
    llamada: quien se descarta sin haber hablado nunca con un closer es un
    lead que no siguió, no una venta perdida. Función pura."""
    if etapa in MESA_VENTAS:
        return "ventas"
    if etapa == "descartado" and tuvo_llamada:
        return "ventas"
    return "leads"


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


def etapa_guardada(etapa: str) -> str:
    """La columna guardada, con las viejas pasadas a las de ahora; vacía si no
    vale."""
    etapa = _ANTES.get(etapa or "", etapa or "")
    return etapa if etapa in ETAPAS_MOVIBLES else ""


#: De dónde viene, en dos palabras, por la primera página por la que entró.
_ORIGEN_WEB = {
    "home": "Web · inicio",
    "vision": "Web · Nuestra visión",
    "blog": "Web · blog",
    "formacion-web": "Web · formación",
    "landing": "Web · landing",
    "landing-precio": "Web · landing con precio",
    "matricula-pago": "Web · pago",
    "agendar": "Web · agendar",
    "admision": "Web · admisión",
    "admision-preguntas": "Web · admisión",
}
_MEDIOS_DE_PAGO = {"paid", "cpc", "ppc", "ads", "paid_social", "paidsocial", "paid-social"}
_FUENTES_META = {"facebook", "fb", "instagram", "ig", "meta"}
#: Las páginas a las que solo se llega desde un anuncio.
_PAGINAS_DE_ANUNCIO = ("anuncio-fb", "landing-metodo")


def _es_de_pago(visita: dict) -> bool:
    return (visita.get("utm_medium") or "").strip().lower() in _MEDIOS_DE_PAGO


def _visitas(ficha: dict) -> list[dict]:
    """Sus visitas en orden (los eventos de `fusionar_contactos`). Sin ellas,
    la propia ficha hace de visita única (así valen las fichas de los tests)."""
    return ficha.get("eventos") or [ficha]


def _visita_de_pago(ficha: dict) -> Optional[dict]:
    """La primera visita cuyo enlace era de un anuncio de pago, o None."""
    return next((v for v in _visitas(ficha) if _es_de_pago(v)), None)


def _visita_de_anuncio(ficha: dict) -> Optional[dict]:
    """La primera visita de pago o que pasó por la página del anuncio."""
    for v in _visitas(ficha):
        if _es_de_pago(v) or any(p in (v.get("recorrido") or "").split(",") for p in _PAGINAS_DE_ANUNCIO):
            return v
    return None


def _con_anuncio(origen: str, ficha: dict, nombres: Optional[dict] = None) -> str:
    """Añade el anuncio concreto (14/10, "que nos salga de qué anuncio
    vienen"): en Meta es `utm_content={{ad.name}}`, o sea el nombre que se le
    pone al anuncio en el Administrador de anuncios. Si en Panel → Anuncios se
    le ha puesto un nombre de la escuela, ese (`nombres`; ver `ads.py`). Un
    `{{…}}` sin sustituir (el enlace abierto fuera de Meta) no es un nombre y
    no se enseña."""
    from src.services.panel.ads import nombre_del_anuncio

    anuncio = nombre_del_anuncio(ficha.get("utm_content") or "", nombres)
    if not anuncio:
        return origen
    return f"{origen} · {anuncio[:60]}"


def origen_corto(ficha: dict, nombres_anuncios: Optional[dict] = None) -> str:
    """De dónde viene una matrícula, para la tarjeta (09/10, "asegúrate que
    puedo ver siempre si viene de la home o de la de ads"). Función pura.

    - "Anuncio Meta": pasó por la página del anuncio (`anuncio-fb`, o la vieja
      `landing-metodo`) o trae una campaña de pago de Facebook/Instagram. Gana
      a todo: si un anuncio la trajo alguna vez, es del anuncio. Si se sabe el
      anuncio concreto, va detrás: "Anuncio Meta · UGC-Laura-14oct".
    - "Anuncio · <fuente>": otra campaña de pago (Google…).
    - Si no, por la PRIMERA página por la que entró: "Web · inicio", "Web ·
      Nuestra visión", "Web · blog", "Web · formación"…, "Guía" o "Enlace de
      pago".
    - Sin páginas apuntadas, la fuente del enlace si la hay ("Instagram").
    Vacío si no se sabe.
    """
    pasos = ficha.get("pasos") or []
    # El anuncio puede venir en cualquiera de sus visitas, no solo en la
    # última (18/10): quien llegó por un anuncio y volvió por un DM sigue
    # siendo del anuncio, y la tarjeta dice lo mismo que la etiqueta de la
    # ficha (`canal_de`).
    pago = _visita_de_pago(ficha)
    fuente = ((pago or {}).get("utm_source") or "").strip().lower()
    if any(p in pasos for p in _PAGINAS_DE_ANUNCIO):
        return _con_anuncio("Anuncio Meta", _visita_de_anuncio(ficha) or ficha, nombres_anuncios)
    if pago:
        if fuente in _FUENTES_META or not fuente:
            return _con_anuncio("Anuncio Meta" if fuente else "Anuncio", pago, nombres_anuncios)
        return _con_anuncio(f"Anuncio · {fuente.capitalize()}", pago, nombres_anuncios)
    fuente = (ficha.get("utm_source") or "").strip().lower()
    if pasos:
        return _por_pagina(pasos[0])
    if fuente:
        return fuente.capitalize()
    return ""


def _por_pagina(primera: str) -> str:
    """De dónde viene, por la primera página por la que entró."""
    if primera.startswith("guia-") or primera.startswith("gracias-"):
        return "Guía"
    if primera == "enlace-pago":
        return "Enlace de pago"
    return _ORIGEN_WEB.get(primera, "Web")


#: Las redes y otros sitios, con su nombre (para el detalle de «Orgánico»).
_REDES = {
    "instagram": "Instagram", "ig": "Instagram", "facebook": "Facebook", "fb": "Facebook", "meta": "Meta",
    "tiktok": "TikTok", "youtube": "YouTube", "yt": "YouTube", "whatsapp": "WhatsApp", "wa": "WhatsApp",
    "google": "Google", "email": "Correo", "mail": "Correo", "newsletter": "Correo", "systeme": "Correo",
}
#: El medio de un enlace orgánico, como se dice (lo que va detrás de «Instagram ·»).
_MEDIOS = {
    "dm": "DM", "dms": "DM", "stories": "historias", "story": "historias", "historias": "historias",
    "historia": "historias", "reel": "reels", "reels": "reels", "bio": "bio", "post": "publicación",
    "publicacion": "publicación",
}
#: Medios que no añaden nada.
_MEDIOS_VACIOS = {"organic", "organico", "orgánico", "social", "referral", "none", "(none)", "web", "link"}
#: Lo que hace el equipo o la escuela, no la persona: no dice por dónde llegó.
_NO_DICEN_DE_DONDE = {"enlace-pago", "llamada-equipo", "alta-manual", "pago", "senal", "correo-reserva", "llamada-confirmada", "check-in"}
#: Al buscar de qué web llegó, por el nombre de la dirección.
_WEBS = (
    ("instagram", "Instagram"), ("facebook", "Facebook"), ("fb.", "Facebook"), ("tiktok", "TikTok"),
    ("youtube", "YouTube"), ("youtu.be", "YouTube"), ("whatsapp", "WhatsApp"), ("wa.me", "WhatsApp"),
    ("google", "Google"), ("bing", "Bing"), ("chatgpt", "ChatGPT"),
)


def _pista_organica(visita: dict) -> str:
    """Por dónde llegó en esa visita, sin anuncio: la red y el medio de su
    enlace, un DM de Instagram, la web de la que venía o su primera página."""
    if visita.get("kind") in _NO_DICEN_DE_DONDE or (visita.get("utm_medium") or "").strip().lower() == "enlace-pago":
        return ""
    fuente = (visita.get("utm_source") or "").strip().lower()
    if fuente:
        medio = (visita.get("utm_medium") or "").strip().lower()
        red = _REDES.get(fuente, fuente.capitalize())
        dicho = _MEDIOS.get(medio, "" if medio in _MEDIOS_VACIOS else medio)
        return f"{red} · {dicho}" if dicho else red
    if visita.get("kind") == "instagram":
        return "Instagram · DM"
    web = (visita.get("referrer") or "").strip().lower()
    if web and "holandesnawar" not in web:
        for trozo, nombre in _WEBS:
            if trozo in web:
                return nombre
        return web.split("//")[-1].split("/")[0].removeprefix("www.")[:40]
    primera = next((p for p in (visita.get("recorrido") or "").split(",") if p), "")
    return _por_pagina(primera) if primera and primera != "enlace-pago" else ""


def _setter(ficha: dict, nombres: Optional[dict] = None) -> str:
    """«Setter · Laura» si alguna visita llegó con el enlace de un setter
    (`utm_content=setter-laura`; ver la plantilla de clase gratuita). Si en
    Panel → Anuncios se le puso un nombre, ese."""
    from src.services.panel.ads import limpiar_anuncio, nombre_del_anuncio

    for v in _visitas(ficha):
        limpio = limpiar_anuncio(v.get("utm_content") or "")
        if not limpio.lower().startswith("setter"):
            continue
        propio = nombre_del_anuncio(limpio, nombres)
        if propio != limpio:
            return propio
        quien = limpio[len("setter"):].strip(" -_").replace("-", " ").replace("_", " ").strip()
        return f"Setter · {quien.title()}" if quien else "Setter"
    return ""


def canal_de(ficha: dict, nombres_anuncios: Optional[dict] = None) -> dict:
    """«Ads» u «Orgánico», para la etiqueta de arriba de la ficha (18/10,
    "diferenciar que alguien agende por orgánico o por ads"). Función pura.

    - `ads`: alguna de sus visitas llegó con un enlace de anuncio de pago
      (`utm_medium` paid, cpc…) o pasó por la página del anuncio. La misma
      regla que la tarjeta (`origen_corto`): si un anuncio la trajo alguna
      vez, es del anuncio. `detalle`: plataforma y anuncio ("Meta · VSL A").
      `antes`: por dónde había llegado ANTES sin anuncio, si fue así.
    - `organico`: todo lo demás. `detalle`: el setter si vino con su enlace
      ("Setter · Laura"); si no, por dónde llegó la primera vez que se sabe
      ("Instagram · historias", "Instagram · DM", "Google", "Web · inicio",
      "Guía"). Vacío si no se sabe (la dio de alta el equipo, por ejemplo).
    """
    pasos = ficha.get("pasos") or []
    visitas = _visitas(ficha)
    anuncio = _visita_de_anuncio(ficha)
    if anuncio or any(p in pasos for p in _PAGINAS_DE_ANUNCIO):
        fuente = ((anuncio or {}).get("utm_source") or "").strip().lower()
        if anuncio is None or not _es_de_pago(anuncio) or fuente in _FUENTES_META:
            # La página del anuncio solo la anuncia Meta.
            plataforma = "Meta"
        else:
            # Un enlace de pago sin fuente no dice de qué plataforma es.
            plataforma = _REDES.get(fuente, fuente.capitalize()) if fuente else ""
        from src.services.panel.ads import nombre_del_anuncio

        nombre = nombre_del_anuncio((anuncio or ficha).get("utm_content") or "", nombres_anuncios)
        antes = ""
        if anuncio is not None:
            for v in visitas[: next((i for i, v in enumerate(visitas) if v is anuncio), 0)]:
                antes = _pista_organica(v)
                if antes:
                    break
        return {
            "canal": "ads",
            "detalle": " · ".join(t for t in (plataforma, nombre[:60]) if t),
            "antes": antes,
        }
    detalle = _setter(ficha, nombres_anuncios)
    if not detalle:
        detalle = next((p for p in (_pista_organica(v) for v in visitas) if p), "")
    if not detalle and pasos and pasos[0] != "enlace-pago":
        detalle = _por_pagina(pasos[0])
    return {"canal": "organico", "detalle": detalle, "antes": ""}


def entro_en_el_flujo(ficha: dict) -> str:
    """Cuándo entró: su primera matrícula, el enlace de pago que le creó el
    equipo o, si no, su primer contacto. Lo mismo que mide la temperatura de
    Llamadas (`con_temperatura`): así la columna y el color dicen lo mismo."""
    return (
        ficha.get("matricula_at")
        or _cuando_paso(ficha, _TAMBIEN_ENTRAN)
        or (ficha.get("primer_contacto") or {}).get("when", "")
    )


#: Una llamada que YA pasó solo cuenta si se reservó desde este día: así, al
#: estrenar esto, las llamadas viejas sin «¿Qué pasó?» no mueven a nadie.
AGENDADO_AUTO_DESDE = "2026-10-14"


def cita_que_manda(citas: list[dict], movida_el: str, ahora: datetime) -> Optional[dict]:
    """La llamada de Calendly que pone a esta persona en Agendado, o None.
    Función pura, con test.

    `citas`: las suyas, ya sin las quitadas del calendario ni las que tienen
    «¿Qué pasó?» apuntado (eso ya la movió de columna). Cuenta una cita activa
    (no cancelada) reservada DESPUÉS del último movimiento a mano: lo último
    que pasó manda, como con Llamadas. Si el closer la mueve después de que
    reservara, gana el closer; si vuelve a reservar, vuelve a Agendado.

    Se queda en Agendado también cuando la llamada ya ha pasado, hasta que se
    apunte «¿Qué pasó?» o alguien la mueva: si no, al pasar la hora la tarjeta
    volvería sola a Por llamar sin que nadie hubiera hecho nada.

    Devuelve la próxima si hay alguna por delante; si no, la última.

    Sin el margen de Llamadas (`_MARGEN_SEG`), a propósito: «No vino» la mueve
    a No show y justo después se le puede agendar otra llamada desde la misma
    ventana (15/10). Con el margen, esa reserva de hace un minuto no contaría
    y la tarjeta se quedaría en No show."""
    tope = _instante(movida_el) if movida_el else 0.0
    ya = ahora.timestamp()
    futuras, pasadas = [], []
    for c in citas or []:
        if c.get("estado") != "activa":
            continue
        futura = _instante(c.get("inicio", "")) > ya
        if not futura and str(c.get("reservada") or "")[:10] < AGENDADO_AUTO_DESDE:
            continue
        if tope and _instante(c.get("reservada", "")) <= tope:
            continue
        (futuras if futura else pasadas).append(c)
    if futuras:
        return min(futuras, key=lambda c: _instante(c.get("inicio", "")))
    if pasadas:
        return max(pasadas, key=lambda c: _instante(c.get("inicio", "")))
    return None


async def citas_por_email(db_session: AsyncSession) -> dict[str, list[dict]]:
    """Las llamadas de Calendly de cada correo que aún pueden mover a alguien
    a Agendado: sin las quitadas del calendario ni las que ya tienen
    «¿Qué pasó?». En blando: sin Calendly (o sin token), vacío."""
    try:
        from src.services.contactos.agenda import agenda
        from src.services.contactos.resultado_llamada import resultados

        datos = await agenda()
        hechos = await resultados(db_session)
    except Exception:  # noqa: BLE001
        return {}
    salida: dict[str, list[dict]] = {}
    for c in datos.get("citas") or []:
        email = (c.get("email") or "").strip().lower()
        if email and not hechos.get(c.get("id") or ""):
            salida.setdefault(email, []).append(c)
    return salida


async def emails_con_llamada(db_session: AsyncSession) -> set[str]:
    """Quien llegó a tener una llamada: una cita de Calendly no cancelada (las
    de los últimos 45 días que da la agenda) o un «¿Qué pasó?» apuntado (que
    no sea «quitada del calendario»). Para saber en qué mesa va Descartado.
    En blando: si algo falla, vacío."""
    salida: set[str] = set()
    try:
        from src.services.contactos.agenda import agenda

        for c in (await agenda()).get("citas") or []:
            if c.get("estado") == "activa" and c.get("email"):
                salida.add(c["email"].strip().lower())
    except Exception:  # noqa: BLE001
        pass
    try:
        from src.db.contact_seguimiento import CallOutcome

        for email, resultado in (
            await db_session.execute(select(CallOutcome.email, CallOutcome.resultado))
        ).all():
            if email and resultado != "quitada":
                salida.add(email.strip().lower())
    except Exception:  # noqa: BLE001
        pass
    return salida


def colocar(
    ficha: dict,
    guardada: Optional[dict],
    llamada: Optional[dict] = None,
    ahora: Optional[datetime] = None,
    nombres_anuncios: Optional[dict] = None,
    citas: Optional[list[dict]] = None,
    con_llamada: bool = False,
) -> dict:
    """Dónde va una ficha de Contactos en el tablero.

    `llamada`: su fila en la lista de Llamadas, si la tiene: {"estado",
    "desde"}. "estado" llega vacío si la lista no la enseña (ya pagó, o reservó
    hora). "desde" es cuándo entró (o volvió a entrar) en la lista.

    - Si ya es alumno: columna "alumno", pase lo que pase.
    - Si alguien la movió: donde la dejaron, salvo que haya vuelto a la lista
      de Llamadas DESPUÉS de ese movimiento: entonces, a llamar.
    - Si no: "contactado" si ya se la atendió (solicitud marcada, o hecha en
      Llamadas) y no está pendiente; si no, a llamar.
    "A llamar" = "nuevo" si llegó hace menos de 48 h, "llamar" si no.
    """
    guardada = guardada or {}
    llamada = llamada or {}
    movida = etapa_guardada(guardada.get("etapa", ""))
    en_llamadas = llamada.get("estado", "")
    pendiente = en_llamadas == "pendiente"
    llegada = (
        ficha.get("matricula_at")
        or _cuando_paso(ficha, _TAMBIEN_ENTRAN)
        or (llamada.get("desde") if pendiente else "")
        or (ficha.get("primer_contacto") or {}).get("when", "")
    )
    # Rojo (menos de 48 h) = Nuevo; si no, Por llamar.
    calor = temperatura(entro_en_el_flujo(ficha) or llegada, ahora or datetime.now(timezone.utc))
    a_llamar = "nuevo" if calor == "caliente" else "llamar"
    if ficha.get("etapa") == "alumno":
        etapa = "alumno"
    elif movida:
        volvio = pendiente and _instante(llamada.get("desde", "")) > _instante(guardada.get("updated_at", "")) + _MARGEN_SEG
        etapa = a_llamar if volvio else movida
    elif pendiente:
        etapa = a_llamar
    else:
        etapa = "contactado" if ficha.get("atendida") or en_llamadas == "hecha" else a_llamar
    # Reservó una llamada en Calendly después del último movimiento: Agendado.
    cita = None
    if etapa != "alumno":
        cita = cita_que_manda(citas or [], guardada.get("updated_at", "") if movida else "", ahora or datetime.now(timezone.utc))
        if cita:
            etapa = "agendado"
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
        "origen": origen_corto(ficha, nombres_anuncios),
        "fuera_de_metricas": bool(ficha.get("fuera_de_metricas")),
        # El día que llegó (pidió plaza, llegó al pago, le crearon un enlace
        # de pago o entró en Llamadas): ordena las columnas.
        "llegada": llegada,
        "temperatura": calor,
        # La llamada de Calendly que la tiene en Agendado (la tarjeta enseña el día).
        "cita": {"inicio": cita.get("inicio", ""), "id": cita.get("id", "")} if cita else None,
        # Fuera del tablero: quitada a mano, o fuera de los números (prueba).
        "oculto": bool(guardada.get("oculto")) or bool(ficha.get("fuera_de_metricas")),
        # Leads o Ventas (`mesa_de`), y el closer que lleva su llamada.
        "mesa": mesa_de(
            etapa,
            con_llamada or bool(cita) or bool(guardada.get("closer_id")) or bool(_cuando_paso(ficha, _PASOS_DE_LLAMADA)),
        ),
        "closer_id": int(guardada.get("closer_id") or 0),
        "closer": guardada.get("closer", "") if guardada.get("closer_id") else "",
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
    con un correo que no ha dejado ningún otro rastro): tarjeta en "nuevo" o
    "llamar" (por cuándo se apuntó) que no se arrastra. Función pura."""
    return {
        "id": f"llamada:{llamada.get('id')}",
        "email": llamada.get("email", ""),
        "nombre": llamada.get("nombre", ""),
        "telefono": llamada.get("telefono", ""),
        "etapa": "nuevo" if (llamada.get("temperatura_auto") or llamada.get("temperatura")) == "caliente" else "llamar",
        "canal": "",
        "motivo": "",
        "desde": llamada.get("created_at", ""),
        "movido_por": "",
        "vio_precio": False,
        "vino_de": "",
        # Lo que dejó a medias; las de mano no tienen (su origen ya lo dice).
        "que_hizo": llamada.get("detalle", "") if llamada.get("origen") != "mano" else "",
        "utm_campaign": "",
        # Sin ficha no hay páginas: lo que diga Llamadas ("Apuntada a mano"…).
        "origen": llamada.get("origen_nombre", ""),
        "fuera_de_metricas": False,
        "llegada": llamada.get("entro") or llamada.get("created_at", ""),
        "oculto": False,
        "suelta": True,
        "mesa": "leads",
        "closer_id": 0,
        "closer": "",
        "llamada": llamada,
        "temperatura": llamada.get("temperatura") or "frio",
    }


def _la_buena(filas: list) -> list:
    """Las filas de un mismo correo, la que manda primero: la última que se
    tocó (y, a igualdad, la más nueva).

    ⚠️ (17/10, "cambiamos algo y vuelve a su lugar"; "descarté y volvió a
    aparecer"). La tabla NO impide dos filas para el mismo correo, y las había:
    dos movimientos a la vez (closer y administrador, o arrastrar y apuntar
    «¿Qué pasó?») creaban cada uno la suya. Entonces `mover` escribía en una y
    el tablero leía la otra, en un orden que la base de datos no garantiza: a
    veces la tarjeta se quedaba y a veces volvía a su sitio. Ahora todos leen
    la misma (esta) y `mover` borra las demás."""
    return sorted(filas, key=lambda f: (_instante(f.updated_at or ""), f.id or 0), reverse=True)


async def filas_de(email: str, db_session: AsyncSession) -> list[LeadPipeline]:
    """Las filas de ese correo (sin mayúsculas), la que manda primero."""
    clave = (email or "").strip().lower()
    if not clave:
        return []
    filas = (
        await db_session.execute(select(LeadPipeline).where(func.lower(LeadPipeline.email) == clave))
    ).scalars().all()
    return _la_buena(list(filas))


async def guardadas(db_session: AsyncSession) -> dict[str, dict]:
    """Una por correo (en minúsculas): la última que se tocó (`_la_buena`)."""
    por_email: dict[str, list] = {}
    for f in (await db_session.execute(select(LeadPipeline))).scalars().all():
        por_email.setdefault((f.email or "").strip().lower(), []).append(f)
    salida: dict[str, dict] = {}
    for email, filas in por_email.items():
        f = _la_buena(filas)[0]
        asignada = _la_asignada(filas)
        salida[email] = {
            "etapa": f.etapa, "canal": f.canal, "motivo": f.motivo, "oculto": any(bool(getattr(x, "oculto", False)) for x in filas),
            "updated_at": f.updated_at, "updated_by": f.updated_by,
            "closer_id": int(getattr(asignada, "closer_id", 0) or 0),
            "closer": getattr(asignada, "closer", "") or "",
        }
    return salida


def _la_asignada(filas: list):
    """De las filas de un mismo correo, la del último reparto (vale también
    para «quitar el closer», que deja la marca con closer 0)."""
    return max(filas, key=lambda f: (_instante(getattr(f, "asignado_at", "") or ""), f.id or 0))


async def tablero(fichas: list[dict], db_session: AsyncSession, nombres_anuncios: Optional[dict] = None) -> dict:
    from src.services.contactos.templadas import para_el_tablero

    ya = await guardadas(db_session)
    por_email = {f["email"]: f for f in fichas}
    llamadas, sueltas = await para_el_tablero(por_email, db_session)
    citas = await citas_por_email(db_session)
    con_llamada = await emails_con_llamada(db_session)
    from src.services.contactos.confirmar_llamada import ids_confirmadas

    confirmadas = ids_confirmadas(fichas)
    ahora = datetime.now(timezone.utc)
    tarjetas = []
    for f in fichas:
        llamada = llamadas.get(f["email"])
        pendiente = bool(llamada and llamada.get("estado") == "pendiente")
        movida = bool(etapa_guardada((ya.get(f["email"]) or {}).get("etapa", "")))
        if not en_tablero(f, pendiente, movida):
            continue
        t = colocar(
            f, ya.get(f["email"]), llamada, ahora, nombres_anuncios, citas.get(f["email"]),
            con_llamada=f["email"] in con_llamada,
        )
        # En Nuevo y Por llamar, la temperatura (como en Llamadas: la de su
        # fila si la tiene, que puede estar puesta a mano; si no, por cuándo
        # llegó) y, si se quedó a medias, dónde.
        t["llamada"] = llamada if t["etapa"] in POR_LLAMAR and pendiente else None
        # La de Llamadas manda si está ahí (puede estar puesta a mano).
        t["temperatura"] = ((llamada or {}).get("temperatura") if pendiente else "") or t["temperatura"]
        # Ya ha dicho que viene (27/10): la tarjeta lo dice junto al día.
        if t.get("cita"):
            t["cita"]["confirmada"] = t["cita"].get("id", "") in confirmadas
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
    Contactos y Llamadas digan lo mismo que el tablero: ir a "contactado" o
    más allá es haberla atendido; volver a "nuevo", no; "llamar" no la toca
    (puede ser un «no contestó»).

    Y la lista de Llamadas, también a juego: ir más allá de las dos de llamar
    marca como hecha su llamada pendiente (o como quitada, si va a
    "descartado"). Ir a "nuevo" o "llamar" no toca la lista. `nombre` y `telefono` ya no se usan (se
    quedan para no romper a quien los mande).
    """
    clave = (email or "").strip().lower()
    if not clave or "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    etapa = _ANTES.get(etapa, etapa)
    if etapa not in ETAPAS_MOVIBLES:
        return {"ok": False, "motivo": "Esa columna no se puede elegir (Alumno sale sola al pagar)"}
    if canal is not None and canal not in CANALES:
        return {"ok": False, "motivo": "Canal desconocido"}

    filas = await filas_de(clave, db_session)
    fila = filas[0] if filas else LeadPipeline(email=clave)
    # Si había más de una fila para este correo, se quedan en una (ver `_la_buena`).
    if filas:
        _copiar_closer(fila, _la_asignada(filas))
    for sobra in filas[1:]:
        if getattr(sobra, "oculto", False):
            fila.oculto = True
        await db_session.delete(sobra)
    fila.email = clave
    fila.etapa = etapa
    if canal is not None:
        fila.canal = canal
    if motivo is not None:
        fila.motivo = motivo.strip()[:200]
    fila.updated_at = _ahora()
    fila.updated_by = (autor or "")[:120]
    db_session.add(fila)

    # Por llamar y No contesta no tocan la marca (puede que ya se le
    # escribiera); Nuevo la quita; cualquier otra columna es haberle atendido.
    if etapa not in ("llamar", "no-contesta"):
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

    if etapa not in POR_LLAMAR:
        from src.services.contactos.templadas import cerrar_pendientes_de

        await cerrar_pendientes_de(clave, "descartada" if etapa == "descartado" else "hecha", db_session)
    return {"ok": True, "etapa": etapa, "canal": fila.canal}


def _copiar_closer(destino, origen) -> None:
    """Al quedarse con una sola fila, que no se pierda el reparto."""
    if origen is None or origen is destino:
        return
    destino.closer_id = int(getattr(origen, "closer_id", 0) or 0)
    destino.closer = getattr(origen, "closer", "") or ""
    destino.asignado_at = getattr(origen, "asignado_at", "") or ""
    destino.asignado_por = getattr(origen, "asignado_por", "") or ""


async def asignar(
    email: str, closer_id: int, closer: str, autor: str, db_session: AsyncSession
) -> dict:
    """Le pone (o le quita, con 0) el closer que lleva su llamada. No toca la
    columna ni `updated_at` (ver el modelo). Devuelve si ha cambiado, para
    avisar solo cuando hay un closer nuevo."""
    clave = (email or "").strip().lower()
    if not clave or "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    filas = await filas_de(clave, db_session)
    if filas:
        fila = filas[0]
        antes = int(getattr(_la_asignada(filas), "closer_id", 0) or 0)
        for sobra in filas[1:]:
            if getattr(sobra, "oculto", False):
                fila.oculto = True
            await db_session.delete(sobra)
    else:
        # Nadie la ha movido: fila sin etapa, solo con el reparto.
        fila = LeadPipeline(email=clave, etapa="")
        antes = 0
    closer_id = int(closer_id or 0)
    fila.closer_id = closer_id
    fila.closer = (closer or "")[:120] if closer_id else ""
    fila.asignado_at = _ahora()
    fila.asignado_por = (autor or "")[:120]
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "closer_id": closer_id, "closer": fila.closer, "cambia": closer_id != antes}


async def ocultar(email: str, oculto: bool, autor: str, db_session: AsyncSession) -> dict:
    """Quita a alguien del tablero (o lo devuelve) sin tocar nada más: ni su
    columna, ni sus pagos, ni los números. Es lo que se hace con un alumno que
    ya no hace falta ver en el kanban."""
    clave = (email or "").strip().lower()
    if not clave or "@" not in clave:
        return {"ok": False, "motivo": "Falta un correo válido"}
    filas = await filas_de(clave, db_session)
    if not filas:
        if not oculto:
            return {"ok": True, "oculto": False}
        filas = [LeadPipeline(email=clave, etapa="")]
    fila = filas[0]
    if len(filas) > 1:
        _copiar_closer(fila, _la_asignada(filas))
    for sobra in filas[1:]:
        await db_session.delete(sobra)
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

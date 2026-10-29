"""
Plantillas de Visión: una campaña entera montada de una vez, con sus fechas.

La primera (17/10/2026, rehecha el 18/10): la campaña de **clase gratuita**
como imán de leads. NO es una clase en directo (corrección del usuario el
18/10): es una clase GRABADA que se recibe por correo al dejar los datos; se
ve y después se puede agendar la llamada. Hay **dos páginas de registro, una
para ads y otra para orgánico**, para saber de dónde viene cada persona, y una
**secuencia de correos**: «aquí tienes tu clase», «por si la quieres volver a
ver» y unos cuantos más para convencer, todos con el botón de agendar.

Qué crea:
- La tarjeta de la campaña (con su `utm_campaign`, para que Visión le sume
  sola los leads, las llamadas y las ventas de la escuela) donde se pida; si
  se pide en Inicio, dentro de la vertical «Campañas», que es su sitio.
- Dentro de su mapa, el embudo de izquierda a derecha: tráfico (anuncio UGC →
  página de ads; reels, historias, bio y DMs del setter → página orgánica) →
  correo «aquí tienes tu clase» → la clase → agendar llamada → llamadas del
  closer → venta; y debajo, la secuencia de correos de seguimiento. Cada paso
  con su lista y su fecha límite contada desde el día que EMPIEZA la campaña.
  Arriba, el objetivo, las fechas clave y lo que YA está hecho en la escuela.
  Abajo, las cifras.
- Los correos llevan un BORRADOR escrito solo con lo que se sabe de la
  formación (16 semanas, 10 módulos, clase semanal, consultas, comunidad,
  certificado, garantía de 15 días, llamada de 30 minutos). Lo que no se sabe
  (el tema de la clase, quién la da, los enlaces) va entre [corchetes]: "si no
  sabes no te inventes". Sin precio: eso es de la llamada.
- Todo nace «Pendiente»: la plantilla no sabe qué está grabado o escrito.

`plan_clase_gratuita` es pura (con test): devuelve las tarjetas y flechas
por clave; `crear_clase_gratuita` las guarda.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.vision import VisionFlecha, VisionNodo
from src.services.vision import mapa as M

_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
_DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def _corta(d: date) -> str:
    return f"{_DIAS[d.weekday()]} {d.day} {_MESES[d.month - 1]}"


def utm_por_defecto(d: date) -> str:
    return f"clase-gratis-{d.day:02d}{_MESES[d.month - 1]}"


def _html(*parrafos: str) -> str:
    """Texto de la página de la tarjeta (el editor lee HTML)."""
    salida = []
    for p in parrafos:
        if p.startswith("- "):
            items = "".join(f"<li><p>{x[2:]}</p></li>" for x in p.split("\n") if x.startswith("- "))
            salida.append(f"<ul>{items}</ul>")
        else:
            salida.append(f"<p>{p}</p>")
    return "".join(salida)


def _tareas(*textos: str) -> list[dict]:
    return [{"texto": t, "hecho": False} for t in textos]


#: La secuencia de correos: (clave, día tras apuntarse, título, asunto,
#: párrafos del borrador). El día es una PROPUESTA (el usuario no la dio):
#: se cambia en cada tarjeta. Firma como los correos de la escuela.
_CORREOS = [
    (
        "correo1", 0, "Correo 1 · Aquí tienes tu clase", "Aquí tienes tu clase",
        [
            "Hola [nombre]:",
            "Aquí tienes la clase: [enlace a la clase]",
            "[Una línea con lo que vas a aprender en la clase.]",
            "Cuando la termines, si quieres que veamos juntos cómo seguir, puedes reservar una llamada de 30 minutos con "
            "nosotros: [enlace para agendar]",
        ],
    ),
    (
        "correo2", 1, "Correo 2 · Por si la quieres volver a ver", "Por si la quieres volver a ver",
        [
            "Hola [nombre]:",
            "Ayer te mandamos la clase. Por si no te dio tiempo o la quieres repasar, aquí la tienes otra vez: "
            "[enlace a la clase]",
            "Si después te quedan dudas sobre cómo seguir, en la llamada de 30 minutos puedes hacernos todas las "
            "preguntas: [enlace para agendar]",
        ],
    ),
    (
        "correo3", 2, "Correo 3 · Cuando otros hablan por ti", "Cuando otros hablan por ti",
        [
            "Hola [nombre]:",
            "En el médico, con las cartas que llegan a casa, cuando tu pareja o tus hijos tienen que hablar por ti, "
            "cuando te quedas fuera de la conversación… vivir aquí sin el idioma cansa.",
            "La Formación Nawar A0-A1 es para eso: empezar desde cero y llegar al A1 en 16 semanas, con un camino claro.",
            "Si quieres saber si encaja contigo, hablemos: [enlace para agendar]",
        ],
    ),
    (
        "correo4", 4, "Correo 4 · Así es la formación por dentro", "Así es la formación por dentro",
        [
            "Hola [nombre]:",
            "- Lecciones paso a paso en la escuela, con ejercicios para practicar lo que aprendes.\n"
            "- Una clase en directo cada semana.\n"
            "- Consultas: cuando te atascas, nos preguntas y te respondemos.\n"
            "- Una comunidad con otros alumnos.\n"
            "- 10 módulos en 16 semanas: de presentarte a tu día a día (el trabajo, la casa, la salud, el transporte, "
            "la ciudad).\n"
            "- Certificado al terminar.",
            "En la llamada te lo enseñamos y vemos si es para ti: [enlace para agendar]",
        ],
    ),
    (
        "correo5", 6, "Correo 5 · Qué pasa en la llamada", "¿Qué pasa en la llamada?",
        [
            "Hola [nombre]:",
            "La llamada dura 30 minutos y es sin compromiso. Vemos tu nivel, para qué necesitas el neerlandés y si la "
            "formación encaja contigo, y puedes hacernos todas las preguntas.",
            "Si entras, tienes 15 días de garantía.",
            "Reserva aquí: [enlace para agendar]",
        ],
    ),
    (
        "correo6", 8, "Correo 6 · El último", "¿Lo hablamos?",
        [
            "Hola [nombre]:",
            "Este es el último correo sobre la clase. Si aprender neerlandés está en tus planes, la llamada es el "
            "primer paso: [enlace para agendar]",
            "Si ahora no es el momento, no pasa nada.",
        ],
    ),
]


def _borrador(asunto: str, parrafos: list[str]) -> str:
    return _html(
        "<em>Borrador para revisar. Lo que va entre [corchetes] lo pones tú.</em>",
        f"<strong>Asunto:</strong> {asunto}",
        *parrafos,
        "Un saludo,<br>El equipo de Nawar",
    )


def plan_clase_gratuita(fecha: date, utm: str, hora: str = "", titulo: str = "") -> dict:
    """Las tarjetas y flechas de la campaña. `fecha` = el día que EMPIEZA (se
    abren las páginas y arrancan los anuncios). `hora` ya no se usa: la clase
    es grabada (se acepta para no romper llamadas viejas)."""
    utm = (utm or utm_por_defecto(fecha)).strip().lower()
    titulo = (titulo or "").strip() or f"Clase gratuita · desde {_corta(fecha)}"

    def d(dias: int) -> str:
        return (fecha + timedelta(days=dias)).isoformat()

    url_ads = f"?utm_source=facebook&utm_medium=paid&utm_campaign={utm}&utm_content={{{{ad.name}}}}&utm_term={{{{adset.name}}}}"
    url = lambda medio: f"?utm_source=instagram&utm_medium={medio}&utm_campaign={utm}"  # noqa: E731
    url_correo = f"?utm_source=email&utm_medium=email&utm_campaign={utm}"

    campana = {
        "tipo": "campana",
        "titulo": titulo,
        "estado": "pendiente",
        "importante": True,
        "utm_campaign": utm,
        "inicio": d(0),
        "etiquetas": ["clase gratuita", "lead magnet"],
        "cuerpo": _html(
            f"Empieza el <strong>{_corta(fecha)}</strong>. Una clase grabada como regalo: la persona deja sus datos, le "
            "llega por correo, la ve y después puede agendar la llamada. Detrás, una secuencia de correos para "
            "convencer, todos con el botón de agendar.",
            "<strong>Dos páginas de registro</strong>: una para los anuncios y otra para lo orgánico. Así se sabe de "
            "dónde viene cada persona (en la ficha sale la etiqueta «Ads» u «Orgánico»).",
            f"Todos los enlaces de esta campaña llevan <strong>utm_campaign={utm}</strong>: así Visión suma sola los "
            "registros, las llamadas y las ventas.",
        ),
    }

    C0, C1, C2, C3, C4, C5, C6 = 0, 340, 680, 1020, 1360, 1700, 2040
    nodos: list[dict] = [
        # Arriba: lo que se decide antes y lo que ya hay.
        {
            "clave": "objetivo", "tipo": "nota", "titulo": "Objetivo de la campaña", "x": C0, "y": -280,
            "importante": True,
            "cuerpo": _html(
                "Escribe aquí cuántos registros, cuántas llamadas y cuántas ventas quieres sacar, y cuánto vas a gastar "
                "en anuncios. Al revisar, compáralo con las cifras de abajo."
            ),
        },
        {
            "clave": "fechas", "tipo": "nota", "titulo": "Fechas clave", "x": C1, "y": -280,
            "cuerpo": _html(
                "- "
                + "\n- ".join(
                    [
                        f"{_corta(fecha - timedelta(days=7))}: la clase grabada y subida",
                        f"{_corta(fecha - timedelta(days=5))}: UGC grabado",
                        f"{_corta(fecha - timedelta(days=3))}: las dos páginas y los correos listos y probados",
                        f"{_corta(fecha)}: arrancan los anuncios y el primer reel",
                        "Cada semana: revisar las cifras y apuntar el gasto",
                    ]
                )
            ),
        },
        {
            "clave": "listo", "tipo": "nota", "titulo": "Lo que ya está hecho en la escuela", "x": C2, "y": -280,
            "estado": "hecho",
            "cuerpo": _html(
                "- Matrículas y Contactos guardan la campaña (utm) de cada persona y de dónde vino.\n"
                "- La ficha dice «Ads» u «Orgánico» y, si vino de un setter, cuál.\n"
                "- Panel → Anuncios: personas, ventas y coste por campaña, por anuncio y por setter («Tus anuncios»).\n"
                "- /proceso-agendar (preguntas + hora, sin vídeo) y /proceso-de-admision (con el vídeo), para agendar.\n"
                "- Llamadas con la agenda de Calendly, «Nueva llamada» y «¿Qué pasó?».\n"
                "- Enlace de pago, señal, «Otro importe» y 3 plazos.\n"
                "- Píxel de Meta y API de conversiones (en las páginas de la formación).\n"
                "- Esta campaña en Visión: suma sola sus leads, llamadas y ventas por el utm."
            ),
        },
        # Tráfico de pago.
        {
            "clave": "ugc", "tipo": "anuncio", "titulo": "Anuncio UGC en Meta", "x": C0, "y": 0, "vence": d(0),
            "checklist": _tareas(
                "Guion del UGC: gancho con un dolor real (el médico, las cartas, que otros hablen por ti)",
                "Elegir quién lo graba y grabar",
                "Editar 2 o 3 versiones con ganchos distintos",
                "Que lleve a la página de ADS, con los parámetros de URL de esta tarjeta",
                "Conversión personalizada: Lead + la URL contiene la página de ads",
                f"Apuntar la campaña en Panel → Anuncios con utm_campaign={utm}",
                "A las 48 h, mirar el coste por registro",
            ),
            "cuerpo": _html("Parámetros de URL del anuncio:", f"<code>{url_ads}</code>"),
        },
        # Tráfico orgánico.
        {
            "clave": "reels", "tipo": "contenido", "titulo": "Reels y bio", "x": C0, "y": 220, "vence": d(0),
            "checklist": _tareas(
                "Reel 1: el dolor (que otros hablen por ti)",
                "Reel 2: un trozo útil de la clase",
                "Reel 3: invitación directa a la clase",
                "Llamada a la acción: comenta CLASE y te llega el enlace por DM",
                "Enlace de la bio a la página ORGÁNICA, con su utm",
            ),
            "cuerpo": _html(
                "Enlace para los reels:", f"<code>{url('reels')}</code>",
                "Enlace para la bio:", f"<code>{url('bio')}</code>",
            ),
        },
        {
            "clave": "historias", "tipo": "contenido", "titulo": "Historias de Instagram", "x": C0, "y": 400,
            "inicio": d(0), "vence": d(0),
            "checklist": _tareas(
                "Historia con sticker de enlace a la página orgánica",
                "Caja de preguntas sobre el neerlandés",
                "Repetir cada semana mientras dure la campaña",
            ),
            "cuerpo": _html("Enlace para el sticker:", f"<code>{url('stories')}</code>"),
        },
        {
            "clave": "setter", "tipo": "contenido", "titulo": "DMs del setter", "x": C0, "y": 580, "vence": d(0),
            "checklist": _tareas(
                "Un enlace personal por setter (abajo), a la página orgánica",
                "Guion de DM: pregunta, la clase de regalo y el enlace",
                "Ponerle nombre en Panel → Anuncios → «Tus anuncios» (setter-nombre → «Setter · Nombre»)",
                "Quien se apunte sin su enlace: dejar una nota en su ficha con quién la trajo",
            ),
            "cuerpo": _html(
                "Cada setter manda SU enlace. La escuela guarda el último trozo (setter-…): la ficha dice «Orgánico · "
                "Setter · Nombre» y en Panel → Anuncios → «Tus anuncios» salen sus personas y sus ventas.",
                f"<code>{url('dm')}&utm_content=setter-NOMBRE</code>",
            ),
        },
        # Las dos páginas de registro.
        {
            "clave": "pagina_ads", "tipo": "embudo", "titulo": "Página de la clase · ads", "x": C1, "y": 0,
            "vence": d(-3), "importante": True,
            "checklist": _tareas(
                "Dirección propia para los anuncios, acabada en -fb como /formacion-nawar-fb (por decidir)",
                "Titular con la promesa de la clase",
                "Qué vas a aprender: 3 puntos concretos",
                "Formulario: nombre, correo y WhatsApp con prefijo (el de /formacion-nawar-fb)",
                "Que los datos lleguen a la escuela con la campaña (utm) y su marca de página",
                "Que la escuela cuente esa marca como anuncio (en pipeline.py, junto a anuncio-fb)",
                "Píxel: Lead solo al apuntarse bien + API de conversiones",
                "Fuera de Google (noindex) y probada en el móvil",
            ),
            "cuerpo": _html(
                "Solo la ven quienes vienen de un anuncio. Cuando esté, pega aquí su dirección en Enlaces."
            ),
        },
        {
            "clave": "pagina_org", "tipo": "embudo", "titulo": "Página de la clase · orgánico", "x": C1, "y": 400,
            "vence": d(-3), "importante": True,
            "checklist": _tareas(
                "Dirección propia, distinta de la de ads (por decidir)",
                "Mismo texto y mismo formulario que la de ads",
                "Que los datos lleguen a la escuela con la campaña (utm)",
                "Píxel: Lead al apuntarse (con otro nombre de contenido, para no mezclarlo con el anuncio)",
                "Decidir si va en Google",
                "Probada en el móvil",
            ),
            "cuerpo": _html(
                "Para reels, historias, bio y DMs. Cuando esté, pega aquí su dirección en Enlaces."
            ),
        },
        # Lo que pasa al apuntarse.
        {
            "clave": "entrada", "tipo": "nota", "titulo": "Cómo entra en la escuela (por decidir)", "x": C2, "y": -60,
            "cuerpo": _html(
                "Hoy, quien solo baja una guía sale en Contactos y NO en Matrículas: pasa a Matrículas cuando pide "
                "llamada o empieza la admisión. Decidir si la clase va igual (el closer solo ve a quien agenda) o si "
                "quien se apunta a la clase sale ya en Matrículas para llamarle."
            ),
        },
        {
            "clave": "clase", "tipo": "embudo", "titulo": "La clase (grabada)", "x": C3, "y": 200,
            "vence": d(-7), "importante": True,
            "checklist": _tareas(
                "Tema y guion: que se lleven algo hecho y el siguiente paso",
                "Quién la da",
                "Grabarla y subirla (Bunny, como el vídeo de admisión)",
                "Página para verla, con el botón «Agendar llamada» debajo",
                "Opcional: que la página avise a la escuela cuando la ven entera, como el vídeo de admisión",
            ),
            "cuerpo": _html(
                "Se recibe por correo al apuntarse. Al final, el siguiente paso: agendar la llamada."
            ),
        },
        {
            "clave": "agendar", "tipo": "embudo", "titulo": "Agendar llamada", "x": C4, "y": 200, "vence": d(-3),
            "checklist": _tareas(
                "Elegir a dónde lleva el botón: /proceso-agendar (preguntas + hora) o /proceso-de-admision (con vídeo)",
                f"Que el enlace lleve utm_campaign={utm}",
                "Que quien agenda deje de recibir los correos de convencer",
            ),
            "cuerpo": _html(
                "Hoy existen dos caminos: /proceso-agendar (las preguntas y la hora, sin vídeo: para quien ya está "
                "caliente) y /proceso-de-admision (el vídeo de admisión, las preguntas y la hora). Quien acaba de ver "
                "la clase ya ha visto un vídeo."
            ),
        },
        {
            "clave": "llamadas", "tipo": "tarea", "titulo": "Llamadas del closer", "x": C5, "y": 200,
            "inicio": d(0),
            "checklist": _tareas(
                "Llamar a quien agenda",
                "Apuntar «¿Qué pasó?» en cada llamada",
                f"En Matrículas, buscar a la gente de {utm}",
            ),
        },
        {
            "clave": "venta", "tipo": "tarea", "titulo": "Venta", "x": C6, "y": 200,
            "checklist": _tareas(
                "En la llamada: enlace de pago, 3 plazos o señal",
                "Apuntar el gasto de la campaña en Visión → Campañas cada semana",
                "Comparar ads y orgánico: la etiqueta de la ficha y la tarjeta de Matrículas",
                "Revisar coste por registro, por llamada y por venta frente al objetivo",
            ),
        },
        # La secuencia, como funciona.
        {
            "clave": "secuencia", "tipo": "nota", "titulo": "Secuencia de correos: cómo funciona", "x": C1, "y": 980,
            "cuerpo": _html(
                "- Decidir desde dónde salen: systeme.io (donde van hoy las secuencias de las guías) o las "
                "Automatizaciones de la escuela.\n"
                "- Los días (0, 1, 2, 4, 6 y 8 tras apuntarse) son una propuesta: cámbialos en cada correo.\n"
                "- Todos llevan el botón de agendar.\n"
                "- Quien agenda, sale de la secuencia (en systeme.io, con una etiqueta).\n"
                f"- Los enlaces de los correos, con <code>{url_correo}</code>",
            ),
        },
    ]
    for i, (clave, dia, nombre, asunto, parrafos) in enumerate(_CORREOS):
        en_fila = i > 0
        nodos.append(
            {
                "clave": clave, "tipo": "contenido", "titulo": nombre,
                "x": C2 if not en_fila else C1 + i * 340, "y": 200 if not en_fila else 980,
                "vence": d(-3), "importante": not en_fila,
                "etiquetas": ["correo", "al apuntarse" if dia == 0 else f"día {dia}"],
                "checklist": _tareas("Revisar el borrador y rellenar los [corchetes]", "Cargarlo en la herramienta de correo", "Probarlo mandándotelo"),
                "cuerpo": _borrador(asunto, parrafos),
            }
        )
    for i, (clave, nombre) in enumerate(
        [("coste_lead", "Coste por lead"), ("coste_agendada", "Coste por llamada agendada"), ("cierre", "Cierre"), ("cac", "CAC")]
    ):
        nodos.append(
            {
                "clave": f"m-{clave}", "tipo": "metrica", "titulo": nombre, "x": C2 + i * 250, "y": 1220,
                "metrica": {"clave": clave, "campana": True},
            }
        )

    flechas = [
        ("ugc", "pagina_ads", ""),
        ("reels", "pagina_org", ""),
        ("historias", "pagina_org", ""),
        ("setter", "pagina_org", ""),
        ("pagina_ads", "correo1", "se apunta"),
        ("pagina_org", "correo1", "se apunta"),
        ("correo1", "clase", "la ve"),
        ("clase", "agendar", "botón"),
        ("agendar", "llamadas", ""),
        ("llamadas", "venta", ""),
        ("correo1", "correo2", "día 1"),
    ]
    for (a, *_), (b, dia, *_) in zip(_CORREOS[1:], _CORREOS[2:]):
        flechas.append((a, b, f"día {dia}"))
    flechas.append((_CORREOS[-1][0], "agendar", "botón en todos"))
    return {"campana": campana, "nodos": nodos, "flechas": flechas, "utm": utm}


def _fecha_ok(texto: str) -> Optional[date]:
    try:
        return datetime.strptime(str(texto or "")[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


async def _sitio_libre(org_id: int, mapa_id: int, db: AsyncSession) -> tuple[float, float]:
    """Debajo de lo que haya en ese mapa, para no pisar nada."""
    nodos = (
        await db.execute(select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.mapa_id == mapa_id))
    ).scalars().all()
    if not nodos:
        return 0.0, 0.0
    return min(n.x for n in nodos), max(n.y for n in nodos) + 200


async def _donde_va(org_id: int, mapa_id: Optional[int], db: AsyncSession) -> Optional[int]:
    """En el mapa pedido; si es Inicio (o no se dice), dentro de «Campañas»."""
    m = await M._mapa(org_id, mapa_id, db) if mapa_id else await M.mapa_inicio(org_id, db)
    if m is None:
        return None
    if m.nodo_padre_id:
        return m.id
    vertical = (
        await db.execute(
            select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.mapa_id == m.id, VisionNodo.tipo == "vertical")
        )
    ).scalars().all()
    campanas = next((v for v in vertical if re.sub(r"[^a-z]", "", (v.titulo or "").lower().replace("ñ", "n")) == "campanas"), None)
    if campanas is None:
        return m.id
    return await M.abrir_submapa(org_id, campanas.id, db)


async def crear_clase_gratuita(org_id: int, datos: dict, db: AsyncSession) -> dict:
    fecha = _fecha_ok(datos.get("fecha"))
    if fecha is None:
        return {"ok": False, "motivo": "Pon el día que empieza la campaña"}
    destino = await _donde_va(org_id, int(datos.get("mapa_id") or 0) or None, db)
    if destino is None:
        return {"ok": False, "motivo": "Ese mapa no existe"}
    plan = plan_clase_gratuita(fecha, str(datos.get("utm_campaign") or ""), str(datos.get("hora") or ""), str(datos.get("titulo") or ""))
    return await _guardar_plan(org_id, destino, plan, db)


# ── Campaña Black Friday (29/10/2026) ───────────────────────────────────────
#
# El embudo de VERDAD, tal como está montado en la web y en la escuela
# (services/ebook/ebook.py), de arriba abajo: por dónde llega la persona, lo
# que ve en cada página, qué decide y qué le pasa en cada caso. Cada correo es
# una tarjeta de tipo «correo» enganchada a SU correo de la campaña
# (`metrica.correo`): enseña el asunto de ahora, cuándo sale y sus cifras, y
# se previsualiza. Las métricas leen la campaña en vivo (`metrica.fuente =
# black-friday`). Lo que no está hecho o no se sabe va como «por decidir» o
# «por hacer»: la plantilla no se inventa nada.

BF_UTM = "black-friday"
BF_URL = "https://blackfriday.holandesnawar.com"


def plan_black_friday(desde: str = "", hasta: str = "") -> dict:
    """Las tarjetas y flechas del mapa de Black Friday. `desde` y `hasta`, las
    fechas de la campaña (Avisos → Ebook Black Friday), solo para los textos.
    Pura."""
    from src.services.ebook import ebook as E

    hasta_txt = E.dia_largo(hasta or E.DE_FABRICA["hasta"])
    desde_txt = E.dia_largo(desde or E.DE_FABRICA["desde"])

    def org(medio: str) -> str:
        return f"{BF_URL}/?utm_source=instagram&utm_medium={medio}&utm_campaign={BF_UTM}"

    url_ads = (
        f"{BF_URL}/?utm_source=facebook&utm_medium=paid&utm_campaign={BF_UTM}"
        "&utm_content={{ad.name}}&utm_term={{adset.name}}"
    )

    campana = {
        "tipo": "campana",
        "titulo": "Black Friday · ebook a 1 €",
        "estado": "en-curso",
        "importante": True,
        "utm_campaign": BF_UTM,
        "inicio": (desde or E.DE_FABRICA["desde"]),
        "fin": (hasta or E.DE_FABRICA["hasta"]),
        "etiquetas": ["black friday", "ebook"],
        "cuerpo": _html(
            f"Del <strong>{desde_txt}</strong> al <strong>{hasta_txt}</strong>. La puerta de entrada es el ebook "
            f"«{E.NOMBRE_EBOOK}» a 1 €; quien lo compra ve nuestra mejor oferta y pide su llamada de admisión, "
            "donde el closer cuenta las condiciones de Black Friday de la formación.",
            f"Todos los enlaces llevan <strong>utm_campaign={BF_UTM}</strong> (también los botones de los correos): "
            "así Visión le suma sola los leads, las llamadas y las ventas.",
            "Dentro, el mapa entero de arriba abajo. Los correos se previsualizan con un clic y sus textos se "
            "cambian en Avisos → Ebook Black Friday. Las cifras de las tarjetas grises son de ahora mismo.",
        ),
    }

    # Columnas (x) y filas (y). De izquierda a derecha: los rótulos de las
    # etapas, la rama de quien NO compra, el camino principal, lo que pasa al
    # lado (métricas, el correo de «te quedaste a un paso») y los correos a
    # quien compró; a la derecha del todo, el ebook y la llamada en frío.
    ET, NO, CEN, LADO, COR, EXT = -460, 0, 440, 880, 1320, 1760
    F = [0, 260, 500, 740, 980, 1220, 1460, 1700, 1940, 2180, 2420, 2660]

    def correo(clave: str, id_correo: str, titulo: str, x: float, y: float, cuando: str, extra: str = "") -> dict:
        return {
            "clave": clave, "tipo": "correo", "titulo": titulo, "x": x, "y": y,
            "metrica": {"correo": id_correo},
            "etiquetas": ["correo", cuando],
            "cuerpo": _html(extra) if extra else "",
        }

    def cifra(clave: str, titulo: str, x: float, y: float) -> dict:
        return {"clave": f"m-{clave}", "tipo": "metrica", "titulo": titulo, "x": x, "y": y,
                "metrica": {"fuente": BF_UTM, "clave": clave}}

    def etapa(clave: str, titulo: str, y: float) -> dict:
        return {"clave": clave, "tipo": "etapa", "titulo": titulo, "x": ET, "y": y}

    nodos: list[dict] = [
        # Arriba: lo que hay que saber antes de mirar el embudo.
        {
            "clave": "como", "tipo": "nota", "titulo": "Cómo leer este mapa", "x": NO, "y": -320,
            "cuerpo": _html(
                "- De arriba abajo, el camino de una persona: por dónde nos ve, qué página abre, qué decide.\n"
                "- Las tarjetas con sobre son los correos de verdad: clic en «Ver» para leerlo como le llega.\n"
                "- Las grises son cifras de ahora mismo (las mismas que Panel → Correos).\n"
                "- Las de borde discontinuo son lo que decide la persona.\n"
                "- Todo se puede mover, cambiar y añadir. Los textos de los correos, en Avisos → Ebook Black Friday."
            ),
        },
        {
            "clave": "decidir", "tipo": "tarea", "titulo": "Por decidir: las condiciones de Black Friday",
            "x": CEN, "y": -320, "urgente": True, "importante": True, "estado": "pendiente",
            "checklist": _tareas(
                "Decidir qué condiciones tiene la formación en Black Friday (precio, plazos, regalos)",
                "Escribirlas en el Guion o el Enfoque del closer",
                "Contárselas a los dos closers antes de las primeras llamadas",
            ),
            "cuerpo": _html(
                "La landing y los correos dicen «condiciones especiales» y que se cuentan en la llamada, pero no están "
                "escritas en ningún sitio de la escuela. Sin ellas el closer no puede cerrar."
            ),
        },
        {
            "clave": "fechas", "tipo": "nota", "titulo": "Fechas", "x": LADO + 220, "y": -320,
            "cuerpo": _html(
                "- "
                + "\n- ".join(
                    [
                        f"{desde_txt}: empieza la campaña",
                        "viernes 27 de noviembre: Black Friday (correo a todos)",
                        f"{hasta_txt}: último día (correo a todos) y se cierra la venta del ebook",
                    ]
                )
            ),
        },
        # 1 · Nos ve.
        etapa("e1", "1 · Nos ve", F[0]),
        {
            "clave": "ads", "tipo": "anuncio", "titulo": "Anuncios en Meta", "x": NO, "y": F[0],
            "checklist": _tareas(
                "Creativos: el ebook a 1 €, sin hablar todavía de la formación",
                "Que lleven a la portada con los parámetros de esta tarjeta",
                "Conversión: Lead (sale al desbloquear la oferta)",
                f"Apuntar la campaña en Panel → Anuncios con utm_campaign={BF_UTM}",
            ),
            "cuerpo": _html(
                "Quien llega con un enlace de pago (utm_medium=paid) pasa después a la página del ebook de anuncios, y en "
                "su ficha sale «Ads» con el nombre del anuncio.",
                "Parámetros de URL del anuncio:", f"<code>{url_ads}</code>",
            ),
        },
        {
            "clave": "reels", "tipo": "contenido", "titulo": "Reels y bio", "x": CEN, "y": F[0],
            "checklist": _tareas("Reels con la oferta del ebook", "Enlace de la bio a la portada, con su utm"),
            "cuerpo": _html("Reels:", f"<code>{org('reels')}</code>", "Bio:", f"<code>{org('bio')}</code>"),
        },
        {
            "clave": "historias", "tipo": "contenido", "titulo": "Historias", "x": LADO, "y": F[0],
            "checklist": _tareas("Historia con sticker de enlace a la portada", "Repetirla el viernes 27 y el lunes 30"),
            "cuerpo": _html("Sticker:", f"<code>{org('stories')}</code>"),
        },
        {
            "clave": "setter", "tipo": "contenido", "titulo": "DMs del setter", "x": COR, "y": F[0],
            "checklist": _tareas("Cada setter, su enlace (abajo)", "Ponerle nombre en Panel → Anuncios → «Tus anuncios»"),
            "cuerpo": _html(
                "La ficha dice «Orgánico · Setter · Nombre».",
                f"<code>{org('dm')}&utm_content=setter-NOMBRE</code>",
            ),
        },
        # 2 · Desbloquea la oferta.
        etapa("e2", "2 · Desbloquea la oferta", F[1]),
        {
            "clave": "portada", "tipo": "embudo", "titulo": "Portada: desbloquea la oferta", "x": CEN, "y": F[1],
            "estado": "hecho", "importante": True,
            "enlaces": [{"titulo": "Portada", "url": BF_URL}],
            "cuerpo": _html(
                "<strong>Lo que ve:</strong> «Desbloquea la oferta de Black Friday» y un formulario con nombre, correo y "
                "WhatsApp. Ni una palabra de la formación.",
                "<strong>Al enviar:</strong>",
                "- Queda en su ficha (Contactos) con de dónde vino.\n"
                "- systeme.io le pone la etiqueta «Black Friday - lista».\n"
                "- Le llega al momento el correo de la oferta desbloqueada.\n"
                "- Píxel: Lead.\n"
                "- Pasa a la página del ebook, ya desbloqueada: la de anuncios si vino de un anuncio de pago.",
            ),
        },
        cifra("desbloquearon", "Desbloquearon la oferta", LADO, F[1]),
        correo("acceso", E.ID_ACCESO, "Correo · Oferta desbloqueada", COR, F[1], "al momento"),
        # 3 · El ebook.
        etapa("e3", "3 · El ebook de 1 €", F[2]),
        {
            "clave": "ebook", "tipo": "embudo", "titulo": "Página del ebook (desbloqueada)", "x": CEN, "y": F[2],
            "estado": "hecho", "importante": True,
            "enlaces": [
                {"titulo": "Orgánico", "url": f"{BF_URL}/ebook"},
                {"titulo": "Anuncios", "url": f"{BF_URL}/ebook-ads"},
            ],
            "checklist": _tareas("Comprobar que las tres opiniones de la página son reales (son las de /ebook-a0-a1)"),
            "cuerpo": _html(
                "<strong>Lo que ve:</strong> «✓ Oferta desbloqueada, [nombre]», el libro, opiniones, para quién es, qué "
                "hay dentro y dudas. Sin cuenta atrás.",
                "<strong>Al pulsar «Consíguelo por 1 €»:</strong> la caja de pago de Stripe dentro de la página (tarjeta, "
                "iDEAL y Bancontact), con sus datos ya puestos. Al abrirla queda en su ficha «abrió el pago».",
                "Píxel: ViewContent y InitiateCheckout.",
            ),
        },
        {"clave": "paga", "tipo": "decision", "titulo": "¿Paga el ebook de 1 €?", "x": CEN, "y": F[3]},
        cifra("compraron", "Compraron el ebook", LADO, F[3]),
        cifra("sin_comprar", "Sin comprar el ebook", NO, F[3]),
        # Rama: no compra.
        correo(
            "pendiente", E.ID_PENDIENTE, "Correo · El ebook te está esperando", NO, F[4], "al día siguiente",
            "Uno solo, al día siguiente de dejar sus datos o abrir el pago. El botón le lleva a la página del ebook con "
            "sus datos puestos.",
        ),
        correo("e_bf", "e-bf", "Correo · Black Friday (sin comprar)", NO, F[5], "27 nov"),
        correo("e_ultimo", "e-ultimo", "Correo · Último día (sin comprar)", NO, F[6], "30 nov"),
        {
            "clave": "nada_formacion", "tipo": "nota", "titulo": "Sin comprar, nada de la formación", "x": NO, "y": F[7],
            "cuerpo": _html(
                "Quien no compra el ebook solo recibe correos del ebook. Si lo compra más tarde, pasa a la rama de la "
                "derecha. Si se da de baja, no recibe nada más."
            ),
        },
        # Rama: compra.
        etapa("e4", "4 · Después de comprar", F[4]),
        {
            "clave": "oferta", "tipo": "embudo", "titulo": "Página /oferta: nuestra mejor oferta", "x": CEN, "y": F[4],
            "estado": "hecho", "importante": True,
            "enlaces": [{"titulo": "/oferta", "url": f"{BF_URL}/oferta"}],
            "cuerpo": _html(
                "<strong>Lo que ve al pagar:</strong> barra roja «¡No cierres esta página!», «[nombre], acabas de "
                "desbloquear nuestra mejor oferta» y las secciones de la landing de la formación, sin precio.",
                "Botón «Quiero mi oferta de Black Friday» → el formulario de la llamada, con sus datos puestos.",
                "Píxel: Purchase (y por la API de conversiones).",
            ),
        },
        correo(
            "entrega", "entrega", "Correo · Tu ebook ya está aquí", COR, F[4], "al momento",
            "Con el botón de descarga del PDF y otro a la formación. systeme.io le pone la etiqueta «Ebook Black Friday».",
        ),
        {
            "clave": "pdf", "tipo": "contenido", "titulo": "El ebook (PDF) y sus QR", "x": EXT, "y": F[4],
            "checklist": _tareas(
                "PDF subido en Avisos → Ebook Black Friday",
                "Por hacer: un QR o enlace al final del ebook hacia /oferta, con su utm (abajo)",
                "Volver a subir el PDF con el QR",
            ),
            "cuerpo": _html(
                "La descarga va firmada y dura un año. Para saber quién llega desde el ebook, el QR con:",
                f"<code>{BF_URL}/oferta?utm_source=ebook&utm_medium=qr&utm_campaign={BF_UTM}</code>",
            ),
        },
        # Los correos a quien compró, en columna.
        correo("c1", "c1", "Correo 1 a compradores", COR, F[5], "día 1"),
        correo("c2", "c2", "Correo 2 a compradores", COR, F[6], "día 3"),
        correo("c3", "c3", "Correo 3 a compradores", COR, F[7], "día 5"),
        correo("c4", "c4", "Correo 4 a compradores", COR, F[8], "día 7"),
        correo("bf", "bf", "Correo · Hoy es Black Friday", COR, F[9], "27 nov"),
        correo("ultimo", "ultimo", "Correo · Último día", COR, F[10], "30 nov"),
        {
            "clave": "reglas", "tipo": "nota", "titulo": "Reglas de los correos", "x": COR, "y": F[11],
            "cuerpo": _html(
                "- Uno al día como mucho, nunca el día de la compra.\n"
                "- Se para al reservar la llamada, al pagar la formación o con la baja.\n"
                "- Quien no encaja sale de la campaña.\n"
                "- Todos los botones llevan a /oferta con sus datos y utm_content = el correo: así se sabe qué correo "
                "trajo a quién (Panel → Correos, «volvieron»)."
            ),
        },
        {
            "clave": "fria", "tipo": "tarea", "titulo": "Llamada en frío a quien compró", "x": EXT, "y": F[5],
            "checklist": _tareas(
                "Panel → Correos → Personas → «en campaña»",
                "Abrir a la persona → «Ver su ficha» → «Mandar a Llamadas» (o «Agendar llamada»)",
            ),
            "cuerpo": _html(
                "Quien compra el ebook NO entra solo en Matrículas: entra cuando empieza el formulario de la llamada. "
                "Para llamarle antes, se le manda a Llamadas desde su ficha y sale al closer con su temperatura."
            ),
        },
        # 5 · La llamada.
        etapa("e5", "5 · La llamada", F[5]),
        {
            "clave": "formulario", "tipo": "embudo", "titulo": "Formulario de la llamada (/admision)", "x": CEN, "y": F[5],
            "estado": "hecho", "importante": True,
            "enlaces": [{"titulo": "/admision", "url": f"{BF_URL}/admision"}],
            "cuerpo": _html(
                "<strong>Lo que ve:</strong> las preguntas de admisión, con la edad la primera y sin pedir lo que ya sabemos. "
                "Al dejar los datos ya sale en Matrículas.",
                "Al terminar, si encaja, elige la hora en Calendly. systeme.io: «Black Friday - llamada».",
            ),
        },
        {"clave": "reserva_q", "tipo": "decision", "titulo": "¿Termina, encaja y reserva?", "x": CEN, "y": F[6]},
        correo(
            "formulario_correo", E.ID_FORMULARIO, "Correo · Te quedaste a un paso", LADO, F[6], "al día siguiente",
            "Solo a quien compró, empezó el formulario y no reservó: uno, al día siguiente, en lugar del correo de la "
            "campaña de ese día.",
        ),
        cifra("llamada", "Empezaron la llamada sin reservar", LADO, F[5]),
        {
            "clave": "no_encaja", "tipo": "nota", "titulo": "No encaja: sale de la campaña", "x": LADO, "y": F[7],
            "cuerpo": _html("Termina las preguntas y no encaja (lo dicen las líneas rojas de la cualificación): no recibe "
                            "más correos de la campaña."),
        },
        cifra("no_encajan", "No encajan", LADO, F[8]),
        {
            "clave": "reservada", "tipo": "embudo", "titulo": "Reserva su hora", "x": CEN, "y": F[7], "estado": "hecho",
            "cuerpo": _html(
                "- Calendly le manda la invitación de calendario y el recordatorio de 1 hora.\n"
                "- La escuela le manda el correo de Rida (Avisos → «Al reservar»).\n"
                "- Sale en Ventas → «Por asignar» y a quien reparte le llega el aviso."
            ),
        },
        cifra("reservaron", "Reservaron la llamada", NO, F[8]),
        {
            "clave": "setear", "tipo": "tarea", "titulo": "Asignar y confirmar", "x": CEN, "y": F[8], "estado": "en-curso",
            "checklist": _tareas(
                "Ventas → «Por asignar»: «Para mí» o para la otra closer",
                "WhatsApp «Confirmar cita» en cuanto reserva",
                "Si no contesta en unas horas, llamada",
                "El mismo día, WhatsApp «Recordatorio»",
                "Marcar «Confirmada» (Llamadas → Por confirmar)",
            ),
        },
        {
            "clave": "llamada", "tipo": "tarea", "titulo": "La llamada de admisión", "x": CEN, "y": F[9], "estado": "en-curso",
            "checklist": _tareas(
                "Contar las condiciones de Black Friday",
                "Crear el enlace de pago (único, Klarna o a plazos) en la llamada",
                "Apuntar «¿Qué pasó?»",
            ),
        },
        # 6 · La venta.
        etapa("e6", "6 · La venta", F[10]),
        {"clave": "paga_formacion", "tipo": "decision", "titulo": "¿Paga la formación?", "x": CEN, "y": F[10]},
        {
            "clave": "alumno", "tipo": "embudo", "titulo": "Alumno", "x": CEN, "y": F[11], "estado": "hecho",
            "cuerpo": _html(
                "Al pagar: cuenta, correo de bienvenida y factura, como siempre. Sale de la campaña. En Panel → Alumnos "
                "→ Tandas y grupos hay que elegir su grupo."
            ),
        },
        cifra("pagaron", "Pagaron la formación", LADO, F[11]),
        {
            "clave": "no_paga", "tipo": "nota", "titulo": "No paga en la llamada", "x": NO, "y": F[10],
            "cuerpo": _html(
                "Seguimiento en Ventas (Seguimiento o Por pagar). Mientras no reservó otra llamada ni pagó, sigue "
                "recibiendo los correos que le queden; desde que reservó, ya no."
            ),
        },
        cifra("bajas", "Se dieron de baja", EXT, F[11]),
    ]

    flechas = [
        ("ads", "portada", ""),
        ("reels", "portada", ""),
        ("historias", "portada", ""),
        ("setter", "portada", ""),
        ("portada", "acceso", "al momento"),
        ("portada", "ebook", "pasa sola"),
        ("acceso", "ebook", "botón"),
        ("ebook", "paga", ""),
        ("paga", "pendiente", "no"),
        ("pendiente", "e_bf", "27 nov"),
        ("e_bf", "e_ultimo", "30 nov"),
        ("pendiente", "ebook", "botón"),
        ("paga", "oferta", "sí"),
        ("paga", "entrega", "sí, al momento"),
        ("entrega", "pdf", "descarga"),
        ("entrega", "c1", "día 1"),
        ("c1", "c2", "día 3"),
        ("c2", "c3", "día 5"),
        ("c3", "c4", "día 7"),
        ("c4", "bf", "27 nov"),
        ("bf", "ultimo", "30 nov"),
        ("c1", "oferta", "botón (todos)"),
        ("pdf", "oferta", "QR"),
        ("oferta", "formulario", "botón"),
        ("fria", "formulario", "si le convence"),
        ("formulario", "reserva_q", ""),
        ("reserva_q", "formulario_correo", "empieza y no reserva"),
        ("formulario_correo", "formulario", "botón"),
        ("reserva_q", "no_encaja", "no encaja"),
        ("reserva_q", "reservada", "sí"),
        ("reservada", "setear", ""),
        ("setear", "llamada", ""),
        ("llamada", "paga_formacion", ""),
        ("paga_formacion", "alumno", "sí"),
        ("paga_formacion", "no_paga", "todavía no"),
    ]
    return {"campana": campana, "nodos": nodos, "flechas": flechas, "utm": BF_UTM}


async def _guardar_plan(org_id: int, destino: int, plan: dict, db: AsyncSession) -> dict:
    """Guarda la tarjeta de la campaña donde toca y, en su mapa, las tarjetas
    y flechas del plan."""
    ahora = datetime.now(timezone.utc).isoformat()
    x, y = await _sitio_libre(org_id, destino, db)
    campana = VisionNodo(org_id=org_id, mapa_id=destino, x=x, y=y, created_at=ahora, updated_at=ahora)
    M._aplicar(campana, plan["campana"])
    db.add(campana)
    await db.commit()
    await db.refresh(campana)
    submapa = await M.abrir_submapa(org_id, campana.id, db)

    ids: dict[str, int] = {}
    for n in plan["nodos"]:
        datos_nodo = {k: v for k, v in n.items() if k != "clave"}
        m = n.get("metrica") or {}
        if n["tipo"] == "metrica" and m.get("campana"):
            datos_nodo["metrica"] = {"campana_id": campana.id, "clave": m["clave"]}
        nodo = VisionNodo(org_id=org_id, mapa_id=submapa, created_at=ahora, updated_at=ahora)
        M._aplicar(nodo, datos_nodo)
        db.add(nodo)
        await db.flush()
        ids[n["clave"]] = nodo.id
    for origen, destino_clave, etiqueta in plan["flechas"]:
        db.add(
            VisionFlecha(
                org_id=org_id, mapa_id=submapa, origen=ids[origen], destino=ids[destino_clave],
                etiqueta=etiqueta, created_at=ahora,
            )
        )
    # Que el mapa se abra encuadrado (sin vista guardada, la pantalla encaja todo).
    sub = await M._mapa(org_id, submapa, db)
    if sub is not None:
        sub.vista = json.dumps({})
        db.add(sub)
    await db.commit()
    return {"ok": True, "campana_id": campana.id, "mapa_id": destino, "submapa_id": submapa, "utm_campaign": plan["utm"]}


async def crear_black_friday(org_id: int, datos: dict, db: AsyncSession) -> dict:
    from src.services.ebook import ebook as E

    destino = await _donde_va(org_id, int(datos.get("mapa_id") or 0) or None, db)
    if destino is None:
        return {"ok": False, "motivo": "Ese mapa no existe"}
    cfg = await E.leer(db, org_id)
    return await _guardar_plan(org_id, destino, plan_black_friday(cfg.get("desde", ""), cfg.get("hasta", "")), db)

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
        if n["tipo"] == "metrica":
            datos_nodo["metrica"] = {"campana_id": campana.id, "clave": n["metrica"]["clave"]}
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

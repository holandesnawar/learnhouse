"""
La ficha completa de una persona, para indagar sin saltar de pantalla en
pantalla: quién es, en qué columna del tablero está, qué páginas vio, qué
correos le mandó la escuela, qué pagó, qué ha apuntado el equipo y qué tareas
hay pendientes con ella. Todo en una sola llamada.

La línea de tiempo se monta con una función pura (`linea_de_tiempo`), con test.
"""

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.panel_negocio import EmailLog, LeadPipeline
from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
from src.services.contactos.seguimiento import seguimiento_de
from src.services.panel import tareas as tareas_srv
from src.services.panel.pipeline import colocar
from src.services.payments.solicitudes import _NOMBRES as NOMBRES_PAGINA


def paginas_vistas(ficha: dict) -> list[dict]:
    """Las páginas de la web por las que pasó, en orden y sin repetir, con su
    nombre en cristiano y si enseñan el precio."""
    vistas: list[str] = []
    for ev in ficha.get("eventos") or []:
        for p in (ev.get("recorrido") or "").split(","):
            p = p.strip()
            if p and p not in vistas:
                vistas.append(p)
    return [{"id": p, "nombre": NOMBRES_PAGINA.get(p, p), "precio": p == "landing-precio"} for p in vistas]


def por_que_vio_el_precio(eventos: list[dict]) -> str:
    """Por qué la ficha dice "ha visto el precio", en una frase, con lo que
    guardó la matrícula al crearse (02/10, "¿cómo encontró Paula el precio?").

    La escuela solo apunta "llegó al pago" de dos maneras: el formulario de
    pago de la web (/matricula-formacion-nawar) o un enlace de pago creado en
    el panel (basta con ABRIRLO, aunque no se pague). Cada matrícula guarda
    cuál fue y desde dónde llegó: aquí se cuenta. Vacío si no lo ha visto."""
    for e in eventos:
        if e.get("kind") != "matricula":
            continue
        rec = str(e.get("recorrido") or "")
        if e.get("utm_medium") == "enlace-pago" or "enlace-pago" in rec:
            return (
                "Llegó a la caja de pago con un enlace de pago creado en el panel (Llamadas → «Crear su enlace "
                "de pago»). La matrícula se crea al ABRIR el enlace: si nadie se lo mandó, puede que alguien "
                "del equipo lo abriera para verlo."
            )
        texto = "Rellenó ella misma el formulario de pago de la web (la página de matrícula con el precio)"
        if e.get("referrer"):
            texto += f", llegando desde {e['referrer']}"
        if e.get("utm_campaign") or e.get("utm_source"):
            texto += f", con el enlace de la campaña «{e.get('utm_campaign') or e.get('utm_source')}»"
        pasos = [NOMBRES_PAGINA.get(p, p) for p in rec.split(",") if p]
        if pasos:
            texto += ". Antes pasó por: " + " → ".join(pasos)
        elif not e.get("referrer"):
            texto += ". Entró directamente a esa página (un enlace guardado, un correo o un mensaje)"
        return texto + "."
    if any("landing-precio" in str(e.get("recorrido") or "") for e in eventos):
        return "Pasó por la página de la formación que enseña el precio."
    if any(e.get("kind") == "senal" for e in eventos):
        return "Pagó una señal para reservar su plaza con un enlace que le creó el equipo."
    if any(e.get("kind") == "pago" for e in eventos):
        return "Pagó la formación."
    return ""


#: Los eventos donde la web guarda las preguntas de admisión (o de /agendar).
_PREGUNTAS_KINDS = ("cualificacion", "admision", "agendar-empezado")


def _extra(e: dict) -> dict:
    extra = e.get("extra") or {}
    if isinstance(extra, str):
        try:
            import json

            extra = json.loads(extra) if extra else {}
        except Exception:  # noqa: BLE001
            extra = {}
    return extra if isinstance(extra, dict) else {}


def _respuestas(extra: dict) -> list[dict]:
    """Las respuestas como {pregunta, respuesta}, sin las que no contestó."""
    salida = []
    for r in extra.get("respuestas") or []:
        if not isinstance(r, dict):
            continue
        pregunta = str(r.get("pregunta") or "").strip()
        respuesta = str(r.get("respuesta") or "").strip()
        if pregunta and respuesta and respuesta != "Sin responder":
            salida.append({"pregunta": pregunta, "respuesta": respuesta})
    return salida


def proceso_admision(eventos: list[dict]) -> dict | None:
    """Lo que contestó en las preguntas (proceso de admisión o /agendar) y
    dónde se quedó, para la ficha. Función pura, con test.

    08/10 (Lina): "vio el vídeo y completó el formulario, pero no están en
    ningún lado las respuestas". Se guardaban (en el `extra` del evento) pero
    la ficha no las enseñaba: solo salían en Panel → Llamadas, y quien no
    terminaba ya ni ahí. Ahora la ficha las enseña siempre:
    - si terminó, las de su última cualificación, con si encaja;
    - si se fue a mitad, las que llegó a contestar y la última;
    - y en una línea, dónde se quedó (vídeo, preguntas, hora reservada).
    Devuelve None si nunca empezó el proceso."""
    def instante(e: dict) -> str:
        return str(e.get("when") or "")

    propios = sorted((e for e in eventos if e.get("kind") in _PREGUNTAS_KINDS), key=instante)
    if not propios:
        return None
    cualificaciones = [e for e in propios if e.get("kind") == "cualificacion"]
    medias = [e for e in propios if e.get("kind") != "cualificacion"]
    # El vídeo: lo vio entero si cualquiera de sus envíos lo dice.
    video = "visto" if any(_extra(e).get("video") == "visto" for e in propios) else (
        "empezado" if any(_extra(e).get("video") for e in propios) else ""
    )
    embudo = "admision" if any(_extra(e).get("embudo") == "admision" or e.get("kind") == "admision" for e in propios) else ""

    if cualificaciones:
        ultima_cual = cualificaciones[-1]
        extra = _extra(ultima_cual)
        apto = bool(extra.get("apto"))
        motivo = str(extra.get("motivo_fuera") or "").strip()
        reservo = any(e.get("kind") == "reunion" and instante(e) >= instante(ultima_cual) for e in eventos)
        encaje = "encaja" if apto else (f"no encaja: {motivo}" if motivo else "no encaja")
        resumen = f"Terminó las preguntas ({encaje})"
        resumen += " y reservó hora" if reservo else " y no ha reservado hora"
        if embudo:
            resumen = ("Vio el vídeo entero. " if video == "visto" else "") + resumen
        return {
            "terminado": True,
            "cuando": instante(ultima_cual),
            "apto": apto,
            "motivo_fuera": motivo,
            "reservo": reservo,
            "video": video,
            "embudo": embudo,
            "ultima": "",
            "resumen": resumen + ".",
            "respuestas": _respuestas(extra),
        }

    ultima_media = medias[-1]
    extra = _extra(ultima_media)
    respuestas = _respuestas(extra)
    ultima = str(extra.get("ultima") or "").strip()
    if embudo:
        inicio = "Vio el vídeo entero" if video == "visto" else "Dejó sus datos y no terminó el vídeo"
    else:
        inicio = "Dejó sus datos"
    if respuestas:
        n = len(respuestas)
        resumen = f"{inicio}. Contestó {n} pregunta{'s' if n != 1 else ''}"
        resumen += f" y se fue después de «{ultima}»" if ultima else " y no terminó"
    elif embudo and video == "visto":
        resumen = "Vio el vídeo entero y no empezó las preguntas"
    elif embudo:
        resumen = inicio
    else:
        resumen = "Dejó sus datos y no contestó ninguna pregunta"
    return {
        "terminado": False,
        "cuando": instante(ultima_media),
        "apto": None,
        "motivo_fuera": "",
        "reservo": False,
        "video": video,
        "embudo": embudo,
        "ultima": ultima,
        "resumen": resumen + ".",
        "respuestas": respuestas,
    }


def linea_de_tiempo(eventos: list[dict], correos: list[dict], notas: list[dict], tareas: list[dict]) -> list[dict]:
    """Todo lo que ha pasado con esta persona, lo más reciente arriba."""
    items: list[dict] = []
    for e in eventos:
        items.append({"tipo": "evento", "cuando": e.get("when", ""), "texto": e.get("que", ""), "kind": e.get("kind", "")})
    for c in correos:
        items.append({"tipo": "correo", "cuando": c.get("created_at", ""), "texto": c.get("asunto", ""), "ok": c.get("ok", True)})
    for n in notas:
        items.append({"tipo": "nota", "cuando": n.get("created_at", ""), "texto": n.get("texto", ""), "autor": n.get("autor", "")})
    for t in tareas:
        items.append({"tipo": "tarea", "cuando": t.get("created_at", ""), "texto": t.get("titulo", ""), "estado": t.get("estado", ""), "autor": t.get("asignado", "")})
    items.sort(key=lambda i: str(i.get("cuando") or ""), reverse=True)
    return items


async def ficha_cliente(email: str, user_id: int, es_admin: bool, db_session: AsyncSession) -> dict | None:
    clave = (email or "").strip().lower()
    if not clave:
        return None
    eventos = [e for e in await _todos_los_eventos(db_session) if e["email"] == clave]
    if not eventos:
        return None
    ficha = fusionar_contactos(eventos, await _emails_con_cuenta(db_session))[0]

    from src.services.contactos.metricas import emails_excluidos

    ficha["fuera_de_metricas"] = clave in await emails_excluidos(db_session)

    guardada = (
        await db_session.execute(select(LeadPipeline).where(LeadPipeline.email == clave))
    ).scalars().first()
    # Su fila en Llamadas, como la ve el tablero: la ficha dice la misma
    # columna que la tarjeta (Seguimiento incluido).
    try:
        from src.services.contactos.templadas import llamada_de

        llamada = await llamada_de(clave, ficha, db_session)
    except Exception:  # noqa: BLE001
        llamada = None
    tablero = colocar(
        ficha,
        {"etapa": guardada.etapa, "canal": guardada.canal, "motivo": guardada.motivo, "updated_at": guardada.updated_at, "updated_by": guardada.updated_by}
        if guardada
        else None,
        llamada,
    )

    pagos = [
        {
            "fecha": r.paid_at or r.updated_at or r.created_at,
            "importe_cents": r.amount_cents or 0,
            "moneda": r.currency or "eur",
            "producto": r.product or "",
        }
        for r in (
            await db_session.execute(select(Enrollment).where(func.lower(Enrollment.email) == clave))
        ).scalars().all()
        # La matrícula que cierra una reserva lleva el total: aquí se enseñan
        # sus pagos uno a uno (abajo), no dos veces.
        if r.status == "paid" and getattr(r, "recorrido", "") != "reserva"
    ]
    # Los pagos de plazas reservadas: la señal, lo pagado a cuenta y el resto.
    from src.db.reservas import ReservaPago, ReservaPlaza
    from src.services.payments.reservas import NOMBRE_TIPO

    for pago, _reserva in (
        await db_session.execute(
            select(ReservaPago, ReservaPlaza)
            .join(ReservaPlaza, ReservaPlaza.id == ReservaPago.reserva_id)
            .where(func.lower(ReservaPlaza.email) == clave)
            .where(ReservaPago.estado == "pagado")
        )
    ).all():
        pagos.append(
            {
                "fecha": pago.paid_at or pago.created_at,
                "importe_cents": pago.importe_cents or 0,
                "moneda": pago.currency or "eur",
                "producto": NOMBRE_TIPO.get(pago.tipo, "Pago"),
            }
        )
    pagos.sort(key=lambda p: str(p["fecha"] or ""), reverse=True)

    correos = [
        {"asunto": c.asunto, "ok": c.ok, "created_at": c.created_at}
        for c in (
            await db_session.execute(
                select(EmailLog).where(EmailLog.email == clave).order_by(EmailLog.id.desc()).limit(100)  # type: ignore[attr-defined]
            )
        ).scalars().all()
    ]

    # Las etiquetas de systeme.io (en qué campaña de correos está), solo para
    # administradores: al closer no le sirven y es una llamada de fuera.
    crm = None
    if es_admin:
        from src.services.contactos.contactos import etiquetas_en_systeme

        crm = await etiquetas_en_systeme(clave)

    seg = await seguimiento_de(clave, db_session)
    tareas = await tareas_srv.listar(db_session, user_id, es_admin, email=clave)

    # Sus llamadas de Calendly (pasadas y próximas) con lo que pasó en cada
    # una. En blando: si Calendly no contesta, la ficha sale igual.
    llamadas: list[dict] = []
    try:
        from src.services.contactos.agenda import agenda
        from src.services.contactos.resultado_llamada import resultados

        hechos = await resultados(db_session)
        llamadas = [
            {**c, "resultado": hechos.get(c.get("id") or "")}
            for c in (await agenda()).get("citas") or []
            if c.get("email") == clave
        ]
    except Exception:  # noqa: BLE001
        llamadas = []

    # Por dónde va en la formación, si tiene cuenta (ver services/panel/avance.py).
    avance = None
    try:
        from src.db.users import User
        from src.services.panel.avance import avance_formacion

        uid = (
            await db_session.execute(select(User.id).where(func.lower(User.email) == clave))
        ).scalars().first()
        if uid:
            avance = (await avance_formacion(db_session, [int(uid)])).get(int(uid))
    except Exception:  # noqa: BLE001
        avance = None

    # Si está en Llamadas templadas (para el botón de la ficha).
    try:
        from src.services.contactos.templadas import templada_de

        templada = await templada_de(clave, db_session)
    except Exception:  # noqa: BLE001
        templada = None

    # Plaza reservada con señal: lo pagado, lo pendiente y sus pagos.
    try:
        from src.services.payments.reservas import reserva_de

        reserva = await reserva_de(clave, db_session)
    except Exception:  # noqa: BLE001
        reserva = None

    return {
        "reserva": reserva,
        "email": clave,
        "nombre": ficha["nombre"],
        "telefono": ficha["telefono"],
        "etapa_contacto": ficha["etapa"],
        "tablero": tablero,
        "vio_precio": ficha["vio_precio"],
        "precio_por": por_que_vio_el_precio(eventos),
        "vino_de": ficha["vino_de"],
        "utm": {
            "source": ficha["utm_source"], "medium": ficha["utm_medium"], "campaign": ficha["utm_campaign"],
            "content": ficha.get("utm_content", ""),
            "term": ficha.get("utm_term", ""),
            "placement": ficha.get("utm_placement", ""),
        },
        "etiquetas": ficha["etiquetas"],
        "fuera_de_metricas": ficha["fuera_de_metricas"],
        "primer_contacto": ficha["primer_contacto"],
        "paginas": paginas_vistas(ficha),
        "admision": proceso_admision(eventos),
        "pagos": pagos,
        "total_pagado_cents": sum(p["importe_cents"] for p in pagos),
        "correos": correos,
        "notas": seg.get("notas", []),
        "volver_a_llamar": seg.get("volver_a_llamar"),
        "tareas": tareas,
        "llamadas": llamadas,
        "avance": avance,
        "templada": templada,
        "systeme": crm,
        "linea": linea_de_tiempo(ficha["eventos"], correos, seg.get("notas", []), tareas),
    }

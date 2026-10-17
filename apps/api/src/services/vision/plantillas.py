"""
Plantillas de Visión: una campaña entera montada de una vez, con sus fechas.

La primera (17/10/2026): la campaña de **clase gratuita** como imán de leads
("damos la clase, cogemos el teléfono; anuncio UGC en Meta, Instagram
orgánico, historias y reels"). El usuario pidió "créame el mapa estilo
embudo, con lo que está listo y lo que falta, incluida la página de la clase,
y poder especificar dentro qué es necesario".

Qué crea:
- La tarjeta de la campaña (con su `utm_campaign`, para que Visión le sume
  sola los leads, las llamadas y las ventas de la escuela) donde se pida; si
  se pide en Inicio, dentro de la vertical «Campañas», que es su sitio.
- Dentro de su mapa, el embudo de izquierda a derecha: tráfico (anuncio UGC,
  reels, historias, DMs del setter) → página de la clase → confirmación y
  recordatorios → la clase → oferta / repetición → llamadas → cierre. Cada
  paso con su lista de lo que hace falta y su fecha límite contada desde el
  día de la clase (D-10, D-7…), y arriba el objetivo, las fechas clave y lo
  que YA está hecho en la escuela (en verde). Abajo, las cifras de la campaña.
- Todo lo demás nace «Pendiente»: la plantilla no sabe qué está grabado o
  escrito; se marca a mano.

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


def plan_clase_gratuita(fecha: date, utm: str, hora: str = "", titulo: str = "") -> dict:
    """Las tarjetas y flechas de la campaña. `fecha` = el día de la clase."""
    utm = (utm or utm_por_defecto(fecha)).strip().lower()
    hora = (hora or "").strip()
    cuando = f"{_corta(fecha)}{' · ' + hora if hora else ''}"
    titulo = (titulo or "").strip() or f"Clase gratuita · {_corta(fecha)}"

    def d(dias: int) -> str:
        return (fecha + timedelta(days=dias)).isoformat()

    url_ads = f"?utm_source=facebook&utm_medium=paid&utm_campaign={utm}&utm_content={{{{ad.name}}}}&utm_term={{{{adset.name}}}}"
    url = lambda medio: f"?utm_source=instagram&utm_medium={medio}&utm_campaign={utm}"  # noqa: E731

    campana = {
        "tipo": "campana",
        "titulo": titulo,
        "estado": "pendiente",
        "importante": True,
        "utm_campaign": utm,
        "inicio": d(-10),
        "fin": d(3),
        "etiquetas": ["clase gratuita"],
        "cuerpo": _html(
            f"Clase gratuita el <strong>{cuando}</strong>. Damos la clase, nos quedamos con el teléfono de quien se apunta y al "
            "final invitamos a la llamada de admisión.",
            f"Todos los enlaces de esta campaña llevan <strong>utm_campaign={utm}</strong>: así Visión suma sola los registros, "
            "las llamadas y las ventas, y en Matrículas se ve de dónde viene cada persona.",
        ),
    }

    C0, C1, C2, C3, C4, C5, C6 = 0, 340, 680, 1020, 1360, 1700, 2040
    nodos: list[dict] = [
        # Arriba: lo que se decide antes y lo que ya hay.
        {
            "clave": "objetivo", "tipo": "nota", "titulo": "Objetivo de la campaña", "x": C0, "y": -280,
            "importante": True,
            "cuerpo": _html(
                "Escribe aquí cuántos registros, cuántos asistentes y cuántas ventas quieres sacar de esta clase, y cuánto vas a "
                "gastar en anuncios. Al cerrar la campaña, compáralo con las cifras de abajo."
            ),
        },
        {
            "clave": "fechas", "tipo": "nota", "titulo": "Fechas clave", "x": C1, "y": -280,
            "cuerpo": _html(
                "- "
                + "\n- ".join(
                    [
                        f"{_corta(fecha - timedelta(days=10))}: página de la clase lista y UGC grabado",
                        f"{_corta(fecha - timedelta(days=7))}: anuncios y primer reel en marcha",
                        f"{_corta(fecha - timedelta(days=5))}: empiezan las historias",
                        f"{_corta(fecha - timedelta(days=1))}: ensayo de la clase",
                        f"{cuando}: la clase",
                        f"{_corta(fecha + timedelta(days=1))}: repetición y llamadas",
                        f"{_corta(fecha + timedelta(days=3))}: cierre de la oferta",
                    ]
                )
            ),
        },
        {
            "clave": "listo", "tipo": "nota", "titulo": "Lo que ya está hecho en la escuela", "x": C2, "y": -280,
            "estado": "hecho",
            "cuerpo": _html(
                "- Matrículas y Contactos guardan la campaña (utm) de cada persona y de dónde vino.\n"
                "- Panel → Anuncios: personas, ventas y coste por campaña y por anuncio («Tus anuncios»).\n"
                "- Llamadas con la agenda de Calendly, «Nueva llamada» y «¿Qué pasó?».\n"
                "- Enlace de pago, señal, «Otro importe» y 3 plazos.\n"
                "- Píxel de Meta y API de conversiones (en las páginas de la formación).\n"
                "- Esta campaña en Visión: suma sola sus leads, llamadas y ventas por el utm."
            ),
        },
        # Tráfico.
        {
            "clave": "ugc", "tipo": "anuncio", "titulo": "Anuncio UGC en Meta", "x": C0, "y": 0, "vence": d(-7),
            "checklist": _tareas(
                "Guion del UGC: gancho con un dolor real (el médico, las cartas, que otros hablen por ti)",
                "Elegir quién lo graba y grabar",
                "Editar 2 o 3 versiones con ganchos distintos",
                "Subir a Meta con los parámetros de URL de la página de esta tarjeta",
                "Conversión personalizada: Lead + la URL contiene la página de la clase",
                f"Apuntar la campaña en Panel → Anuncios con utm_campaign={utm}",
                "A las 48 h, mirar el coste por registro",
            ),
            "cuerpo": _html("Parámetros de URL del anuncio:", f"<code>{url_ads}</code>"),
        },
        {
            "clave": "reels", "tipo": "contenido", "titulo": "Reels orgánicos", "x": C0, "y": 170, "vence": d(-7),
            "checklist": _tareas(
                "Reel 1: el dolor (que otros hablen por ti)",
                "Reel 2: algo útil que se enseña en la clase",
                "Reel 3: invitación directa a la clase",
                "Llamada a la acción: comenta CLASE y te llega el enlace por DM",
                "Enlace de la bio con su utm",
            ),
            "cuerpo": _html("Enlace para los reels y la bio:", f"<code>{url('reel')}</code>"),
        },
        {
            "clave": "historias", "tipo": "contenido", "titulo": "Historias de Instagram", "x": C0, "y": 340,
            "inicio": d(-5), "fin": d(0), "vence": d(0),
            "checklist": _tareas(
                f"{_corta(fecha - timedelta(days=5))}: anuncio de la clase con sticker de enlace",
                f"{_corta(fecha - timedelta(days=3))}: caja de preguntas sobre el neerlandés",
                f"{_corta(fecha - timedelta(days=1))}: cuenta atrás",
                f"{_corta(fecha)}: «empezamos en una hora» con el enlace",
            ),
            "cuerpo": _html("Enlace para el sticker:", f"<code>{url('stories')}</code>"),
        },
        {
            "clave": "setter", "tipo": "contenido", "titulo": "DMs del setter", "x": C0, "y": 510, "vence": d(-1),
            "checklist": _tareas(
                "Un enlace personal por setter (abajo)",
                "Guion de DM: pregunta, invitación a la clase y enlace",
                "Ponerle nombre en Panel → Anuncios → «Tus anuncios» (setter-nombre → «Setter · Nombre»)",
                "Quien se apunte sin su enlace: dejar una nota en su ficha con quién la trajo",
            ),
            "cuerpo": _html(
                "Cada setter manda SU enlace. La escuela guarda el último trozo (setter-…) y en Panel → Anuncios → «Tus "
                "anuncios» salen sus personas y sus ventas.",
                f"<code>{url('dm')}&utm_content=setter-NOMBRE</code>",
            ),
        },
        # Registro.
        {
            "clave": "pagina", "tipo": "embudo", "titulo": "Página de la clase", "x": C1, "y": 255, "vence": d(-10),
            "importante": True,
            "checklist": _tareas(
                "Titular con la promesa de la clase",
                f"Fecha y hora ({cuando}), en hora de Países Bajos y de España",
                "Qué vas a aprender: 3 puntos concretos",
                "Quién da la clase: foto y nombre reales",
                "Formulario: nombre, correo y WhatsApp con prefijo (el de /formacion-nawar-fb)",
                "Que los datos lleguen a la escuela con la campaña (utm)",
                "Píxel: Lead al apuntarse + API de conversiones",
                "Página de gracias: añadir al calendario y unirse al canal de WhatsApp",
                "Fuera de Google (noindex) y probada en el móvil",
            ),
            "cuerpo": _html("Lo que necesita la página, en la lista de abajo. Cuando esté, pega aquí su dirección en Enlaces."),
        },
        {
            "clave": "recordatorios", "tipo": "embudo", "titulo": "Confirmación y recordatorios", "x": C2, "y": 255,
            "vence": d(-3),
            "checklist": _tareas(
                "Correo de confirmación al apuntarse, con el enlace de la clase",
                f"Correo el día antes ({_corta(fecha - timedelta(days=1))})",
                "WhatsApp 1 hora antes",
                "WhatsApp «empezamos» 5 minutos antes",
                "Decidir desde dónde salen (systeme.io, canal de WhatsApp)",
            ),
        },
        {
            "clave": "clase", "tipo": "embudo", "titulo": "La clase en directo", "x": C3, "y": 255,
            "inicio": d(0), "fin": d(0), "vence": d(0), "importante": True,
            "checklist": _tareas(
                "Plataforma y enlace (Zoom, Meet o YouTube)",
                "Profe confirmado",
                "Diapositivas",
                "Guion: que se lleven algo hecho, una historia y el siguiente paso",
                f"Ensayo el día antes ({_corta(fecha - timedelta(days=1))})",
                "Grabarla",
            ),
            "cuerpo": _html(f"<strong>{cuando}</strong>"),
        },
        # Después.
        {
            "clave": "oferta", "tipo": "embudo", "titulo": "Oferta al final de la clase", "x": C4, "y": 150, "vence": d(-2),
            "checklist": _tareas(
                "Qué se ofrece y hasta cuándo (fecha límite real)",
                "Siguiente paso: llamada de admisión o enlace de pago",
                "Bonus solo para quien entra antes del cierre",
                "Diapositiva final con el siguiente paso",
            ),
        },
        {
            "clave": "repeticion", "tipo": "contenido", "titulo": "Repetición 48 horas", "x": C4, "y": 380,
            "inicio": d(1), "fin": d(3), "vence": d(1),
            "checklist": _tareas(
                "Subir la grabación",
                "Correo con la repetición a quien no vino",
                "Quitarla al cerrar la oferta",
            ),
        },
        {
            "clave": "llamadas", "tipo": "tarea", "titulo": "Llamadas del closer", "x": C5, "y": 255,
            "inicio": d(0), "fin": d(3), "vence": d(2),
            "checklist": _tareas(
                "Llamar a quien vino en las primeras 24 horas",
                "Después, a quien se apuntó y no vino (con la repetición)",
                "Apuntar «¿Qué pasó?» en cada llamada",
                f"En Matrículas, buscar a la gente de {utm}",
            ),
        },
        {
            "clave": "cierre", "tipo": "tarea", "titulo": "Cierre de la oferta", "x": C6, "y": 255, "vence": d(3),
            "checklist": _tareas(
                "Correo y WhatsApp de última oportunidad",
                "Cerrar la oferta de verdad",
                "Apuntar el gasto final en esta campaña (Visión → Campañas)",
                "Revisar: coste por registro, asistencia y ventas frente al objetivo",
            ),
        },
    ]
    for i, (clave, nombre) in enumerate(
        [("coste_lead", "Coste por lead"), ("coste_agendada", "Coste por llamada agendada"), ("cierre", "Cierre"), ("cac", "CAC")]
    ):
        nodos.append(
            {
                "clave": f"m-{clave}", "tipo": "metrica", "titulo": nombre, "x": C1 + i * 250, "y": 640,
                "metrica": {"clave": clave, "campana": True},
            }
        )

    flechas = [("ugc", "pagina", ""), ("reels", "pagina", ""), ("historias", "pagina", ""), ("setter", "pagina", "")]
    flechas += [
        ("pagina", "recordatorios", "se apunta"),
        ("recordatorios", "clase", ""),
        ("clase", "oferta", "al final"),
        ("clase", "repeticion", "no vino"),
        ("oferta", "llamadas", "pide llamada"),
        ("repeticion", "llamadas", ""),
        ("llamadas", "cierre", ""),
    ]
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
        return {"ok": False, "motivo": "Pon el día de la clase"}
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

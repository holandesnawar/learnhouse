"""
Anuncios: qué trajo cada campaña. Leads, matrículas, ventas e ingresos, y lo
que costó cada uno.

Cómo se sabe qué persona vino de qué anuncio: por el `utm_campaign` del
enlace. La web lo guarda en cada alta (guías, formularios, matrícula), así que
una campaña apuntada aquí con el MISMO utm_campaign que su enlace se queda con
todas las personas que llegaron por él. Cuenta cualquier contacto por ese
enlace, no solo el primero: quien bajó la guía por un anuncio y compró semanas
después cuenta como venta de ese anuncio.

Los utm_campaign que aparecen en los leads sin campaña apuntada salen aparte,
para que no se pierdan ("hay 12 leads de 'reels-oct' y no sé qué es").

El cálculo es una función pura (`metricas`), con test.

Los ANUNCIOS concretos (14/10)
------------------------------
Dentro de una campaña, cada anuncio llega por `utm_content={{ad.name}}`: el
nombre que tenía el anuncio en Meta AL PUBLICARLO. Meta lo congela ahí; si se
renombra después, sigue mandando el viejo. Por eso la escuela deja ponerle a
cada anuncio su nombre de aquí (`nombres_anuncios` en org_config, por el nombre
que manda Meta en minúsculas): «VIDEO | UGC | VSL | A» → «UGC octubre 1 · A».
El nombre de aquí es el que sale en la tarjeta de Matrículas y en la ficha.
`limpiar_anuncio` deshace además una codificación de más (`%20`, `%7C`) por si
algún enlace llega así: el navegador ya descodifica una vez, pero no dos.
"""

import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import unquote

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.panel_negocio import AdCampaign

PLATAFORMAS = {"meta": "Meta (Instagram y Facebook)", "google": "Google", "tiktok": "TikTok", "youtube": "YouTube", "otro": "Otra"}


def _clave(texto: str) -> str:
    return (texto or "").strip().lower()


def campanas_de(ficha: dict) -> set[str]:
    """Todos los utm_campaign por los que ha llegado esta persona."""
    vistas = {_clave(e.get("utm_campaign", "")) for e in ficha.get("eventos") or []}
    vistas.add(_clave(ficha.get("utm_campaign", "")))
    vistas.discard("")
    return vistas


def limpiar_anuncio(crudo: str) -> str:
    """El nombre del anuncio tal como se lee. Si llega con `%20`/`%7C` sin
    descodificar (una o dos veces), se descodifica. Un `{{…}}` sin sustituir
    (el enlace abierto fuera de Meta) no es un nombre: vacío. Función pura."""
    texto = (crudo or "").strip()
    for _ in range(2):
        if not re.search(r"%[0-9A-Fa-f]{2}", texto):
            break
        texto = unquote(texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return "" if "{{" in texto else texto


def nombre_del_anuncio(crudo: str, nombres: Optional[dict] = None) -> str:
    """El nombre de la escuela si se le puso uno; si no, el de Meta, limpio."""
    limpio = limpiar_anuncio(crudo)
    if not limpio:
        return ""
    return ((nombres or {}).get(limpio.lower()) or "").strip() or limpio


def anuncios_vistos(fichas: list[dict], nombres: Optional[dict] = None) -> list[dict]:
    """Cada anuncio que ha traído a alguien: su nombre en Meta, el de la
    escuela, cuántas personas y cuántas pagaron, y cuándo llegó la primera y la
    última. Una persona cuenta una vez por anuncio. Función pura."""
    por: dict[str, dict] = {}
    for f in fichas:
        suyos: dict[str, str] = {}
        for e in f.get("eventos") or []:
            limpio = limpiar_anuncio(e.get("utm_content", ""))
            if limpio:
                cuando = e.get("when", "") or ""
                previo = suyos.get(limpio)
                suyos[limpio] = min(previo, cuando) if previo else cuando
        propio = limpiar_anuncio(f.get("utm_content", ""))
        if propio and propio not in suyos:
            suyos[propio] = ""
        for limpio, cuando in suyos.items():
            clave = limpio.lower()
            a = por.setdefault(clave, {"meta": limpio, "leads": 0, "ventas": 0, "primero": "", "ultimo": ""})
            a["leads"] += 1
            if f.get("etapa") == "alumno":
                a["ventas"] += 1
            if cuando:
                a["primero"] = min(a["primero"], cuando) if a["primero"] else cuando
                a["ultimo"] = max(a["ultimo"], cuando)
    filas = [
        {**a, "nombre": ((nombres or {}).get(clave) or "").strip()}
        for clave, a in por.items()
    ]
    filas.sort(key=lambda a: a["ultimo"], reverse=True)
    return filas


async def leer_nombres(org_id: int, db_session: AsyncSession) -> dict[str, str]:
    from src.db.organization_config import OrganizationConfig

    if db_session is None:
        return {}
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if not fila or not isinstance(fila.config, dict):
        return {}
    guardado = fila.config.get("nombres_anuncios")
    if not isinstance(guardado, dict):
        return {}
    return {str(k): str(v) for k, v in guardado.items() if v}


async def guardar_nombre(org_id: int, meta: str, nombre: str, db_session: AsyncSession) -> dict:
    """Pone (o quita, con nombre vacío) el nombre de la escuela a un anuncio."""
    from src.db.organization_config import OrganizationConfig

    limpio = limpiar_anuncio(meta)
    if not limpio:
        return {"ok": False, "motivo": "Falta el nombre del anuncio"}
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        return {"ok": False, "motivo": "La escuela no tiene configuración"}
    config = json.loads(json.dumps(fila.config or {}))
    nombres = config.get("nombres_anuncios") if isinstance(config.get("nombres_anuncios"), dict) else {}
    nombre = (nombre or "").strip()[:80]
    if nombre:
        nombres[limpio.lower()] = nombre
    else:
        nombres.pop(limpio.lower(), None)
    config["nombres_anuncios"] = nombres
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "meta": limpio, "nombre": nombre}


def metricas(campanas: list[dict], fichas: list[dict], ingresos_por_email: dict[str, int]) -> dict:
    """Cruza las campañas apuntadas con las fichas de Contactos.

    campanas: {id, nombre, utm_campaign, gasto_cents, …}
    fichas: las de `fusionar_contactos` (con `eventos` y `etapa`).
    ingresos_por_email: lo cobrado a cada persona, en céntimos.
    """
    por_utm: dict[str, list[dict]] = {}
    for f in fichas:
        for c in campanas_de(f):
            por_utm.setdefault(c, []).append(f)

    filas = []
    conocidas = set()
    for c in campanas:
        clave = _clave(c.get("utm_campaign", ""))
        conocidas.add(clave)
        gente = por_utm.get(clave, []) if clave else []
        leads = len(gente)
        matriculas = sum(1 for f in gente if f.get("etapa") in ("pidio", "en-pago", "alumno"))
        ventas = [f for f in gente if f.get("etapa") == "alumno"]
        ingresos = sum(ingresos_por_email.get(f["email"], 0) for f in ventas)
        gasto = int(c.get("gasto_cents") or 0)
        filas.append(
            {
                **c,
                "leads": leads,
                "matriculas": matriculas,
                "ventas": len(ventas),
                "ingresos_cents": ingresos,
                "coste_por_lead_cents": round(gasto / leads) if gasto and leads else None,
                "coste_por_venta_cents": round(gasto / len(ventas)) if gasto and ventas else None,
                # Por cada euro gastado, cuántos entraron.
                "retorno": round(ingresos / gasto, 2) if gasto else None,
                "personas": [
                    {"email": f["email"], "nombre": f.get("nombre", ""), "etapa": f.get("etapa", ""), "when": (f.get("primer_contacto") or {}).get("when", "")}
                    for f in sorted(gente, key=lambda f: (f.get("primer_contacto") or {}).get("when", ""), reverse=True)
                ],
            }
        )

    sueltas = [
        {"utm_campaign": utm, "leads": len(gente), "ventas": sum(1 for f in gente if f.get("etapa") == "alumno")}
        for utm, gente in por_utm.items()
        if utm not in conocidas
    ]
    sueltas.sort(key=lambda s: s["leads"], reverse=True)

    gasto_total = sum(int(c.get("gasto_cents") or 0) for c in campanas)
    ingresos_total = sum(f["ingresos_cents"] for f in filas)
    return {
        "campanas": filas,
        "sin_apuntar": sueltas,
        "total": {
            "gasto_cents": gasto_total,
            "leads": sum(f["leads"] for f in filas),
            "ventas": sum(f["ventas"] for f in filas),
            "ingresos_cents": ingresos_total,
            "retorno": round(ingresos_total / gasto_total, 2) if gasto_total else None,
        },
    }


def a_dict(c: AdCampaign) -> dict:
    return {
        "id": c.id,
        "nombre": c.nombre,
        "plataforma": c.plataforma,
        "utm_campaign": c.utm_campaign,
        "inicio": c.inicio,
        "fin": c.fin,
        "gasto_cents": c.gasto_cents,
        "notas": c.notas,
    }


async def listar(org_id: int, db_session: AsyncSession) -> list[dict]:
    filas = (
        await db_session.execute(select(AdCampaign).where(AdCampaign.org_id == org_id).order_by(AdCampaign.inicio.desc(), AdCampaign.id.desc()))  # type: ignore[attr-defined]
    ).scalars().all()
    return [a_dict(c) for c in filas]


async def panel_ads(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.contactos.contactos import _emails_con_cuenta, _todos_los_eventos, fusionar_contactos
    from src.services.contactos.metricas import emails_excluidos

    fuera = await emails_excluidos(db_session)
    fichas = [
        f
        for f in fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
        if f["email"] not in fuera
    ]
    ingresos: dict[str, int] = {}
    for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all():
        e = _clave(r.email)
        ingresos[e] = ingresos.get(e, 0) + int(r.amount_cents or 0)
    datos = metricas(await listar(org_id, db_session), fichas, ingresos)
    datos["plataformas"] = PLATAFORMAS
    datos["anuncios"] = anuncios_vistos(fichas, await leer_nombres(org_id, db_session))
    return datos


def _fecha(texto: str) -> str:
    texto = (texto or "").strip()[:10]
    try:
        datetime.strptime(texto, "%Y-%m-%d")
        return texto
    except ValueError:
        return ""


async def guardar(org_id: int, data: dict, db_session: AsyncSession, campana_id: Optional[int] = None) -> dict:
    if campana_id is not None:
        c = (
            await db_session.execute(select(AdCampaign).where(AdCampaign.id == campana_id, AdCampaign.org_id == org_id))
        ).scalars().first()
        if c is None:
            return {"ok": False, "motivo": "No existe esa campaña"}
    else:
        c = AdCampaign(org_id=org_id, created_at=datetime.now(timezone.utc).isoformat())
    if "nombre" in data:
        c.nombre = (data.get("nombre") or "").strip()[:200]
    if "plataforma" in data:
        c.plataforma = data.get("plataforma") if data.get("plataforma") in PLATAFORMAS else "otro"
    if "utm_campaign" in data:
        c.utm_campaign = (data.get("utm_campaign") or "").strip()[:120]
    if "inicio" in data:
        c.inicio = _fecha(data.get("inicio") or "")
    if "fin" in data:
        c.fin = _fecha(data.get("fin") or "")
    if "gasto" in data and data.get("gasto") is not None:
        c.gasto_cents = max(0, int(round(float(data["gasto"]) * 100)))
    if "notas" in data:
        c.notas = (data.get("notas") or "").strip()[:1000]
    if not c.nombre:
        return {"ok": False, "motivo": "La campaña necesita un nombre"}
    if not c.utm_campaign:
        return {"ok": False, "motivo": "Falta el utm_campaign: es lo que une la campaña con sus leads"}
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return {"ok": True, "campana": a_dict(c)}


async def borrar(org_id: int, campana_id: int, db_session: AsyncSession) -> bool:
    c = (
        await db_session.execute(select(AdCampaign).where(AdCampaign.id == campana_id, AdCampaign.org_id == org_id))
    ).scalars().first()
    if c is None:
        return False
    await db_session.delete(c)
    await db_session.commit()
    return True

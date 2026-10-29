"""
Panel → Correos (29/10/2026): qué está pasando con el email marketing, para el
administrador. Pedido del usuario: "una sección para mí sobre lo que pasa con
los mails, estilo CRM newsletter: quién está dónde, a quién le llegó qué… que
me sirva para ver qué está pasando".

Cómo lo enseñan otras herramientas (se miró antes de hacerlo) y qué se cogió:
- **Klaviyo**: la automatización como un recorrido de tarjetas, una por
  correo, cada una con a cuántos les llegó y cuántos cumplieron el objetivo
  después. Aquí: `pasos`, con enviados, esperando, volvieron por él y
  reservaron / pagaron después.
- **Kit** (ConvertKit): la gente de una secuencia por estados (activos,
  terminaron, se dieron de baja). Aquí: `resumen` y la situación de cada
  persona (`ebook.SITUACIONES`).
- **ActiveCampaign**: los objetivos (reservar la llamada, pagar) sacan de la
  automatización, y se ve el camino de cada persona. Aquí: `persona`, su línea
  de tiempo con cada correo y cada cosa que hizo.

Lo que NO se mide: las aperturas ni los clics dentro del correo. Haría falta
que Resend los apuntara y avisara a la escuela, y las aperturas del iPhone son
falsas (Apple abre todos los correos para esconder si se leen). Lo que SÍ se
mide, y vale más: quién **volvió** desde un correo y qué hizo (los botones
llevan `utm_content=<id del correo>` y la web lo guarda en lo que hace la
persona), y quién **reservó o pagó después** de recibirlo.

Hoy la única campaña automática es la de Black Friday
(`services/ebook/ebook.py`): la sección se apoya en ella (las mismas reglas
para decidir el próximo correo: `ebook.que_le_toca` / `ebook.proximo`) y en
`email_log`, donde queda cada correo que manda la escuela desde el 28/09.
Quien está fuera de los números (pruebas) no cuenta, salvo en «Envíos», que
es el registro tal cual.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.ebook import ebook as E

#: Las acciones de la persona que salen en su línea de tiempo.
ACCIONES = {
    E.TIPO_LISTA: "Desbloqueó la oferta",
    E.TIPO_EMPEZADO: "Abrió el pago del ebook",
    E.TIPO_COMPRA: "Compró el ebook",
    "agendar-empezado": "Empezó a pedir la llamada",
    "cualificacion": "Terminó las preguntas de la llamada",
    "reunion": "Reservó la llamada",
    "llamada-equipo": "El equipo le agendó una llamada",
    E.TIPO_BAJA: "Se dio de baja de los correos",
}
GRUPOS = {E.PARA_SIN_COMPRAR: "No compró el ebook", E.PARA_COMPRADORES: "Compró el ebook"}
ENVIOS_MAX = 300


def _texto_dia(dia: str) -> str:
    """«2026-11-27» → «vie 27 nov»."""
    try:
        from datetime import date

        d = date.fromisoformat(dia[:10])
    except (TypeError, ValueError):
        return dia or ""
    return f"{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'][d.weekday()]} {d.day} {E._MESES[d.month - 1][:3]}"


def pasos(cfg: dict) -> list[dict]:
    """Las tarjetas del recorrido, en orden, con a quién va cada una y cuándo
    sale. Dos ramas (no compró / compró) y, en la de compradores, «te quedaste
    a un paso» al lado (`lateral`). Pura."""
    def carta(clave: str, grupo: str, cuando: str, lateral: bool = False) -> dict:
        c = cfg[clave]
        return {"id": clave, "asunto": c["asunto"], "grupo": grupo, "cuando": cuando,
                "apagado": bool(c.get("apagado")), "lateral": lateral}

    def correo(c: dict) -> dict:
        cuando = (
            _texto_dia(c["fecha"]) + (", a quien no compró" if E.para_quien(c) == E.PARA_SIN_COMPRAR else ", a quien sigue en la campaña")
            if c.get("fecha")
            else f"{c['dia']} {'día' if c['dia'] == 1 else 'días'} después de comprar"
        )
        return {"id": c["id"], "asunto": c["asunto"], "grupo": E.para_quien(c), "cuando": cuando,
                "apagado": bool(c.get("apagado")), "lateral": False}

    sin = [
        carta(E.ID_ACCESO, E.PARA_SIN_COMPRAR, "Al momento, al desbloquear la oferta"),
        carta(E.ID_PENDIENTE, E.PARA_SIN_COMPRAR, "Al día siguiente, si no ha comprado"),
        *[correo(c) for c in cfg["correos"] if E.para_quien(c) == E.PARA_SIN_COMPRAR],
    ]
    entrega = cfg["entrega"]
    comp = [
        {"id": "entrega", "asunto": entrega["asunto"], "grupo": E.PARA_COMPRADORES,
         "cuando": "Al momento, al comprar (con el PDF)", "apagado": False, "lateral": False},
        *[correo(c) for c in cfg["correos"] if E.para_quien(c) == E.PARA_COMPRADORES],
        carta(E.ID_FORMULARIO, E.PARA_COMPRADORES, "Al día siguiente, si empezó a pedir la llamada y no reservó", lateral=True),
    ]
    return sin + comp


def _instante(texto: Any):
    from src.services.panel.tandas import leer_instante

    return leer_instante(texto)


def armar_panel(
    *,
    cfg: dict,
    p: dict,
    pagaron: set,
    fuera: set,
    hoy: str,
    marcas: list[dict],
    reservas: dict[str, list[str]],
    pagos: dict[str, str],
    vueltas: list[dict],
    envios: list[dict],
) -> dict:
    """Todo lo de la pantalla, sin tocar la base de datos. Pura.

    marcas: cada correo de la campaña enviado ({email, id, cuando}, de los
    `correo-bf`). reservas: {email: [cuándo reservó]}. pagos: {email: cuándo
    pagó la formación}. vueltas: lo que hizo alguien al llegar desde un correo
    ({email, id, kind, cuando}). envios: las filas de `email_log`."""
    personas_todas = {e: g for e, g in p["gente"].items() if e not in fuera}

    # ── cada persona ──
    enviados_a: dict[str, list[dict]] = {}
    for m in marcas:
        if m["email"] not in fuera:
            enviados_a.setdefault(m["email"], []).append(m)
    asuntos = {x["id"]: x["asunto"] for x in pasos(cfg)}
    personas = []
    for email, g in personas_todas.items():
        sit = E.situacion(email, p, pagaron)
        suyas = sorted(enviados_a.get(email, []), key=lambda m: m["cuando"])
        if g["ebook"]:
            # La entrega no deja marca de campaña: sale al comprar.
            suyas = sorted(suyas + [{"email": email, "id": "entrega", "cuando": p["compras"][email]["creado"]}], key=lambda m: m["cuando"])
        prox = E.proximo(email, hoy, p, cfg, pagaron)
        ultimo = suyas[-1] if suyas else None
        personas.append({
            "email": email,
            "nombre": g["nombre"],
            "via": "desbloqueó y compró" if g["lista"] and g["ebook"] else "compró" if g["ebook"] else "desbloqueó" if g["lista"] else "abrió el pago",
            "entro": g["creado"],
            "situacion": sit,
            "etiqueta": E.SITUACIONES[sit],
            "recibidos": len(suyas),
            "ultimo": {"id": ultimo["id"], "asunto": asuntos.get(ultimo["id"], ultimo["id"]), "cuando": ultimo["cuando"]} if ultimo else None,
            "proximo": prox,
        })
    personas.sort(key=lambda x: x["entro"], reverse=True)

    # ── cada correo del recorrido ──
    proximos: dict[str, int] = {}
    for x in personas:
        if x["proximo"]:
            proximos[x["proximo"]["id"]] = proximos.get(x["proximo"]["id"], 0) + 1
    vuelta_de: dict[str, set] = {}
    for v in vueltas:
        if v["email"] not in fuera and v.get("id"):
            vuelta_de.setdefault(v["id"], set()).add(v["email"])

    def despues(email: str, cuando: str) -> tuple[bool, bool]:
        t = _instante(cuando)
        if t is None:
            return False, False
        reservo = any((r := _instante(c)) is not None and r >= t for c in reservas.get(email, []))
        pago = (q := _instante(pagos.get(email, ""))) is not None and q >= t
        return reservo, pago

    salida_pasos = []
    for paso in pasos(cfg):
        if paso["id"] == "entrega":
            recibieron = {e: p["compras"][e]["creado"] for e in p["compras"] if e not in fuera}
        else:
            recibieron: dict[str, str] = {}
            for m in marcas:
                if m["id"] == paso["id"] and m["email"] not in fuera:
                    if m["email"] not in recibieron or m["cuando"] < recibieron[m["email"]]:
                        recibieron[m["email"]] = m["cuando"]
        reservaron = pagaron_tras = 0
        for e, cuando in recibieron.items():
            r, q = despues(e, cuando)
            reservaron += r
            pagaron_tras += q
        salida_pasos.append({
            **paso,
            "enviados": len(recibieron),
            "esperando": proximos.get(paso["id"], 0),
            "volvieron": len(vuelta_de.get(paso["id"], set())),
            "reservaron_despues": reservaron,
            "pagaron_despues": pagaron_tras,
        })

    # ── el resumen, por estados ──
    def contar(*sits: str) -> int:
        return sum(1 for x in personas if x["situacion"] in sits)

    inicio_hoy = _instante(hoy + "T00:00:00+01:00")
    hace7 = inicio_hoy - timedelta(days=7) if inicio_hoy else None
    marcas_vivas = [m for m in marcas if m["email"] not in fuera]
    entregas = [p["compras"][e]["creado"] for e in p["compras"] if e not in fuera]
    todos_envios = [m["cuando"] for m in marcas_vivas] + entregas
    resumen = {
        "entraron": len(personas),
        "desbloquearon": sum(1 for g in personas_todas.values() if g["lista"]),
        "compraron": sum(1 for g in personas_todas.values() if g["ebook"]),
        "activos": sum(1 for x in personas if x["proximo"]),
        "terminaron": sum(1 for x in personas if not x["proximo"] and x["situacion"] in ("sin-comprar", "comprador", "llamada")),
        "reservaron": contar("reservo"),
        "pagaron": contar("pago"),
        "bajas": contar("baja"),
        "no_encajan": contar("no-encaja"),
        "enviados": len(todos_envios),
        "enviados_7d": sum(1 for c in todos_envios if hace7 and (t := _instante(c)) is not None and t >= hace7),
        "fallidos_7d": sum(1 for f in envios if not f["ok"] and hace7 and (t := _instante(f["cuando"])) is not None and t >= hace7),
        "por_situacion": {s: contar(s) for s in E.SITUACIONES},
    }

    # ── los envíos (todo lo que manda la escuela) ──
    de_bf = {E.rellenar(x["asunto"], E._valores(cfg, "")).strip().lower(): x["id"] for x in pasos(cfg)}
    nombres = {e: g["nombre"] for e, g in p["gente"].items()}
    lista_envios = []
    for f in envios[:ENVIOS_MAX]:
        ident = de_bf.get((f["asunto"] or "").strip().lower(), "")
        lista_envios.append({**f, "campana": "Black Friday" if ident else "", "correo": ident, "nombre": nombres.get(f["email"], "")})

    return {
        "campana": {"activa": bool(cfg.get("campana")), "venta": bool(cfg.get("activo")), "desde": cfg.get("desde", ""),
                    "hasta": cfg.get("hasta", ""), "hoy": hoy},
        "resumen": resumen,
        "grupos": GRUPOS,
        "pasos": salida_pasos,
        "personas": personas,
        "envios": lista_envios,
    }


# ── leer de la base de datos ────────────────────────────────────────────────


async def _marcas(db: AsyncSession) -> list[dict]:
    from src.db.contact_event import ContactEvent

    filas = (
        await db.execute(select(ContactEvent.email, ContactEvent.extra, ContactEvent.created_at).where(ContactEvent.kind == E.TIPO_CORREO))
    ).all()
    salida = []
    for email, extra, creado in filas:
        try:
            ident = str(json.loads(extra or "{}").get("id") or "")
        except (TypeError, ValueError):
            ident = ""
        if email and ident:
            salida.append({"email": email.strip().lower(), "id": ident, "cuando": creado or ""})
    return salida


async def _reservas(db: AsyncSession) -> dict[str, list[str]]:
    from src.db.contact_event import ContactEvent

    salida: dict[str, list[str]] = {}
    for email, creado in (
        await db.execute(select(ContactEvent.email, ContactEvent.created_at).where(ContactEvent.kind.in_(list(E.TIPOS_RESERVO))))  # type: ignore[attr-defined]
    ).all():
        if email:
            salida.setdefault(email.strip().lower(), []).append(creado or "")
    return salida


async def _pagos(db: AsyncSession) -> dict[str, str]:
    from src.db.enrollment import Enrollment

    salida: dict[str, str] = {}
    for email, pagado in (
        await db.execute(select(Enrollment.email, Enrollment.paid_at).where(Enrollment.status == "paid"))
    ).all():
        e = (email or "").strip().lower()
        if e and pagado and (e not in salida or pagado < salida[e]):
            salida[e] = pagado
    return salida


async def _vueltas(db: AsyncSession) -> list[dict]:
    """Lo que hizo la gente al llegar desde un correo de la campaña: la web
    guarda los utm del enlace en cada cosa que hace (desbloquear, comprar,
    pedir la llamada, reservar)."""
    from src.db.contact_event import ContactEvent

    filas = (
        await db.execute(
            select(ContactEvent.email, ContactEvent.kind, ContactEvent.utm_content, ContactEvent.created_at).where(
                ContactEvent.utm_source == "email", ContactEvent.utm_campaign == "black-friday"
            )
        )
    ).all()
    return [
        {"email": (e or "").strip().lower(), "kind": k, "id": (u or "").strip(), "cuando": c or ""}
        for e, k, u, c in filas
        if e
    ]


async def _envios(db: AsyncSession, email: str = "", limite: int = ENVIOS_MAX) -> list[dict]:
    from src.db.panel_negocio import EmailLog

    q = select(EmailLog).order_by(EmailLog.created_at.desc()).limit(limite)  # type: ignore[attr-defined]
    if email:
        q = q.where(EmailLog.email == email)
    return [
        {"email": f.email, "asunto": f.asunto, "ok": bool(f.ok), "cuando": f.created_at}
        for f in (await db.execute(q)).scalars().all()
    ]


async def panel(org_id: int, db: AsyncSession) -> dict:
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.contactos.metricas import emails_excluidos
    from src.services.panel.tandas import hoy_nl

    cfg = await E.leer(db, org_id)
    return armar_panel(
        cfg=cfg,
        p=await E._personas(db),
        pagaron=await emails_que_pagaron(db),
        fuera=await emails_excluidos(db),
        hoy=hoy_nl(),
        marcas=await _marcas(db),
        reservas=await _reservas(db),
        pagos=await _pagos(db),
        vueltas=await _vueltas(db),
        envios=await _envios(db),
    )


#: Las cifras de Black Friday que puede enseñar una tarjeta de métrica de
#: Visión (`{"fuente": "black-friday", "clave": …}`).
CIFRAS_MAPA = {
    "entraron": "Han entrado (dejaron sus datos)",
    "desbloquearon": "Desbloquearon la oferta",
    "compraron": "Compraron el ebook",
    "sin_comprar": "Sin comprar el ebook",
    "activos": "Reciben correos ahora",
    "llamada": "Empezaron la llamada sin reservar",
    "reservaron": "Reservaron la llamada",
    "pagaron": "Pagaron la formación",
    "no_encajan": "No encajan",
    "bajas": "Se dieron de baja",
}


def cifras_mapa(resumen: dict) -> dict:
    """Del resumen del panel, las cifras con nombre para las tarjetas. Pura."""
    por = resumen.get("por_situacion", {})
    valores = {**resumen, "sin_comprar": por.get("sin-comprar", 0), "llamada": por.get("llamada", 0)}
    return {clave: int(valores.get(clave) or 0) for clave in CIFRAS_MAPA}


async def para_el_mapa(org_id: int, db: AsyncSession) -> dict:
    """Lo que necesitan las tarjetas de Visión: cada correo de la campaña con
    su asunto, cuándo sale y sus cifras, y las cifras del embudo en vivo. Lo
    mismo que el panel de Correos, para que los dos digan lo mismo."""
    d = await panel(org_id, db)
    return {
        "correos": {x["id"]: x for x in d["pasos"]},
        "cifras": cifras_mapa(d["resumen"]),
        "nombres": CIFRAS_MAPA,
    }


def linea_de_tiempo(eventos: list[dict], envios: list[dict], asuntos_bf: dict[str, str]) -> list[dict]:
    """Los correos que le llegaron (todos los de la escuela, no solo la
    campaña) y lo que hizo, del más nuevo al más viejo. Pura."""
    linea = []
    for f in envios:
        ident = asuntos_bf.get((f["asunto"] or "").strip().lower(), "")
        linea.append({"cuando": f["cuando"], "tipo": "correo", "texto": f["asunto"], "ok": f["ok"],
                      "campana": "Black Friday" if ident else "", "correo": ident})
    for ev in eventos:
        texto = ACCIONES.get(ev["kind"])
        if not texto:
            continue
        if ev["kind"] == "cualificacion":
            texto += " · no encaja" if ev.get("apto") is False else " · encaja"
        if ev.get("desde"):
            texto += f" (desde el correo «{ev['desde']}»)"
        linea.append({"cuando": ev["cuando"], "tipo": "accion", "texto": texto, "ok": True, "campana": "", "correo": ""})
    return sorted(linea, key=lambda x: x["cuando"] or "", reverse=True)


async def persona(org_id: int, email: str, db: AsyncSession) -> dict:
    from src.db.contact_event import ContactEvent
    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.panel.tandas import hoy_nl

    email = (email or "").strip().lower()
    cfg = await E.leer(db, org_id)
    p = await E._personas(db)
    pagaron = await emails_que_pagaron(db)
    eventos = []
    for kind, extra, creado, fuente, campana, contenido in (
        await db.execute(
            select(ContactEvent.kind, ContactEvent.extra, ContactEvent.created_at, ContactEvent.utm_source,
                   ContactEvent.utm_campaign, ContactEvent.utm_content).where(
                ContactEvent.email == email, ContactEvent.kind.in_(list(ACCIONES))  # type: ignore[attr-defined]
            )
        )
    ).all():
        try:
            apto = json.loads(extra or "{}").get("apto")
        except (TypeError, ValueError, AttributeError):
            apto = None
        desde = (contenido or "") if fuente == "email" and campana == "black-friday" else ""
        eventos.append({"kind": kind, "cuando": creado or "", "apto": apto, "desde": desde})
    por_id = {x["id"]: x["asunto"] for x in pasos(cfg)}
    for ev in eventos:
        if ev["desde"]:
            ev["desde"] = por_id.get(ev["desde"], ev["desde"])
    asuntos = {E.rellenar(x["asunto"], E._valores(cfg, "")).strip().lower(): x["id"] for x in pasos(cfg)}
    g = p["gente"].get(email) or {}
    sit = E.situacion(email, p, pagaron)
    return {
        "email": email,
        "nombre": g.get("nombre", ""),
        "situacion": sit,
        "etiqueta": E.SITUACIONES[sit],
        "en_campana": email in p["gente"],
        "proximo": E.proximo(email, hoy_nl(), p, cfg, pagaron),
        "linea": linea_de_tiempo(eventos, await _envios(db, email=email, limite=200), asuntos),
    }

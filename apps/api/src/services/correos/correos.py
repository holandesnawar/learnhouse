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

⚠️ **Desde el 29/10 los correos de Black Friday los manda systeme.io**
("para no castigar el correo de la escuela"): la campaña de la escuela está
apagada (Avisos → Ebook Black Friday → «Campaña de correos») y la escuela solo
manda la entrega del ebook. Con la campaña apagada, esta sección cambia de
fuente (`armar_panel_systeme`): el recorrido son los pasos de las dos campañas
de systeme.io y sus newsletters (`panel/black_friday.py`), y a quién le ha
llegado cada uno se CALCULA con su calendario desde el día en que se
encendieron (`systeme_desde`), igual que el bloque «Black Friday» de la ficha.
Lo que sí es medido, no calculado: quién volvió por cada botón y qué hizo.
"Ver" lleva a la página del correo en systeme.io (no hay vista previa: el
correo vive allí).
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
    "llamada-cambiada": "El equipo le cambió la hora de la llamada",
    "llamada-cancelada": "El equipo le canceló la llamada",
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


# ── los correos de systeme.io (desde el 29/10) ─────────────────────────────


def _dia_nl(iso: str) -> str:
    """El día (AAAA-MM-DD) de un instante, en hora de Países Bajos."""
    t = _instante(iso)
    if t is None:
        return (iso or "")[:10]
    try:
        from zoneinfo import ZoneInfo

        return t.astimezone(ZoneInfo("Europe/Amsterdam")).date().isoformat()
    except Exception:  # noqa: BLE001
        return t.date().isoformat()


def pasos_systeme() -> list[dict]:
    """El recorrido cuando los correos los manda systeme.io: los pasos de sus
    dos campañas, con la entrega del ebook (la manda la escuela) delante de los
    de compradores. Pura."""
    from src.services.panel import black_friday as BF

    def cuando(dia: int, que: str) -> str:
        if dia == 0:
            return f"Al momento, al {que}"
        return f"{dia} {'día' if dia == 1 else 'días'} después de {que}"

    sin = [
        {"id": ident, "asunto": asunto, "grupo": E.PARA_SIN_COMPRAR, "cuando": cuando(dia, "apuntarse a la lista"),
         "apagado": False, "lateral": False, "enlace": BF.enlace_systeme(ident), "calculado": True}
        for ident, asunto, dia in BF.CAMPANAS["no-compradores"]
    ]
    comp = [
        {"id": "entrega", "asunto": "", "grupo": E.PARA_COMPRADORES, "cuando": "Al momento, al comprar (con el PDF). Lo manda la escuela",
         "apagado": False, "lateral": False, "enlace": "", "calculado": False},
        *[
            {"id": ident, "asunto": asunto, "grupo": E.PARA_COMPRADORES, "cuando": cuando(dia, "comprar el ebook"),
             "apagado": False, "lateral": False, "enlace": BF.enlace_systeme(ident), "calculado": True}
            for ident, asunto, dia in BF.CAMPANAS["compradores"]
        ],
    ]
    return sin + comp


#: Las newsletters, en el orden en que se mandan. Las dos de «abrimos» son
#: dos botones del mismo correo: cuentan juntas.
NEWSLETTERS_SYSTEME = [
    ("nl-abrimos", ("nl-abrimos-1", "nl-abrimos-2"), "A toda la lista de correo"),
    ("nl-recuerdas", ("nl-recuerdas",), "A toda la lista de correo"),
    ("nl-lista", ("nl-lista",), "A quien se apuntó a la lista prioritaria"),
]


def situacion_bf(ficha: dict, r: dict, pagaron: set) -> str:
    """Dónde está, con las mismas claves que la campaña de la escuela
    (`ebook.SITUACIONES`), mirando sus eventos. Pura."""
    from src.services.panel import black_friday as BF

    eventos = ficha.get("eventos") or []
    kinds = {e.get("kind") for e in eventos}
    if ficha["email"] in pagaron or ficha.get("etapa") == "alumno":
        return "pago"
    if kinds & BF._RESERVO:
        return "reservo"
    if E.TIPO_BAJA in kinds:
        return "baja"
    if any(e.get("kind") == "cualificacion" and BF._extra(e).get("apto") is False
           and BF._extra(e).get("embudo") == "black-friday" for e in eventos):
        return "no-encaja"
    if r.get("ebook"):
        t_ebook = r["ebook"].get("cuando", "")
        empezo = any(e.get("kind") in BF._FORMULARIO and BF._extra(e).get("embudo") == "black-friday"
                     and str(e.get("when") or "") >= t_ebook for e in eventos)
        return "llamada" if empezo else "comprador"
    return "sin-comprar"


def armar_panel_systeme(
    *,
    cfg: dict,
    fichas: list[dict],
    pagaron: set,
    fuera: set,
    hoy: str,
    ahora,
    pagos: dict[str, str],
    envios: list[dict],
) -> dict:
    """Lo mismo que `armar_panel`, pero con los correos de systeme.io
    calculados por su calendario (`black_friday.resumen`, el mismo bloque de
    la ficha: los dos dicen lo mismo). `fichas`: {email, nombre, eventos,
    pasos, etapa} de quien pasó por Black Friday. Pura."""
    from src.services.panel import black_friday as BF

    desde = cfg.get("systeme_desde") or ""
    pasos_ = pasos_systeme()
    pasos_[next(i for i, x in enumerate(pasos_) if x["id"] == "entrega")]["asunto"] = cfg["entrega"]["asunto"]
    asuntos = {x["id"]: x["asunto"] for x in pasos_}

    personas: list[dict] = []
    recibieron: dict[str, dict[str, str]] = {}
    proximos: dict[str, int] = {}
    vuelta_de: dict[str, set] = {}
    reservas_de: dict[str, list[str]] = {}
    for f in fichas:
        email = f["email"]
        if email in fuera:
            continue
        r = BF.resumen(f, ahora, desde)
        if not r or not (r["desbloqueo"] or r["ebook"] or r["empezo_ebook"]):
            continue
        sit = situacion_bf(f, r, pagaron)
        suyos = list(r["correos"])
        if r["ebook"]:
            suyos.append({"id": "entrega", "asunto": asuntos["entrega"], "cuando": r["ebook"]["cuando"]})
        suyos.sort(key=lambda c: c["cuando"])
        for c in suyos:
            recibieron.setdefault(c["id"], {}).setdefault(email, c["cuando"])
        prox = r["proximo"]
        if prox:
            proximos[prox["id"]] = proximos.get(prox["id"], 0) + 1
        for v in r["volvio_por"]:
            vuelta_de.setdefault(v["id"], set()).add(email)
        reservas_de[email] = [str(e.get("when") or "") for e in f.get("eventos") or [] if e.get("kind") in BF._RESERVO]
        entradas = [x for x in ((r["desbloqueo"] or {}).get("cuando"), (r["ebook"] or {}).get("cuando"), r["empezo_ebook"]) if x]
        ultimo = suyos[-1] if suyos else None
        personas.append({
            "email": email,
            "nombre": f.get("nombre", ""),
            "via": "desbloqueó y compró" if r["desbloqueo"] and r["ebook"] else "compró" if r["ebook"]
            else "desbloqueó" if r["desbloqueo"] else "abrió el pago",
            "entro": min(entradas) if entradas else "",
            "situacion": sit,
            "etiqueta": "compró el ebook" if sit == "comprador" else E.SITUACIONES[sit],
            "campana": r["campana"],
            "aviso": r["aviso"],
            "recibidos": len(suyos),
            "ultimo": {"id": ultimo["id"], "asunto": ultimo["asunto"], "cuando": ultimo["cuando"]} if ultimo else None,
            "proximo": {"id": prox["id"], "asunto": prox["asunto"], "dia": _dia_nl(prox["cuando"])} if prox else None,
        })
    personas.sort(key=lambda x: x["entro"], reverse=True)

    def despues(email: str, cuando: str) -> tuple[bool, bool]:
        t = _instante(cuando)
        if t is None:
            return False, False
        reservo = any((x := _instante(c)) is not None and x >= t for c in reservas_de.get(email, []))
        pago = (q := _instante(pagos.get(email, ""))) is not None and q >= t
        return reservo, pago

    def cifras(ids: tuple[str, ...], quienes: dict[str, str]) -> dict:
        reservaron = pagaron_tras = 0
        for e, cuando in quienes.items():
            r_, q_ = despues(e, cuando)
            reservaron += r_
            pagaron_tras += q_
        volvieron = set().union(*[vuelta_de.get(i, set()) for i in ids]) if ids else set()
        return {"volvieron": len(volvieron), "reservaron_despues": reservaron, "pagaron_despues": pagaron_tras}

    salida_pasos = []
    for paso in pasos_:
        quienes = recibieron.get(paso["id"], {})
        salida_pasos.append({**paso, "enviados": len(quienes), "esperando": proximos.get(paso["id"], 0),
                             **cifras((paso["id"],), quienes)})

    newsletters = []
    for ident, ids, para in NEWSLETTERS_SYSTEME:
        # De una newsletter no se sabe a quién le llegó: solo quién volvió por
        # su botón (y lo que hizo después, desde que volvió).
        volvieron_cuando: dict[str, str] = {}
        for f in fichas:
            if f["email"] in fuera:
                continue
            for e in f.get("eventos") or []:
                if (e.get("utm_campaign") or "").lower() == "black-friday" and (e.get("utm_content") or "").lower() in ids:
                    w = str(e.get("when") or "")
                    if f["email"] not in volvieron_cuando or w < volvieron_cuando[f["email"]]:
                        volvieron_cuando[f["email"]] = w
        c = cifras(ids, volvieron_cuando)
        newsletters.append({"id": ident, "asunto": BF.NEWSLETTERS[ids[0]], "para": para,
                            "enlace": BF.enlace_systeme(ids[0]), **c})

    def contar(*sits: str) -> int:
        return sum(1 for x in personas if x["situacion"] in sits)

    inicio_hoy = _instante(hoy + "T00:00:00+01:00")
    hace7 = inicio_hoy - timedelta(days=7) if inicio_hoy else None
    todos = [c for q in recibieron.values() for c in q.values()]
    resumen = {
        "entraron": len(personas),
        "desbloquearon": sum(1 for x in personas if "desbloqueó" in x["via"]),
        "compraron": sum(1 for x in personas if "compró" in x["via"]),
        "activos": sum(1 for x in personas if x["proximo"]),
        "terminaron": sum(1 for x in personas if not x["proximo"] and not x["campana"] and x["situacion"] in ("sin-comprar", "comprador")),
        "reservaron": contar("reservo"),
        "pagaron": contar("pago"),
        "bajas": contar("baja"),
        "no_encajan": contar("no-encaja"),
        "enviados": len(todos),
        "enviados_7d": sum(1 for c in todos if hace7 and (t := _instante(c)) is not None and t >= hace7),
        "fallidos_7d": sum(1 for f in envios if not f["ok"] and hace7 and (t := _instante(f["cuando"])) is not None and t >= hace7),
        "por_situacion": {s: contar(s) for s in E.SITUACIONES},
    }

    entrega = cfg["entrega"]["asunto"].strip().lower()
    nombres = {f["email"]: f.get("nombre", "") for f in fichas}
    lista_envios = []
    for f in envios[:ENVIOS_MAX]:
        es_entrega = (f["asunto"] or "").strip().lower() == E.rellenar(entrega, E._valores(cfg, "")).strip().lower()
        lista_envios.append({**f, "campana": "Black Friday" if es_entrega else "", "correo": "entrega" if es_entrega else "",
                             "nombre": nombres.get(f["email"], "")})

    return {
        "campana": {"activa": bool(desde), "venta": bool(cfg.get("activo")), "desde": cfg.get("desde", ""),
                    "hasta": cfg.get("hasta", ""), "hoy": hoy, "fuente": "systeme", "systeme_desde": desde},
        "resumen": resumen,
        "grupos": GRUPOS,
        "pasos": salida_pasos,
        "newsletters": newsletters,
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


async def _fichas_bf(db: AsyncSession, pagaron: set, email: str = "") -> list[dict]:
    """Quien pasó por Black Friday (desbloqueó, abrió el pago, compró o volvió
    desde un correo de la campaña), con TODOS sus eventos, como la ficha de
    Contactos que lee `black_friday.resumen`."""
    from sqlalchemy import or_

    from src.db.contact_event import ContactEvent

    if email:
        filas = (await db.execute(select(ContactEvent).where(ContactEvent.email == email))).scalars().all()
    else:
        de_bf = select(ContactEvent.email).where(
            or_(ContactEvent.kind.in_([E.TIPO_LISTA, E.TIPO_COMPRA, E.TIPO_EMPEZADO]),  # type: ignore[attr-defined]
                ContactEvent.utm_campaign == "black-friday")
        )
        filas = (await db.execute(select(ContactEvent).where(ContactEvent.email.in_(de_bf)))).scalars().all()  # type: ignore[attr-defined]
    por: dict[str, list] = {}
    for f in filas:
        e = (f.email or "").strip().lower()
        if e:
            por.setdefault(e, []).append(f)
    fichas = []
    for e, evs in por.items():
        evs.sort(key=lambda f: f.created_at or "")
        eventos, pasos_, nombre = [], [], ""
        for f in evs:
            try:
                extra = json.loads(f.extra or "{}")
            except (TypeError, ValueError):
                extra = {}
            eventos.append({
                "kind": f.kind, "when": f.created_at or "", "phone": f.phone or "", "recorrido": f.recorrido or "",
                "referrer": getattr(f, "referrer", "") or "", "source": getattr(f, "source", "") or "",
                "utm_source": f.utm_source or "", "utm_medium": f.utm_medium or "", "utm_campaign": f.utm_campaign or "",
                "utm_content": f.utm_content or "", "utm_term": getattr(f, "utm_term", "") or "",
                "extra": extra if isinstance(extra, dict) else {},
            })
            for m in (f.recorrido or "").split(","):
                m = m.strip()
                if m and m not in pasos_:
                    pasos_.append(m)
            completo = f"{f.first_name or ''} {f.last_name or ''}".strip()
            if completo:
                nombre = completo
        fichas.append({"email": e, "nombre": nombre, "eventos": eventos, "pasos": pasos_,
                       "etapa": "alumno" if e in pagaron else ""})
    return fichas


async def panel(org_id: int, db: AsyncSession) -> dict:
    from datetime import datetime, timezone

    from src.services.contactos.contactos import emails_que_pagaron
    from src.services.contactos.metricas import emails_excluidos
    from src.services.panel.tandas import hoy_nl

    cfg = await E.leer(db, org_id)
    if not cfg.get("campana"):
        # Los correos los manda systeme.io (29/10): ver la cabecera.
        pagaron = await emails_que_pagaron(db)
        return armar_panel_systeme(
            cfg=cfg,
            fichas=await _fichas_bf(db, pagaron),
            pagaron=pagaron,
            fuera=await emails_excluidos(db),
            hoy=hoy_nl(),
            ahora=datetime.now(timezone.utc),
            pagos=await _pagos(db),
            envios=await _envios(db),
        )
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
    correos = {x["id"]: x for x in d["pasos"]}
    # Las newsletters de systeme.io: de ellas solo se sabe quién volvió.
    for n in d.get("newsletters") or []:
        correos[n["id"]] = {**n, "cuando": n["para"], "grupo": "", "apagado": False, "lateral": False,
                            "enviados": None, "esperando": 0, "newsletter": True}
    return {
        "correos": correos,
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
        desde = (contenido or "") if fuente in ("email", "systeme") and campana == "black-friday" else ""
        eventos.append({"kind": kind, "cuando": creado or "", "apto": apto, "desde": desde})
    from src.services.panel import black_friday as BF

    por_id = {**BF.ASUNTOS, **{x["id"]: x["asunto"] for x in pasos(cfg)}}
    for ev in eventos:
        if ev["desde"]:
            ev["desde"] = por_id.get(ev["desde"], ev["desde"])
    asuntos = {E.rellenar(x["asunto"], E._valores(cfg, "")).strip().lower(): x["id"] for x in pasos(cfg)}
    if not cfg.get("campana"):
        # Los correos los manda systeme.io: los suyos, calculados con el
        # calendario de sus campañas (los mismos que la ficha y el panel).
        from datetime import datetime, timezone

        fichas = await _fichas_bf(db, pagaron, email=email)
        f = fichas[0] if fichas else {"email": email, "nombre": "", "eventos": [], "pasos": [], "etapa": ""}
        r = BF.resumen(f, datetime.now(timezone.utc), cfg.get("systeme_desde") or "") or {}
        linea = linea_de_tiempo(eventos, await _envios(db, email=email, limite=200), asuntos)
        for c in r.get("correos") or []:
            linea.append({"cuando": c["cuando"], "tipo": "correo", "texto": c["asunto"], "ok": True,
                          "campana": f"systeme.io · {c.get('campana', '')}".strip(" ·"), "correo": c["id"], "calculado": True})
        linea.sort(key=lambda x: x["cuando"] or "", reverse=True)
        sit = situacion_bf(f, r, pagaron) if r else "sin-comprar"
        prox = r.get("proximo")
        return {
            "email": email,
            "nombre": f.get("nombre", ""),
            "situacion": sit,
            "etiqueta": "compró el ebook" if sit == "comprador" else E.SITUACIONES[sit],
            "en_campana": bool(r.get("campana")),
            "campana": r.get("campana", ""),
            "aviso": r.get("aviso", ""),
            "proximo": {"id": prox["id"], "asunto": prox["asunto"], "dia": _dia_nl(prox["cuando"])} if prox else None,
            "linea": linea,
        }
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

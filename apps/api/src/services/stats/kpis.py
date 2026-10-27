"""
Los KPIs de ventas, en Estadísticas → KPIs (20/10/2026).

Pedido del usuario: "cuánto % de llamadas se cierra, cuántas entran al día,
qué porcentaje no se presenta, qué porcentaje ve el anuncio y de ahí cuántos
dejan su mail y datos y cuántos no, cuántos ven el vídeo y continúan y
cuántos en el vídeo se van".

Tres bloques, cada uno con su unidad (no se mezclan):

1. **Embudo de la web** (sesiones anónimas, `embudo_visitas.py`): entran en
   la página → dejan sus datos → play → mitad → vídeo entero → formulario →
   preguntas → reservan. Por embudo y por canal (anuncio de pago u orgánico).
2. **Embudo de ventas** (personas que ENTRARON en el periodo): entran →
   (si vinieron por el proceso de admisión) vídeo entero → terminan las
   preguntas → encajan → reservan llamada → se presentan → pagan. Es una
   cohorte: cada % es sobre la misma gente, así que no se descuadra.
3. **Llamadas con fecha en el periodo**: las de Calendly (si está
   conectado) con su «¿Qué pasó?»: presentadas, no vinieron, sin apuntar,
   futuras, canceladas; % de asistencia, % de no-show y % de cierre (de las
   personas que se presentaron, cuántas han pagado ya).
   Sin Calendly, solo las que tienen «¿Qué pasó?» apuntado.

Más las ventas cobradas en el periodo y una serie por día para la gráfica.
Quien está fuera de los números (`metric_exclusion`) no cuenta en nada.

`calcular` es pura (con test, `test_kpis.py`); `kpis` reúne los datos.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("Europe/Amsterdam")

#: Se presentó a la llamada (los resultados de «¿Qué pasó?» menos «No vino»).
VINO = {"pagado", "compra", "piensa", "no-encaja"}
#: Desde cuándo se apunta si la persona confirmó su llamada (`confirmar_llamada.py`).
CONFIRMAR_DESDE = "2026-10-27"
_RESERVA = {"reunion", "llamada-equipo"}
_ENTRA_TAMBIEN = {"enlace-pago"}


def _instante(texto: str) -> Optional[datetime]:
    if not texto:
        return None
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def dia_nl(texto: str) -> str:
    d = _instante(texto)
    return d.astimezone(ZONA).strftime("%Y-%m-%d") if d else ""


def _pct(parte: int, total: int) -> Optional[float]:
    return round(parte * 100 / total, 1) if total else None


def cuando_entro(ficha: dict) -> str:
    """Su primera matrícula (pidió plaza, dejó sus datos en la admisión,
    llegó al pago…) o el primer enlace de pago que le creó el equipo. Vacío si
    solo bajó una guía: esos no son entradas de ventas."""
    candidatos = [ficha.get("matricula_at") or ""]
    for e in ficha.get("eventos") or []:
        if e.get("kind") in _ENTRA_TAMBIEN:
            candidatos.append(e.get("when") or "")
            break
    fechas = [c for c in candidatos if _instante(c)]
    return min(fechas, key=lambda c: _instante(c)) if fechas else ""


def _llamadas(
    citas: Optional[list[dict]],
    resultados: list[dict],
    eventos_equipo: list[dict],
    pagaron: set[str],
    fuera: set[str],
    desde: str,
    hasta: str,
    ahora: datetime,
    confirmadas: Optional[set[str]] = None,
) -> dict:
    """Las llamadas con fecha en el periodo, una por cita, con su estado.
    `confirmadas`: los ids de las citas que la persona confirmó antes
    (`confirmar_llamada.py`), para comparar el no-show con y sin confirmar."""
    confirmadas = confirmadas or set()
    por_cita = {r["cita_id"]: r for r in resultados if r.get("cita_id")}
    lista: list[dict] = []
    vistas: set[str] = set()

    def entra(email: str, inicio: str) -> bool:
        return bool(email) and email not in fuera and desde <= dia_nl(inicio) <= hasta

    for c in citas or []:
        email = (c.get("email") or "").strip().lower()
        cid = c.get("id") or ""
        res = por_cita.get(cid)
        if (res or {}).get("resultado") == "quitada" or not entra(email, c.get("inicio") or ""):
            continue
        vistas.add(cid)
        lista.append({"email": email, "inicio": c.get("inicio") or "", "cancelada": c.get("estado") == "cancelada",
                      "resultado": (res or {}).get("resultado", ""), "confirmada": cid in confirmadas})
    # Lo apuntado en «¿Qué pasó?» que Calendly ya no devuelve (más de 45 días)
    # o sin Calendly conectado.
    for r in resultados:
        cid = r.get("cita_id") or ""
        email = (r.get("email") or "").strip().lower()
        if cid in vistas or r.get("resultado") == "quitada" or not entra(email, r.get("inicio") or ""):
            continue
        vistas.add(cid)
        lista.append({"email": email, "inicio": r.get("inicio") or "", "cancelada": False, "resultado": r.get("resultado") or "",
                      "confirmada": cid in confirmadas})
    # Sin Calendly: las que agendó el equipo desde la escuela (llevan la hora).
    if citas is None:
        for e in eventos_equipo:
            email = (e.get("email") or "").strip().lower()
            inicio = (e.get("extra") or {}).get("inicio") or ""
            clave = f"equipo:{email}:{inicio}"
            if clave in vistas or not entra(email, inicio):
                continue
            if any(x["email"] == email and dia_nl(x["inicio"]) == dia_nl(inicio) for x in lista):
                continue
            vistas.add(clave)
            lista.append({"email": email, "inicio": inicio, "cancelada": False, "resultado": ""})

    cuentas = {"agendadas": 0, "canceladas": 0, "futuras": 0, "hechas": 0, "presentadas": 0, "no_vino": 0,
               "sin_apuntar": 0, "pagadas_sin_apuntar": 0}
    resultados_n = {k: 0 for k in ("pagado", "compra", "piensa", "no-encaja", "no-vino")}
    presentados: set[str] = set()
    for x in lista:
        x["dia"] = dia_nl(x["inicio"])
        if x["cancelada"]:
            cuentas["canceladas"] += 1
            x["estado"] = "cancelada"
            continue
        cuentas["agendadas"] += 1
        res = x["resultado"]
        momento = _instante(x["inicio"])
        if res in resultados_n:
            resultados_n[res] += 1
        if res in VINO:
            cuentas["presentadas"] += 1
            presentados.add(x["email"])
            x["estado"] = "presentada"
        elif res == "no-vino":
            cuentas["no_vino"] += 1
            x["estado"] = "no-vino"
        elif x["email"] in pagaron:
            # Sin «¿Qué pasó?», pero pagó: se presentó (y cerró).
            cuentas["presentadas"] += 1
            cuentas["pagadas_sin_apuntar"] += 1
            presentados.add(x["email"])
            x["estado"] = "presentada"
        elif momento and momento > ahora:
            cuentas["futuras"] += 1
            x["estado"] = "futura"
        else:
            cuentas["sin_apuntar"] += 1
            x["estado"] = "sin-apuntar"
        if momento and momento <= ahora:
            cuentas["hechas"] += 1

    # ¿Sirve confirmar? (27/10): el no-show de las llamadas que la persona
    # confirmó antes contra el de las que no. Solo desde el día en que se
    # empezó a apuntar: antes no se podía confirmar ninguna.
    def _no_show(sel: list[dict]) -> dict:
        nv = sum(1 for x in sel if x["estado"] == "no-vino")
        return {"con_resultado": len(sel), "no_vino": nv, "pct_no_show": _pct(nv, len(sel))}

    comparables = [x for x in lista if x["dia"] >= CONFIRMAR_DESDE and x.get("estado") in ("presentada", "no-vino")]
    confirmacion = {
        "desde": CONFIRMAR_DESDE,
        "confirmadas": sum(1 for x in lista if x.get("estado") != "cancelada" and x.get("confirmada")),
        "si": _no_show([x for x in comparables if x.get("confirmada")]),
        "no": _no_show([x for x in comparables if not x.get("confirmada")]),
    }

    cerradas = {e for e in presentados if e in pagaron}
    van_a_pagar = {x["email"] for x in lista if x.get("resultado") == "compra" and x["email"] not in pagaron}
    con_resultado = cuentas["presentadas"] + cuentas["no_vino"]
    return {
        **cuentas,
        "resultados": resultados_n,
        "personas_presentadas": len(presentados),
        "personas_cerradas": len(cerradas),
        "van_a_pagar_sin_pagar": len(van_a_pagar),
        "pct_asistencia": _pct(cuentas["presentadas"], con_resultado),
        "pct_no_show": _pct(cuentas["no_vino"], con_resultado),
        "pct_cierre": _pct(len(cerradas), len(presentados)),
        "confirmacion": confirmacion,
        "lista": lista,
    }


def _embudo_ventas(entradas: list[dict], citas_por_email: dict[str, list], presentados: set[str], pagaron: set[str]) -> dict:
    """La cohorte de quien entró en el periodo, paso a paso."""
    from src.services.panel.cliente import proceso_admision

    n = len(entradas)
    admision = video = preguntas = encajan = reservan = presentan = pagan = 0
    for f in entradas:
        eventos = f.get("eventos") or []
        proceso = proceso_admision(eventos) or {}
        if proceso.get("embudo") == "admision":
            admision += 1
            if proceso.get("video") == "visto":
                video += 1
        if proceso.get("terminado"):
            preguntas += 1
            if proceso.get("apto"):
                encajan += 1
        email = f["email"]
        # Quien se presentó a una llamada la reservó, aunque la reserva no
        # conste (hecha en Calendly a mano, o de hace más de 45 días).
        if any(e.get("kind") in _RESERVA for e in eventos) or citas_por_email.get(email) or email in presentados:
            reservan += 1
        if email in presentados:
            presentan += 1
        if email in pagaron:
            pagan += 1
    pasos = [
        ("entran", "Entran (dejan sus datos o llegan al pago)", n, None),
        ("admision", "Por el proceso de admisión (vídeo)", admision, n),
        ("video", "Ven el vídeo entero", video, admision),
        ("preguntas", "Terminan las preguntas", preguntas, n),
        ("encajan", "Encajan", encajan, preguntas),
        ("reservan", "Reservan llamada", reservan, n),
        ("presentan", "Se presentan a la llamada", presentan, reservan),
        ("pagan", "Pagan", pagan, n),
    ]
    return {
        "pasos": [
            {"clave": c, "nombre": nombre, "n": v, "sobre": base, "pct": _pct(v, base) if base is not None else None}
            for c, nombre, v, base in pasos
        ]
    }


def calcular(
    *,
    fichas: list[dict],
    citas: Optional[list[dict]],
    resultados: list[dict],
    pagaron: set[str],
    fuera: set[str],
    visitas: list,
    ventas: list[dict],
    plazos_emails: set[str],
    desde: str,
    hasta: str,
    ahora: datetime,
) -> dict:
    from src.services.contactos.embudo_visitas import resumen as resumen_visitas, visitas_por_dia
    from src.services.panel.pipeline import canal_de

    fichas = [f for f in fichas if f["email"] not in fuera]

    # ── entradas ──
    entradas = []
    for f in fichas:
        dia = dia_nl(cuando_entro(f))
        if dia and desde <= dia <= hasta:
            entradas.append({**f, "_dia": dia, "_canal": canal_de(f).get("canal", "organico")})

    eventos_equipo = [e for f in fichas for e in f.get("eventos") or [] if e.get("kind") == "llamada-equipo"]
    from src.services.contactos.confirmar_llamada import ids_confirmadas

    llamadas = _llamadas(citas, resultados, eventos_equipo, pagaron, fuera, desde, hasta, ahora, ids_confirmadas(fichas))
    presentados = {x["email"] for x in llamadas["lista"] if x.get("estado") == "presentada"}

    citas_por_email: dict[str, list] = {}
    for c in citas or []:
        if c.get("estado") != "cancelada":
            citas_por_email.setdefault((c.get("email") or "").lower(), []).append(c)
    # Para la cohorte cuenta cualquier llamada a la que se presentaron, sea del
    # periodo o de después.
    for r in resultados:
        if r.get("resultado") in VINO:
            presentados.add((r.get("email") or "").strip().lower())

    # ── reservas hechas cada día (cuándo reservaron, no para cuándo) ──
    reservas_dia: dict[str, int] = {}
    vistas: set[str] = set()
    for c in citas or []:
        email = (c.get("email") or "").lower()
        dia = dia_nl(c.get("reservada") or "")
        if email in fuera or not (desde <= dia <= hasta) or c.get("reprogramada"):
            continue
        vistas.add(f"{email}:{dia}")
        reservas_dia[dia] = reservas_dia.get(dia, 0) + 1
    for f in fichas:
        for e in f.get("eventos") or []:
            if e.get("kind") not in _RESERVA:
                continue
            dia = dia_nl(e.get("when") or "")
            clave = f"{f['email']}:{dia}"
            if desde <= dia <= hasta and clave not in vistas:
                vistas.add(clave)
                reservas_dia[dia] = reservas_dia.get(dia, 0) + 1

    # ── ventas cobradas en el periodo ──
    propias = [v for v in ventas if v["email"] not in fuera and desde <= dia_nl(v["paid_at"]) <= hasta]
    con_llamada_emails = {x["email"] for x in llamadas["lista"]} | set(citas_por_email) | {
        (r.get("email") or "").lower() for r in resultados
    }
    tipos = {"unico": 0, "plazos": 0, "otro": 0}
    for v in propias:
        if v["email"] in plazos_emails:
            tipos["plazos"] += 1
        elif v.get("recorrido") == "reserva":
            tipos["otro"] += 1
        else:
            tipos["unico"] += 1
    ingresos = sum(int(v.get("amount_cents") or 0) for v in propias)
    ventas_bloque = {
        "n": len(propias),
        "cobrado_cents": ingresos,
        "ticket_medio_cents": round(ingresos / len(propias)) if propias else None,
        "con_llamada": sum(1 for v in propias if v["email"] in con_llamada_emails),
        "tipos": tipos,
    }

    # ── por día ──
    dias: list[str] = []
    d = date.fromisoformat(desde)
    while d.isoformat() <= hasta:
        dias.append(d.isoformat())
        d += timedelta(days=1)
    visitas_dia = visitas_por_dia(visitas)
    serie = []
    for dia in dias:
        llam = [x for x in llamadas["lista"] if x.get("dia") == dia and x.get("estado") != "cancelada"]
        serie.append(
            {
                "dia": dia,
                "visitas": visitas_dia.get(dia, {}).get("visitas", 0),
                "datos": visitas_dia.get(dia, {}).get("datos", 0),
                "entradas": sum(1 for f in entradas if f["_dia"] == dia),
                "entradas_ads": sum(1 for f in entradas if f["_dia"] == dia and f["_canal"] == "ads"),
                "reservas": reservas_dia.get(dia, 0),
                "llamadas": len(llam),
                "presentadas": sum(1 for x in llam if x["estado"] == "presentada"),
                "no_vino": sum(1 for x in llam if x["estado"] == "no-vino"),
                "ventas": sum(1 for v in propias if dia_nl(v["paid_at"]) == dia),
            }
        )

    n_dias = len(dias) or 1
    n_entradas = len(entradas)
    return {
        "desde": desde,
        "hasta": hasta,
        "dias": n_dias,
        "entradas": {
            "n": n_entradas,
            "ads": sum(1 for f in entradas if f["_canal"] == "ads"),
            "organico": sum(1 for f in entradas if f["_canal"] != "ads"),
            "por_dia": round(n_entradas / n_dias, 1),
        },
        "reservas": {"n": sum(reservas_dia.values()), "por_dia": round(sum(reservas_dia.values()) / n_dias, 1)},
        "embudo_web": resumen_visitas(visitas),
        "embudo_ventas": _embudo_ventas(entradas, citas_por_email, presentados, pagaron),
        "llamadas": {k: v for k, v in llamadas.items() if k != "lista"},
        "ventas": ventas_bloque,
        "serie": serie,
    }


def para_el_closer(datos: dict) -> dict:
    """Los KPIs que ve el closer (25/10/2026, "que el closer vea los KPIs sin
    lo de ventas cobradas"): todo igual, pero de las ventas solo cuántas. Sin
    lo cobrado, el ticket medio ni el reparto por forma de pago. Se quita en el
    servidor, no solo en la pantalla. Función pura."""
    salida = dict(datos)
    salida["ventas"] = {"n": int((datos.get("ventas") or {}).get("n") or 0)}
    salida["para_closer"] = True
    return salida


async def kpis(dias: int, db_session) -> dict:
    from sqlmodel import select

    from src.db.contact_seguimiento import CallOutcome
    from src.db.enrollment import Enrollment
    from src.db.plan_pagos import PlanPagos
    from src.services.contactos.agenda import agenda
    from src.services.contactos.contactos import (
        _emails_con_cuenta,
        _todos_los_eventos,
        emails_que_pagaron,
        fusionar_contactos,
    )
    from src.services.contactos.embudo_visitas import filas_entre
    from src.services.contactos.metricas import emails_excluidos
    from src.services.payments.payments import _desde_cuando

    dias = max(1, min(366, int(dias or 30)))
    hoy = datetime.now(ZONA).date()
    desde = (hoy - timedelta(days=dias - 1)).isoformat()
    hasta = hoy.isoformat()

    fuera = await emails_excluidos(db_session)
    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    pagaron = await emails_que_pagaron(db_session)

    try:
        datos_agenda = await agenda()
    except Exception:  # noqa: BLE001
        datos_agenda = {"configurado": False, "citas": []}
    calendly_ok = bool(datos_agenda.get("configurado")) and not datos_agenda.get("error")
    citas = datos_agenda.get("citas") if calendly_ok else None

    resultados = [
        {"cita_id": r.cita_id, "email": r.email, "resultado": r.resultado, "inicio": r.inicio}
        for r in (await db_session.execute(select(CallOutcome))).scalars().all()
    ]
    corte = _desde_cuando()
    ventas = [
        {"email": (r.email or "").strip().lower(), "paid_at": r.paid_at or "", "amount_cents": r.amount_cents,
         "recorrido": getattr(r, "recorrido", "") or ""}
        for r in (await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))).scalars().all()
        if not corte or (r.paid_at or "")[:10] >= corte
    ]
    plazos_emails = {
        (p.email or "").strip().lower() for p in (await db_session.execute(select(PlanPagos))).scalars().all()
    }
    visitas = await filas_entre(desde, hasta, db_session)

    salida = calcular(
        fichas=fichas, citas=citas, resultados=resultados, pagaron=pagaron, fuera=fuera, visitas=visitas,
        ventas=ventas, plazos_emails=plazos_emails, desde=desde, hasta=hasta, ahora=datetime.now(timezone.utc),
    )
    salida["calendly"] = {
        "conectado": calendly_ok,
        "error": datos_agenda.get("error") or "",
        # La agenda de Calendly llega 45 días atrás: más allá, solo lo apuntado.
        "corto": calendly_ok and dias > 45,
    }
    salida["visitas_desde"] = "2026-10-20"
    return salida

"""
Las cuentas de Visión: funciones puras (reciben números, devuelven números),
con test en `src/tests/services/test_vision.py`. Ni base de datos ni red.

Cómo se calcula cada cifra (decidido con el usuario el 17/10/2026)
------------------------------------------------------------------
- Ventas netas = cobrado − devoluciones − comisión de Klarna.
- Comisión del closer: un % de las ventas netas de las ventas que pasaron por
  llamada. El % va por tramos de fecha (10 % hasta el 15/10/2026 y 15 % desde
  el 16/10/2026), y cada venta usa el del día en que se cobró. Sin comisión
  del director (se quitó).
- Ingreso neto = ventas netas − comisión del closer.
- Coste de la campaña = gasto en anuncios + otros gastos de ESA campaña (la
  clase gratis que hay que pagar al profe, el vídeo UGC…).
- CAC = coste de la campaña ÷ alumnos que trajo.
- ROAS = cobrado ÷ gasto en anuncios.
- Margen de la campaña = ingreso neto − coste de la campaña.
- CAC máximo rentable = lo que deja cada alumno (ingreso neto por alumno): lo
  más que se puede gastar en traer a uno sin perder dinero. Sin ventas aún,
  se estima con el precio de la formación.
- El profe de la clase semanal (75 €/semana) NO va en las campañas: la clase
  existe con campaña o sin ella. Va solo en el total del negocio.

Todo el dinero va en céntimos; los porcentajes, de 0 a 100.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Optional

AJUSTES_POR_DEFECTO: dict = {
    # El precio de la formación al contado (se va subiendo: se cambia aquí).
    "precio_cents": 43500,
    # El plan propio en plazos (ver services/payments/plazos.py: 3 pagos de
    # 165,67 € o 4 de 135 €). Aquí, el de 3.
    "plazos": {"cuotas": 3, "cuota_cents": 16567},
    # Comisión del closer por tramos: cada venta usa el último tramo que ya
    # había empezado el día del cobro. "desde" vacío = desde siempre.
    "closer": [{"desde": "", "pct": 10.0}, {"desde": "2026-10-16", "pct": 15.0}],
    # Lo que se queda Klarna por cada venta: un % y un fijo.
    "klarna_pct": 0.0,
    "klarna_fijo_cents": 0,
    # El profe de la clase semanal, desde cuándo se le paga.
    "profe_semanal_cents": 7500,
    "profe_desde": "",
    # El semáforo. Los de dinero, en euros. Orientativos: se cambian en Ajustes.
    "umbrales": {
        "cac": {"verde": 100, "rojo": 150},
        "coste_lead": {"verde": 10, "rojo": 20},
        "coste_agendada": {"verde": 30, "rojo": 60},
        "cpc": {"verde": 0.5, "rojo": 1.5},
        "ctr": {"verde": 1.5, "rojo": 0.8},
        "asistencia": {"verde": 70, "rojo": 50},
        "cierre": {"verde": 30, "rojo": 15},
        "roas": {"verde": 3, "rojo": 1.5},
        "margen": {"verde": 0, "rojo": 0},
    },
}

# Qué es cada métrica: su nombre, su unidad y si es mejor alta o baja.
# eur = céntimos en el cálculo, euros en los umbrales.
METRICAS: dict[str, dict] = {
    "ctr": {"nombre": "CTR", "unidad": "pct", "mejor": "alto"},
    "cpc": {"nombre": "Coste por clic", "unidad": "eur", "mejor": "bajo"},
    "coste_lead": {"nombre": "Coste por lead", "unidad": "eur", "mejor": "bajo"},
    "coste_agendada": {"nombre": "Coste por llamada agendada", "unidad": "eur", "mejor": "bajo"},
    "asistencia": {"nombre": "Asistencia", "unidad": "pct", "mejor": "alto"},
    "cierre": {"nombre": "Cierre", "unidad": "pct", "mejor": "alto"},
    "cac": {"nombre": "CAC", "unidad": "eur", "mejor": "bajo"},
    "roas": {"nombre": "ROAS", "unidad": "x", "mejor": "alto"},
    "neto_por_alumno": {"nombre": "Neto por alumno", "unidad": "eur", "mejor": None},
    "margen": {"nombre": "Margen", "unidad": "eur", "mejor": "alto"},
    "cac_maximo": {"nombre": "CAC máximo rentable", "unidad": "eur", "mejor": None},
}

METODOS = ("unico", "klarna", "plazos", "otro")


def _num(v, defecto: float = 0.0) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return defecto
    return n if math.isfinite(n) else defecto


def _fecha_ok(texto) -> str:
    t = str(texto or "").strip()[:10]
    try:
        datetime.strptime(t, "%Y-%m-%d")
    except ValueError:
        return ""
    return t


def normalizar_ajustes(crudo) -> dict:
    """Los ajustes guardados encima de los de fábrica, con los tipos bien.
    Lo que no valga se queda como venía de fábrica."""
    base = AJUSTES_POR_DEFECTO
    c = crudo if isinstance(crudo, dict) else {}
    out: dict = {}
    out["precio_cents"] = max(0, int(_num(c.get("precio_cents"), base["precio_cents"])))
    plazos = c.get("plazos") if isinstance(c.get("plazos"), dict) else {}
    out["plazos"] = {
        "cuotas": max(1, int(_num(plazos.get("cuotas"), base["plazos"]["cuotas"]))),
        "cuota_cents": max(0, int(_num(plazos.get("cuota_cents"), base["plazos"]["cuota_cents"]))),
    }
    tramos = []
    for t in c.get("closer") if isinstance(c.get("closer"), list) else base["closer"]:
        if not isinstance(t, dict):
            continue
        pct = _num(t.get("pct"), -1)
        if 0 <= pct <= 100:
            tramos.append({"desde": _fecha_ok(t.get("desde")), "pct": pct})
    out["closer"] = sorted(tramos, key=lambda t: t["desde"]) if tramos else [dict(t) for t in base["closer"]]
    out["klarna_pct"] = min(100.0, max(0.0, _num(c.get("klarna_pct"), base["klarna_pct"])))
    out["klarna_fijo_cents"] = max(0, int(_num(c.get("klarna_fijo_cents"), base["klarna_fijo_cents"])))
    out["profe_semanal_cents"] = max(0, int(_num(c.get("profe_semanal_cents"), base["profe_semanal_cents"])))
    out["profe_desde"] = _fecha_ok(c.get("profe_desde"))
    umbrales = {}
    guardados = c.get("umbrales") if isinstance(c.get("umbrales"), dict) else {}
    for clave, defecto in base["umbrales"].items():
        u = guardados.get(clave) if isinstance(guardados.get(clave), dict) else {}
        umbrales[clave] = {"verde": _num(u.get("verde"), defecto["verde"]), "rojo": _num(u.get("rojo"), defecto["rojo"])}
    out["umbrales"] = umbrales
    return out


def pct_closer(fecha: str, tramos: list[dict]) -> float:
    """El % del closer el día `fecha`: el último tramo que ya había empezado."""
    dia = (fecha or "")[:10]
    pct = 0.0
    for t in sorted(tramos or [], key=lambda t: t.get("desde") or ""):
        desde = t.get("desde") or ""
        if not desde or (dia and desde <= dia):
            pct = _num(t.get("pct"))
    return pct


def comision_klarna(importe_cents: int, ajustes: dict) -> int:
    return round(int(importe_cents) * _num(ajustes.get("klarna_pct")) / 100) + int(ajustes.get("klarna_fijo_cents") or 0)


def _div(a, b) -> Optional[float]:
    return a / b if b else None


def _pct(a, b) -> Optional[float]:
    return round(a * 100 / b, 1) if b else None


def _cents(v: Optional[float]) -> Optional[int]:
    return round(v) if v is not None else None


def dinero_de_ventas(ventas: list[dict], devoluciones_cents: int, ajustes: dict) -> dict:
    """Cobrado, Klarna, ventas netas, closer e ingreso neto de una lista de
    ventas {importe_cents, metodo, fecha, con_llamada}. Las devoluciones se
    reparten entre las ventas en proporción a lo cobrado."""
    cobrado = sum(int(v.get("importe_cents") or 0) for v in ventas)
    devol = max(0, int(devoluciones_cents or 0))
    queda = max(0.0, 1 - devol / cobrado) if cobrado else 0.0
    klarna = 0
    closer = 0.0
    for v in ventas:
        importe = int(v.get("importe_cents") or 0)
        fee = comision_klarna(importe, ajustes) if v.get("metodo") == "klarna" else 0
        klarna += fee
        if v.get("con_llamada", True):
            closer += max(0, importe * queda - fee) * pct_closer(v.get("fecha") or "", ajustes.get("closer") or []) / 100
    netas = cobrado - devol - klarna
    closer_cents = round(closer)
    return {
        "ingresos_cents": cobrado,
        "devoluciones_cents": devol,
        "klarna_cents": klarna,
        "ventas_netas_cents": netas,
        "closer_cents": closer_cents,
        "ingreso_neto_cents": netas - closer_cents,
    }


def calcular_campana(entrada: dict, ajustes: dict, hoy: Optional[str] = None) -> dict:
    """Todas las cifras de una campaña.

    entrada: gasto_ads_cents, otros_gastos_cents, impresiones, clics, leads,
    agendadas, presentadas, devoluciones_cents y `ventas` (lista de
    {importe_cents, metodo, fecha, con_llamada})."""
    gasto = int(entrada.get("gasto_ads_cents") or 0)
    otros = int(entrada.get("otros_gastos_cents") or 0)
    coste = gasto + otros
    impresiones = int(entrada.get("impresiones") or 0)
    clics = int(entrada.get("clics") or 0)
    leads = int(entrada.get("leads") or 0)
    agendadas = int(entrada.get("agendadas") or 0)
    presentadas = int(entrada.get("presentadas") or 0)
    ventas = list(entrada.get("ventas") or [])
    n = len(ventas)
    dinero = dinero_de_ventas(ventas, int(entrada.get("devoluciones_cents") or 0), ajustes)

    neto_por_alumno = _cents(_div(dinero["ingreso_neto_cents"], n))
    if neto_por_alumno is not None:
        cac_maximo = neto_por_alumno
    else:
        # Sin ventas: lo que dejaría una venta al precio de hoy por llamada.
        precio = int(ajustes.get("precio_cents") or 0)
        cac_maximo = round(precio * (1 - pct_closer(hoy or date.today().isoformat(), ajustes.get("closer") or []) / 100))

    return {
        "gasto_ads_cents": gasto,
        "otros_gastos_cents": otros,
        "coste_cents": coste,
        "impresiones": impresiones,
        "clics": clics,
        "leads": leads,
        "agendadas": agendadas,
        "presentadas": presentadas,
        "ventas": n,
        **dinero,
        "ctr": _pct(clics, impresiones),
        "cpc": _cents(_div(gasto, clics)) if gasto else None,
        "coste_lead": _cents(_div(gasto, leads)) if gasto else None,
        "coste_agendada": _cents(_div(gasto, agendadas)) if gasto else None,
        "paso_agendar": _pct(agendadas, leads),
        "asistencia": _pct(presentadas, agendadas),
        "cierre": _pct(n, presentadas),
        "cac": _cents(_div(coste, n)) if coste else None,
        "roas": round(dinero["ingresos_cents"] / gasto, 2) if gasto else None,
        "neto_por_alumno": neto_por_alumno,
        "margen": dinero["ingreso_neto_cents"] - coste,
        "cac_maximo": cac_maximo,
    }


def semaforo(clave: str, valor, umbrales: dict) -> Optional[str]:
    """verde · ambar · rojo, o None si esa cifra no lleva semáforo o no hay dato."""
    meta = METRICAS.get(clave)
    u = (umbrales or {}).get(clave)
    if valor is None or not meta or not meta.get("mejor") or not u:
        return None
    v = valor / 100 if meta["unidad"] == "eur" else valor
    verde, rojo = _num(u.get("verde")), _num(u.get("rojo"))
    if meta["mejor"] == "bajo":
        if v <= verde:
            return "verde"
        return "rojo" if v > rojo else "ambar"
    if v >= verde:
        return "verde"
    return "rojo" if v < rojo else "ambar"


def semaforos(cifras: dict, ajustes: dict) -> dict:
    return {c: semaforo(c, cifras.get(c), ajustes.get("umbrales") or {}) for c in METRICAS}


def lunes(fecha: str) -> str:
    """El lunes de la semana de `fecha` ("AAAA-MM-DD…"). "" si no es fecha."""
    dia = _fecha_ok(fecha)
    if not dia:
        return ""
    d = datetime.strptime(dia, "%Y-%m-%d").date()
    return (d - timedelta(days=d.weekday())).isoformat()


def semanas_entre(desde: str, hasta: str) -> int:
    """Semanas empezadas entre dos días (la primera cuenta entera)."""
    a, b = _fecha_ok(desde), _fecha_ok(hasta)
    if not a or not b or b < a:
        return 0
    dias = (datetime.strptime(b, "%Y-%m-%d") - datetime.strptime(a, "%Y-%m-%d")).days
    return dias // 7 + 1


def total_negocio(
    ventas: list[dict],
    devoluciones_cents: int,
    gastos_cents: int,
    ajustes: dict,
    hoy: str,
    desde: str = "",
) -> dict:
    """El negocio entero: lo cobrado y lo que se queda después de devoluciones,
    Klarna, closer, el profe de la clase semanal y los gastos (los de la
    pantalla Gastos, que ya traen los anuncios y los gastos de las campañas)."""
    dinero = dinero_de_ventas(ventas, devoluciones_cents, ajustes)
    inicio_profe = ajustes.get("profe_desde") or desde
    semanas = semanas_entre(inicio_profe, hoy) if inicio_profe else 0
    profe = semanas * int(ajustes.get("profe_semanal_cents") or 0)
    gastos = int(gastos_cents or 0)
    resultado = dinero["ingreso_neto_cents"] - profe - gastos
    n = len(ventas)
    return {
        **dinero,
        "ventas": n,
        "profe_semanas": semanas,
        "profe_desde": inicio_profe,
        "profe_cents": profe,
        "gastos_cents": gastos,
        "resultado_cents": resultado,
        "margen_pct": _pct(resultado, dinero["ingresos_cents"]),
        "coste_por_alumno_cents": _cents(_div(gastos + profe, n)),
    }

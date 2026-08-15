"""
Agrupar ventas por mes y por trimestre — lógica pura, sin base de datos.

Se aparta del resto para poder probarla: las fechas llegan como texto ISO desde
varios sitios (Stripe, nuestras filas antiguas) y aquí es donde se decide en
qué casilla cae cada venta.
"""

from __future__ import annotations

from typing import Iterable, Optional


MONTH_NAMES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def month_key(iso_date: str) -> Optional[str]:
    """'2026-09-17T10:00:00+00:00' → '2026-09'. None si no hay fecha usable."""
    if not iso_date or not isinstance(iso_date, str):
        return None
    text = iso_date.strip()
    if len(text) < 7:
        return None
    year, sep, rest = text[:4], text[4:5], text[5:7]
    if sep != "-" or not year.isdigit() or not rest.isdigit():
        return None
    month = int(rest)
    if month < 1 or month > 12:
        return None
    return f"{year}-{rest}"


def quarter_key(iso_date: str) -> Optional[str]:
    """'2026-09-17' → '2026-T3'."""
    mk = month_key(iso_date)
    if not mk:
        return None
    year, month = mk.split("-")
    return f"{year}-T{(int(month) - 1) // 3 + 1}"


def month_label(key: str) -> str:
    """'2026-09' → 'septiembre 2026'."""
    try:
        year, month = key.split("-")
        return f"{MONTH_NAMES[int(month) - 1]} {year}"
    except Exception:
        return key


def quarter_label(key: str) -> str:
    """'2026-T3' → 'T3 2026' (jul-sep)."""
    try:
        year, q = key.split("-T")
        spans = {"1": "ene-mar", "2": "abr-jun", "3": "jul-sep", "4": "oct-dic"}
        return f"T{q} {year} ({spans.get(q, '')})"
    except Exception:
        return key


def group_sales(
    sales: Iterable[dict],
    granularity: str = "month",
) -> list[dict]:
    """Agrupa ventas en filas ordenadas de más reciente a más antigua.

    Cada venta es {'date': iso, 'amount_cents': int, 'product': str}.
    Las que no traen fecha utilizable se quedan fuera y se cuentan aparte
    (mejor eso que inventarles un mes y descuadrar la tabla).
    """
    keyer = quarter_key if granularity == "quarter" else month_key
    labeler = quarter_label if granularity == "quarter" else month_label

    buckets: dict[str, dict] = {}
    for sale in sales:
        key = keyer(sale.get("date") or "")
        if not key:
            continue
        bucket = buckets.setdefault(
            key,
            {"key": key, "label": labeler(key), "sales": 0, "revenue_cents": 0, "by_product": {}},
        )
        amount = int(sale.get("amount_cents") or 0)
        product = sale.get("product") or "sin-producto"
        bucket["sales"] += 1
        bucket["revenue_cents"] += amount
        entry = bucket["by_product"].setdefault(product, {"sales": 0, "revenue_cents": 0})
        entry["sales"] += 1
        entry["revenue_cents"] += amount

    rows = sorted(buckets.values(), key=lambda b: b["key"], reverse=True)
    for row in rows:
        row["avg_ticket_cents"] = round(row["revenue_cents"] / row["sales"]) if row["sales"] else 0
    return rows


def undated_sales(sales: Iterable[dict]) -> int:
    """Ventas sin fecha utilizable — se enseñan aparte para que nadie piense
    que la tabla se ha comido dinero."""
    return sum(1 for s in sales if not month_key(s.get("date") or ""))


def pct(part: int, whole: int) -> float:
    """Porcentaje con un decimal. 0 cuando no hay universo (no 'infinito')."""
    if not whole:
        return 0.0
    return round(part * 100 / whole, 1)

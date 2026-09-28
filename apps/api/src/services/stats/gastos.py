"""
Gastos y lo que dicen: cuánto cuesta cada matrícula, qué margen deja la
cohorte y cuánto cuesta cada alumno al mes.

Cuadro de mando, no contabilidad: ver src/db/school_expense.py. La lógica que
cruza gastos con ventas es pura (`resumen_gastos`, con test); lo de alrededor
solo lee la base de datos.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.enrollment import Enrollment
from src.db.school_expense import SchoolExpense, SchoolRecurringExpense
from src.db.user_organizations import UserOrganization
from src.security.rbac.constants import STUDENT_ROLE_ID
from src.services.stats.periods import month_label

CATEGORIAS = {
    "publicidad": "Publicidad",
    "profes": "Profes",
    "herramientas": "Software y herramientas",
    "servicios": "Gestoría y servicios",
    "otros": "Otros",
}


def _pct(a: int, b: int) -> Optional[int]:
    return round(a * 100 / b) if b else None


def resumen_gastos(
    ventas: list[tuple[str, int]],
    gastos: list[tuple[str, str, int]],
    alumnos: int,
) -> dict:
    """
    ventas: (fecha ISO, céntimos) de cada venta cobrada.
    gastos: (fecha AAAA-MM-DD, categoría, céntimos).
    alumnos: cuántos alumnos hay ahora (para el coste por alumno al mes).

    Devuelve los totales y una fila por mes (el más reciente primero), cada una
    con ingresos, gastos por categoría, margen, coste por matrícula (solo la
    publicidad entre las ventas: es lo que cuesta TRAER a alguien) y coste por
    alumno (todo el gasto del mes entre los alumnos).
    """
    meses: dict[str, dict] = {}

    def mes(clave: str) -> dict:
        return meses.setdefault(
            clave,
            {"ventas": 0, "ingresos_cents": 0, "gastos_cents": 0, "por_categoria": {c: 0 for c in CATEGORIAS}},
        )

    for fecha, cents in ventas:
        if len(fecha) >= 7:
            m = mes(fecha[:7])
            m["ventas"] += 1
            m["ingresos_cents"] += int(cents or 0)
    for fecha, cat, cents in gastos:
        if len(fecha) >= 7:
            m = mes(fecha[:7])
            cat = cat if cat in CATEGORIAS else "otros"
            m["gastos_cents"] += int(cents or 0)
            m["por_categoria"][cat] += int(cents or 0)

    filas = []
    for clave in sorted(meses, reverse=True):
        m = meses[clave]
        publicidad = m["por_categoria"]["publicidad"]
        filas.append(
            {
                "mes": clave,
                "label": month_label(clave),
                **m,
                "margen_cents": m["ingresos_cents"] - m["gastos_cents"],
                "coste_por_matricula_cents": round(publicidad / m["ventas"]) if m["ventas"] and publicidad else None,
                "coste_por_alumno_cents": round(m["gastos_cents"] / alumnos) if alumnos and m["gastos_cents"] else None,
            }
        )

    ingresos = sum(f["ingresos_cents"] for f in filas)
    total_gastos = sum(f["gastos_cents"] for f in filas)
    total_ventas = sum(f["ventas"] for f in filas)
    publicidad_total = sum(f["por_categoria"]["publicidad"] for f in filas)
    por_categoria = {c: sum(f["por_categoria"][c] for f in filas) for c in CATEGORIAS}
    return {
        "total": {
            "ventas": total_ventas,
            "ingresos_cents": ingresos,
            "gastos_cents": total_gastos,
            "margen_cents": ingresos - total_gastos,
            "margen_pct": _pct(ingresos - total_gastos, ingresos),
            "por_categoria": por_categoria,
            "coste_por_matricula_cents": round(publicidad_total / total_ventas) if total_ventas and publicidad_total else None,
        },
        "meses": filas,
        "alumnos": alumnos,
    }


def _siguiente_mes(mes: str) -> str:
    y, m = int(mes[:4]), int(mes[5:7])
    return f"{y + (m == 12)}-{1 if m == 12 else m + 1:02d}"


def expandir_fijos(fijos: list[dict], hasta_mes: str) -> list[tuple[str, str, int]]:
    """Cada gasto fijo, convertido en un gasto por mes: desde su `desde` hasta
    su `hasta` (o hasta `hasta_mes`, el mes actual, si sigue activo). Función
    pura, con test. Devuelve (fecha AAAA-MM-01, categoría, céntimos)."""
    filas: list[tuple[str, str, int]] = []
    for f in fijos:
        desde = (f.get("desde") or "")[:7]
        if len(desde) != 7:
            continue
        fin = (f.get("hasta") or "")[:7] or hasta_mes
        fin = min(fin, hasta_mes)
        mes = desde
        vueltas = 0
        while mes <= fin and vueltas < 240:
            filas.append((f"{mes}-01", f.get("categoria") or "otros", int(f.get("importe_cents") or 0)))
            mes = _siguiente_mes(mes)
            vueltas += 1
    return filas


def fijo_activo(f: dict, mes: str) -> bool:
    desde = (f.get("desde") or "")[:7]
    hasta = (f.get("hasta") or "")[:7]
    return bool(desde) and desde <= mes and (not hasta or hasta >= mes)


async def panel_gastos(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.payments.payments import _desde_cuando

    desde = _desde_cuando()
    pagadas = (
        await db_session.execute(select(Enrollment).where(Enrollment.status == "paid"))
    ).scalars().all()
    from src.services.contactos.metricas import emails_excluidos, ids_excluidos

    fuera = await emails_excluidos(db_session)
    ventas = []
    for r in pagadas:
        if (r.email or "").strip().lower() in fuera:
            continue
        fecha = r.paid_at or r.updated_at or r.created_at or ""
        # Misma fecha de corte que las ventas y las plazas: las pruebas no cuentan.
        if desde and (r.paid_at or "") < desde:
            continue
        ventas.append((fecha, int(r.amount_cents or 0)))

    filas = (
        await db_session.execute(
            select(SchoolExpense).where(SchoolExpense.org_id == org_id).order_by(SchoolExpense.fecha.desc(), SchoolExpense.id.desc())  # type: ignore[attr-defined]
        )
    ).scalars().all()
    fuera_ids = await ids_excluidos(db_session)
    alumnos = len(
        [
            u
            for u in (
                await db_session.execute(
                    select(UserOrganization.user_id).where(
                        UserOrganization.org_id == org_id, UserOrganization.role_id == STUDENT_ROLE_ID
                    )
                )
            ).scalars().all()
            if u not in fuera_ids
        ]
    )

    # Lo que se apuntaba antes en Estadísticas → "Lo que escribes tú" (gasto
    # del mes para captar y coste de entregar). Esa pantalla ya no lo pide:
    # un solo sitio para los gastos. Lo antiguo se enseña aquí y cuenta igual,
    # marcado como tal, para no perder nada de lo ya apuntado.
    from src.db.school_stats import ManualEntry

    antiguos = (
        await db_session.execute(
            select(ManualEntry).where(ManualEntry.org_id == org_id, ManualEntry.kind.in_(("cost", "delivery")))  # type: ignore[attr-defined]
        )
    ).scalars().all()
    lista = [
        {
            "id": g.id,
            "fecha": g.fecha,
            "categoria": g.categoria,
            "concepto": g.concepto,
            "importe_cents": g.importe_cents,
            "nota": g.nota,
            "antiguo_id": None,
            "proveedor": g.proveedor or "",
            "numero": g.numero or "",
            "tiene_archivo": bool(g.archivo),
            "archivo_nombre": g.archivo_nombre or "",
            "fijo_id": g.fijo_id or 0,
        }
        for g in filas
    ] + [
        {
            "id": None,
            "fecha": f"{m.period}-01" if len(m.period) == 7 else m.period,
            "categoria": "publicidad" if m.kind == "cost" else "profes",
            "concepto": (m.label or m.note or ("Gasto del mes para captar" if m.kind == "cost" else "Coste de entregar el curso")),
            "importe_cents": int(round((m.value or 0) * 100)),
            "nota": "Apuntado antes en Estadísticas",
            "antiguo_id": m.id,
        }
        for m in antiguos
        if (m.value or 0) > 0
    ]
    # Lo gastado en anuncios se apunta en Anuncios y cuenta aquí solo, como
    # publicidad del mes en que empezó la campaña: así no se teclea dos veces.
    from src.db.panel_negocio import AdCampaign

    for c in (await db_session.execute(select(AdCampaign).where(AdCampaign.org_id == org_id))).scalars().all():
        if (c.gasto_cents or 0) <= 0:
            continue
        lista.append(
            {
                "id": None,
                "fecha": c.inicio or (c.created_at or "")[:10],
                "categoria": "publicidad",
                "concepto": f"Anuncio: {c.nombre}",
                "importe_cents": int(c.gasto_cents),
                "nota": "Se cambia en Anuncios",
                "antiguo_id": None,
                "anuncio_id": c.id,
            }
        )
    lista.sort(key=lambda g: g["fecha"], reverse=True)

    # Los gastos fijos: uno por mes mientras estén activos. No salen en "Lo
    # apuntado" (sería una fila por mes y por gasto): se ven en su bloque.
    mes_actual = datetime.now(timezone.utc).strftime("%Y-%m")
    fijos = [
        {
            "id": f.id,
            "concepto": f.concepto,
            "categoria": f.categoria,
            "importe_cents": f.importe_cents,
            "desde": f.desde,
            "hasta": f.hasta,
            "nota": f.nota,
        }
        for f in (
            await db_session.execute(
                select(SchoolRecurringExpense).where(SchoolRecurringExpense.org_id == org_id).order_by(SchoolRecurringExpense.id)  # type: ignore[attr-defined]
            )
        ).scalars().all()
    ]
    for f in fijos:
        f["activo"] = fijo_activo(f, mes_actual)

    # La factura de un gasto fijo no suma: el fijo ya cuenta solo cada mes.
    datos = resumen_gastos(
        ventas,
        [(g["fecha"], g["categoria"], g["importe_cents"]) for g in lista if not g.get("fijo_id")] + expandir_fijos(fijos, mes_actual),
        int(alumnos),
    )
    datos["fijos"] = fijos
    datos["fijos_al_mes_cents"] = sum(f["importe_cents"] for f in fijos if f["activo"])
    datos["gastos"] = lista[:500]
    datos["categorias"] = CATEGORIAS
    datos["desde"] = desde
    return datos


async def guardar_gasto(
    org_id: int,
    fecha: str,
    categoria: str,
    concepto: str,
    importe: float,
    nota: str,
    db_session: AsyncSession,
    gasto_id: Optional[int] = None,
    proveedor: str = "",
    numero: str = "",
    fijo_id: int = 0,
) -> Optional[SchoolExpense]:
    if gasto_id is not None:
        g = (
            await db_session.execute(
                select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id)
            )
        ).scalars().first()
        if g is None:
            return None
    else:
        g = SchoolExpense(org_id=org_id, created_at=datetime.now(timezone.utc).isoformat())
    g.fecha = fecha
    g.categoria = categoria if categoria in CATEGORIAS else "otros"
    g.concepto = (concepto or "").strip()[:200]
    g.importe_cents = int(round(float(importe) * 100))
    g.nota = (nota or "").strip()[:500]
    g.proveedor = (proveedor or "").strip()[:200]
    g.numero = (numero or "").strip()[:80]
    g.fijo_id = int(fijo_id or 0)
    db_session.add(g)
    await db_session.commit()
    await db_session.refresh(g)
    return g


async def borrar_gasto(org_id: int, gasto_id: int, db_session: AsyncSession) -> bool:
    g = (
        await db_session.execute(
            select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id)
        )
    ).scalars().first()
    if g is None:
        return False
    borrar_archivo(g.archivo)
    await db_session.delete(g)
    await db_session.commit()
    return True


def _mes_ok(texto: str) -> str:
    texto = (texto or "").strip()[:7]
    try:
        datetime.strptime(texto, "%Y-%m")
        return texto
    except ValueError:
        return ""


async def guardar_fijo(org_id: int, data: dict, db_session: AsyncSession, fijo_id: Optional[int] = None) -> Optional[SchoolRecurringExpense]:
    if fijo_id is not None:
        f = (
            await db_session.execute(
                select(SchoolRecurringExpense).where(SchoolRecurringExpense.id == fijo_id, SchoolRecurringExpense.org_id == org_id)
            )
        ).scalars().first()
        if f is None:
            return None
    else:
        f = SchoolRecurringExpense(org_id=org_id, created_at=datetime.now(timezone.utc).isoformat())
    if "concepto" in data:
        f.concepto = (data.get("concepto") or "").strip()[:200]
    if "categoria" in data:
        f.categoria = data.get("categoria") if data.get("categoria") in CATEGORIAS else "otros"
    if "importe" in data and data.get("importe") is not None:
        f.importe_cents = int(round(float(data["importe"]) * 100))
    if "desde" in data:
        f.desde = _mes_ok(data.get("desde") or "") or f.desde or datetime.now(timezone.utc).strftime("%Y-%m")
    if "hasta" in data:
        f.hasta = _mes_ok(data.get("hasta") or "")
    if "nota" in data:
        f.nota = (data.get("nota") or "").strip()[:500]
    db_session.add(f)
    await db_session.commit()
    await db_session.refresh(f)
    return f


async def borrar_fijo(org_id: int, fijo_id: int, db_session: AsyncSession) -> bool:
    f = (
        await db_session.execute(
            select(SchoolRecurringExpense).where(SchoolRecurringExpense.id == fijo_id, SchoolRecurringExpense.org_id == org_id)
        )
    ).scalars().first()
    if f is None:
        return False
    await db_session.delete(f)
    await db_session.commit()
    return True


# ── El papel de la factura ──────────────────────────────────────────────────
# Se guarda en content/privado/facturas/<org>/ (dentro del volumen, así entra
# en la copia diaria a R2) y NUNCA se sirve por /content: ver local_content.py.

import uuid as _uuid  # noqa: E402
from pathlib import Path  # noqa: E402

CONTENT_DIR = Path("content")
EXTENSIONES_FACTURA = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_FACTURA_BYTES = 15 * 1024 * 1024


def extension_valida(nombre: str) -> str:
    ext = Path(nombre or "").suffix.lower()
    return ext if ext in EXTENSIONES_FACTURA else ""


def ruta_segura(relativa: str) -> Optional[Path]:
    """La ruta en disco de una factura, solo si está dentro de privado/."""
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith("privado/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


def borrar_archivo(relativa: str) -> None:
    ruta = ruta_segura(relativa)
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


async def guardar_archivo(org_id: int, gasto_id: int, nombre: str, datos: bytes, db_session: AsyncSession) -> dict:
    g = (
        await db_session.execute(select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id))
    ).scalars().first()
    if g is None:
        return {"ok": False, "motivo": "No existe ese gasto"}
    ext = extension_valida(nombre)
    if not ext:
        return {"ok": False, "motivo": "Solo PDF o foto (jpg, png, webp, heic)"}
    if not datos:
        return {"ok": False, "motivo": "El archivo está vacío"}
    if len(datos) > MAX_FACTURA_BYTES:
        return {"ok": False, "motivo": "El archivo pasa de 15 MB"}
    relativa = f"privado/facturas/{org_id}/{_uuid.uuid4().hex}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    borrar_archivo(g.archivo)
    g.archivo = relativa
    g.archivo_nombre = Path(nombre).name[:200]
    db_session.add(g)
    await db_session.commit()
    return {"ok": True, "archivo_nombre": g.archivo_nombre}


async def archivo_de(org_id: int, gasto_id: int, db_session: AsyncSession) -> Optional[tuple[Path, str]]:
    g = (
        await db_session.execute(select(SchoolExpense).where(SchoolExpense.id == gasto_id, SchoolExpense.org_id == org_id))
    ).scalars().first()
    if g is None:
        return None
    ruta = ruta_segura(g.archivo)
    if ruta is None or not ruta.is_file():
        return None
    return ruta, g.archivo_nombre or ruta.name

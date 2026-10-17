"""
Las campañas de Visión: datos apuntados a mano, pagos, ajustes y el cuadro
de mando (cada campaña con sus cifras, su embudo y su semana a semana, y el
total del negocio).

De dónde sale cada número de una campaña (`entrada_de_campana`, pura y con
test):
- Gasto en anuncios: lo apuntado en sus Datos. Si no hay nada apuntado y en
  Panel → Anuncios hay una campaña con el mismo utm, el gasto de esa.
- Impresiones, clics, otros gastos y devoluciones: lo apuntado.
- Leads, agendadas y presentadas: lo apuntado si se ha apuntado ALGO de ese
  campo; si no, lo que sabe la escuela por el utm (`escuela.py`). Lo apuntado
  manda: nunca se suman las dos cosas.
- Ventas: las de la escuela por el utm, más los pagos apuntados a mano (un
  pago con el correo de una venta de la escuela no suma otra venta: le pone
  su método, p. ej. Klarna). Si en Datos se apuntan ventas o ingresos, esos
  mandan sobre todo lo anterior.

Gastos: lo apuntado en Visión sale solo en Panel → Gastos (como lo de
Anuncios), para que el total del negocio salga de un solo sitio. El gasto en
anuncios de una campaña que también está en Anuncios con gasto NO se repite:
cuenta el de Anuncios (y la campaña avisa).
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.vision import VisionDato, VisionMapa, VisionNodo, VisionPago
from src.services.vision import calculo as C

CLAVE_AJUSTES = "vision_ajustes"
_POR_ESCUELA = ("leads", "agendadas", "presentadas")


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fecha(texto) -> str:
    t = str(texto or "").strip()[:10]
    try:
        datetime.strptime(t, "%Y-%m-%d")
    except ValueError:
        return ""
    return t


def _clave(t: str) -> str:
    return (t or "").strip().lower()


# ── ajustes ─────────────────────────────────────────────────────────────────


async def leer_ajustes(org_id: int, db: AsyncSession) -> dict:
    from src.db.organization_config import OrganizationConfig

    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    crudo = fila.config.get(CLAVE_AJUSTES) if fila and isinstance(fila.config, dict) else None
    return C.normalizar_ajustes(crudo)


async def guardar_ajustes(org_id: int, datos: dict, db: AsyncSession) -> dict:
    from src.db.organization_config import OrganizationConfig

    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    if fila is None:
        return {"ok": False, "motivo": "La escuela no tiene configuración"}
    limpios = C.normalizar_ajustes(datos)
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE_AJUSTES] = limpios
    fila.config = config
    fila.update_date = str(datetime.now())
    db.add(fila)
    await db.commit()
    return {"ok": True, "ajustes": limpios}


# ── datos y pagos apuntados a mano ──────────────────────────────────────────


def dato_dict(d: VisionDato) -> dict:
    return {
        "id": d.id,
        "nodo_id": d.nodo_id,
        "fecha": d.fecha,
        "periodo": d.periodo,
        "gasto_cents": d.gasto_cents,
        "impresiones": d.impresiones,
        "clics": d.clics,
        "leads": d.leads,
        "agendadas": d.agendadas,
        "presentadas": d.presentadas,
        "ventas": d.ventas,
        "ingresos_cents": d.ingresos_cents,
        "devoluciones_cents": d.devoluciones_cents,
        "otros_gastos_cents": d.otros_gastos_cents,
        "otros_concepto": d.otros_concepto,
        "otros_categoria": d.otros_categoria,
        "nota": d.nota,
    }


def pago_dict(p: VisionPago) -> dict:
    return {
        "id": p.id,
        "nodo_id": p.nodo_id,
        "alumno": p.alumno,
        "email": p.email,
        "importe_cents": p.importe_cents,
        "metodo": p.metodo,
        "fecha": p.fecha,
        "con_llamada": p.con_llamada,
        "nota": p.nota,
    }


def _entero(v, minimo: int = 0) -> int:
    try:
        return max(minimo, int(round(float(v))))
    except (TypeError, ValueError):
        return minimo


def _opcional(v) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return max(0, int(round(float(v))))
    except (TypeError, ValueError):
        return None


async def _campana(org_id: int, nodo_id: int, db: AsyncSession) -> Optional[VisionNodo]:
    n = (await db.execute(select(VisionNodo).where(VisionNodo.id == nodo_id, VisionNodo.org_id == org_id))).scalars().first()
    return n if n is not None and n.tipo == "campana" else None


async def guardar_dato(org_id: int, nodo_id: int, datos: dict, db: AsyncSession, dato_id: Optional[int] = None) -> dict:
    from src.services.stats.gastos import CATEGORIAS

    if await _campana(org_id, nodo_id, db) is None:
        return {"ok": False, "motivo": "Esa tarjeta no es una campaña"}
    fecha = _fecha(datos.get("fecha"))
    if not fecha:
        return {"ok": False, "motivo": "Falta el día (o el lunes de la semana)"}
    if dato_id:
        d = (await db.execute(select(VisionDato).where(VisionDato.id == dato_id, VisionDato.org_id == org_id))).scalars().first()
        if d is None:
            return {"ok": False, "motivo": "No existe ese dato"}
    else:
        d = VisionDato(org_id=org_id, nodo_id=nodo_id, created_at=_ahora())
    d.fecha = fecha
    d.periodo = "semana" if datos.get("periodo") == "semana" else "dia"
    if d.periodo == "semana":
        d.fecha = C.lunes(fecha)
    d.gasto_cents = _entero(datos.get("gasto_cents"))
    d.impresiones = _entero(datos.get("impresiones"))
    d.clics = _entero(datos.get("clics"))
    for campo in ("leads", "agendadas", "presentadas", "ventas", "ingresos_cents"):
        setattr(d, campo, _opcional(datos.get(campo)))
    d.devoluciones_cents = _entero(datos.get("devoluciones_cents"))
    d.otros_gastos_cents = _entero(datos.get("otros_gastos_cents"))
    d.otros_concepto = str(datos.get("otros_concepto") or "").strip()[:200]
    cat = datos.get("otros_categoria")
    d.otros_categoria = cat if cat in CATEGORIAS else "otros"
    d.nota = str(datos.get("nota") or "").strip()[:500]
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return {"ok": True, "dato": dato_dict(d)}


async def borrar_dato(org_id: int, dato_id: int, db: AsyncSession) -> bool:
    d = (await db.execute(select(VisionDato).where(VisionDato.id == dato_id, VisionDato.org_id == org_id))).scalars().first()
    if d is None:
        return False
    await db.delete(d)
    await db.commit()
    return True


async def guardar_pago(org_id: int, nodo_id: int, datos: dict, db: AsyncSession, pago_id: Optional[int] = None) -> dict:
    if await _campana(org_id, nodo_id, db) is None:
        return {"ok": False, "motivo": "Esa tarjeta no es una campaña"}
    importe = _entero(datos.get("importe_cents"))
    if importe <= 0:
        return {"ok": False, "motivo": "Pon el importe"}
    fecha = _fecha(datos.get("fecha"))
    if not fecha:
        return {"ok": False, "motivo": "Falta la fecha del pago"}
    if pago_id:
        p = (await db.execute(select(VisionPago).where(VisionPago.id == pago_id, VisionPago.org_id == org_id))).scalars().first()
        if p is None:
            return {"ok": False, "motivo": "No existe ese pago"}
    else:
        p = VisionPago(org_id=org_id, nodo_id=nodo_id, created_at=_ahora())
    p.alumno = str(datos.get("alumno") or "").strip()[:200]
    p.email = _clave(str(datos.get("email") or ""))[:255]
    p.importe_cents = importe
    p.metodo = datos.get("metodo") if datos.get("metodo") in C.METODOS else "unico"
    p.fecha = fecha
    p.con_llamada = bool(datos.get("con_llamada", True))
    p.nota = str(datos.get("nota") or "").strip()[:300]
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"ok": True, "pago": pago_dict(p)}


async def borrar_pago(org_id: int, pago_id: int, db: AsyncSession) -> bool:
    p = (await db.execute(select(VisionPago).where(VisionPago.id == pago_id, VisionPago.org_id == org_id))).scalars().first()
    if p is None:
        return False
    await db.delete(p)
    await db.commit()
    return True


# ── juntar lo apuntado con lo de la escuela (puro) ─────────────────────────


def mezclar_ventas(escuela_ventas: list[dict], pagos: list[dict]) -> list[dict]:
    """Las ventas de la escuela más los pagos apuntados. Un pago con el correo
    de una venta de la escuela no es otra venta: le pone su método y si pasó
    por llamada."""
    por_email = {p["email"]: p for p in pagos if p.get("email")}
    salida = []
    usados = set()
    for v in escuela_ventas:
        p = por_email.get(v.get("email") or "")
        if p:
            usados.add(p["email"])
            salida.append({**v, "metodo": p.get("metodo") or v.get("metodo"), "con_llamada": bool(p.get("con_llamada", True)), "origen": "escuela"})
        else:
            salida.append({**v, "origen": "escuela"})
    for p in pagos:
        if p.get("email") and p["email"] in usados:
            continue
        salida.append(
            {
                "email": p.get("email") or "",
                "importe_cents": int(p.get("importe_cents") or 0),
                "fecha": p.get("fecha") or "",
                "metodo": p.get("metodo") or "unico",
                "con_llamada": bool(p.get("con_llamada", True)),
                "origen": "a-mano",
            }
        )
    return salida


def entrada_de_campana(filas: list[dict], pagos: list[dict], escuela: Optional[dict], gasto_anuncios: Optional[dict]) -> dict:
    """Junta lo apuntado y lo de la escuela en la entrada de `calcular_campana`,
    con la serie semana a semana y de dónde sale cada número.

    gasto_anuncios: {"gasto_cents", "fecha"} de la campaña de Anuncios con el
    mismo utm, o None."""
    fuentes: dict[str, str] = {}
    serie: dict[str, dict] = defaultdict(lambda: defaultdict(int))

    def a_semana(fecha: str, campo: str, valor: int) -> None:
        sem = C.lunes(fecha)
        if sem and valor:
            serie[sem][campo] += valor

    gasto = sum(int(f.get("gasto_cents") or 0) for f in filas)
    if gasto:
        fuentes["gasto_ads"] = "a-mano"
        for f in filas:
            a_semana(f["fecha"], "gasto_ads_cents", int(f.get("gasto_cents") or 0))
    elif gasto_anuncios and int(gasto_anuncios.get("gasto_cents") or 0) > 0:
        gasto = int(gasto_anuncios["gasto_cents"])
        fuentes["gasto_ads"] = "anuncios"
        a_semana(gasto_anuncios.get("fecha") or "", "gasto_ads_cents", gasto)
    else:
        fuentes["gasto_ads"] = ""

    entrada: dict = {"gasto_ads_cents": gasto}
    for campo in ("impresiones", "clics", "otros_gastos_cents", "devoluciones_cents"):
        entrada[campo] = sum(int(f.get(campo) or 0) for f in filas)
        for f in filas:
            a_semana(f["fecha"], campo, int(f.get(campo) or 0))
        fuentes[campo] = "a-mano" if entrada[campo] else ""

    for campo in _POR_ESCUELA:
        apuntadas = [f for f in filas if f.get(campo) is not None]
        if apuntadas:
            entrada[campo] = sum(int(f[campo]) for f in apuntadas)
            fuentes[campo] = "a-mano"
            for f in apuntadas:
                a_semana(f["fecha"], campo, int(f[campo]))
        elif escuela is not None:
            lista = escuela.get(campo) or []
            entrada[campo] = len(lista)
            fuentes[campo] = "escuela"
            for x in lista:
                a_semana(x.get("fecha") or "", campo, 1)
        else:
            entrada[campo] = 0
            fuentes[campo] = ""

    a_mano = [f for f in filas if f.get("ventas") is not None or f.get("ingresos_cents") is not None]
    if a_mano:
        ventas = []
        for f in a_mano:
            n = int(f.get("ventas") or 0) or 1
            ingresos = int(f.get("ingresos_cents") or 0)
            for i in range(n):
                # El importe repartido entre las ventas del día (el resto, a la primera).
                parte = ingresos // n + (ingresos % n if i == 0 else 0)
                ventas.append({"email": "", "importe_cents": parte, "fecha": f["fecha"], "metodo": "unico", "con_llamada": True, "origen": "datos"})
        fuentes["ventas"] = "a-mano"
    else:
        ventas = mezclar_ventas((escuela or {}).get("ventas") or [], pagos)
        hay_escuela = any(v["origen"] == "escuela" for v in ventas)
        hay_mano = any(v["origen"] == "a-mano" for v in ventas)
        fuentes["ventas"] = "escuela+a-mano" if hay_escuela and hay_mano else "escuela" if hay_escuela else "a-mano" if hay_mano else ("escuela" if escuela is not None else "")
    for v in ventas:
        a_semana(v.get("fecha") or "", "ventas", 1)
        a_semana(v.get("fecha") or "", "ingresos_cents", int(v.get("importe_cents") or 0))
    entrada["ventas"] = ventas

    semanas = [{"semana": s, **{k: int(v) for k, v in serie[s].items()}} for s in sorted(serie)]
    return {"entrada": entrada, "fuentes": fuentes, "semanas": semanas}


# ── el cuadro de mando ──────────────────────────────────────────────────────


async def _ruta(org_id: int, n: VisionNodo, db: AsyncSession) -> str:
    from src.services.vision.mapa import migas

    m = (await db.execute(select(VisionMapa).where(VisionMapa.id == n.mapa_id))).scalars().first()
    return " › ".join(c["nombre"] for c in await migas(org_id, m, db)) if m else ""


async def _anuncios_por_utm(org_id: int, db: AsyncSession) -> dict[str, dict]:
    from src.db.panel_negocio import AdCampaign

    por: dict[str, dict] = {}
    for c in (await db.execute(select(AdCampaign).where(AdCampaign.org_id == org_id))).scalars().all():
        u = _clave(c.utm_campaign)
        if not u or (c.gasto_cents or 0) <= 0:
            continue
        a = por.setdefault(u, {"gasto_cents": 0, "fecha": c.inicio or (c.created_at or "")[:10], "nombres": []})
        a["gasto_cents"] += int(c.gasto_cents)
        a["fecha"] = min(a["fecha"] or "9999", c.inicio or (c.created_at or "")[:10] or "9999")
        a["nombres"].append(c.nombre)
    return por


async def cuadro_de_mando(org_id: int, db: AsyncSession, solo: Optional[int] = None, negocio: bool = True) -> dict:
    """Todas las campañas (o solo `solo`) con cifras, semáforo, embudo y
    semanas; y, si `negocio`, el total del negocio."""
    from src.services.vision.escuela import de_la_campana, numeros_de_la_escuela

    ajustes = await leer_ajustes(org_id, db)
    hoy = date.today().isoformat()
    escuela = await numeros_de_la_escuela(org_id, db)
    anuncios = await _anuncios_por_utm(org_id, db)

    q = select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.tipo == "campana")
    if solo:
        q = q.where(VisionNodo.id == solo)
    nodos = (await db.execute(q)).scalars().all()
    ids = [n.id for n in nodos]
    datos_por: dict[int, list[dict]] = defaultdict(list)
    pagos_por: dict[int, list[dict]] = defaultdict(list)
    if ids:
        for d in (await db.execute(select(VisionDato).where(VisionDato.org_id == org_id, VisionDato.nodo_id.in_(ids)).order_by(VisionDato.fecha.desc()))).scalars().all():  # type: ignore[attr-defined]
            datos_por[d.nodo_id].append(dato_dict(d))
        for p in (await db.execute(select(VisionPago).where(VisionPago.org_id == org_id, VisionPago.nodo_id.in_(ids)).order_by(VisionPago.fecha.desc()))).scalars().all():  # type: ignore[attr-defined]
            pagos_por[p.nodo_id].append(pago_dict(p))

    campanas = []
    for n in nodos:
        utm = _clave(n.utm_campaign)
        de_anuncios = anuncios.get(utm) if utm else None
        mezcla = entrada_de_campana(datos_por[n.id], pagos_por[n.id], de_la_campana(escuela, utm), de_anuncios)
        cifras = C.calcular_campana(mezcla["entrada"], ajustes, hoy)
        avisos = []
        if de_anuncios and mezcla["fuentes"].get("gasto_ads") == "a-mano":
            avisos.append(
                "Esta campaña tiene gasto apuntado aquí y también en Anuncios: en Gastos y en el total del negocio "
                "cuenta el de Anuncios. Apúntalo en un solo sitio."
            )
        if any(v.get("metodo") == "klarna" for v in mezcla["entrada"]["ventas"]) and not ajustes.get("klarna_pct") and not ajustes.get("klarna_fijo_cents"):
            avisos.append("Hay ventas con Klarna y la comisión de Klarna está a 0: ponla en Ajustes.")
        campanas.append(
            {
                "id": n.id,
                "titulo": n.titulo,
                "estado": n.estado,
                "urgente": bool(n.urgente),
                "importante": bool(n.importante),
                "utm_campaign": n.utm_campaign,
                "mapa_id": n.mapa_id,
                "submapa_id": n.submapa_id,
                "ruta": await _ruta(org_id, n, db),
                "inicio": n.inicio,
                "fin": n.fin,
                "cifras": cifras,
                "semaforo": C.semaforos(cifras, ajustes),
                "fuentes": mezcla["fuentes"],
                "semanas": mezcla["semanas"],
                "ventas_detalle": [
                    {k: v.get(k) for k in ("email", "importe_cents", "fecha", "metodo", "con_llamada", "origen")}
                    for v in mezcla["entrada"]["ventas"]
                ][:200],
                "datos": datos_por[n.id],
                "pagos": pagos_por[n.id],
                "avisos": avisos,
            }
        )
    campanas.sort(key=lambda c: (c["estado"] == "hecho", c["titulo"].lower()))

    salida = {"campanas": campanas, "ajustes": ajustes, "metricas": C.METRICAS, "avisos": escuela.get("avisos") or []}
    if solo or not negocio:
        return salida

    # Semana a semana de todas las campañas juntas.
    juntas: dict[str, dict] = defaultdict(lambda: defaultdict(int))
    for c in campanas:
        for s in c["semanas"]:
            for k, v in s.items():
                if k != "semana":
                    juntas[s["semana"]][k] += v
    salida["semanas"] = [{"semana": s, **dict(juntas[s])} for s in sorted(juntas)]
    salida["negocio"] = await _total_negocio(org_id, db, escuela, pagos_por, datos_por, ajustes, hoy)
    return salida


async def _total_negocio(org_id, db, escuela, pagos_por, datos_por, ajustes, hoy) -> dict:
    from src.services.stats.gastos import panel_gastos

    pagos = [p for lista in pagos_por.values() for p in lista]
    ventas = mezclar_ventas(escuela.get("ventas") or [], pagos)
    devoluciones = sum(int(d.get("devoluciones_cents") or 0) for lista in datos_por.values() for d in lista)
    try:
        g = await panel_gastos(org_id, db)
        total = g.get("total") or {}
        gastos = int(total.get("gastos_cents") or 0)
        por_categoria = total.get("por_categoria") or {}
    except Exception:  # noqa: BLE001
        await db.rollback()
        gastos, por_categoria = 0, {}
    t = C.total_negocio(ventas, devoluciones, gastos, ajustes, hoy, escuela.get("desde") or "")
    t["gastos_por_categoria"] = por_categoria
    t["avisos"] = []
    if int(por_categoria.get("profes") or 0) > 0 and t["profe_cents"]:
        t["avisos"].append(
            "En Gastos hay gastos de profes y aquí también se cuentan las clases semanales: si son lo mismo, "
            "pon a 0 el coste semanal del profe en Ajustes."
        )
    return t


# ── lo de Visión en Panel → Gastos ──────────────────────────────────────────


async def gastos_para_el_panel(org_id: int, db: AsyncSession) -> list[dict]:
    """Los gastos apuntados en las campañas de Visión, como filas de Gastos.
    El gasto en anuncios de una campaña que ya está en Anuncios con gasto no
    se repite."""
    nodos = {
        n.id: n
        for n in (await db.execute(select(VisionNodo).where(VisionNodo.org_id == org_id, VisionNodo.tipo == "campana"))).scalars().all()
    }
    if not nodos:
        return []
    anuncios = await _anuncios_por_utm(org_id, db)
    filas = []
    for d in (await db.execute(select(VisionDato).where(VisionDato.org_id == org_id))).scalars().all():
        n = nodos.get(d.nodo_id)
        if n is None:
            continue
        en_anuncios = bool(_clave(n.utm_campaign) and _clave(n.utm_campaign) in anuncios)
        if (d.gasto_cents or 0) > 0 and not en_anuncios:
            filas.append(
                {
                    "id": None,
                    "fecha": d.fecha,
                    "categoria": "publicidad",
                    "concepto": f"Visión · {n.titulo}: anuncios",
                    "importe_cents": int(d.gasto_cents),
                    "nota": "Se cambia en Visión",
                    "antiguo_id": None,
                    "vision_id": d.id,
                }
            )
        if (d.otros_gastos_cents or 0) > 0:
            filas.append(
                {
                    "id": None,
                    "fecha": d.fecha,
                    "categoria": d.otros_categoria or "otros",
                    "concepto": f"Visión · {n.titulo}: {d.otros_concepto or 'otros gastos'}",
                    "importe_cents": int(d.otros_gastos_cents),
                    "nota": "Se cambia en Visión",
                    "antiguo_id": None,
                    "vision_id": d.id,
                }
            )
    return filas


async def cifras_para_el_mapa(org_id: int, db: AsyncSession, ids: set[int]) -> dict[int, dict]:
    """Las cifras de las campañas que salen en un mapa (para sus tarjetas y
    las tarjetas de métrica): {nodo_id: {cifras, semaforo}}."""
    if not ids:
        return {}
    todo = await cuadro_de_mando(org_id, db, negocio=False)
    return {c["id"]: {"cifras": c["cifras"], "semaforo": c["semaforo"]} for c in todo["campanas"] if c["id"] in ids}

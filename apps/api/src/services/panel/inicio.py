"""
El inicio del panel del administrador: los números de la semana (22/11/2026).

El usuario: «le faltan cosas al software aún, diseño más clean general de
software caro, no tan IA… investiga qué puede ser lo mejor para mí en la parte
admin». El inicio de antes era un saludo, cuatro cifras sueltas y listas; no
decía cómo va la semana ni contra qué compararla.

Ahora UNA llamada (`GET /panel/org/{id}/inicio?periodo=semana|30|mes`, solo
administradores) devuelve lo que pinta la pantalla:

- **cifras**: vendido (con lo cobrado), ventas, llamadas (vinieron de las que
  ya tienen resultado), leads (con las visitas a la web) y alumnos activos.
  Cada una con la del **periodo anterior del mismo largo** para la flecha.
- **hoy**: lo que pide hacer algo ahora, una fila por cosa, solo las que
  tienen algo. Cada fila lleva a su pantalla.
- **embudo**: del clic a la venta, con las personas que ENTRARON en el periodo
  (la misma cohorte que Web → Analítica).
- **ventas**: las últimas, con de dónde vino cada una, cómo paga, su closer,
  lo vendido y lo cobrado.

No inventa cuentas: el dinero sale de `stats/ventas.py` (vendido ≠ cobrado),
las llamadas de `kpis._llamadas`, el embudo de `analitica.personas_de` y los
alumnos de `panel/alumnos.py`. Cada bloque va en su propio `try`: si uno
falla, los demás salen y ese llega como `None` (la pantalla lo dice).

Lo puro (`rango`, `comparar`, `forma_de_pago`, `filas_de_hoy`, `pasos_embudo`,
`ultimas_ventas`, `cifras_alumnos`) tiene test en `test_inicio_panel.py`.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Optional
from zoneinfo import ZoneInfo

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
PERIODOS = ("semana", "30", "mes")
NOMBRES = {"semana": "Esta semana", "30": "30 días", "mes": "Este mes"}
ANTES = {"semana": "que la semana pasada", "30": "que los 30 días de antes", "mes": "que el mes pasado a estas alturas"}


# ───────────────────────── lo puro ─────────────────────────


def rango(periodo: str, hoy: date) -> dict:
    """Las fechas del periodo y las del anterior, del MISMO largo.

    - semana: del lunes a hoy; antes, del lunes pasado al mismo día de la
      semana pasada (lunes a miércoles contra lunes a miércoles).
    - 30: los últimos 30 días; antes, los 30 de antes.
    - mes: del día 1 a hoy; antes, los mismos días del mes pasado (si el mes
      pasado era más corto, hasta su último día).
    """
    if periodo not in PERIODOS:
        periodo = "semana"
    if periodo == "semana":
        desde = hoy - timedelta(days=hoy.weekday())
        a_desde, a_hasta = desde - timedelta(days=7), hoy - timedelta(days=7)
    elif periodo == "30":
        desde = hoy - timedelta(days=29)
        a_desde, a_hasta = desde - timedelta(days=30), desde - timedelta(days=1)
    else:
        desde = hoy.replace(day=1)
        fin_anterior = desde - timedelta(days=1)
        a_desde = fin_anterior.replace(day=1)
        a_hasta = a_desde + timedelta(days=min(hoy.day, fin_anterior.day) - 1)
    return {
        "periodo": periodo,
        "nombre": NOMBRES[periodo],
        "antes_texto": ANTES[periodo],
        "desde": desde.isoformat(),
        "hasta": hoy.isoformat(),
        "antes_desde": a_desde.isoformat(),
        "antes_hasta": a_hasta.isoformat(),
    }


def comparar(ahora: Optional[float], antes: Optional[float]) -> dict:
    """La cifra con la de antes: diferencia y, si se puede, el tanto por
    ciento. `sentido`: 1 sube, -1 baja, 0 igual o sin dato con qué comparar."""
    a = ahora or 0
    if antes is None:
        return {"valor": a, "antes": None, "dif": None, "pct": None, "sentido": 0}
    dif = a - antes
    pct = round(dif / antes * 100) if antes else None
    return {"valor": a, "antes": antes, "dif": dif, "pct": pct, "sentido": (dif > 0) - (dif < 0)}


def _dia_nl(texto: str) -> str:
    """El día (hora de Países Bajos) de una fecha del servidor."""
    t = (texto or "").strip()
    if not t:
        return ""
    try:
        d = datetime.fromisoformat(t.replace("Z", "+00:00").replace(" ", "T", 1))
    except ValueError:
        return t[:10]
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(ZONA).date().isoformat()


def _hora_nl(texto: str) -> str:
    try:
        d = datetime.fromisoformat((texto or "").replace("Z", "+00:00").replace(" ", "T", 1))
    except ValueError:
        return ""
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(ZONA).strftime("%H:%M")


def ventas_entre(ventas: Iterable[dict], desde: str, hasta: str) -> list[dict]:
    """Las ventas cuyo PRIMER pago cae en esas fechas (hora de Países Bajos)."""
    return [v for v in ventas if desde <= _dia_nl(v.get("fecha") or v.get("paid_at") or "") <= hasta]


def forma_de_pago(venta: dict) -> dict:
    """Cómo paga, en palabras: «3 plazos» + «pago 1 de 3 · próximo 20 dic»,
    «cobro fallido» (en rojo en la pantalla), «plazos cancelados», o «Un pago»."""
    p = venta.get("plazos")
    if not p:
        return {"texto": "Otro importe" if venta.get("recorrido") == "reserva" else "Un pago", "detalle": "", "aviso": False}
    cuotas, pagadas = int(p.get("cuotas") or 0), int(p.get("pagadas") or 0)
    texto = f"{cuotas} plazos" if cuotas else "A plazos"
    if p.get("fallido"):
        return {"texto": texto, "detalle": f"cobro fallido · pago {min(pagadas + 1, cuotas or pagadas + 1)} de {cuotas}", "aviso": True}
    if p.get("cancelado"):
        return {"texto": texto, "detalle": f"cancelado · pagó {pagadas} de {cuotas}", "aviso": True}
    if p.get("estado") == "completado" or (cuotas and pagadas >= cuotas):
        return {"texto": texto, "detalle": "pagado entero", "aviso": False}
    detalle = f"pago {pagadas} de {cuotas}"
    proximo = _fecha_corta(p.get("proximo_cobro") or "")
    if proximo:
        detalle += f" · próximo {proximo}"
    return {"texto": texto, "detalle": detalle, "aviso": False}


_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _fecha_corta(texto: str) -> str:
    dia = _dia_nl(texto)
    try:
        d = date.fromisoformat(dia)
    except ValueError:
        return ""
    return f"{d.day} {_MESES[d.month - 1]}"


def ultimas_ventas(ventas: list[dict], origenes: dict[str, str], closers: dict[str, dict], n: int = 6) -> list[dict]:
    """Las `n` últimas ventas, la más reciente arriba, listas para pintar."""
    salida = []
    for v in sorted(ventas, key=lambda v: v.get("fecha") or "", reverse=True)[:n]:
        email = v.get("email") or ""
        closer = closers.get(email) or {}
        salida.append(
            {
                "email": email,
                "nombre": v.get("nombre") or email,
                "origen": origenes.get(email, ""),
                "pago": forma_de_pago(v),
                "closer": closer.get("nombre", ""),
                "closer_id": closer.get("id"),
                "vendido_cents": int(v.get("vendido_cents") or 0),
                "cobrado_cents": int(v.get("cobrado_cents") or 0),
                "dia": _dia_nl(v.get("fecha") or ""),
            }
        )
    return salida


def pasos_embudo(cifras: dict) -> list[dict]:
    """Visitas → datos → reservaron → vinieron → compraron, cada paso con el
    % sobre el paso anterior. Sin visitas contadas, el embudo empieza en los
    datos."""
    pasos = [
        ("visitas", "Visitas a la web", cifras.get("visitas")),
        ("leads", "Dejaron sus datos", cifras.get("leads")),
        ("reservaron", "Reservaron llamada", cifras.get("reservaron")),
        ("vinieron", "Vinieron", cifras.get("vinieron")),
        ("pagaron", "Compraron", cifras.get("pagaron")),
    ]
    salida: list[dict] = []
    anterior: Optional[int] = None
    for clave, nombre, n in pasos:
        if n is None:
            continue
        n = int(n)
        pct = round(n / anterior * 100, 1) if anterior else None
        salida.append({"clave": clave, "nombre": nombre, "n": n, "pct": pct})
        anterior = n
    return salida


def cifras_alumnos(alumnos: list[dict]) -> dict:
    """Cuántos alumnos hay, cuántos entraron en los últimos 7 días y cuántos
    llevan 14 días o más sin terminar ninguna clase de la formación."""
    return {
        "total": len(alumnos),
        "activos": sum(1 for a in alumnos if int(a.get("entradas_7d") or 0) > 0),
        "sin_avanzar": sum(1 for a in alumnos if (a.get("sin_avanzar") or {}).get("atascado")),
    }


def _nombres(lista: list[str], tope: int = 3) -> str:
    limpios = [x for x in lista if x]
    if len(limpios) <= tope:
        return " · ".join(limpios)
    return " · ".join(limpios[:tope]) + f" y {len(limpios) - tope} más"


def filas_de_hoy(
    *,
    llamar_hoy: list[str],
    nuevas: int,
    por_llamar: int,
    citas_hoy: list[dict],
    por_pagar: list[str],
    cobros_fallidos: list[str],
    por_corregir: int,
    sin_grupo: list[str],
    sin_avanzar: int,
    sin_apuntar: int,
) -> list[dict]:
    """Lo que pide hacer algo hoy. Una fila por cosa, y solo las que tienen
    algo. `tono`: rojo (ya), ámbar (hoy), gris (cuando se pueda)."""
    filas: list[dict] = []

    def fila(clave: str, tono: str, titulo: str, n: int, detalle: str, href: str) -> None:
        if n > 0:
            filas.append({"clave": clave, "tono": tono, "titulo": titulo, "n": n, "detalle": detalle, "href": href})

    fila("cobros", "rojo", "Cobros a plazos que han fallado", len(cobros_fallidos), _nombres(cobros_fallidos),
         "/dash/estadisticas?tab=plazos")
    fila("llamar", "rojo", "Volver a llamar hoy", len(llamar_hoy), _nombres(llamar_hoy), "/dash/estadisticas?tab=matriculas")
    fila("nuevas", "rojo", "Leads nuevos sin llamar", nuevas, "De las últimas 48 horas: cuanto antes, más se cierra",
         "/dash/estadisticas?tab=matriculas")
    fila("citas", "ambar", "Llamadas de hoy", len(citas_hoy),
         _nombres([f"{c.get('hora', '')} {c.get('nombre', '')}".strip() for c in citas_hoy], 4),
         "/dash/estadisticas?tab=llamadas")
    fila("pagar", "ambar", "Dijeron que sí y aún no han pagado", len(por_pagar), _nombres(por_pagar),
         "/dash/estadisticas?tab=matriculas")
    fila("apuntar", "ambar", "Llamadas sin apuntar qué pasó", sin_apuntar, "", "/dash/estadisticas?tab=llamadas")
    fila("corregir", "ambar", "Tareas por corregir", por_corregir, "", "/dash/estadisticas?tab=seguimiento")
    fila("grupo", "ambar", "Pagaron y no tienen grupo", len(sin_grupo), _nombres(sin_grupo), "/dash/estadisticas?tab=tandas")
    fila("porllamar", "gris", "Por llamar o que no contestaron", por_llamar, "", "/dash/estadisticas?tab=matriculas")
    fila("avanzar", "gris", "Alumnos 14 días sin avanzar", sin_avanzar, "", "/dash/estadisticas?tab=progreso")
    return filas


# ───────────────────────── lo que lee ─────────────────────────


async def _soltar(db_session: AsyncSession) -> None:
    """Si un bloque dejó la transacción a medias, que no arrastre al siguiente."""
    try:
        await db_session.rollback()
    except Exception:  # noqa: BLE001
        pass


async def inicio(org_id: int, periodo: str, db_session: AsyncSession) -> dict:
    from src.services.contactos.contactos import (
        _emails_con_cuenta,
        _todos_los_eventos,
        emails_que_pagaron,
        fusionar_contactos,
    )
    from src.services.contactos.metricas import emails_excluidos

    hoy = datetime.now(ZONA).date()
    r = rango(periodo, hoy)
    ahora = datetime.now(timezone.utc)
    salida: dict[str, Any] = {"rango": r, "hoy": hoy.isoformat(), "cifras": {}, "hoy_filas": None, "embudo": None, "ventas": None}

    # Lo que comparten los bloques. Si esto falla, no hay inicio.
    fuera = await emails_excluidos(db_session)
    fichas = [
        f
        for f in fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
        if f["email"] not in fuera
    ]
    pagaron = await emails_que_pagaron(db_session)

    citas: Optional[list[dict]] = None
    resultados: list[dict] = []
    try:
        from src.db.contact_seguimiento import CallOutcome
        from src.services.contactos.agenda import agenda

        resultados = [
            {"cita_id": x.cita_id, "email": x.email, "resultado": x.resultado, "inicio": x.inicio}
            for x in (await db_session.execute(select(CallOutcome))).scalars().all()
        ]
        datos_agenda = await agenda()
        if datos_agenda.get("configurado") and not datos_agenda.get("error"):
            citas = datos_agenda.get("citas") or []
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudo leer la agenda", exc_info=True)
        await _soltar(db_session)

    # ── dinero ──
    ventas: list[dict] = []
    try:
        from src.services.stats.ventas import leer_ventas, totales

        ventas = await leer_ventas(db_session)
        t_ahora = totales(ventas_entre(ventas, r["desde"], r["hasta"]))
        t_antes = totales(ventas_entre(ventas, r["antes_desde"], r["antes_hasta"]))
        salida["cifras"]["vendido"] = {
            **comparar(t_ahora["vendido_cents"], t_antes["vendido_cents"]),
            "cobrado_cents": t_ahora["cobrado_cents"],
            "por_cobrar_cents": t_ahora["por_cobrar_cents"],
        }
        salida["cifras"]["ventas"] = {**comparar(t_ahora["ventas"], t_antes["ventas"]), "a_plazos": t_ahora["a_plazos"]}
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudo leer el dinero", exc_info=True)
        await _soltar(db_session)

    # ── llamadas con fecha en el periodo ──
    sin_apuntar = 0
    try:
        from src.services.contactos.confirmar_llamada import ids_confirmadas
        from src.services.stats.kpis import _llamadas

        equipo_ev = [e for f in fichas for e in f.get("eventos") or [] if e.get("kind") == "llamada-equipo"]
        conf = ids_confirmadas(fichas)

        def llam(desde: str, hasta: str) -> dict:
            return _llamadas(citas, resultados, equipo_ev, pagaron, fuera, desde, hasta, ahora, conf)

        la, lb = llam(r["desde"], r["hasta"]), llam(r["antes_desde"], r["antes_hasta"])
        con_resultado = la["presentadas"] + la["no_vino"]
        salida["cifras"]["llamadas"] = {
            **comparar(la["presentadas"], lb["presentadas"]),
            "con_resultado": con_resultado,
            "no_vino": la["no_vino"],
            "futuras": la["futuras"],
            "sin_apuntar": la["sin_apuntar"],
            "pct_cierre": la["pct_cierre"],
        }
        # Las de los últimos 30 días que nadie ha apuntado (para «Hoy»).
        sin_apuntar = llam((hoy - timedelta(days=30)).isoformat(), hoy.isoformat())["sin_apuntar"]
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudieron contar las llamadas", exc_info=True)
        await _soltar(db_session)

    # ── del clic a la venta (cohorte: quien entró en el periodo) ──
    try:
        from src.db.web_visita import WebVisita
        from src.services.stats.analitica import _cifras, personas_de
        from src.services.stats.ventas import por_email

        dinero = por_email(ventas)
        personas = personas_de(
            fichas,
            [c for c in (citas or []) if not c.get("reprogramada")],
            resultados,
            pagaron,
            {e: d["vendido_cents"] for e, d in dinero.items()},
            fuera,
            "ficha",
            ahora,
            {e: d["cobrado_cents"] for e, d in dinero.items()},
        )

        async def n_visitas(desde: str, hasta: str) -> int:
            return int(
                (
                    await db_session.execute(
                        select(func.count()).select_from(WebVisita).where(WebVisita.dia >= desde, WebVisita.dia <= hasta)
                    )
                ).scalar()
                or 0
            )

        v_ahora, v_antes = await n_visitas(r["desde"], r["hasta"]), await n_visitas(r["antes_desde"], r["antes_hasta"])
        c_ahora = _cifras([p for p in personas if r["desde"] <= p["dia"] <= r["hasta"]], [None] * v_ahora)  # type: ignore[list-item]
        leads_antes = sum(1 for p in personas if r["antes_desde"] <= p["dia"] <= r["antes_hasta"])
        salida["cifras"]["leads"] = {**comparar(c_ahora["leads"], leads_antes), "visitas": v_ahora, "visitas_antes": v_antes}
        salida["embudo"] = pasos_embudo(c_ahora)
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudo calcular el embudo", exc_info=True)
        await _soltar(db_session)

    # ── alumnos ──
    atascados = 0
    try:
        from src.services.panel.alumnos import listar_alumnos

        ca = cifras_alumnos((await listar_alumnos(org_id, db_session)).get("alumnos") or [])
        atascados = ca["sin_avanzar"]
        salida["cifras"]["alumnos"] = ca
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudieron leer los alumnos", exc_info=True)
        await _soltar(db_session)

    # ── el tablero (lo necesitan «Hoy» y los closers de las ventas) ──
    tarjetas: list[dict] = []
    try:
        from src.services.panel import ads, pipeline

        tarjetas = (await pipeline.tablero(fichas, db_session, await ads.leer_nombres(org_id, db_session)))["tarjetas"]
        tarjetas = [t for t in tarjetas if not t.get("oculto")]
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudo leer el tablero", exc_info=True)
        await _soltar(db_session)

    # ── hoy ──
    try:
        nombre_de = {f["email"]: (f.get("nombre") or f["email"]) for f in fichas}

        llamar_hoy: list[str] = []
        try:
            from src.services.contactos.seguimiento import todos_los_recordatorios

            for email, rec in (await todos_los_recordatorios(db_session)).items():
                e = (email or "").strip().lower()
                if e not in fuera and (rec.get("fecha") or "9999") <= hoy.isoformat():
                    llamar_hoy.append(nombre_de.get(e, e))
        except Exception:  # noqa: BLE001
            await _soltar(db_session)

        quitadas = {x["cita_id"] for x in resultados if x.get("resultado") == "quitada"}
        citas_hoy = sorted(
            (
                {"hora": _hora_nl(c.get("inicio") or ""), "nombre": (c.get("nombre") or "").split(" ")[0], "inicio": c.get("inicio") or ""}
                for c in (citas or [])
                if c.get("estado") == "activa"
                and c.get("id") not in quitadas
                and (c.get("email") or "") not in fuera
                and _dia_nl(c.get("inicio") or "") == hoy.isoformat()
            ),
            key=lambda c: c["inicio"],
        )

        por_corregir = 0
        try:
            from src.services.tareas import tareas as T

            por_corregir = len(await T.por_corregir(org_id, db_session))
        except Exception:  # noqa: BLE001
            await _soltar(db_session)

        sin_grupo: list[str] = []
        try:
            from src.services.panel.tandas import por_decidir

            sin_grupo = [a.get("nombre") or "" for a in await por_decidir(org_id, db_session)]
        except Exception:  # noqa: BLE001
            await _soltar(db_session)

        salida["hoy_filas"] = filas_de_hoy(
            llamar_hoy=llamar_hoy,
            nuevas=sum(1 for t in tarjetas if t.get("etapa") == "nuevo"),
            por_llamar=sum(1 for t in tarjetas if t.get("etapa") in ("llamar", "no-contesta")),
            citas_hoy=citas_hoy,
            por_pagar=[t.get("nombre") or t.get("email") or "" for t in tarjetas if t.get("etapa") == "pendiente-pago"],
            cobros_fallidos=[v.get("nombre") or v.get("email") or "" for v in ventas if (v.get("plazos") or {}).get("fallido")],
            por_corregir=por_corregir,
            sin_grupo=sin_grupo,
            sin_avanzar=atascados,
            sin_apuntar=sin_apuntar,
        )
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudo montar «Hoy»", exc_info=True)
        await _soltar(db_session)

    # ── últimas ventas ──
    try:
        from src.services.panel.pipeline import canal_de, guardadas

        por_ficha = {f["email"]: f for f in fichas}
        origenes: dict[str, str] = {}
        ultimas = sorted(ventas, key=lambda v: v.get("fecha") or "", reverse=True)[:6]
        for v in ultimas:
            f = por_ficha.get(v["email"])
            if not f:
                continue
            c = canal_de(f)
            origenes[v["email"]] = " · ".join(
                x for x in ("Anuncio" if c.get("canal") == "ads" else "", c.get("detalle") or "") if x
            ) or ("Anuncio" if c.get("canal") == "ads" else "")
        closers: dict[str, dict] = {}
        try:
            from src.services.panel.reparto import _equipo_de_la_escuela

            _, eq = await _equipo_de_la_escuela(db_session)
            nombres_eq = {m["id"]: m.get("nombre") or "" for m in eq}
            for e, g in (await guardadas(db_session)).items():
                if g.get("closer_id"):
                    closers[e] = {"id": g["closer_id"], "nombre": (nombres_eq.get(g["closer_id"]) or g.get("closer") or "").split(" ")[0]}
        except Exception:  # noqa: BLE001
            await _soltar(db_session)
        salida["ventas"] = ultimas_ventas(ultimas, origenes, closers)
    except Exception:  # noqa: BLE001
        logger.warning("Inicio del panel: no se pudieron montar las últimas ventas", exc_info=True)
        await _soltar(db_session)

    return salida

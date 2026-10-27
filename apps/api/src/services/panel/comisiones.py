"""
¿Está pagada la comisión del closer de esta venta? (27/10/2026)

Pedido del usuario: "una etiqueta para poder ponerle desde algún lado para
saber qué venta fue ya pagada la comisión del closer… que lo vea yo solo".
Vive en Panel → Clientes, que ya es solo de administradores (es dinero), y la
API lo comprueba en cada ruta. El closer no lo ve en ningún sitio: ni en la
ficha ni en la línea de tiempo.

- Una venta = un cliente (por correo, como `listar_clientes`). Sin fila en
  `comision_closer`, la comisión está **pendiente**; con fila, **pagada**, con
  el día, quién la marcó y, si se apuntó, cuánto.
- **Lo que le toca, aproximado**: el % del closer del día del primer pago
  (los tramos de Visión → Ajustes: 10 % y 15 % desde el 16/10/2026) sobre el
  **TOTAL de la venta** (`base_de`). Con plazos, el total del plan aunque aún
  falten pagos ("que sea del total, no del primer pago solo", 27/10). No resta
  Klarna ni devoluciones, por eso se enseña con «≈».
- Al marcarla, el administrador elige el % (los de los tramos: 10 o 15) y el
  importe se ajusta solo; también se puede escribir a mano. Se guarda el
  importe, no el %: la pantalla deduce el % si cuadra con uno de ellos.
- Solo cuentan como pendientes las ventas que **pasaron por una llamada**
  (cita de Calendly, «¿Qué pasó?» apuntado, closer asignado, o una reserva o
  llamada del equipo en su ficha), igual que la comisión de Visión. Las demás
  salen como «sin llamada»; se pueden marcar igual si hace falta.
- Se marca y se desmarca: un error se deshace con un clic.
"""

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.comision_closer import ComisionCloser

SIN_CLOSER = "Sin closer asignado"
# Lo que en la ficha dice que hubo llamada (además de Calendly y «¿Qué pasó?»).
_KINDS_DE_LLAMADA = ("reunion", "llamada-equipo")


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def estimada(importe_cents: int, fecha: str, tramos: list[dict]) -> int:
    """Lo que le toca al closer de una venta: su % del día del primer pago
    sobre el total de la venta. Función pura."""
    from src.services.vision.calculo import pct_closer

    return round(max(0, int(importe_cents or 0)) * pct_closer((fecha or "")[:10], tramos or []) / 100)


def base_de(cliente: dict) -> int:
    """Sobre qué se calcula la comisión: el TOTAL de la venta. Con plazos, el
    total del plan (497, 540…), no lo cobrado hasta hoy. Función pura."""
    cobrado = int(cliente.get("total_cents") or 0)
    plan = int((cliente.get("plazos") or {}).get("total_cents") or 0)
    return max(cobrado, plan)


def porcentajes(tramos: list[dict]) -> list[float]:
    """Los % que se pueden elegir al marcar: los de los tramos de Visión
    (10 y 15). Sin tramos guardados, esos dos. Función pura."""
    vistos = sorted({float(t.get("pct") or 0) for t in (tramos or []) if float(t.get("pct") or 0) > 0})
    return vistos or [10.0, 15.0]


def estado_de(
    clientes: Iterable[dict],
    pagadas: dict[str, dict],
    con_llamada: set[str],
    closers: dict[str, str],
    tramos: list[dict],
) -> tuple[dict[str, dict], list[dict]]:
    """La comisión de cada cliente y el resumen por closer. Función pura.

    clientes: los de `listar_clientes` (email, total_cents, primer_pago y,
    si paga a plazos, `plazos.total_cents`).
    pagadas: {email: {importe_cents, cuando, por}} de `comision_closer`.
    Devuelve ({email: comision}, [resumen por closer, el más pendiente arriba]).
    """
    from src.services.vision.calculo import pct_closer

    por_email: dict[str, dict] = {}
    resumen: dict[str, dict] = {}
    for c in clientes:
        email = (c.get("email") or "").strip().lower()
        if not email:
            continue
        closer = closers.get(email) or ""
        llamada = email in con_llamada or bool(closer)
        pagada = pagadas.get(email)
        base = base_de(c)
        com = {
            "pagada": pagada,
            "base_cents": base,
            "pct": pct_closer((c.get("primer_pago") or "")[:10], tramos or []),
            "estimada_cents": estimada(base, c.get("primer_pago") or "", tramos),
            "con_llamada": llamada,
            "closer": closer,
        }
        por_email[email] = com
        if not llamada and not pagada:
            continue
        r = resumen.setdefault(
            closer or SIN_CLOSER,
            {"closer": closer or SIN_CLOSER, "pendientes": 0, "pendiente_cents": 0, "pagadas": 0, "pagado_cents": 0, "emails": []},
        )
        if pagada:
            r["pagadas"] += 1
            r["pagado_cents"] += int(pagada.get("importe_cents") or 0)
        else:
            r["pendientes"] += 1
            r["pendiente_cents"] += com["estimada_cents"]
            r["emails"].append(email)
    lista = sorted(resumen.values(), key=lambda r: (-r["pendientes"], r["closer"]))
    return por_email, lista


async def pagadas(db_session: AsyncSession) -> dict[str, dict]:
    salida: dict[str, dict] = {}
    for f in (await db_session.execute(select(ComisionCloser))).scalars().all():
        email = (f.email or "").strip().lower()
        if email:
            salida[email] = {"importe_cents": f.importe_cents or 0, "cuando": f.pagada_at or "", "por": f.pagada_por or "", "nota": f.nota or ""}
    return salida


async def _filas(email: str, db_session: AsyncSession) -> list[ComisionCloser]:
    return list(
        (await db_session.execute(select(ComisionCloser).where(func.lower(ComisionCloser.email) == email))).scalars().all()
    )


async def marcar(email: str, importe_cents: Optional[int], autor: str, db_session: AsyncSession, nota: str = "") -> dict:
    """Marca la comisión de esa venta como pagada (o cambia lo apuntado). Una
    fila por correo: si había otra, se reescribe."""
    clave = (email or "").strip().lower()
    if "@" not in clave:
        return {"ok": False, "motivo": "Falta el correo de la venta"}
    importe = max(0, min(int(importe_cents or 0), 10_000_000))
    filas = await _filas(clave, db_session)
    fila = filas[0] if filas else ComisionCloser(email=clave)
    for sobra in filas[1:]:
        await db_session.delete(sobra)
    fila.email = clave
    fila.importe_cents = importe
    fila.pagada_at = _ahora()
    fila.pagada_por = (autor or "")[:120]
    fila.nota = (nota or "").strip()[:300]
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, "pagada": {"importe_cents": importe, "cuando": fila.pagada_at, "por": fila.pagada_por, "nota": fila.nota}}


async def desmarcar(email: str, db_session: AsyncSession) -> dict:
    clave = (email or "").strip().lower()
    filas = await _filas(clave, db_session)
    for f in filas:
        await db_session.delete(f)
    await db_session.commit()
    return {"ok": True, "quitadas": len(filas)}


async def con_llamada(db_session: AsyncSession) -> set[str]:
    """Quien tuvo una llamada: lo del tablero (Calendly y «¿Qué pasó?») y,
    además, una reserva o una llamada del equipo en su ficha, que no caducan
    a los 45 días como la agenda de Calendly."""
    from src.db.contact_event import ContactEvent
    from src.services.panel.pipeline import emails_con_llamada

    salida = set(await emails_con_llamada(db_session))
    try:
        for (email,) in (
            await db_session.execute(select(ContactEvent.email).where(ContactEvent.kind.in_(_KINDS_DE_LLAMADA)))  # type: ignore[attr-defined]
        ).all():
            if email:
                salida.add(email.strip().lower())
    except Exception:  # noqa: BLE001
        pass
    return salida


async def para_clientes(clientes: list[dict], org_id: int, db_session: AsyncSession) -> tuple[list[dict], list[float]]:
    """Pone `comision` en cada cliente y devuelve el resumen por closer y los
    % que se pueden elegir al marcar."""
    from src.services.panel.pipeline import guardadas
    from src.services.vision.campanas import leer_ajustes

    try:
        repartidas = await guardadas(db_session)
    except Exception:  # noqa: BLE001
        repartidas = {}
    closers = {e: (g.get("closer") or "") for e, g in repartidas.items() if g.get("closer_id")}
    try:
        tramos = (await leer_ajustes(org_id, db_session)).get("closer") or []
    except Exception:  # noqa: BLE001
        tramos = []
    por_email, resumen = estado_de(clientes, await pagadas(db_session), await con_llamada(db_session), closers, tramos)
    for c in clientes:
        c["comision"] = por_email.get((c.get("email") or "").strip().lower())
    return resumen, porcentajes(tramos)

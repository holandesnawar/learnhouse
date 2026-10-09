"""
Qué pasó en cada llamada de venta, y el calendario de Google del closer.

Resultado de la llamada
-----------------------
Al colgar, el closer toca una de cuatro opciones y, si quiere, una nota. Con
eso:
- queda apuntado en la cita (se ve en el calendario y en la ficha);
- la tarjeta del tablero de Matrículas se mueve sola a donde toca
  (`A_COLUMNA`); "No vino" no la mueve;
- se deja una nota en su historial, para que el administrador la vea en
  "Notas del equipo" como cualquier otra.
No se escribe nada en Calendly (decisión del usuario, 29/09: "lo de no se
presentó no hace falta").

Calendario de Google
--------------------
El usuario pega el código para insertar su calendario de Google (el
`<iframe>` de Configuración → Integrar el calendario) y la escuela lo enseña
en Llamadas. Se guarda SOLO el id del calendario y la zona horaria, y la
dirección se reconstruye aquí: así no se pinta nunca un HTML pegado a mano.
⚠️ El calendario NO debe hacerse público: cada cual lo ve si ha entrado en
Google con una cuenta a la que se le ha compartido.
"""

import json
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs, quote, unquote, urlparse

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_seguimiento import CallOutcome
from src.db.organization_config import OrganizationConfig

RESULTADOS = {
    # "Pagó" (03/10): la venta cerrada. No mueve columna porque la de Alumno
    # se pone sola con el pago; quita la fecha de volver a llamar.
    "pagado": "Pagó",
    "compra": "Va a pagar",
    "piensa": "Lo piensa",
    "no-encaja": "No encaja",
    "no-vino": "No vino",
}
# 09/10: sin Propuesta ni En revisión (las dos van a Seguimiento, y la nota
# que deja dice cuál: «Va a pagar» / «Lo piensa»), Perdido se llama
# Descartado, y quien no vino vuelve a Por llamar.
A_COLUMNA = {"compra": "seguimiento", "piensa": "seguimiento", "no-encaja": "descartado", "no-vino": "llamar"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


async def resultados(db_session: AsyncSession) -> dict[str, dict]:
    filas = (await db_session.execute(select(CallOutcome))).scalars().all()
    return {
        f.cita_id: {"resultado": f.resultado, "nombre": RESULTADOS.get(f.resultado, f.resultado), "nota": f.nota, "autor": f.autor, "cuando": f.updated_at}
        for f in filas
    }


def _dia(inicio: str) -> str:
    try:
        d = datetime.fromisoformat(inicio.replace("Z", "+00:00"))
        return d.strftime("%d/%m")
    except Exception:  # noqa: BLE001
        return ""


async def guardar_resultado(
    cita_id: str, email: str, resultado: str, nota: str, inicio: str, autor: str, autor_id: int, db_session: AsyncSession
) -> dict:
    clave = (email or "").strip().lower()
    if not cita_id or "@" not in clave:
        return {"ok": False, "motivo": "Falta la cita o el correo"}
    if resultado not in RESULTADOS:
        return {"ok": False, "motivo": "Resultado desconocido"}
    nota = (nota or "").strip()[:2000]

    fila = (await db_session.execute(select(CallOutcome).where(CallOutcome.cita_id == cita_id))).scalars().first()
    if fila is None:
        fila = CallOutcome(cita_id=cita_id, email=clave)
    fila.resultado = resultado
    fila.nota = nota
    fila.inicio = (inicio or "")[:40]
    fila.autor = (autor or "")[:120]
    fila.updated_at = _ahora()
    db_session.add(fila)
    await db_session.commit()

    # La nota en su historial, como cualquier otra.
    from src.services.contactos.seguimiento import anadir_nota

    dia = _dia(inicio)
    texto = f"Llamada{f' del {dia}' if dia else ''}: {RESULTADOS[resultado]}." + (f" {nota}" if nota else "")
    try:
        await anadir_nota(clave, texto, autor_id, autor, db_session)
    except Exception:  # noqa: BLE001
        pass

    if resultado == "pagado":
        from src.services.contactos.seguimiento import poner_recordatorio

        try:
            await poner_recordatorio(clave, "", "", autor, db_session)
        except Exception:  # noqa: BLE001
            pass

    etapa = A_COLUMNA.get(resultado)
    if etapa:
        from src.services.panel.pipeline import mover

        await mover(clave, etapa, None, None, autor, db_session)
    return {"ok": True, "resultado": resultado, "columna": etapa or ""}


# ── Quitar una cita del calendario ──────────────────────────────────────
#
# 03/10, el usuario: "quiero poder eliminar del calendario de llamadas la
# prueba que hice". Las citas viven en Calendly y la escuela solo las LEE, así
# que no se borran allí (cancelarla mandaría un correo a la persona): se
# esconden aquí. Se guarda en la misma tabla, con el resultado "quitada", y se
# devuelve borrando esa fila. No deja nota ni mueve el tablero.

QUITADA = "quitada"


async def quitar_cita(cita_id: str, email: str, nombre: str, inicio: str, autor: str, db_session: AsyncSession) -> dict:
    if not cita_id:
        return {"ok": False, "motivo": "Falta la cita"}
    fila = (await db_session.execute(select(CallOutcome).where(CallOutcome.cita_id == cita_id))).scalars().first()
    if fila is None:
        fila = CallOutcome(cita_id=cita_id, email=(email or "").strip().lower())
    fila.resultado = QUITADA
    # Lo que hubiera apuntado se pierde: quitar es para pruebas y errores.
    fila.nota = (nombre or "")[:200]
    fila.inicio = (inicio or "")[:40]
    fila.autor = (autor or "")[:120]
    fila.updated_at = _ahora()
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True}


async def devolver_cita(cita_id: str, db_session: AsyncSession) -> dict:
    fila = (await db_session.execute(select(CallOutcome).where(CallOutcome.cita_id == cita_id))).scalars().first()
    if fila is not None and fila.resultado == QUITADA:
        await db_session.delete(fila)
        await db_session.commit()
    return {"ok": True}


def separar_quitadas(citas: list[dict], hechos: dict[str, dict], fuera: set[str]) -> tuple[list[dict], list[dict]]:
    """Las citas que se enseñan y las quitadas. Función pura, con test.

    Fuera del calendario: las quitadas a mano y las de quien está fuera de los
    números (pruebas). Las quitadas a mano se pueden devolver; las otras
    vuelven solas al volver a contar a esa persona."""
    visibles: list[dict] = []
    quitadas: list[dict] = []
    for c in citas:
        r = hechos.get(c.get("id") or "") or {}
        email = (c.get("email") or "").lower()
        if r.get("resultado") == QUITADA:
            quitadas.append({**c, "quitada_por": "mano", "resultado": None})
        elif email and email in fuera:
            quitadas.append({**c, "quitada_por": "prueba", "resultado": None})
        else:
            visibles.append(c)
    return visibles, quitadas


# ── Calendario de Google ────────────────────────────────────────────────

_ID_VALIDO = re.compile(r"^[A-Za-z0-9._%+\-#]+@[A-Za-z0-9.\-]+$")


def calendario_de_google(texto: str) -> dict:
    """Del código pegado (el iframe entero, la dirección o solo el id) saca
    los ids de calendario y la zona horaria. Función pura, con test."""
    texto = (texto or "").strip()
    if not texto:
        return {"ids": [], "zona": ""}
    m = re.search(r'src="([^"]+)"', texto)
    url = m.group(1) if m else texto
    ids: list[str] = []
    zona = ""
    if "calendar.google.com" in url:
        q = parse_qs(urlparse(url.replace("&amp;", "&")).query)
        ids = [unquote(x) for x in q.get("src", [])]
        zona = (q.get("ctz") or [""])[0]
    elif "@" in url:
        ids = [url]
    ids = [i for i in ids if _ID_VALIDO.match(i)][:5]
    if not re.match(r"^[A-Za-z_]+/[A-Za-z_+\-]+$", zona or ""):
        zona = "Europe/Amsterdam"
    return {"ids": ids, "zona": zona}


def url_de_google(cal: dict, modo: str = "WEEK") -> str:
    if not cal.get("ids"):
        return ""
    fuentes = "&".join(f"src={quote(i, safe='')}" for i in cal["ids"])
    return (
        f"https://calendar.google.com/calendar/embed?{fuentes}&ctz={quote(cal.get('zona') or 'Europe/Amsterdam', safe='')}"
        f"&mode={modo}&showPrint=0&showTitle=0&wkst=2&hl=es"
    )


async def _fila(org_id: int, db_session: AsyncSession):
    return (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()


# El calendario de llamadas que pasó el usuario el 29/09. Vale mientras no se
# guarde otro desde la pantalla (guardar el campo vacío lo quita).
_CALENDARIO_DE_SERIE = {
    "ids": ["439d68ad0031f5f1e38ab293545b034918d1d47162d1d1eac697da22cbead39b@group.calendar.google.com"],
    "zona": "Europe/Amsterdam",
}


async def leer_google(org_id: int, db_session: AsyncSession) -> dict:
    fila = await _fila(org_id, db_session)
    cal = _CALENDARIO_DE_SERIE
    if fila and isinstance(fila.config, dict) and "agenda_google" in fila.config:
        cal = fila.config.get("agenda_google") or {}
    cal = {"ids": list(cal.get("ids") or []), "zona": cal.get("zona") or "Europe/Amsterdam"}
    return {**cal, "url": url_de_google(cal)}


async def guardar_google(org_id: int, texto: str, db_session: AsyncSession) -> dict:
    fila = await _fila(org_id, db_session)
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    cal = calendario_de_google(texto)
    if texto.strip() and not cal["ids"]:
        raise ValueError("No encuentro ningún calendario en ese código. Pega el código de «Integrar el calendario».")
    config = json.loads(json.dumps(fila.config or {}))
    config["agenda_google"] = cal
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_google(org_id, db_session)

"""
Las grabaciones de las llamadas de venta, de Zoom a Google Drive (18/11/2026).

Pedido del usuario: "las grabaciones de las llamadas de consultoría, me dice que
ya ocupé los 10 GB de Zoom; quiero tener todo esto en un Drive ordenado por
fechas y por gente que compró y los que no… audio y transcripción, el vídeo no
aporta nada… para después sacar datos de las llamadas y entrenar".

Quién hace qué
--------------
- **El trabajo pesado NO lo hace la escuela**: lo hace un proceso de GitHub
  (`.github/workflows/zoom-a-drive.yaml` + `.github/scripts/zoom_a_drive.py`):
  lee las grabaciones de Zoom, baja SOLO el audio y la transcripción, los sube
  a la unidad compartida de Drive y, si se le pide, manda el vídeo de Zoom a la
  papelera. Así la escuela no baja gigas ni se frena.
- **La escuela solo contesta «quién era y si compró»** (`clasificar`, ruta
  `POST /api/v1/notifications/llamadas-grabadas`, con el secreto de las tareas
  programadas, `X-Cron-Token`). El proceso le manda, por cada llamada, cuándo
  empezó, el número de la reunión de Zoom y el correo del anfitrión; o, para
  volver a mirar las que ya están en Drive, el correo de la persona.

Cómo se empareja una llamada de Zoom con su persona
---------------------------------------------------
Con la agenda de Calendly (la misma de Llamadas, pero para cualquier fechas,
`citas_entre`): 1) el enlace de Zoom de la cita lleva el número de la reunión
(`/j/86012345678`) → exacto; 2) si no, la cita activa que empieza a 20 min o
menos de la grabación y, si los dos lo dicen, con el mismo anfitrión; 3) si no
hay una sola, «Sin identificar». Función pura: `emparejar`.

Lo que devuelve por llamada: nombre, correo, si compró (cuenta de alumno o
matrícula pagada, `emails_que_pagaron`), cuánto pagó, el closer de la tarjeta
y lo apuntado en «¿Qué pasó?». Nada de esto sale en el registro del proceso: el
repositorio es PÚBLICO y su registro también (solo cifras).
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

#: Cuánto se puede separar el inicio de la grabación del de la cita.
MARGEN_MIN = 20
#: Con la sala fija de un closer, cuánto se puede separar como mucho (se entra
#: antes o se alarga la llamada anterior).
MARGEN_SALA_FIJA_MIN = 60
#: Cuántas llamadas se clasifican como mucho en una petición.
MAXIMO = 300
_ZOOM_ID = re.compile(r"/j/(\d{9,12})")


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def _fecha(valor: Any) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(valor or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def id_zoom_de(enlace: Any) -> str:
    """El número de la reunión de Zoom dentro de un enlace de Calendly."""
    m = _ZOOM_ID.search(str(enlace or ""))
    return m.group(1) if m else ""


def emparejar(item: dict, citas: Iterable[dict]) -> Optional[dict]:
    """La cita de Calendly de una grabación de Zoom, o None. Ver la cabecera."""
    citas = [c for c in citas if c.get("email")]
    mid = re.sub(r"\D", "", str(item.get("meeting_id") or ""))
    inicio = _fecha(item.get("inicio"))
    if mid:
        por_id = [c for c in citas if id_zoom_de(c.get("enlace")) == mid]
        if por_id:
            # Con la sala fija de cada closer (12/11/2026: el ID personal de
            # Zoom) TODAS sus citas llevan el mismo número: el número solo dice
            # de quién es la sala, y la persona la dice la hora. Antes se cogía
            # la primera cita con ese número y todas sus llamadas salían a
            # nombre de la misma persona (25/11/2026).
            if len(por_id) == 1:
                return por_id[0]
            if inicio is None:
                return None
            cerca = sorted((
                (abs((ci - inicio).total_seconds()), c)
                for c in por_id
                for ci in [_fecha(c.get("inicio"))]
                if ci is not None and abs((ci - inicio).total_seconds()) <= MARGEN_SALA_FIJA_MIN * 60
            ), key=lambda x: x[0])
            activas = [x for x in cerca if x[1].get("estado") == "activa"]
            cerca = activas or cerca
            if not cerca:
                return None
            if len(cerca) > 1 and cerca[0][0] == cerca[1][0] and cerca[0][1]["email"] != cerca[1][1]["email"]:
                return None
            return cerca[0][1]
    if inicio is None:
        return None
    anfitrion = str(item.get("anfitrion_email") or "").strip().lower()
    cerca = []
    for c in citas:
        if c.get("estado") != "activa":
            continue
        ci = _fecha(c.get("inicio"))
        if ci is None or abs((ci - inicio).total_seconds()) > MARGEN_MIN * 60:
            continue
        cerca.append((abs((ci - inicio).total_seconds()), c))
    if anfitrion:
        mismo = [x for x in cerca if str(x[1].get("anfitrion_email") or "").lower() == anfitrion]
        if mismo:
            cerca = mismo
    if not cerca:
        return None
    cerca.sort(key=lambda x: x[0])
    # Dos citas a la misma hora sin forma de distinguirlas: mejor no adivinar.
    if len(cerca) > 1 and cerca[0][0] == cerca[1][0] and cerca[0][1]["email"] != cerca[1][1]["email"]:
        return None
    return cerca[0][1]


# ── Calendly para cualquier fechas ──────────────────────────────────────────


async def citas_entre(desde: datetime, hasta: datetime) -> list[dict]:
    """Las citas de Calendly (de toda la organización si se puede) entre dos
    fechas, como las da la agenda de Llamadas."""
    from src.services.contactos import agenda as A

    token = A._token()
    if not token:
        return []
    filtro = {
        "min_start_time": desde.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000000Z"),
        "max_start_time": hasta.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000000Z"),
        "sort": "start_time:asc",
        "count": 100,
    }
    async with httpx.AsyncClient(timeout=15.0, headers={"Authorization": f"Bearer {token}"}) as cliente:
        yo = (await A._get(cliente, f"{A.API}/users/me")).get("resource") or {}
        pagina = None
        if yo.get("current_organization"):
            try:
                pagina = await A._get(cliente, f"{A.API}/scheduled_events", {**filtro, "organization": yo["current_organization"]})
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in (400, 403, 404):
                    raise
        if pagina is None:
            pagina = await A._get(cliente, f"{A.API}/scheduled_events", {**filtro, "user": yo.get("uri", "")})
        eventos: list[dict] = []
        for _ in range(30):
            eventos.extend(pagina.get("collection") or [])
            siguiente = (pagina.get("pagination") or {}).get("next_page")
            if not siguiente:
                break
            pagina = await A._get(cliente, siguiente)
        turno = asyncio.Semaphore(3)

        async def invitados(ev: dict) -> list[dict]:
            uuid = str(ev.get("uri", "")).rstrip("/").rsplit("/", 1)[-1]
            async with turno:
                datos = await A._get(cliente, f"{A.API}/scheduled_events/{uuid}/invitees", {"count": 20})
            return A.cita_desde_calendly(ev, datos.get("collection") or [])

        listas = await asyncio.gather(*(invitados(e) for e in eventos))
    return [c for lista in listas for c in lista]


# ── Clasificar ──────────────────────────────────────────────────────────────


async def _datos_de_personas(emails: set[str], db_session: AsyncSession) -> dict[str, dict]:
    from src.db.enrollment import Enrollment
    from src.db.panel_negocio import LeadPipeline
    from src.services.contactos.contactos import emails_que_pagaron

    pagaron = await emails_que_pagaron(db_session)
    salen = {e: {"compro": e in pagaron, "pagado_eur": 0.0, "closer": ""} for e in emails}
    if not emails:
        return salen
    for e, cents in (
        await db_session.execute(select(Enrollment.email, Enrollment.amount_cents).where(Enrollment.status == "paid"))
    ).all():
        k = str(e or "").strip().lower()
        if k in salen:
            salen[k]["pagado_eur"] = round(salen[k]["pagado_eur"] + (cents or 0) / 100, 2)
    for e, closer in (await db_session.execute(select(LeadPipeline.email, LeadPipeline.closer))).all():
        k = str(e or "").strip().lower()
        if k in salen and closer:
            salen[k]["closer"] = str(closer)
    return salen


async def _resultados(ids: set[str], db_session: AsyncSession) -> dict[str, dict]:
    from src.db.contact_seguimiento import CallOutcome

    if not ids:
        return {}
    filas = (await db_session.execute(select(CallOutcome).where(CallOutcome.cita_id.in_(list(ids))))).scalars().all()
    return {f.cita_id: {"resultado": f.resultado, "nota": (f.nota or "")[:1000]} for f in filas}


async def clasificar(items: list[dict], db_session: AsyncSession) -> dict:
    """{clave: datos} para cada llamada que manda el proceso de Zoom a Drive."""
    items = [i for i in items if isinstance(i, dict) and i.get("clave")][:MAXIMO]
    fechas = [d for d in (_fecha(i.get("inicio")) for i in items if not i.get("email")) if d]
    citas: list[dict] = []
    aviso = ""
    if fechas:
        try:
            citas = await citas_entre(min(fechas) - timedelta(days=1), max(fechas) + timedelta(days=1))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Llamadas grabadas: no se pudo leer Calendly. %s", exc)
            aviso = f"No se pudo leer Calendly: {exc}"
    emparejadas: dict[str, dict] = {}
    for i in items:
        if i.get("email"):
            emparejadas[i["clave"]] = {"email": str(i["email"]).strip().lower(), "nombre": str(i.get("nombre") or "")}
            continue
        try:
            c = emparejar(i, citas)
        except Exception as exc:  # noqa: BLE001 — una llamada rara no tira las demás
            logger.warning("Llamadas grabadas: no se pudo emparejar una llamada. %s", exc)
            c = None
        if c:
            emparejadas[i["clave"]] = {
                "email": c["email"], "nombre": c.get("nombre") or "", "cita_id": c.get("id") or "",
                "evento": c.get("titulo") or "", "closer_calendly": c.get("anfitrion") or "",
            }
    personas = await _datos_de_personas({e["email"] for e in emparejadas.values()}, db_session)
    resultados = await _resultados({e.get("cita_id", "") for e in emparejadas.values()} - {""}, db_session)
    salen: dict[str, dict] = {}
    for i in items:
        e = emparejadas.get(i["clave"])
        if not e:
            salen[i["clave"]] = {"identificada": False}
            continue
        p = personas.get(e["email"], {})
        r = resultados.get(e.get("cita_id", ""), {})
        salen[i["clave"]] = {
            "identificada": True,
            "nombre": e.get("nombre", ""),
            "email": e["email"],
            "compro": bool(p.get("compro")),
            "pagado_eur": p.get("pagado_eur", 0.0),
            "closer": p.get("closer") or e.get("closer_calendly", ""),
            "evento": e.get("evento", ""),
            "resultado": r.get("resultado", ""),
            "nota": r.get("nota", ""),
        }
    return {"llamadas": salen, "aviso": aviso}

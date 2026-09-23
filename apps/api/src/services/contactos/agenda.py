"""
Agenda: las llamadas reservadas en Calendly, con día, hora y persona.

Para qué
--------
Hasta ahora la escuela solo sabía QUE alguien había reservado (la página de
/agendar avisa con un evento `reunion`), pero no CUÁNDO: el día y la hora solo
estaban en Calendly. El closer tenía que tener las dos pantallas abiertas.
Aquí se le pide a Calendly la lista de citas y se enseña dentro del panel, al
lado de las respuestas de cada persona.

Cómo
----
Con un **token personal de Calendly** (Integraciones → API y webhooks →
Tokens de acceso personal), puesto en Railway como `LEARNHOUSE_CALENDLY_TOKEN`.
Solo se LEE: la lista de citas y quién las reservó. Nada se escribe en
Calendly. Sin la variable, la agenda dice que no está configurada y el resto
del panel sigue igual.

Salen también las citas que se reservaron directamente en Calendly, sin pasar
por /agendar: la lista es la de Calendly, no la nuestra.

Falla en blando: si Calendly no contesta, la agenda dice por qué y el panel
sigue funcionando. Caché de un minuto en memoria para no pedirle lo mismo a
Calendly cada vez que alguien abre la pestaña.
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

API = "https://api.calendly.com"
_CACHE_SEG = 60
_cache: dict = {"hasta": 0.0, "datos": None}


def _token() -> str:
    return (os.environ.get("LEARNHOUSE_CALENDLY_TOKEN") or "").strip()


def cita_desde_calendly(evento: dict, invitados: list[dict]) -> list[dict]:
    """Una cita del panel por invitado. Función pura (con test): recibe lo
    que devuelve Calendly y lo deja en lo que el panel necesita."""
    ubicacion = evento.get("location") or {}
    enlace = ubicacion.get("join_url") or ""
    if not enlace and isinstance(ubicacion.get("location"), str) and ubicacion["location"].startswith("http"):
        enlace = ubicacion["location"]
    salida = []
    for inv in invitados:
        if (inv.get("status") or "active") != "active":
            continue
        # El teléfono solo viene si el evento lo pide (tipo "llamada
        # telefónica") o si hay una pregunta que lo recoja.
        telefono = ubicacion.get("location") if ubicacion.get("type") == "outbound_call" else ""
        for qa in inv.get("questions_and_answers") or []:
            if "tel" in str(qa.get("question", "")).lower() and qa.get("answer"):
                telefono = telefono or qa["answer"]
        salida.append(
            {
                "inicio": evento.get("start_time") or "",
                "fin": evento.get("end_time") or "",
                "titulo": evento.get("name") or "",
                "nombre": inv.get("name") or "",
                "email": (inv.get("email") or "").strip().lower(),
                "telefono": telefono or "",
                "enlace": enlace,
                "cancelar_url": inv.get("cancel_url") or "",
                "cambiar_url": inv.get("reschedule_url") or "",
            }
        )
    return salida


async def _get(cliente: httpx.AsyncClient, url: str, params: Optional[dict] = None) -> dict:
    r = await cliente.get(url, params=params)
    if r.status_code == 401:
        raise PermissionError("Calendly rechaza el token (401). Revisa LEARNHOUSE_CALENDLY_TOKEN.")
    r.raise_for_status()
    return r.json()


async def agenda(forzar: bool = False) -> dict:
    """Las citas activas desde hace 12 h hasta dentro de 60 días, por fecha."""
    token = _token()
    if not token:
        return {"configurado": False, "citas": []}

    ahora = time.time()
    if not forzar and _cache["datos"] is not None and _cache["hasta"] > ahora:
        return _cache["datos"]

    desde = (datetime.now(timezone.utc) - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
    hasta = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
    try:
        async with httpx.AsyncClient(
            timeout=10.0, headers={"Authorization": f"Bearer {token}"}
        ) as cliente:
            yo = (await _get(cliente, f"{API}/users/me")).get("resource") or {}
            eventos = (
                await _get(
                    cliente,
                    f"{API}/scheduled_events",
                    {
                        "user": yo.get("uri", ""),
                        "status": "active",
                        "min_start_time": desde,
                        "max_start_time": hasta,
                        "sort": "start_time:asc",
                        "count": 50,
                    },
                )
            ).get("collection") or []

            async def invitados(ev: dict) -> list[dict]:
                uuid = str(ev.get("uri", "")).rstrip("/").rsplit("/", 1)[-1]
                datos = await _get(cliente, f"{API}/scheduled_events/{uuid}/invitees", {"count": 20})
                return cita_desde_calendly(ev, datos.get("collection") or [])

            listas = await asyncio.gather(*(invitados(e) for e in eventos))
    except PermissionError as exc:
        return {"configurado": True, "citas": [], "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        logger.exception("No se pudo leer la agenda de Calendly")
        return {"configurado": True, "citas": [], "error": f"Calendly no contesta: {exc}"}

    citas = sorted((c for lista in listas for c in lista), key=lambda c: c["inicio"])
    datos = {"configurado": True, "citas": citas}
    _cache["datos"] = datos
    _cache["hasta"] = ahora + _CACHE_SEG
    return datos

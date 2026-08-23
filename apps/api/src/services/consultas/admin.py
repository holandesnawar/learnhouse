"""
Borrar cualquier consulta, desde el panel de administración.

Las consultas viven en otro Supabase (el que usaba la aplicación anterior).
Un alumno solo puede borrar las suyas, porque guarda en su navegador un
permiso por consulta. El equipo tiene que poder borrar cualquiera —spam, un
duplicado, algo publicado por error— y para eso hace falta la clave maestra
de ese Supabase.

Esa clave NO puede estar en el navegador: quien la tenga puede leer y borrar
todo. Por eso el borrado pasa por aquí: la escuela comprueba que quien lo
pide es administrador y solo entonces llama a Supabase con la clave, que vive
únicamente en las variables de Railway.
"""

from __future__ import annotations

import logging
import os

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# El proyecto de consultas. La URL es pública (ya viaja en el navegador); la
# que importa es la clave, que no tiene valor por defecto a propósito.
DEFAULT_URL = "https://alifjhqjmedstkafnrmp.supabase.co"

_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _supabase() -> tuple[str, str]:
    url = (os.environ.get("CONSULTAS_SUPABASE_URL") or DEFAULT_URL).rstrip("/")
    key = os.environ.get("CONSULTAS_SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta la clave de Supabase para borrar consultas. "
                "Añade CONSULTAS_SUPABASE_SERVICE_KEY en Railway."
            ),
        )
    return url, key


async def delete_consulta(consulta_id: str) -> dict:
    """Borra la consulta. Devuelve cuántas filas se han borrado."""
    clean = (consulta_id or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Falta el identificador de la consulta")

    url, key = _supabase()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        # `return=representation` hace que Supabase devuelva lo borrado, y así
        # se puede distinguir "borrada" de "no existía".
        "Prefer": "return=representation",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            response = await client.delete(
                f"{url}/rest/v1/consultas",
                params={"id": f"eq.{clean}"},
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.exception("Consultas: fallo de red al borrar %s", clean)
        raise HTTPException(status_code=502, detail=f"No se pudo contactar con Supabase: {exc}")

    if response.status_code >= 400:
        logger.error(
            "Consultas: Supabase rechazó el borrado de %s (%s): %s",
            clean, response.status_code, response.text[:300],
        )
        raise HTTPException(status_code=502, detail="Supabase no dejó borrar la consulta")

    try:
        borradas = response.json()
    except ValueError:
        borradas = []

    count = len(borradas) if isinstance(borradas, list) else 0
    if count == 0:
        raise HTTPException(status_code=404, detail="Esa consulta ya no existe")

    logger.info("Consulta %s borrada desde el panel", clean)
    return {"detail": "ok", "deleted": count}

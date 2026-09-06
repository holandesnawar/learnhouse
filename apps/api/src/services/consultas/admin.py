"""
El tablón de consultas, atendido desde el panel de la escuela.

Las consultas viven en otro Supabase (el que usaba la aplicación anterior, la
que estaba colgada en Vercel). Aquella tenía su propia pantalla de
administración con su propia contraseña: para responder a una alumna había que
iniciar sesión OTRA VEZ, en otro sitio, con otras credenciales. Un profe que
entra a la escuela no tenía forma de contestar.

Por eso el panel de consultas vive ahora aquí. Quien ya ha entrado en la
escuela y es del equipo puede leer el tablón, responder y resolver sin volver a
identificarse en ningún lado.

Para eso hace falta la clave maestra de ese Supabase, y esa clave NO puede
estar en el navegador: quien la tenga puede leer y borrar todo. Vive solo en
las variables de Railway y todas las llamadas salen desde aquí, después de que
la escuela haya comprobado quién lo pide (ver `src/routers/consultas.py`).

Un alumno sigue editando y borrando LO SUYO por su cuenta, con el permiso por
consulta que guarda su navegador (`edit_token`). Eso no pasa por aquí.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# El proyecto de consultas. La URL es pública (ya viaja en el navegador); la
# que importa es la clave, que no tiene valor por defecto a propósito.
DEFAULT_URL = "https://alifjhqjmedstkafnrmp.supabase.co"

_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

# Lo que el panel enseña de cada consulta. Se pide la fila entera y se recorta
# aquí en vez de pedir columnas sueltas: así una columna que falte en la tabla
# no tumba la pantalla, solo sale vacía. Y —más importante— nada que no esté en
# esta lista sale de la escuela.
_CAMPOS = (
    "id",
    "title",
    "content",
    "category",
    "author_name",
    "author_email",
    "created_at",
    "resolved",
    "respuesta_nawar",
    "resolved_at",
    "resolved_by",
)

# Cuántas consultas se traen de una vez. Con ~40 alumnos el tablón entero cabe
# de sobra; el tope está para que un día raro no se descargue media base de
# datos al abrir el panel.
_LIMITE = 500


def _supabase() -> tuple[str, str]:
    url = (os.environ.get("CONSULTAS_SUPABASE_URL") or DEFAULT_URL).rstrip("/")
    key = os.environ.get("CONSULTAS_SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta la clave de Supabase para gestionar consultas. "
                "Añade CONSULTAS_SUPABASE_SERVICE_KEY en Railway."
            ),
        )
    return url, key


async def _llamar(
    method: Literal["GET", "PATCH", "DELETE"],
    *,
    params: dict[str, str] | None = None,
    json: dict[str, Any] | None = None,
) -> httpx.Response:
    """Una llamada a la tabla `consultas` con la clave maestra."""
    url, key = _supabase()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        # `return=representation` hace que Supabase devuelva lo que ha tocado, y
        # así se puede distinguir "hecho" de "esa fila no existía".
        "Prefer": "return=representation",
        "Accept": "application/json",
    }
    if json is not None:
        headers["Content-Type"] = "application/json"

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            return await client.request(
                method,
                f"{url}/rest/v1/consultas",
                params=params,
                json=json,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.exception("Consultas: fallo de red (%s)", method)
        raise HTTPException(
            status_code=502, detail=f"No se pudo contactar con Supabase: {exc}"
        )


def _filas(response: httpx.Response) -> list[dict]:
    try:
        cuerpo = response.json()
    except ValueError:
        return []
    return cuerpo if isinstance(cuerpo, list) else []


def _recortar(fila: dict) -> dict:
    return {campo: fila.get(campo) for campo in _CAMPOS}


async def list_consultas(status: str | None = None) -> list[dict]:
    """
    El tablón para el panel: las consultas, la más nueva primero.

    `status` filtra por 'pending' o 'resolved'; cualquier otra cosa las trae
    todas. A diferencia del tablón del alumno, aquí sí viaja el email de quien
    pregunta, que es lo que el equipo necesita para contestar fuera si hace
    falta.
    """
    params: dict[str, str] = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(_LIMITE),
    }
    if status == "pending":
        params["resolved"] = "is.false"
    elif status == "resolved":
        params["resolved"] = "is.true"

    response = await _llamar("GET", params=params)
    if response.status_code >= 400:
        logger.error(
            "Consultas: Supabase rechazó la lista (%s): %s",
            response.status_code, response.text[:300],
        )
        raise HTTPException(status_code=502, detail="Supabase no devolvió las consultas")

    return [_recortar(fila) for fila in _filas(response)]


async def answer_consulta(consulta_id: str, respuesta: str, respondido_por: str) -> dict:
    """
    Publica la respuesta del equipo y da la consulta por resuelta.

    La respuesta se guarda en TEXTO PLANO. Las dos pantallas que la enseñan
    (el tablón y "Mis consultas") pasan el contenido por `htmlToText` y lo
    pintan con `whitespace-pre-wrap`, así que los saltos de línea se respetan y
    no hay ni una etiqueta que pueda inyectar nadie.

    Escribir `respuesta_nawar` dispara en Supabase el aviso por correo a la
    alumna (`trg_consulta_respondida`), igual que cuando se respondía desde la
    pantalla vieja. No hay que mandar nada desde aquí.
    """
    clean_id = (consulta_id or "").strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Falta el identificador de la consulta")

    texto = (respuesta or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="La respuesta está vacía")

    cambios: dict[str, Any] = {
        "respuesta_nawar": texto,
        "resolved": True,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "resolved_by": respondido_por or None,
    }

    response = await _llamar("PATCH", params={"id": f"eq.{clean_id}"}, json=cambios)

    # `resolved_at` y `resolved_by` son de una migración posterior a la tabla.
    # Si en algún entorno no estuvieran, PostgREST contesta 400 con el nombre de
    # la columna: se reintenta con lo imprescindible antes que dejar a un profe
    # sin poder contestar por un campo de registro.
    if response.status_code == 400 and (
        "resolved_at" in response.text or "resolved_by" in response.text
    ):
        logger.warning("Consultas: la tabla no tiene resolved_at/resolved_by; se guarda sin ellas")
        response = await _llamar(
            "PATCH",
            params={"id": f"eq.{clean_id}"},
            json={"respuesta_nawar": texto, "resolved": True},
        )

    if response.status_code >= 400:
        logger.error(
            "Consultas: Supabase rechazó la respuesta a %s (%s): %s",
            clean_id, response.status_code, response.text[:300],
        )
        raise HTTPException(status_code=502, detail="Supabase no dejó guardar la respuesta")

    filas = _filas(response)
    if not filas:
        raise HTTPException(status_code=404, detail="Esa consulta ya no existe")

    fila = _recortar(filas[0])
    logger.info("Consulta %s respondida desde el panel por %s", clean_id, respondido_por)
    _avisar_a_la_alumna(fila)
    return fila


def _avisar_a_la_alumna(fila: dict) -> None:
    """Le manda el correo de «ya tienes respuesta».

    **Lo mandaba Supabase y dejó de llegar.** El disparador
    `trg_consulta_respondida` sigue vivo y sigue arrancando su Edge Function,
    pero esa función, antes de mandar nada, llama a un webhook de la escuela
    que **no existe en esta API**: sus registros lo dicen con todas las letras,
    `Academy webhook error: 404 {"detail":"Not Found"}`, y ahí se cae con un
    500 sin llegar a enviar el correo.

    Se podría arreglar creando ese webhook, pero sería sostener una pieza que
    vive en otro repositorio, que no se puede ver desde aquí y que ya se ha
    roto una vez sin que nadie se entere. El correo lo tenemos escrito y
    sabemos a quién va: se manda desde aquí y se acabó la dependencia.

    Nunca lanza: la respuesta ya está guardada y publicada, y un fallo al
    avisar no puede dejar al profe con un error después de haber contestado
    bien.
    """
    email = (fila.get("author_email") or "").strip()
    if not email:
        logger.info("Consulta %s sin email de contacto: no se avisa", fila.get("id"))
        return
    try:
        from src.services.users.emails import send_consulta_answered_email, ACADEMY_URL

        send_consulta_answered_email(
            email=email,
            name=(fila.get("author_name") or "alumno/a"),
            question_excerpt=(fila.get("title") or "")[:160],
            link=f"{ACADEMY_URL}/mis-consultas",
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar por correo de la consulta %s", fila.get("id"))


async def delete_consulta(consulta_id: str) -> dict:
    """Borra la consulta. Devuelve cuántas filas se han borrado."""
    clean = (consulta_id or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Falta el identificador de la consulta")

    response = await _llamar("DELETE", params={"id": f"eq.{clean}"})

    if response.status_code >= 400:
        logger.error(
            "Consultas: Supabase rechazó el borrado de %s (%s): %s",
            clean, response.status_code, response.text[:300],
        )
        raise HTTPException(status_code=502, detail="Supabase no dejó borrar la consulta")

    count = len(_filas(response))
    if count == 0:
        raise HTTPException(status_code=404, detail="Esa consulta ya no existe")

    logger.info("Consulta %s borrada desde el panel", clean)
    return {"detail": "ok", "deleted": count}

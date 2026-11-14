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


# ── Consulta nueva → correo al equipo · la última respondida (14/11/2026) ──
#
# Usuario: «necesito recibir un mail cuando alguien deje una consulta, así
# respondo rápido» y «que las consultas respondidas salgan en el Inicio, una,
# si es nueva». Las consultas se escriben directamente en Supabase desde el
# navegador del alumno (ConsultasBoard), así que la escuela no se entera sola:
# en cuanto se guarda, el navegador avisa a `POST /consultas/org/{id}/nueva/{cid}`
# con su sesión. Aquí se comprueba con la clave maestra que la consulta existe
# y es de los últimos 15 minutos (el aviso no se puede inventar ni repetir con
# una vieja) y se escribe a los administradores, una sola vez por consulta.

_RECIENTE_SEG = 15 * 60
# Cuánto tiempo sale en el Inicio la última consulta respondida.
DIAS_EN_INICIO = 7


def _fecha(v: Any) -> datetime | None:
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def una_consulta(consulta_id: str) -> dict | None:
    r = await _llamar("GET", params={"select": "*", "id": f"eq.{consulta_id}", "limit": "1"})
    filas = _filas(r) if r.status_code < 400 else []
    return _recortar(filas[0]) if filas else None


def correo_consulta_nueva(fila: dict) -> tuple[str, str]:
    """Asunto y cuerpo (HTML del aviso) del correo al equipo. Pura."""
    import html as _html

    titulo = (fila.get("title") or "").strip() or "Sin título"
    quien = (fila.get("author_name") or "").strip() or "Un alumno"
    texto = (fila.get("content") or "").strip()
    if len(texto) > 1200:
        texto = texto[:1200].rstrip() + "…"
    cuerpo = (
        f"<p><b>{_html.escape(quien)}</b> ha dejado una consulta"
        + (f" en <b>{_html.escape(str(fila.get('category') or ''))}</b>" if fila.get("category") else "")
        + ":</p>"
        + f"<p><b>{_html.escape(titulo)}</b></p>"
        + "".join(f"<p>{_html.escape(l)}</p>" for l in texto.split("\n") if l.strip())
    )
    return f"Consulta nueva: {titulo[:90]}", cuerpo


async def avisar_consulta_nueva(consulta_id: str, destinos: list[str]) -> dict:
    """Escribe al equipo de una consulta recién creada. Una vez por consulta."""
    fila = await una_consulta(consulta_id)
    if not fila:
        raise HTTPException(status_code=404, detail="Esa consulta no existe")
    creada = _fecha(fila.get("created_at"))
    if not creada or (datetime.now(timezone.utc) - creada).total_seconds() > _RECIENTE_SEG:
        return {"avisados": 0, "motivo": "no es nueva"}
    try:
        from src.core.redis import get_redis_client

        r = get_redis_client()
        if r is not None and not r.set(f"consulta-nueva:{consulta_id}", "1", nx=True, ex=86400):
            return {"avisados": 0, "motivo": "ya avisado"}
    except Exception:  # noqa: BLE001
        logger.warning("Consultas: sin Redis para no repetir el aviso de %s", consulta_id)
    from src.services.users.emails import ACADEMY_URL, send_news_email

    asunto, cuerpo = correo_consulta_nueva(fila)
    avisados = 0
    for destino in destinos:
        try:
            send_news_email(
                destino,
                name="equipo",
                title=asunto,
                body_html=cuerpo,
                cta_label="Responder la consulta",
                cta_url=f"{ACADEMY_URL}/responder-consultas",
            )
            avisados += 1
        except Exception:  # noqa: BLE001
            logger.exception("Consultas: no se pudo avisar a %s de la consulta %s", destino, consulta_id)
    return {"avisados": avisados}


def elegir_ultima_respondida(filas: list[dict], ahora: datetime) -> dict | None:
    """La consulta respondida más reciente si es de los últimos DIAS_EN_INICIO
    días (por `resolved_at`; si la tabla no lo tiene, por `created_at`). Pura.
    Lo que sale es lo mismo que ya enseña el tablón público: sin correo."""
    mejor = None
    mejor_f = None
    for f in filas:
        if not f.get("resolved") or not (f.get("respuesta_nawar") or "").strip():
            continue
        d = _fecha(f.get("resolved_at")) or _fecha(f.get("created_at"))
        if not d or (ahora - d).total_seconds() > DIAS_EN_INICIO * 86400:
            continue
        if mejor_f is None or d > mejor_f:
            mejor, mejor_f = f, d
    if not mejor:
        return None
    return {
        "id": mejor.get("id"),
        "title": mejor.get("title") or "",
        "category": mejor.get("category") or "",
        "author_name": mejor.get("author_name") or "",
        "respuesta": (mejor.get("respuesta_nawar") or "")[:600],
        "respondida_at": mejor_f.isoformat() if mejor_f else "",
    }


async def ultima_respondida() -> dict | None:
    r = await _llamar(
        "GET",
        params={"select": "*", "resolved": "is.true", "order": "created_at.desc", "limit": "40"},
    )
    if r.status_code >= 400:
        return None
    return elegir_ultima_respondida(_filas(r), datetime.now(timezone.utc))

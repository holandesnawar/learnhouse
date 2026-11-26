"""Avisos por email a los alumnos (solo administradores)."""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.notifications.broadcast import _send_many, broadcast

logger = logging.getLogger(__name__)

router = APIRouter()

#: ⚠️ CON GUIONES. nginx tira por defecto las cabeceras con `_`
#: (`underscores_in_headers off`) y es la puerta del contenedor, así que una
#: cabecera con guiones bajos no llega hasta aquí. Mismo motivo y misma forma
#: que el token de las copias de seguridad.
CABECERA_SECRETO = "X-Cron-Token"


async def _soltar_transaccion(db_session) -> None:
    """Tras un fallo de una tarea, deshacer la transacción (16/11/2026).

    Un error de SQL deja la transacción de la sesión abortada y TODAS las
    tareas siguientes fallaban con «current transaction is aborted». Se
    deshace lo pendiente para que la siguiente empiece limpia."""
    try:
        await db_session.rollback()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo deshacer la transacción")


def _mismo_secreto(a: str, b: str) -> bool:
    """Compara sin filtrar por dónde dejan de parecerse ni cuánto miden."""
    ha = hashlib.sha256(a.encode("utf-8")).digest()
    hb = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(ha, hb)


class BroadcastPayload(BaseModel):
    org_id: int
    # "announcement" = novedad rápida · "class" = clase confirmada
    # "news" = aviso redactado en el panel, con formato
    kind: str = "announcement"
    title: str
    body: str = ""
    when_text: str = ""
    url: str = ""
    # Enlace al evento dentro de la plataforma (respaldo del botón).
    event_url: str = ""
    # Cuerpo con formato (HTML del editor) para los avisos "news".
    body_html: str = ""
    cta_label: str = ""
    cta_url: str = ""
    # true = enviar solo a quien lo escribe, para probar.
    test_only: bool = False
    # Solo a estos grupos de usuarios (25/10/2026: la beta y el programa
    # nuevo). Vacío = a todos los alumnos.
    grupos: list[int] = []
    # Desde un canal de la comunidad: solo a quien puede abrir ese canal.
    community_uuid: str = ""


@router.post(
    "/broadcast",
    summary="Avisar por email a los alumnos de la organización.",
)
async def api_broadcast(
    request: Request,
    payload: BroadcastPayload,
    background_tasks: BackgroundTasks,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    data = payload.model_dump()
    prepared = await broadcast(
        request, payload.org_id, payload.kind, data, current_user, db_session
    )
    # Los textos cambiados desde el panel se leen AQUÍ, con la sesión todavía
    # abierta: el envío corre en segundo plano y allí ya no hay base de datos.
    from src.services.orgs.orgs import get_org_email_texts

    textos_correo = await get_org_email_texts(payload.org_id, db_session)
    # El envío no bloquea la respuesta: quien pulsa el botón no espera 40 correos.
    background_tasks.add_task(
        _send_many, payload.kind, prepared["recipients"], data, textos_correo
    )
    return {"queued": prepared["count"], "test": bool(prepared.get("test"))}


@router.post(
    "/plan-recordatorio",
    summary="Recuerda a cada alumno sus días de estudio, a su hora. La llama una tarea cada hora.",
)
async def api_plan_recordatorio(
    request: Request,
    org_id: int = 1,
    db_session: AsyncSession = Depends(get_db_session),
):
    """Misma puerta que `/drip-diario` (secreto compartido). Apagado en Avisos
    (de serie), no manda nada y solo dice a cuántos les tocaría. Ver
    `services/plan/plan.py`."""
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")
    recibido = (request.headers.get(CABECERA_SECRETO) or "").strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")
    from src.services.plan.plan import recordar_a_quien_toque

    resultado = await recordar_a_quien_toque(org_id, db_session)
    logger.info("Recordatorio del plan: %s", resultado)
    return resultado


@router.post(
    "/grabaciones-bunny",
    summary="Pide a Bunny las grabaciones de la sala recién terminadas. La llama una tarea cada 15 minutos.",
)
async def api_grabaciones_bunny(
    request: Request,
    org_id: int = 1,
    db_session: AsyncSession = Depends(get_db_session),
):
    """Misma puerta que `/drip-diario`. Ver `copiar_las_nuevas` en
    `services/salas/estudio_grabaciones.py`."""
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")
    recibido = (request.headers.get(CABECERA_SECRETO) or "").strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")
    from src.services.salas.estudio_grabaciones import copiar_las_nuevas

    resultado = await copiar_las_nuevas(org_id, db_session)
    logger.info("Grabaciones a Bunny: %s", resultado)
    return resultado


@router.post(
    "/drip-diario",
    summary="Avisa por email de los módulos que se abren hoy. La llama una tarea diaria.",
)
async def api_drip_diario(
    request: Request,
    org_id: int = 1,
    db_session: AsyncSession = Depends(get_db_session),
):
    """El correo de «se te ha abierto un módulo».

    Va sin sesión y con un secreto compartido porque quien la llama es una
    tarea programada, no una persona: igual que el workflow de las copias.
    Sin `LEARNHOUSE_CRON_TOKEN` puesto, la ruta queda cerrada — nunca abierta
    de par en par por olvidar una variable.

    Es idempotente: se puede lanzar dos veces el mismo día sin repetirle el
    correo a nadie (ver `drip_email_sent`).
    """
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")

    recibido = (
        request.headers.get(CABECERA_SECRETO)
        or request.headers.get("LEARNHOUSE_CRON_TOKEN")
        or ""
    ).strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")

    from src.services.notifications.drip import avisar_modulos_abiertos_hoy

    resultado = await avisar_modulos_abiertos_hoy(org_id, db_session)

    # Los que entraron desde el 10/10/2026: a cada uno se le abre la formación
    # por su avance, y se le avisa aquí. Un fallo no tumba lo de arriba.
    try:
        from src.services.notifications.drip import avisar_aperturas_por_avance

        resultado["por_avance"] = await avisar_aperturas_por_avance(org_id, db_session)
    except Exception as e:  # noqa: BLE001
        logger.exception("Avisos por avance fallaron")
        await _soltar_transaccion(db_session)
        resultado["por_avance"] = {"error": str(e)[:200]}

    # El recordatorio «1 semana sin entrar» va en la misma tarea diaria. Solo
    # manda si está ACTIVADO en Avisos (apagado de serie); si no, dice a
    # cuántos les habría tocado. Un fallo aquí no tumba el aviso de módulos.
    try:
        from src.services.panel.recordatorio import recordatorio_automatico

        resultado["recordatorio"] = await recordatorio_automatico(org_id, db_session)
    except Exception as e:  # noqa: BLE001
        logger.exception("Recordatorio automático falló")
        await _soltar_transaccion(db_session)
        resultado["recordatorio"] = {"error": str(e)[:200]}

    # Los planes de pagos propios (3 plazos): se le pregunta a Stripe por los
    # cobros 2 y 3, por si sus avisos no están activados. Solo números.
    try:
        from src.services.payments.plazos import sincronizar_planes

        resultado["plazos"] = await sincronizar_planes(db_session)
    except Exception as e:  # noqa: BLE001
        logger.exception("Revisión de planes de pagos falló")
        await _soltar_transaccion(db_session)
        resultado["plazos"] = {"error": type(e).__name__}

    # La regla de los plazos sin pagar (services/payments/pausa.py). Apagada
    # (como nace) solo cuenta a cuántos afectaría; encendida, avisa una vez a
    # quien entra en pausa. Solo números.
    try:
        from src.services.payments.pausa import tarea_diaria as _pausa_diaria

        resultado["plazos_pausa"] = await _pausa_diaria(db_session)
    except Exception as e:  # noqa: BLE001
        logger.exception("La regla de los plazos sin pagar falló")
        await _soltar_transaccion(db_session)
        resultado["plazos_pausa"] = {"error": type(e).__name__}

    # La campaña del ebook de Black Friday (services/ebook/ebook.py): un correo
    # al día como mucho a quien compró y aún no ha reservado ni pagado.
    try:
        from src.services.ebook.ebook import enviar_campana

        resultado["ebook"] = await enviar_campana(db_session, org_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("Campaña del ebook falló")
        await _soltar_transaccion(db_session)
        resultado["ebook"] = {"error": type(e).__name__}

    logger.info("Goteo diario: %s", resultado)
    return resultado


class LlamadasGrabadasIn(BaseModel):
    llamadas: list[dict] = []


@router.post(
    "/llamadas-grabadas",
    summary="Quién era y si compró cada llamada grabada en Zoom. La llama el proceso de Zoom a Drive.",
)
async def api_llamadas_grabadas(
    request: Request,
    datos: LlamadasGrabadasIn,
    db_session: AsyncSession = Depends(get_db_session),
):
    """Misma puerta que `/drip-diario` (secreto compartido). Devuelve datos de
    personas: solo la usa el proceso de GitHub, que no los escribe en su
    registro. Ver `services/contactos/llamadas_grabadas.py`."""
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")
    recibido = (request.headers.get(CABECERA_SECRETO) or "").strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")
    from src.services.contactos.llamadas_grabadas import clasificar

    return await clasificar(datos.llamadas, db_session)



# ── El resumen semanal (23/11/2026, services/notifications/resumen_semanal.py) ──


@router.post(
    "/resumen-semanal",
    summary="Manda a cada alumno su resumen de la semana. La llama una tarea los lunes.",
)
async def api_resumen_semanal(
    request: Request,
    org_id: int = 1,
    db_session: AsyncSession = Depends(get_db_session),
):
    """Misma puerta que `/drip-diario` (secreto compartido). Apagado en Correos
    y avisos (de serie), no manda nada y solo dice a cuántos les tocaría. Uno
    por alumno y semana aunque se llame dos veces. Solo cifras en la respuesta."""
    esperado = (os.environ.get("LEARNHOUSE_CRON_TOKEN") or "").strip()
    if not esperado:
        raise HTTPException(status_code=503, detail="Cron token not configured")
    recibido = (request.headers.get(CABECERA_SECRETO) or "").strip()
    if not recibido or not _mismo_secreto(recibido, esperado):
        raise HTTPException(status_code=401, detail="Bad cron token")
    from src.services.notifications.resumen_semanal import enviar_semana

    resultado = await enviar_semana(org_id, db_session)
    logger.info("Resumen semanal: %s", resultado)
    return resultado


def _pagina_resumen(titulo: str, texto: str, boton: str = "", accion: str = "", enlace: str = ""):
    """Una página suelta con la marca, para el enlace «No quiero recibir este
    resumen». `accion` = a dónde manda el botón por POST (la baja no se hace
    con solo ABRIR el enlace: los filtros de correo abren los enlaces solos y
    darían de baja a quien no lo ha pedido). `enlace` = un enlace normal."""
    import html as _html

    from fastapi.responses import HTMLResponse

    estilo = (
        "display:inline-block;margin-top:22px;padding:13px 26px;background:#4da3ff;color:#0a1656;"
        "border:0;border-radius:10px;font:700 16px Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;"
        "text-decoration:none;cursor:pointer"
    )
    pieza = ""
    if boton and accion:
        pieza = f'<form method="post" action="{_html.escape(accion, quote=True)}" style="margin:0"><button type="submit" style="{estilo}">{_html.escape(boton)}</button></form>'
    elif boton and enlace:
        pieza = f'<a href="{_html.escape(enlace, quote=True)}" style="{estilo}">{_html.escape(boton)}</a>'
    return HTMLResponse(
        f"""<!doctype html><html lang="es" translate="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{_html.escape(titulo)} · Holandés Nawar</title></head>
<body style="margin:0;background:#F0F5FF;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171a2e">
<main style="max-width:520px;margin:12vh auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #DDE6F5">
<h1 style="margin:0 0 12px;font-size:24px;color:#1D0084">{_html.escape(titulo)}</h1>
<p style="margin:0;font-size:16px;line-height:1.6">{_html.escape(texto)}</p>{pieza}
</main></body></html>"""
    )


def _enlace_malo():
    return _pagina_resumen(
        "Este enlace no vale",
        "El enlace está mal copiado o ha caducado. Escríbenos a info@holandesnawar.com y lo quitamos nosotros.",
    )


@router.get(
    "/resumen-semanal/baja/{token}",
    summary="«No quiero recibir este resumen»: la página del enlace del correo.",
    include_in_schema=False,
)
async def api_resumen_baja_ver(token: str, db_session: AsyncSession = Depends(get_db_session)):
    from src.services.notifications import resumen_semanal as R

    user_id = R.leer_token(token)
    if not user_id:
        return _enlace_malo()
    aqui = f"/api/v1/notifications/resumen-semanal/baja/{token}"
    if await R.esta_de_baja(user_id, db_session):
        return _pagina_resumen(
            "Ya no recibes el resumen semanal",
            "No te mandaremos más el resumen de los lunes. Lo demás de la escuela sigue igual. Si cambias de idea, puedes volver a recibirlo.",
            "Quiero volver a recibirlo",
            accion=f"{aqui}?volver=1",
        )
    return _pagina_resumen(
        "¿Dejar de recibir el resumen semanal?",
        "Es el correo de los lunes con tus clases de la semana y por dónde vas en la formación. Si lo quitas, lo demás de la escuela sigue igual.",
        "Sí, no quiero recibirlo",
        accion=aqui,
    )


@router.post(
    "/resumen-semanal/baja/{token}",
    summary="Da de baja (o vuelve a apuntar) a esa persona del resumen semanal.",
    include_in_schema=False,
)
async def api_resumen_baja(token: str, volver: int = 0, db_session: AsyncSession = Depends(get_db_session)):
    from src.services.notifications import resumen_semanal as R
    from src.services.users.emails import ACADEMY_URL

    user_id = R.leer_token(token)
    if not user_id:
        return _enlace_malo()
    aqui = f"/api/v1/notifications/resumen-semanal/baja/{token}"
    if volver:
        await R.volver_a_apuntar(user_id, db_session)
        return _pagina_resumen(
            "Hecho: vuelves a recibirlo",
            "Te llegará el resumen los lunes, como antes.",
            "Entrar a la escuela",
            enlace=ACADEMY_URL,
        )
    await R.dar_de_baja(user_id, db_session)
    return _pagina_resumen(
        "Hecho: ya no recibes el resumen semanal",
        "No te mandaremos más el resumen de los lunes. Lo demás de la escuela sigue igual. Si ha sido sin querer, puedes volver a recibirlo.",
        "Quiero volver a recibirlo",
        accion=f"{aqui}?volver=1",
    )

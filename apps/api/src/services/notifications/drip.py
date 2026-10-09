"""
El aviso de «se te ha abierto un módulo nuevo».

**Por qué esto es una tarea diaria y no un disparador.** El goteo no tiene
ningún evento propio: los módulos no "se abren" en un momento concreto, sino
que llega su fecha y la pantalla deja de pintar el candado. No hay nada que
avisar en el instante en que ocurre porque no ocurre nada — pasa el tiempo. Así
que alguien tiene que preguntar una vez al día "¿qué se ha abierto hoy?".

**Solo cubre las fechas fijas de la convocatoria**, que es como está montado el
goteo de esta escuela (módulo 3 el 21 de septiembre, el 4 el 5 de octubre…). El
desfase por días desde el alta de cada alumno existe en el código de los
candados, pero aquí no se avisa: con fechas fijas todos abren el módulo el
mismo día y el correo tiene sentido; con desfases cada alumno abre el suyo un
día distinto y "hoy" deja de significar nada común. Si algún día se usan
desfases, esta función deja constancia en el registro en vez de callarse.

**Desde el 10/10/2026, la apertura por avance** (`avisar_aperturas_por_avance`,
al final): quien entra desde esa fecha abre la formación según termina cada
módulo, así que se le avisa alumno a alumno. Y a esos alumnos NO les llegan
los avisos de las fechas fijas de la formación, que ya no son las suyas.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.chapters import Chapter
from src.db.courses.chapter_activities import ChapterActivity
from src.db.drip_emails import DripEmailSent
from src.db.users import User
from src.db.user_organizations import UserOrganization
from src.services.courses.locks import get_drip_settings

logger = logging.getLogger(__name__)

#: El rol de alumno, igual que en `notifications/broadcast.py`.
ROL_ALUMNO = 4


def proximas_aperturas(fechas: dict, nombres: dict[str, str], hoy: str, cuantas: int = 3) -> list[dict]:
    """Los próximos módulos que se abren DESPUÉS de hoy, por fecha. Pura, con
    test. Va en cada respuesta de la tarea diaria para que el registro de
    GitHub Actions conteste "¿qué módulo se abre mañana?" sin entrar en la
    base de datos (pregunta real del usuario, 04/10/2026)."""
    futuras = sorted(
        (str(f)[:10], cu) for cu, f in fechas.items() if f and str(f)[:10] > hoy
    )
    return [{"fecha": f, "modulo": nombres.get(cu) or cu} for f, cu in futuras[:cuantas]]


async def _nombres_de_modulos(fechas: dict, db_session: AsyncSession) -> dict[str, str]:
    if not fechas:
        return {}
    return {
        cu: nombre or ""
        for cu, nombre in (
            await db_session.execute(
                select(Chapter.chapter_uuid, Chapter.name).where(
                    Chapter.chapter_uuid.in_(list(fechas.keys()))  # type: ignore[attr-defined]
                )
            )
        ).all()
    }


async def avisar_modulos_abiertos_hoy(org_id: int, db_session: AsyncSession) -> dict:
    """Manda el correo a cada alumno por cada módulo que se le abre HOY.

    Devuelve un resumen para que quien la llame lo deje en el registro. No
    lanza: si un alumno da problema, se sigue con el resto.
    """
    ajustes = await get_drip_settings(org_id, db_session)
    if not ajustes:
        return {"enviados": 0, "motivo": "el goteo está apagado"}

    fechas = ajustes.get("fechas") or {}
    if not isinstance(fechas, dict) or not fechas:
        if ajustes.get("chapters"):
            logger.warning(
                "Goteo por días desde el alta: no se avisa por correo. "
                "Solo se avisa de los módulos con fecha fija de convocatoria."
            )
        return {"enviados": 0, "motivo": "no hay módulos con fecha fija"}

    hoy = datetime.now().date().isoformat()
    abren_hoy = [cu for cu, fecha in fechas.items() if str(fecha)[:10] == hoy]
    try:
        proximos = proximas_aperturas(fechas, await _nombres_de_modulos(fechas, db_session), hoy)
    except Exception:  # noqa: BLE001
        proximos = []
    if not abren_hoy:
        return {"enviados": 0, "motivo": f"hoy ({hoy}) no abre ningún módulo", "proximos": proximos}

    alumnos = (
        await db_session.execute(
            select(User.id, User.email, User.first_name, User.username)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == ROL_ALUMNO,
            )
        )
    ).all()
    # Las cuentas del grupo Testers no reciben nada (services/panel/testers.py).
    from src.services.panel.testers import ids_testers

    testers = await ids_testers(org_id, db_session)
    alumnos = [a for a in alumnos if a[0] not in testers]
    if not alumnos:
        return {"enviados": 0, "motivo": "no hay alumnos"}

    # ⚠️ Quien entró desde el 10/10/2026 abre la formación POR AVANCE, no por
    # estas fechas: el 12/10 le habría llegado "se te ha abierto el módulo 4"
    # con el módulo cerrado. Sus avisos salen de `avisar_aperturas_por_avance`.
    from src.services.courses.avance_modulos import ids_con_avance, uuids_de_la_formacion

    con_avance = await ids_con_avance(org_id, db_session, ajustes)
    de_la_formacion = await uuids_de_la_formacion(org_id, db_session) if con_avance else set()

    from src.services.email.textos import usar_textos
    from src.services.orgs.orgs import get_org_email_texts
    from src.services.users.emails import send_module_unlocked_email

    textos = await get_org_email_texts(org_id, db_session)

    enviados = 0
    for chapter_uuid in abren_hoy:
        capitulo = (
            await db_session.execute(
                select(Chapter).where(Chapter.chapter_uuid == chapter_uuid)
            )
        ).scalars().first()
        if not capitulo:
            logger.warning("El goteo nombra un módulo que ya no existe: %s", chapter_uuid)
            continue

        # Cuántas clases trae el módulo. Es el número que sale en el correo.
        lecciones = len(
            (
                await db_session.execute(
                    select(ChapterActivity.id).where(ChapterActivity.chapter_id == capitulo.id)
                )
            ).scalars().all()
        )

        for user_id, email, first_name, username in alumnos:
            if not email:
                continue
            if user_id in con_avance and chapter_uuid in de_la_formacion:
                continue
            # ¿Ya se le avisó de este módulo? La tarea se puede reintentar
            # —un fallo de red, un lanzamiento a mano— y sin esto el alumno
            # recibiría el mismo correo otra vez.
            ya = (
                await db_session.execute(
                    select(DripEmailSent.id).where(
                        DripEmailSent.user_id == user_id,
                        DripEmailSent.chapter_uuid == chapter_uuid,
                    )
                )
            ).scalars().first()
            if ya:
                continue

            try:
                with usar_textos(textos):
                    send_module_unlocked_email(
                        email=email,
                        name=first_name or username or "alumno/a",
                        module_name=capitulo.name or "un módulo nuevo",
                        lesson_count=lecciones,
                    )
            except Exception:  # noqa: BLE001
                logger.exception("No se pudo avisar a %s del módulo %s", user_id, chapter_uuid)
                continue

            # La marca se guarda DESPUÉS de mandarlo: si el envío falla, el
            # alumno se queda sin correo pero mañana se reintenta. Al revés
            # —marcar antes— un fallo lo dejaría sin aviso para siempre.
            db_session.add(
                DripEmailSent(
                    user_id=user_id,
                    chapter_uuid=chapter_uuid,
                    sent_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            enviados += 1

        await db_session.commit()

    logger.info("Goteo: %s avisos enviados (%s módulos abren hoy)", enviados, len(abren_hoy))
    return {"enviados": enviados, "modulos": len(abren_hoy), "fecha": hoy, "proximos": proximos}


#: Una apertura por avance se avisa si es de estos últimos días. Más atrás
#: ya no es novedad (y evita una tanda de correos viejos si la tarea estuvo
#: parada una temporada).
DIAS_PARA_AVISAR = 3


async def avisar_aperturas_por_avance(org_id: int, db_session: AsyncSession) -> dict:
    """La otra mitad del aviso: los módulos que se le abren a un alumno POR SU
    AVANCE (los que entraron desde el 10/10/2026, ver
    `services/courses/avance_modulos.py`).

    Aquí no hay "hoy abre el módulo 4 para todos": a cada uno se le abre
    cuando termina el anterior y pasa la espera. Así que la tarea diaria
    pregunta, alumno a alumno, qué se le ha abierto desde la última vez; lo
    apunta en `modulo_abierto` (desde ahí ya no se le vuelve a cerrar) y le
    manda el mismo correo de siempre. Si el alumno lo abrió ayer por la tarde,
    el correo le llega esta mañana: la campana ya se lo enseñó al momento.

    Solo números en la respuesta: el registro de GitHub Actions es público.
    """
    from datetime import timedelta

    from src.services.courses.avance_modulos import ahora_utc, guardar_aperturas, ids_con_avance
    from src.services.panel.testers import ids_testers

    ajustes = await get_drip_settings(org_id, db_session)
    if not ajustes:
        return {"apuntados": 0, "enviados": 0, "motivo": "el goteo está apagado"}
    con_avance = await ids_con_avance(org_id, db_session, ajustes)
    if not con_avance:
        return {"apuntados": 0, "enviados": 0, "motivo": "nadie entra por avance todavía"}

    alumnos = (
        await db_session.execute(
            select(User.id, User.email, User.first_name, User.username)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
            .where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id == ROL_ALUMNO,
                UserOrganization.user_id.in_(list(con_avance)),  # type: ignore[attr-defined]
            )
        )
    ).all()
    testers = await ids_testers(org_id, db_session)
    alumnos = [a for a in alumnos if a[0] not in testers]
    if not alumnos:
        return {"apuntados": 0, "enviados": 0, "alumnos": 0}

    nuevas = await guardar_aperturas(org_id, [a[0] for a in alumnos], db_session)
    datos = {a[0]: a for a in alumnos}
    limite = ahora_utc() - timedelta(days=DIAS_PARA_AVISAR)

    from src.services.email.textos import usar_textos
    from src.services.orgs.orgs import get_org_email_texts
    from src.services.users.emails import send_module_unlocked_email

    textos = await get_org_email_texts(org_id, db_session) if nuevas else {}
    enviados = 0
    for user_id, chapter_uuid, abierto in nuevas:
        if abierto < limite:
            continue
        _uid, email, first_name, username = datos[user_id]
        if not email:
            continue
        ya = (
            await db_session.execute(
                select(DripEmailSent.id).where(
                    DripEmailSent.user_id == user_id,
                    DripEmailSent.chapter_uuid == chapter_uuid,
                )
            )
        ).scalars().first()
        if ya:
            continue
        capitulo = (
            await db_session.execute(select(Chapter).where(Chapter.chapter_uuid == chapter_uuid))
        ).scalars().first()
        if not capitulo:
            continue
        lecciones = len(
            (
                await db_session.execute(
                    select(ChapterActivity.id).where(ChapterActivity.chapter_id == capitulo.id)
                )
            ).scalars().all()
        )
        try:
            with usar_textos(textos):
                send_module_unlocked_email(
                    email=email,
                    name=first_name or username or "alumno/a",
                    module_name=capitulo.name or "un módulo nuevo",
                    lesson_count=lecciones,
                )
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar a %s del módulo %s (avance)", user_id, chapter_uuid)
            continue
        db_session.add(
            DripEmailSent(
                user_id=user_id,
                chapter_uuid=chapter_uuid,
                sent_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        enviados += 1
    if enviados:
        await db_session.commit()

    logger.info("Goteo por avance: %s aperturas apuntadas, %s avisos", len(nuevas), enviados)
    return {"alumnos": len(alumnos), "apuntados": len(nuevas), "enviados": enviados}

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
    if not abren_hoy:
        return {"enviados": 0, "motivo": f"hoy ({hoy}) no abre ningún módulo"}

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
    if not alumnos:
        return {"enviados": 0, "motivo": "no hay alumnos"}

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
    return {"enviados": enviados, "modulos": len(abren_hoy), "fecha": hoy}

"""
Cuenta de demostración para enseñar la escuela sin dar acceso real.

Crea (o reinicia) un alumno "demo" con progreso de ejemplo: racha, lecciones
terminadas, notas de ejercicios y algún fallo pendiente — para que el Inicio y
Mi progreso se vean poblados y con sentido, no vacíos.

Es idempotente: llamarlo otra vez deja la cuenta como nueva. Solo toca a ESE
usuario; nunca roza los datos de alumnos reales.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List
from uuid import uuid4

from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.exercise_attempts import ExerciseAttempt
from src.db.organizations import Organization
from src.db.student_progress import LessonCompletion, StudentProgress
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.security import security_hash_password

logger = logging.getLogger(__name__)

DEMO_EMAIL = "demo@holandesnawar.com"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "DemoNawar2026"

# Lecciones reales del temario (ver courseData.ts).
_DONE_LESSONS = [
    ("les-1-voorstellen", "over-jou", 1420),
    ("les-2-voornaamwoorden", "over-jou", 1180),
    ("les-3-werkwoorden", "over-jou", 1600),
    ("m2-les-1-familie", "familie-vrienden", 1310),
]

# (sección, aciertos, total, falladas)
_ATTEMPTS = [
    ("les-1-voorstellen-vocabulary", 24, 25, []),
    ("les-1-voorstellen-lezen", 9, 9, []),
    ("les-1-voorstellen-luisteren", 8, 9, ["¿Qué dice David al final?"]),
    ("les-2-voornaamwoorden-vocabulary", 19, 22, ["jij / u", "hun / hen"]),
    ("les-2-voornaamwoorden-lezen", 7, 9, ["¿Dónde vive Sofia?"]),
    ("les-3-werkwoorden-vocabulary", 21, 24, ["werken → ik ...", "doen → jij ..."]),
    ("m2-les-1-familie-vocabulary", 18, 20, ["de neef"]),
    ("m2-les-1-familie-lezen", 6, 9, ["¿Cuántos hermanos tiene Anna?", "¿Quién cocina?"]),
]


async def seed_demo_student(db_session: AsyncSession) -> dict:
    org = (await db_session.execute(select(Organization))).scalars().first()
    if not org:
        raise RuntimeError("No organization found")

    user = (
        await db_session.execute(select(User).where(User.email == DEMO_EMAIL))
    ).scalars().first()

    now = datetime.now(timezone.utc)

    if not user:
        user = User(
            user_uuid=f"user_{uuid4()}",
            username=DEMO_USERNAME,
            email=DEMO_EMAIL,
            first_name="María",
            last_name="(demo)",
            password=security_hash_password(DEMO_PASSWORD),
            email_verified=True,
            email_verified_at=now.isoformat(),
            signup_method="demo",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
    else:
        # Reinicio: contraseña conocida otra vez, por si alguien la cambió.
        user.password = security_hash_password(DEMO_PASSWORD)
        db_session.add(user)
        await db_session.commit()

    # Alumno de la escuela (rol 4), nunca administrador.
    link = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.org_id == org.id,
            )
        )
    ).scalars().first()
    if not link:
        db_session.add(
            UserOrganization(
                user_id=user.id or 0,
                org_id=org.id or 0,
                role_id=4,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db_session.commit()

    # Progreso limpio y vuelto a sembrar.
    await db_session.execute(
        delete(LessonCompletion).where(LessonCompletion.user_id == user.id)
    )
    await db_session.execute(
        delete(ExerciseAttempt).where(ExerciseAttempt.user_id == user.id)
    )
    await db_session.commit()

    completions: List[LessonCompletion] = []
    for i, (lesson_id, module_id, seconds) in enumerate(_DONE_LESSONS):
        completions.append(
            LessonCompletion(
                user_id=user.id or 0,
                lesson_id=lesson_id,
                module_id=module_id,
                completed_at=(now - timedelta(days=6 - i)).isoformat(),
                time_seconds=seconds,
            )
        )
    for c in completions:
        db_session.add(c)

    for i, (section_key, score, total, failed) in enumerate(_ATTEMPTS):
        db_session.add(
            ExerciseAttempt(
                user_id=user.id or 0,
                section_key=section_key,
                score=score,
                total=total,
                failed_labels=failed,
                date=(now - timedelta(days=min(5, i))).isoformat(),
            )
        )

    progress = (
        await db_session.execute(
            select(StudentProgress).where(StudentProgress.user_id == user.id)
        )
    ).scalars().first()
    if not progress:
        progress = StudentProgress(
            user_id=user.id or 0, creation_date=str(datetime.now())
        )

    progress.last_visit_date = now.date().isoformat()
    progress.current_streak = 5
    progress.longest_streak = 9
    progress.time_seconds_total = sum(c.time_seconds for c in completions)
    progress.current_position = {
        "module_id": "familie-vrienden",
        "lesson_id": "m2-les-1-familie",
        "section_id": "lezen",
    }
    progress.onboarding_state = {"dismissed": True}
    progress.update_date = str(datetime.now())
    db_session.add(progress)

    await db_session.commit()

    logger.info("Demo student seeded (%s)", DEMO_EMAIL)
    return {
        "email": DEMO_EMAIL,
        "username": DEMO_USERNAME,
        "password": DEMO_PASSWORD,
        "lessons_completed": len(completions),
        "attempts": len(_ATTEMPTS),
        "streak": progress.current_streak,
    }

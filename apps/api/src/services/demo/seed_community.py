"""
Sembrar la comunidad antes de abrir las puertas.

Cuando entran los primeros alumnos, una comunidad sin un solo mensaje parece
una casa vacía y nadie quiere ser el primero en hablar. Esto crea unas pocas
cuentas de arranque —cinco perfiles de la cohorte fundadora— y publica sus
presentaciones, para que quien llegue encuentre la conversación empezada.

Cosas que hace a propósito:

- **No manda ningún correo.** Los usuarios se insertan directamente, sin pasar
  por el alta normal: nadie recibe una bienvenida a una cuenta que no es suya.
- **No se puede entrar con ellas.** La contraseña es un valor aleatorio que no
  se guarda en ningún sitio; son cuentas para figurar, no para usar.
- **Se puede repetir sin miedo.** Si ya existe la cuenta o el mensaje, no se
  duplica: se salta y sigue.
- **Quedan apuntadas** en la configuración de la organización (`seed_users`),
  para poder reconocerlas después —por ejemplo, para no contarlas en las
  estadísticas— y para poder retirarlas.

Lo que NO hace, también a propósito: estas cuentas no opinan del producto.
Se presentan y preguntan dudas de holandés, nada más. Un testimonio falso es
otra cosa y no entra aquí.
"""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.communities.communities import Community
from src.db.communities.discussions import Discussion
from src.db.organization_config import OrganizationConfig
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.security import security_hash_password

logger = logging.getLogger(__name__)

# Rol de alumno (el mismo con el que entra quien paga).
STUDENT_ROLE_ID = 4


@dataclass
class Persona:
    key: str
    first_name: str
    last_name: str
    city: str
    """Su presentación en el canal."""
    presentation: str
    """Mensajes sueltos, para que el canal no sea solo una fila de presentaciones."""
    extras: List[str] = field(default_factory=list)


PERSONAS: List[Persona] = [
    Persona(
        key="marta",
        first_name="Marta",
        last_name="Ferrer",
        city="Rotterdam",
        presentation=(
            "Me llamo Marta y vivo en Rotterdam, ya van dos años.\n\n"
            "Aprendo holandés porque mi pareja es de aquí y su familia entera lo "
            "habla en las comidas. Yo asiento y me río cuando se ríen 😅\n\n"
            "Lo que más me cuesta ahora mismo es entender. Leerlo me defiendo, "
            "pero en cuanto hablan a velocidad normal me pierdo."
        ),
        extras=[
            "Ayer entendí una frase entera de la radio en el coche. Una. Pero entera 🎉",
        ],
    ),
    Persona(
        key="cristian",
        first_name="Cristian",
        last_name="Ocampo",
        city="Ámsterdam",
        presentation=(
            "Me llamo Cristian, soy colombiano y vivo en Ámsterdam.\n\n"
            "Aprendo holandés porque trabajo en un restaurante y lo escucho ocho "
            "horas al día sin enterarme de casi nada. Ya me da rabia.\n\n"
            "Lo que más me cuesta son los números: me dicen un precio y me quedo "
            "en blanco."
        ),
        extras=[
            "Pregunta tonta: cuando dicen «alsjeblieft» ¿es «por favor» o «aquí "
            "tienes»? Porque en la panadería me lo dicen al darme el pan y me lía 😅",
        ],
    ),
    Persona(
        key="lucia",
        first_name="Lucía",
        last_name="Bermejo",
        city="Utrecht",
        presentation=(
            "Me llamo Lucía y vivo en un pueblo al lado de Utrecht.\n\n"
            "Aprendo holandés por mis hijos: van al colegio de aquí y quiero "
            "enterarme de lo que dicen las profes y de las cartas que llegan a casa.\n\n"
            "Lo que más me cuesta es sentarme. Encontrar el rato, más que el idioma."
        ),
    ),
    Persona(
        key="diego",
        first_name="Diego",
        last_name="Sarmiento",
        city="Eindhoven",
        presentation=(
            "Me llamo Diego, argentino, en Eindhoven.\n\n"
            "Aprendo holandés porque en el trabajo todo es en inglés y llevo tres "
            "años aquí sin pasar de «dank je wel». Y a medio plazo quiero el "
            "inburgering.\n\n"
            "Lo que más me cuesta es la pronunciación: la g me sale a carraspera."
        ),
    ),
    Persona(
        key="yasmina",
        first_name="Yasmina",
        last_name="El Amrani",
        city="La Haya",
        presentation=(
            "Me llamo Yasmina y acabo de llegar a Den Haag.\n\n"
            "Aprendo holandés porque quiero empezar bien desde el principio, no "
            "como en otros sitios donde me quedé a medias.\n\n"
            "Lo que más me cuesta: todo todavía 😄 Empiezo de cero de verdad."
        ),
    ),
]

# El correo no se usa nunca (no se manda nada ni se entra con ellas), pero
# tiene que ser único y reconocible de un vistazo en la lista de usuarios.
SEED_EMAIL_DOMAIN = "arranque.holandesnawar.nl"


def _now() -> str:
    return str(datetime.now())


async def _get_or_create_user(persona: Persona, org_id: int, db_session: AsyncSession) -> tuple[User, bool]:
    email = f"{persona.key}@{SEED_EMAIL_DOMAIN}"
    existing = (
        await db_session.execute(select(User).where(User.email == email))
    ).scalars().first()
    if existing:
        return existing, False

    user = User(
        username=f"{persona.key}_nawar",
        first_name=persona.first_name,
        last_name=persona.last_name,
        email=email,
        bio=f"Alumno/a de la cohorte fundadora · {persona.city}",
        # Aleatoria y no guardada: estas cuentas no se usan para entrar.
        password=security_hash_password(secrets.token_urlsafe(32)),
        user_uuid=f"user_{uuid4()}",
        email_verified=True,
        signup_method="seed",
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    db_session.add(
        UserOrganization(user_id=int(user.id or 0), org_id=org_id, role_id=STUDENT_ROLE_ID)
    )
    await db_session.commit()
    return user, True


async def _post(
    title: str,
    content: str,
    author: User,
    community: Community,
    org_id: int,
    db_session: AsyncSession,
) -> bool:
    """Publica un mensaje si no estaba ya. Devuelve si lo ha creado."""
    already = (
        await db_session.execute(
            select(Discussion).where(
                Discussion.community_id == community.id,
                Discussion.author_id == author.id,
                Discussion.title == title,
            )
        )
    ).scalars().first()
    if already:
        return False

    discussion = Discussion(
        title=title,
        content=content,
        label="general",
        community_id=int(community.id or 0),
        org_id=org_id,
        author_id=int(author.id or 0),
        discussion_uuid=f"discussion_{uuid4()}",
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(discussion)
    await db_session.commit()
    return True


async def _remember_seed_users(org_id: int, user_ids: List[int], db_session: AsyncSession) -> None:
    """Apunta quiénes son, para poder reconocerlas y retirarlas después."""
    config = (
        await db_session.execute(
            select(OrganizationConfig).where(OrganizationConfig.org_id == org_id)
        )
    ).scalars().first()
    if not config:
        return
    try:
        raw = dict(config.config or {})
        current = raw.get("seed_users") or []
        merged = sorted({int(x) for x in current} | set(user_ids))
        raw["seed_users"] = merged
        config.config = raw
        # SQLModel no detecta el cambio dentro de un JSON si se muta en sitio.
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(config, "config")
        db_session.add(config)
        await db_session.commit()
    except Exception:
        logger.exception("No se pudieron apuntar las cuentas de arranque")


async def seed_community(
    org_id: int,
    community_id: int,
    db_session: AsyncSession,
    include_extras: bool = True,
) -> dict:
    """
    Crea las cuentas de arranque y publica sus presentaciones en un canal.

    Se puede llamar dos veces: lo que ya existe no se duplica.
    """
    community = (
        await db_session.execute(
            select(Community).where(
                Community.id == community_id, Community.org_id == org_id
            )
        )
    ).scalars().first()
    if not community:
        raise ValueError("Ese canal no existe en esta escuela")

    created_users: List[str] = []
    created_posts = 0
    skipped_posts = 0
    seed_ids: List[int] = []

    for persona in PERSONAS:
        user, is_new = await _get_or_create_user(persona, org_id, db_session)
        seed_ids.append(int(user.id or 0))
        if is_new:
            created_users.append(f"{persona.first_name} {persona.last_name}")

        if await _post(
            f"Me presento: {persona.first_name}",
            persona.presentation,
            user,
            community,
            org_id,
            db_session,
        ):
            created_posts += 1
        else:
            skipped_posts += 1

        if include_extras:
            for extra in persona.extras:
                # El título de un mensaje suelto es su primera línea recortada.
                title = extra.split("\n")[0][:70].rstrip(" .,") or "Mensaje"
                if await _post(title, extra, user, community, org_id, db_session):
                    created_posts += 1
                else:
                    skipped_posts += 1

    await _remember_seed_users(org_id, seed_ids, db_session)

    return {
        "canal": community.name,
        "cuentas_creadas": created_users,
        "cuentas_totales": len(PERSONAS),
        "mensajes_publicados": created_posts,
        "mensajes_ya_estaban": skipped_posts,
    }


async def seed_status(org_id: int, db_session: AsyncSession) -> dict:
    """Qué cuentas de arranque existen ya, para enseñarlo en el panel."""
    emails = [f"{p.key}@{SEED_EMAIL_DOMAIN}" for p in PERSONAS]
    rows = (
        await db_session.execute(select(User).where(User.email.in_(emails)))  # type: ignore[attr-defined]
    ).scalars().all()
    return {
        "existentes": [f"{u.first_name} {u.last_name}" for u in rows],
        "total": len(PERSONAS),
    }

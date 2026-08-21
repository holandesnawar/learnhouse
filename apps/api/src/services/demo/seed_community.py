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
    """Cómo aparece su @ en la comunidad. Sin apellidos de marca: `diego_nawar`
    delataba que la cuenta la había creado la escuela."""
    username: str
    """Lo que se lee bajo su nombre en el perfil. Escrito como lo escribiría
    esa persona, no como una etiqueta del sistema."""
    bio: str
    """Mensajes sueltos, para que el canal no sea solo una fila de presentaciones."""
    extras: List[str] = field(default_factory=list)


PERSONAS: List[Persona] = [
    Persona(
        key="marta",
        first_name="Marta",
        last_name="Ferrer",
        city="Rotterdam",
        username="martaferrer",
        bio="De Valencia, en Rotterdam desde 2024.",
        presentation=(
            "Ik ben Marta.\n"
            "Ik kom uit Spanje.\n"
            "Ik woon in Rotterdam.\n"
            "Ik ben 34 jaar.\n\n"
            "(Y hasta ahí llego 😅) Llevo dos años aquí. Aprendo holandés porque "
            "mi pareja es de aquí y su familia entera lo habla en las comidas: yo "
            "asiento y me río cuando se ríen.\n\n"
            "Lo que más me cuesta es entender. Leerlo me defiendo, pero en cuanto "
            "hablan a velocidad normal me pierdo."
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
        username="cristian.ocampo",
        bio="Colombiano en Ámsterdam. Trabajo en hostelería.",
        presentation=(
            "Ik ben Cristian.\n"
            "Ik kom uit Colombia.\n"
            "Ik woon in Amsterdam.\n"
            "Ik ben 29 jaar.\n"
            "Ik werk in een restaurant.\n\n"
            "Aprendo holandés porque lo escucho ocho horas al día en el trabajo y "
            "no me entero de casi nada. Ya me da rabia.\n\n"
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
        username="luciabermejo",
        bio="Madre de dos, cerca de Utrecht. Estudio en los ratos que puedo.",
        presentation=(
            "Ik ben Lucía.\n"
            "Ik kom uit Spanje.\n"
            "Ik woon in Utrecht.\n"
            "Ik ben 41 jaar.\n"
            "Ik heb twee kinderen.\n\n"
            "Aprendo holandés por ellos: van al colegio de aquí y quiero enterarme "
            "de lo que dicen las profes y de las cartas que llegan a casa.\n\n"
            "Lo que más me cuesta es sentarme. Encontrar el rato, más que el idioma."
        ),
    ),
    Persona(
        key="diego",
        first_name="Diego",
        last_name="Sarmiento",
        city="Eindhoven",
        username="diegosarmiento",
        bio="Argentino en Eindhoven. Voy a por el inburgering.",
        presentation=(
            "Ik ben Diego.\n"
            "Ik kom uit Argentinië.\n"
            "Ik woon in Eindhoven.\n"
            "Ik ben 36 jaar.\n\n"
            "En el trabajo todo es en inglés y llevo tres años aquí sin pasar de "
            "«dank je wel». A medio plazo quiero el inburgering.\n\n"
            "Lo que más me cuesta es la pronunciación: la g me sale a carraspera."
        ),
    ),
    Persona(
        key="yasmina",
        first_name="Yasmina",
        last_name="El Amrani",
        city="La Haya",
        username="yasmina.elamrani",
        bio="Recién llegada a Den Haag. Empiezo de cero.",
        presentation=(
            "Ik ben Yasmina.\n"
            "Ik kom uit Marokko.\n"
            "Ik woon in Den Haag.\n"
            "Ik ben 26 jaar.\n\n"
            "Acabo de llegar. Aprendo holandés porque quiero empezar bien desde el "
            "principio, no como en otros sitios donde me quedé a medias.\n\n"
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
        username=persona.username,
        first_name=persona.first_name,
        last_name=persona.last_name,
        email=email,
        bio=persona.bio,
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
    errores: List[str] = []

    # Cada persona va en su propio try. Antes, un fallo en la quinta tiraba la
    # llamada entera y el panel decía "no se pudo sembrar" sin más: se perdía
    # la señal de qué había fallado y parecía que no había funcionado nada,
    # cuando en realidad las cuatro anteriores estaban hechas.
    for persona in PERSONAS:
        nombre = f"{persona.first_name} {persona.last_name}"
        try:
            user, is_new = await _get_or_create_user(persona, org_id, db_session)
            seed_ids.append(int(user.id or 0))
            if is_new:
                created_users.append(nombre)

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
        except Exception as exc:  # noqa: BLE001
            logger.exception("No se pudo sembrar a %s", nombre)
            errores.append(f"{nombre}: {exc}"[:300])
            # La sesión se queda inservible tras un fallo de base de datos:
            # sin esto, las personas siguientes fallarían también en cadena.
            try:
                await db_session.rollback()
            except Exception:  # noqa: BLE001
                logger.exception("Tampoco se pudo deshacer la operación")

    await _remember_seed_users(org_id, seed_ids, db_session)

    return {
        "canal": community.name,
        "cuentas_creadas": created_users,
        "cuentas_totales": len(PERSONAS),
        "mensajes_publicados": created_posts,
        "mensajes_ya_estaban": skipped_posts,
        # Vacío = ha ido todo bien. Si no, aquí está el porqué, en cristiano.
        "errores": errores,
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

"""
Los monitores (08/11/2026, rama diseno).

Pedido del usuario: "voy a meter a un nuevo profe, pero es monitor, por lo que
no tiene que ver nada de eso ahora, solo Spreken Club y listo. El grupo se
llama Monitores."

Un monitor es una cuenta con rol de **profe** (rol 5: así entra en la sala
como anfitrión y puede repartir a la gente en salas pequeñas) que está además
en el grupo de usuarios **«Monitores»** (Panel → Usuarios → Grupos; vale
también «Monitor», sin mayúsculas ni acentos). Al monitor:

- La lista de cursos solo le enseña las clases del **Spreekclub** (las clases
  en directo cuyo nombre lleva «spreek» o «spreken»), ni la formación ni las clases
  semanales ni la masterclass (`get_courses_orgslug`).
- Lo que el equipo puede ABRIR y CAMBIAR por ser equipo (`_equipo_en_curso`
  en `security/rbac/resource_access.py`) se le queda en esas clases.
- La sala de profes le enseña solo esas clases y su archivo; ni el manual ni
  el resto.

Nada se guarda: sale del nombre del grupo y del nombre del curso. Un
administrador nunca es monitor, aunque esté en el grupo.
"""

import unicodedata

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

#: Los nombres del grupo que valen (sin mayúsculas ni acentos).
GRUPOS_MONITORES = {"monitores", "monitor", "monitoras", "monitora"}


def normalizar(texto: str) -> str:
    sin = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode("ascii")
    return " ".join(sin.lower().replace("-", " ").replace("_", " ").split())


def es_grupo_monitores(nombre: str) -> bool:
    return normalizar(nombre) in GRUPOS_MONITORES


def es_spreekclub(nombre: str) -> bool:
    """Las clases del monitor: las que llevan «spreek» o «spreken» en el
    nombre (Spreekclub, Spreken Club —así se llama en la escuela de verdad—,
    Spreekuur…)."""
    junto = normalizar(nombre).replace(" ", "")
    return "spreek" in junto or "spreken" in junto


async def es_monitor(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    """Si esta persona está en el grupo «Monitores» de esta escuela y no es
    administrador."""
    if not user_id or not org_id:
        return False
    from src.db.user_organizations import UserOrganization
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup
    from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS

    rol = (
        await db_session.execute(
            select(UserOrganization.role_id).where(
                UserOrganization.user_id == user_id, UserOrganization.org_id == org_id
            )
        )
    ).scalars().first()
    if rol in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return False
    nombres = (
        await db_session.execute(
            select(UserGroup.name)
            .join(UserGroupUser, UserGroupUser.usergroup_id == UserGroup.id)
            .where(UserGroupUser.user_id == user_id)
            .where(UserGroup.org_id == org_id)
        )
    ).scalars().all()
    return any(es_grupo_monitores(n) for n in nombres)


async def cursos_del_monitor(org_id: int, db_session: AsyncSession) -> set[str]:
    """Los `course_uuid` (con «course_») de las clases del Spreekclub."""
    from src.db.courses.courses import Course

    filas = (
        await db_session.execute(select(Course.course_uuid, Course.name).where(Course.org_id == org_id))
    ).all()
    return {u for u, n in filas if es_spreekclub(n)}

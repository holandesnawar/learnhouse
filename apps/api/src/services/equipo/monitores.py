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
  en directo cuyo nombre lleva «spreek» o «spreken») y, desde el 09/11/2026
  ("en masterclass que el monitor también pueda ver"), la **Masterclass**
  (`es_clase_del_monitor`). Ni la formación ni las clases semanales
  (`get_courses_orgslug`).
- Lo que el equipo puede ABRIR y CAMBIAR por ser equipo (`_equipo_en_curso`
  en `security/rbac/resource_access.py`) se le queda en esas clases.
- La sala de profes le enseña solo esas clases y su archivo; ni el manual ni
  el resto.

Nada se guarda: sale del nombre del grupo y del nombre del curso. Un
administrador nunca es monitor, aunque esté en el grupo.

**Que no vea nada antes de ser monitor** (09/11/2026, "antes de añadirlo al
grupo tiene que crearse cuenta y entrar… ¿entonces ya habrá visto la clase
semanal?"): quien entra con una invitación del grupo «Monitores» (Panel →
Usuarios → invitaciones, eligiendo el grupo) nace ya como profe y monitor
(`al_entrar_con_invitacion`, en `join.py` y `create_user_with_invite`), sin
pasar ni un momento como alumno.
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


def es_clase_del_monitor(nombre: str) -> bool:
    """Lo que ve un monitor: el Spreekclub y la Masterclass."""
    return es_spreekclub(nombre) or "master" in normalizar(nombre).replace(" ", "")


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
    """Los `course_uuid` (con «course_») de las clases del monitor (Spreekclub y Masterclass)."""
    from src.db.courses.courses import Course

    filas = (
        await db_session.execute(select(Course.course_uuid, Course.name).where(Course.org_id == org_id))
    ).all()
    return {u for u, n in filas if es_clase_del_monitor(n)}


async def al_entrar_con_invitacion(user_id: int, org_id: int, usergroup_id, db_session: AsyncSession) -> bool:
    """Si la invitación era del grupo «Monitores», la cuenta pasa a profe
    (rol 5) en ese momento. Solo sube a quien está como alumno (rol 4): nunca
    toca a un administrador ni a otro papel. Devuelve si la cambió."""
    if not user_id or not org_id or not usergroup_id:
        return False
    from src.db.user_organizations import UserOrganization
    from src.db.usergroups import UserGroup

    grupo = (
        await db_session.execute(
            select(UserGroup).where(UserGroup.id == int(usergroup_id), UserGroup.org_id == org_id)
        )
    ).scalars().first()
    if not grupo or not es_grupo_monitores(grupo.name or ""):
        return False
    uo = (
        await db_session.execute(
            select(UserOrganization).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    if not uo or uo.role_id != 4:
        return False
    uo.role_id = 5
    db_session.add(uo)
    await db_session.commit()
    try:
        from src.routers.users import _invalidate_session_cache

        _invalidate_session_cache(user_id)
    except Exception:  # noqa: BLE001
        pass
    return True


async def subir_monitores(db_session: AsyncSession) -> list[int]:
    """Los que están en «Monitores» con rol de alumno pasan a profe (10/11/2026).

    Antes, meter a alguien en el grupo desde el panel no le cambiaba el rol
    (solo la invitación lo hacía) y seguía viendo la escuela como alumno, sin
    el Spreekclub. Desde ese día el grupo da el rol (`sync_roles_for_group`);
    esto arregla a los que ya estaban dentro. Lo llama el arranque; repetirlo
    no cambia nada. Devuelve los usuarios que ha subido."""
    from src.db.user_organizations import UserOrganization
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup

    grupos = [
        g for g in (await db_session.execute(select(UserGroup))).scalars().all()
        if es_grupo_monitores(g.name or "")
    ]
    subidos: list[int] = []
    for g in grupos:
        ids = (
            await db_session.execute(select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == g.id))
        ).scalars().all()
        for uid in ids:
            uo = (
                await db_session.execute(
                    select(UserOrganization).where(
                        UserOrganization.user_id == uid, UserOrganization.org_id == g.org_id
                    )
                )
            ).scalars().first()
            if uo and uo.role_id == 4:
                uo.role_id = 5
                db_session.add(uo)
                subidos.append(uid)
    if subidos:
        await db_session.commit()
        try:
            from src.routers.users import _invalidate_session_cache

            for uid in subidos:
                _invalidate_session_cache(uid)
        except Exception:  # noqa: BLE001
            pass
    return subidos

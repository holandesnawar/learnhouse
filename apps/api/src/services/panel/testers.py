"""
Cuentas de prueba: el grupo «Testers» de la escuela.

Pedido del usuario (04/10/2026): "crear otro grupo tipo testers, que son las
cuentas que están probando, no alumnos" y que **no les llegue ningún correo**
de los que van a alumnos (avisos, módulo abierto, recordatorios).

Es un grupo de usuarios normal de LearnHouse (Panel → Escuela → Equipo y
grupos) que se llame «Testers». Se busca por NOMBRE, sin mayúsculas ni
acentos, y vale también «Tester» o «Pruebas»: así no depende de ningún id que
haya que copiar a mano, y crearlo desde el panel basta.

Quien está en el grupo:
- no recibe avisos, ni «módulo abierto», ni el recordatorio (manual o
  automático);
- no sale en Panel → Alumnos → Progreso.
Su cuenta y su acceso a la escuela no se tocan.
"""

import unicodedata

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup

NOMBRES = {"testers", "tester", "pruebas", "cuentas de prueba"}


def es_grupo_de_testers(nombre: str) -> bool:
    """Función pura, con test."""
    limpio = unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode().strip().lower()
    return limpio in NOMBRES


async def grupos_de_testers(org_id: int, db_session: AsyncSession) -> list[UserGroup]:
    return [
        g
        for g in (await db_session.execute(select(UserGroup).where(UserGroup.org_id == org_id))).scalars().all()
        if es_grupo_de_testers(g.name)
    ]


async def ids_testers(org_id: int, db_session: AsyncSession) -> set[int]:
    """Los usuarios del grupo Testers. Vacío si el grupo no existe. En blando:
    si algo falla, nadie es tester (mejor que dejar de mandar a todos)."""
    try:
        grupos = [g.id for g in await grupos_de_testers(org_id, db_session) if g.id is not None]
        if not grupos:
            return set()
        return {
            int(u)
            for u in (
                await db_session.execute(
                    select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id.in_(grupos))  # type: ignore[attr-defined]
                )
            ).scalars().all()
        }
    except Exception:  # noqa: BLE001
        return set()

"""
«Ver como» un alumno (08/11/2026).

Pedido: "ver la escuela como la ve un alumno concreto, sin tener que entrar
con su contraseña; un botón «Ver como Marta» en Organizar → Alumnos".

Cómo funciona, de punta a punta:

1. El administrador pulsa «Ver como» en Organizar → Alumnos. La pantalla
   llama a la ruta de Next `/api/auth/ver-como` (app/api/auth/ver-como).
2. Esa ruta pide aquí (`entrada`) una sesión del alumno, guarda la sesión
   del administrador aparte (cookies `LH_vercomo_*`, solo del servidor) y pone
   la del alumno. La escuela se recarga y se ve exactamente como la ve él:
   sus grupos, sus clases, su progreso.
3. Arriba sale una franja «Estás viendo la escuela como Marta · Volver a mi
   cuenta». Volver (`/api/auth/ver-como/salir`) devuelve la sesión del
   administrador. Cerrar sesión desde el perfil también vuelve.

Lo que protege:

- **Solo mirar.** La sesión lleva `ver_como` (el id del administrador) y
  `get_current_user` (security/auth.py) rechaza todo lo que no sea leer: no
  se publica, no se marca nada como hecho, no cuentan visitas. El alumno no
  se entera de nada.
- **Solo de administrador a alumno.** Quien pide tiene que ser administrador
  de esta escuela, y la cuenta a mirar, alumno de ella (rol 4) y nada más:
  nunca otro administrador, un profe ni un closer.
- **Dura 2 horas** y no se puede alargar (no hay refresco).
- **Salir no cierra las sesiones del alumno de verdad** (routers/auth.py,
  logout).
"""

from datetime import timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.auth import create_access_token
from src.security.rbac.constants import STUDENT_ROLE_ID

DURACION = timedelta(hours=2)


async def entrada(org_id: int, admin_id: int, user_id: int, db_session: AsyncSession) -> dict:
    if user_id == admin_id:
        return {"ok": False, "motivo": "Esa es tu propia cuenta."}
    filas = (
        await db_session.execute(
            select(UserOrganization).where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().all()
    roles = {f.role_id for f in filas}
    if not roles:
        return {"ok": False, "motivo": "Esa persona no es de esta escuela."}
    if roles != {STUDENT_ROLE_ID}:
        return {"ok": False, "motivo": "Solo se puede ver la escuela como un alumno."}
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user or not user.email:
        return {"ok": False, "motivo": "No se encuentra la cuenta."}
    token = create_access_token({"sub": user.email, "ver_como": admin_id}, expires_delta=DURACION)
    nombre = " ".join(x for x in [user.first_name or "", user.last_name or ""] if x).strip() or user.username or user.email
    return {"ok": True, "access_token": token, "nombre": nombre, "segundos": int(DURACION.total_seconds())}

"""
Qué ve cada closer en el panel (05/11/2026).

Pedido del usuario: "que yo pueda elegir lo que ven los closers, que mejor
ellos solo vean lo suyo, sus leads que eligieron, en Llamadas sus cosas". Lo
elige el administrador en Matrículas → «Qué ve el closer» (org_config
`acceso_closer.alcance`):

- `todo` (de serie): lo de todo el equipo, y cada uno se filtra lo suyo con
  «Solo las mías». El usuario, el mismo 05/11: "que puedan ver todas las
  llamadas de vuelta y con el botón solo las mías, como antes".
- `suyo_y_libre`: lo suyo y lo que aún no lleva nadie, para que pueda cogerlo
  («Asignarme»). Lo de otro closer no le sale.
- `suyo`: solo lo suyo. Lo que no lleva nadie lo reparte el administrador (o
  quien esté puesto en «Reparte las llamadas», que sí lo sigue viendo).

«Lo suyo» es lo de las personas que lleva (`lead_pipeline.closer_id`, el
closer de la tarjeta) y, en la agenda, las llamadas que Calendly le dio a él
(el closer de cada cita). Se filtra EN EL SERVIDOR, en cada lista: el tablero,
la agenda, las solicitudes y la lista de Llamadas, Contactos, las notas y
fechas de volver a llamar, y la ficha (la de otro closer contesta 403). A los
administradores no les cambia nada.
"""

from __future__ import annotations

from typing import Optional

from sqlmodel.ext.asyncio.session import AsyncSession

ALCANCES = ("todo", "suyo_y_libre", "suyo")
DE_SERIE = "todo"


def alcance_valido(valor: Optional[str]) -> str:
    return valor if valor in ALCANCES else DE_SERIE


class Filtro:
    """Lo que ve un closer: `yo` (su id), `libres` (si ve lo que no lleva
    nadie) y `de` ({correo: closer_id} de lo que tiene closer)."""

    def __init__(self, yo: int, libres: bool, de: dict[str, int]):
        self.yo = yo
        self.libres = libres
        self.de = de

    def ve_closer(self, closer_id: int) -> bool:
        """¿Ve algo que lleva `closer_id` (0 = nadie)? Función pura."""
        closer_id = int(closer_id or 0)
        if not closer_id:
            return self.libres
        return closer_id == self.yo

    def ve_correo(self, email: str) -> bool:
        """¿Ve a esta persona? Sin correo (una llamada apuntada solo con el
        móvil) cuenta como de nadie."""
        clave = (email or "").strip().lower()
        return self.ve_closer(self.de.get(clave, 0) if clave else 0)


async def filtro_de(user_id: int, org_id: int, db_session: AsyncSession) -> Optional[Filtro]:
    """El filtro de quien pregunta, o None si lo ve todo (no es closer, o el
    administrador ha elegido «todo»)."""
    from src.security.rbac.constants import CLOSER_ROLE_ID
    from src.services.orgs.acceso import rol_en_la_escuela
    from src.services.orgs.orgs import get_org_acceso_closer_config

    if (await rol_en_la_escuela(user_id, org_id, db_session)) != CLOSER_ROLE_ID:
        return None
    alcance = alcance_valido((await get_org_acceso_closer_config(org_id, db_session)).get("alcance"))
    if alcance == "todo":
        return None
    from src.services.panel.pipeline import guardadas

    de = {e: int(g.get("closer_id") or 0) for e, g in (await guardadas(db_session)).items() if int(g.get("closer_id") or 0)}
    libres = alcance == "suyo_y_libre"
    if not libres:
        # Quien reparte las llamadas (Ventas → «Reparte las llamadas») ve
        # siempre lo que no tiene nadie: si no, nadie vería «Por asignar».
        try:
            from src.services.panel.reparto import leer

            libres = int((await leer(db_session, org_id)).get("repartidor_id") or 0) == user_id
        except Exception:  # noqa: BLE001
            libres = False
    return Filtro(user_id, libres, de)

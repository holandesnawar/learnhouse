"""
Insignias de la formación: una por módulo superado (13/11/2026).

Pedido: «gamificación para que avancen en la formación grabada… se quedan en
el primer módulo y solo van a las clases en directo» y «que sean ellos los que
quieran compartirlo». De las ideas que se le dieron eligió dos: la lista de
atascados (`services/panel/alumnos.py::atasco`) y esto.

- **Qué es superar un módulo**: lo mismo que abre el módulo siguiente
  (`avance_modulos.terminado_el`): el 80 % de sus clases publicadas, sin
  contar el Werkboek ni los PDF. Una sola regla en toda la escuela: si el
  módulo 2 se le abre «porque terminó el 1», la insignia del 1 ya la tiene.
- **Sin tabla**: se calcula del recorrido (`trail_step`). La fecha es la de la
  clase con la que llegó al 80 %.
- Solo los capítulos con número («MODULE 1 - …»): la introducción no da
  insignia.
- **«Nueva»** = conseguida en los últimos 14 días y que el alumno no ha
  quitado ni compartido. Quitarla es la papelera de la campana
  (`notification_dismissed`, id `insignia:<capítulo>`): la tarjeta del Inicio
  y la campana usan la misma marca.
- Compartir en Victorias lo hace el navegador con la publicación de siempre
  (el alumno la ve y la cambia antes de publicar): aquí no se publica nada
  en su nombre.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.courses import avance_modulos as AM

DIAS_NUEVA = 14


def nombre_corto(nombre: str) -> str:
    """«MODULE 1 - Over jou» → «Over jou»."""
    partes = (nombre or "").split(" - ", 1)
    return (partes[1] if len(partes) == 2 else nombre or "").strip()


def insignias_de(modulos: list[dict], hechas: dict[int, datetime]) -> list[dict]:
    """Una por módulo con número, en su orden. Pura, con test."""
    out: list[dict] = []
    for m in modulos:
        if m.get("numero") is None:
            continue
        clases = list(m.get("clases") or [])
        cuando = AM.terminado_el(clases, hechas)
        out.append(
            {
                "id": f"insignia:{m['uuid']}",
                "numero": m["numero"],
                "nombre": nombre_corto(m.get("nombre") or ""),
                "hechas": sum(1 for c in set(clases) if c in hechas),
                "total": len(clases),
                "necesarias": AM.necesarias(len(clases)),
                "conseguida": cuando is not None,
                "cuando": AM.para_el_navegador(cuando),
            }
        )
    return out


def nuevas(insignias: list[dict], quitadas: set[str], ahora: datetime) -> list[dict]:
    """Las conseguidas hace poco que aún no ha quitado ni compartido. Pura."""
    limite = ahora - timedelta(days=DIAS_NUEVA)
    out = []
    for i in insignias:
        if not i["conseguida"] or i["id"] in quitadas:
            continue
        d = AM.leer_fecha(i["cuando"])
        if d and d >= limite:
            out.append(i)
    return out


async def _quitadas(user_id: int, db_session: AsyncSession) -> set[str]:
    from src.db.community_engagement import NotificationDismissed

    return set(
        (
            await db_session.execute(
                select(NotificationDismissed.item_id).where(
                    NotificationDismissed.user_id == user_id,
                    NotificationDismissed.item_id.like("insignia:%"),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    )


async def mis_insignias(user_id: int, db_session: AsyncSession) -> dict:
    curso = await AM.curso_formacion(db_session)
    if not curso or not curso.id:
        return {"insignias": [], "nuevas": []}
    modulos = await AM.modulos_en_orden(curso.id, db_session)
    hechas = await AM.clases_hechas(user_id, curso.id, db_session)
    todas = insignias_de(modulos, hechas)
    return {
        "insignias": todas,
        "nuevas": nuevas(todas, await _quitadas(user_id, db_session), AM.ahora_utc()),
    }


async def avisos(user_id: int, db_session: AsyncSession) -> list[dict]:
    """Para la campana: «Has superado el módulo 1»."""
    datos = await mis_insignias(user_id, db_session)
    return [
        {
            "id": i["id"],
            "kind": "insignia",
            "title": f"Has superado el módulo {i['numero']}",
            "excerpt": (i["nombre"] + ". " if i["nombre"] else "") + "Tienes una insignia nueva. Compártela en Victorias si quieres.",
            "url": "/ejercicios/progreso#insignias",
            "date": (i["cuando"] or "").replace("Z", "+00:00"),
        }
        for i in datos["nuevas"]
    ]

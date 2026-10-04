"""
Recordatorio a un alumno que lleva días sin entrar, mandado A MANO desde
Panel → Alumnos → Progreso. Nunca sale solo.

Pedido del usuario (04/10/2026): un botón que mande "esta semana no has
entrado a la escuela, recuerda que cada día suma" con tres botones (seguir
donde lo dejó, compartir una victoria, hacer una consulta), y poder editar el
texto según sea "esta semana" o "llevas 3 días".

- Dos plantillas, `tres_dias` y `semana`. La pantalla propone una según los
  días sin entrar (`tipo_para`), pero se puede cambiar antes de mandar.
- Se guardan en org_config `recordatorio_alumno`. Vacío = las de fábrica.
- Huecos: `{nombre}`, `{dias}` y `{clase}` (la clase a la que lleva el botón).
  Se rellenan a mano, sin `.format()`: una llave mal escrita no puede romper el
  envío (pasó con el editor de plantillas en septiembre: `KeyError` y caída en
  silencio al texto de fábrica).
"""

import json
import re
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig

TIPOS = ("tres_dias", "semana")

DE_FABRICA: dict = {
    "tres_dias": {
        "asunto": "{nombre}, te echamos de menos en la escuela",
        "texto": (
            "Hola {nombre}:\n\n"
            "Llevas {dias} días sin entrar a la escuela. No pasa nada, pero cuanto antes vuelvas, más fácil es retomar.\n\n"
            "*Cada día suma.* Con diez minutos de práctica hoy ya avanzas. Te dejamos el botón para seguir justo donde lo dejaste.\n\n"
            "¿Has conseguido algo estos días? Entender un cartel, decir una frase en el súper... Compártelo con tus compañeros: les anima a ellos y a ti.\n\n"
            "Y si algo se te ha atascado, haznos una consulta y lo vemos juntos."
        ),
    },
    "semana": {
        "asunto": "{nombre}, esta semana no has entrado a la escuela",
        "texto": (
            "Hola {nombre}:\n\n"
            "Esta semana no has entrado a la escuela. Recuerda que *cada día suma*: un poco de práctica, aunque sean diez minutos, marca la diferencia.\n\n"
            "Te dejamos el botón para seguir justo donde lo dejaste.\n\n"
            "¿Tienes alguna victoria que contar? Compártela con tus compañeros en la comunidad.\n\n"
            "Y si tienes dudas, haz una consulta: para eso estamos."
        ),
    },
    "botones": {
        "seguir": "Seguir donde lo dejé",
        "victoria": "Compartir una victoria",
        "consulta": "Hacer una consulta",
    },
}

_HUECO = re.compile(r"\{(nombre|dias|clase)\}")


def rellenar(texto: str, valores: dict) -> str:
    """Pone {nombre}, {dias} y {clase}. Cualquier otra llave se queda tal cual.
    Función pura, con test."""
    return _HUECO.sub(lambda m: str(valores.get(m.group(1), "") or ""), texto or "")


def tipo_para(dias: Optional[int]) -> str:
    """Qué plantilla toca: una semana o más (o nunca entró) → "semana"; si no,
    "tres_dias". Pura, con test."""
    if dias is None or dias >= 7:
        return "semana"
    return "tres_dias"


def mezclar(guardado: dict) -> dict:
    """Lo guardado encima de lo de fábrica, campo a campo: un hueco vacío no
    deja el correo sin asunto. Pura, con test."""
    out = json.loads(json.dumps(DE_FABRICA))
    for clave, valor in (guardado or {}).items():
        if clave in out and isinstance(valor, dict):
            for k, v in valor.items():
                if k in out[clave] and isinstance(v, str) and v.strip():
                    out[clave][k] = v.strip()
    return out


async def leer_plantillas(org_id: int, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    guardado = (fila.config or {}).get("recordatorio_alumno") if fila and isinstance(fila.config, dict) else None
    return {"plantillas": mezclar(guardado or {}), "de_fabrica": DE_FABRICA}


async def guardar_plantillas(org_id: int, datos: dict, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    limpio: dict = {}
    for clave in ("tres_dias", "semana", "botones"):
        bloque = (datos or {}).get(clave)
        if isinstance(bloque, dict):
            limpio[clave] = {k: str(v)[:4000] for k, v in bloque.items() if isinstance(v, str)}
    config = json.loads(json.dumps(fila.config or {}))
    config["recordatorio_alumno"] = limpio
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_plantillas(org_id, db_session)


def _url_seguir(seguir_uuid: str) -> str:
    from src.services.panel.avance import FORMACION_UUID
    from src.services.users.emails import ACADEMY_URL, RUTA_FORMACION_URL

    uuid = (seguir_uuid or "").replace("activity_", "")
    return f"{ACADEMY_URL}/course/{FORMACION_UUID}/activity/{uuid}" if uuid else RUTA_FORMACION_URL


async def _alumno(org_id: int, user_id: int, db_session: AsyncSession) -> dict:
    from src.services.panel.alumnos import listar_alumnos

    for a in (await listar_alumnos(org_id, db_session))["alumnos"]:
        if a["user_id"] == user_id:
            return a
    raise LookupError("Ese alumno no está en la escuela (o está fuera de los números)")


async def montar(
    org_id: int, user_id: int, tipo: str, asunto: str, texto: str, db_session: AsyncSession, *, enviar_a: str = "", preview: bool = True
) -> dict:
    """Arma el correo para ese alumno. Con preview=True solo lo devuelve;
    si no, lo manda a `enviar_a` (o al alumno si va vacío)."""
    from src.services.users.emails import ACADEMY_URL, send_recordatorio_alumno_email

    if tipo not in TIPOS:
        raise ValueError("Tipo de recordatorio desconocido")
    alumno = await _alumno(org_id, user_id, db_session)
    plantillas = (await leer_plantillas(org_id, db_session))["plantillas"]
    base = plantillas[tipo]
    nombre = (alumno["nombre"] or "").split(" ")[0] or "alumno/a"
    dias = alumno["estado"].get("dias")
    clase = ""
    if alumno.get("seguir_uuid"):
        # El nombre de la clase a la que lleva el botón, por si el texto la usa.
        if alumno.get("donde") and alumno["donde"].get("uuid") == alumno["seguir_uuid"]:
            clase = alumno["donde"]["clase"]
        elif alumno.get("siguiente"):
            clase = alumno["siguiente"].get("clase", "")
    valores = {"nombre": nombre, "dias": "" if dias is None else dias, "clase": clase}

    asunto_final = rellenar((asunto or "").strip() or base["asunto"], valores)
    texto_final = rellenar((texto or "").strip() or base["texto"], valores)
    r = send_recordatorio_alumno_email(
        email=enviar_a or alumno["email"],
        asunto=asunto_final,
        texto=texto_final,
        seguir_url=_url_seguir(alumno.get("seguir_uuid", "")),
        victoria_url=f"{ACADEMY_URL}/communities",
        consulta_url=f"{ACADEMY_URL}/consultas",
        botones=plantillas["botones"],
        preview=preview,
    )
    return {"para": enviar_a or alumno["email"], "asunto": asunto_final, "html": (r or {}).get("html", "") if preview else ""}


async def enviar(
    org_id: int, user_id: int, tipo: str, asunto: str, texto: str, quien: str, db_session: AsyncSession, *, a_mi: str = ""
) -> dict:
    """Manda el recordatorio. Con `a_mi` (un correo del equipo) es una prueba:
    no se apunta como recordatorio a ese alumno."""
    from src.db.recordatorios import StudentReminder

    r = await montar(org_id, user_id, tipo, asunto, texto, db_session, enviar_a=a_mi, preview=False)
    if not a_mi:
        db_session.add(
            StudentReminder(
                user_id=user_id,
                tipo=tipo,
                asunto=r["asunto"][:200],
                sent_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                sent_by=(quien or "")[:120],
            )
        )
        await db_session.commit()
    return {"ok": True, "para": r["para"], "asunto": r["asunto"], "prueba": bool(a_mi)}

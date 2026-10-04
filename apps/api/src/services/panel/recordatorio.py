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
            "[seguir]\n\n"
            "¿Has conseguido algo estos días? Entender un cartel, decir una frase en el súper... Compártelo con tus compañeros: les anima a ellos y a ti.\n\n"
            "[victoria]\n\n"
            "Y si algo se te ha atascado, haznos una consulta y lo vemos juntos.\n\n"
            "[consulta]"
        ),
    },
    "semana": {
        "asunto": "{nombre}, esta semana no has entrado a la escuela",
        "texto": (
            "Hola {nombre}:\n\n"
            "Esta semana no has entrado a la escuela. Recuerda que *cada día suma*: un poco de práctica, aunque sean diez minutos, marca la diferencia.\n\n"
            "Te dejamos el botón para seguir justo donde lo dejaste.\n\n"
            "[seguir]\n\n"
            "¿Tienes alguna victoria que contar? Compártela con tus compañeros en el canal de Victorias.\n\n"
            "[victoria]\n\n"
            "Y si tienes dudas, haz una consulta: para eso estamos.\n\n"
            "[consulta]"
        ),
    },
    "botones": {
        "seguir": "Seguir donde lo dejé",
        "victoria": "Compartir una victoria",
        "consulta": "Hacer una consulta",
    },
    # A dónde lleva cada botón (los de "seguir" se calculan por alumno). Una
    # ruta que empieza por "/" es dentro de la escuela; también vale una
    # dirección entera. "Compartir una victoria" va directo al canal
    # 🏆 Victorias de la comunidad (pedido del usuario, 04/10), no a la lista
    # de canales.
    "enlaces": {
        "victoria": "/community/community_bbe57cb8-5197-4195-bc1f-6615aed4dcab",
        "consulta": "/consultas",
    },
}

_HUECO = re.compile(r"\{(nombre|dias|clase)\}")

BOTONES = ("seguir", "victoria", "consulta")
_MARCA = re.compile(r"^\s*\[(seguir|victoria|consulta)\]\s*$", re.IGNORECASE)
# Para textos guardados antes de las marcas: debajo de qué párrafo va cada botón.
_PISTAS = {
    "seguir": ("donde lo dejaste", "donde lo dejó", "seguir"),
    "victoria": ("victoria", "logro", "compañeros"),
    "consulta": ("consulta", "duda"),
}


def colocar_botones(texto: str) -> list[tuple[str, str]]:
    """Trocea el texto en párrafos y botones: `[("texto", …), ("boton", "seguir"), …]`.
    Función pura, con test.

    Cada botón va donde está su marca (`[seguir]`, `[victoria]`, `[consulta]`
    en su propia línea), para que quede justo debajo de la frase que lo
    explica (pedido del usuario, 04/10: "los botones justo debajo de cada
    frase, no los tres al final"). Un texto sin ninguna marca —guardado antes—
    los coloca debajo del párrafo que habla de cada cosa. Lo que no encuentre
    sitio va al final, para que ningún botón se pierda; una marca repetida
    solo cuenta la primera vez.
    """
    trozos: list[tuple[str, str]] = []
    puestos: set[str] = set()
    lineas = (texto or "").split("\n")
    if any(_MARCA.match(l) for l in lineas):
        actual: list[str] = []
        for l in lineas:
            m = _MARCA.match(l)
            if not m:
                actual.append(l)
                continue
            if "\n".join(actual).strip():
                trozos.append(("texto", "\n".join(actual).strip()))
            actual = []
            clave = m.group(1).lower()
            if clave not in puestos:
                trozos.append(("boton", clave))
                puestos.add(clave)
        if "\n".join(actual).strip():
            trozos.append(("texto", "\n".join(actual).strip()))
    else:
        parrafos_ = [p.strip() for p in (texto or "").split("\n\n") if p.strip()]
        detras: dict[int, list[str]] = {}
        for clave in BOTONES:
            for i, p in enumerate(parrafos_):
                if any(pista in p.lower() for pista in _PISTAS[clave]):
                    detras.setdefault(i, []).append(clave)
                    puestos.add(clave)
                    break
        for i, p in enumerate(parrafos_):
            trozos.append(("texto", p))
            for clave in detras.get(i, []):
                trozos.append(("boton", clave))
    for clave in BOTONES:
        if clave not in puestos:
            trozos.append(("boton", clave))
    return trozos


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
    for clave in ("tres_dias", "semana", "botones", "enlaces"):
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


def url_enlace(valor: str, por_defecto: str, base: str) -> str:
    """Una ruta de la escuela ("/community/…") o una dirección entera
    ("https://…"). Lo demás no vale y se usa el de fábrica: un enlace roto en
    un correo ya mandado no se puede arreglar. Función pura, con test."""
    v = (valor or "").strip()
    if v.startswith(("https://", "http://")):
        return v
    if v.startswith("/") and " " not in v:
        return base.rstrip("/") + v
    return base.rstrip("/") + por_defecto


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


def _armar(alumno: dict, plantillas: dict, tipo: str, asunto: str, texto: str, *, enviar_a: str = "", preview: bool = True) -> dict:
    """Arma (y con preview=False, manda) el correo para un alumno ya leído."""
    from src.services.users.emails import ACADEMY_URL, send_recordatorio_alumno_email

    if tipo not in TIPOS:
        raise ValueError("Tipo de recordatorio desconocido")
    base = plantillas[tipo]
    nombre = (alumno.get("nombre") or "").split(" ")[0] or "alumno/a"
    dias = (alumno.get("estado") or {}).get("dias")
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
        victoria_url=url_enlace(plantillas["enlaces"]["victoria"], DE_FABRICA["enlaces"]["victoria"], ACADEMY_URL),
        consulta_url=url_enlace(plantillas["enlaces"]["consulta"], DE_FABRICA["enlaces"]["consulta"], ACADEMY_URL),
        botones=plantillas["botones"],
        preview=preview,
    )
    return {"para": enviar_a or alumno["email"], "asunto": asunto_final, "html": (r or {}).get("html", "") if preview else ""}


async def montar(
    org_id: int, user_id: int, tipo: str, asunto: str, texto: str, db_session: AsyncSession, *, enviar_a: str = "", preview: bool = True
) -> dict:
    """Arma el correo para ese alumno. Con preview=True solo lo devuelve;
    si no, lo manda a `enviar_a` (o al alumno si va vacío)."""
    if tipo not in TIPOS:
        raise ValueError("Tipo de recordatorio desconocido")
    alumno = await _alumno(org_id, user_id, db_session)
    plantillas = (await leer_plantillas(org_id, db_session))["plantillas"]
    return _armar(alumno, plantillas, tipo, asunto, texto, enviar_a=enviar_a, preview=preview)


async def _apuntar(user_id: int, tipo: str, asunto: str, quien: str, db_session: AsyncSession) -> None:
    from src.db.recordatorios import StudentReminder

    db_session.add(
        StudentReminder(
            user_id=user_id,
            tipo=tipo,
            asunto=(asunto or "")[:200],
            sent_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            sent_by=(quien or "")[:120],
        )
    )
    await db_session.commit()


async def enviar(
    org_id: int, user_id: int, tipo: str, asunto: str, texto: str, quien: str, db_session: AsyncSession, *, a_mi: str = ""
) -> dict:
    """Manda el recordatorio. Con `a_mi` (un correo del equipo) es una prueba:
    no se apunta como recordatorio a ese alumno."""
    r = await montar(org_id, user_id, tipo, asunto, texto, db_session, enviar_a=a_mi, preview=False)
    if not a_mi:
        await _apuntar(user_id, tipo, r["asunto"], quien, db_session)
    return {"ok": True, "para": r["para"], "asunto": r["asunto"], "prueba": bool(a_mi)}


# ── El automático: «1 semana sin entrar» ───────────────────────────────────
#
# Pedido del usuario (04/10/2026): que el correo de "esta semana no has
# entrado" salga solo, **solo a alumnos**, editable en Avisos y con un
# interruptor de activar/desactivar, **apagado de serie** ("todavía no lo
# actives: tengo que sacar de alumnos a gente que no lo es"). Lo lanza la
# tarea diaria del goteo (`/notifications/drip-diario`, 07:00 UTC) después de
# los avisos de módulo. Usa SIEMPRE la plantilla «semana», la misma que el
# manual: editarla en un sitio la cambia en los dos.

DIAS_AUTO = 7
TOPE_POR_DIA = 60  # por si algo se tuerce, nunca más que esto de una vez
AUTOR_AUTO = "Automático"


def toca_automatico(ultima_entrada: str, alta: str, ultimo_recordatorio: str, hoy, dias: int = DIAS_AUTO) -> bool:
    """¿Le toca hoy el recordatorio automático? Función pura, con test.

    - Cuenta desde la última vez que entró; si no ha entrado nunca, desde el
      alta.
    - Hace falta llevar `dias` o más.
    - Uno por racha de silencio: si ya se le recordó (a mano o solo) después
      de su última entrada, no se repite hasta que vuelva y se vuelva a ir.
    """
    from datetime import date as _date

    ref = (ultima_entrada or alta or "")[:10]
    if not ref:
        return False
    try:
        dia_ref = _date.fromisoformat(ref)
    except ValueError:
        return False
    if (hoy - dia_ref).days < dias:
        return False
    if ultimo_recordatorio and ultimo_recordatorio[:10] >= ref:
        return False
    return True


async def leer_auto(org_id: int, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    guardado = (fila.config or {}).get("recordatorio_auto") if fila and isinstance(fila.config, dict) else None
    g = guardado if isinstance(guardado, dict) else {}
    return {"activo": bool(g.get("activo")), "cambiado_en": g.get("cambiado_en", ""), "por": g.get("por", ""), "dias": DIAS_AUTO}


async def guardar_auto(org_id: int, activo: bool, quien: str, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config["recordatorio_auto"] = {
        "activo": bool(activo),
        "cambiado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "por": (quien or "")[:120],
    }
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_auto(org_id, db_session)


async def candidatos_auto(org_id: int, db_session: AsyncSession) -> list[dict]:
    """A quién le tocaría hoy. Ya sin Testers ni pruebas (`listar_alumnos`)."""
    from src.services.panel.alumnos import listar_alumnos

    hoy = datetime.now(timezone.utc).date()
    out = []
    for a in (await listar_alumnos(org_id, db_session))["alumnos"]:
        previo = (a.get("ultimo_recordatorio") or {}).get("sent_at", "")
        if toca_automatico(a.get("ultima_entrada", ""), a.get("alta", ""), previo, hoy):
            out.append(a)
    return out


async def recordatorio_automatico(org_id: int, db_session: AsyncSession) -> dict:
    """Lo que hace la tarea diaria. Apagado = no manda nada, solo dice a
    cuántos les habría tocado. No lanza: un alumno que falle no para al resto."""
    import logging

    estado = await leer_auto(org_id, db_session)
    candidatos = await candidatos_auto(org_id, db_session)
    if not estado["activo"]:
        return {"activo": False, "enviados": 0, "le_tocaria_a": len(candidatos)}
    plantillas = (await leer_plantillas(org_id, db_session))["plantillas"]
    enviados = 0
    for a in candidatos[:TOPE_POR_DIA]:
        try:
            r = _armar(a, plantillas, "semana", "", "", preview=False)
            await _apuntar(a["user_id"], "semana", r["asunto"], AUTOR_AUTO, db_session)
            enviados += 1
        except Exception:  # noqa: BLE001
            logging.getLogger(__name__).exception("Recordatorio automático: falló con el alumno %s", a.get("user_id"))
    return {"activo": True, "enviados": enviados, "candidatos": len(candidatos)}


ALUMNO_DE_EJEMPLO = {
    "user_id": 0,
    "nombre": "Lucía Fernández",
    "email": "",
    "estado": {"dias": 9},
    "seguir_uuid": "",
    "donde": {"modulo": "Módulo 2", "clase": "2.4 Lezen"},
    "siguiente": {"modulo": "Módulo 2", "clase": "2.4 Lezen"},
}


async def vista_auto(org_id: int, asunto: str, texto: str, db_session: AsyncSession, *, enviar_a: str = "") -> dict:
    """El correo automático con un alumno de ejemplo. Con `enviar_a`, se lo
    manda a esa dirección (prueba); si no, solo lo devuelve."""
    plantillas = (await leer_plantillas(org_id, db_session))["plantillas"]
    return _armar(dict(ALUMNO_DE_EJEMPLO, email=enviar_a or "ejemplo@ejemplo.com"), plantillas, "semana", asunto, texto, enviar_a=enviar_a, preview=not enviar_a)

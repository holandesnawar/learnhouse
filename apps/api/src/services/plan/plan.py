"""El plan de estudio de cada alumno: su objetivo y sus días (14/11/2026).

Pedido del usuario: «al igual que Duolingo, poder elegir que quieres dedicar x
tiempo, cuándo, para recordar al alumno a esa hora si no entró».

Qué guarda (columna `student_progress.plan`, JSON en texto, sin tabla nueva):

- `objetivo`: una SITUACIÓN de la lista `OBJETIVOS` (el médico, el trabajo…),
  no un nivel. Cada alumno tiene su nivel y su motivo, y por eso no se pregunta
  «qué nivel quieres»: se pregunta para qué lo quiere, que es lo que el profe
  puede usar. `objetivo_texto` es su frase, con sus palabras.
- `dias` (0 = lunes … 6 = domingo), `hora` («20:00», hora de Países Bajos) y
  `minutos`: cuándo se ha propuesto estudiar.
- `recordar`: si quiere que se le recuerde por correo.
- `avisos`: los días en que se le mandó el recordatorio (los últimos 10).

El objetivo es SEMANAL, no una racha diaria: «3 días esta semana» aguanta una
semana mala; una racha diaria se rompe el primer martes y la gente lo deja.

El recordatorio (`recordar_a_quien_toque`, lo llama una tarea cada hora):

- solo los días que eligió, pasada su hora (y como mucho `VENTANA_HORAS`
  después: si la tarea se retrasa no llega a medianoche);
- solo si HOY no ha entrado a la escuela;
- uno al día como mucho;
- se calla tras `MAX_IGNORADOS` seguidos sin que vuelva a entrar (al volver,
  se pone a cero);
- y solo si el administrador lo ha encendido (org_config
  `plan_estudio.recordatorios`, APAGADO de serie). Testers y pruebas, fuera.

Es correo, no una notificación en el móvil: la escuela no tiene service worker
(a propósito, ver CLAUDE.md → «Instalar la escuela como app»).
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig
from src.db.student_progress import StudentProgress, StudentVisitDay

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
VENTANA_HORAS = 3
MAX_IGNORADOS = 3
TOPE_POR_VEZ = 80

OBJETIVOS = [
    {"id": "trabajo", "nombre": "El trabajo", "ejemplo": "Hablar con mis compañeros y entender a mi jefe"},
    {"id": "medico", "nombre": "El médico y la farmacia", "ejemplo": "Pedir cita y explicar lo que me pasa"},
    {"id": "tramites", "nombre": "Trámites y cartas", "ejemplo": "Entender las cartas y llamar al ayuntamiento"},
    {"id": "colegio", "nombre": "El colegio de mis hijos", "ejemplo": "Hablar con la profe y entender los avisos"},
    {"id": "pareja", "nombre": "Mi pareja y su familia", "ejemplo": "Seguir la conversación en la mesa"},
    {"id": "dia", "nombre": "El día a día", "ejemplo": "El súper, los vecinos, pedir en un bar"},
    {"id": "examen", "nombre": "El examen de inburgering", "ejemplo": "Llegar preparado al examen"},
    {"id": "otro", "nombre": "Otra cosa", "ejemplo": ""},
]
_IDS = {o["id"] for o in OBJETIVOS}
MINUTOS = [10, 15, 20, 30, 45]
DIAS_TXT = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


# ── Lo puro (con test) ──────────────────────────────────────────────────────


def leer(crudo) -> dict:
    """Lo guardado, siempre con la misma forma. Vacío = aún no lo ha rellenado."""
    try:
        d = json.loads(crudo) if isinstance(crudo, str) and crudo.strip() else (crudo or {})
    except ValueError:
        d = {}
    if not isinstance(d, dict):
        d = {}
    return {
        "objetivo": d.get("objetivo") if d.get("objetivo") in _IDS else "",
        "objetivo_texto": str(d.get("objetivo_texto") or "")[:240],
        "dias": sorted({int(x) for x in (d.get("dias") or []) if str(x).isdigit() and 0 <= int(x) <= 6}),
        "hora": _hora(d.get("hora")),
        "minutos": d.get("minutos") if d.get("minutos") in MINUTOS else 15,
        "recordar": bool(d.get("recordar", True)),
        "guardado": str(d.get("guardado") or ""),
        "avisos": [str(x)[:10] for x in (d.get("avisos") or []) if x][-10:],
    }


def _hora(valor) -> str:
    try:
        h, m = str(valor or "").split(":")[:2]
        h, m = int(h), int(m)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    except ValueError:
        pass
    return "20:00"


def rellenado(plan: dict) -> bool:
    return bool(plan.get("objetivo") and plan.get("dias"))


def limpiar(datos: dict, antes: dict, ahora: datetime) -> dict:
    """Lo que manda la pantalla, validado. Lanza ValueError con el motivo."""
    objetivo = str(datos.get("objetivo") or "")
    if objetivo not in _IDS:
        raise ValueError("Elige para qué quieres el neerlandés")
    nuevo = leer({**datos, "objetivo": objetivo})
    if not nuevo["dias"]:
        raise ValueError("Elige al menos un día")
    if objetivo == "otro" and not nuevo["objetivo_texto"].strip():
        raise ValueError("Cuéntanos en una frase qué quieres conseguir")
    nuevo["objetivo_texto"] = nuevo["objetivo_texto"].strip()
    nuevo["guardado"] = ahora.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    nuevo["avisos"] = antes.get("avisos") or []
    return nuevo


def ignorados(avisos: list, ultima_visita: str) -> int:
    """Recordatorios mandados DESPUÉS de su última entrada: los que ignoró."""
    return sum(1 for a in avisos if a > (ultima_visita or ""))


def toca_recordar(plan: dict, ahora_nl: datetime, entro_hoy: bool, ultima_visita: str) -> bool:
    """¿Le toca ahora el recordatorio? `ahora_nl` en hora de Países Bajos."""
    if not rellenado(plan) or not plan.get("recordar"):
        return False
    if entro_hoy or ahora_nl.weekday() not in plan["dias"]:
        return False
    hoy = ahora_nl.date().isoformat()
    if hoy in plan["avisos"]:
        return False
    h, m = (int(x) for x in plan["hora"].split(":"))
    su_hora = ahora_nl.replace(hour=h, minute=m, second=0, microsecond=0)
    if not (su_hora <= ahora_nl < su_hora + timedelta(hours=VENTANA_HORAS)):
        return False
    return ignorados(plan["avisos"], ultima_visita) < MAX_IGNORADOS


def semana(plan: dict, dias_que_entro: list, hoy: date) -> dict:
    """Cómo va esta semana (lunes a domingo): días que entró de los que se propuso."""
    lunes = hoy - timedelta(days=hoy.weekday())
    esta = sorted({d for d in dias_que_entro if lunes.isoformat() <= d <= (lunes + timedelta(days=6)).isoformat()})
    meta = len(plan.get("dias") or [])
    hechos = len(esta)
    quedan = [d for d in (plan.get("dias") or []) if d >= hoy.weekday() and (lunes + timedelta(days=d)).isoformat() not in esta]
    return {
        "meta": meta,
        "hechos": hechos,
        "cumplida": bool(meta) and hechos >= meta,
        "dias": esta,
        "proximo": DIAS_TXT[quedan[0]] if quedan and hechos < meta else "",
        "hoy_toca": hoy.weekday() in (plan.get("dias") or []) and hoy.isoformat() not in esta,
    }


def nombre_objetivo(plan: dict) -> str:
    for o in OBJETIVOS:
        if o["id"] == plan.get("objetivo"):
            return plan.get("objetivo_texto") or o["nombre"] if o["id"] == "otro" else o["nombre"]
    return ""


def dias_en_texto(dias: list) -> str:
    n = [DIAS_TXT[d] for d in dias]
    return n[0] if len(n) == 1 else ", ".join(n[:-1]) + " y " + n[-1] if n else ""


# ── Base de datos ───────────────────────────────────────────────────────────


async def _fila(user_id: int, db_session: AsyncSession) -> StudentProgress:
    from src.services.student_progress.student_progress import _get_or_create

    return await _get_or_create(user_id, db_session)


async def _dias_de_la_semana(user_id: int, hoy: date, db_session: AsyncSession) -> list:
    lunes = (hoy - timedelta(days=hoy.weekday())).isoformat()
    return list(
        (
            await db_session.execute(
                select(StudentVisitDay.day).where(StudentVisitDay.user_id == user_id, StudentVisitDay.day >= lunes)
            )
        ).scalars()
    )


async def mi_plan(user_id: int, db_session: AsyncSession) -> dict:
    fila = await _fila(user_id, db_session)
    plan = leer(fila.plan)
    hoy = datetime.now(ZONA).date()
    dias = await _dias_de_la_semana(user_id, hoy, db_session)
    publico = {k: v for k, v in plan.items() if k != "avisos"}
    return {
        "plan": publico,
        "rellenado": rellenado(plan),
        "objetivo_nombre": nombre_objetivo(plan),
        "semana": semana(plan, dias, hoy),
        "opciones": {"objetivos": OBJETIVOS, "minutos": MINUTOS},
    }


async def guardar(user_id: int, datos: dict, db_session: AsyncSession) -> dict:
    fila = await _fila(user_id, db_session)
    fila.plan = json.dumps(limpiar(datos, leer(fila.plan), datetime.now(timezone.utc)), ensure_ascii=False)
    db_session.add(fila)
    await db_session.commit()
    return await mi_plan(user_id, db_session)


async def planes_de(user_ids: list, db_session: AsyncSession) -> dict:
    """{user_id: {objetivo, texto, dias}} para el panel (Progreso)."""
    if not user_ids:
        return {}
    out = {}
    for f in (await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(user_ids)))).scalars():
        p = leer(f.plan)
        if rellenado(p):
            out[f.user_id] = {
                "objetivo": nombre_objetivo(p),
                "texto": p["objetivo_texto"],
                "dias": dias_en_texto(p["dias"]),
                "hora": p["hora"],
                "minutos": p["minutos"],
            }
    return out


# ── El recordatorio ─────────────────────────────────────────────────────────


async def leer_ajuste(org_id: int, db_session: AsyncSession) -> dict:
    fila = (await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    g = (fila.config or {}).get("plan_estudio") if fila and isinstance(fila.config, dict) else None
    g = g if isinstance(g, dict) else {}
    return {"recordatorios": bool(g.get("recordatorios")), "por": g.get("por", ""), "cambiado_en": g.get("cambiado_en", "")}


async def guardar_ajuste(org_id: int, activo: bool, quien: str, db_session: AsyncSession) -> dict:
    fila = (await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config["plan_estudio"] = {
        "recordatorios": bool(activo),
        "por": (quien or "")[:120],
        "cambiado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_ajuste(org_id, db_session)


async def resumen_panel(org_id: int, db_session: AsyncSession) -> dict:
    """Para Avisos: el interruptor y cuántos alumnos tienen plan."""
    from src.services.panel.alumnos import listar_alumnos

    alumnos = (await listar_alumnos(org_id, db_session))["alumnos"]
    con = [a for a in alumnos if a.get("plan")]
    return {**await leer_ajuste(org_id, db_session), "alumnos": len(alumnos), "con_plan": len(con)}


def _correo(nombre: str, plan: dict, enlace: str) -> dict:
    return {
        "asunto": f"Tus {plan['minutos']} minutos de neerlandés de hoy",
        "html": (
            f"<p>Hoy es uno de los días que elegiste para estudiar, y te propusiste {plan['minutos']} minutos.</p>"
            "<p>No hace falta más: abre la escuela y sigue donde lo dejaste.</p>"
            "<p style=\"color:#6b7393;font-size:13px\">Recibes este recordatorio porque lo pediste al elegir tus días. "
            "Lo puedes cambiar o quitar en el Inicio de la escuela, en «Tu plan».</p>"
        ),
        "boton": "Seguir donde lo dejé",
        "enlace": enlace,
    }


async def recordar_a_quien_toque(org_id: int, db_session: AsyncSession, ahora: Optional[datetime] = None) -> dict:
    """Lo que hace la tarea de cada hora. Apagado, solo cuenta a quién le tocaría."""
    from src.services.panel.alumnos import listar_alumnos
    from src.services.users.emails import send_news_email

    ahora_nl = (ahora or datetime.now(timezone.utc)).astimezone(ZONA)
    hoy = ahora_nl.date().isoformat()
    activo = (await leer_ajuste(org_id, db_session))["recordatorios"]
    alumnos = (await listar_alumnos(org_id, db_session))["alumnos"]
    ids = [a["user_id"] for a in alumnos]
    filas = {
        f.user_id: f
        for f in (await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(ids)))).scalars()
    } if ids else {}
    hoy_entraron = set(
        (
            await db_session.execute(
                select(StudentVisitDay.user_id).where(StudentVisitDay.user_id.in_(ids), StudentVisitDay.day == hoy)
            )
        ).scalars()
    ) if ids else set()

    tocan = []
    for a in alumnos:
        f = filas.get(a["user_id"])
        if not f:
            continue
        plan = leer(f.plan)
        entro = a["user_id"] in hoy_entraron or (f.last_visit_date or "") == hoy
        if toca_recordar(plan, ahora_nl, entro, f.last_visit_date or ""):
            tocan.append((a, f, plan))
    if not activo:
        return {"activo": False, "enviados": 0, "le_tocaria_a": len(tocan)}

    from src.services.panel.recordatorio import _url_seguir

    enviados = 0
    for a, f, plan in tocan[:TOPE_POR_VEZ]:
        try:
            c = _correo(a["nombre"], plan, _url_seguir(a.get("seguir_uuid") or ""))
            # La marca ANTES de mandar: si la tarea se lanza dos veces, uno solo.
            plan["avisos"] = (plan["avisos"] + [hoy])[-10:]
            f.plan = json.dumps(plan, ensure_ascii=False)
            db_session.add(f)
            await db_session.commit()
            send_news_email(
                a["email"], name=(a["nombre"] or "").split(" ")[0] or "alumno/a", title=c["asunto"],
                body_html=c["html"], cta_label=c["boton"], cta_url=c["enlace"],
            )
            enviados += 1
        except Exception:  # noqa: BLE001
            logger.exception("Recordatorio del plan: falló con el alumno %s", a.get("user_id"))
    return {"activo": True, "enviados": enviados, "tocaban": len(tocan)}

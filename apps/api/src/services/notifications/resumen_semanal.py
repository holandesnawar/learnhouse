"""
El resumen semanal por correo al alumno (23/11/2026).

Pedido del usuario: «resumen semanal también». La plantilla
(`send_weekly_digest_email`) existía desde agosto y nadie la llamaba. El
motivo de fondo: los alumnos se quedan en el módulo 1 y solo atienden a las
clases en directo. El resumen les lleva de vuelta a la formación **sin meter
presión**: dice qué tienen esta semana y a qué clase les toca volver, con un
botón directo a esa clase.

Qué lleva (personal, y solo con datos de verdad; lo que no tiene nada, no sale)
------------------------------------------------------------------------------
1. **Sus clases en directo de esta semana** (lunes a domingo, hora de Países
   Bajos): las sesiones YA CREADAS de cada clase que ve (sus grupos, como
   `alumnos_del_curso`), con el día, la hora del recuadro de la clase y el tema
   si lo tiene. En el Spreek Club se dice «sesión» (`palabra`). Si esa semana va
   a la clase del otro grupo (`cambio_semana`), sale esa.
2. **Su formación**: cuántas clases terminó la semana pasada, cuántas lleva y
   **la que le toca** (la que dejó a medias o la primera que le falta:
   `clase_para_seguir`), con el botón grande. Si ya la terminó entera, esta
   parte no sale.
3. **Su tarea** pendiente (abierta, con plazo y sin entregar) y sus
   **correcciones sin ver**.
4. **La lectura de la semana**, si hay una publicada.

A quién (`motivo_de_no`, pura)
------------------------------
Alumnos (rol 4) de la escuela, sin Testers ni quien está fuera de los números
(es la lista de Progreso, `listar_alumnos`). NO se le manda a quien:
- se dio de baja de este resumen (enlace al pie de cada uno);
- ya lo recibió esta semana (la tarea se puede lanzar dos veces);
- no tiene correo;
- terminó su camino (más de 16 semanas desde que entró) y lleva más de 30 días
  sin entrar: ya se fue, y un correo cada lunes sería ruido;
- no tiene nada propio que contarle (ni clase esta semana, ni formación por
  hacer, ni tarea, ni corrección): la lectura sola no basta para escribirle.

Cuándo
------
Los lunes por la mañana (`.github/workflows/resumen-semanal.yaml` →
`POST /notifications/resumen-semanal`, con el secreto del cron). **Apagado de
serie** (org_config `resumen_semanal.activo`; se enciende en Correos y avisos →
«Resumen semanal»): apagado, la tarea solo dice a cuántos les tocaría.

Dónde se guarda (sin tabla ni columna nueva)
--------------------------------------------
En `student_reminder`, con dos tipos propios:
- `resumen`: una fila por resumen enviado (la marca de «ya lo tiene esta
  semana», escrita ANTES de mandar y borrada si el envío falla);
- `resumen-baja`: una fila = esa persona no quiere el resumen. Volver a
  apuntarse la borra.
La lista de Progreso NO cuenta estas filas como «le recordaste hace X»
(`alumnos.py` las aparta): el resumen no es un recordatorio del equipo.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig
from src.services.email.utils import en_hilo

logger = logging.getLogger(__name__)

ZONA = ZoneInfo("Europe/Amsterdam")
CLAVE = "resumen_semanal"
TIPO = "resumen"
TIPO_BAJA = "resumen-baja"
#: Los tipos de `student_reminder` que son de este resumen (no recordatorios del equipo).
TIPOS_PROPIOS = (TIPO, TIPO_BAJA)
AUTOR = "Automático"
#: Cuántos se mandan en cada llamada: la tarea del lunes llama varias veces
#: hasta que no queda ninguno (una llamada larga la cortaría la puerta de nginx).
TOPE_POR_VEZ = 60
DIAS_CAMINO = 112  # 16 semanas
DIAS_SIN_ENTRAR = 30
DIAS_ENLACE_BAJA = 365

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

MOTIVOS = {
    "baja": "Se dio de baja del resumen",
    "enviado": "Ya lo ha recibido esta semana",
    "sin-correo": "No tiene correo",
    "se-fue": "Terminó su camino y lleva más de un mes sin entrar",
    "nada": "No tiene nada nuevo que contarle esta semana",
}


# ── Lo puro (con test) ─────────────────────────────────────────────────────


def lunes_de(dia: date) -> date:
    return dia - timedelta(days=dia.weekday())


def hora_de(texto: Any) -> str:
    """La hora de un texto libre («19:00 (CET)», «a las 9.30 h») o ""."""
    m = re.search(r"\b([01]?\d|2[0-3])\s*[:.h]\s*([0-5]\d)\b", str(texto or ""))
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""


def palabra(nombre_curso: Any) -> str:
    """«sesión» en las clases de conversación (Spreek Club), «clase» en las demás.
    La misma regla que `tipoDeClase` / `textosDeClase` en la pantalla."""
    n = str(nombre_curso or "").lower()
    return "sesión" if re.search(r"spreek|spreken|conversaci", n) else "clase"


def dia_corto(fecha: str) -> str:
    """«jueves 26 nov»."""
    try:
        d = date.fromisoformat(str(fecha or "")[:10])
    except ValueError:
        return str(fecha or "")
    return f"{DIAS[d.weekday()]} {d.day} {MESES[d.month - 1]}"


def cuando_cae(fecha: str, hoy: date) -> str:
    """«hoy», «mañana» o «el jueves 26 nov»."""
    try:
        d = date.fromisoformat(str(fecha or "")[:10])
    except ValueError:
        return str(fecha or "")
    if d == hoy:
        return "hoy"
    if d == hoy + timedelta(days=1):
        return "mañana"
    return f"el {dia_corto(fecha)}"


def texto_formacion(hechas_semana: int, hechas: int, total: int) -> str:
    """La frase de la formación. Sin reñir a nadie: quien no avanzó lee que
    retomar es poco rato, no que va mal."""
    if hechas <= 0:
        return "Todavía no has empezado la formación. La primera clase son unos minutos."
    lleva = f"Llevas {hechas} de {total}." if total else ""
    if hechas_semana > 0:
        clases = "1 clase" if hechas_semana == 1 else f"{hechas_semana} clases"
        return f"La semana pasada terminaste {clases}. {lleva}".strip()
    return f"La semana pasada no avanzaste en la formación. No pasa nada: con un cuarto de hora retomas el hilo. {lleva}".strip()


def formacion_de(alumno: dict, hechas_semana: int, url: str) -> Optional[dict]:
    """La parte de la formación de un alumno de `listar_alumnos`, o None si no
    le queda nada por hacer (o no hay formación)."""
    total = int(alumno.get("total") or 0)
    hechas = int(alumno.get("hechas") or 0)
    siguiente = alumno.get("siguiente")
    if not total or not siguiente:
        return None
    # A qué clase lleva el botón: la que dejó a medias o la primera que le falta.
    donde = alumno.get("donde") or {}
    seguir = alumno.get("seguir_uuid") or ""
    if seguir and donde.get("uuid") == seguir and donde.get("como") == "abrio":
        toca = {"modulo": donde.get("modulo", ""), "clase": donde.get("clase", ""), "a_medias": True}
    else:
        toca = {"modulo": siguiente.get("modulo", ""), "clase": siguiente.get("clase", ""), "a_medias": False}
    return {
        "hechas_semana": max(0, int(hechas_semana or 0)),
        "hechas": hechas,
        "total": total,
        "pct": int(alumno.get("pct") or 0),
        "texto": texto_formacion(hechas_semana, hechas, total),
        "toca": toca,
        "url": url,
    }


def armar(
    nombre: str,
    *,
    clases: Iterable[dict] = (),
    formacion: Optional[dict] = None,
    tareas: Iterable[dict] = (),
    corregidas: Iterable[dict] = (),
    lectura: Optional[dict] = None,
) -> dict:
    """El resumen de un alumno, con sus partes ya ordenadas. `partes` dice
    cuáles lleva (para el panel)."""
    clases = sorted((c for c in clases if c.get("fecha")), key=lambda c: (c["fecha"], c.get("hora") or "", c.get("curso") or ""))
    tareas = list(tareas)
    corregidas = list(corregidas)
    partes = []
    if clases:
        partes.append("clase")
    if formacion:
        partes.append("formación")
    if tareas:
        partes.append("tarea")
    if corregidas:
        partes.append("corrección")
    if lectura:
        partes.append("lectura")
    return {
        "nombre": (nombre or "").strip().split(" ")[0] or "alumno/a",
        "clases": clases,
        "formacion": formacion,
        "tareas": tareas,
        "corregidas": corregidas,
        "lectura": lectura,
        "partes": partes,
    }


def tiene_algo_propio(resumen: dict) -> bool:
    """¿Hay algo SUYO que contarle? La lectura es la misma para todos: sola no basta."""
    return bool(resumen.get("clases") or resumen.get("formacion") or resumen.get("tareas") or resumen.get("corregidas"))


def motivo_de_no(
    resumen: dict,
    *,
    email: str,
    baja: bool,
    enviado_esta_semana: bool,
    alta: str,
    ultima_entrada: str,
    hoy: date,
) -> str:
    """Por qué NO se le manda esta semana («» = se le manda). Ver la cabecera."""
    if baja:
        return "baja"
    if enviado_esta_semana:
        return "enviado"
    if not (email or "").strip():
        return "sin-correo"
    if _dias_desde(alta, hoy) > DIAS_CAMINO:
        sin_entrar = _dias_desde(ultima_entrada, hoy) if ultima_entrada else 10**6
        if sin_entrar > DIAS_SIN_ENTRAR:
            return "se-fue"
    if not tiene_algo_propio(resumen):
        return "nada"
    return ""


def _dias_desde(fecha: str, hoy: date) -> int:
    try:
        return (hoy - date.fromisoformat(str(fecha or "")[:10])).days
    except ValueError:
        return 0


def inicio_de_semana_utc(ahora: datetime) -> str:
    """El lunes a las 00:00 de Países Bajos, en UTC y con la forma de
    `student_reminder.sent_at` (para comparar como texto)."""
    local = ahora.astimezone(ZONA)
    lunes = datetime.combine(lunes_de(local.date()), datetime.min.time(), tzinfo=ZONA)
    return lunes.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def proximo_lunes(hoy: date) -> date:
    """El lunes en que sale el próximo (hoy, si hoy es lunes)."""
    return hoy if hoy.weekday() == 0 else lunes_de(hoy) + timedelta(days=7)


# ── El enlace de baja ──────────────────────────────────────────────────────


def _secreto() -> str:
    from config.config import get_learnhouse_config

    return get_learnhouse_config().security_config.auth_jwt_secret_key or ""


def enlace_baja(user_id: int) -> str:
    from src.services.payments.enlace import firmar
    from src.services.users.emails import _school_url

    token = firmar({"u": int(user_id), "t": TIPO_BAJA}, _secreto(), dias=DIAS_ENLACE_BAJA)
    return f"{_school_url().rstrip('/')}/api/v1/notifications/resumen-semanal/baja/{token}"


def leer_token(token: str) -> int:
    """El alumno de un enlace de baja bueno, o 0."""
    from src.services.payments.enlace import verificar

    datos = verificar(token or "", _secreto()) or {}
    if datos.get("t") != TIPO_BAJA:
        return 0
    try:
        return int(datos.get("u") or 0)
    except (TypeError, ValueError):
        return 0


async def esta_de_baja(user_id: int, db_session: AsyncSession) -> bool:
    from src.db.recordatorios import StudentReminder

    return bool(
        (
            await db_session.execute(
                select(StudentReminder.id).where(StudentReminder.user_id == user_id, StudentReminder.tipo == TIPO_BAJA)
            )
        ).first()
    )


async def dar_de_baja(user_id: int, db_session: AsyncSession, por: str = "Desde su correo") -> None:
    from src.db.recordatorios import StudentReminder

    if await esta_de_baja(user_id, db_session):
        return
    db_session.add(
        StudentReminder(user_id=user_id, tipo=TIPO_BAJA, asunto="No quiere el resumen semanal", sent_at=_ahora_txt(), sent_by=(por or "")[:120])
    )
    await db_session.commit()


async def volver_a_apuntar(user_id: int, db_session: AsyncSession) -> None:
    from sqlalchemy import delete

    from src.db.recordatorios import StudentReminder

    await db_session.execute(delete(StudentReminder).where(StudentReminder.user_id == user_id, StudentReminder.tipo == TIPO_BAJA))  # type: ignore[arg-type]
    await db_session.commit()


async def es_alumno_de(org_id: int, user_id: int, db_session: AsyncSession) -> bool:
    from src.db.user_organizations import UserOrganization

    return bool(
        (
            await db_session.execute(
                select(UserOrganization.id).where(
                    UserOrganization.org_id == org_id, UserOrganization.user_id == user_id, UserOrganization.role_id == 4
                )
            )
        ).first()
    )


def _ahora_txt(ahora: Optional[datetime] = None) -> str:
    return (ahora or datetime.now(timezone.utc)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── El interruptor ─────────────────────────────────────────────────────────


async def leer_ajuste(org_id: int, db_session: AsyncSession) -> dict:
    fila = (await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    g = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    g = g if isinstance(g, dict) else {}
    return {"activo": bool(g.get("activo")), "cambiado_en": str(g.get("cambiado_en") or ""), "por": str(g.get("por") or "")}


async def guardar_ajuste(org_id: int, activo: bool, quien: str, db_session: AsyncSession) -> dict:
    fila = (await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = {"activo": bool(activo), "cambiado_en": _ahora_txt(), "por": (quien or "")[:120]}
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_ajuste(org_id, db_session)


# ── Reunir lo de cada alumno ───────────────────────────────────────────────


def _recuadro(config: Any, course_uuid: str) -> dict:
    """El recuadro de una clase (día, hora, profe). La clase semanal de siempre
    puede tener aún el viejo, de toda la escuela."""
    from src.services.tareas import tareas as T

    propio = T._ajustes_sala(config, course_uuid).get("banner")
    if isinstance(propio, dict) and propio:
        return propio
    if T.uuid_curso(course_uuid) == T.CLASE_SEMANAL_UUID and isinstance(config, dict):
        viejo = config.get("weekly_class_banner")
        return viejo if isinstance(viejo, dict) else {}
    return {}


async def _clases_de_la_semana(org_id: int, lunes: date, hoy: str, db_session: AsyncSession) -> tuple[dict[int, list[dict]], dict[int, list[dict]]]:
    """({alumno: sus clases en directo de esta semana}, {alumno: sus tareas
    pendientes}). Las tareas son de las clases que ve, abiertas y con plazo."""
    from src.db.tareas import TareaEntrega, TareaSemana
    from src.services.tareas import tareas as T
    from src.services.tareas.cambio_semana import leer_cambios
    from src.services.users.emails import ACADEMY_URL

    domingo = (lunes + timedelta(days=6)).isoformat()
    config = await T._config(org_id, db_session)
    todas = list((await db_session.execute(select(TareaSemana).where(TareaSemana.org_id == org_id))).scalars().all())
    por_id = {s.id: s for s in todas}
    por_curso: dict[str, list] = {}
    for s in todas:
        por_curso.setdefault(T.uuid_curso(s.course_uuid), []).append(s)

    cursos: dict[str, Any] = {}
    alumnos_de: dict[str, list[dict]] = {}
    for u in por_curso:
        c = await T.curso_de(u, db_session)
        if c is None or c.org_id != org_id or not c.published:
            continue
        cursos[u] = c
        alumnos_de[u] = await T.alumnos_del_curso(org_id, c, db_session)

    def ficha(s, curso) -> dict:
        u = T.uuid_curso(curso.course_uuid)
        return {
            "curso": curso.name,
            "palabra": palabra(curso.name),
            "fecha": s.fecha,
            "hora": hora_de(_recuadro(config, curso.course_uuid).get("schedule")),
            "tema": (s.tema or "").strip(),
            "url": f"{ACADEMY_URL}/course/{u}",
        }

    clases: dict[int, list[dict]] = {}
    tareas: dict[int, list[dict]] = {}
    pendientes_de: list[tuple[Any, str]] = []
    for u, curso in cursos.items():
        ids = [a["user_id"] for a in alumnos_de[u]]
        entro = {a["user_id"]: (a.get("entro") or "")[:10] for a in alumnos_de[u]}
        for s in por_curso[u]:
            if not s.fecha:
                continue
            # 1) La clase de esta semana que aún no ha pasado (o la del otro
            #    grupo, si va a esa).
            if max(lunes.isoformat(), hoy) <= s.fecha <= domingo:
                cambios = leer_cambios(getattr(s, "cambios", ""))
                for uid in ids:
                    destino = por_id.get((cambios.get(str(uid)) or {}).get("destino"))
                    otro = cursos.get(T.uuid_curso(destino.course_uuid)) if destino is not None else None
                    clases.setdefault(uid, []).append(ficha(destino, otro) if destino is not None and otro is not None else ficha(s, curso))
            # 2) La tarea abierta y con plazo que aún no ha entregado.
            limite = T.limite_de(s.fecha, s.fecha_limite)
            if (s.enunciado or "").strip() and T.abierta(s.fecha, hoy) and limite and limite[:10] >= hoy:
                pendientes_de.append((s, u))
                for uid in ids:
                    if entro.get(uid) and limite[:10] < entro[uid]:
                        continue
                    tareas.setdefault(uid, []).append(
                        {"tarea_id": s.id, "tema": (s.tema or "").strip(), "hasta": dia_corto(limite), "url": f"{ACADEMY_URL}/tarea/{s.id}"}
                    )
    # Fuera las que ya entregó.
    if pendientes_de:
        ids_tareas = [s.id for s, _ in pendientes_de]
        entregadas = {
            (int(t), int(u))
            for t, u in (
                await db_session.execute(select(TareaEntrega.tarea_id, TareaEntrega.user_id).where(TareaEntrega.tarea_id.in_(ids_tareas)))  # type: ignore[attr-defined]
            ).all()
        }
        for uid in list(tareas):
            tareas[uid] = [t for t in tareas[uid] if (t["tarea_id"], uid) not in entregadas]
            if not tareas[uid]:
                del tareas[uid]
    return clases, tareas


async def _terminadas_la_semana_pasada(ids: list[int], lunes: date, db_session: AsyncSession) -> dict[int, int]:
    """Cuántas clases de la formación terminó cada uno de lunes a domingo de
    la semana pasada (una clase cuenta el día en que la terminó por primera vez)."""
    from src.db.trail_steps import TrailStep
    from src.services.panel.avance import _curso_formacion, clases_en_orden

    curso = await _curso_formacion(db_session)
    if not ids or curso is None or not curso.id:
        return {}
    validas = {c["id"] for c in await clases_en_orden(db_session, curso.id)}
    desde, hasta = (lunes - timedelta(days=7)).isoformat(), lunes.isoformat()
    primera: dict[tuple[int, int], str] = {}
    for uid, aid, fecha in (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.activity_id, TrailStep.creation_date).where(
                TrailStep.course_id == curso.id,
                TrailStep.complete == True,  # noqa: E712
                TrailStep.user_id.in_(ids),  # type: ignore[attr-defined]
            )
        )
    ).all():
        if int(aid) not in validas:
            continue
        f = str(fecha or "")[:10]
        clave = (int(uid), int(aid))
        if clave not in primera or (f and f < primera[clave]):
            primera[clave] = f
    out: dict[int, int] = {}
    for (uid, _aid), f in primera.items():
        if f and desde <= f < hasta:
            out[uid] = out.get(uid, 0) + 1
    return out


async def _corregidas_sin_ver(ids: list[int], db_session: AsyncSession) -> dict[int, list[dict]]:
    from src.db.tareas import TareaEntrega, TareaSemana
    from src.services.tareas.tareas import DIAS_AVISO
    from src.services.users.emails import ACADEMY_URL

    if not ids:
        return {}
    desde = (datetime.now(timezone.utc) - timedelta(days=DIAS_AVISO)).isoformat()
    out: dict[int, list[dict]] = {}
    for e, t in (
        await db_session.execute(
            select(TareaEntrega, TareaSemana)
            .join(TareaSemana, TareaSemana.id == TareaEntrega.tarea_id)
            .where(
                TareaEntrega.user_id.in_(ids),  # type: ignore[attr-defined]
                TareaEntrega.estado == "corregida",
                TareaEntrega.vista_at == "",
                TareaEntrega.corregida_at >= desde,
            )
        )
    ).all():
        out.setdefault(int(e.user_id), []).append(
            {"tarea_id": t.id, "tema": (t.tema or "").strip(), "por": (e.corregida_por or "").strip(), "url": f"{ACADEMY_URL}/tarea/{t.id}"}
        )
    return out


async def _lectura(org_id: int, hoy: date, db_session: AsyncSession) -> Optional[dict]:
    from src.services.lecturas import lecturas as L
    from src.services.users.emails import ACADEMY_URL

    try:
        actual = L.partir(await L.todas(org_id, db_session), hoy, False).get("actual")
    except Exception:  # noqa: BLE001 — un extra: sin ella, el resumen sale igual
        return None
    if not actual or not (actual.get("titulo") or "").strip():
        return None
    # Solo la de ESTA semana: una lectura de hace un mes no es noticia.
    if str(actual.get("semana") or "") < lunes_de(hoy).isoformat():
        return None
    return {"titulo": actual["titulo"].strip(), "url": f"{ACADEMY_URL}/recursos?ver=lecturas"}


async def reunir(org_id: int, db_session: AsyncSession, ahora: Optional[datetime] = None) -> list[dict]:
    """Cada alumno de la escuela con su resumen de esta semana y, si no le
    toca, por qué: [{alumno, resumen, motivo}]."""
    from src.db.recordatorios import StudentReminder
    from src.services.panel.alumnos import listar_alumnos
    from src.services.panel.recordatorio import _url_seguir

    ahora = ahora or datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZONA).date()
    lunes = lunes_de(hoy)
    alumnos = (await listar_alumnos(org_id, db_session))["alumnos"]
    ids = [a["user_id"] for a in alumnos]
    if not ids:
        return []

    corte = inicio_de_semana_utc(ahora)
    bajas: set[int] = set()
    enviados: set[int] = set()
    for uid, tipo, cuando in (
        await db_session.execute(
            select(StudentReminder.user_id, StudentReminder.tipo, StudentReminder.sent_at).where(
                StudentReminder.user_id.in_(ids), StudentReminder.tipo.in_(TIPOS_PROPIOS)  # type: ignore[attr-defined]
            )
        )
    ).all():
        if tipo == TIPO_BAJA:
            bajas.add(int(uid))
        elif (cuando or "") >= corte:
            enviados.add(int(uid))

    clases, tareas = await _clases_de_la_semana(org_id, lunes, hoy.isoformat(), db_session)
    hechas_semana = await _terminadas_la_semana_pasada(ids, lunes, db_session)
    corregidas = await _corregidas_sin_ver(ids, db_session)
    lectura = await _lectura(org_id, hoy, db_session)

    salida = []
    for a in alumnos:
        uid = a["user_id"]
        resumen = armar(
            a.get("nombre") or "",
            clases=clases.get(uid, []),
            formacion=formacion_de(a, hechas_semana.get(uid, 0), _url_seguir(a.get("seguir_uuid") or "")),
            tareas=tareas.get(uid, []),
            corregidas=corregidas.get(uid, []),
            lectura=lectura,
        )
        motivo = motivo_de_no(
            resumen,
            email=a.get("email") or "",
            baja=uid in bajas,
            enviado_esta_semana=uid in enviados,
            alta=a.get("alta") or "",
            ultima_entrada=a.get("ultima_entrada") or "",
            hoy=hoy,
        )
        salida.append({"alumno": a, "resumen": resumen, "motivo": motivo})
    return salida


# ── Mandar ─────────────────────────────────────────────────────────────────


def _mandar(email: str, resumen: dict, baja_url: str, hoy: date, preview: bool = False):
    from src.services.users.emails import send_weekly_digest_email

    return send_weekly_digest_email(email, resumen.get("nombre") or "alumno/a", resumen=resumen, baja_url=baja_url, hoy=hoy, preview=preview)


async def enviar_semana(org_id: int, db_session: AsyncSession, ahora: Optional[datetime] = None) -> dict:
    """Lo que hace la tarea del lunes. Apagado, no manda nada y solo dice a
    cuántos les tocaría. Solo cifras: el registro de GitHub es público."""
    from sqlalchemy import delete

    from src.db.recordatorios import StudentReminder
    from src.services.email.textos import usar_textos
    from src.services.orgs.orgs import get_org_email_texts

    ahora = ahora or datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZONA).date()
    estado = await leer_ajuste(org_id, db_session)
    todos = await reunir(org_id, db_session, ahora)
    tocan = [x for x in todos if not x["motivo"]]
    if not estado["activo"]:
        return {"activo": False, "enviados": 0, "le_tocaria_a": len(tocan), "quedan": 0}

    textos = await get_org_email_texts(org_id, db_session)
    enviados = fallos = 0
    for x in tocan[:TOPE_POR_VEZ]:
        a = x["alumno"]
        # La marca ANTES de mandar: si la tarea se lanza dos veces, uno solo.
        marca = StudentReminder(user_id=a["user_id"], tipo=TIPO, asunto="Resumen semanal", sent_at=_ahora_txt(ahora), sent_by=AUTOR)
        db_session.add(marca)
        await db_session.commit()
        await db_session.refresh(marca)
        try:
            with usar_textos(textos):
                await en_hilo(_mandar, a["email"], x["resumen"], enlace_baja(a["user_id"]), hoy)
            enviados += 1
        except Exception:  # noqa: BLE001 — uno que falle no para al resto
            fallos += 1
            logger.exception("Resumen semanal: falló con el alumno %s", a.get("user_id"))
            # Se quita la marca para que el segundo intento del lunes lo repita.
            try:
                await db_session.execute(delete(StudentReminder).where(StudentReminder.id == marca.id))  # type: ignore[arg-type]
                await db_session.commit()
            except Exception:  # noqa: BLE001
                await db_session.rollback()
    # `quedan`: los que no han entrado en esta tanda (los que fallaron no
    # cuentan: se reintentan en la segunda vuelta del lunes, no en bucle).
    return {"activo": True, "enviados": enviados, "fallos": fallos, "quedan": max(0, len(tocan) - TOPE_POR_VEZ)}


# ── Para el panel ──────────────────────────────────────────────────────────


RESUMEN_DE_EJEMPLO = {
    "nombre": "Lucía",
    "clases": [
        {"curso": "Conversatieles", "palabra": "clase", "fecha": "", "hora": "19:00", "tema": "Mijn huis", "url": ""},
    ],
    "formacion": {
        "hechas_semana": 3,
        "hechas": 27,
        "total": 240,
        "pct": 11,
        "texto": texto_formacion(3, 27, 240),
        "toca": {"modulo": "MODULE 1 - Over jou", "clase": "4.3 Oefeningen", "a_medias": False},
        "url": "",
    },
    "tareas": [],
    "corregidas": [{"tarea_id": 0, "tema": "Mijn dag", "por": "Luna", "url": ""}],
    "lectura": {"titulo": "Sinterklaas komt naar Nederland", "url": ""},
    "partes": ["clase", "formación", "corrección", "lectura"],
}


def resumen_de_ejemplo(hoy: Optional[date] = None) -> dict:
    """Un resumen creíble para el catálogo y la vista previa sin alumnos."""
    from src.services.users.emails import ACADEMY_URL, RUTA_FORMACION_URL

    hoy = hoy or datetime.now(ZONA).date()
    r = json.loads(json.dumps(RESUMEN_DE_EJEMPLO))
    r["clases"][0]["fecha"] = (lunes_de(hoy) + timedelta(days=3)).isoformat()
    r["clases"][0]["url"] = ACADEMY_URL
    r["formacion"]["url"] = RUTA_FORMACION_URL
    r["corregidas"][0]["url"] = ACADEMY_URL
    r["lectura"]["url"] = f"{ACADEMY_URL}/recursos?ver=lecturas"
    return r


async def estado_panel(org_id: int, db_session: AsyncSession, ahora: Optional[datetime] = None) -> dict:
    """El interruptor, cuándo sale el próximo y a quién le saldría (con qué
    partes) y a quién no (y por qué)."""
    ahora = ahora or datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZONA).date()
    todos = await reunir(org_id, db_session, ahora)

    def linea(x: dict) -> dict:
        a = x["alumno"]
        return {"user_id": a["user_id"], "nombre": a["nombre"], "email": a["email"], "partes": x["resumen"]["partes"]}

    return {
        **(await leer_ajuste(org_id, db_session)),
        "proximo": proximo_lunes(hoy).isoformat(),
        "le_tocaria": [linea(x) for x in todos if not x["motivo"]],
        "no_les_toca": [{**linea(x), "motivo": x["motivo"], "motivo_texto": MOTIVOS.get(x["motivo"], x["motivo"])} for x in todos if x["motivo"]],
        "alumnos": len(todos),
    }


async def vista(org_id: int, user_id: Optional[int], db_session: AsyncSession, *, enviar_a: str = "") -> dict:
    """El resumen de ese alumno tal cual le llegaría (o el de ejemplo, sin
    `user_id`). Con `enviar_a`, se manda a esa dirección: es una prueba, no se
    apunta, y su «No quiero recibir este resumen» lleva a la escuela (no da de
    baja a nadie)."""
    from src.services.email.textos import usar_textos
    from src.services.orgs.orgs import get_org_email_texts
    from src.services.users.emails import ACADEMY_URL

    ahora = datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZONA).date()
    resumen = None
    motivo = ""
    if user_id:
        for x in await reunir(org_id, db_session, ahora):
            if x["alumno"]["user_id"] == int(user_id):
                resumen, motivo = x["resumen"], x["motivo"]
                break
        if resumen is None:
            raise LookupError("Ese alumno no está en la escuela (o está fuera de los números)")
    else:
        resumen = resumen_de_ejemplo(hoy)
    textos = await get_org_email_texts(org_id, db_session)
    with usar_textos(textos):
        if enviar_a:
            await en_hilo(_mandar, enviar_a, resumen, ACADEMY_URL, hoy)
            html = ""
            asunto = ""
        else:
            r = _mandar("ejemplo@ejemplo.com", resumen, ACADEMY_URL, hoy, preview=True) or {}
            html, asunto = r.get("html", ""), r.get("subject", "")
    return {
        "asunto": asunto,
        "html": html,
        "para": enviar_a,
        "partes": resumen["partes"],
        "motivo": motivo,
        "motivo_texto": MOTIVOS.get(motivo, ""),
        "vacio": not tiene_algo_propio(resumen),
    }

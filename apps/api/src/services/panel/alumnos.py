"""
Progreso de los alumnos, uno por uno: dónde se quedó y cuándo entró por última
vez. Es la pantalla Panel → Alumnos → Progreso.

Pedido del usuario (04/10/2026): "tengo que ver en qué lección se quedó cada
persona la última vez que entró, y qué día entró por última vez".

De dónde sale cada cosa (todo ya se guardaba, solo faltaba juntarlo):

- **Dónde se quedó**: lo más reciente de dos pistas.
  - `student_progress.current_position`: la ÚLTIMA clase que ABRIÓ, con hora.
    La escribe el visor de lecciones al entrar en cualquier lección de
    holandés. Es la buena para "se quedó en", porque cuenta aunque no la
    terminara.
  - La última clase que TERMINÓ (`trail_step`). Cubre lo que el visor no ve
    (vídeos, textos del editor).
- **Cuándo entró**: lo más reciente de la visita diaria
  (`student_progress.last_visit_date` y `student_visit_day`), la posición y la
  última clase terminada. Con hora solo si la pista más reciente la trae.
- **Avance**: clases hechas de la formación (ver `avance.py`).

Solo alumnos (rol 4) y sin los que están fuera de los números (pruebas).
"""

from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.recordatorios import StudentReminder
from src.db.student_progress import StudentProgress, StudentVisitDay
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.panel.avance import _curso_formacion, clases_en_orden, resumir_avance

STUDENT_ROLE_ID = 4


def _iso(valor) -> str:
    """Fecha u hora a ISO en UTC ("2026-10-03T14:22:11Z"), o "" si no se lee.

    Las de `trail_step` vienen sin zona ("2026-10-03 14:22:11.1234"): el
    servidor corre en UTC, así que se les pone la Z. Las de la posición ya
    vienen del navegador en UTC ("…T12:34:56.789Z").
    """
    texto = str(valor or "").strip()
    if not texto:
        return ""
    if len(texto) == 10:  # solo el día
        return texto
    texto = texto.replace(" ", "T")
    try:
        dt = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _clave(iso: str) -> str:
    """Para comparar un día suelto con una hora: el día cuenta como su final."""
    return iso + "T23:59:59Z" if len(iso) == 10 else iso


def _sin_prefijo(uuid: str) -> str:
    return (uuid or "").replace("activity_", "")


def donde_y_cuando(
    posicion: dict,
    ultima_terminada: Optional[dict],
    dias_de_visita: list[str],
    clases_por_uuid: dict[str, dict],
) -> dict:
    """Dónde se quedó y cuándo entró por última vez. Función pura, con test.

    `ultima_terminada`: `{modulo, clase, fecha}` de la última clase terminada.
    `dias_de_visita`: días "YYYY-MM-DD" en que entró.
    """
    candidatos: list[dict] = []

    pos_cuando = _iso((posicion or {}).get("updated_at"))
    if posicion and pos_cuando:
        clase = clases_por_uuid.get(_sin_prefijo(str(posicion.get("activity_uuid") or "")))
        if clase:
            candidatos.append(
                {"modulo": clase["modulo"], "clase": clase["clase"], "cuando": pos_cuando, "como": "abrio", "uuid": clase.get("uuid", "")}
            )
        elif posicion.get("lesson_title"):
            # Lección abierta en la app de ejercicios (repaso), fuera del curso.
            candidatos.append(
                {"modulo": "App de ejercicios", "clase": str(posicion["lesson_title"]), "cuando": pos_cuando, "como": "repaso"}
            )

    if ultima_terminada and ultima_terminada.get("fecha"):
        candidatos.append(
            {
                "modulo": ultima_terminada.get("modulo", ""),
                "clase": ultima_terminada.get("clase", ""),
                "cuando": _iso(ultima_terminada["fecha"]),
                "como": "termino",
                "uuid": ultima_terminada.get("uuid", ""),
            }
        )

    donde = max(candidatos, key=lambda c: _clave(c["cuando"])) if candidatos else None

    momentos = [c["cuando"] for c in candidatos] + [d for d in dias_de_visita if d]
    ultima = max(momentos, key=_clave) if momentos else ""
    # Si el día más reciente es solo un día (visita sin abrir ninguna clase),
    # pero alguna pista con hora cae ese mismo día, se usa la hora.
    if len(ultima) == 10:
        mismas = [m for m in momentos if len(m) > 10 and m[:10] == ultima]
        if mismas:
            ultima = max(mismas)

    return {"donde": donde, "ultima_entrada": ultima}


def clase_para_seguir(donde: Optional[dict], siguiente: Optional[dict]) -> str:
    """La clase a la que lleva "Seguir donde lo dejé" (uuid, o "" = la
    portada de la formación). Pura, con test.

    Si la última que abrió la dejó a medias, a esa. Si la terminó, a la
    primera que le falta: volver a una clase ya hecha no es "seguir".
    """
    if donde and donde.get("como") == "abrio" and donde.get("uuid"):
        return donde["uuid"]
    if siguiente and siguiente.get("uuid"):
        return siguiente["uuid"]
    return (donde or {}).get("uuid") or ""


def estado_de(ultima_entrada: str, hechas: int, hoy: date) -> dict:
    """En qué está el alumno, para el punto de color y el filtro. Pura, con test."""
    if not ultima_entrada:
        return {"id": "nunca", "texto": "No ha entrado nunca", "dias": None}
    try:
        dia = date.fromisoformat(ultima_entrada[:10])
    except ValueError:
        return {"id": "nunca", "texto": "No ha entrado nunca", "dias": None}
    dias = max(0, (hoy - dia).days)
    if hechas == 0:
        return {"id": "sin-empezar", "texto": "Entró pero no ha hecho ninguna clase", "dias": dias}
    if dias <= 3:
        return {"id": "activo", "texto": "Activo", "dias": dias}
    if dias <= 7:
        return {"id": "enfriando", "texto": "Se está enfriando", "dias": dias}
    return {"id": "descolgado", "texto": f"{dias} días sin entrar", "dias": dias}


async def listar_alumnos(org_id: int, db_session: AsyncSession) -> dict:
    from src.services.contactos.metricas import ids_excluidos

    from src.services.panel.testers import ids_testers

    # Fuera de los números (pruebas) y las cuentas del grupo Testers.
    fuera = await ids_excluidos(db_session) | await ids_testers(org_id, db_session)
    filas = [
        (m, u)
        for m, u in (
            await db_session.execute(
                select(UserOrganization, User)
                .join(User, User.id == UserOrganization.user_id)
                .where(UserOrganization.org_id == org_id, UserOrganization.role_id == STUDENT_ROLE_ID)
            )
        ).all()
        if m.user_id not in fuera
    ]
    ids = [int(m.user_id) for m, _ in filas]
    if not ids:
        return {"alumnos": [], "total_clases": 0}

    progreso = {
        int(p.user_id): p
        for p in (
            await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(ids)))  # type: ignore[attr-defined]
        ).scalars().all()
    }
    visitas: dict[int, list[str]] = {}
    for uid, dia in (
        await db_session.execute(
            select(StudentVisitDay.user_id, StudentVisitDay.day).where(StudentVisitDay.user_id.in_(ids))  # type: ignore[attr-defined]
        )
    ).all():
        visitas.setdefault(int(uid), []).append(str(dia))

    curso = await _curso_formacion(db_session)
    clases = await clases_en_orden(db_session, curso.id) if curso and curso.id else []
    por_id = {c["id"]: c for c in clases}
    por_uuid = {_sin_prefijo(c["uuid"]): c for c in clases if c.get("uuid")}

    hechas: dict[int, dict[int, str]] = {}
    if curso and curso.id:
        for uid, aid, fecha in (
            await db_session.execute(
                select(TrailStep.user_id, TrailStep.activity_id, TrailStep.creation_date).where(
                    TrailStep.course_id == curso.id,
                    TrailStep.complete == True,  # noqa: E712
                    TrailStep.user_id.in_(ids),  # type: ignore[attr-defined]
                )
            )
        ).all():
            suyas = hechas.setdefault(int(uid), {})
            f = str(fecha or "")
            if int(aid) not in suyas or (f and f < suyas[int(aid)]):
                suyas[int(aid)] = f

    # Quien entró desde el 10/10/2026 abre la formación por avance: su fila
    # enseña qué tiene abierto y por qué no lo demás (`avance_modulos.py`).
    from src.services.courses.avance_modulos import (
        ajustes_avance,
        estado_avance,
        leer_fecha,
        resumen_para_el_panel,
        usa_avance,
    )
    from src.services.courses.locks import get_drip_settings

    goteo = await get_drip_settings(org_id, db_session)
    ajustes = ajustes_avance(goteo) if goteo else {"activo": False, "desde": ""}

    hoy = datetime.now(timezone.utc).date()
    hace7 = hoy.toordinal() - 6
    alumnos: list[dict] = []
    for m, u in filas:
        uid = int(m.user_id)
        suyas = hechas.get(uid, {})
        avance = resumir_avance(clases, suyas)

        ultima_terminada = None
        if suyas:
            aid = max(suyas, key=lambda k: (suyas[k] or "", k))
            if aid in por_id:
                ultima_terminada = {**por_id[aid], "fecha": suyas[aid]}

        p = progreso.get(uid)
        dias = list(visitas.get(uid, []))
        if p and p.last_visit_date:
            dias.append(p.last_visit_date[:10])
        dc = donde_y_cuando((p.current_position if p else {}) or {}, ultima_terminada, dias, por_uuid)

        dias_unicos = sorted(set(d[:10] for d in dias if d))
        entradas_7d = 0
        for d in dias_unicos:
            try:
                if date.fromisoformat(d).toordinal() >= hace7:
                    entradas_7d += 1
            except ValueError:
                pass

        alumnos.append(
            {
                "user_id": uid,
                "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
                "email": (u.email or "").strip().lower(),
                "avatar": u.avatar_image or "",
                "user_uuid": u.user_uuid,
                "alta": (m.creation_date or "")[:10],
                "ultima_entrada": dc["ultima_entrada"],
                "donde": dc["donde"],
                "siguiente": avance["siguiente"],
                "seguir_uuid": clase_para_seguir(dc["donde"], avance["siguiente"]),
                "hechas": avance["hechas"],
                "total": avance["total"],
                "pct": avance["pct"],
                "modulos": avance["modulos"],
                "dias_que_entro": len(dias_unicos),
                "entradas_7d": entradas_7d,
                "racha": int(p.current_streak or 0) if p else 0,
                "estado": estado_de(dc["ultima_entrada"], avance["hechas"], hoy),
                "por_avance": False,
                "aperturas": [],
            }
        )
        if usa_avance(leer_fecha(m.creation_date), ajustes):
            estado = await estado_avance(uid, org_id, db_session, drip=goteo)
            if estado:
                alumnos[-1]["por_avance"] = True
                alumnos[-1]["aperturas"] = resumen_para_el_panel(estado)

    # Último recordatorio mandado a cada uno, para no repetir sin darse cuenta.
    ultimos: dict[int, dict] = {}
    for r in (
        await db_session.execute(
            select(StudentReminder).where(StudentReminder.user_id.in_(ids)).order_by(StudentReminder.id)  # type: ignore[attr-defined]
        )
    ).scalars().all():
        ultimos[int(r.user_id)] = {"sent_at": r.sent_at, "tipo": r.tipo, "por": r.sent_by}
    for a in alumnos:
        a["ultimo_recordatorio"] = ultimos.get(a["user_id"])

    # Lo más reciente arriba; quien no ha entrado nunca, al final.
    alumnos.sort(key=lambda a: _clave(a["ultima_entrada"]) if a["ultima_entrada"] else "", reverse=True)
    return {"alumnos": alumnos, "total_clases": len(clases)}

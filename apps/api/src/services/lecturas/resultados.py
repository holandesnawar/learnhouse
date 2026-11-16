"""Los resultados de los ejercicios de la lectura semanal (16/11/2026).

Usuario: «que pueda yo ver los resultados de cada uno en Progreso o en el
panel». Cada vez que un alumno termina los ejercicios de una lectura, la
pantalla manda lo que sacó y aquí se guarda.

Dónde (sin tabla nueva): `student_progress.lecturas`, JSON en texto,
`{id_de_la_lectura: {...}}` con:

- `aciertos` / `total`: la ÚLTIMA vez que los hizo (lo que ve el equipo).
- `mejor`: los mejores aciertos de todas las veces.
- `fallos`: los números (desde 1) de los ejercicios que falló la última vez.
- `veces`, `primera`, `ultima` (UTC, ISO).

Los ejercicios de escribir tú (`ab`) no se corrigen y no cuentan.

El equipo lo ve en dos sitios: en Progreso, al abrir a un alumno (sus
lecturas), y en la propia lectura («Resultados»: quién la ha hecho, con cuánto,
y qué ejercicios fallan más). Los alumnos son los de `listar_alumnos` (rol de
alumno, sin pruebas ni Testers).
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.student_progress import StudentProgress

MAX_LECTURAS = 200


# ── Lo puro (con test) ──────────────────────────────────────────────────────


def leer(crudo: Any) -> dict:
    try:
        d = json.loads(crudo) if isinstance(crudo, str) and crudo.strip() else (crudo or {})
    except ValueError:
        d = {}
    return {k: v for k, v in d.items() if isinstance(v, dict)} if isinstance(d, dict) else {}


def apuntar(previo: dict, lectura_id: str, aciertos: Any, total: Any, fallos: Any, ahora: datetime) -> dict:
    """Lo guardado con el resultado nuevo. Datos raros se recortan."""
    try:
        total = max(0, min(int(total), 60))
        aciertos = max(0, min(int(aciertos), total))
    except (TypeError, ValueError):
        raise ValueError("Resultado no válido")
    if not total:
        raise ValueError("Sin ejercicios que corregir")
    lista = []
    for f in fallos if isinstance(fallos, list) else []:
        try:
            n = int(f)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 60 and n not in lista:
            lista.append(n)
    datos = dict(previo or {})
    antes = datos.get(lectura_id) if isinstance(datos.get(lectura_id), dict) else {}
    cuando = ahora.astimezone(timezone.utc).isoformat()
    datos[lectura_id] = {
        "aciertos": aciertos,
        "total": total,
        "mejor": max(aciertos, int(antes.get("mejor") or 0)),
        "fallos": sorted(lista)[:60],
        "veces": int(antes.get("veces") or 0) + 1,
        "primera": antes.get("primera") or cuando,
        "ultima": cuando,
    }
    # Que no crezca sin fin: se quedan las más recientes.
    if len(datos) > MAX_LECTURAS:
        orden = sorted(datos, key=lambda k: datos[k].get("ultima") or "", reverse=True)
        datos = {k: datos[k] for k in orden[:MAX_LECTURAS]}
    return datos


def resumen_lectura(lectura: dict, por_alumno: dict, alumnos: list[dict]) -> dict:
    """Para la propia lectura: quién la hizo, la media y los ejercicios que
    más se fallan. `por_alumno` = {user_id: lo guardado del alumno}."""
    lid = lectura.get("id")
    ejercicios = lectura.get("ejercicios") or []
    hechos, sin_hacer = [], []
    fallos: dict[int, int] = {}
    for a in alumnos:
        r = (por_alumno.get(a["user_id"]) or {}).get(lid)
        if r:
            hechos.append({**a, **{k: r.get(k) for k in ("aciertos", "total", "mejor", "fallos", "veces", "ultima")}})
            for n in r.get("fallos") or []:
                fallos[n] = fallos.get(n, 0) + 1
        else:
            sin_hacer.append(a)
    hechos.sort(key=lambda h: h.get("ultima") or "", reverse=True)
    media = round(sum(h["aciertos"] / h["total"] for h in hechos if h.get("total")) / len(hechos) * 100) if hechos else None
    mas_fallados = []
    for n, veces in sorted(fallos.items(), key=lambda x: (-x[1], x[0]))[:5]:
        e = ejercicios[n - 1] if 0 < n <= len(ejercicios) and isinstance(ejercicios[n - 1], dict) else {}
        mas_fallados.append({"numero": n, "veces": veces, "pregunta": e.get("pregunta", ""), "correcta": e.get("correcta", "")})
    return {
        "id": lid,
        "hechos": hechos,
        "sin_hacer": sin_hacer,
        "media_pct": media,
        "mas_fallados": mas_fallados,
        "alumnos": len(alumnos),
    }


# ── Con la base de datos ────────────────────────────────────────────────────


async def guardar(user_id: int, lectura_id: str, datos: dict, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(StudentProgress).where(StudentProgress.user_id == user_id))
    ).scalars().first()
    if not fila:
        ahora = str(datetime.now())
        fila = StudentProgress(user_id=user_id, creation_date=ahora, update_date=ahora)
    nuevo = apuntar(
        leer(getattr(fila, "lecturas", "")),
        lectura_id,
        datos.get("aciertos"),
        datos.get("total"),
        datos.get("fallos"),
        datetime.now(timezone.utc),
    )
    fila.lecturas = json.dumps(nuevo, ensure_ascii=False)
    db_session.add(fila)
    await db_session.commit()
    return nuevo[lectura_id]


async def de_alumnos(user_ids: list[int], db_session: AsyncSession) -> dict:
    """{user_id: {id_lectura: resultado}}."""
    if not user_ids:
        return {}
    out = {}
    for f in (
        await db_session.execute(select(StudentProgress).where(StudentProgress.user_id.in_(user_ids)))  # type: ignore[attr-defined]
    ).scalars():
        d = leer(getattr(f, "lecturas", ""))
        if d:
            out[int(f.user_id)] = d
    return out


def para_progreso(resultados: Optional[dict], lecturas: list[dict]) -> list[dict]:
    """Las lecturas de un alumno, para su ficha en Progreso (la más nueva
    primero). Solo las que siguen existiendo."""
    por_id = {l.get("id"): l for l in lecturas}
    salida = []
    for lid, r in (resultados or {}).items():
        l = por_id.get(lid)
        if not l:
            continue
        salida.append(
            {
                "id": lid,
                "titulo": l.get("titulo", ""),
                "semana": l.get("semana", ""),
                "aciertos": r.get("aciertos"),
                "total": r.get("total"),
                "mejor": r.get("mejor"),
                "veces": r.get("veces"),
                "ultima": r.get("ultima"),
            }
        )
    salida.sort(key=lambda x: x.get("semana") or "", reverse=True)
    return salida


async def alumnos_de(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Los alumnos que cuentan (rol de alumno, sin pruebas ni Testers)."""
    from src.db.user_organizations import UserOrganization
    from src.db.users import User
    from src.security.rbac.constants import STUDENT_ROLE_ID
    from src.services.contactos.metricas import ids_excluidos
    from src.services.panel.testers import ids_testers

    fuera = await ids_excluidos(db_session) | await ids_testers(org_id, db_session)
    salida = []
    for u in (
        await db_session.execute(
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(UserOrganization.org_id == org_id, UserOrganization.role_id == STUDENT_ROLE_ID)
        )
    ).scalars():
        if u.id in fuera:
            continue
        nombre = " ".join(p for p in (u.first_name or "", u.last_name or "") if p).strip() or u.username or u.email
        salida.append({"user_id": int(u.id), "nombre": nombre})
    salida.sort(key=lambda a: a["nombre"].lower())
    return salida


async def por_lectura(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Para el equipo: cada lectura con ejercicios y quién la ha hecho."""
    from src.services.lecturas.lecturas import todas

    lecturas = [l for l in await todas(org_id, db_session) if l.get("ejercicios")]
    alumnos = await alumnos_de(org_id, db_session)
    datos = await de_alumnos([a["user_id"] for a in alumnos], db_session)
    return [resumen_lectura(l, datos, alumnos) for l in lecturas]

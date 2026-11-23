"""
«¿Ves un fallo? Avísanos» en cada ejercicio (23/11/2026).

Por qué: un alumno encontró dos errores en el módulo 2 («mis hermanos» sin
«hermanas» entre las fichas; «Hij is mijn vriend» como «mi amigo») y no tenía
por dónde decirlo: llegó por WhatsApp, días después y sin saber de qué
ejercicio hablaba. El repaso automático (`cursoCoherente.test.ts`) no sabe
neerlandés: una traducción coja solo la ve una persona, y quien la ve primero
es el alumno que está haciendo el ejercicio.

Cómo va
-------
- En cada ejercicio de las lecciones hay un enlace discreto. El alumno elige
  qué pasa (`MOTIVOS`) y, si quiere, escribe algo. El navegador manda además lo
  que tenía delante (enunciado, opciones, la respuesta que la escuela da por
  buena y lo que él contestó), para que quien lo lea no tenga que ir a buscarlo.
- **Una fila por alumno y ejercicio**: avisar otra vez del mismo cambia la suya
  (y la reabre si ya estaba cerrada). Tope de `TOPE_AL_DIA` ejercicios distintos
  por alumno y día, para que nadie llene la lista jugando.
- El equipo los ve en Panel → Formación → «Fallos avisados», **agrupados por
  ejercicio** («3 alumnos»): lo que importa es el ejercicio, no cada aviso.
- Cerrar («Arreglado» o «No era un fallo») es de administradores y cierra
  TODOS los avisos abiertos de ese ejercicio. No se borra nada: lo cerrado se
  queda en su lista, y si otro alumno avisa después del mismo ejercicio, vuelve
  a salir arriba (señal de que no quedó arreglado).
- La campana de los administradores: «N avisos de fallos en ejercicios»
  (`aviso_campana`), que se va al cerrarlos.

Nada de esto corrige el ejercicio: el contenido vive en
`apps/web/lib/exercises-app/courseData.ts`. El botón «Copiar» del panel saca el
texto para pasárselo a quien lo arregla.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.ejercicio_aviso import EjercicioAviso

#: Lo que el alumno puede elegir, con el texto que ve.
MOTIVOS: dict[str, str] = {
    "respuesta": "La respuesta buena no es esa",
    "varias": "Hay más de una respuesta buena",
    "texto": "Error en el texto o en la traducción",
    "audio": "El audio",
    "otra": "Otra cosa",
}

ESTADOS_CERRADO = ("arreglado", "no-era")

#: Ejercicios distintos de los que un alumno puede avisar en un día.
TOPE_AL_DIA = 20

_MAX_COMENTARIO = 1000


class AvisoError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _ahora() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _texto(valor: Any, tope: int) -> str:
    return " ".join(str(valor or "").split())[:tope]


def limpiar_datos(datos: Any) -> dict:
    """Lo que se guarda de lo que manda el navegador: solo lo que se espera y
    con tope de tamaño (lo escribe un alumno: no se guarda cualquier cosa). Pura."""
    d = datos if isinstance(datos, dict) else {}
    opciones = d.get("opciones") if isinstance(d.get("opciones"), list) else []
    tambien = d.get("tambien") if isinstance(d.get("tambien"), list) else []
    parejas = d.get("parejas") if isinstance(d.get("parejas"), list) else []
    return {
        "tipo": _texto(d.get("tipo"), 40),
        "enunciado": _texto(d.get("enunciado"), 600),
        "enunciado_nl": _texto(d.get("enunciado_nl"), 600),
        "opciones": [_texto(o, 200) for o in opciones[:12] if _texto(o, 200)],
        "correcta": _texto(d.get("correcta"), 400),
        "tambien": [_texto(o, 400) for o in tambien[:8] if _texto(o, 400)],
        "parejas": [
            {"izquierda": _texto(p.get("izquierda"), 120), "derecha": _texto(p.get("derecha"), 120)}
            for p in parejas[:12]
            if isinstance(p, dict)
        ],
        "respuesta_alumno": _texto(d.get("respuesta_alumno"), 400),
        "leccion": _texto(d.get("leccion"), 200),
        "modulo": _texto(d.get("modulo"), 200),
        "seccion": _texto(d.get("seccion"), 40),
        "course_uuid": _texto(d.get("course_uuid"), 80),
        "activity_uuid": _texto(d.get("activity_uuid"), 80),
    }


def _leer(texto: Any) -> dict:
    try:
        d = json.loads(texto) if isinstance(texto, str) and texto.strip() else {}
    except (ValueError, TypeError):
        d = {}
    return d if isinstance(d, dict) else {}


def _nombre(user: Any) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or "Alumno"


async def avisar(org_id: int, user: Any, datos: dict, db_session: AsyncSession) -> dict:
    """Apunta el aviso de un alumno (o cambia el suyo de ese ejercicio)."""
    exercise_id = _texto(datos.get("exercise_id"), 160)
    lesson_id = _texto(datos.get("lesson_id"), 120)
    if not exercise_id:
        raise AvisoError("Falta el ejercicio")
    motivo = str(datos.get("motivo") or "otra")
    if motivo not in MOTIVOS:
        motivo = "otra"
    comentario = str(datos.get("comentario") or "").strip()[:_MAX_COMENTARIO]
    ahora = _ahora()
    user_id = int(getattr(user, "id", 0) or 0)

    fila = (
        await db_session.execute(
            select(EjercicioAviso).where(
                EjercicioAviso.org_id == org_id,
                EjercicioAviso.user_id == user_id,
                EjercicioAviso.exercise_id == exercise_id,
                EjercicioAviso.lesson_id == lesson_id,
            )
        )
    ).scalars().first()
    if fila is None:
        hoy = ahora[:10]
        de_hoy = (
            await db_session.execute(
                select(EjercicioAviso.id).where(
                    EjercicioAviso.org_id == org_id,
                    EjercicioAviso.user_id == user_id,
                    EjercicioAviso.created_at >= hoy,
                )
            )
        ).scalars().all()
        if len(de_hoy) >= TOPE_AL_DIA:
            raise AvisoError("Hoy ya nos has avisado de muchos ejercicios. Gracias: los miramos. Mañana puedes avisar de más.", 429)
        fila = EjercicioAviso(org_id=org_id, user_id=user_id, lesson_id=lesson_id, exercise_id=exercise_id, created_at=ahora)
    fila.motivo = motivo
    fila.comentario = comentario
    fila.datos = json.dumps(limpiar_datos(datos.get("datos")), ensure_ascii=False)
    # Avisar otra vez de algo que se dio por cerrado lo reabre: no quedó bien.
    fila.estado = "nuevo"
    fila.cerrado_at = ""
    fila.cerrado_por = ""
    fila.updated_at = ahora
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True}


def agrupar(filas: Iterable[dict]) -> list[dict]:
    """Los avisos, uno por EJERCICIO. Pura.

    `filas`: [{id, lesson_id, exercise_id, motivo, comentario, datos, estado,
    updated_at, cerrado_at, cerrado_por, nombre}]. De cada ejercicio salen lo
    que se veía (lo del aviso más reciente), quién avisó y de qué, y su estado:
    `nuevo` si queda algún aviso abierto; si no, el del último cierre.
    Orden: los abiertos primero y, dentro, los de más alumnos y más recientes."""
    grupos: dict[tuple[str, str], dict] = {}
    for f in sorted(filas, key=lambda f: f.get("updated_at") or ""):
        clave = (f.get("lesson_id") or "", f.get("exercise_id") or "")
        g = grupos.setdefault(
            clave,
            {"lesson_id": clave[0], "exercise_id": clave[1], "datos": {}, "avisos": [], "abiertos": 0, "ultimo": "", "cerrado_at": "", "cerrado_por": "", "estado_cierre": ""},
        )
        # El más reciente manda en lo que se enseña (el ejercicio pudo cambiar).
        if f.get("datos"):
            g["datos"] = f["datos"]
        g["ultimo"] = max(g["ultimo"], f.get("updated_at") or "")
        if f.get("estado") == "nuevo":
            g["abiertos"] += 1
        elif (f.get("cerrado_at") or "") >= g["cerrado_at"]:
            g["cerrado_at"] = f.get("cerrado_at") or ""
            g["cerrado_por"] = f.get("cerrado_por") or ""
            g["estado_cierre"] = f.get("estado") or ""
        g["avisos"].append(
            {
                "id": f.get("id"),
                "nombre": f.get("nombre") or "Alumno",
                "motivo": f.get("motivo") or "otra",
                "motivo_texto": MOTIVOS.get(f.get("motivo") or "", MOTIVOS["otra"]),
                "comentario": f.get("comentario") or "",
                "respuesta_alumno": (f.get("datos") or {}).get("respuesta_alumno", ""),
                "estado": f.get("estado") or "nuevo",
                "at": f.get("updated_at") or "",
            }
        )
    out = []
    for g in grupos.values():
        g["avisos"].sort(key=lambda a: a["at"], reverse=True)
        g["estado"] = "nuevo" if g["abiertos"] else (g["estado_cierre"] or "arreglado")
        g["alumnos"] = len(g["avisos"])
        del g["estado_cierre"]
        out.append(g)
    out.sort(key=lambda g: (0 if g["estado"] == "nuevo" else 1, -g["abiertos"], _menos(g["ultimo"])))
    return out


def _menos(fecha: str) -> tuple:
    """Para ordenar de más nuevo a más viejo dentro de un `sort` ascendente."""
    return tuple(-ord(c) for c in fecha)


async def _filas(org_id: int, db_session: AsyncSession) -> list[dict]:
    from src.db.users import User

    filas = (
        await db_session.execute(select(EjercicioAviso).where(EjercicioAviso.org_id == org_id))
    ).scalars().all()
    ids = {f.user_id for f in filas}
    nombres: dict[int, str] = {}
    if ids:
        for u in (await db_session.execute(select(User).where(User.id.in_(ids)))).scalars().all():  # type: ignore[attr-defined]
            nombres[int(u.id)] = _nombre(u)
    return [
        {
            "id": f.id,
            "lesson_id": f.lesson_id,
            "exercise_id": f.exercise_id,
            "motivo": f.motivo,
            "comentario": f.comentario or "",
            "datos": _leer(f.datos),
            "estado": f.estado or "nuevo",
            "updated_at": f.updated_at or f.created_at or "",
            "cerrado_at": f.cerrado_at or "",
            "cerrado_por": f.cerrado_por or "",
            "nombre": nombres.get(f.user_id, "Alumno"),
        }
        for f in filas
    ]


async def listar(org_id: int, db_session: AsyncSession) -> dict:
    grupos = agrupar(await _filas(org_id, db_session))
    return {
        "motivos": MOTIVOS,
        "abiertos": [g for g in grupos if g["estado"] == "nuevo"],
        "cerrados": [g for g in grupos if g["estado"] != "nuevo"][:60],
    }


async def cerrar(org_id: int, lesson_id: str, exercise_id: str, estado: str, por: str, db_session: AsyncSession) -> dict:
    """Cierra («arreglado» / «no-era») o reabre («nuevo») TODOS los avisos de
    ese ejercicio."""
    if estado not in (*ESTADOS_CERRADO, "nuevo"):
        raise AvisoError("Ese estado no existe")
    filas = (
        await db_session.execute(
            select(EjercicioAviso).where(
                EjercicioAviso.org_id == org_id,
                EjercicioAviso.exercise_id == exercise_id,
                EjercicioAviso.lesson_id == lesson_id,
            )
        )
    ).scalars().all()
    if not filas:
        raise AvisoError("No hay avisos de ese ejercicio", 404)
    ahora = _ahora()
    for f in filas:
        if estado == "nuevo":
            f.estado, f.cerrado_at, f.cerrado_por = "nuevo", "", ""
        elif f.estado == "nuevo":
            f.estado, f.cerrado_at, f.cerrado_por = estado, ahora, por[:120]
        db_session.add(f)
    await db_session.commit()
    return {"ok": True, "cambiados": len(filas)}


def aviso_campana(org_id: int, grupos_abiertos: list[dict]) -> Optional[dict]:
    """La línea de la campana de los administradores. Pura. El id lleva la
    fecha del último aviso: quitarla no la silencia si llega otro."""
    if not grupos_abiertos:
        return None
    n = sum(g.get("abiertos") or 0 for g in grupos_abiertos)
    ultimo = max(grupos_abiertos, key=lambda g: g.get("ultimo") or "")
    donde = (ultimo.get("datos") or {}).get("leccion") or ultimo.get("lesson_id") or ultimo.get("exercise_id") or ""
    return {
        "id": f"fallos:{org_id}:{ultimo.get('ultimo') or ''}",
        "kind": "fallos",
        "title": "1 aviso de fallo en un ejercicio" if n == 1 else f"{n} avisos de fallos en ejercicios",
        "excerpt": f"El último, en {donde}." if donde else "",
        "url": "/dash/estadisticas?tab=fallos",
        "date": ultimo.get("ultimo") or "",
    }


async def para_la_campana(org_id: int, db_session: AsyncSession) -> list[dict]:
    datos = await listar(org_id, db_session)
    aviso = aviso_campana(org_id, datos["abiertos"])
    return [aviso] if aviso else []

"""
Hasta dónde llega cada visita de los embudos de la web (20/10/2026).

La web (nawar-web, `src/lib/pasosEmbudo.ts`) avisa con un número de sesión
al azar y el paso al que ha llegado: entrar en la página, dejar los datos, el
vídeo (play, 25, 50, 75 y 100 %), abrir el formulario, terminar las preguntas
y reservar la llamada. Sin nombre ni correo: es lo que permite saber cuántos
ven la página y se van SIN dejar sus datos, que hasta ahora no constaba en
ninguna parte (quien no deja sus datos no tiene ficha).

Los tres embudos:
- `anuncio`: /formacion-nawar-fb → /vsl → /proceso-de-admision (Meta).
- `web`: /formacion → /formacion/vsl → /formacion/proceso-de-admision.
- `admision`: /proceso-de-admision (vídeo y datos en la misma página) →
  /proceso-de-admision/paso-3.

`resumen` es pura (con test, `test_embudo_visitas.py`): de las filas saca, por
embudo y por canal (anuncio de pago u orgánico), cuántas sesiones llegan a
cada paso y el % respecto al anterior.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.embudo_visita import EmbudoVisita

ZONA = ZoneInfo("Europe/Amsterdam")

EMBUDOS = {
    "anuncio": "Página del anuncio (Facebook e Instagram)",
    "web": "Página de la formación (web)",
    "admision": "Proceso de admisión (web)",
}

#: Los pasos que manda la web.
PASOS = ("visita", "datos", "video", "formulario", "preguntas", "reserva")

#: Lo que se enseña, en orden. `video` se parte en tres por el %.
ESCALONES = (
    ("visita", "Entran en la página"),
    ("datos", "Dejan sus datos"),
    ("play", "Le dan al play al vídeo"),
    ("mitad", "Llegan a la mitad del vídeo"),
    ("entero", "Ven el vídeo entero"),
    ("formulario", "Abren el formulario de admisión"),
    ("preguntas", "Terminan las preguntas"),
    ("reserva", "Reservan la llamada"),
)

_SESION = re.compile(r"^[A-Za-z0-9_-]{8,40}$")
_DE_PAGO = {"paid", "cpc", "ppc", "ads", "paid_social", "paidsocial", "cpm"}


def canal_de_utm(utm_medium: str) -> str:
    return "ads" if (utm_medium or "").strip().lower() in _DE_PAGO else "organico"


def _hoy() -> str:
    return datetime.now(ZONA).strftime("%Y-%m-%d")


def _corto(valor: Any, largo: int = 120) -> str:
    return str(valor or "").strip()[:largo]


def leer_paso(datos: dict) -> dict | None:
    """Lo que manda la web, validado. None si no vale (se ignora sin error:
    es un contador, no merece la pena devolverle nada a un bot)."""
    sesion = str(datos.get("s") or "")
    embudo = str(datos.get("e") or "")
    paso = str(datos.get("p") or "")
    if not _SESION.match(sesion) or embudo not in EMBUDOS or paso not in PASOS:
        return None
    try:
        pct = int(float(datos.get("v") or 0))
    except (TypeError, ValueError):
        pct = 0
    return {
        "sesion": sesion,
        "embudo": embudo,
        "paso": paso,
        "video_pct": max(0, min(100, pct)) if paso == "video" else 0,
        "utm_source": _corto(datos.get("utm_source")),
        "utm_medium": _corto(datos.get("utm_medium")),
        "utm_campaign": _corto(datos.get("utm_campaign")),
        "utm_content": _corto(datos.get("utm_content")),
    }


def aplicar(fila: EmbudoVisita, paso: dict, ahora: str) -> None:
    """Sube la fila hasta el paso, sin bajar nunca nada."""
    p = paso["paso"]
    if p == "visita":
        fila.visita = True
    elif p == "datos":
        fila.datos = True
    elif p == "video":
        fila.video_pct = max(int(fila.video_pct or 0), paso["video_pct"])
    elif p == "formulario":
        fila.formulario = True
    elif p == "preguntas":
        fila.preguntas = True
    elif p == "reserva":
        fila.reserva = True
    # La campaña de la primera vez que llega con ella.
    if not fila.utm_medium and paso["utm_medium"]:
        fila.utm_source = paso["utm_source"]
        fila.utm_medium = paso["utm_medium"]
        fila.utm_campaign = paso["utm_campaign"]
        fila.utm_content = paso["utm_content"]
        fila.canal = canal_de_utm(paso["utm_medium"])
    fila.updated_at = ahora


async def apuntar_paso(datos: dict, db_session: AsyncSession) -> bool:
    paso = leer_paso(datos)
    if paso is None:
        return False
    ahora = datetime.now(timezone.utc).isoformat()

    async def buscar():
        return (
            await db_session.execute(
                select(EmbudoVisita).where(EmbudoVisita.sesion == paso["sesion"], EmbudoVisita.embudo == paso["embudo"])
            )
        ).scalars().first()

    fila = await buscar()
    if fila is None:
        fila = EmbudoVisita(
            sesion=paso["sesion"], embudo=paso["embudo"], dia=_hoy(),
            canal=canal_de_utm(paso["utm_medium"]), created_at=ahora,
        )
        aplicar(fila, paso, ahora)
        db_session.add(fila)
        try:
            await db_session.commit()
            return True
        except IntegrityError:
            # Dos pasos de la misma sesión a la vez: el otro ya creó la fila.
            await db_session.rollback()
            fila = await buscar()
            if fila is None:
                return False
    aplicar(fila, paso, ahora)
    db_session.add(fila)
    await db_session.commit()
    return True


# ── el resumen ─────────────────────────────────────────────────────────────


def _escalones(f: Any) -> dict[str, bool]:
    """Hasta dónde llegó una sesión. Llegar a un paso de más adelante cuenta
    los de antes que no son del vídeo (quien abre el formulario dejó sus
    datos aunque el aviso se perdiera); el vídeo solo cuenta lo que avisó."""
    pct = int(getattr(f, "video_pct", 0) or 0)
    reserva = bool(getattr(f, "reserva", False))
    preguntas = bool(getattr(f, "preguntas", False)) or reserva
    formulario = bool(getattr(f, "formulario", False)) or preguntas
    play = pct >= 1
    datos = bool(getattr(f, "datos", False)) or play or formulario
    return {
        "visita": True,
        "datos": datos,
        "play": play,
        "mitad": pct >= 50,
        "entero": pct >= 100,
        "formulario": formulario,
        "preguntas": preguntas,
        "reserva": reserva,
    }


def _pasos(filas: list) -> list[dict]:
    cuentas = {clave: 0 for clave, _ in ESCALONES}
    for f in filas:
        for clave, llego in _escalones(f).items():
            if llego:
                cuentas[clave] += 1
    salida = []
    anterior = None
    total = cuentas["visita"]
    for clave, nombre in ESCALONES:
        n = cuentas[clave]
        salida.append(
            {
                "clave": clave,
                "nombre": nombre,
                "n": n,
                "pct_anterior": round(n * 100 / anterior, 1) if anterior else None,
                "pct_total": round(n * 100 / total, 1) if total else None,
            }
        )
        anterior = n
    return salida


def resumen(filas: Iterable[Any]) -> dict:
    """Por embudo y canal: [{clave, nombre, n, pct_anterior, pct_total}]."""
    filas = list(filas)
    salida: dict = {}
    for embudo in list(EMBUDOS) + ["todos"]:
        propias = filas if embudo == "todos" else [f for f in filas if getattr(f, "embudo", "") == embudo]
        salida[embudo] = {
            "nombre": EMBUDOS.get(embudo, "Todos los embudos"),
            "canales": {
                canal: _pasos(propias if canal == "todos" else [f for f in propias if getattr(f, "canal", "") == canal])
                for canal in ("todos", "ads", "organico")
            },
        }
    return salida


def visitas_por_dia(filas: Iterable[Any]) -> dict[str, dict[str, int]]:
    """{dia: {visitas, datos}} de todos los embudos."""
    salida: dict[str, dict[str, int]] = {}
    for f in filas:
        d = salida.setdefault(getattr(f, "dia", ""), {"visitas": 0, "datos": 0})
        d["visitas"] += 1
        if _escalones(f)["datos"]:
            d["datos"] += 1
    return salida


async def filas_entre(desde: str, hasta: str, db_session: AsyncSession) -> list[EmbudoVisita]:
    return list(
        (
            await db_session.execute(
                select(EmbudoVisita).where(EmbudoVisita.dia >= desde, EmbudoVisita.dia <= hasta)
            )
        ).scalars().all()
    )

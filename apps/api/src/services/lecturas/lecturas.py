"""
La «Lectura semanal» (12/11/2026).

Usuario: "en Recursos, cada semana un texto: la lectura de esta semana arriba
y luego pasa a un archivo de lecturas, con el texto, todo lo que va escrito y
su vídeo… que salga al inicio también como lectura de esta semana". Los
ejercicios van en la comunidad: la lectura solo enlaza al post.

Qué es una lectura (todo opcional menos el título y la semana):
- `semana`: el LUNES de su semana (AAAA-MM-DD). Se publica sola ese lunes,
  en hora de Países Bajos: antes, solo la ve el equipo.
- `titulo` (en neerlandés) y `titulo_es`.
- `hoja`: el PDF de la hoja hecha en Claude Design ({url, name, size}),
  subido con el almacén de adjuntos de la escuela, como Recursos.
- `texto` y `traduccion`: el texto en neerlandés, para leerlo en pantalla y
  escucharlo, y su traducción (se enseña plegada).
- `palabras`: [{nl, es, ejemplo}] — las palabras de la semana.
- `video`: el enlace del vídeo (NOS Jeugdjournaal, YouTube…).
- `comunidad`: el enlace a la publicación de los ejercicios en la comunidad.

Dónde se guarda: en la configuración de la escuela (org_config `lecturas`,
una lista). Sin tabla nueva: son unas 50 al año y se leen todas a la vez.

⚠️ El texto de Nieuwsbegrip NO se sube tal cual (su licencia es para
colegios): la lectura la escribe la escuela con su tema de base.
"""

import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization

logger = logging.getLogger(__name__)

CLAVE = "lecturas"
NL = ZoneInfo("Europe/Amsterdam")
MAX_TEXTO = 6000
MAX_PALABRAS = 30


def hoy_nl() -> date:
    return datetime.now(NL).date()


def lunes_de(valor: Any) -> str:
    """El lunes de la semana de esa fecha (AAAA-MM-DD). Vacío si no vale."""
    try:
        d = date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        return ""
    return (d - timedelta(days=d.weekday())).isoformat()


def _texto(valor: Any, tope: int) -> str:
    return str(valor or "").replace("\r\n", "\n").strip()[:tope]


def _url(valor: Any) -> str:
    u = str(valor or "").strip()
    if not u:
        return ""
    if not re.match(r"^https?://", u, re.I):
        raise HTTPException(status_code=400, detail="El enlace tiene que empezar por https://")
    return u[:600]


def leer_palabras(valor: Any) -> list[dict]:
    """Las palabras de la semana, vengan como lista o como texto pegado
    (una por línea: «de fiets | la bici | Ik ga met de fiets.»)."""
    filas: list = []
    if isinstance(valor, str):
        for linea in valor.splitlines():
            partes = [p.strip() for p in re.split(r"\s*[|\t]\s*", linea.strip(" -•*")) if p.strip()]
            if partes:
                filas.append({"nl": partes[0], "es": partes[1] if len(partes) > 1 else "", "ejemplo": " ".join(partes[2:])})
    elif isinstance(valor, list):
        filas = [p for p in valor if isinstance(p, dict)]
    salida = []
    for p in filas:
        nl = _texto(p.get("nl"), 80)
        if not nl:
            continue
        salida.append({"nl": nl, "es": _texto(p.get("es"), 120), "ejemplo": _texto(p.get("ejemplo"), 200)})
    return salida[:MAX_PALABRAS]


def limpiar(datos: dict, antes: Optional[dict] = None) -> dict:
    """Una lectura lista para guardar. Lo que no venga se queda como estaba."""
    base = dict(antes or {})
    if "semana" in datos or not base.get("semana"):
        semana = lunes_de(datos.get("semana"))
        if not semana:
            raise HTTPException(status_code=400, detail="Elige la semana de la lectura")
        base["semana"] = semana
    if "titulo" in datos or not base.get("titulo"):
        titulo = _texto(datos.get("titulo"), 140)
        if not titulo:
            raise HTTPException(status_code=400, detail="La lectura necesita un título")
        base["titulo"] = titulo
    for campo, tope in (("titulo_es", 140), ("texto", MAX_TEXTO), ("traduccion", MAX_TEXTO)):
        if campo in datos:
            base[campo] = _texto(datos.get(campo), tope)
    for campo in ("video", "comunidad"):
        if campo in datos:
            base[campo] = _url(datos.get(campo))
    if "palabras" in datos:
        base["palabras"] = leer_palabras(datos.get("palabras"))
    base.setdefault("id", uuid4().hex[:12])
    return base


def partir(lecturas: list[dict], hoy: date, equipo: bool) -> dict:
    """{actual, archivo, proximas}. La actual es la de la semana más reciente
    que ya ha empezado; el archivo, las anteriores (la más nueva arriba).
    Las de semanas que aún no han llegado solo las ve el equipo."""
    hoy_s = hoy.isoformat()
    ordenadas = sorted(
        (l for l in lecturas if isinstance(l, dict) and l.get("semana")),
        key=lambda l: (l["semana"], l.get("creada", "")),
        reverse=True,
    )
    publicadas = [l for l in ordenadas if l["semana"] <= hoy_s]
    proximas = sorted((l for l in ordenadas if l["semana"] > hoy_s), key=lambda l: l["semana"])
    return {
        "actual": publicadas[0] if publicadas else None,
        "archivo": publicadas[1:],
        "proximas": proximas if equipo else [],
    }


# ── Guardar en la configuración de la escuela ─────────────────────────────


async def _fila(org_id: int, db_session: AsyncSession) -> OrganizationConfig:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        raise HTTPException(status_code=500, detail="La escuela no tiene configuración")
    return fila


def _de_config(config: Any) -> list[dict]:
    valor = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    return [l for l in valor if isinstance(l, dict)] if isinstance(valor, list) else []


async def todas(org_id: int, db_session: AsyncSession) -> list[dict]:
    return _de_config((await _fila(org_id, db_session)).config)


async def _guardar(org_id: int, lecturas: list[dict], db_session: AsyncSession) -> None:
    fila = await _fila(org_id, db_session)
    config = json.loads(json.dumps(fila.config or {}))
    config[CLAVE] = lecturas
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()


async def para_mi(org_id: int, equipo: bool, db_session: AsyncSession) -> dict:
    return partir(await todas(org_id, db_session), hoy_nl(), equipo)


async def crear(org_id: int, datos: dict, autor: str, db_session: AsyncSession) -> dict:
    lecturas = await todas(org_id, db_session)
    nueva = limpiar(datos)
    nueva["creada"] = datetime.now(NL).isoformat(timespec="seconds")
    nueva["por"] = autor[:60]
    lecturas.append(nueva)
    await _guardar(org_id, lecturas, db_session)
    return nueva


async def editar(org_id: int, lectura_id: str, datos: dict, db_session: AsyncSession) -> dict:
    lecturas = await todas(org_id, db_session)
    for i, l in enumerate(lecturas):
        if l.get("id") == lectura_id:
            lecturas[i] = limpiar(datos, l)
            await _guardar(org_id, lecturas, db_session)
            return lecturas[i]
    raise HTTPException(status_code=404, detail="Esa lectura no existe")


async def borrar(org_id: int, lectura_id: str, db_session: AsyncSession) -> dict:
    lecturas = await todas(org_id, db_session)
    quedan = [l for l in lecturas if l.get("id") != lectura_id]
    if len(quedan) == len(lecturas):
        raise HTTPException(status_code=404, detail="Esa lectura no existe")
    # El PDF se queda en el almacén: borrarlo a la primera es perderlo por un clic.
    await _guardar(org_id, quedan, db_session)
    return {"ok": True}


async def subir_hoja(org_id: int, lectura_id: str, file: UploadFile, db_session: AsyncSession) -> dict:
    from src.services.communities.attachments import upload_attachment

    nombre = (file.filename or "").lower()
    if not nombre.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="La hoja tiene que ser un PDF")
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    lecturas = await todas(org_id, db_session)
    for l in lecturas:
        if l.get("id") == lectura_id:
            guardado = await upload_attachment(file, org.org_uuid)
            l["hoja"] = {"url": guardado["url"], "name": guardado["name"][:160], "size": int(guardado.get("size") or 0)}
            await _guardar(org_id, lecturas, db_session)
            return l
    raise HTTPException(status_code=404, detail="Esa lectura no existe")


async def quitar_hoja(org_id: int, lectura_id: str, db_session: AsyncSession) -> dict:
    lecturas = await todas(org_id, db_session)
    for l in lecturas:
        if l.get("id") == lectura_id:
            l.pop("hoja", None)
            await _guardar(org_id, lecturas, db_session)
            return l
    raise HTTPException(status_code=404, detail="Esa lectura no existe")

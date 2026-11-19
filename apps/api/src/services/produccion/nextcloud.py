"""
Traer los tableros del Deck de Nextcloud (portal.nawar.es) a los tableros de
producción de la escuela (19/11/2026).

Cómo:
- Se usa la API REST de Deck (`/index.php/apps/deck/api/v1.0`), con el
  usuario de Nextcloud y una **contraseña de aplicación** (Nextcloud →
  Configuración personal → Seguridad → «Crear nueva contraseña de aplicación»).
  Se teclean en la escuela y **no se guardan en ningún sitio**: sirven solo
  para esa importación.
- Primero se listan los tableros (`listar`); luego se traen los elegidos a un
  curso de la escuela (`importar`). Cada tablero trae sus columnas y sus
  tarjetas, con su título, su texto (Markdown → el editor de la escuela, ver
  `markdown.py`), sus etiquetas (por nombre, dentro del curso), sus personas
  (si el nombre casa con alguien del equipo, esa persona; si no, se queda con
  su nombre), su fecha, si está hecha y si está archivada.
- Comentarios: se traen si la tarjeta los tiene (API OCS de Deck). Adjuntos:
  se traen como ENLACES a Nextcloud (`/f/<id del archivo>`), no se copian:
  quien tenga cuenta en Nextcloud los abre ahí. En blando: si fallan, la
  tarjeta entra igual.
- **No se trae dos veces**: el tablero lleva `origen = nextcloud:<id>` y cada
  tarjeta el suyo. Volver a importar añade solo lo nuevo y no pisa lo que se
  haya cambiado en la escuela.

Sin probar contra el Nextcloud de verdad (no se alcanza desde el entorno donde
se escribió): probado con un Nextcloud falso con las respuestas que documenta
la app Deck (`test_produccion.py`). Si algo falla, el motivo sale tal cual.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.produccion import ProdColumna, ProdComentario, ProdEtiqueta, ProdTablero, ProdTarjeta
from src.services.produccion import tableros as T
from src.services.produccion.markdown import markdown_a_html

API = "/index.php/apps/deck/api/v1.0"
OCS = "/ocs/v2.php/apps/deck/api/v1.0"


class NextcloudError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def base_de(url: str) -> str:
    """«portal.nawar.es», «https://portal.nawar.es/apps/deck/#/board/3»… →
    «https://portal.nawar.es»."""
    u = (url or "").strip()
    if not u:
        raise NextcloudError("Escribe la dirección de tu Nextcloud (por ejemplo portal.nawar.es)")
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u
    u = u.split("#", 1)[0].split("?", 1)[0]
    u = re.sub(r"/(index\.php)?/?(apps/.*)?$", "", u.rstrip("/"))
    if not re.match(r"^https?://[a-z0-9.-]+(:\d+)?(/[^\s]*)?$", u, re.I):
        raise NextcloudError("Esa dirección no parece de un Nextcloud")
    return u.rstrip("/")


def _sin_acentos(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn").lower().strip()


def persona_del_equipo(nombre: str, equipo: list[dict]) -> Optional[dict]:
    """El miembro del equipo con ese nombre (entero o de pila). Función pura."""
    n = _sin_acentos(nombre)
    if not n:
        return None
    for m in equipo:
        if _sin_acentos(m.get("nombre", "")) == n:
            return m
    pila = n.split()[0]
    candidatos = [m for m in equipo if _sin_acentos(m.get("nombre", "")).split()[:1] == [pila]]
    return candidatos[0] if len(candidatos) == 1 else None


def fecha_deck(valor: Any) -> str:
    """La fecha de Deck («2026-08-17T08:00:00+00:00») a la de la escuela, en
    hora de Países Bajos («2026-08-17T10:00»)."""
    if not valor:
        return ""
    try:
        d = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return T.vence_ok(valor)
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    try:
        from zoneinfo import ZoneInfo

        d = d.astimezone(ZoneInfo("Europe/Amsterdam"))
    except Exception:  # noqa: BLE001
        pass
    return d.strftime("%Y-%m-%dT%H:%M")


def _cuando(valor: Any) -> str:
    """createdAt / lastModified de Deck (segundos) → ISO."""
    try:
        return datetime.fromtimestamp(int(valor), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return T._ahora()


class _Cliente:
    def __init__(self, base: str, usuario: str, clave: str, transporte: Any = None):
        self.base = base
        if not (usuario or "").strip() or not (clave or "").strip():
            raise NextcloudError("Escribe tu usuario de Nextcloud y una contraseña de aplicación")
        self.c = httpx.AsyncClient(
            auth=(usuario.strip(), clave.strip()),
            headers={"OCS-APIRequest": "true", "Accept": "application/json"},
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            transport=transporte,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        await self.c.aclose()

    async def get(self, ruta: str, ocs: bool = False) -> Any:
        url = f"{self.base}{OCS if ocs else API}{ruta}"
        try:
            r = await self.c.get(url)
        except httpx.HTTPError as exc:
            raise NextcloudError(f"No se ha podido hablar con {self.base}: {exc.__class__.__name__}", 502)
        if r.status_code in (401, 403):
            raise NextcloudError("Nextcloud no deja entrar: revisa el usuario y la contraseña de aplicación.", 400)
        if r.status_code == 404:
            raise NextcloudError("En esa dirección no encuentro la app Deck de Nextcloud.", 400)
        if r.status_code >= 400:
            raise NextcloudError(f"Nextcloud contestó {r.status_code}: {r.text[:200]}", 502)
        try:
            datos = r.json()
        except ValueError:
            raise NextcloudError("Nextcloud no contestó con datos (¿es la dirección buena?)", 502)
        if ocs and isinstance(datos, dict):
            datos = (datos.get("ocs") or {}).get("data")
        return datos


async def listar(url: str, usuario: str, clave: str, transporte: Any = None) -> list[dict]:
    base = base_de(url)
    async with _Cliente(base, usuario, clave, transporte) as cli:
        datos = await cli.get("/boards")
    if not isinstance(datos, list):
        raise NextcloudError("Nextcloud no ha dado la lista de tableros", 502)
    salida = []
    for b in datos:
        if not isinstance(b, dict) or b.get("deletedAt"):
            continue
        salida.append({"id": b.get("id"), "titulo": b.get("title") or "", "color": T.color_ok(b.get("color")), "archivado": bool(b.get("archived"))})
    return salida


async def _etiqueta_id(org_id: int, curso_id: int, nombre: str, color: str, cache: dict, db: AsyncSession) -> Optional[int]:
    clave = _sin_acentos(nombre)
    if not clave:
        return None
    if clave not in cache:
        e = await T.crear_etiqueta(org_id, curso_id, nombre, color, db)
        cache[clave] = e["id"]
    return cache[clave]


async def importar(
    org_id: int,
    curso_id: int,
    url: str,
    usuario: str,
    clave: str,
    tablero_ids: list[int],
    equipo: list[dict],
    autor: Any,
    db: AsyncSession,
    con_archivadas: bool = True,
    transporte: Any = None,
) -> dict:
    curso = await T._curso(org_id, curso_id, db)
    base = base_de(url)
    resumen: list[dict] = []
    etiquetas_cache = {
        _sin_acentos(e.nombre): e.id
        for e in (await db.execute(select(ProdEtiqueta).where(ProdEtiqueta.curso_id == curso.id))).scalars().all()
    }
    async with _Cliente(base, usuario, clave, transporte) as cli:
        todos = await cli.get("/boards")
        por_id = {int(b["id"]): b for b in todos if isinstance(b, dict) and str(b.get("id", "")).isdigit()}
        for bid in tablero_ids:
            b = por_id.get(int(bid))
            if b is None:
                resumen.append({"id": bid, "titulo": "", "error": "Ese tablero ya no está en Nextcloud"})
                continue
            try:
                resumen.append(await _un_tablero(org_id, curso.id, base, cli, b, equipo, autor, etiquetas_cache, con_archivadas, db))
            except NextcloudError as exc:
                await db.rollback()
                resumen.append({"id": bid, "titulo": b.get("title") or "", "error": exc.mensaje})
    return {"tableros": resumen}


async def _un_tablero(org_id, curso_id, base, cli, b, equipo, autor, etiquetas_cache, con_archivadas, db) -> dict:
    origen = f"nextcloud:{b['id']}"
    ya = (await db.execute(select(ProdTablero).where(ProdTablero.org_id == org_id, ProdTablero.origen == origen))).scalars().first()
    if ya is None:
        nuevo = await T.crear_tablero(org_id, curso_id, (b.get("title") or "Tablero de Nextcloud")[:160], T.color_ok(b.get("color")), db, columnas=[])
        tablero = await db.get(ProdTablero, nuevo["id"])
        tablero.origen = origen
        db.add(tablero)
        await db.commit()
        creado = True
    else:
        tablero = ya
        creado = False

    # Etiquetas del tablero de Deck → del curso, por nombre.
    for e in b.get("labels") or []:
        if isinstance(e, dict):
            await _etiqueta_id(org_id, curso_id, str(e.get("title") or ""), T.color_ok(e.get("color")), etiquetas_cache, db)

    stacks = await cli.get(f"/boards/{b['id']}/stacks")
    if con_archivadas:
        try:
            archivadas = await cli.get(f"/boards/{b['id']}/stacks/archived")
        except NextcloudError:
            archivadas = []
    else:
        archivadas = []

    columnas = {
        c.origen: c
        for c in (await db.execute(select(ProdColumna).where(ProdColumna.tablero_id == tablero.id))).scalars().all()
        if c.origen
    }
    origenes_tarjeta = {
        t.origen
        for t in (await db.execute(select(ProdTarjeta).where(ProdTarjeta.tablero_id == tablero.id))).scalars().all()
        if t.origen
    }
    nuevas = 0
    ya_estaban = 0
    avisos: list[str] = []

    async def columna_para(s: dict) -> ProdColumna:
        o = f"nextcloud:{s.get('id')}"
        if o not in columnas:
            c = ProdColumna(org_id=org_id, tablero_id=tablero.id, titulo=(s.get("title") or "Columna")[:80], orden=float(s.get("order") or len(columnas) + 1), origen=o)
            db.add(c)
            await db.flush()
            columnas[o] = c
        return columnas[o]

    for lista_stacks, archivada in ((stacks or [], False), (archivadas or [], True)):
        for s in sorted((x for x in lista_stacks if isinstance(x, dict)), key=lambda x: (x.get("order") or 0, x.get("id") or 0)):
            col = await columna_para(s)
            for c in sorted((x for x in (s.get("cards") or []) if isinstance(x, dict)), key=lambda x: (x.get("order") or 0, x.get("id") or 0)):
                if c.get("deletedAt"):
                    continue
                o = f"nextcloud:{c.get('id')}"
                if o in origenes_tarjeta:
                    ya_estaban += 1
                    continue
                ids_etiquetas = []
                for e in c.get("labels") or []:
                    if isinstance(e, dict):
                        i = await _etiqueta_id(org_id, curso_id, str(e.get("title") or ""), T.color_ok(e.get("color")), etiquetas_cache, db)
                        if i and i not in ids_etiquetas:
                            ids_etiquetas.append(i)
                asignados = []
                for a in c.get("assignedUsers") or []:
                    p = (a or {}).get("participant") or {}
                    nombre = (p.get("displayname") or p.get("uid") or "").strip()
                    m = persona_del_equipo(nombre, equipo)
                    if m:
                        asignados.append({"id": int(m["id"]), "nombre": m["nombre"]})
                    elif nombre:
                        asignados.append({"id": 0, "nombre": nombre[:120]})
                enlaces = await _enlaces_de_adjuntos(base, cli, b["id"], s.get("id"), c, avisos)
                hecha = c.get("done")
                tarjeta = ProdTarjeta(
                    org_id=org_id,
                    tablero_id=tablero.id,
                    columna_id=col.id,
                    titulo=(c.get("title") or "Sin título")[:300],
                    descripcion=markdown_a_html(c.get("description") or ""),
                    orden=float(c.get("order") or 0),
                    vence=fecha_deck(c.get("duedate")),
                    hecha_at=(datetime.fromisoformat(str(hecha).replace("Z", "+00:00")).isoformat() if isinstance(hecha, str) and hecha else (T._ahora() if hecha else "")),
                    archivada=bool(archivada or c.get("archived")),
                    etiquetas=json.dumps(ids_etiquetas),
                    asignados=json.dumps(asignados, ensure_ascii=False),
                    enlaces=json.dumps(enlaces, ensure_ascii=False),
                    origen=o,
                    creado_por=((c.get("owner") or {}).get("displayname") or "Nextcloud")[:120] if isinstance(c.get("owner"), dict) else "Nextcloud",
                    actualizado_por=T._nombre(autor),
                    created_at=_cuando(c.get("createdAt")),
                    updated_at=_cuando(c.get("lastModified")),
                )
                db.add(tarjeta)
                await db.flush()
                if int(c.get("commentsCount") or 0) > 0:
                    await _comentarios(org_id, cli, c.get("id"), tarjeta, avisos, db)
                origenes_tarjeta.add(o)
                nuevas += 1
    tablero.updated_at = T._ahora()
    db.add(tablero)
    await db.commit()
    return {
        "id": b["id"],
        "titulo": b.get("title") or "",
        "tablero_id": tablero.id,
        "creado": creado,
        "nuevas": nuevas,
        "ya_estaban": ya_estaban,
        "avisos": avisos[:5],
    }


async def _enlaces_de_adjuntos(base: str, cli: _Cliente, board_id: Any, stack_id: Any, c: dict, avisos: list[str]) -> list[dict]:
    if not int(c.get("attachmentCount") or 0):
        return []
    try:
        adj = await cli.get(f"/boards/{board_id}/stacks/{stack_id}/cards/{c.get('id')}/attachments")
    except NextcloudError as exc:
        avisos.append(f"Adjuntos de «{c.get('title')}»: {exc.mensaje}")
        return []
    salida = []
    for a in adj or []:
        if not isinstance(a, dict) or a.get("deletedAt"):
            continue
        ext = a.get("extendedData") or {}
        nombre = a.get("data") or (ext.get("info") or {}).get("basename") or "Archivo"
        fileid = ext.get("fileid")
        url = f"{base}/f/{fileid}" if fileid else ""
        if url:
            salida.append({"id": f"nc{a.get('id')}", "titulo": f"{nombre} (Nextcloud)"[:200], "url": url})
    return salida


async def _comentarios(org_id: int, cli: _Cliente, card_id: Any, tarjeta: ProdTarjeta, avisos: list[str], db: AsyncSession) -> None:
    try:
        coms = await cli.get(f"/cards/{card_id}/comments", ocs=True)
    except NextcloudError as exc:
        avisos.append(f"Comentarios de «{tarjeta.titulo}»: {exc.mensaje}")
        return
    n = 0
    for c in coms or []:
        if not isinstance(c, dict) or not (c.get("message") or "").strip():
            continue
        cuando = c.get("creationDateTime") or ""
        try:
            cuando = datetime.fromisoformat(str(cuando).replace("Z", "+00:00")).isoformat()
        except ValueError:
            cuando = T._ahora()
        db.add(ProdComentario(org_id=org_id, tarjeta_id=tarjeta.id, user_id=0, autor=(c.get("actorDisplayName") or c.get("actorId") or "Nextcloud")[:120], texto=str(c["message"])[:8000], created_at=cuando))
        n += 1
    tarjeta.n_comentarios = n
    db.add(tarjeta)

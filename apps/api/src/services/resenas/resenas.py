"""
Reseñas en vídeo de los alumnos, dentro de la escuela (10/11/2026).

Pedido del usuario: "un sistema de reseñas en vídeo dentro de la escuela, como
administrador… y cómo invitar a los alumnos de la beta (con un incentivo, el
acceso al Spreekuur)". Hasta hoy no había ninguna opinión real que enseñar: las
de la web se quitaron porque no lo eran. Esto es para conseguirlas bien.

Cómo funciona:

1. El administrador INVITA a los alumnos que elige (Panel → Reseñas): cada uno
   queda con una fila `invitada`, un mensaje y un regalo de agradecimiento.
   Invitar dos veces a la misma persona no crea dos filas.
2. Al alumno le sale el aviso en la campana y la página `/resena`: las cuatro
   preguntas, consejos cortos, y graba el vídeo allí mismo (cámara del
   navegador) o elige uno del móvil. SIN marcar el permiso no se guarda nada.
   Mientras no esté aprobada, puede volver a grabarla (el vídeo viejo se borra).
3. El administrador la ve, la aprueba o la descarta, apunta una nota y marca
   «regalo dado». El vídeo se baja desde el panel para subirlo donde toque.

Las reglas, que salen del plan que se le dio al usuario:

- **El regalo es un agradecimiento por el tiempo, NUNCA va condicionado a que
  la reseña sea buena.** Lo dice la pantalla del alumno, y por eso «regalo
  dado» es independiente de aprobar o descartar.
- Tope orientativo de 8 a 10 invitados (`TOPE`: la pantalla avisa, no se
  impone) y plazo de 10 días (`PLAZO_DIAS`: se enseña, no se impone: una
  reseña que llega el día 12 vale igual).
- Cuatro preguntas guía y un vídeo vertical de 60 a 90 segundos.
- **Permiso por escrito**: se guarda el texto EXACTO que el alumno aceptó
  (`PERMISO_TEXTO`), cuándo, y para qué usos (web, redes, anuncios). Si el
  texto cambia aquí, las reseñas de antes conservan el suyo.

Los vídeos son privados: `content/privado/resenas/<org>/` (dentro del volumen:
entran en la copia diaria) y `/content` nunca sirve `privado/`. Solo se bajan
por la ruta de reseñas: el alumno el suyo, los administradores todos. Los
profes y el closer, no.

El vídeo se acepta por lo que ES (mp4, mov o webm, mirando sus primeros
bytes), no por la extensión del nombre: los móviles los mandan sin extensión
(el fallo de las fotos del 08/11). Se escribe en disco a trozos, sin tener los
150 MB en memoria.

Lo que NO hace: no manda correos (la invitación va por la campana y por el
WhatsApp que el administrador copia), no publica nada en ningún sitio y no
recorta el vídeo.
"""

from __future__ import annotations

import json
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.resenas import Resena

CONTENT_DIR = Path("content")
CARPETA = "privado/resenas"
MAX_BYTES = 150 * 1024 * 1024
TROZO = 1024 * 1024

ESTADOS = ("invitada", "grabada", "aprobada", "descartada")
PLAZO_DIAS = 10
TOPE = 10
REGALO_DE_FABRICA = "Un mes de Spreekclub"

USOS = [
    {"id": "web", "nombre": "En la web de Holandés Nawar"},
    {"id": "redes", "nombre": "En las redes sociales de Holandés Nawar"},
    {"id": "anuncios", "nombre": "En anuncios de Holandés Nawar"},
]
_USOS = [u["id"] for u in USOS]

PERMISO_TEXTO = (
    "Doy permiso a Holandés Nawar para usar este vídeo, con mi imagen, mi voz y mi nombre de pila, "
    "en los sitios que marco abajo. No recibo ningún pago por ello. Puedo retirar este permiso cuando "
    "quiera escribiendo a info@holandesnawar.com, y dejarán de usarlo."
)

PREGUNTAS = [
    "¿Cómo estabas con el neerlandés antes de empezar?",
    "¿Qué te hizo decidirte por Holandés Nawar?",
    "¿Qué ha cambiado? ¿Qué puedes hacer ahora que antes no?",
    "¿A quién se lo recomendarías?",
]

CONSEJOS = [
    "Con el móvil en vertical, a la altura de los ojos.",
    "De cara a una ventana, con la luz delante y no detrás.",
    "En un sitio tranquilo, sin música de fondo.",
    "Entre 60 y 90 segundos. No hace falta que salga perfecto: como se lo contarías a una amiga.",
]

MENSAJE_DE_FABRICA = (
    "Nos encantaría que nos contaras en un vídeo corto cómo te está yendo con el neerlandés. "
    "Son cuatro preguntas y un minuto y medio, y lo grabas desde la propia escuela."
)


class ResenaError(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje, self.status = mensaje, status


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def nombre_de(user: Any) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or "Equipo"


# ── Piezas puras (con test) ─────────────────────────────────────────────────


def limpiar_usos(usos: Any) -> list[str]:
    """Los usos que valen, en su orden y sin repetir. Acepta una lista o un
    texto («web,redes» o JSON), que es como llega de un formulario."""
    if isinstance(usos, str):
        texto = usos.strip()
        try:
            usos = json.loads(texto) if texto.startswith("[") else [x.strip() for x in texto.split(",")]
        except (ValueError, TypeError):
            usos = []
    if not isinstance(usos, (list, tuple, set)):
        return []
    pedidos = {str(u).strip().lower() for u in usos}
    return [u for u in _USOS if u in pedidos]


def leer_usos(texto: Any) -> list[str]:
    try:
        return limpiar_usos(json.loads(texto or "[]"))
    except (ValueError, TypeError):
        return []


def es_si(valor: Any) -> bool:
    """Una casilla de un formulario: «true», «1», «si», «on»…"""
    if isinstance(valor, bool):
        return valor
    return str(valor or "").strip().lower() in ("1", "true", "si", "sí", "on", "yes")


def tipo_de_video(cabecera: bytes, content_type: str = "") -> Optional[tuple[str, str]]:
    """(extensión, tipo) del vídeo por lo que ES: sus primeros bytes. Si no se
    reconocen, por el tipo que dice el navegador. None = no es un vídeo que
    valga (mp4, mov o webm)."""
    c = cabecera or b""
    if c[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm", "video/webm"
    if len(c) >= 12 and c[4:8] == b"ftyp":
        return (".mov", "video/quicktime") if c[8:12] == b"qt  " else (".mp4", "video/mp4")
    # Un .mov antiguo puede empezar sin «ftyp», directamente por sus átomos.
    if len(c) >= 8 and c[4:8] in (b"moov", b"mdat", b"wide", b"free", b"skip"):
        return ".mov", "video/quicktime"
    tipo = (content_type or "").split(";")[0].strip().lower()
    if tipo == "video/webm":
        return ".webm", tipo
    if tipo == "video/quicktime":
        return ".mov", tipo
    if tipo in ("video/mp4", "video/x-m4v"):
        return ".mp4", "video/mp4"
    return None


def plazo_de(invitada_at: str, hoy: Optional[date] = None) -> dict:
    """Hasta qué día se le pidió (10 días) y cuántos le quedan. Solo se enseña."""
    try:
        dia = datetime.fromisoformat(invitada_at).date()
    except (ValueError, TypeError):
        return {"hasta": "", "quedan": None}
    hasta = dia + timedelta(days=PLAZO_DIAS)
    return {"hasta": hasta.isoformat(), "quedan": (hasta - (hoy or datetime.now(timezone.utc).date())).days}


def puede_ver_video(r: Resena, user_id: int, admin: bool) -> bool:
    """El alumno, el suyo; los administradores, todos. Nadie más."""
    return bool(admin) or (bool(user_id) and int(r.user_id) == int(user_id))


def cifras(filas: Iterable[dict]) -> dict:
    filas = list(filas)
    return {
        "invitadas": sum(1 for r in filas if r["estado"] == "invitada"),
        "por_revisar": sum(1 for r in filas if r["estado"] == "grabada"),
        "aprobadas": sum(1 for r in filas if r["estado"] == "aprobada"),
        "descartadas": sum(1 for r in filas if r["estado"] == "descartada"),
        # El regalo se debe a quien GRABÓ, guste o no la reseña.
        "regalos_por_dar": sum(1 for r in filas if r["tiene_video"] and r["regalo"] and not r["regalo_dado_at"]),
        "total": len(filas),
    }


def texto_whatsapp(nombre: str, regalo: str, enlace: str) -> str:
    """La invitación para mandar por WhatsApp, ya escrita. El regalo se
    presenta como agradecimiento, no a cambio de una reseña buena."""
    pila = (nombre or "").strip().split(" ")[0]
    saludo = f"Hola {pila}," if pila else "Hola,"
    lineas = [
        f"{saludo} soy del equipo de Holandés Nawar.",
        "",
        "Nos encantaría que nos contaras en un vídeo corto (un minuto y medio) cómo te está yendo con el "
        "neerlandés. Son cuatro preguntas y lo grabas desde la propia escuela, con el móvil:",
        enlace,
        "",
        "Cuenta lo que piensas de verdad, lo bueno y lo que mejorarías.",
    ]
    if (regalo or "").strip():
        lineas.append(f"Como agradecimiento por tu tiempo: {regalo.strip().rstrip('.')}.")
    lineas.append(f"Si puedes, en los próximos {PLAZO_DIAS} días. ¡Gracias!")
    return "\n".join(lineas)


def enlace_resena() -> str:
    try:
        from src.services.users.emails import _school_url

        return _school_url().rstrip("/") + "/resena"
    except Exception:  # noqa: BLE001
        return "/resena"


def resena_dict(r: Resena, para_admin: bool = False) -> dict:
    d = {
        "id": r.id,
        "user_id": r.user_id,
        "nombre": r.nombre,
        "estado": r.estado if r.estado in ESTADOS else "invitada",
        "tiene_video": bool(r.video),
        "video_seg": r.video_seg or 0,
        "video_bytes": r.video_bytes or 0,
        "video_mime": r.video_mime or "",
        "texto": r.texto or "",
        "permiso": bool(r.permiso),
        "permiso_texto": r.permiso_texto or "",
        "permiso_at": r.permiso_at or "",
        "usos": leer_usos(r.usos),
        "mensaje": r.mensaje or "",
        "invitada_at": r.invitada_at or "",
        "grabada_at": r.grabada_at or "",
        "regalo": r.regalo or "",
        "regalo_dado_at": r.regalo_dado_at or "",
        "plazo": plazo_de(r.invitada_at or ""),
    }
    if para_admin:
        d.update(
            {
                "invitada_por": r.invitada_por or "",
                "revisada_at": r.revisada_at or "",
                "revisada_por": r.revisada_por or "",
                "nota": r.nota or "",
                "whatsapp": texto_whatsapp(r.nombre, r.regalo or "", enlace_resena()),
            }
        )
    return d


def guia() -> dict:
    """Lo que la pantalla del alumno enseña: sale de aquí para que el texto
    del permiso que se guarda sea el mismo que leyó."""
    return {
        "preguntas": PREGUNTAS,
        "consejos": CONSEJOS,
        "permiso_texto": PERMISO_TEXTO,
        "usos": USOS,
        "plazo_dias": PLAZO_DIAS,
        "max_mb": MAX_BYTES // (1024 * 1024),
    }


# ── Archivos ────────────────────────────────────────────────────────────────


def ruta_segura(relativa: str) -> Optional[Path]:
    """La ruta en disco de un vídeo, solo si está dentro de privado/resenas/."""
    if not relativa or ".." in relativa or relativa.startswith("/") or not relativa.startswith(CARPETA + "/"):
        return None
    base = CONTENT_DIR.resolve()
    ruta = (base / relativa).resolve()
    return ruta if str(ruta).startswith(str(base)) else None


def _borrar(relativa: str) -> None:
    ruta = ruta_segura(relativa or "")
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


async def guardar_video(org_id: int, archivo: Any) -> tuple[str, str, int]:
    """Escribe el vídeo en disco a trozos y devuelve (ruta relativa, tipo,
    bytes). `archivo` es lo que da FastAPI (`UploadFile`): algo con
    `await read(n)` y `content_type`."""
    if archivo is None:
        raise ResenaError("Falta el vídeo")
    cabecera = await archivo.read(TROZO)
    if not cabecera:
        raise ResenaError("El vídeo está vacío. Vuelve a grabarlo o elige otro.")
    tipo = tipo_de_video(cabecera[:64], getattr(archivo, "content_type", "") or "")
    if tipo is None:
        raise ResenaError("Ese archivo no parece un vídeo. Vale MP4, MOV (el del iPhone) o WEBM.", 415)
    ext, mime = tipo
    relativa = f"{CARPETA}/{org_id}/{_uuid.uuid4().hex}{ext}"
    ruta = CONTENT_DIR / relativa
    ruta.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    try:
        with ruta.open("wb") as f:
            trozo = cabecera
            while trozo:
                total += len(trozo)
                if total > MAX_BYTES:
                    raise ResenaError(
                        f"El vídeo pesa más de {MAX_BYTES // (1024 * 1024)} MB. Grábalo más corto (60-90 segundos) "
                        "o con menos calidad.",
                        413,
                    )
                f.write(trozo)
                trozo = await archivo.read(TROZO)
    except ResenaError:
        ruta.unlink(missing_ok=True)
        raise
    except OSError as exc:
        ruta.unlink(missing_ok=True)
        raise ResenaError("No se pudo guardar el vídeo. Inténtalo otra vez.", 500) from exc
    return relativa, mime, total


def video_de(r: Resena) -> Optional[tuple[Path, str, str]]:
    """(ruta en disco, tipo, nombre para bajarlo)."""
    ruta = ruta_segura(r.video or "")
    if ruta is None or not ruta.is_file():
        return None
    pila = "".join(ch for ch in (r.nombre or "").split(" ")[0] if ch.isalnum()) or "alumno"
    return ruta, r.video_mime or "video/mp4", f"Resena-{pila}{ruta.suffix}"


# ── Base de datos ───────────────────────────────────────────────────────────


async def _una(org_id: int, resena_id: int, db_session: AsyncSession) -> Resena:
    r = (
        await db_session.execute(select(Resena).where(Resena.id == resena_id, Resena.org_id == org_id))
    ).scalars().first()
    if r is None:
        raise ResenaError("Esa reseña ya no está", 404)
    return r


async def _guardar(r: Resena, db_session: AsyncSession) -> Resena:
    r.updated_at = _ahora()
    db_session.add(r)
    await db_session.commit()
    await db_session.refresh(r)
    return r


async def de_la_escuela(org_id: int, db_session: AsyncSession) -> list[Resena]:
    return list(
        (
            await db_session.execute(select(Resena).where(Resena.org_id == org_id).order_by(Resena.id.desc()))  # type: ignore[attr-defined]
        ).scalars().all()
    )


async def listar(org_id: int, db_session: AsyncSession) -> dict:
    """Todo lo del panel: las reseñas (lo más reciente arriba) y sus cifras."""
    filas = [resena_dict(r, para_admin=True) for r in await de_la_escuela(org_id, db_session)]
    filas.sort(key=lambda r: r["grabada_at"] or r["invitada_at"] or "", reverse=True)
    return {
        "resenas": filas,
        "cifras": cifras(filas),
        "tope": TOPE,
        "plazo_dias": PLAZO_DIAS,
        "regalo": REGALO_DE_FABRICA,
        "mensaje": MENSAJE_DE_FABRICA,
        "enlace": enlace_resena(),
        "usos": USOS,
    }


async def alumnos_de(org_id: int, db_session: AsyncSession) -> list[dict]:
    """Los alumnos de verdad (rol 4), sin Testers ni quien está fuera de los
    números, con cuándo entraron."""
    from src.db.user_organizations import UserOrganization
    from src.db.users import User
    from src.security.rbac.constants import STUDENT_ROLE_ID
    from src.services.contactos.metricas import ids_excluidos
    from src.services.panel.testers import ids_testers

    fuera = await ids_excluidos(db_session) | await ids_testers(org_id, db_session)
    filas = (
        await db_session.execute(
            select(UserOrganization, User)
            .join(User, User.id == UserOrganization.user_id)
            .where(UserOrganization.org_id == org_id, UserOrganization.role_id == STUDENT_ROLE_ID)
        )
    ).all()
    return [
        {
            "user_id": int(m.user_id),
            "nombre": " ".join(x for x in [u.first_name, u.last_name] if x).strip() or u.username,
            "email": (u.email or "").strip().lower(),
            "entro": str(m.creation_date or ""),
        }
        for m, u in filas
        if m.user_id not in fuera
    ]


def dias_desde(texto: str, hoy: Optional[date] = None) -> Optional[int]:
    """Días desde una fecha guardada en texto («2026-10-03 14:22:11…»)."""
    try:
        dia = date.fromisoformat(str(texto or "")[:10])
    except ValueError:
        return None
    return max(0, ((hoy or datetime.now(timezone.utc).date()) - dia).days)


async def invitables(org_id: int, db_session: AsyncSession) -> list[dict]:
    """A quién se puede invitar: cada alumno con su avance en la formación,
    cuánto lleva en la escuela y si ya tiene una reseña (y en qué estado).
    Arriba, quien más ha avanzado: es quien más tiene que contar."""
    alumnos = await alumnos_de(org_id, db_session)
    avance: dict[int, dict] = {}
    try:
        from src.services.panel.avance import avance_formacion

        avance = await avance_formacion(db_session, [a["user_id"] for a in alumnos])
    except Exception:  # noqa: BLE001 — sin avance, la lista sale igual
        avance = {}
    ya = {int(r.user_id): r for r in await de_la_escuela(org_id, db_session)}
    out = []
    for a in alumnos:
        av = avance.get(a["user_id"]) or {}
        r = ya.get(a["user_id"])
        out.append(
            {
                **a,
                "dias": dias_desde(a["entro"]),
                "hechas": av.get("hechas", 0),
                "total": av.get("total", 0),
                "pct": av.get("pct", 0),
                "resena": (r.estado if r else ""),
            }
        )
    out.sort(key=lambda a: (-a["pct"], a["nombre"].lower()))
    return out


async def invitar(
    org_id: int, user_ids: Iterable[Any], mensaje: str, regalo: str, autor: str, db_session: AsyncSession
) -> dict:
    """Invita a los alumnos elegidos. Quien ya tenía una reseña no se toca
    (repetir no duplica ni borra un vídeo ya grabado): solo se le actualiza
    el mensaje y el regalo si sigue sin grabar. Quien no es alumno de la
    escuela se ignora."""
    pedidos: list[int] = []
    for u in user_ids or []:
        try:
            n = int(u)
        except (TypeError, ValueError):
            continue
        if n and n not in pedidos:
            pedidos.append(n)
    if not pedidos:
        raise ResenaError("Elige al menos a un alumno")
    alumnos = {a["user_id"]: a for a in await alumnos_de(org_id, db_session)}
    ya = {int(r.user_id): r for r in await de_la_escuela(org_id, db_session)}
    mensaje = (mensaje or "").strip()[:1500] or MENSAJE_DE_FABRICA
    regalo = (regalo or "").strip()[:200]
    ahora = _ahora()
    nuevas, repetidas = 0, 0
    for uid in pedidos:
        a = alumnos.get(uid)
        if a is None:
            continue
        r = ya.get(uid)
        if r is not None:
            repetidas += 1
            if r.estado == "invitada":
                r.mensaje, r.regalo, r.updated_at = mensaje, regalo, ahora
                db_session.add(r)
            continue
        nuevas += 1
        db_session.add(
            Resena(
                org_id=org_id,
                user_id=uid,
                nombre=a["nombre"][:160],
                estado="invitada",
                mensaje=mensaje,
                regalo=regalo,
                invitada_por=(autor or "")[:120],
                invitada_at=ahora,
                created_at=ahora,
                updated_at=ahora,
            )
        )
    await db_session.commit()
    return {"nuevas": nuevas, "repetidas": repetidas, **(await listar(org_id, db_session))}


async def mia(user_id: int, db_session: AsyncSession) -> Optional[Resena]:
    """La reseña (o invitación) de este alumno. La más reciente, si hubiera
    más de una escuela."""
    return (
        await db_session.execute(select(Resena).where(Resena.user_id == user_id).order_by(Resena.id.desc()))  # type: ignore[attr-defined]
    ).scalars().first()


async def mia_para_la_pantalla(user_id: int, db_session: AsyncSession) -> dict:
    r = await mia(user_id, db_session)
    return {"resena": resena_dict(r) if r else None, **guia()}


async def grabar(
    user_id: int,
    archivo: Any,
    texto: str,
    permiso: Any,
    usos: Any,
    segundos: Any,
    db_session: AsyncSession,
) -> dict:
    """El alumno manda su vídeo. Hace falta estar invitado, que no esté ya
    aprobada, el permiso marcado y al menos un uso. El vídeo anterior se borra
    cuando el nuevo ya está guardado."""
    r = await mia(user_id, db_session)
    # Una invitación que el equipo descartó antes de grabar es una invitación
    # retirada: como no tener ninguna.
    if r is None or (r.estado == "descartada" and not r.video):
        raise ResenaError("Todavía no te hemos pedido una reseña. Si quieres dejarnos una, escríbenos por Mensajes.", 403)
    if r.estado == "aprobada":
        raise ResenaError("Tu reseña ya está aprobada. Si quieres cambiarla, escríbenos por Mensajes.", 409)
    if not es_si(permiso):
        raise ResenaError("Para guardar el vídeo hace falta que marques la casilla del permiso.")
    elegidos = limpiar_usos(usos)
    if not elegidos:
        raise ResenaError("Marca al menos un sitio donde nos dejas usar el vídeo.")
    relativa, mime, total = await guardar_video(r.org_id, archivo)
    viejo = r.video
    try:
        seg = max(0, min(int(float(segundos or 0)), 3600))
    except (TypeError, ValueError):
        seg = 0
    ahora = _ahora()
    r.video, r.video_mime, r.video_bytes, r.video_seg = relativa, mime, total, seg
    r.texto = (texto or "").strip()[:3000]
    r.permiso, r.permiso_texto, r.permiso_at = True, PERMISO_TEXTO, ahora
    r.usos = json.dumps(elegidos)
    r.estado, r.grabada_at = "grabada", ahora
    # Una reseña descartada que se vuelve a grabar pide otra revisión.
    r.revisada_at, r.revisada_por = "", ""
    try:
        await _guardar(r, db_session)
    except Exception:
        _borrar(relativa)
        raise
    if viejo and viejo != relativa:
        _borrar(viejo)
    return {"resena": resena_dict(r), **guia()}


async def revisar(org_id: int, resena_id: int, estado: str, autor: str, db_session: AsyncSession) -> dict:
    """Aprobar, descartar o devolver a pendiente (`grabada` si tiene vídeo,
    `invitada` si no). Sin vídeo no se puede aprobar."""
    r = await _una(org_id, resena_id, db_session)
    if estado == "pendiente":
        estado = "grabada" if r.video else "invitada"
    if estado not in ESTADOS:
        raise ResenaError("Ese estado no existe")
    if estado in ("aprobada", "grabada") and not r.video:
        raise ResenaError("Todavía no ha grabado el vídeo")
    if estado == "aprobada" and not r.permiso:
        raise ResenaError("No se puede aprobar sin su permiso")
    r.estado = estado
    if estado in ("aprobada", "descartada"):
        r.revisada_at, r.revisada_por = _ahora(), (autor or "")[:120]
    else:
        r.revisada_at, r.revisada_por = "", ""
    return resena_dict(await _guardar(r, db_session), para_admin=True)


async def cambiar(org_id: int, resena_id: int, datos: dict, db_session: AsyncSession) -> dict:
    """La nota del equipo, el regalo y «regalo dado» (true/false)."""
    r = await _una(org_id, resena_id, db_session)
    if "nota" in datos and datos["nota"] is not None:
        r.nota = str(datos["nota"]).strip()[:3000]
    if "regalo" in datos and datos["regalo"] is not None:
        r.regalo = str(datos["regalo"]).strip()[:200]
    if "regalo_dado" in datos and datos["regalo_dado"] is not None:
        r.regalo_dado_at = _ahora() if datos["regalo_dado"] else ""
    return resena_dict(await _guardar(r, db_session), para_admin=True)


async def borrar(org_id: int, resena_id: int, db_session: AsyncSession) -> None:
    """Borra la reseña (o la invitación) y su vídeo del disco."""
    r = await _una(org_id, resena_id, db_session)
    video = r.video
    await db_session.delete(r)
    await db_session.commit()
    _borrar(video)


# ── La campana ──────────────────────────────────────────────────────────────


async def avisos_para(user_id: int, org_id: int, db_session: AsyncSession) -> list[dict]:
    """Los avisos de reseñas para la campana, con la forma de los de las
    tareas (`id`, `kind`, `title`, `excerpt`, `url`, `date`). Sin correo.

    - Al alumno invitado: «Nos encantaría tu opinión en vídeo», hasta que la
      graba. El id lleva la fecha de la invitación.
    - A los administradores: «N reseñas por revisar». El id lleva la fecha de
      la última, para que quitarlo no lo silencie para siempre.
    """
    out: list[dict] = []
    r = (
        await db_session.execute(
            select(Resena).where(Resena.user_id == user_id, Resena.org_id == org_id, Resena.estado == "invitada")
        )
    ).scalars().first()
    if r is not None:
        regalo = f" Como agradecimiento: {r.regalo.rstrip('.')}." if (r.regalo or "").strip() else ""
        out.append(
            {
                "id": f"resena:{r.id}:{r.invitada_at}",
                "kind": "resena",
                "title": "Nos encantaría tu opinión en vídeo",
                "excerpt": "Cuatro preguntas y un minuto y medio, desde la propia escuela." + regalo,
                "url": "/resena",
                "date": r.invitada_at or r.created_at or "",
            }
        )
    admin = False
    try:
        from src.security.superadmin import is_user_superadmin
        from src.services.courses.locks import is_org_admin

        admin = await is_user_superadmin(user_id, db_session) or await is_org_admin(user_id, org_id, db_session)
    except Exception:  # noqa: BLE001
        admin = False
    if admin:
        pendientes = list(
            (
                await db_session.execute(select(Resena).where(Resena.org_id == org_id, Resena.estado == "grabada"))
            ).scalars().all()
        )
        if pendientes:
            ultima = max(pendientes, key=lambda p: p.grabada_at or "")
            n = len(pendientes)
            out.append(
                {
                    "id": f"resenas-revisar:{org_id}:{ultima.grabada_at}",
                    "kind": "resenas",
                    "title": "1 reseña por revisar" if n == 1 else f"{n} reseñas por revisar",
                    "excerpt": "La última, de " + (ultima.nombre or "un alumno") + ".",
                    "url": "/dash/estadisticas?tab=resenas",
                    "date": ultima.grabada_at or "",
                }
            )
    return out

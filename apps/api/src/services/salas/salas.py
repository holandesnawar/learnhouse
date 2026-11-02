"""
Salas en directo DENTRO de la escuela, con Daily (27/10/2026).

Pedido del usuario: "el Spreekclub estilo YouTalk, con las salas integradas:
la gente se une y ya está en la sala, dentro de la escuela, sin otra pestaña y
con su nombre puesto". Se empieza solo con el Spreekclub, para probar.

Por qué Daily y no Zoom dentro de la web: Daily está hecho para meterlo en una
página (un iframe con su pantalla, «Daily Prebuilt»), va en el navegador del
móvil sin instalar nada y se paga por minuto usado. El SDK de Zoom pesa, va
peor en el iPhone, pide cabeceras de seguridad que romperían la caja de pago y
los vídeos de Bunny, y cada profe a la vez necesita su licencia.

Cómo va
-------
- **Una sala fija por curso** (`nombre_sala`: `nawar-` + el principio del
  uuid del curso). Se crea en Daily la primera vez que alguien entra y luego se
  reutiliza. Es PRIVADA: sin una entrada firmada por la escuela no se entra,
  así que el enlace no sirve para un amigo (con Zoom, sí).
- **La entrada** (un «meeting token» de Daily) la fabrica la escuela al pulsar
  «Entrar a la sala», solo a quien puede ver ese curso (la misma comprobación
  que la página del curso). Lleva su nombre (`user_name`), así que nadie lo
  escribe, y caduca a las 4 h con expulsión (`eject_at_token_exp`): una
  pestaña olvidada no se queda gastando minutos toda la noche.
- **El equipo** (administradores, moderadores y profes, `STAFF_ROLE_IDS`) entra
  como anfitrión (`is_owner`): silencia, saca a alguien, comparte pantalla.
- **Grabar** (02/11/2026: "la idea es que al entrar alguien, quien sea, ya
  se grabe, sin hacer nada más"): **de serie se graba** (solo deja de grabarse
  si alguien quita la casilla) y la entrada de CUALQUIERA lleva
  `start_cloud_recording`: la grabación arranca con el primero que entra y se
  para cuando se vacía la sala. Antes solo grababa la entrada del equipo y la
  casilla venía quitada, así que una sala encendida sin marcarla no grababa
  nada. La sala tiene además `enable_recording: "cloud"` (se le pone a las
  que ya existían la primera vez que alguien entra). Se paga aparte en Daily.
  Si Daily no deja grabar (plan, cuenta…), la entrada se repite SIN grabar y
  la pantalla enseña el motivo tal cual: la clase no se queda sin sala por la
  grabación. Dentro de la sala, la pantalla escucha a Daily y dice
  «● Grabando» o por qué no graba (`SalaPage.tsx`).
- Las grabaciones se quedan en Daily y el equipo las ve en la página del
  curso con «Descargar» (`grabaciones`, `enlace_descarga`). Subirlas solas
  a Bunny es el paso siguiente, sin hacer.

Ajustes: org_config `salas` = {uuid del curso (sin `course_`): {activo,
grabar}}. Sin nada guardado, la sala está apagada: se enciende curso a curso
desde la propia página del curso. Desde el 02/11/2026 la enciende, la apaga,
cambia el recuadro y baja las grabaciones **el equipo** (también los profes);
la etiqueta («Groep rood») sigue siendo solo de administradores.

La clave es `LEARNHOUSE_DAILY_API_KEY` (Railway). Sin ella, la pantalla dice
que falta y el resto de la escuela sigue igual. Los errores de Daily se
enseñan con SU texto: lo primero cuando algo falla es leer el motivo.
"""

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig

logger = logging.getLogger(__name__)

API = "https://api.daily.co/v1"
CLAVE = "salas"
HORAS_ENTRADA = 4
# La URL de cada sala, para no preguntársela a Daily en cada entrada.
_salas: dict[str, str] = {}


class SalaError(Exception):
    """Un fallo que se le enseña tal cual a quien entra (con el texto de Daily)."""

    def __init__(self, mensaje: str, status: int = 502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def clave_api() -> str:
    return (os.environ.get("LEARNHOUSE_DAILY_API_KEY") or "").strip()


# ── Lógica pura (con test) ──────────────────────────────────────────────────


def uuid_curso(course_uuid: str) -> str:
    """El uuid sin el prefijo `course_` de la base de datos."""
    return re.sub(r"^course_", "", str(course_uuid or "").strip())


def nombre_sala(course_uuid: str) -> str:
    """`nawar-` + 16 letras del uuid: fijo para cada curso y válido en Daily
    (letras, números y guiones)."""
    limpio = re.sub(r"[^a-z0-9]", "", uuid_curso(course_uuid).lower())
    return f"nawar-{limpio[:16]}"


def leer_config(config: Any, course_uuid: str) -> dict:
    """Los ajustes de la sala de un curso. Apagada si no hay nada guardado, y
    grabando salvo que alguien lo haya quitado (02/11/2026)."""
    todas = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid_curso(course_uuid)) if isinstance(todas, dict) else None
    propia = propia if isinstance(propia, dict) else {}
    return {"activo": bool(propia.get("activo")), "grabar": propia.get("grabar") is not False}


def nombre_visible(first_name: str, last_name: str, username: str) -> str:
    """El nombre con el que se entra: nombre y apellido; si no hay, el usuario."""
    nombre = " ".join(p.strip() for p in (first_name or "", last_name or "") if p and p.strip())
    return (nombre or (username or "").strip() or "Alumno")[:60]


def propiedades_entrada(sala: str, nombre: str, user_id: int, anfitrion: bool, grabar: bool, ahora: float) -> dict:
    """Lo que lleva la entrada de Daily. Con la grabación puesta, la de
    CUALQUIERA arranca la grabación al entrar (02/11/2026): la empieza el
    primero que llega, sea quien sea."""
    props: dict = {
        "room_name": sala,
        "user_name": nombre,
        "user_id": str(user_id),
        "is_owner": bool(anfitrion),
        "lang": "es",
        "exp": int(ahora) + HORAS_ENTRADA * 3600,
        "eject_at_token_exp": True,
    }
    if grabar:
        props["enable_recording"] = "cloud"
        props["start_cloud_recording"] = True
    return props


def presentes_de(respuesta: Any) -> list[str]:
    """Los nombres de quien está ahora en la sala (respuesta de `/presence`)."""
    filas = (respuesta or {}).get("data") if isinstance(respuesta, dict) else None
    nombres = []
    for f in filas or []:
        if isinstance(f, dict):
            n = str(f.get("userName") or f.get("user_name") or "").strip()
            nombres.append(n or "Alguien")
    return nombres


def grabacion_de(r: dict) -> dict:
    """Una grabación de Daily en lo que enseña la pantalla."""
    inicio = r.get("start_ts")
    try:
        cuando = datetime.fromtimestamp(int(inicio), tz=timezone.utc).isoformat() if inicio else ""
    except (TypeError, ValueError):
        cuando = ""
    return {
        "id": str(r.get("id") or ""),
        "inicio": cuando,
        "duracion_seg": int(r.get("duration") or 0),
        "estado": str(r.get("status") or ""),
        "personas": int(r.get("max_participants") or 0),
    }


def motivo_daily(cuerpo: Any, status: int) -> str:
    """El texto que da Daily cuando algo falla, para enseñarlo tal cual."""
    if isinstance(cuerpo, dict):
        partes = [str(cuerpo.get(k)) for k in ("error", "info") if cuerpo.get(k)]
        if partes:
            return f"Daily ({status}): " + " · ".join(partes)
    return f"Daily ({status}): {str(cuerpo)[:300]}" if cuerpo else f"Daily respondió {status}"


# ── Hablar con Daily ────────────────────────────────────────────────────────


async def _daily(metodo: str, ruta: str, cuerpo: Optional[dict] = None, params: Optional[dict] = None) -> dict:
    clave = clave_api()
    if not clave:
        raise SalaError("Falta la clave de Daily: LEARNHOUSE_DAILY_API_KEY en Railway.", 503)
    try:
        async with httpx.AsyncClient(timeout=12) as cliente:
            r = await cliente.request(
                metodo,
                f"{API}{ruta}",
                json=cuerpo,
                params=params,
                headers={"Authorization": f"Bearer {clave}"},
            )
    except httpx.HTTPError as exc:
        raise SalaError(f"No se pudo hablar con Daily: {exc.__class__.__name__}", 502) from exc
    try:
        datos = r.json()
    except ValueError:
        datos = r.text
    if r.status_code >= 400:
        raise SalaError(motivo_daily(datos, r.status_code), r.status_code)
    return datos if isinstance(datos, dict) else {}


async def asegurar_sala(sala: str) -> str:
    """La dirección de la sala; la crea en Daily si aún no existe."""
    if sala in _salas:
        return _salas[sala]
    try:
        datos = await _daily("GET", f"/rooms/{sala}")
    except SalaError as exc:
        if exc.status != 404:
            raise
        datos = await _daily(
            "POST",
            "/rooms",
            {
                "name": sala,
                "privacy": "private",
                "properties": {
                    "lang": "es",
                    "enable_prejoin_ui": True,
                    "enable_screenshare": True,
                    "enable_chat": True,
                    "enable_recording": "cloud",
                },
            },
        )
    else:
        # Las salas creadas antes del 02/11 no tenían la grabación en la sala:
        # se les pone una vez. En blando: si falla, la entrada la lleva igual.
        propiedades = datos.get("config") if isinstance(datos.get("config"), dict) else {}
        if propiedades.get("enable_recording") != "cloud":
            try:
                await _daily("POST", f"/rooms/{sala}", {"properties": {"enable_recording": "cloud"}})
            except SalaError as exc:
                logger.warning("No se pudo poner la grabación en la sala %s: %s", sala, exc.mensaje)
    url = str(datos.get("url") or "")
    if not url:
        raise SalaError("Daily no devolvió la dirección de la sala.")
    _salas[sala] = url
    return url


async def entrar(course_uuid: str, user, anfitrion: bool, grabar: bool) -> dict:
    """La dirección y la entrada para meter a esta persona en la sala."""
    sala = nombre_sala(course_uuid)
    url = await asegurar_sala(sala)
    nombre = nombre_visible(getattr(user, "first_name", ""), getattr(user, "last_name", ""), getattr(user, "username", ""))
    props = propiedades_entrada(sala, nombre, user.id, anfitrion, grabar, time.time())
    aviso = ""
    try:
        datos = await _daily("POST", "/meeting-tokens", {"properties": props})
    except SalaError as exc:
        if not props.get("start_cloud_recording") or exc.status >= 500:
            raise
        # Daily no deja grabar (plan, cuenta…): se entra igual, sin grabar, y
        # se dice por qué. La clase no se queda sin sala por la grabación.
        logger.warning("Daily no dejó grabar: %s", exc.mensaje)
        aviso = f"No se está grabando. {exc.mensaje}"
        props = {k: v for k, v in props.items() if k not in ("enable_recording", "start_cloud_recording")}
        datos = await _daily("POST", "/meeting-tokens", {"properties": props})
    token = str(datos.get("token") or "")
    if not token:
        raise SalaError("Daily no devolvió la entrada a la sala.")
    return {
        "url": url,
        "token": token,
        "nombre": nombre,
        "anfitrion": bool(anfitrion),
        "grabando": bool(props.get("start_cloud_recording")),
        "aviso": aviso,
    }


async def presentes(course_uuid: str) -> list[str]:
    """Quién está ahora dentro. En blando: si Daily falla, lista vacía."""
    try:
        return presentes_de(await _daily("GET", f"/rooms/{nombre_sala(course_uuid)}/presence"))
    except SalaError as exc:
        if exc.status != 404:
            logger.info("Presencia de la sala: %s", exc.mensaje)
        return []


async def grabaciones(course_uuid: str) -> list[dict]:
    datos = await _daily("GET", "/recordings", params={"room_name": nombre_sala(course_uuid), "limit": 50})
    filas = [grabacion_de(r) for r in (datos.get("data") or []) if isinstance(r, dict)]
    return sorted(filas, key=lambda g: g["inicio"], reverse=True)


async def enlace_descarga(course_uuid: str, grabacion_id: str) -> str:
    """Enlace de descarga (caduca en Daily al rato). Solo de una grabación de
    ESTA sala."""
    if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", grabacion_id or ""):
        raise SalaError("Grabación no válida.", 400)
    info = await _daily("GET", f"/recordings/{grabacion_id}")
    if str(info.get("room_name") or "") != nombre_sala(course_uuid):
        raise SalaError("Esa grabación no es de este curso.", 404)
    datos = await _daily("GET", f"/recordings/{grabacion_id}/access-link")
    enlace = str(datos.get("download_link") or "")
    if not enlace:
        raise SalaError("Daily no dio el enlace de descarga (¿la grabación aún se está procesando?).", 409)
    return enlace


# ── Ajustes (org_config) ────────────────────────────────────────────────────


async def _fila_config(org_id: int, db_session: AsyncSession) -> Optional[OrganizationConfig]:
    return (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()


async def config_de(org_id: int, course_uuid: str, db_session: AsyncSession) -> dict:
    fila = await _fila_config(org_id, db_session)
    return leer_config(fila.config if fila else {}, course_uuid)


async def _escribir(org_id: int, course_uuid: str, cambios: dict, db_session: AsyncSession) -> dict:
    """Mezcla `cambios` en lo guardado de ese curso (sin perder lo demás:
    el recuadro, `directo`…) y devuelve lo que queda guardado."""
    fila = await _fila_config(org_id, db_session)
    if fila is None:
        raise SalaError("La escuela no tiene configuración.", 500)
    config = json.loads(json.dumps(fila.config or {}))
    todas = config.get(CLAVE) if isinstance(config.get(CLAVE), dict) else {}
    uuid = uuid_curso(course_uuid)
    propia = todas.get(uuid) if isinstance(todas.get(uuid), dict) else {}
    propia = {**propia, **cambios}
    todas[uuid] = propia
    config[CLAVE] = todas
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    await _olvidar_cache(org_id, db_session)
    return propia


async def _olvidar_cache(org_id: int, db_session: AsyncSession) -> None:
    """El navegador lee estos ajustes de la configuración de la escuela, que
    Redis guarda 2 minutos: se borra para que el cambio se vea al recargar."""
    try:
        from src.db.organizations import Organization
        from src.services.orgs.cache import invalidate_org_cache, invalidate_org_config_cache

        invalidate_org_config_cache(org_id)
        org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
        if org is not None:
            invalidate_org_cache(org.slug)
    except Exception:  # noqa: BLE001 — sin caché, se ve a los 2 minutos igual
        logger.debug("No se pudo borrar la caché de la escuela", exc_info=True)


async def guardar_config(
    org_id: int,
    course_uuid: str,
    activo: Optional[bool],
    grabar: Optional[bool],
    db_session: AsyncSession,
    grabadas: Optional[bool] = None,
    etiqueta: Optional[str] = None,
) -> dict:
    """Encender/apagar la sala y la grabación. Encenderla marca además el curso
    como de clases en directo (`directo`), y eso se queda al apagarla: así el
    curso no vuelve a pintarse como una formación con «Empezar curso»
    (`esCursoEnDirecto` en apps/web/lib/nawar/cursos.ts).

    `grabadas` (27/10/2026): si la página del curso enseña sus clases grabadas
    («Sesiones grabadas» y «Clases anteriores»). Sin guardar, solo la clase
    semanal de siempre (`conGrabadas` en el mismo archivo del navegador).

    `etiqueta` (29/10/2026): un rótulo que solo ven los administradores, junto
    al nombre en la barra y en la página («Groep rood», «Groep blauw»), para
    distinguir dos copias de la misma clase. Los alumnos no lo ven."""
    cambios: dict = {}
    if activo is not None:
        cambios["activo"] = bool(activo)
        if activo:
            cambios["directo"] = True
    if grabar is not None:
        cambios["grabar"] = bool(grabar)
    if grabadas is not None:
        cambios["grabadas"] = bool(grabadas)
    if etiqueta is not None:
        cambios["etiqueta"] = limpiar_etiqueta(etiqueta)
    guardado = await _escribir(org_id, course_uuid, cambios, db_session)
    salida = {"activo": bool(guardado.get("activo")), "grabar": guardado.get("grabar") is not False}
    if isinstance(guardado.get("grabadas"), bool):
        salida["grabadas"] = guardado["grabadas"]
    if etiqueta is not None or guardado.get("etiqueta"):
        salida["etiqueta"] = str(guardado.get("etiqueta") or "")
    return salida


def limpiar_etiqueta(texto: Any) -> str:
    """Una línea corta (pura)."""
    return " ".join(str(texto or "").split())[:30]


def nombre_con_etiqueta(config: Any, course_uuid: str, nombre: str) -> str:
    """«Clase semanal · Groep rood» en las listas del equipo (Seguimiento,
    Tandas, Camino), donde dos copias de la misma clase se llamarían igual.
    Los alumnos no ven estas listas. Pura."""
    todas = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid_curso(course_uuid)) if isinstance(todas, dict) else None
    etiqueta = limpiar_etiqueta(propia.get("etiqueta")) if isinstance(propia, dict) else ""
    return f"{nombre} · {etiqueta}" if etiqueta else nombre


# ── Duplicar una clase en directo (29/10/2026) ──────────────────────────────
#
# «Si duplico ese curso, ¿se queda todo igual?». El «Duplicar» de LearnHouse
# copia capítulos, clases y archivos, pero no lo que la escuela guarda aparte
# por curso: estos ajustes (`salas[uuid]`: que es una clase en directo, el
# recuadro con día y hora, si enseña las grabaciones, la sala), sus preguntas
# frecuentes (`customization.faq.courses[uuid]`) y las semanas con tarea
# (`tarea_semana`, por capítulo). Sin esto, la copia se pintaba como una
# formación, con «Por confirmar» y sin semanas. La etiqueta NO se copia: es
# justo lo que distingue a una copia de la otra.

CLASE_SEMANAL_UUID = "bfbcb42b-7dc3-4448-9df8-5d7b96135859"


def es_clase_en_directo(config: Any, course_uuid: str) -> bool:
    """El espejo de `esCursoEnDirecto` (apps/web/lib/nawar/cursos.ts). Pura."""
    uuid = uuid_curso(course_uuid)
    if uuid == CLASE_SEMANAL_UUID:
        return True
    todas = (config or {}).get(CLAVE) if isinstance(config, dict) else None
    propia = (todas or {}).get(uuid) if isinstance(todas, dict) else None
    return isinstance(propia, dict) and bool(propia.get("activo") or propia.get("directo"))


def ajustes_para_la_copia(config: Any, viejo: str) -> dict:
    """Lo que hereda la copia de una clase en directo (pura). La clase semanal
    de siempre se rige por defectos que la copia no tendría (es en directo,
    enseña las grabaciones y usa el recuadro viejo de toda la escuela): se
    escriben explícitos."""
    config = config if isinstance(config, dict) else {}
    todas = config.get(CLAVE) if isinstance(config.get(CLAVE), dict) else {}
    propia = todas.get(uuid_curso(viejo)) if isinstance(todas.get(uuid_curso(viejo)), dict) else {}
    copia = {k: v for k, v in propia.items() if k != "etiqueta"}
    copia["directo"] = True
    if uuid_curso(viejo) == CLASE_SEMANAL_UUID:
        copia.setdefault("grabadas", True)
        if not copia.get("banner") and isinstance(config.get("weekly_class_banner"), dict):
            copia["banner"] = limpiar_recuadro(config["weekly_class_banner"])
    return copia


def config_con_la_copia(config: Any, viejo: str, nuevo: str) -> dict:
    """La configuración de la escuela con la copia ya dada de alta (pura):
    sus ajustes de clase en directo y sus preguntas frecuentes, en el mismo
    hueco en que estén las del original."""
    config = json.loads(json.dumps(config if isinstance(config, dict) else {}))
    v, n = uuid_curso(viejo), uuid_curso(nuevo)
    todas = config.get(CLAVE) if isinstance(config.get(CLAVE), dict) else {}
    todas[n] = ajustes_para_la_copia(config, viejo)
    config[CLAVE] = todas
    raices = [config.get("customization", {}).get("faq") if isinstance(config.get("customization"), dict) else None, config.get("faq")]
    for raiz in raices:
        if isinstance(raiz, dict) and isinstance(raiz.get("courses"), dict) and isinstance(raiz["courses"].get(v), dict):
            raiz["courses"][n] = json.loads(json.dumps(raiz["courses"][v]))
    return config


async def copiar_a_la_copia(org_id: int, viejo: str, nuevo: str, capitulos: dict, db_session: AsyncSession) -> bool:
    """Tras duplicar un curso: si era una clase en directo, la copia hereda sus
    ajustes, sus preguntas y sus semanas con tarea (`capitulos` = uuid del
    capítulo original → el de la copia). Devuelve si había algo que copiar."""
    fila = await _fila_config(org_id, db_session)
    if fila is None or not es_clase_en_directo(fila.config, viejo):
        return False
    fila.config = config_con_la_copia(fila.config, viejo, nuevo)
    fila.update_date = str(datetime.now())
    db_session.add(fila)

    from src.db.tareas import TareaSemana

    ahora = datetime.now().isoformat()
    semanas = (
        await db_session.execute(
            select(TareaSemana).where(TareaSemana.org_id == org_id, TareaSemana.course_uuid == uuid_curso(viejo))
        )
    ).scalars().all()
    for s in semanas:
        if s.chapter_uuid in capitulos:
            db_session.add(
                TareaSemana(
                    org_id=org_id, course_uuid=uuid_curso(nuevo), chapter_uuid=capitulos[s.chapter_uuid],
                    tema=s.tema, fecha=s.fecha, enunciado=s.enunciado, fecha_limite=s.fecha_limite,
                    creada_por=s.creada_por, created_at=ahora, updated_at=ahora,
                )
            )
    await db_session.commit()
    await _olvidar_cache(org_id, db_session)
    return True


# El recuadro de arriba de cada clase en directo (día, hora, profe…). Antes
# había UNO para toda la escuela (`weekly_class_banner`), que sigue valiendo
# para la clase semanal de siempre mientras no se guarde el suyo.
CAMPOS_RECUADRO = ("subtitle", "live_url", "next_day", "next_weekday", "next_date", "schedule", "teacher", "duration")


def limpiar_recuadro(datos: Any) -> dict:
    """Solo los campos conocidos, como texto y con un tope (función pura)."""
    datos = datos if isinstance(datos, dict) else {}
    return {k: str(datos.get(k) or "").strip()[:600] for k in CAMPOS_RECUADRO}


async def guardar_recuadro(org_id: int, course_uuid: str, datos: dict, db_session: AsyncSession) -> dict:
    guardado = await _escribir(org_id, course_uuid, {"banner": limpiar_recuadro(datos)}, db_session)
    return guardado["banner"]

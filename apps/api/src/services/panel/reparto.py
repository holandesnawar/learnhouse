"""
El reparto de las llamadas entre los closers (22/10/2026).

Pedido: "cada llamada que se agende le llegue a Diego, el closer principal, con
la opción de quedársela o pasársela al otro closer". Así funciona:

1. Alguien reserva una llamada (la web avisa con el evento `reunion`). A quien
   reparte (`reparto_llamadas.repartidor_id` en la configuración de la escuela;
   si no hay nadie puesto, a los administradores) le llega un correo y la
   tarjeta sale en el tablero de Ventas, en «Por asignar».
2. Desde ahí, «Para mí» o «Para <otro closer>» (`pipeline.asignar`). Al closer
   que la recibe le llega otro correo, salvo que se la quede quien reparte.
3. Si el equipo reserva la llamada desde el panel, se la queda quien la
   reserva si es closer (`reservar.py`), sin pasar por «Por asignar».
4. Si quien reserva YA tenía closer (volvió a reservar tras un No show, o se
   la agendó un closer desde el panel), el aviso le llega a ESE closer
   («Ha reservado una llamada contigo») y no a quien reparte: su tarjeta no
   pasa por «Por asignar» y el aviso de repartir confundía (28/10, al entrar
   la segunda closer).

5. **Con Calendly Teams (31/10)**: un usuario de Calendly por closer y un evento
   «por turnos» (round robin). Calendly elige el closer, le manda a ÉL la
   reserva y se la pone en su calendario, con SU Google Meet (desde el 01/11;
   al principio se pensó en Zoom). La escuela lee quién es
   el anfitrión de cada cita y le pone ese closer a la tarjeta
   (`asignar_por_anfitrion`): no pasa por «Por asignar» ni le llega a nadie el
   «repártela». El anfitrión se reconoce por su correo de Calendly: el de su
   cuenta de la escuela si es el mismo, o el que se apunta en «Correos de
   Calendly» (`calendly` en la configuración). Solo cuentan los closers (o
   quien esté apuntado ahí): las citas del usuario principal de Calendly siguen
   yendo a «Por asignar», como antes. **Manda el anfitrión**: es quien tiene la
   llamada en su calendario y en su Meet.

Antes de Calendly Teams, el enlace de la videollamada era el del evento de
Calendly (el de Diego) y el otro closer entraba con ese mismo enlace. Con el
evento por turnos y Google Meet, cada reserva trae el enlace de Meet de SU
closer, creado en su Google Calendar.

Los correos no lanzan nunca: el reparto ya está guardado y un fallo del correo
no puede devolver un error a la pantalla ni a la web.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

CLAVE = "reparto_llamadas"


async def _fila_config(db_session: AsyncSession, org_id: Optional[int] = None):
    from src.db.organization_config import OrganizationConfig

    q = select(OrganizationConfig)
    if org_id is not None:
        q = q.where(OrganizationConfig.org_id == org_id)
    return (await db_session.execute(q)).scalars().first()


def correos_calendly(valor) -> dict[str, str]:
    """{id del usuario: correo en Calendly}, limpio. Función pura."""
    if not isinstance(valor, dict):
        return {}
    salida = {}
    for k, v in valor.items():
        correo = str(v or "").strip().lower()[:255]
        if str(k).isdigit() and "@" in correo:
            salida[str(int(k))] = correo
    return salida


async def leer(db_session: AsyncSession, org_id: Optional[int] = None) -> dict:
    """{"repartidor_id": int, "calendly": {id: correo}, "avisar": {id: correo}}
    (0 = nadie: avisa a los administradores). `avisar` (04/11): a qué correo
    le escribe la escuela a ese closer cuando Calendly le da una llamada; solo
    para quien no recibe el aviso de Calendly (Diego: su cuenta de Calendly es
    la del administrador, con su correo). Vacío = nada, ya le avisa Calendly.
    Sin `org_id`, la de la escuela (single-tenancy): así lo puede leer el
    aviso que llega de la web, que no sabe de escuelas."""
    fila = await _fila_config(db_session, org_id)
    guardado = (fila.config or {}).get(CLAVE) if fila and isinstance(fila.config, dict) else None
    if not isinstance(guardado, dict):
        return {"repartidor_id": 0, "calendly": {}, "avisar": {}}
    try:
        repartidor = int(guardado.get("repartidor_id") or 0)
    except (TypeError, ValueError):
        repartidor = 0
    return {
        "repartidor_id": repartidor,
        "calendly": correos_calendly(guardado.get("calendly")),
        "avisar": correos_calendly(guardado.get("avisar")),
    }


async def guardar(
    org_id: int,
    repartidor_id: Optional[int],
    db_session: AsyncSession,
    calendly: Optional[dict] = None,
    avisar: Optional[dict] = None,
) -> dict:
    """Guarda quién reparte, los correos de Calendly de cada closer y/o a qué
    correo avisarle (lo que venga a None se queda como estaba)."""
    fila = await _fila_config(db_session, org_id)
    if fila is None:
        return {"ok": False, "motivo": "La escuela no tiene configuración"}
    config = json.loads(json.dumps(fila.config or {}))
    antes = config.get(CLAVE) if isinstance(config.get(CLAVE), dict) else {}
    nuevo = {
        "repartidor_id": int(repartidor_id or 0) if repartidor_id is not None else int(antes.get("repartidor_id") or 0),
        "calendly": correos_calendly(calendly) if calendly is not None else correos_calendly(antes.get("calendly")),
        "avisar": correos_calendly(avisar) if avisar is not None else correos_calendly(antes.get("avisar")),
    }
    config[CLAVE] = nuevo
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return {"ok": True, **nuevo}


def closer_del_anfitrion(anfitrion_email: str, equipo: list[dict], calendly: dict[str, str]) -> Optional[dict]:
    """El miembro del equipo que es ese anfitrión de Calendly: el apuntado con
    ese correo en «Correos de Calendly», o un closer con ese correo en su
    cuenta. None si no es nadie (p. ej. el usuario principal de Calendly, que
    no es closer): esa cita sigue yendo a «Por asignar». Función pura."""
    correo = (anfitrion_email or "").strip().lower()
    if not correo:
        return None
    for m in equipo:
        if calendly.get(str(m.get("id"))) == correo:
            return m
    for m in equipo:
        if m.get("rol") == "Closer" and str(m.get("email") or "").strip().lower() == correo:
            return m
    return None


def _instante(texto: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(texto or "").replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def cambios_por_anfitrion(
    citas: list[dict], ya: dict[str, dict], closer_de: dict[str, dict], ahora: Optional[datetime] = None
) -> dict[str, dict]:
    """A quién hay que ponerle closer al leer la agenda, y cuál: {correo:
    closer}. `ya` = lo guardado por correo (`pipeline.guardadas`), `closer_de`
    = {correo de Calendly del anfitrión: closer}. Función pura, con test.

    - Sin closer: el de su cita activa (la última reservada).
    - Con OTRO closer: solo si es una cita que aún no ha pasado y se reservó
      DESPUÉS de que se le pusiera ese closer (lo último que pasó manda, 05/11:
      "mañana hay dos llamadas a las 12 y las dos las tiene Diego"). Pasa
      cuando el aviso de esa reserva no llegó, o cuando el equipo cambió la
      hora y Calendly se la dio al otro closer: la llamada está en el
      calendario de ese closer, con su enlace. Si el equipo la pasó a otro
      DESPUÉS de reservar, eso se queda."""
    ahora = ahora or datetime.now(timezone.utc)
    ultima: dict[str, tuple[dict, dict]] = {}
    for c in citas:
        email = str(c.get("email") or "").strip().lower()
        if c.get("estado") != "activa" or not email:
            continue
        closer = closer_de.get(str(c.get("anfitrion_email") or "").strip().lower())
        if not closer:
            continue
        antes = ultima.get(email)
        if antes is None or str(c.get("reservada") or "") > str(antes[0].get("reservada") or ""):
            ultima[email] = (c, closer)
    salida: dict[str, dict] = {}
    for email, (c, closer) in ultima.items():
        g = ya.get(email) or {}
        actual = int(g.get("closer_id") or 0)
        if not actual:
            salida[email] = closer
            continue
        if actual == closer.get("id"):
            continue
        inicio, reservada, asignado = _instante(c.get("inicio")), _instante(c.get("reservada")), _instante(g.get("asignado_at"))
        if inicio and inicio > ahora and reservada and asignado and reservada > asignado + timedelta(minutes=2):
            salida[email] = closer
    return salida


def choques(citas: list[dict]) -> dict[str, str]:
    """Las citas activas de un mismo closer que se pisan en el tiempo: {id de
    la cita: nombre (o correo) de la otra}. Las citas llevan ya su `closer_id`
    (el de Calendly si se sabe). Sin fin, se cuentan 45 minutos. Función pura,
    con test (05/11)."""
    activas = []
    for c in citas:
        if c.get("estado") != "activa" or not int(c.get("closer_id") or 0) or not c.get("id"):
            continue
        ini = _instante(c.get("inicio"))
        if ini is None:
            continue
        fin = _instante(c.get("fin")) or ini + timedelta(minutes=45)
        activas.append((c, ini, max(fin, ini + timedelta(minutes=1))))
    salida: dict[str, str] = {}
    for i, (a, ia, fa) in enumerate(activas):
        for b, ib, fb in activas[i + 1 :]:
            if a["closer_id"] != b["closer_id"] or not (ia < fb and ib < fa):
                continue
            salida.setdefault(a["id"], b.get("nombre") or b.get("email") or "otra persona")
            salida.setdefault(b["id"], a.get("nombre") or a.get("email") or "otra persona")
    return salida


async def closers_de_anfitriones(citas: list[dict], db_session: AsyncSession) -> dict[str, dict]:
    """{correo de Calendly del anfitrión: closer} de los anfitriones de esas
    citas que son closers de la escuela. En blando: si falla, vacío."""
    try:
        org_id, eq = await _equipo_de_la_escuela(db_session)
        mapa = (await leer(db_session, org_id or None))["calendly"]
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron leer los closers de Calendly")
        return {}
    salida: dict[str, dict] = {}
    for c in citas:
        correo = str(c.get("anfitrion_email") or "").strip().lower()
        if correo and correo not in salida:
            closer = closer_del_anfitrion(correo, eq, mapa)
            if closer:
                salida[correo] = closer
    return salida


async def asignar_citas_por_anfitrion(
    citas: list[dict], db_session: AsyncSession, closer_de: Optional[dict[str, dict]] = None
) -> int:
    """Lo mismo para toda la agenda al leerla, de una vez (reglas en
    `cambios_por_anfitrion`). Devuelve cuántas cambia. En blando."""
    from src.services.panel.pipeline import asignar, guardadas

    try:
        if closer_de is None:
            closer_de = await closers_de_anfitriones(citas, db_session)
        if not closer_de:
            return 0
        cambios = cambios_por_anfitrion(citas, await guardadas(db_session), closer_de)
        for email, closer in cambios.items():
            await asignar(email, closer["id"], closer.get("nombre") or "", "Calendly", db_session)
        return len(cambios)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudieron poner los closers de Calendly")
        return 0


async def asignar_por_anfitrion(
    email: str, anfitrion_email: str, db_session: AsyncSession, *, solo_si_no_tiene: bool = False
) -> Optional[dict]:
    """Le pone a esa persona el closer que Calendly eligió (31/10). Devuelve el
    closer si la persona queda con él, o None si el anfitrión no es un closer
    de la escuela. Lo usan el aviso de una reserva nueva y la reserva desde el
    panel, y ahí manda el anfitrión: cambia el closer que hubiera.
    `solo_si_no_tiene` no lo cambia. En blando."""
    from src.services.panel.pipeline import _la_asignada, asignar, filas_de

    try:
        org_id, eq = await _equipo_de_la_escuela(db_session)
        closer = closer_del_anfitrion(anfitrion_email, eq, (await leer(db_session, org_id or None))["calendly"])
        if not closer or not email:
            return None
        filas = await filas_de(email, db_session)
        ya = int(getattr(_la_asignada(filas), "closer_id", 0) or 0) if filas else 0
        if ya == closer["id"] or (ya and solo_si_no_tiene):
            return closer if ya == closer["id"] else None
        await asignar(email, closer["id"], closer.get("nombre") or "", "Calendly", db_session)
        return closer
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo poner el closer de Calendly")
        return None


def destinos(repartidor_id: int, equipo: list[dict], administradores: list[str]) -> list[str]:
    """A quién avisar de una llamada nueva: quien reparte, si está puesto y
    sigue en el equipo del panel; si no, los administradores. Función pura."""
    for m in equipo:
        if repartidor_id and m.get("id") == repartidor_id and m.get("email"):
            return [m["email"].strip().lower()]
    return administradores


async def _equipo_de_la_escuela(db_session: AsyncSession) -> tuple[int, list[dict]]:
    from src.services.panel.tareas import equipo

    fila = await _fila_config(db_session)
    org_id = int(getattr(fila, "org_id", 0) or 0)
    return org_id, (await equipo(org_id, db_session) if org_id else [])


async def avisar_llamada_nueva(datos: dict, db_session: AsyncSession) -> int:
    """Correo de «llamada nueva, repártela». datos: nombre, email, telefono,
    cuando. Devuelve cuántos salieron."""
    from src.services.contactos.llamadas import emails_de_administradores
    from src.services.users.emails import send_llamada_agendada_email

    # Desde el 27/10 avisan de una reserva la web (evento `reunion`) y
    # Calendly (`correo_reserva.py`): la misma reserva, un solo correo. En
    # Redis y en blando: sin Redis, puede salir dos veces, nunca ninguna.
    email = str(datos.get("email") or "").strip().lower()
    r = None
    if email:
        try:
            from src.core.redis import get_redis_client

            r = get_redis_client()
            if r is not None and not r.set(f"llamada-nueva:{email}", "1", nx=True, ex=1800):
                return 0
        except Exception:  # noqa: BLE001
            r = None

    try:
        _, eq = await _equipo_de_la_escuela(db_session)
        suyo = await _closer_que_la_lleva(email, eq, db_session)
        a_quien = (
            [suyo["email"].strip().lower()] if suyo
            else destinos((await leer(db_session))["repartidor_id"], eq, await emails_de_administradores(db_session))
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada nueva")
        return 0
    enviados = 0
    for destino in a_quien:
        try:
            if suyo:
                from src.services.users.emails import send_llamada_asignada_email

                send_llamada_asignada_email(destino, {**datos, "vuelve": True})
            else:
                send_llamada_agendada_email(destino, datos)
            enviados += 1
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar de la llamada nueva")
    if not enviados and r is not None:
        # No salió ninguno: que el siguiente aviso de esta reserva lo intente.
        try:
            r.delete(f"llamada-nueva:{email}")
        except Exception:  # noqa: BLE001
            pass
    return enviados


def destinos_con_closer(closer: dict, repartidor_id: int, equipo: list[dict], administradores: list[str]) -> list[str]:
    """A quién mandar «la lleva X» de una llamada que Calendly ya le dio a un
    closer: los administradores y quien reparte, menos ese closer (a él ya le
    avisa Calendly, o la escuela con «Te ha tocado una llamada» si tiene
    puesto a quién). Función pura."""
    salida: list[str] = []
    for correo in [*administradores, *destinos(repartidor_id, equipo, [])]:
        correo = (correo or "").strip().lower()
        if correo and correo not in salida and correo != str(closer.get("email") or "").strip().lower():
            salida.append(correo)
    return salida


async def avisar_llamada_con_closer(
    datos: dict, closer: dict, db_session: AsyncSession, informe: Optional[dict] = None
) -> int:
    """«Ana ha reservado una llamada · la lleva Belén» (31/10): para estar al
    tanto, sin nada que repartir. Misma marca en Redis que el «repártela», así
    el aviso de la web no lo repite. Devuelve cuántos salieron.

    Y al closer, «Te ha tocado una llamada» (04/11), SOLO si tiene puesto un
    correo en «Avisarle a» (`avisar`): Calendly avisa al correo de la cuenta
    de Calendly del anfitrión, y la de Diego es la del administrador (con su
    correo), así que ese aviso no le llegaba a él. A quien no lo tiene puesto
    (Belén) no se le manda nada: ya le avisa Calendly (usuario, 04/11: "que
    le llegue solo a Diego").

    ⚠️ El del closer lleva su PROPIA marca (05/11, "no le llega nada a
    Diego"): con la de «la lleva X», si la web había avisado antes de la misma
    reserva, la marca ya estaba puesta y el closer se quedaba sin su correo.

    `informe` (si se pasa) se rellena con lo que se hizo, para enseñarlo en el
    panel: a quién se avisó, si al closer, y si ya estaba avisado."""
    from src.services.contactos.llamadas import emails_de_administradores
    from src.services.users.emails import send_llamada_agendada_email, send_llamada_asignada_email

    informe = informe if informe is not None else {}
    email = str(datos.get("email") or "").strip().lower()
    r = None
    try:
        from src.core.redis import get_redis_client

        r = get_redis_client()
    except Exception:  # noqa: BLE001
        r = None

    def primera_vez(clave: str) -> bool:
        if r is None or not email:
            return True
        try:
            return bool(r.set(clave, "1", nx=True, ex=1800))
        except Exception:  # noqa: BLE001
            return True

    def soltar(clave: str) -> None:
        if r is not None:
            try:
                r.delete(clave)
            except Exception:  # noqa: BLE001
                pass

    try:
        _, eq = await _equipo_de_la_escuela(db_session)
        ajustes = await leer(db_session)
        suyo = ajustes["avisar"].get(str(closer.get("id")), "")
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada")
        informe["fallo"] = "No se pudo leer a quién avisar"
        return 0
    informe["avisar_a"] = suyo
    enviados = 0
    if suyo and primera_vez(f"llamada-closer:{email}"):
        try:
            send_llamada_asignada_email(suyo, {**datos, "calendly": True})
            enviados += 1
            informe["closer_avisado"] = suyo
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar al closer de su llamada")
            informe["fallo_closer"] = suyo
            soltar(f"llamada-closer:{email}")

    if not primera_vez(f"llamada-nueva:{email}"):
        informe["repetido"] = True
        return enviados
    try:
        a_quien = destinos_con_closer(closer, ajustes["repartidor_id"], eq, await emails_de_administradores(db_session))
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer a quién avisar de la llamada")
        soltar(f"llamada-nueva:{email}")
        return enviados
    avisados = []
    for destino in a_quien:
        try:
            send_llamada_agendada_email(destino, {**datos, "closer": closer.get("nombre") or ""})
            avisados.append(destino)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo avisar de la llamada nueva")
    informe["avisados"] = avisados
    enviados += len(avisados)
    if not avisados:
        soltar(f"llamada-nueva:{email}")
    return enviados


async def _closer_que_la_lleva(email: str, equipo: list[dict], db_session: AsyncSession) -> Optional[dict]:
    """El closer que ya lleva a esa persona (del equipo del panel y con correo),
    o None."""
    if not email:
        return None
    from src.services.panel.pipeline import _la_asignada, filas_de

    # En blando: si no se puede saber, avisa a quien reparte, como siempre.
    try:
        filas = await filas_de(email, db_session)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo leer si esa persona ya tenía closer")
        return None
    closer_id = int(getattr(_la_asignada(filas), "closer_id", 0) or 0) if filas else 0
    if not closer_id:
        return None
    return next((m for m in equipo if m.get("id") == closer_id and m.get("email")), None)


def avisar_asignada(closer_email: str, datos: dict) -> bool:
    """Correo al closer al que le han pasado una llamada."""
    from src.services.users.emails import send_llamada_asignada_email

    if not closer_email:
        return False
    try:
        send_llamada_asignada_email(closer_email, datos)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo avisar al closer de su llamada")
        return False

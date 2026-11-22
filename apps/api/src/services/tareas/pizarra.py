"""
La pizarra de clase (10/11/2026).

Pedido: "se sube a la escuela, y luego ahí el profe pueda abrirlo en clase
mientras comparte pantalla, y editar desde dentro o escribir notas, con el
mismo diseño, y pulsar «guardar» con un clic y eso es la presentación de
después de clase, la que ven los alumnos".

Cómo va:

1. El profe abre la presentación de esa semana DENTRO de la escuela
   (`/pizarra/<semana>`): un PDF del material del profe (la «presentación
   completa») o el PDF que los alumnos ven antes de la clase.
2. Escribe encima mientras comparte pantalla: lápiz, rotulador, texto con la
   letra de la marca, páginas en blanco para notas, esconder una página. Lo
   que escribe se guarda solo (`anotaciones`: un JSON con los trazos, en
   coordenadas de 0 a 1 de cada página, así se ve igual en cualquier pantalla).
3. «Guardar para los alumnos»: el navegador pinta cada página con lo escrito
   encima y monta un PDF; la escuela lo guarda y, desde el día de la clase,
   los alumnos de esa clase lo ven en su semana como «Presentación con las
   notas de la clase». Se puede volver a guardar (sustituye) o quitar.

Dónde se guarda, sin tabla ni columna nueva: dentro de
`tarea_semana.material_profe` (JSON), en la clave `pizarra`:

    {"fuente": "profe:<id>" | "clase:<activity_uuid>",
     "anotaciones": "<ruta del JSON>", "guardada_at", "guardada_por",
     "publicada": {"ruta", "at", "por", "paginas", "tam"} | None}

Los dos archivos van a `content/privado/tareas/<org>/pizarra/` (dentro del
volumen: entran en la copia diaria) y `/content` nunca los sirve: el JSON solo
al equipo; el PDF, al equipo y a los alumnos que ven esa clase, por su ruta.

Cada grupo tiene su semana, así que cada profe guarda SUS notas: lo que se
escribe en la clase del martes no pisa lo del jueves.

── Cada presentación, sus notas (22/11/2026) ───────────────────────────────

Usuario: «un profe subió una presentación que no era en pizarra y tomó notas
ahí; ahora cómo se saca esa, dónde está, dónde se guardó, cómo metemos la que
sí es… nadie sabemos dónde están las presentaciones ni cuál está en pizarra».

Antes cada semana guardaba UN solo juego de notas (`anotaciones`) y de qué
documento era (`fuente`): al elegir otro documento y escribir, lo anterior se
sustituía, y lo escrito en el documento equivocado no se podía pasar al bueno.
Ahora la clave `pizarra` del material es:

    {"fuente": "<la de la pizarra: la que se abre al pulsar «Pizarra»>",
     "notas": {"<id de presentación>": {"ruta", "at", "por", "paginas",
                                        "algo", "nombre"}},
     "publicada": {"ruta","at","por","paginas","tam","fuente","nombre"} | None,
     # por compatibilidad, las de la presentación de la pizarra:
     "anotaciones", "guardada_at", "guardada_por"}

- **Cada presentación guarda las suyas** (`notas[id]`): cambiar de
  presentación no pisa nada. `paginas` = páginas con algo escrito; `algo` =
  si hay algo que conservar (trazos, páginas en blanco o escondidas);
  `nombre` = cómo se llamaba el documento cuando se escribió (para poder
  decirlo si luego se quita).
- **Los ids**: `profe:<id>` (un PDF del material del profe, solo equipo),
  `clase:<activity_uuid>` (el PDF que los alumnos ven antes de la clase) y
  `blanco` (la pizarra en blanco, sin PDF: siempre se puede abrir).
- **Lo viejo se lee sin tocar el disco** (`leer`): si no hay `notas` y hay
  `anotaciones`, las notas son de `fuente` (vacía → clave `""`, que sale como
  «sin presentación»). Nada se reescribe hasta el siguiente guardado.
- **`lista()`** es lo que pintan todas las pantallas: las presentaciones (la
  de la pizarra primero), cada una con sus notas y si de ella salió la
  versión de los alumnos, y las **sueltas**: notas cuyo documento ya no está
  (se quitó, o se cambió el PDF de los alumnos). No se pierden: se pueden
  pasar a otra presentación o borrar.
- **`pasar()`** lleva las notas de una presentación a otra. Si la de destino
  ya tiene, se JUNTAN (misma página → se suman los trazos; las páginas en
  blanco, al final). El origen se queda sin notas. Si el origen era la de la
  pizarra, la de destino pasa a serlo (también al cambiar el PDF de los
  alumnos, que cambia de id).
- **Nunca se borra un archivo de notas** salvo en `borrar_notas` (el botón
  «Borrar sus notas», con confirmación) y al juntar (el del origen, ya
  copiado dentro del destino).
"""

from __future__ import annotations

import json
import uuid as _uuid
from pathlib import Path
from typing import Any, Optional

from src.services.tareas.tareas import CARPETA, CONTENT_DIR, TareaError, ruta_segura

MAX_ANOTACIONES = 8 * 1024 * 1024
MAX_PDF = 60 * 1024 * 1024
MAX_PAGINAS = 200


BLANCO = "blanco"
NOMBRE_BLANCO = "Pizarra en blanco"


def _nota(v: Any) -> Optional[dict]:
    """Una entrada de `notas`, con su forma; None si no vale."""
    if not isinstance(v, dict) or not v.get("ruta"):
        return None
    paginas = v.get("paginas")
    return {
        "ruta": str(v.get("ruta") or ""),
        "at": str(v.get("at") or ""),
        "por": str(v.get("por") or ""),
        # None = no se sabe (lo guardado antes del 22/11/2026).
        "paginas": int(paginas) if isinstance(paginas, (int, float)) and not isinstance(paginas, bool) else None,
        "algo": bool(v.get("algo", True)),
        "nombre": str(v.get("nombre") or ""),
        # Desde qué pizarra abierta se guardó por última vez (para avisar si
        # dos pestañas escriben en la misma presentación).
        "sesion": str(v.get("sesion") or "")[:40],
        # Cuándo cambió el archivo por última vez, lo hiciera quien lo hiciera
        # (escribir o pasarle notas de otra): `at` es de quién las escribió.
        "cambio": str(v.get("cambio") or v.get("at") or ""),
    }


def _nombres(v: Any) -> dict[str, str]:
    """Los nombres que el equipo ha puesto a las presentaciones de los alumnos
    (la clase PDF del curso se llama siempre «Presentación»)."""
    if not isinstance(v, dict):
        return {}
    return {str(k): str(n).strip()[:160] for k, n in v.items() if str(n or "").strip()}


def leer(material: dict) -> dict:
    """La pizarra guardada en el material de la semana, siempre con la misma
    forma. Lo de antes del 22/11/2026 (un solo juego de notas) se lee como las
    notas de su `fuente`, sin tocar el disco."""
    p = material.get("pizarra") if isinstance(material, dict) else None
    if not isinstance(p, dict):
        p = {}
    pub = p.get("publicada") if isinstance(p.get("publicada"), dict) else None
    if pub and not pub.get("ruta"):
        pub = None
    fuente = str(p.get("fuente") or "")
    notas: dict[str, dict] = {}
    if isinstance(p.get("notas"), dict):
        for k, v in p["notas"].items():
            n = _nota(v)
            if n:
                notas[str(k)] = n
    elif p.get("anotaciones"):
        notas[fuente] = {
            "ruta": str(p.get("anotaciones") or ""),
            "at": str(p.get("guardada_at") or ""),
            "por": str(p.get("guardada_por") or ""),
            "paginas": None,
            "algo": True,
            "nombre": "",
            "sesion": "",
            "cambio": str(p.get("guardada_at") or ""),
        }
    actual = notas.get(fuente) or {}
    return {
        "fuente": fuente,
        "notas": notas,
        "nombres": _nombres(p.get("nombres")),
        # Compatibilidad: las de la presentación de la pizarra.
        "anotaciones": str(actual.get("ruta") or ""),
        "guardada_at": str(actual.get("at") or ""),
        "guardada_por": str(actual.get("por") or ""),
        "publicada": (
            {
                "ruta": str(pub.get("ruta") or ""),
                "at": str(pub.get("at") or ""),
                "por": str(pub.get("por") or ""),
                "paginas": int(pub.get("paginas") or 0),
                "tam": int(pub.get("tam") or 0),
                # De qué presentación salió (antes del 22/11 no se apuntaba:
                # era la de la pizarra de entonces).
                "fuente": str(pub.get("fuente") if pub.get("fuente") is not None else fuente),
                "nombre": str(pub.get("nombre") or ""),
            }
            if pub
            else None
        ),
    }


def _con_compat(p: dict) -> dict:
    """Deja `anotaciones`, `guardada_at` y `guardada_por` como los de la
    presentación de la pizarra (lo que leía el código de antes)."""
    actual = (p.get("notas") or {}).get(p.get("fuente") or "") or {}
    return {**p, "anotaciones": str(actual.get("ruta") or ""), "guardada_at": str(actual.get("at") or ""), "guardada_por": str(actual.get("por") or "")}


def ultima_escritura(p: dict) -> str:
    """Cuándo se escribió por última vez en CUALQUIER presentación de la semana."""
    return max([n.get("at") or "" for n in (p.get("notas") or {}).values() if n.get("algo", True)] or [""])


def publicada_para_la_pantalla(p: dict) -> Optional[dict]:
    """Sin la ruta en disco."""
    pub = p.get("publicada")
    return {k: v for k, v in pub.items() if k != "ruta"} if pub else None


def fuentes(material: dict, clases: list[dict]) -> list[dict]:
    """Los PDF sobre los que se puede escribir: primero los del profe (la
    presentación completa), luego el que ven los alumnos antes de la clase."""
    out: list[dict] = []
    for a in material.get("archivos") or []:
        if a.get("tipo") == "archivo" and str(a.get("ruta") or "").lower().endswith(".pdf"):
            out.append(
                {
                    "id": f"profe:{a.get('id')}",
                    "de": "profe",
                    "nombre": a.get("nombre") or "Presentación completa",
                    "por": str(a.get("por") or ""),
                    "at": str(a.get("at") or ""),
                    "tam": int(a.get("tam") or 0),
                }
            )
    puestos = _nombres(((material.get("pizarra") or {}) if isinstance(material.get("pizarra"), dict) else {}).get("nombres"))
    for c in clases or []:
        if c.get("tipo") == "presentacion" and c.get("activity_uuid"):
            ident = f"clase:{c['activity_uuid']}"
            out.append(
                {
                    "id": ident,
                    "de": "alumnos",
                    "nombre": puestos.get(ident) or nombre_de_alumnos(c.get("nombre")),
                    "por": "",
                    "at": str(c.get("creada") or ""),
                    "tam": 0,
                }
            )
    return out


NOMBRE_ALUMNOS = "Presentación de los alumnos"


def nombre_de_alumnos(nombre_de_la_clase: Any) -> str:
    """El nombre con el que el equipo ve el PDF de los alumnos cuando nadie le
    ha puesto uno. La clase del curso se crea siempre como «Presentación», que
    no dice nada: entonces, «Presentación de los alumnos». Si alguien la
    renombró en el editor del curso, ese nombre."""
    n = str(nombre_de_la_clase or "").strip()
    if not n or n.lower() in ("presentación", "presentacion"):
        return NOMBRE_ALUMNOS
    return n


def con_nombre(p: dict, fuente: str, nombre: str) -> dict:
    """Pone (o quita, con el nombre vacío) el nombre con el que el EQUIPO ve
    una presentación de los alumnos. No cambia nada de lo que ve el alumno."""
    nombres = dict(p.get("nombres") or {})
    limpio = " ".join(str(nombre or "").split())[:160]
    if limpio:
        nombres[fuente] = limpio
    else:
        nombres.pop(fuente, None)
    return {**p, "nombres": nombres}


def fuente_valida(fuente: str, disponibles: list[dict]) -> str:
    """La de la pizarra: la guardada si sigue existiendo (o es la pizarra en
    blanco); si no, la primera del equipo; si no, la de los alumnos; y si la
    clase no tiene ningún PDF, vacío (la pantalla abre entonces en blanco)."""
    ids = [f["id"] for f in disponibles]
    if fuente in ids or fuente == BLANCO:
        return fuente
    return ids[0] if ids else ""


def existe(fuente: str, disponibles: list[dict]) -> bool:
    """Si en esa presentación se puede escribir ahora mismo."""
    return fuente == BLANCO or any(f["id"] == fuente for f in disponibles)


def nombre_de(fuente: str, disponibles: list[dict]) -> str:
    if fuente == BLANCO:
        return NOMBRE_BLANCO
    return next((str(f.get("nombre") or "") for f in disponibles if f["id"] == fuente), "")


def limpiar_anotaciones(doc: Any) -> dict:
    """Lo mínimo para no guardar cualquier cosa: una lista de páginas, cada una
    con de qué página del PDF sale (o ninguna: en blanco) y sus trazos."""
    if not isinstance(doc, dict) or not isinstance(doc.get("paginas"), list):
        raise TareaError("No se pudo leer lo escrito en la pizarra")
    paginas = []
    for pg in doc["paginas"][:MAX_PAGINAS]:
        if not isinstance(pg, dict):
            continue
        origen = pg.get("origen")
        paginas.append(
            {
                "origen": int(origen) if isinstance(origen, (int, float)) and origen >= 1 else None,
                "oculta": bool(pg.get("oculta")),
                "titulo": str(pg.get("titulo") or "")[:120],
                "trazos": [t for t in (pg.get("trazos") or []) if isinstance(t, dict)][:4000],
            }
        )
    return {"v": 1, "paginas": paginas}


def _carpeta(org_id: int) -> Path:
    d = CONTENT_DIR / CARPETA / str(org_id) / "pizarra"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _relativa(org_id: int, nombre: str) -> str:
    return f"{CARPETA}/{org_id}/pizarra/{nombre}"


def _borrar(relativa: str) -> None:
    ruta = ruta_segura(relativa or "")
    if ruta and ruta.is_file():
        try:
            ruta.unlink()
        except OSError:
            pass


def contar(doc: dict) -> tuple[int, bool]:
    """(páginas con algo escrito, si hay algo que conservar). Una página en
    blanco añadida o una página escondida cuentan como «algo» aunque no
    tengan trazos: son trabajo del profe."""
    paginas = doc.get("paginas") or []
    escritas = sum(1 for pg in paginas if pg.get("trazos"))
    algo = any(pg.get("trazos") or pg.get("origen") is None or pg.get("oculta") for pg in paginas)
    return escritas, bool(algo)


def _escribir(org_id: int, relativa: str, doc: dict) -> str:
    """Escribe el JSON de unas notas (en `relativa` si vale; si no, en un
    archivo nuevo) y devuelve la ruta relativa."""
    datos = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(datos) > MAX_ANOTACIONES:
        raise TareaError("Hay demasiado escrito en esta pizarra para guardarlo. Borra algún trazo largo.")
    ruta = ruta_segura(relativa) if relativa else None
    if ruta is None:
        relativa = _relativa(org_id, f"{_uuid.uuid4().hex}.json")
        ruta = ruta_segura(relativa)
    _carpeta(org_id)
    assert ruta is not None
    ruta.write_bytes(datos)
    return relativa


def choque(p: dict, fuente: str, base: Optional[str], sesion: str) -> Optional[dict]:
    """Si OTRA pizarra abierta (otra pestaña, otro ordenador) ha guardado en
    esa presentación después de lo que tiene quien guarda ahora: quién y
    cuándo. None si no hay choque. Función pura.

    `base` es la `revision` que la pantalla tenía de esa presentación ("" si
    la abrió sin notas; None = una pantalla de antes, que no avisa de nada) y
    `sesion`, un identificador al azar de esa pizarra abierta. Sin esto, la
    segunda pestaña pisaba en silencio lo escrito en la primera."""
    if base is None or not sesion:
        return None
    n = (p.get("notas") or {}).get(fuente)
    if not n or not n.get("algo", True):
        return None
    if (n.get("sesion") or "") == sesion:
        return None
    if str(n.get("cambio") or n.get("at") or "") <= str(base or ""):
        return None
    return {"por": str(n.get("por") or ""), "at": str(n.get("at") or "")}


def guardar_anotaciones(org_id: int, p: dict, fuente: str, doc: dict, por: str, ahora: str, nombre: str = "", sesion: str = "") -> dict:
    """Guarda las notas de ESA presentación (en su mismo archivo si ya tenía)
    y devuelve la pizarra nueva. Las de las demás no se tocan. Si la semana
    aún no tenía presentación de la pizarra, pasa a serlo esta."""
    limpio = limpiar_anotaciones(doc)
    notas = dict(p.get("notas") or {})
    vieja = notas.get(fuente) or {}
    relativa = _escribir(org_id, vieja.get("ruta") or "", limpio)
    escritas, algo = contar(limpio)
    notas[fuente] = {
        "ruta": relativa,
        "at": ahora,
        "por": (por or "")[:120],
        "paginas": escritas,
        "algo": algo,
        "nombre": (nombre or vieja.get("nombre") or "")[:160],
        "sesion": (sesion or "")[:40],
        "cambio": ahora,
    }
    return _con_compat({**p, "fuente": p.get("fuente") or fuente, "notas": notas})


def leer_anotaciones(p: dict, fuente: Optional[str] = None) -> Optional[dict]:
    """Las notas de una presentación (sin decir cuál, las de la de la pizarra)."""
    clave = p.get("fuente") or "" if fuente is None else fuente
    n = (p.get("notas") or {}).get(clave)
    ruta = ruta_segura((n or {}).get("ruta") or "")
    if ruta is None or not ruta.is_file():
        return None
    try:
        return json.loads(ruta.read_text("utf-8"))
    except (ValueError, OSError):
        return None


def con_fuente(p: dict, fuente: str) -> dict:
    """Marca cuál es la de la pizarra (la que se abre al pulsar «Pizarra»)."""
    return _con_compat({**p, "fuente": fuente})


def tras_subir(material: dict, archivo_id: str) -> dict:
    """Al subir un PDF del equipo a una clase cuya pizarra estaba en blanco
    (o no tenía ninguna elegida, o la elegida ya no existe), ese PDF pasa a
    ser el de la pizarra: si no, se sube la presentación y la pizarra sigue
    abriendo en blanco. Si ya había una presentación elegida, no se toca."""
    p = leer(material)
    elegida = p["fuente"]
    reales = {f"profe:{a.get('id')}" for a in material.get("archivos") or [] if a.get("tipo") == "archivo" and str(a.get("ruta") or "").lower().endswith(".pdf")}
    nueva = f"profe:{archivo_id}"
    if nueva not in reales:
        return material
    if elegida and elegida != BLANCO and (elegida in reales - {nueva} or elegida.startswith("clase:")):
        return material
    if not elegida and "pizarra" not in material:
        return material  # sin pizarra todavía: ya abre la primera del equipo
    return {**material, "pizarra": con_fuente(p, nueva)}


def juntar(destino: Optional[dict], origen: dict) -> dict:
    """Las notas de `origen` metidas en las de `destino`. Función pura.

    Misma página del PDF → se suman los trazos (y si alguna de las dos estaba
    escondida, sigue escondida). Las páginas en blanco del origen, y las de un
    número que el destino no tiene, van al final. La pantalla, al abrir,
    convierte en página en blanco las que no existan en ese PDF."""
    d = limpiar_anotaciones(destino) if isinstance(destino, dict) and isinstance(destino.get("paginas"), list) else {"v": 1, "paginas": []}
    o = limpiar_anotaciones(origen)
    paginas = [dict(pg) for pg in d["paginas"]]
    por_origen = {pg["origen"]: k for k, pg in enumerate(paginas) if pg["origen"] is not None}
    for pg in o["paginas"]:
        n = pg["origen"]
        if n is not None and n in por_origen:
            ya = paginas[por_origen[n]]
            ya["trazos"] = [*ya["trazos"], *pg["trazos"]][:4000]
            ya["oculta"] = bool(ya["oculta"] or pg["oculta"])
        elif n is not None:
            if pg["trazos"] or pg["oculta"]:
                por_origen[n] = len(paginas)
                paginas.append(dict(pg))
        else:
            paginas.append(dict(pg))
    return {"v": 1, "paginas": paginas[:MAX_PAGINAS]}


def pasar(org_id: int, p: dict, de: str, a: str, por: str, ahora: str, nombre_a: str = "") -> tuple[dict, bool]:
    """Pasa las notas de una presentación a otra y devuelve (pizarra, si pasó
    algo). El origen se queda sin notas. Si el origen era la de la pizarra,
    la de destino pasa a serlo, haya notas o no: es «la buena» (y es lo que
    hace falta al cambiar el PDF de los alumnos, que cambia de id)."""
    if de == a:
        raise TareaError("Es la misma presentación")
    notas = dict(p.get("notas") or {})
    nuevo = {**p, "notas": notas}
    if (p.get("fuente") or "") == de:
        nuevo["fuente"] = a
    origen = notas.get(de)
    doc = leer_anotaciones(p, de) if origen else None
    if not origen or doc is None:
        return _con_compat(nuevo), False
    destino = notas.get(a)
    junto = juntar(leer_anotaciones(p, a) if destino else None, doc)
    relativa = _escribir(org_id, (destino or {}).get("ruta") or "", junto)
    escritas, algo = contar(junto)
    notas[a] = {
        "ruta": relativa,
        # Las notas siguen siendo de quien las escribió y de cuando las
        # escribió (lo último de las dos), no de quien las ha pasado.
        "at": max(origen.get("at") or "", (destino or {}).get("at") or "") or ahora,
        "por": (origen.get("por") or (destino or {}).get("por") or por or "")[:120],
        "paginas": escritas,
        "algo": algo,
        "nombre": (nombre_a or (destino or {}).get("nombre") or "")[:160],
        # Quien la tenga abierta en otra pestaña tiene que enterarse antes de
        # guardar encima: no es de ninguna pizarra abierta y ha cambiado ahora.
        "sesion": "",
        "cambio": ahora,
    }
    notas.pop(de, None)
    # El archivo del origen ya está copiado dentro del destino.
    if origen.get("ruta") and origen.get("ruta") != relativa:
        _borrar(origen["ruta"])
    return _con_compat(nuevo), True


def borrar_notas(p: dict, fuente: str) -> dict:
    """Borra las notas de una presentación (el botón «Borrar sus notas»)."""
    notas = dict(p.get("notas") or {})
    n = notas.pop(fuente, None)
    if n is None:
        raise TareaError("Esa presentación no tiene notas", 404)
    if n.get("ruta"):
        _borrar(n["ruta"])
    return _con_compat({**p, "notas": notas})


def a_otra_sesion(org_id: int, origen: dict, destino: dict, fuente: str, ahora: str, tope: int = 12) -> tuple[dict, dict, dict]:
    """Pasa una presentación del equipo (con sus notas), o unas notas sueltas,
    de la semana `origen` a la semana `destino` de la misma clase
    (22/11/2026: «se subió en la sesión que no era»). Devuelve (material de
    origen, material de destino, qué pasó).

    - Los dos son materiales ya leídos (`material_profe.leer`). El archivo no
      se mueve en el disco: lo que cambia es de qué semana cuelga.
    - Si en destino ya está ese mismo archivo (lo copió «guardar también en el
      otro grupo»), no se duplica: solo pasan las notas, juntándose.
    - Si era la de la pizarra en origen, deja de serlo allí; en destino pasa a
      serlo si allí no había ninguna presentación elegida (o era la pizarra en
      blanco).
    - La versión que ya ven los alumnos de la semana de origen NO se toca.
    - La de los alumnos (`clase:`) no se pasa: es una clase del capítulo."""
    fuente = (fuente or "").strip()
    if fuente.startswith("clase:"):
        raise TareaError("La presentación de los alumnos no se puede pasar: súbela en la otra sesión")
    po, pd = leer(origen), leer(destino)
    archivos_o = list(origen.get("archivos") or [])
    archivos_d = list(destino.get("archivos") or [])
    ident = fuente[6:] if fuente.startswith("profe:") else ""
    archivo = next((a for a in archivos_o if ident and a.get("id") == ident and a.get("tipo") == "archivo"), None)
    notas_o = dict(po.get("notas") or {})
    nota = notas_o.get(fuente)
    if archivo is None and nota is None:
        raise TareaError("Esa presentación ya no está en esta sesión", 404)

    paso_archivo = False
    if archivo is not None:
        if not any(a.get("id") == ident for a in archivos_d):
            if len(archivos_d) >= tope:
                raise TareaError(f"La otra sesión ya tiene {tope} archivos: quita alguno antes")
            archivos_d.append(dict(archivo))
        archivos_o = [a for a in archivos_o if a.get("id") != ident]
        paso_archivo = True

    notas_d = dict(pd.get("notas") or {})
    paso_notas = False
    if nota is not None:
        ya = notas_d.get(fuente)
        if ya and ya.get("ruta") and ya.get("ruta") != nota.get("ruta"):
            doc = leer_anotaciones(po, fuente)
            if doc is not None:
                junto = juntar(leer_anotaciones(pd, fuente), doc)
                relativa = _escribir(org_id, ya["ruta"], junto)
                escritas, algo = contar(junto)
                notas_d[fuente] = {
                    **ya,
                    "ruta": relativa,
                    "at": max(nota.get("at") or "", ya.get("at") or "") or ahora,
                    "por": (nota.get("por") or ya.get("por") or "")[:120],
                    "paginas": escritas,
                    "algo": algo,
                    "sesion": "",
                    "cambio": ahora,
                }
                if nota.get("ruta"):
                    _borrar(nota["ruta"])
        else:
            notas_d[fuente] = {**nota, "sesion": "", "cambio": ahora}
        notas_o.pop(fuente, None)
        paso_notas = True

    nuevo_o = {**po, "notas": notas_o}
    if (po.get("fuente") or "") == fuente:
        nuevo_o["fuente"] = ""
    nuevo_d = {**pd, "notas": notas_d}
    elegida = pd.get("fuente") or ""
    reales_d = {f"profe:{a.get('id')}" for a in destino.get("archivos") or [] if a.get("tipo") == "archivo" and str(a.get("ruta") or "").lower().endswith(".pdf")}
    en_pizarra = False
    if archivo is not None and str(archivo.get("ruta") or "").lower().endswith(".pdf"):
        if not elegida or elegida == BLANCO or (elegida.startswith("profe:") and elegida not in reales_d):
            nuevo_d["fuente"] = fuente
            en_pizarra = True
    return (
        {**origen, "archivos": archivos_o, "pizarra": _con_compat(nuevo_o)},
        {**destino, "archivos": archivos_d, "pizarra": _con_compat(nuevo_d)},
        {"archivo": paso_archivo, "notas": paso_notas, "en_pizarra": en_pizarra},
    )


def _resumen_notas(n: Optional[dict]) -> Optional[dict]:
    if not n or not n.get("algo", True):
        return None
    return {"at": n.get("at") or "", "por": n.get("por") or "", "paginas": n.get("paginas")}


def lista(material: dict, clases: list[dict]) -> dict:
    """Lo que pintan las pantallas, sin rutas del disco. Función pura.

    - `presentaciones`: cada PDF de la clase, la de la pizarra primero:
      `{id, de: "equipo"|"alumnos"|"blanco", nombre, por, at, tam, en_pizarra,
      notas: {at, por, paginas} | None, publicada: {at, por, paginas} | None}`.
      La pizarra en blanco solo sale si tiene notas o es la de la pizarra.
    - `sueltas`: notas de un documento que ya no está: `{id, nombre, at, por,
      paginas}`.
    - `fuente`: el id de la de la pizarra ("" si la clase no tiene ningún PDF
      ni se ha usado la pizarra en blanco).
    - `publicada`: la versión que ven los alumnos después de la clase (o None).
    """
    p = leer(material or {})
    disponibles = fuentes(material or {}, clases or [])
    en_pizarra = fuente_valida(p["fuente"], disponibles)
    notas = p["notas"]
    pub = p["publicada"]

    def fila(f: dict) -> dict:
        de_ella = pub is not None and pub.get("fuente") == f["id"]
        return {
            "id": f["id"],
            "de": "equipo" if f["de"] == "profe" else f["de"],
            "nombre": f["nombre"],
            "por": f.get("por") or "",
            "at": f.get("at") or "",
            "tam": f.get("tam") or 0,
            "en_pizarra": f["id"] == en_pizarra,
            "notas": _resumen_notas(notas.get(f["id"])),
            "publicada": {"at": pub["at"], "por": pub["por"], "paginas": pub["paginas"]} if de_ella and pub else None,
        }

    filas = [fila(f) for f in disponibles]
    blanco = notas.get(BLANCO)
    if en_pizarra == BLANCO or (blanco and blanco.get("algo", True)):
        filas.append(fila({"id": BLANCO, "de": "blanco", "nombre": NOMBRE_BLANCO, "por": "", "at": "", "tam": 0}))
    filas.sort(key=lambda x: 0 if x["en_pizarra"] else 1)
    ids = {x["id"] for x in filas} | {BLANCO}
    sueltas = [
        {"id": k, "nombre": n.get("nombre") or "", "at": n.get("at") or "", "por": n.get("por") or "", "paginas": n.get("paginas")}
        for k, n in notas.items()
        if k not in ids and n.get("algo", True)
    ]
    sueltas.sort(key=lambda x: x["at"], reverse=True)
    return {
        "presentaciones": filas,
        "sueltas": sueltas,
        "fuente": en_pizarra,
        "publicada": publicada_para_la_pantalla(p),
    }


def es_pdf(datos: bytes) -> bool:
    return datos[:5] == b"%PDF-" and b"%%EOF" in datos[-2048:]


def publicar(org_id: int, p: dict, datos: bytes, paginas: int, por: str, ahora: str, fuente: str = "", nombre: str = "") -> dict:
    """Guarda el PDF de después de clase (sustituye al anterior)."""
    if not datos:
        raise TareaError("La presentación llegó vacía")
    if len(datos) > MAX_PDF:
        raise TareaError(f"La presentación pesa más de {MAX_PDF // (1024 * 1024)} MB")
    if not es_pdf(datos):
        raise TareaError("Lo que llegó no es un PDF")
    _carpeta(org_id)
    relativa = _relativa(org_id, f"{_uuid.uuid4().hex}.pdf")
    ruta = ruta_segura(relativa)
    assert ruta is not None
    ruta.write_bytes(datos)
    viejo = (p.get("publicada") or {}).get("ruta")
    if viejo:
        _borrar(viejo)
    return {
        **p,
        "publicada": {
            "ruta": relativa,
            "at": ahora,
            "por": (por or "")[:120],
            "paginas": max(0, int(paginas or 0)),
            "tam": len(datos),
            # De qué presentación salió (22/11/2026), para decirlo en la lista.
            "fuente": fuente or p.get("fuente") or "",
            "nombre": (nombre or "")[:160],
        },
    }


def quitar_publicada(p: dict) -> dict:
    viejo = (p.get("publicada") or {}).get("ruta")
    if viejo:
        _borrar(viejo)
    return {**p, "publicada": None}


def pdf_publicado(p: dict) -> Optional[Path]:
    pub = p.get("publicada")
    ruta = ruta_segura((pub or {}).get("ruta") or "")
    return ruta if ruta and ruta.is_file() else None

"""
Los textos de los correos automáticos, editables desde el panel.

Qué resuelve
------------
Las plantillas viven en código, así que cambiar una coma en un correo era un
despliegue. Esto guarda un texto alternativo por campo en la configuración de la
escuela y lo usa en lugar del de código.

Qué NO se puede tocar, y por qué está hecho así
-----------------------------------------------
Solo son editables las plantillas que aparecen en `CAMPOS`, y ahí **no están el
correo de bienvenida tras el pago, el de crear la contraseña, el de invitación
ni el de verificar el correo**. No es una comprobación en la pantalla: es que la
búsqueda del texto alternativo solo mira dentro de `CAMPOS`, así que aunque
alguien metiera a mano `payment_welcome.cuerpo` en la configuración, se
ignoraría. Esos correos son la puerta de entrada de quien acaba de pagar y un
texto mal guardado ahí no se ve en pruebas: se ve en el primer alumno.

Cómo se pinta
-------------
El texto se escribe en plano. Se escapa siempre (lo que teclee un administrador
no puede meter HTML en un correo), las líneas en blanco separan párrafos y
`*así*` pone algo en negrita. Es lo justo para redactar, sin abrir la puerta a
que una etiqueta a medio cerrar rompa la maqueta.

Si algo falla al rellenar las variables —una llave mal escrita, una variable que
no existe— se cae al texto de código en vez de reventar. Un correo con el texto
por defecto es un problema pequeño; una excepción en mitad del envío, no.
"""

from __future__ import annotations

import html
import logging
import re
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Dict, List

logger = logging.getLogger(__name__)


@dataclass
class Campo:
    """Un trozo editable de un correo."""

    etiqueta: str
    por_defecto: str
    #: Las que se pueden usar entre llaves, para enseñarlas en el panel.
    variables: List[str] = field(default_factory=list)
    #: True si son varios párrafos (el panel pinta un área de texto grande).
    largo: bool = False


#: Plantilla → campos editables. Lo que no está aquí NO se puede cambiar.
CAMPOS: Dict[str, Dict[str, Campo]] = {
    "module_unlocked": {
        "asunto": Campo("Asunto", "Has desbloqueado {modulo}", ["modulo", "nombre"]),
        "titulo": Campo("Título dentro del correo", "Has desbloqueado {modulo}", ["modulo", "nombre"]),
        "cuerpo": Campo(
            "Texto",
            "¡Buen trabajo, {nombre}! Acabas de terminar el módulo anterior.\n\n"
            "Tienes vía libre en *{modulo}*, te tocan *{lecciones} lecciones nuevas*.",
            ["nombre", "modulo", "lecciones"],
            largo=True,
        ),
        "boton": Campo("Texto del botón", "Empezar el módulo", []),
        "pie": Campo("Nota del pie", "Te avisamos cada vez que abres un módulo nuevo.", []),
    },
    "weekly_digest": {
        "asunto": Campo("Asunto", "Tu semana en Holandés Nawar", ["nombre"]),
        "titulo": Campo("Título dentro del correo", "Tu semana en Holandés Nawar", ["nombre"]),
        "cuerpo": Campo(
            "Texto de arriba",
            "Hola {nombre}, esto es lo que ha pasado esta semana en la escuela:",
            ["nombre"],
            largo=True,
        ),
        "cierre": Campo("Texto de debajo del resumen", "Vamos a por la siguiente.", ["nombre"], largo=True),
        "boton": Campo("Texto del botón", "Continuar mi formación", []),
        "pie": Campo("Nota del pie", "Recibes este resumen cada lunes.", []),
    },
    "class_scheduled": {
        "asunto": Campo("Asunto", "{titulo} — {cuando}", ["titulo", "cuando", "nombre"]),
        "titulo": Campo(
            "Título dentro del correo", "Ya tienes fecha para la próxima clase", ["titulo", "cuando"]
        ),
        "cuerpo": Campo(
            "Texto de arriba",
            "Hola {nombre}, ya está confirmada la próxima clase en vivo:",
            ["nombre"],
            largo=True,
        ),
        "cierre": Campo(
            "Texto de debajo",
            "Apúntatelo en el calendario. Si no puedes venir, la grabación queda "
            "publicada y la ves cuando quieras.",
            [],
            largo=True,
        ),
        "pie": Campo("Nota del pie", "Te avisamos cada vez que se confirma una clase.", []),
    },
    "consulta_answered": {
        "asunto": Campo("Asunto", "Te respondimos tu consulta", ["nombre"]),
        "titulo": Campo("Título dentro del correo", "Te respondimos tu consulta", ["nombre"]),
        "cuerpo": Campo("Texto de arriba", "Hola {nombre}, ya tienes respuesta a tu consulta:", ["nombre"], largo=True),
        "cierre": Campo(
            "Texto de debajo de la pregunta",
            "Entra en la escuela para leer la respuesta completa.",
            [],
            largo=True,
        ),
        "boton": Campo("Texto del botón", "Leer la respuesta", []),
        "pie": Campo("Nota del pie", "Recibes esto cuando el equipo contesta a una consulta tuya.", []),
    },
    "new_direct_message": {
        "asunto": Campo("Asunto", "Tienes un mensaje en la escuela", ["nombre"]),
        "titulo": Campo("Título dentro del correo", "Tienes un mensaje en la escuela", ["nombre"]),
        "cuerpo": Campo(
            "Texto",
            "Hola {nombre}, te hemos escrito un mensaje. Entra en la escuela para leerlo y contestarnos.",
            ["nombre"],
            largo=True,
        ),
        "boton": Campo("Texto del botón", "Leer el mensaje", []),
        "pie": Campo(
            "Nota del pie",
            "Recibes esto cuando alguien del equipo te escribe y marca el mensaje como importante.",
            [],
        ),
    },
    "certificate_ready": {
        "asunto": Campo("Asunto", "¡Enhorabuena! Tu certificado ya está listo", ["nombre", "certificado"]),
        "titulo": Campo(
            "Título dentro del correo", "¡Enhorabuena! Tu certificado ya está listo", ["nombre", "certificado"]
        ),
        "cuerpo": Campo(
            "Texto",
            "{nombre}, has completado *{certificado}*. No es poca cosa: has recorrido el "
            "camino entero, lección a lección.\n\n"
            "Tu *certificado Holandés Nawar* ya te espera en la escuela. Pulsa el botón y "
            "podrás verlo y descargarlo en PDF.",
            ["nombre", "certificado"],
            largo=True,
        ),
        "boton": Campo("Texto del botón", "Ver mi certificado", []),
        "pie": Campo("Nota del pie", "Tu certificado se queda guardado en la escuela.", []),
    },
}


#: Los textos de la escuela para esta petición. Vacío = los de código.
_ACTUALES: ContextVar[Dict[str, str]] = ContextVar("email_textos", default={})


@contextmanager
def usar_textos(textos: Dict[str, str] | None):
    """Usa estos textos mientras dure el bloque. Anidable y seguro entre peticiones."""
    ficha = _ACTUALES.set(limpiar(textos or {}))
    try:
        yield
    finally:
        _ACTUALES.reset(ficha)


def limpiar(crudos: Dict[str, str] | None) -> Dict[str, str]:
    """
    Se queda SOLO con las claves de `CAMPOS`.

    Es la puerta que hace imposible tocar los correos del pago o de la
    contraseña: da igual lo que haya guardado en la configuración, aquí se cae
    todo lo que no esté declarado como editable.
    """
    if not isinstance(crudos, dict):
        return {}
    validas: Dict[str, str] = {}
    for plantilla, campos in CAMPOS.items():
        for campo in campos:
            clave = f"{plantilla}.{campo}"
            valor = crudos.get(clave)
            if isinstance(valor, str) and valor.strip():
                validas[clave] = valor
    return validas


def texto(plantilla: str, campo: str, **variables) -> str:
    """El texto de este campo, ya con sus variables puestas. Nunca lanza."""
    ficha = CAMPOS.get(plantilla, {}).get(campo)
    if ficha is None:
        return ""
    plantilla_texto = _ACTUALES.get().get(f"{plantilla}.{campo}") or ficha.por_defecto
    try:
        return plantilla_texto.format(**variables)
    except (KeyError, IndexError, ValueError):
        # Una llave mal escrita por quien redactó. Se avisa al log y se manda el
        # correo con el texto de código, que es mejor que no mandarlo.
        logger.warning("Texto de correo con variables mal puestas: %s.%s", plantilla, campo)
        try:
            return ficha.por_defecto.format(**variables)
        except (KeyError, IndexError, ValueError):
            return ficha.por_defecto


_NEGRITA = re.compile(r"\*(.+?)\*", re.DOTALL)


def parrafos(plano: str, estilo_p: str) -> str:
    """
    Texto plano → párrafos HTML.

    Se escapa SIEMPRE: lo que teclee un administrador no puede meter etiquetas
    en un correo, ni por error ni a propósito. Las líneas en blanco separan
    párrafos y `*así*` pone en negrita, que es toda la maquetación que hace
    falta para redactar.
    """
    trozos = [t.strip() for t in (plano or "").split("\n\n")]
    salida = []
    for trozo in trozos:
        if not trozo:
            continue
        seguro = html.escape(trozo).replace("\n", "<br />")
        seguro = _NEGRITA.sub(r"<strong>\1</strong>", seguro)
        salida.append(f'<p style="{estilo_p}">{seguro}</p>')
    return "\n".join(salida)


def por_defecto() -> Dict[str, str]:
    """Todos los textos de código, para que el panel enseñe el punto de partida."""
    return {
        f"{plantilla}.{campo}": ficha.por_defecto
        for plantilla, campos in CAMPOS.items()
        for campo, ficha in campos.items()
    }


def catalogo() -> List[dict]:
    """Lo que necesita el panel para pintar el editor."""
    return [
        {
            "plantilla": plantilla,
            "campos": [
                {
                    "campo": campo,
                    "etiqueta": ficha.etiqueta,
                    "por_defecto": ficha.por_defecto,
                    "variables": ficha.variables,
                    "largo": ficha.largo,
                }
                for campo, ficha in campos.items()
            ],
        }
        for plantilla, campos in CAMPOS.items()
    ]

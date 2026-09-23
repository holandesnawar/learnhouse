"""
Enlace de pago personal: el closer lo crea desde el panel con los datos de la
persona y se lo manda por WhatsApp.

Por qué no un Payment Link de Stripe
------------------------------------
Un Payment Link cobra, pero **no pasa por nuestro webhook**: nadie crea la
cuenta en la escuela ni manda el correo de "crea tu contraseña". Ya pasó con
una venta de verdad y hubo que dar de alta a mano (ver "Dar de alta a mano"
en CLAUDE.md). Este enlace abre **el mismo checkout de la escuela** que la
matrícula, así que el cobro sigue el camino de siempre: cuenta creada, correo,
factura NAWAR-XXXX de Stripe y venta en las estadísticas.

Cómo
----
El enlace lleva los datos de la persona firmados con el secreto de la escuela
(HMAC-SHA256 con `LEARNHOUSE_AUTH_JWT_SECRET_KEY`), así que nadie puede
cambiar el correo del enlace sin romper la firma. Al abrirlo, la escuela crea
en ese momento la sesión de pago y redirige al checkout con todo rellenado.

La sesión se crea AL ABRIR, no al generar el enlace: una sesión de Stripe
caduca en 24 h, y el enlace tiene que servir aunque la persona lo abra dentro
de tres días. El enlace en sí caduca a los `DIAS_VALIDEZ` días.
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Optional

DIAS_VALIDEZ = 14


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).decode().rstrip("=")


def _de_b64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def firmar(datos: dict, secreto: str, ahora: Optional[float] = None) -> str:
    """Token `cuerpo.firma`. El cuerpo lleva los datos y la caducidad."""
    cuerpo = dict(datos)
    cuerpo["exp"] = int((ahora or time.time()) + DIAS_VALIDEZ * 86400)
    crudo = _b64(json.dumps(cuerpo, ensure_ascii=False, separators=(",", ":")).encode())
    firma = _b64(hmac.new(secreto.encode(), crudo.encode(), hashlib.sha256).digest())
    return f"{crudo}.{firma}"


def verificar(token: str, secreto: str, ahora: Optional[float] = None) -> Optional[dict]:
    """Los datos si la firma es buena y no ha caducado; None si no."""
    try:
        crudo, firma = token.split(".", 1)
        esperada = _b64(hmac.new(secreto.encode(), crudo.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(firma, esperada):
            return None
        datos = json.loads(_de_b64(crudo))
    except Exception:  # noqa: BLE001
        return None
    if int(datos.get("exp", 0)) < (ahora or time.time()):
        return None
    return datos

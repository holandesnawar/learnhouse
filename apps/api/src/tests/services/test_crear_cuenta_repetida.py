"""Crear cuenta dos veces con la misma contraseña no es "caducado" (14/10/2026).

La pantalla de crear cuenta dejaba el botón activo tras el éxito: quien lo
volvía a pulsar gastaba un código ya usado y veía «caducado» aunque su
contraseña ya estuviera puesta.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from src.security.security import security_hash_password
from src.services.users.password_reset import _misma_contrasena_reciente

AHORA = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


def _usuario(clave: str, hace: timedelta | None):
    cuando = (AHORA - hace).replace(tzinfo=None) if hace is not None else None
    return SimpleNamespace(password=security_hash_password(clave), password_changed_at=cuando)


def test_misma_contrasena_recien_puesta():
    assert _misma_contrasena_reciente(_usuario("Hola-1234!", timedelta(minutes=2)), "Hola-1234!", AHORA)


def test_otra_contrasena_no_vale():
    assert not _misma_contrasena_reciente(_usuario("Hola-1234!", timedelta(minutes=2)), "Otra-5678!", AHORA)


def test_hace_mas_de_un_dia_no_vale():
    assert not _misma_contrasena_reciente(_usuario("Hola-1234!", timedelta(days=2)), "Hola-1234!", AHORA)


def test_sin_fecha_no_vale():
    assert not _misma_contrasena_reciente(_usuario("Hola-1234!", None), "Hola-1234!", AHORA)

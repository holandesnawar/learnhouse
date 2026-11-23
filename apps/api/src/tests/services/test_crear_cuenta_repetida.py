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


# ── El enlace de alta: 15 días y no se gasta al usarlo (23/11/2026) ─────────

import json

from src.services.users.password_reset import _tras_usar, es_de_alta, estado_de_codigo


class _RedisFalso:
    def __init__(self):
        self.datos: dict[str, str] = {}

    def set(self, k, v, keepttl=False, ex=None):
        self.datos[k] = v

    def delete(self, k):
        self.datos.pop(k, None)


def test_el_de_alta_se_marca_usado_y_sigue_vivo():
    r = _RedisFalso()
    obj = {"reset_code_type": "alta", "reset_code_expires": 9_999_999_999}
    r.datos["k"] = json.dumps(obj)
    _tras_usar(r, "k", obj)
    guardado = json.loads(r.datos["k"])
    assert guardado["usado_at"]
    assert estado_de_codigo(guardado)["estado"] == "usado"


def test_el_de_olvide_mi_contrasena_se_gasta():
    r = _RedisFalso()
    obj = {"reset_code_type": "password_reset", "reset_code_expires": 9_999_999_999}
    r.datos["k"] = json.dumps(obj)
    _tras_usar(r, "k", obj)
    assert "k" not in r.datos


def test_estado_del_enlace():
    assert estado_de_codigo(None)["estado"] == "no_valido"
    assert estado_de_codigo({"reset_code_expires": 1})["estado"] == "caducado"
    assert estado_de_codigo({"reset_code_expires": 9_999_999_999})["estado"] == "valido"
    assert es_de_alta({"reset_code_type": "alta"}) and not es_de_alta({"reset_code_type": "password_reset"})


def test_el_de_alta_vale_quince_dias():
    from src.services.payments.payments import _TTL_ALTA_TRAS_PAGAR

    assert _TTL_ALTA_TRAS_PAGAR == 15 * 24 * 60 * 60

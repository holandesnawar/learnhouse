"""`en_hilo`: mandar un correo (o hablar con Stripe) sin congelar la escuela.

La API es un solo proceso con un solo bucle: una llamada síncrona lenta en
una ruta async para a TODOS. `en_hilo` la lleva a un hilo y mantiene lo que
importa: el resultado, las excepciones, los textos de `usar_textos` y el
registro del correo en `email_log`."""
import asyncio
import time

import pytest

from src.services.email import utils as U
from src.services.email.textos import _ACTUALES, usar_textos


@pytest.mark.asyncio
async def test_devuelve_lo_mismo_y_las_excepciones_salen_tal_cual():
    assert await U.en_hilo(lambda a, b=0: a + b, 2, b=3) == 5

    def falla():
        raise ValueError("Resend no contesta")

    with pytest.raises(ValueError, match="Resend no contesta"):
        await U.en_hilo(falla)


@pytest.mark.asyncio
async def test_no_para_el_bucle_mientras_espera():
    latidos = []

    async def latir():
        for _ in range(5):
            latidos.append(time.monotonic())
            await asyncio.sleep(0.02)

    inicio = time.monotonic()
    await asyncio.gather(U.en_hilo(time.sleep, 0.3), latir())
    # Los latidos siguieron mientras el hilo dormía (si no, irían todos al final).
    assert latidos[-1] - inicio < 0.25


@pytest.mark.asyncio
async def test_los_textos_de_la_escuela_viajan_al_hilo():
    with usar_textos({"new_direct_message.boton": "Hoi"}):
        visto = await U.en_hilo(lambda: dict(_ACTUALES.get()))
    assert visto.get("new_direct_message.boton") == "Hoi"


@pytest.mark.asyncio
async def test_el_correo_se_apunta_aunque_se_mande_desde_un_hilo(monkeypatch):
    import src.core.events.database as database

    guardados = []

    class Sesion:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def add(self, fila):
            guardados.append(fila)

        async def commit(self):
            pass

    monkeypatch.setattr(database, "_async_session_factory", lambda: Sesion())

    await U.en_hilo(U._apuntar_correo, "ana@ejemplo.com", "Hola", True)
    for _ in range(20):
        if guardados:
            break
        await asyncio.sleep(0.01)
    assert guardados and guardados[0].email == "ana@ejemplo.com"


def test_desde_un_hilo_sin_bucle_no_falla():
    # Un script suelto, sin bucle: no se apunta y ya.
    U._apuntar_correo("ana@ejemplo.com", "Hola", True)

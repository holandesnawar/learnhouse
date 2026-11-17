"""La copia del volumen se empaqueta en un hilo y sale un tar.gz de verdad."""
import tarfile
from pathlib import Path

import pytest

from src.routers import backup


@pytest.mark.asyncio
async def test_empaqueta_el_volumen_en_un_hilo(monkeypatch, tmp_path):
    contenido = tmp_path / "content"
    (contenido / "orgs").mkdir(parents=True)
    (contenido / "orgs" / "nota.webm").write_bytes(b"x" * 1000)

    async def autorizar(request, db_session):
        return "prueba"

    monkeypatch.setattr(backup, "_autorizar", autorizar)
    monkeypatch.setattr(backup, "CONTENT_DIR", contenido)

    hilos = []
    original = backup.asyncio.to_thread

    async def to_thread(fn, *a, **k):
        hilos.append(fn)
        return await original(fn, *a, **k)

    monkeypatch.setattr(backup.asyncio, "to_thread", to_thread)

    respuesta = await backup.api_content_archive(request=None, db_session=None)
    ruta = Path(respuesta.path)
    try:
        assert hilos, "el tar tiene que hacerse fuera del bucle"
        with tarfile.open(ruta, "r:gz") as tar:
            assert "content/orgs/nota.webm" in tar.getnames()
    finally:
        ruta.unlink(missing_ok=True)

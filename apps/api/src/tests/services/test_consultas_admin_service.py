"""
El tablón de consultas atendido desde el panel.

Lo que se comprueba aquí es lo que rompería en silencio: que el filtro de
pendientes/resueltas viaja bien, que solo salen de la escuela los campos de la
lista blanca, que no se publica una respuesta vacía y que una tabla sin las
columnas de registro (`resolved_at` / `resolved_by`) no deja a un profe sin
poder contestar.
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

from src.services.consultas import admin as svc


def _respuesta(status_code: int, payload, text: str = "") -> httpx.Response:
    if payload is None:
        return httpx.Response(status_code=status_code, text=text)
    return httpx.Response(status_code=status_code, json=payload)


FILA = {
    "id": "c-1",
    "title": "¿Cómo digo la hora?",
    "content": "No me sale",
    "category": "gramatica",
    "author_name": "Ana",
    "author_email": "ana@example.com",
    "created_at": "2026-08-01T10:00:00Z",
    "resolved": False,
    "respuesta_nawar": None,
    "resolved_at": None,
    "resolved_by": None,
    # Columnas que existen en la tabla pero NO deben salir de la escuela.
    "edit_token": "no-debe-salir",
}


async def test_lista_filtra_pendientes_y_recorta_campos():
    llamar = AsyncMock(return_value=_respuesta(200, [FILA]))
    with patch.object(svc, "_llamar", llamar):
        filas = await svc.list_consultas("pending")

    params = llamar.await_args.kwargs["params"]
    assert params["resolved"] == "is.false"
    assert params["order"] == "created_at.desc"

    assert len(filas) == 1
    assert filas[0]["author_email"] == "ana@example.com"
    assert "edit_token" not in filas[0]


async def test_lista_resueltas_y_todas():
    llamar = AsyncMock(return_value=_respuesta(200, []))
    with patch.object(svc, "_llamar", llamar):
        await svc.list_consultas("resolved")
        assert llamar.await_args.kwargs["params"]["resolved"] == "is.true"

        await svc.list_consultas(None)
        assert "resolved" not in llamar.await_args.kwargs["params"]


async def test_lista_propaga_el_fallo_de_supabase():
    llamar = AsyncMock(return_value=_respuesta(500, None, text="boom"))
    with patch.object(svc, "_llamar", llamar):
        with pytest.raises(HTTPException) as exc:
            await svc.list_consultas()
    assert exc.value.status_code == 502


@pytest.mark.parametrize("texto", ["", "   ", "\n\t "])
async def test_no_se_publica_una_respuesta_vacia(texto):
    llamar = AsyncMock()
    with patch.object(svc, "_llamar", llamar):
        with pytest.raises(HTTPException) as exc:
            await svc.answer_consulta("c-1", texto, "profe@escuela.com")
    assert exc.value.status_code == 400
    llamar.assert_not_awaited()


async def test_responder_marca_resuelta_y_apunta_quien():
    resuelta = {**FILA, "resolved": True, "respuesta_nawar": "Se dice zo laat"}
    llamar = AsyncMock(return_value=_respuesta(200, [resuelta]))
    with patch.object(svc, "_llamar", llamar):
        fila = await svc.answer_consulta("c-1", "  Se dice zo laat  ", "profe@escuela.com")

    enviado = llamar.await_args.kwargs["json"]
    assert enviado["respuesta_nawar"] == "Se dice zo laat"  # sin espacios de sobra
    assert enviado["resolved"] is True
    assert enviado["resolved_by"] == "profe@escuela.com"
    assert enviado["resolved_at"]
    assert fila["resolved"] is True
    assert "edit_token" not in fila


async def test_si_faltan_las_columnas_de_registro_se_guarda_igual():
    """Sin `resolved_at`/`resolved_by` la respuesta se publica de todas formas."""
    fallo = _respuesta(400, None, text='{"message":"column \\"resolved_at\\" does not exist"}')
    ok = _respuesta(200, [{**FILA, "resolved": True, "respuesta_nawar": "Hola"}])
    llamar = AsyncMock(side_effect=[fallo, ok])
    with patch.object(svc, "_llamar", llamar):
        fila = await svc.answer_consulta("c-1", "Hola", "profe@escuela.com")

    assert llamar.await_count == 2
    segundo = llamar.await_args.kwargs["json"]
    assert segundo == {"respuesta_nawar": "Hola", "resolved": True}
    assert fila["resolved"] is True


async def test_responder_una_consulta_que_ya_no_existe():
    llamar = AsyncMock(return_value=_respuesta(200, []))
    with patch.object(svc, "_llamar", llamar):
        with pytest.raises(HTTPException) as exc:
            await svc.answer_consulta("c-1", "Hola", "profe@escuela.com")
    assert exc.value.status_code == 404


async def test_borrar_cuenta_las_filas():
    llamar = AsyncMock(return_value=_respuesta(200, [FILA]))
    with patch.object(svc, "_llamar", llamar):
        assert (await svc.delete_consulta("c-1"))["deleted"] == 1

    llamar = AsyncMock(return_value=_respuesta(200, []))
    with patch.object(svc, "_llamar", llamar):
        with pytest.raises(HTTPException) as exc:
            await svc.delete_consulta("c-1")
    assert exc.value.status_code == 404


async def test_sin_la_clave_maestra_no_se_llama_a_nadie(monkeypatch):
    monkeypatch.delenv("CONSULTAS_SUPABASE_SERVICE_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        await svc._llamar("GET", params={})
    assert exc.value.status_code == 503

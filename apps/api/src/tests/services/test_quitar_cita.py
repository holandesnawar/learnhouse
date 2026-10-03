"""Quitar una cita del calendario de Llamadas (03/10: "quiero poder eliminar
del calendario la prueba que hice"). En Calendly no se toca nada."""

import pytest

from src.services.contactos.resultado_llamada import (
    devolver_cita,
    quitar_cita,
    resultados,
    separar_quitadas,
)
from src.services.contactos.seguimiento import borrar_seguimiento


def test_separar_quitadas():
    citas = [
        {"id": "a", "email": "lead@x.com"},
        {"id": "b", "email": "yo@x.com"},
        {"id": "c", "email": "prueba@x.com"},
    ]
    hechos = {"b": {"resultado": "quitada"}, "a": {"resultado": "piensa"}}
    visibles, quitadas = separar_quitadas(citas, hechos, {"prueba@x.com"})
    assert [c["id"] for c in visibles] == ["a"]
    assert {c["id"]: c["quitada_por"] for c in quitadas} == {"b": "mano", "c": "prueba"}


@pytest.mark.asyncio
async def test_quitar_y_devolver(db):
    await quitar_cita("cita-1", "yo@x.com", "Yo", "2026-10-02T10:00:00Z", "Admin", db)
    assert (await resultados(db))["cita-1"]["resultado"] == "quitada"

    # Borrar a la persona no la devuelve al calendario: la cita sigue en Calendly.
    await borrar_seguimiento("yo@x.com", db)
    await db.commit()
    assert (await resultados(db))["cita-1"]["resultado"] == "quitada"

    await devolver_cita("cita-1", db)
    assert "cita-1" not in await resultados(db)

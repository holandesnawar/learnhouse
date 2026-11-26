"""El asistente de ventas: la puerta con secreto y lo que devuelve (26/11/2026)."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src.routers import asistente_ventas as AV


def _pide(token: str | None):
    cab = {} if token is None else {AV.CABECERA: token}
    return SimpleNamespace(headers=cab)


def test_sin_variable_no_entra_nadie(monkeypatch):
    monkeypatch.delenv(AV.VARIABLE, raising=False)
    with pytest.raises(HTTPException) as e:
        AV._autorizar(_pide("lo-que-sea"))
    assert e.value.status_code == 503


def test_con_secreto_malo_o_sin_el_401(monkeypatch):
    monkeypatch.setenv(AV.VARIABLE, "secreto-bueno-largo")
    for t in (None, "", "otro"):
        with pytest.raises(HTTPException) as e:
            AV._autorizar(_pide(t))
        assert e.value.status_code == 401
    AV._autorizar(_pide("secreto-bueno-largo"))


def test_la_tarjeta_sale_sin_lo_interno():
    t = {
        "email": "ana@x.com", "nombre": "Ana", "telefono": "+31612345678", "etapa": "pendiente-pago",
        "mesa": "ventas", "closer": "Diego", "closer_id": 4, "notas": 2, "ultima_nota": "Paga el viernes",
        "cita": {"inicio": "2026-11-20T17:00:00Z", "id": "abc", "confirmada": True, "whatsapp": 3},
        "reserva": {"pagado_cents": 5000, "total_cents": 59700, "pendiente_cents": 54700},
        "intentos": 1, "oculto": False, "suelta": False,
    }
    s = AV.tarjeta_para_el_asistente(t)
    assert s["columna"] == "Por pagar"
    assert s["cita"] == {"inicio": "2026-11-20T17:00:00Z", "confirmada": True, "whatsapp_enviados": 3}
    assert s["senal"] == {"pagado_eur": 50.0, "total_eur": 597.0, "falta_eur": 547.0}
    assert "closer_id" not in s and "oculto" not in s and "id" not in s["cita"]


def test_busca_por_nombre_correo_o_telefono():
    t = {"nombre": "Ana María López", "email": "ana@x.com", "telefono": "+31 6 1234 5678"}
    assert AV.coincide(t, "ana lópez")
    assert AV.coincide(t, "ANA@x")
    assert AV.coincide(t, "0612345678")
    assert not AV.coincide(t, "Belén")


@pytest.mark.asyncio
async def test_leads_filtra_por_columna_y_quita_alumnos_y_pruebas(monkeypatch):
    monkeypatch.setenv(AV.VARIABLE, "s")
    tarjetas = [
        {"email": "a@x.com", "nombre": "A", "etapa": "seguimiento", "closer": "Diego"},
        {"email": "b@x.com", "nombre": "B", "etapa": "pendiente-pago", "closer": "Belén"},
        {"email": "c@x.com", "nombre": "C", "etapa": "alumno", "closer": "Diego"},
        {"email": "d@x.com", "nombre": "D", "etapa": "seguimiento", "oculto": True},
    ]

    async def datos(*_a):
        return {"etapas": [], "tarjetas": tarjetas}

    async def org(_db):
        return 1

    with patch("src.services.panel.tablero_datos.datos_tablero", datos), patch.object(AV, "_org_id", org):
        r = await AV.api_leads(_pide("s"), None, None, None, 0, None)
        assert [x["email"] for x in r["leads"]] == ["a@x.com", "b@x.com"]
        r = await AV.api_leads(_pide("s"), "Por pagar,no-show", None, None, 0, None)
        assert [x["email"] for x in r["leads"]] == ["b@x.com"]
        r = await AV.api_leads(_pide("s"), None, "diego", None, 1, None)
        assert [x["email"] for x in r["leads"]] == ["a@x.com", "c@x.com"]

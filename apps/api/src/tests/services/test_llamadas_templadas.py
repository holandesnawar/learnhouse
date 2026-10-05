"""Llamadas templadas (05/10/2026): quien se quedó a medias entra solo, y el
closer puede apuntar a gente a mano con nombre, móvil, notas y fecha."""

from datetime import date, datetime, timedelta, timezone

import pytest

from src.db.contact_event import ContactEvent
from src.db.enrollment import Enrollment
from src.db.llamadas_templadas import LlamadaTemplada
from src.services.contactos.templadas import (
    actualizar_templada,
    crear_templada,
    detalle_de,
    filas_automaticas,
    listar_templadas,
    ordenar_pendientes,
    quitar_templada,
    toca,
)

AHORA = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)


def _ev(email, kind="agendar-empezado", hace_h=5, extra=None):
    return {
        "kind": kind,
        "email": email,
        "nombre": "Ana",
        "telefono": "+31 6 1",
        "created_at": (AHORA - timedelta(hours=hace_h)).isoformat(),
        "extra": extra or {},
    }


def test_entra_quien_se_quedo_a_medias_una_vez_por_correo():
    filas = filas_automaticas(
        [_ev("ana@x.com", extra={"ultima": "Horas"}), _ev("ana@x.com"), _ev("bea@x.com", kind="admision", extra={"video": "visto"})],
        set(), set(), set(), {}, AHORA,
    )
    assert [f["email"] for f in filas] == ["ana@x.com", "bea@x.com"]
    assert filas[0]["origen"] == "agendar" and "«Horas»" in filas[0]["detalle"]
    assert filas[1]["origen"] == "admision" and "vio el vídeo entero" in filas[1]["detalle"]
    assert filas[0]["clave"] == "auto:ana@x.com"


def test_no_entran_los_que_terminaron_pagaron_ya_estan_o_estan_rellenando():
    filas = filas_automaticas(
        [_ev("fin@x.com"), _ev("pago@x.com"), _ev("ya@x.com"), _ev("ahora@x.com", hace_h=0.2)],
        {"fin@x.com"}, {"pago@x.com"}, {"ya@x.com"}, {}, AHORA,
    )
    assert filas == []


def test_atendido_en_la_lista_vieja_entra_como_hecha():
    filas = filas_automaticas([_ev("ana@x.com")], set(), set(), set(), {"ana@x.com": "2026-10-01"}, AHORA)
    assert filas[0]["estado"] == "hecha"


def test_admision_antigua_marcada_con_embudo():
    assert detalle_de("admision", {}).startswith("Dejó sus datos y no terminó el vídeo")
    filas = filas_automaticas([_ev("a@x.com", extra={"embudo": "admision"})], set(), set(), set(), {}, AHORA)
    assert filas[0]["origen"] == "admision"


def test_orden_primero_lo_que_toca():
    hoy = date(2026, 10, 5)
    assert toca("2026-10-04", hoy) == "vencida" and toca("2026-10-05", hoy) == "hoy" and toca("", hoy) == ""
    filas = [
        {"id": 1, "llamar_el": "", "created_at": "2026-10-01"},
        {"id": 2, "llamar_el": "2026-10-09", "created_at": ""},
        {"id": 3, "llamar_el": "2026-10-05", "created_at": ""},
        {"id": 4, "llamar_el": "2026-10-02", "created_at": ""},
        {"id": 5, "llamar_el": "", "created_at": "2026-10-03"},
    ]
    assert [f["id"] for f in ordenar_pendientes(filas, hoy)] == [4, 3, 2, 5, 1]


@pytest.mark.asyncio
async def test_lista_de_verdad(db):
    viejo = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    db.add(ContactEvent(email="ana@x.com", kind="agendar-empezado", first_name="Ana", phone="+316", created_at=viejo))
    db.add(ContactEvent(email="fin@x.com", kind="agendar-empezado", created_at=viejo))
    db.add(ContactEvent(email="fin@x.com", kind="cualificacion", created_at=viejo))
    db.add(ContactEvent(email="pago@x.com", kind="admision", created_at=viejo))
    db.add(Enrollment(email="pago@x.com", first_name="P", last_name="P", status="paid", created_at=viejo))
    await db.commit()

    r = await crear_templada({"nombre": "Luis", "telefono": "+34 600", "notas": "Le interesa en enero"}, "Closer", db)
    assert r["ok"]
    assert not (await crear_templada({"notas": "sin nada"}, "Closer", db))["ok"]

    lista = await listar_templadas(db)
    nombres = sorted(p["nombre"] or p["email"] for p in lista["pendientes"])
    assert nombres == ["Ana", "Luis"]
    # Abrir la lista otra vez no duplica.
    lista = await listar_templadas(db)
    assert len(lista["pendientes"]) == 2

    ana = next(p for p in lista["pendientes"] if p["nombre"] == "Ana")
    r = await actualizar_templada(ana["id"], {"llamar_el": "2026-10-20", "notas": "Llamar tarde"}, db)
    assert r["templada"]["llamar_el"] == "2026-10-20"
    assert not (await actualizar_templada(ana["id"], {"llamar_el": "mañana"}, db))["ok"]

    # Quitar una automática la descarta (no vuelve a entrar); una de mano se borra.
    assert (await quitar_templada(ana["id"], db))["borrada"] is False
    luis = next(p for p in lista["pendientes"] if p["nombre"] == "Luis")
    assert (await quitar_templada(luis["id"], db))["borrada"] is True
    lista = await listar_templadas(db)
    assert lista["pendientes"] == []
    assert [c["email"] for c in lista["cerradas"]] == ["ana@x.com"]
    assert len((await db.execute(LlamadaTemplada.__table__.select())).all()) == 1

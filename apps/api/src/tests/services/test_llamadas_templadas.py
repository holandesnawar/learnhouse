"""Llamadas templadas (05/10/2026): quien se quedó a medias entra solo, y el
closer puede apuntar a gente a mano con nombre, móvil, notas y fecha."""

from datetime import datetime, timedelta, timezone

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
    temperatura,
    quitar_templada,
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


def test_temperatura_por_la_ultima_senal():
    assert temperatura((AHORA - timedelta(hours=20)).isoformat(), AHORA) == "caliente"  # ayer
    assert temperatura((AHORA - timedelta(days=3)).isoformat(), AHORA) == "templado"
    assert temperatura((AHORA - timedelta(days=9)).isoformat(), AHORA) == "frio"
    assert temperatura("", AHORA) == "frio"


def test_orden_la_mas_caliente_arriba():
    filas = [
        {"id": 1, "temperatura": "frio", "ultima_senal": "2026-09-20"},
        {"id": 2, "temperatura": "caliente", "ultima_senal": "2026-10-04"},
        {"id": 3, "temperatura": "templado", "ultima_senal": "2026-10-01"},
        {"id": 4, "temperatura": "caliente", "ultima_senal": "2026-10-05"},
    ]
    assert [f["id"] for f in ordenar_pendientes(filas)] == [4, 2, 3, 1]


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
    # Ana dejó sus datos hace 3 horas: caliente. Luis se acaba de apuntar: caliente.
    assert {p["temperatura"] for p in lista["pendientes"]} == {"caliente"}
    nombres = sorted(p["nombre"] or p["email"] for p in lista["pendientes"])
    assert nombres == ["Ana", "Luis"]
    # Abrir la lista otra vez no duplica.
    lista = await listar_templadas(db)
    assert len(lista["pendientes"]) == 2

    ana = next(p for p in lista["pendientes"] if p["nombre"] == "Ana")
    r = await actualizar_templada(ana["id"], {"estado": "hecha"}, db)
    assert r["templada"]["estado"] == "hecha"
    r = await actualizar_templada(ana["id"], {"estado": "pendiente"}, db)
    assert r["templada"]["estado"] == "pendiente"
    assert not (await actualizar_templada(ana["id"], {"estado": "rara"}, db))["ok"]

    # Quitar una automática la descarta (no vuelve a entrar); una de mano se borra.
    assert (await quitar_templada(ana["id"], db))["borrada"] is False
    luis = next(p for p in lista["pendientes"] if p["nombre"] == "Luis")
    assert (await quitar_templada(luis["id"], db))["borrada"] is True
    lista = await listar_templadas(db)
    assert lista["pendientes"] == []
    assert [c["email"] for c in lista["cerradas"]] == ["ana@x.com"]
    assert len((await db.execute(LlamadaTemplada.__table__.select())).all()) == 1


@pytest.mark.asyncio
async def test_las_notas_son_las_de_la_ficha(db):
    from src.services.contactos.seguimiento import anadir_nota, seguimiento_de

    # Con correo, la nota va a la ficha (sin prefijos) y la fila no guarda copia.
    r = await crear_templada({"nombre": "Sol", "email": "sol@x.com", "notas": "Quiere empezar en enero"}, "Closer", db, 7)
    assert r["templada"]["notas"] == "" and r["templada"]["n_notas"] == 1
    assert [n["texto"] for n in (await seguimiento_de("sol@x.com", db))["notas"]] == ["Quiere empezar en enero"]

    # Una nota puesta desde la ficha sale en la lista.
    await anadir_nota("sol@x.com", "Le llamo el jueves", 7, "Closer", db)
    sol = next(p for p in (await listar_templadas(db))["pendientes"] if p["email"] == "sol@x.com")
    assert sol["n_notas"] == 2 and sol["ultima_nota"] == "Le llamo el jueves"

    # Sin correo, las notas viven en la fila; al ponerle correo, pasan a la ficha.
    r = await crear_templada({"nombre": "Pepe", "notas": "Vecino"}, "Closer", db, 7)
    assert r["templada"]["notas"] == "Vecino" and r["templada"]["ultima_nota"] == "Vecino"
    r = await actualizar_templada(r["templada"]["id"], {"email": "pepe@x.com"}, db, "Closer", 7)
    assert r["templada"]["notas"] == "" and r["templada"]["ultima_nota"] == "Vecino"
    assert [n["texto"] for n in (await seguimiento_de("pepe@x.com", db))["notas"]] == ["Vecino"]


@pytest.mark.asyncio
async def test_mandar_desde_la_ficha_sin_duplicar(db):
    from src.services.contactos.templadas import mandar_a_templadas, templada_de

    viejo = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    db.add(ContactEvent(email="eva@x.com", kind="agendar-empezado", first_name="Eva", created_at=viejo))
    await db.commit()

    r = await mandar_a_templadas("eva@x.com", "Eva", "+316", "Closer", db)
    assert r["ok"] and not r["ya_estaba"] and r["templada"]["estado"] == "pendiente"
    # Abrir la lista no la mete otra vez como automática.
    lista = await listar_templadas(db)
    assert [p["email"] for p in lista["pendientes"]] == ["eva@x.com"]

    # Mandarla otra vez no duplica; si estaba quitada, vuelve.
    assert (await quitar_templada(r["templada"]["id"], db))["borrada"] is False
    assert [c["email"] for c in (await listar_templadas(db))["cerradas"]] == ["eva@x.com"]
    r2 = await mandar_a_templadas("eva@x.com", "Eva", "", "Closer", db)
    assert r2["templada"]["id"] == r["templada"]["id"] and r2["templada"]["estado"] == "pendiente"
    assert (await mandar_a_templadas("eva@x.com", "Eva", "", "Closer", db))["ya_estaba"] is True
    assert (await templada_de("EVA@x.com", db))["estado"] == "pendiente"
    assert not (await mandar_a_templadas("sin-correo", "X", "", "Closer", db))["ok"]


@pytest.mark.asyncio
async def test_la_temperatura_sube_si_vuelve_a_dar_senales(db):
    from src.db.enrollment_request import EnrollmentRequest

    hace10 = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    db.add(ContactEvent(email="leo@x.com", kind="agendar-empezado", first_name="Leo", created_at=hace10))
    await db.commit()
    leo = (await listar_templadas(db))["pendientes"][0]
    assert leo["temperatura"] == "frio"

    # Ayer pidió plaza por otro formulario: vuelve a estar caliente.
    ayer = (datetime.now(timezone.utc) - timedelta(hours=20)).isoformat()
    db.add(EnrollmentRequest(email="leo@x.com", first_name="Leo", created_at=ayer))
    await db.commit()
    leo = (await listar_templadas(db))["pendientes"][0]
    assert leo["temperatura"] == "caliente"

"""Procesos del equipo, los SOP (24/11/2026): áreas, asignar, «Lo he leído»,
quién lo ve y la campana. Base de datos de verdad (SQLite en memoria)."""

import asyncio

import pytest

from src.services.equipo import procesos as P


class Persona:
    def __init__(self, id=2, first_name="Rida", last_name="", username="rida"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


GENTE = [
    {"id": 2, "nombre": "Rida", "rol": "Dirección", "avatar": ""},
    {"id": 5, "nombre": "Diego", "rol": "Closer", "avatar": ""},
    {"id": 7, "nombre": "Luna", "rol": "Profe", "avatar": ""},
]


@pytest.fixture(autouse=True)
def _gente(monkeypatch):
    async def miembros(org_id, db):
        return GENTE

    monkeypatch.setattr(P, "miembros", miembros)


async def test_asignar_leer_y_volver_a_leer_si_cambia(db):
    p = await P.guardar(
        1,
        None,
        {"titulo": "Llamar a un lead nuevo", "seccion": "Ventas", "resumen": "En menos de 15 minutos", "texto": "1. Llama", "asignados": [5, 99]},
        Persona(),
        db,
    )
    # Alguien de fuera del equipo no se asigna.
    assert [a["id"] for a in p["asignados"]] == [5]
    assert p["asignados"][0]["estado"] == "pendiente"

    # A Diego le sale en la campana y en la lista como suyo.
    avisos = P.avisos_de(await P._filas(1, db), 5, lambda i: f"/x/{i}")
    assert len(avisos) == 1 and "Te han asignado" in avisos[0]["title"] and avisos[0]["excerpt"] == "En menos de 15 minutos"
    suyo = (await P.listar(1, 5, False, db))[0]
    assert suyo["mio"] and suyo["lectura"] == "pendiente"
    # Lo que ve quien no es administrador: a quién va, sin quién lo ha leído.
    assert "estado" not in suyo["asignados"][0]

    leido = await P.marcar_leido(1, p["id"], Persona(5, "Diego"), False, True, db)
    assert leido["lectura"] == "leido"
    assert P.avisos_de(await P._filas(1, db), 5, lambda i: "") == []

    # Cambiar el orden no le hace leerlo otra vez; cambiar el texto, sí.
    await asyncio.sleep(0.01)
    await P.guardar(1, p["id"], {"orden": 9, "resumen": "Otra línea"}, Persona(), db)
    assert (await P.listar(1, 5, False, db))[0]["lectura"] == "leido"
    await P.guardar(1, p["id"], {"texto": "1. Llama\n2. Apunta la nota"}, Persona(), db)
    assert (await P.listar(1, 5, False, db))[0]["lectura"] == "cambiado"
    avisos = P.avisos_de(await P._filas(1, db), 5, lambda i: "")
    assert "Ha cambiado" in avisos[0]["title"]

    # El administrador ve quién lo ha leído.
    admin = (await P.listar(1, 2, True, db))[0]
    assert admin["asignados"][0]["estado"] == "cambiado"

    # Volver a guardar la lista de asignados conserva cuándo se asignó.
    antes = P.asignados_de(await P._uno(1, p["id"], db))[5]
    await P.guardar(1, p["id"], {"asignados": [5, 7]}, Persona(), db)
    ahora = P.asignados_de(await P._uno(1, p["id"], db))
    assert ahora[5] == antes and 7 in ahora


async def test_solo_para_los_asignados(db):
    p = await P.guardar(1, None, {"titulo": "Pagar a los profes", "seccion": "Dinero", "visible": "asignados", "asignados": [5]}, Persona(), db)
    await P.guardar(1, None, {"titulo": "Para todos", "seccion": "General"}, Persona(), db)
    assert [x["titulo"] for x in await P.listar(1, 7, False, db)] == ["Para todos"]
    assert {x["titulo"] for x in await P.listar(1, 5, False, db)} == {"Pagar a los profes", "Para todos"}
    assert len(await P.listar(1, 2, True, db)) == 2
    # Quien no lo ve tampoco lo marca.
    with pytest.raises(P.EquipoError) as exc:
        await P.marcar_leido(1, p["id"], Persona(7, "Luna"), False, True, db)
    assert exc.value.status == 403
    # Otra escuela no lo toca.
    with pytest.raises(P.EquipoError):
        await P.guardar(2, p["id"], {"titulo": "x"}, Persona(), db)


def test_lo_viejo_del_manual_se_lee_bien():
    class Viejo:
        id = 1
        titulo = "Preparar la semana"
        seccion = "Clases"
        texto = "x"
        orden = 1.0
        created_at = "2026-11-08T10:00:00+00:00"
        updated_at = created_at
        creado_por = actualizado_por = "Rida"
        resumen = asignados = lecturas = cambiado_at = visible = ""

    d = P.proceso_a_dict(Viejo(), 7, False, {})
    assert d["asignados"] == [] and d["mio"] is False and d["lectura"] == "" and d["cambiado_at"] == Viejo.created_at
    assert P.puede_ver(Viejo(), 7, False)

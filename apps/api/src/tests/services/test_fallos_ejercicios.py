"""«¿Ves un fallo? Avísanos» (23/11/2026), contra una base de datos de verdad
(SQLite en memoria)."""

import pytest

from src.db.ejercicio_aviso import EjercicioAviso  # noqa: F401  (registra la tabla)
from src.services.ejercicios import avisos as A


class Persona:
    def __init__(self, id=1, first_name="Ana", last_name="", username="ana"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


DATOS = {
    "tipo": "order_sentence",
    "enunciado": "Ordena: «Él es mi amigo»",
    "opciones": ["Hij", "is", "mijn", "vriend"],
    "correcta": "Hij is mijn vriend",
    "respuesta_alumno": "Hij is een vriend",
    "leccion": "Les 1 · Familie",
    "modulo": "Familie & vrienden",
    "cualquier_cosa": "x" * 5000,
}


def test_lo_que_manda_el_navegador_se_recorta():
    limpio = A.limpiar_datos({**DATOS, "enunciado": "a" * 5000, "opciones": ["x"] * 40, "parejas": [{"izquierda": "de naam", "derecha": "el nombre"}, "roto"]})
    assert len(limpio["enunciado"]) == 600 and len(limpio["opciones"]) == 12
    assert "cualquier_cosa" not in limpio
    assert limpio["parejas"] == [{"izquierda": "de naam", "derecha": "el nombre"}]
    # Lo roto no rompe.
    assert A.limpiar_datos(None)["opciones"] == [] and A.limpiar_datos("texto")["correcta"] == ""


async def test_un_aviso_por_alumno_y_ejercicio_agrupados_por_ejercicio(db):
    ana, luis = Persona(1, "Ana"), Persona(2, "Luis")
    await A.avisar(1, ana, {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-7", "motivo": "respuesta", "comentario": " Según la lección es «mi novio» ", "datos": DATOS}, db)
    await A.avisar(1, luis, {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-7", "motivo": "inventado", "datos": DATOS}, db)
    await A.avisar(1, ana, {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-9", "motivo": "audio"}, db)
    # Ana avisa otra vez del mismo: se cambia el suyo, no se añade otro.
    await A.avisar(1, ana, {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-7", "motivo": "varias", "comentario": "Valen las dos", "datos": DATOS}, db)

    lista = await A.listar(1, db)
    assert [g["exercise_id"] for g in lista["abiertos"]] == ["m2l1e-7", "m2l1e-9"]
    g = lista["abiertos"][0]
    assert g["alumnos"] == 2 and g["abiertos"] == 2 and g["datos"]["correcta"] == "Hij is mijn vriend"
    # (En este test no hay cuentas: el nombre sale «Alumno». El de Ana es el último que se tocó.)
    de_ana, de_luis = g["avisos"]
    assert de_ana["motivo"] == "varias" and de_ana["comentario"] == "Valen las dos" and de_ana["respuesta_alumno"] == "Hij is een vriend"
    # Un motivo que no existe cae en «Otra cosa».
    assert de_luis["motivo_texto"] == "Otra cosa" and de_luis["nombre"] == "Alumno"
    assert lista["cerrados"] == []
    # Otra escuela no ve nada.
    assert (await A.listar(2, db))["abiertos"] == []


async def test_cerrar_reabrir_y_la_campana(db):
    ana, luis = Persona(1, "Ana"), Persona(2, "Luis")
    for quien in (ana, luis):
        await A.avisar(1, quien, {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-7", "motivo": "respuesta", "datos": DATOS}, db)
    campana = await A.para_la_campana(1, db)
    assert campana[0]["title"] == "2 avisos de fallos en ejercicios" and campana[0]["url"] == "/dash/estadisticas?tab=fallos"
    assert campana[0]["excerpt"] == "El último, en Les 1 · Familie."

    await A.cerrar(1, "m2-les-1", "m2l1e-7", "arreglado", "Rida", db)
    lista = await A.listar(1, db)
    assert lista["abiertos"] == [] and lista["cerrados"][0]["estado"] == "arreglado" and lista["cerrados"][0]["cerrado_por"] == "Rida"
    assert await A.para_la_campana(1, db) == []

    # Otro alumno avisa del mismo después de «arreglado»: vuelve arriba.
    await A.avisar(1, Persona(3, "Eva"), {"lesson_id": "m2-les-1", "exercise_id": "m2l1e-7", "motivo": "respuesta"}, db)
    lista = await A.listar(1, db)
    assert lista["abiertos"][0]["abiertos"] == 1 and lista["abiertos"][0]["alumnos"] == 3
    assert (await A.para_la_campana(1, db))[0]["title"] == "1 aviso de fallo en un ejercicio"

    # «No era un fallo» y reabrir a mano.
    await A.cerrar(1, "m2-les-1", "m2l1e-7", "no-era", "Rida", db)
    assert (await A.listar(1, db))["cerrados"][0]["estado"] == "no-era"
    await A.cerrar(1, "m2-les-1", "m2l1e-7", "nuevo", "Rida", db)
    assert (await A.listar(1, db))["abiertos"][0]["abiertos"] == 3

    with pytest.raises(A.AvisoError):
        await A.cerrar(1, "m2-les-1", "m2l1e-7", "borrado", "Rida", db)
    with pytest.raises(A.AvisoError) as e:
        await A.cerrar(1, "m2-les-1", "no-existe", "arreglado", "Rida", db)
    assert e.value.status == 404


async def test_tope_diario_y_ejercicio_obligatorio(db, monkeypatch):
    monkeypatch.setattr(A, "TOPE_AL_DIA", 3)
    ana = Persona(1, "Ana")
    for i in range(3):
        await A.avisar(1, ana, {"lesson_id": "l", "exercise_id": f"e-{i}"}, db)
    with pytest.raises(A.AvisoError) as e:
        await A.avisar(1, ana, {"lesson_id": "l", "exercise_id": "e-3"}, db)
    assert e.value.status == 429
    # Cambiar uno de los que ya avisó sí puede.
    await A.avisar(1, ana, {"lesson_id": "l", "exercise_id": "e-0", "comentario": "y además…"}, db)
    with pytest.raises(A.AvisoError):
        await A.avisar(1, ana, {"lesson_id": "l", "exercise_id": "  "}, db)

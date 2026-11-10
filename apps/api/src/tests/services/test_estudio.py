"""El Estudio (10/11/2026): la pizarra y el banco de ideas, contra una base de
datos de verdad (SQLite en memoria)."""

import pytest

from src.services.estudio import estudio as E


class Persona:
    def __init__(self, id=1, first_name="Rida", last_name="", username="rida"):
        self.id, self.first_name, self.last_name, self.username = id, first_name, last_name, username


def test_partir_lineas_quita_numeros_y_repetidas():
    texto = "1. Por qué «ui» no suena «ui»\n- **Tres frases** para el médico\n\n• Por qué «ui» no suena «ui»\n2) ok\nx"
    assert E.partir_lineas(texto) == ["Por qué «ui» no suena «ui»", "Tres frases para el médico"]


def test_marcar_canales():
    antes = {"instagram": "2026-11-01"}
    # Marcar otro lo apunta con el día de hoy; el que ya estaba no cambia de día.
    assert E.marcar_canales(antes, {"tiktok": True, "instagram": True}, "2026-11-10") == {"instagram": "2026-11-01", "tiktok": "2026-11-10"}
    # Desmarcar lo quita; un canal que no existe no entra.
    assert E.marcar_canales(antes, {"instagram": False, "telegram": True}, "2026-11-10") == {}
    # Con fecha, esa fecha.
    assert E.marcar_canales({}, {"blog": "2026-11-05"}, "2026-11-10") == {"blog": "2026-11-05"}


def test_formato_de_linea():
    assert E.formato_de_linea("Reel · «La g holandesa» · cómo se coloca la boca") == "reel"
    assert E.formato_de_linea("Carrusel: 5 palabras que ya sabes") == "carrusel"
    assert E.formato_de_linea("Artículo - Cómo pedir cita") == "blog"
    assert E.formato_de_linea("La g holandesa no es una jota") == ""
    assert E.formato_de_linea("Recuerda: la g no es una jota") == ""


async def test_las_pegadas_sin_formato_lo_sacan_de_la_linea(db):
    ideas = await E.crear_varias(1, "1. Reel · «a b c»\n2. Carrusel · «d e f»\n3. Otra cosa suelta", {"objetivo": "alcance"}, Persona(), True, db)
    assert [i["formato"] for i in ideas] == ["reel", "carrusel", ""]
    # Si se elige un formato, manda ese.
    ideas = await E.crear_varias(1, "Reel · «x y z»", {"formato": "tiktok"}, Persona(), True, db)
    assert ideas[0]["formato"] == "tiktok"


async def test_pizarra_e_ideas(db):
    rida = Persona()
    nota = await E.crear(1, {"titulo": "Falta una lección de cartas del gemeente", "area": "formacion"}, rida, True, db)
    assert nota["tipo"] == "nota" and nota["area"] == "formacion" and nota["autor"] == "Rida"

    ideas = await E.crear_varias(1, "1. Reel: la g holandesa\n2. Reel: 3 frases para el súper", {"formato": "reel", "objetivo": "alcance"}, rida, True, db)
    assert [i["titulo"] for i in ideas] == ["Reel: la g holandesa", "Reel: 3 frases para el súper"]
    assert all(i["tipo"] == "idea" and i["formato"] == "reel" and i["objetivo"] == "alcance" and i["area"] == "contenido" for i in ideas)
    # La primera línea pegada queda arriba.
    lista = await E.listar(1, True, db)
    assert [i["titulo"] for i in lista][:2] == ["Reel: la g holandesa", "Reel: 3 frases para el súper"]

    # Marcar dónde se publicó, y pasarla a hecha.
    hecha = await E.cambiar(1, ideas[0]["id"], {"canales": {"instagram": True, "tiktok": True}, "estado": "hecho"}, 1, True, db)
    assert set(hecha["canales"]) == {"instagram", "tiktok"} and hecha["estado"] == "hecho"
    quitada = await E.cambiar(1, ideas[0]["id"], {"canales": {"tiktok": False}}, 1, True, db)
    assert set(quitada["canales"]) == {"instagram"}

    # Una nota se convierte en idea.
    idea = await E.cambiar(1, nota["id"], {"tipo": "idea", "formato": "carrusel", "objetivo": "ventas"}, 1, True, db)
    assert idea["tipo"] == "idea" and idea["formato"] == "carrusel"

    # Sin texto, no. Otra escuela no la toca.
    with pytest.raises(E.EstudioError):
        await E.crear(1, {"titulo": "  "}, rida, True, db)
    with pytest.raises(E.EstudioError):
        await E.cambiar(2, nota["id"], {"titulo": "x"}, 1, True, db)
    with pytest.raises(E.EstudioError):
        await E.crear_varias(1, "\n \n", {}, rida, True, db)

    await E.borrar(1, nota["id"], 1, True, db)
    assert nota["id"] not in [i["id"] for i in await E.listar(1, True, db)]


async def test_el_closer_solo_ventas(db):
    rida, diego, belen = Persona(), Persona(2, "Diego", "Sosa", "diego"), Persona(3, "Belén", "", "belen")
    await E.crear(1, {"titulo": "Idea de reel", "area": "contenido"}, rida, True, db)
    de_rida = await E.crear(1, {"titulo": "Objeción nueva: el precio a plazos", "area": "ventas"}, rida, True, db)
    # El closer escribe siempre en ventas, pida lo que pida.
    de_diego = await E.crear(1, {"titulo": "Preguntan mucho por el horario", "area": "contenido"}, diego, False, db)
    assert de_diego["area"] == "ventas"

    # Ve solo ventas (lo suyo y lo de los demás); no el resto.
    assert {i["titulo"] for i in await E.listar(1, False, db)} == {"Objeción nueva: el precio a plazos", "Preguntan mucho por el horario"}
    assert [a["id"] for a in E.catalogo(False)["areas"]] == ["ventas"]

    # Cambia y borra lo suyo; lo de otro, no. Y no lo saca de ventas.
    cambiada = await E.cambiar(1, de_diego["id"], {"titulo": "Preguntan por el horario de las clases", "area": "producto"}, 2, False, db)
    assert cambiada["area"] == "ventas"
    with pytest.raises(E.EstudioError) as exc:
        await E.cambiar(1, de_rida["id"], {"titulo": "x"}, 2, False, db)
    assert exc.value.status == 403
    with pytest.raises(E.EstudioError):
        await E.borrar(1, de_diego["id"], belen.id, False, db)
    await E.borrar(1, de_diego["id"], 2, False, db)

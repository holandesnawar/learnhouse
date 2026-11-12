"""Crear una clase desde el calendario de la sala de profes (12/11/2026)."""

from datetime import datetime

import pytest
from sqlmodel import select

from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.organization_config import OrganizationConfig
from src.services.tareas import clase_nueva as CN
from src.services.tareas import material_profe as MP
from src.services.tareas import tareas as T

pytestmark = pytest.mark.asyncio


def test_fechas_nombres_y_dia_de_la_otra_clase():
    assert CN.fechas_a_crear("2026-11-17", 3) == ["2026-11-17", "2026-11-24", "2026-12-01"]
    assert CN.fechas_a_crear("2026-11-17", None) == ["2026-11-17"]
    assert len(CN.fechas_a_crear("2026-11-17", 99)) == CN.MAX_REPETIR
    assert CN.fechas_a_crear("mañana", 2) == []
    assert CN.nombre_provisional("2026-11-17") == "Clase del 17 nov"
    # La otra clase se da los jueves: su día en la semana del martes 17 es el 19.
    assert CN.dia_en_su_semana("2026-11-17", ["2026-11-05", "2026-11-12", "2026-11-03"]) == "2026-11-19"
    assert CN.dia_en_su_semana("2026-11-17", []) == "2026-11-17"
    # El capítulo toma el tema cuando se pone, salvo que tenga un nombre puesto a mano.
    assert CN.nombre_del_capitulo("Clase del 17 nov", "", "Mijn huis", "2026-11-17") == "Mijn huis"
    assert CN.nombre_del_capitulo("Mijn huis", "Mijn huis", "Mijn straat", "2026-11-17") == "Mijn straat"
    assert CN.nombre_del_capitulo("NOVIEMBRE · semana 3", "Mijn huis", "Mijn straat", "2026-11-17") is None
    assert CN.nombre_del_capitulo("Clase del 17 nov", "", "", "2026-11-24") == "Clase del 24 nov"
    assert CN.nombre_del_capitulo("Mijn huis", "Mijn huis", "Mijn huis", "2026-11-17") is None


async def _clases(db, org):
    a = str(datetime.now())
    db.add(OrganizationConfig(org_id=org.id, creation_date=a, update_date=a,
                              config={"salas": {"rood": {"directo": True}, "blauw": {"directo": True}, "sc": {"directo": True}}}))
    for cid, cu, nombre in ((6, "course_rood", "Clase semanal"), (2, "course_blauw", "Clase semanal"), (8, "course_sc", "Spreekclub"),
                            (9, "course_form", "Formación")):
        db.add(Course(id=cid, name=nombre, description="", public=False, published=True, open_to_contributors=False,
                      org_id=org.id, course_uuid=cu, creation_date=a, update_date=a))
    await db.commit()
    return await T.curso_de("rood", db), await T.curso_de("blauw", db), await T.curso_de("sc", db)


async def test_crear_la_clase_sin_tema_y_ponerselo_despues(db, org):
    _, _, sc = await _clases(db, org)
    r = await CN.crear_clases(sc, {"fecha": "2026-11-18", "profe": "Tom"}, "Rida", True, db)
    assert [(c["fecha"], c["tema"], c["curso"]) for c in r["creadas"]] == [("2026-11-18", "", "Spreekclub")]
    s = await T.tarea(r["creadas"][0]["semana_id"], db)
    assert s.tema == "" and MP.leer(s.material_profe)["profe"] == "Tom"
    cap = (await db.execute(select(Chapter).where(Chapter.chapter_uuid == s.chapter_uuid))).scalars().first()
    assert cap.name == "Clase del 18 nov" and cap.course_id == 8
    assert (await db.execute(select(CourseChapter).where(CourseChapter.chapter_id == cap.id))).scalars().first().order == 1
    # Cambiarle solo el día no da error aunque no tenga tema, y el capítulo sigue al día.
    await T.editar_semana(s, {"tema": "", "fecha": "2026-11-19"}, db)
    await db.refresh(cap)
    assert cap.name == "Clase del 19 nov"
    # Al ponerle el tema, el capítulo se llama así.
    await T.editar_semana(s, {"tema": "Praten over het weekend"}, db)
    await db.refresh(cap)
    assert cap.name == "Praten over het weekend" and s.tema == "Praten over het weekend"
    # El mismo día no se crea dos veces.
    otra = await CN.crear_clases(sc, {"fecha": "2026-11-19"}, "Rida", True, db)
    assert otra["creadas"] == [] and otra["saltadas"] == [{"curso": "Spreekclub", "fecha": "2026-11-19"}]


async def test_repetir_y_tambien_en_el_otro_grupo(db, org):
    rood, blauw, _ = await _clases(db, org)
    # Blauw ya tiene una clase un jueves: ese es su día.
    await CN.crear_clases(blauw, {"fecha": "2026-11-12", "tema": "Kleding"}, "Rida", True, db)
    r = await CN.crear_clases(rood, {"fecha": "2026-11-17", "tema": "Mijn huis", "repetir": 2, "tambien": True, "profe": "Paul"}, "Rida", True, db)
    assert [(c["course_uuid"], c["fecha"], c["tema"]) for c in r["creadas"]] == [
        ("rood", "2026-11-17", "Mijn huis"), ("rood", "2026-11-24", ""),
        ("blauw", "2026-11-19", "Mijn huis"), ("blauw", "2026-11-26", ""),
    ]
    # «Quién la da» es de la clase en la que se crea: en la otra no se copia.
    profes = {}
    for c in r["creadas"]:
        profes[(c["course_uuid"], c["fecha"])] = MP.leer((await T.tarea(c["semana_id"], db)).material_profe)["profe"]
    assert profes[("rood", "2026-11-17")] == "Paul" and profes[("blauw", "2026-11-19")] == ""
    # Un profe (no administrador) crea la clase, pero no decide quién la da.
    r2 = await CN.crear_clases(rood, {"fecha": "2026-12-08", "profe": "Yo"}, "Paul", False, db)
    assert MP.leer((await T.tarea(r2["creadas"][0]["semana_id"], db)).material_profe)["profe"] == ""


async def test_solo_en_clases_en_directo_y_con_dia(db, org):
    _, _, sc = await _clases(db, org)
    with pytest.raises(T.TareaError):
        await CN.crear_clases(await T.curso_de("form", db), {"fecha": "2026-11-18"}, "Rida", True, db)
    with pytest.raises(T.TareaError):
        await CN.crear_clases(sc, {"fecha": ""}, "Rida", True, db)


def test_como_fue_la_clase():
    m = MP.con_despues(MP.leer(""), "  Fue bien, costó el perfectum.  ", "Paul")
    assert MP.para_la_pantalla(MP.leer(m))["despues"]["texto"] == "Fue bien, costó el perfectum."
    assert MP.leer(m)["despues"]["por"] == "Paul"
    assert "despues" not in MP.con_despues(m, "", "Paul")

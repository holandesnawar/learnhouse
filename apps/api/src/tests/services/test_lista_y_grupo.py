"""La lista que pasa el profe y «Tu grupo esta semana» (07/11/2026).

- Lo que marca el profe manda sobre la sala de Daily; sin marca, vale la sala.
- La lista solo se pasa el día de la clase o después, y solo de sus alumnos.
- Cuenta en el Seguimiento y en el Camino, por días (sin contar dos veces).
- La tarjeta del grupo: dónde va la mayoría, quién va detrás, lo que fallan
  varios alumnos, nuevos y sin entrar.
"""

import pytest

from src.services.panel import camino, tandas
from src.services.tareas import grupo as G
from src.services.tareas import tareas as T
from src.tests.services.test_tareas import _clase_con_semana, contenido  # noqa: F401


def test_lo_que_marca_el_profe_manda():
    marcas = T.leer_asistencia('{"7": {"fue": true}, "8": {"fue": false}, "9": {"x": 1}, "10": "basura"}')
    assert set(marcas) == {"7", "8"}
    assert T.leer_asistencia("no es json") == {}
    assert T.fue_a_clase(7, marcas, None) is True
    assert T.fue_a_clase(8, marcas, {"8"}) is False  # el profe dice que no, aunque la sala le viera
    assert T.fue_a_clase(11, marcas, {"11"}) is True  # sin marca, la sala
    assert T.fue_a_clase(11, marcas, None) is None  # ni lista ni sala: no se sabe


def test_el_camino_cuenta_por_dias_y_junta_la_lista():
    sesiones = [
        # Dos sesiones el mismo día (se cortó y volvió a entrar): un solo día.
        {"id": "a", "start_time": 1730728800, "participants": [{"user_id": "7", "duration": 1500}]},  # 4 nov 2024 15:00 UTC
        {"id": "b", "start_time": 1730732400, "participants": [{"user_id": "7", "duration": 900}]},
        {"id": "c", "start_time": 1731333600, "participants": [{"user_id": "8", "duration": 2000}]},  # 11 nov
    ]
    en_sala = camino.dias_en_sala(sesiones)
    assert en_sala == {"7": {"2024-11-04"}, "8": {"2024-11-11"}}
    junto = camino.juntar_con_la_lista(en_sala, {"2024-11-11": {"8": False, "9": True}, "2024-11-04": {"7": True}})
    assert junto == {"7": {"2024-11-04"}, "9": {"2024-11-11"}}


async def test_pasar_lista_y_el_seguimiento(db, org, monkeypatch, contenido):  # noqa: F811
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-01")
    c = await _clase_con_semana(db, org)
    r = await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02"}, "Rida", db)
    s = await T.tarea(r["semana"]["id"], db)
    # Antes del día de la clase, no.
    with pytest.raises(T.TareaError):
        await T.pasar_lista(org.id, s, {"7": True}, "Paul", db)

    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-02")
    lista = await T.lista_de_clase(org.id, s, db)
    assert [a["nombre"] for a in lista["alumnos"]] == ["Ana", "Luis"] and not lista["pasada"]
    # El 9 es de otra clase: no se apunta.
    lista = await T.pasar_lista(org.id, s, {"7": True, "8": False, "9": True}, "Paul", db)
    assert lista["pasada"] and lista["vinieron"] == 1 and lista["por"] == "Paul"
    assert [(a["nombre"], a["fue"]) for a in lista["alumnos"]] == [("Ana", True), ("Luis", False)]

    seg = await T.seguimiento(org.id, "mc", s.id, db)
    ana, luis = seg["alumnos"]
    assert ana["clase"] is True and ana["clase_origen"] == "lista"
    assert luis["clase"] is False
    assert seg["cifras"]["clase"] == 1 and seg["cifras"]["sabe_clase"] and seg["aviso"] == ""
    assert seg["lista_pasada"] and seg["lista_por"] == ["Paul"]

    # La tarjeta de «Mis clases» sabe que ya se pasó (solo el equipo).
    eq = await T.semanas_para_alumno(c, 1, db, equipo=True)
    assert eq["semanas"][0]["lista"] == {"pasada": True, "vinieron": 1}
    al = await T.semanas_para_alumno(c, 7, db)
    assert "lista" not in al["semanas"][0]

    # Quitar una marca (None) vuelve a dejarlo sin saber.
    lista = await T.pasar_lista(org.id, s, {"8": None}, "Paul", db)
    assert [(a["nombre"], a["fue"]) for a in lista["alumnos"]] == [("Ana", True), ("Luis", None)]

    # Y cuenta en el Camino, aunque la clase no tenga sala (Zoom).
    tabla = await camino.camino(org.id, db)
    por_nombre = {a["nombre"]: a for a in tabla["alumnos"]}
    assert por_nombre["Ana"]["clases_directo"] == 1
    assert por_nombre["Ana"]["clases_por_curso"] == [{"curso": "Masterclass", "n": 1}]
    assert por_nombre["Luis"]["clases_directo"] == 0


def _av(modulo, clase, orden=("M1", "M2", "M3")):
    return {"siguiente": {"modulo": modulo, "clase": clase}, "pct": 40, "total": 10,
            "modulos": [{"nombre": m, "hechas": 0, "total": 3} for m in orden]}


def test_resumen_del_grupo():
    alumnos = [
        {"user_id": 1, "nombre": "Ana", "entro": "2026-09-08"},
        {"user_id": 2, "nombre": "Luis", "entro": "2026-09-08"},
        {"user_id": 3, "nombre": "Eva", "entro": "2026-09-08"},
        {"user_id": 4, "nombre": "Bram", "entro": "2026-11-05"},
        {"user_id": 5, "nombre": "Otra", "entro": "2026-09-08"},
        {"user_id": 6, "nombre": "Sara", "entro": "2026-09-08"},
    ]
    avances = {1: _av("M2", "2.3 Lezen"), 2: _av("M2", "2.3 Lezen"), 3: _av("M1", "1.4 Lezen"),
               4: _av("M1", "1.1"), 5: _av("M3", "3.1"), 6: _av("M2", "2.1")}
    ultima = {1: "2026-11-06", 2: "2026-11-05", 3: "2026-10-20", 5: "2026-11-06", 6: "2026-11-04"}
    intentos = [
        {"user_id": 1, "date": "2026-11-01T10:00", "failed_labels": ["jij wilt", "de trui"]},
        {"user_id": 2, "date": "2026-11-02T10:00", "failed_labels": ["jij wilt"]},
        {"user_id": 2, "date": "2026-11-03T10:00", "failed_labels": ["jij wilt"]},  # repetir no pesa más
        {"user_id": 3, "date": "2026-09-01T10:00", "failed_labels": ["de trui"]},  # hace más de 3 semanas
        {"user_id": 99, "date": "2026-11-02T10:00", "failed_labels": ["jij wilt"]},  # no es del grupo
    ]
    r = G.resumen_grupo(alumnos, avances, ultima, intentos, "2026-11-07")
    assert r["mayoria"] == {"modulo": "M2", "n": 3, "clase": "2.3 Lezen"}
    assert [d["nombre"] for d in r["detras"]] == ["Eva", "Bram"]
    assert [d["nombre"] for d in r["delante"]] == ["Otra"]
    assert r["fallos"] == [{"palabra": "jij wilt", "alumnos": 2}]
    assert [n["nombre"] for n in r["nuevos"]] == ["Bram"]
    assert [x["nombre"] for x in r["sin_entrar"]] == ["Eva"]


def test_consultas_del_grupo():
    consultas = [
        {"title": "¿hij wil o hij wilt?", "content": "No lo entiendo", "author_email": "ana@x.com", "author_name": "Ana",
         "created_at": "2026-11-05T10:00:00", "resolved": False},
        {"title": "Vieja", "content": "", "author_email": "ana@x.com", "created_at": "2026-10-01T10:00:00"},
        {"title": "De otro", "content": "", "author_email": "otro@x.com", "created_at": "2026-11-05T10:00:00"},
    ]
    r = G.consultas_del_grupo(consultas, {"ana@x.com"}, "2026-11-07")
    assert [c["titulo"] for c in r] == ["¿hij wil o hij wilt?"] and r[0]["respondida"] is False


async def test_vienes_a_la_clase(db, org, monkeypatch, contenido):  # noqa: F811
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-01")
    c = await _clase_con_semana(db, org)
    r = await T.crear_semana(org.id, c, {"chapter_uuid": "chapter_kleding", "tema": "De kleding", "fecha": "2026-11-02"}, "Rida", db)
    s = await T.tarea(r["semana"]["id"], db)
    assert (await T.confirmar_asistencia(s, 7, True, db)) == {"voy": True, "si": 1, "no": 0}
    assert (await T.confirmar_asistencia(s, 8, False, db))["no"] == 1
    al = await T.semanas_para_alumno(c, 7, db)
    assert al["semanas"][0]["voy"] is True and "confirmaciones" not in al["semanas"][0]
    eq = await T.semanas_para_alumno(c, 1, db, equipo=True)
    assert eq["semanas"][0]["confirmaciones"] == {"si": 1, "no": 1}
    # Se puede quitar, y el día de después ya no.
    assert (await T.confirmar_asistencia(s, 8, None, db))["no"] == 0
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-02")
    lista = await T.lista_de_clase(org.id, s, db)
    assert [(a["nombre"], a["voy"]) for a in lista["alumnos"]] == [("Ana", True), ("Luis", None)]
    monkeypatch.setattr(tandas, "hoy_nl", lambda ahora=None: "2026-11-03")
    with pytest.raises(T.TareaError):
        await T.confirmar_asistencia(s, 7, True, db)

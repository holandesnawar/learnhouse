"""Llamadas: el JSON de `extra` que no se rompe y la fila del panel."""

import json

from src.services.contactos.llamadas import extra_serializado, fila_llamada
from src.services.users.emails import send_llamada_pedida_email


def _respuestas(n: int, largo: int = 60):
    return [{"pregunta": f"Pregunta {i}", "respuesta": "x" * largo, "puntos": 1} for i in range(n)]


def test_extra_cabe_entero_cuando_es_corto():
    extra = {"apto": True, "puntuacion": 12, "respuestas": _respuestas(11)}
    texto = extra_serializado(extra)
    assert json.loads(texto) == extra


def test_extra_largo_sigue_siendo_json_valido():
    # Antes: `[:2000]` a secas → JSON cortado por la mitad → al leerlo, {}.
    extra = {"apto": True, "puntuacion": 12, "respuestas": _respuestas(11, largo=900)}
    texto = extra_serializado(extra, tope=8000)
    assert len(texto) <= 8000
    leido = json.loads(texto)
    assert leido["apto"] is True
    # Se recortan los textos largos antes que tirar las respuestas.
    assert len(leido["respuestas"]) == 11
    assert all(len(r["respuesta"]) <= 600 for r in leido["respuestas"])


def test_extra_imposible_deja_constancia_en_vez_de_romperse():
    extra = {"apto": False, "puntuacion": 3, "respuestas": _respuestas(40, largo=600)}
    texto = extra_serializado(extra, tope=1500)
    leido = json.loads(texto)
    assert leido["_truncado"] is True
    assert "respuestas" not in leido
    assert leido["puntuacion"] == 3


def test_fila_llamada_une_evento_y_solicitud():
    evento = {
        "id": 7,
        "email": "ana@ejemplo.com",
        "first_name": "Ana",
        "last_name": "Pérez",
        "phone": "+31 6 1234",
        "source": "llamada",
        "recorrido": "landing-precio,agendar",
        "referrer": "",
        "utm_campaign": "sept",
        "created_at": "2026-09-22T10:00:00+00:00",
        "extra": json.dumps({"apto": True, "puntuacion": 11, "respuestas": _respuestas(2)}),
    }
    fila = fila_llamada(evento, {"id": 3, "contacted_at": ""})
    assert fila["name"] == "Ana Pérez"
    assert fila["apto"] is True and fila["puntuacion"] == 11
    assert len(fila["respuestas"]) == 2
    assert fila["vio_precio"] is True
    assert fila["solicitud_id"] == 3 and fila["contacted_at"] == ""
    assert fila["sin_respuestas"] is False


def test_fila_llamada_con_extra_roto_no_revienta():
    fila = fila_llamada({"id": 1, "email": "x@y.z", "extra": "{no es json"}, None)
    assert fila["respuestas"] == [] and fila["sin_respuestas"] is True
    assert fila["solicitud_id"] is None


def test_correo_al_equipo_lleva_las_respuestas():
    llamada = fila_llamada(
        {
            "id": 1,
            "email": "ana@ejemplo.com",
            "first_name": "Ana",
            "phone": "+31612345678",
            "extra": {"apto": True, "puntuacion": 11, "respuestas": [{"pregunta": "¿Nivel?", "respuesta": "Cero <b>", "puntos": 2}]},
        },
        None,
    )
    out = send_llamada_pedida_email("admin@ejemplo.com", llamada, preview=True)
    assert "Ana" in out["subject"] and "encaja" in out["subject"]
    assert "¿Nivel?" in out["html"] and "Cero &lt;b&gt;" in out["html"]
    assert "tab=llamadas" in out["html"]
    assert "wa.me/31612345678" in out["html"]


# ── Los que empezaron y no terminaron ──────────────────────────────────────

from types import SimpleNamespace

from src.services.contactos.llamadas import elegir_eventos


def _ev(id, kind, email):
    return SimpleNamespace(id=id, kind=kind, email=email)


def test_empezado_sin_terminar_sale_una_vez():
    eventos = [
        _ev(5, "agendar-empezado", "ana@x.com"),
        _ev(3, "agendar-empezado", "ana@x.com"),
        _ev(2, "agendar-empezado", "luis@x.com"),
    ]
    ids = [e.id for e in elegir_eventos(eventos)]
    assert ids == [5, 2]


def test_empezado_que_luego_termino_no_sale():
    eventos = [
        _ev(9, "cualificacion", "ana@x.com"),
        _ev(8, "agendar-empezado", "ana@x.com"),
    ]
    assert [e.id for e in elegir_eventos(eventos)] == [9]


def test_si_termino_alguna_vez_no_se_duplica_por_volver_a_empezar():
    eventos = [
        _ev(12, "agendar-empezado", "ana@x.com"),
        _ev(9, "cualificacion", "ana@x.com"),
    ]
    assert [e.id for e in elegir_eventos(eventos)] == [9]


def test_fila_sin_terminar():
    fila = fila_llamada({"id": 4, "kind": "agendar-empezado", "email": "a@b.c", "first_name": "Ana"}, None)
    assert fila["terminado"] is False
    # No es que "no se guardaran": es que no llegó a contestar.
    assert fila["sin_respuestas"] is False
    assert fila["contacted_at"] == ""


def test_marca_de_atendida_en_el_evento():
    fila = fila_llamada(
        {"id": 4, "kind": "agendar-empezado", "email": "a@b.c", "extra": {"atendida_at": "2026-09-23T10:00:00+00:00"}},
        None,
    )
    assert fila["contacted_at"].startswith("2026-09-23")


def test_motivo_de_quedarse_fuera_llega_a_la_fila_y_al_correo():
    llamada = fila_llamada(
        {
            "id": 2,
            "email": "x@y.z",
            "first_name": "Luis",
            "extra": {"apto": False, "puntuacion": 9, "motivo_fuera": "Compromiso 1 de 5: dice que no es su momento", "respuestas": []},
        },
        None,
    )
    assert llamada["motivo_fuera"].startswith("Compromiso 1")
    out = send_llamada_pedida_email("admin@ejemplo.com", llamada, preview=True)
    assert "Compromiso 1 de 5" in out["html"]


def test_hora_reservada_llega_a_la_fila():
    fila = fila_llamada({"id": 3, "email": "a@b.c", "reservada_at": "2026-09-23T11:00:00+00:00", "extra": {"apto": True}}, None)
    assert fila["reservada_at"].startswith("2026-09-23")
    assert fila_llamada({"id": 3, "email": "a@b.c"}, None)["reservada_at"] == ""

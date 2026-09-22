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

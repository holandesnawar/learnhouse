"""La ficha enseña lo que contestó en el proceso de admisión y dónde se quedó
(08/10, el caso de Lina: las respuestas estaban guardadas pero no salían)."""

from src.services.panel.cliente import proceso_admision


def _r(pregunta, respuesta):
    return {"pregunta": pregunta, "respuesta": respuesta, "puntos": 1}


def test_sin_proceso_no_hay_bloque():
    assert proceso_admision([{"kind": "guia", "when": "2026-10-01T10:00:00", "extra": {}}]) is None


def test_terminado_enseña_respuestas_y_si_encaja():
    eventos = [
        {"kind": "admision", "when": "2026-10-07T10:00:00", "extra": {"embudo": "admision", "video": "visto", "respuestas": [_r("Nivel", "Cero")], "ultima": "Nivel"}},
        {
            "kind": "cualificacion",
            "when": "2026-10-07T10:20:00",
            "extra": {
                "embudo": "admision",
                "video": "visto",
                "apto": True,
                "respuestas": [_r("Nivel", "Cero"), _r("Horas", "3-5 h"), _r("Edad", "Sin responder")],
            },
        },
    ]
    a = proceso_admision(eventos)
    assert a["terminado"] is True
    assert a["apto"] is True
    assert a["reservo"] is False
    # Las «Sin responder» no se enseñan.
    assert a["respuestas"] == [{"pregunta": "Nivel", "respuesta": "Cero"}, {"pregunta": "Horas", "respuesta": "3-5 h"}]
    assert a["resumen"] == "Vio el vídeo entero. Terminó las preguntas (encaja) y no ha reservado hora."


def test_terminado_y_reservo_despues():
    eventos = [
        {"kind": "cualificacion", "when": "2026-10-07T10:20:00", "extra": {"apto": False, "motivo_fuera": "Sin capacidad de inversión", "respuestas": []}},
        {"kind": "reunion", "when": "2026-10-07T10:25:00", "extra": {}},
    ]
    a = proceso_admision(eventos)
    assert a["reservo"] is True
    assert a["resumen"] == "Terminó las preguntas (no encaja: Sin capacidad de inversión) y reservó hora."


def test_una_reunion_vieja_no_cuenta():
    eventos = [
        {"kind": "reunion", "when": "2026-09-01T10:00:00", "extra": {}},
        {"kind": "cualificacion", "when": "2026-10-07T10:20:00", "extra": {"apto": True, "respuestas": []}},
    ]
    assert proceso_admision(eventos)["reservo"] is False


def test_a_medias_dice_donde_se_fue():
    eventos = [
        {
            "kind": "admision",
            "when": "2026-10-07T10:00:00",
            "extra": {"embudo": "admision", "video": "visto", "respuestas": [_r("Nivel", "Cero"), _r("Dónde vives", "Países Bajos")], "ultima": "Dónde vives"},
        },
    ]
    a = proceso_admision(eventos)
    assert a["terminado"] is False
    assert len(a["respuestas"]) == 2
    assert a["resumen"] == "Vio el vídeo entero. Contestó 2 preguntas y se fue después de «Dónde vives»."


def test_vio_el_video_y_no_empezo():
    a = proceso_admision([{"kind": "admision", "when": "2026-10-07T10:00:00", "extra": {"embudo": "admision", "video": "visto"}}])
    assert a["resumen"] == "Vio el vídeo entero y no empezó las preguntas."


def test_solo_dejo_los_datos():
    a = proceso_admision([{"kind": "admision", "when": "2026-10-07T10:00:00", "extra": {"embudo": "admision", "video": "empezado"}}])
    assert a["resumen"] == "Dejó sus datos y no terminó el vídeo."


def test_agendar_sin_respuestas():
    a = proceso_admision([{"kind": "agendar-empezado", "when": "2026-09-25T10:00:00", "extra": {}}])
    assert a["resumen"] == "Dejó sus datos y no contestó ninguna pregunta."


def test_extra_en_texto_tambien_vale():
    a = proceso_admision([{"kind": "cualificacion", "when": "2026-10-07T10:00:00", "extra": '{"apto": true, "respuestas": [{"pregunta": "Nivel", "respuesta": "A1"}]}'}])
    assert a["respuestas"] == [{"pregunta": "Nivel", "respuesta": "A1"}]

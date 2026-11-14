from datetime import datetime, timedelta, timezone

from src.services.consultas.admin import correo_consulta_nueva, elegir_ultima_respondida


def test_correo_al_equipo_escapa_y_dice_quien():
    asunto, cuerpo = correo_consulta_nueva(
        {"title": "¿Het o de?", "author_name": "Ana <b>", "content": "Linea 1\n\nLinea 2", "category": "gramatica"}
    )
    assert asunto == "Consulta nueva: ¿Het o de?"
    assert "Ana &lt;b&gt;" in cuerpo and "Linea 2" in cuerpo and "gramatica" in cuerpo


def test_la_ultima_respondida_solo_si_es_reciente():
    ahora = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
    vieja = {"id": "a", "resolved": True, "respuesta_nawar": "x", "resolved_at": (ahora - timedelta(days=9)).isoformat()}
    nueva = {"id": "b", "resolved": True, "respuesta_nawar": "y", "resolved_at": (ahora - timedelta(days=1)).isoformat(), "author_email": "no@sale"}
    sin_resp = {"id": "c", "resolved": False, "respuesta_nawar": "", "created_at": ahora.isoformat()}
    r = elegir_ultima_respondida([vieja, nueva, sin_resp], ahora)
    assert r["id"] == "b" and "author_email" not in r
    assert elegir_ultima_respondida([vieja, sin_resp], ahora) is None


def test_enlace_de_grabacion_pegado():
    from src.services.salas.estudio_grabaciones import enlace_de, leer, para_la_semana

    b = enlace_de("https://iframe.mediadelivery.net/embed/123456/0a1b2c3d-1111-2222-3333-444455556666")
    assert b["tipo"] == "bunny" and "responsive=true" in b["url"]
    assert enlace_de("https://youtu.be/abcdefGHIJ1")["tipo"] == "youtube"
    assert enlace_de("hola que tal") is None
    g = leer({"partes": [], "enlace": b, "titulo": "Mijn huis"})
    assert g["enlace"]["url"] == b["url"]
    assert para_la_semana(g)["enlace"]["tipo"] == "bunny"
    assert leer({"partes": [], "enlace": {"original": "nada"}}) == {}

"""El vídeo de bienvenida en el Inicio (24/11/2026): a quién le sale."""

from src.services.student_progress.bienvenida import toca, url_de_reproductor


def test_solo_alumnos_nuevos_que_no_lo_han_visto():
    assert toca(4, "2026-11-24", "2026-11-24", False)
    assert toca(4, "2026-12-02", "2026-11-24", False)
    assert not toca(4, "2026-11-23", "2026-11-24", False)  # ya estaba
    assert not toca(4, "2026-11-25", "2026-11-24", True)  # ya lo vio
    assert not toca(5, "2026-11-25", "2026-11-24", False)  # profe
    assert not toca(4, "", "2026-11-24", False)


def test_el_enlace_de_compartir_de_bunny_pasa_a_reproductor():
    u = url_de_reproductor("https://player.mediadelivery.net/play/675650/abc")
    assert u.startswith("https://iframe.mediadelivery.net/embed/675650/abc?")
    assert "responsive=true" in u
    assert url_de_reproductor("") == ""

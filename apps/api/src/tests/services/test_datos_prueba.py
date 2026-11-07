"""Datos inventados de la escuela de pruebas: solo con la variable, y el PDF de ejemplo se lee."""
import io

from pypdf import PdfReader

from src.services.demo import datos_prueba as dp


def test_solo_con_la_variable(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_DATOS_DE_PRUEBA", raising=False)
    assert dp.activado() is False
    monkeypatch.setenv("LEARNHOUSE_DATOS_DE_PRUEBA", "si")
    assert dp.activado() is True
    monkeypatch.setenv("LEARNHOUSE_DATOS_DE_PRUEBA", "no")
    assert dp.activado() is False


def test_el_pdf_de_ejemplo_se_lee():
    r = PdfReader(io.BytesIO(dp.pdf_presentacion("Eten en drinken", ["Vocabulario", "Frases (útiles)"])))
    assert len(r.pages) == 3
    assert "Eten en drinken" in r.pages[0].extract_text()
    assert "útiles" in r.pages[1].extract_text()

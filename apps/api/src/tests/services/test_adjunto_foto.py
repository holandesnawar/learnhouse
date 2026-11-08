"""Fotos del chat y de Mensajes: se juzgan por su contenido, no por su nombre."""

import pytest
from fastapi import HTTPException

from src.services.communities.attachments import nombre_de_foto

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 20
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
HEIC = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 20


def test_un_jpeg_sin_extension_pasa_con_jpg():
    assert nombre_de_foto("image", JPEG) == "image.jpg"


def test_la_extension_sale_del_contenido():
    assert nombre_de_foto("IMG_1234.HEIC", JPEG) == "IMG_1234.jpg"
    assert nombre_de_foto("captura.jpg", PNG) == "captura.png"


def test_heic_se_rechaza_en_espanol():
    with pytest.raises(HTTPException) as e:
        nombre_de_foto("IMG_1.heic", HEIC)
    assert "HEIC" in e.value.detail and "captura" in e.value.detail


def test_lo_que_no_es_foto_se_rechaza():
    with pytest.raises(HTTPException):
        nombre_de_foto("x.jpg", b"hola que tal, esto no es una foto")

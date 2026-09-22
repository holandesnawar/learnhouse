from fastapi import HTTPException
import pytest

from src.services.webs.webs import destino_final, limpiar_slug


def test_las_utm_del_enlace_se_pegan_al_destino():
    url = destino_final("https://www.holandesnawar.com/formacion-nawar", {"utm_source": "instagram", "utm_campaign": "bio"})
    assert url == "https://www.holandesnawar.com/formacion-nawar?utm_source=instagram&utm_campaign=bio"


def test_las_utm_que_ya_traia_el_destino_ganan():
    url = destino_final("https://x.com/p?utm_source=email#top", {"utm_source": "instagram", "utm_medium": "bio"})
    assert "utm_source=email" in url and "utm_source=instagram" not in url
    assert "utm_medium=bio" in url and url.endswith("#top")


def test_un_destino_relativo_tambien_vale():
    assert destino_final("/lista-de-espera", {}) == "/lista-de-espera"


def test_el_slug_se_limpia_y_los_reservados_se_rechazan():
    assert limpiar_slug(" /IG/ ") == "ig"
    assert limpiar_slug("guia-x/sept") == "guia-x/sept"
    with pytest.raises(HTTPException):
        limpiar_slug("api/algo")
    with pytest.raises(HTTPException):
        limpiar_slug("con espacios y ñ")

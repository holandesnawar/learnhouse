"""Qué ve cada closer (05/11/2026): lo suyo, lo libre o todo."""

from unittest.mock import patch

import pytest

from src.services.panel import alcance as AL


def test_lo_suyo_y_lo_libre():
    f = AL.Filtro(4, True, {"ana@x.com": 4, "eva@x.com": 5})
    assert f.ve_correo("Ana@x.com") and f.ve_correo("sol@x.com") and f.ve_correo("")
    assert not f.ve_correo("eva@x.com")
    assert f.ve_closer(4) and f.ve_closer(0) and not f.ve_closer(5)


def test_solo_lo_suyo():
    f = AL.Filtro(4, False, {"ana@x.com": 4, "eva@x.com": 5})
    assert f.ve_correo("ana@x.com")
    assert not f.ve_correo("sol@x.com") and not f.ve_correo("eva@x.com") and not f.ve_correo("")
    assert not f.ve_closer(0)


def test_valores_raros_van_al_de_serie():
    assert AL.alcance_valido("todo") == "todo"
    assert AL.alcance_valido("") == AL.DE_SERIE == "suyo_y_libre"
    assert AL.alcance_valido("lo que sea") == "suyo_y_libre"


@pytest.mark.asyncio
async def test_quien_lo_ve_todo_y_quien_reparte():
    from src.security.rbac.constants import CLOSER_ROLE_ID

    async def rol_closer(*_):
        return CLOSER_ROLE_ID

    async def rol_admin(*_):
        return 1

    async def guardadas(_db):
        return {"ana@x.com": {"closer_id": 4}, "eva@x.com": {"closer_id": 5}, "sol@x.com": {"closer_id": 0}}

    def config(alcance):
        async def leer(*_):
            return {"numeros": False, "alcance": alcance}
        return leer

    async def reparte(user_id):
        async def leer(*_a, **_k):
            return {"repartidor_id": user_id, "calendly": {}, "avisar": {}}
        return leer

    with patch("src.services.orgs.acceso.rol_en_la_escuela", rol_admin):
        assert await AL.filtro_de(1, 1, None) is None
    with patch("src.services.orgs.acceso.rol_en_la_escuela", rol_closer), \
         patch("src.services.orgs.orgs.get_org_acceso_closer_config", config("todo")):
        assert await AL.filtro_de(4, 1, None) is None
    with patch("src.services.orgs.acceso.rol_en_la_escuela", rol_closer), \
         patch("src.services.orgs.orgs.get_org_acceso_closer_config", config("suyo_y_libre")), \
         patch("src.services.panel.pipeline.guardadas", guardadas):
        f = await AL.filtro_de(4, 1, None)
        assert f.libres and f.de == {"ana@x.com": 4, "eva@x.com": 5}
    with patch("src.services.orgs.acceso.rol_en_la_escuela", rol_closer), \
         patch("src.services.orgs.orgs.get_org_acceso_closer_config", config("suyo")), \
         patch("src.services.panel.pipeline.guardadas", guardadas), \
         patch("src.services.panel.reparto.leer", await reparte(4)):
        # Solo lo suyo, pero reparte él: sigue viendo lo libre.
        assert (await AL.filtro_de(4, 1, None)).libres
        assert not (await AL.filtro_de(5, 1, None)).libres

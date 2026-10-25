"""Guion de llamada y Enfoque del closer (services/contactos/guion.py).

- Los dos se leen de fábrica hasta que alguien los edita, y vacío = volver al
  de fábrica.
- Los precios que dicen son los que cobra la escuela: si cambia un precio en
  el código, este test avisa de que hay que cambiar también estos textos.
- Desde el 25/10/2026 no se vende la clase semanal de conversación.
"""

from datetime import datetime

from src.db.organization_config import OrganizationConfig
from src.services.contactos import guion
from src.services.payments.payments import PRECIO_BASE_CENTS
from src.services.payments.plazos import OPCIONES


def _euros(cents: int) -> str:
    return f"{cents // 100} €" if cents % 100 == 0 else f"{cents / 100:.2f} €".replace(".", ",")


def test_los_precios_de_los_textos_son_los_del_cobro():
    for texto in (guion.GUION_DE_FABRICA, guion.ENFOQUE_DE_FABRICA):
        assert _euros(PRECIO_BASE_CENTS) in texto
        for total in OPCIONES.values():
            assert _euros(total) in texto
        assert "15 días" in texto


def test_ya_no_se_vende_la_clase_semanal():
    assert "queda grabada" not in guion.GUION_DE_FABRICA
    assert "masterclass" in guion.GUION_DE_FABRICA and "spreekuren" in guion.GUION_DE_FABRICA
    assert "«Enfoque»" in guion.GUION_DE_FABRICA
    assert "Ya NO se vende la «clase semanal de conversación»" in guion.ENFOQUE_DE_FABRICA
    # Lo que no se sabía al escribirlo se marca, no se inventa.
    assert "[POR COMPLETAR" in guion.ENFOQUE_DE_FABRICA


async def test_leer_guardar_y_volver_al_de_fabrica(db, org):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0"},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()

    assert await guion.leer_enfoque(org.id, db) == {"texto": guion.ENFOQUE_DE_FABRICA, "de_fabrica": True}
    r = await guion.guardar_enfoque(org.id, "## Masterclass\n- Jueves a las 19:00", db)
    assert r == {"texto": "## Masterclass\n- Jueves a las 19:00", "de_fabrica": False}
    # Cada página guarda lo suyo: el guion sigue de fábrica.
    assert (await guion.leer_guion(org.id, db))["de_fabrica"] is True
    assert (await guion.guardar_enfoque(org.id, "   ", db))["de_fabrica"] is True

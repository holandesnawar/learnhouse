"""Guardar el calendario del goteo: las fechas tienen que quedarse guardadas."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

from sqlmodel import select

from src.db.organization_config import OrganizationConfig
from src.services.orgs.orgs import update_org_drip_config


async def test_guarda_fechas_y_dias(db, org, admin_user, mock_request):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0"},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()

    with patch("src.services.orgs.orgs.rbac_check", new_callable=AsyncMock):
        await update_org_drip_config(
            mock_request,
            {"enabled": True, "chapters": {"c1": 0, "c4": 7},
             "fechas": {"c4": "2026-10-12", "c5": "2026-10-19", "c6": ""}},
            org.id, admin_user, db,
        )

    cfg = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    await db.refresh(cfg)
    drip = cfg.config["drip_content"]
    assert drip["enabled"] is True
    assert drip["fechas"] == {"c4": "2026-10-12", "c5": "2026-10-19"}
    assert drip["chapters"] == {"c1": 0, "c4": 7}


async def test_la_apertura_por_avance_se_guarda_y_no_se_pierde(db, org, admin_user, mock_request):
    db.add(OrganizationConfig(org_id=org.id, config={"config_version": "2.0"},
                              creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()

    async def guardar(datos):
        with patch("src.services.orgs.orgs.rbac_check", new_callable=AsyncMock):
            await update_org_drip_config(mock_request, datos, org.id, admin_user, db)
        cfg = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
        await db.refresh(cfg)
        return cfg.config["drip_content"]

    drip = await guardar({"enabled": True, "chapters": {}, "fechas": {}, "avance": {"activo": True, "desde": "2026-11-02"}})
    assert drip["avance"] == {"activo": True, "desde": "2026-11-02"}
    # Una pantalla que no manda `avance` no la borra.
    drip = await guardar({"enabled": True, "chapters": {}, "fechas": {"c4": "2026-10-12"}, "avance": None})
    assert drip["avance"] == {"activo": True, "desde": "2026-11-02"}

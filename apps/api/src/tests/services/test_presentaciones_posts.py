"""Las presentaciones de chat a tablón, una sola vez (09/11/2026)."""

from datetime import datetime

from sqlmodel import select

from src.db.communities.communities import Community
from src.db.communities.discussions import Discussion
from src.db.organization_config import OrganizationConfig
from src.services.communities.presentaciones_posts import es_de_presentaciones, pasar


def test_nombres():
    assert es_de_presentaciones("👋 Presentaciones")
    assert es_de_presentaciones("Preséntate")
    assert es_de_presentaciones("presentate aquí")
    assert not es_de_presentaciones("General")
    assert not es_de_presentaciones("Victorias")


def _canal(uuid, nombre, kind="chat"):
    ahora = str(datetime.now())
    return Community(org_id=1, name=nombre, community_uuid=uuid, kind=kind, creation_date=ahora, update_date=ahora)


async def test_pasa_solo_las_presentaciones_y_una_vez(db, org):
    db.add(OrganizationConfig(org_id=1, config={"general": {"x": 1}}))
    for c in [_canal("community_p", "👋 Presentaciones"), _canal("community_g", "💬 General"), _canal("community_v", "Preséntate", "posts")]:
        db.add(c)
    await db.commit()
    p = (await db.execute(select(Community).where(Community.community_uuid == "community_p"))).scalars().first()
    ahora = str(datetime.now())
    db.add(Discussion(title="Hola, soy Ana", content="{}", community_id=p.id, org_id=1, author_id=1, discussion_uuid="discussion_a", creation_date=ahora, update_date=ahora))
    await db.commit()

    hechos = await pasar(db)
    assert hechos == {1: ["community_p"]}
    canales = {c.community_uuid: c.kind for c in (await db.execute(select(Community))).scalars().all()}
    assert canales == {"community_p": "posts", "community_g": "chat", "community_v": "posts"}
    # Los mensajes siguen ahí, sin tocar.
    assert (await db.execute(select(Discussion))).scalars().first().title == "Hola, soy Ana"
    oc = (await db.execute(select(OrganizationConfig))).scalars().first()
    assert oc.config["general"] == {"x": 1}
    assert oc.config["migraciones"]["presentaciones_posts"]["canales"] == ["community_p"]

    # Si alguien lo devuelve a chat, no se vuelve a cambiar solo.
    p = (await db.execute(select(Community).where(Community.community_uuid == "community_p"))).scalars().first()
    p.kind = "chat"
    db.add(p)
    await db.commit()
    assert await pasar(db) == {}
    p = (await db.execute(select(Community).where(Community.community_uuid == "community_p"))).scalars().first()
    assert p.kind == "chat"

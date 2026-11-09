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


async def test_subtitulo_de_recursos_una_vez(db, org):
    from src.services.communities.presentaciones_posts import SUBTITULO_RECURSOS, subtitulo_recursos

    db.add(OrganizationConfig(org_id=1, config={"portadas": {"recursos": {"titulo": "Recursos", "subtitulo": "Materiales de la escuela", "imagen": ""}}}))
    await db.commit()
    assert await subtitulo_recursos(db) == [1]
    oc = (await db.execute(select(OrganizationConfig))).scalars().first()
    assert oc.config["portadas"]["recursos"]["subtitulo"] == SUBTITULO_RECURSOS
    assert oc.config["portadas"]["recursos"]["titulo"] == "Recursos"
    # Si luego se cambia, no se vuelve a pisar.
    oc.config = {**oc.config, "portadas": {"recursos": {"titulo": "Recursos", "subtitulo": "Otra", "imagen": ""}}}
    db.add(oc)
    await db.commit()
    assert await subtitulo_recursos(db) == []


def test_juntar_contenido():
    import json

    from src.services.communities.juntar_posts import juntar_contenido

    a = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hoi!"}]}]})
    b = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ik ben Ana en ik woon in Utrecht."}]}], "attachments": [{"url": "/foto.jpg", "kind": "image"}]})
    d = json.loads(juntar_contenido(a, b, "Ik ben Ana"))
    assert [p["content"][0]["text"] for p in d["content"]] == ["Hoi!", "Ik ben Ana en ik woon in Utrecht."]
    assert d["attachments"] == [{"url": "/foto.jpg", "kind": "image"}]
    # Con el orden al revés, lo de abajo va primero: el orden lo elige el administrador.
    d2 = json.loads(juntar_contenido(b, a, "x"))
    assert d2["content"][0]["content"][0]["text"].startswith("Ik ben Ana")


async def test_juntar_dos_elegidas(db, org, monkeypatch):
    import json

    import pytest
    from fastapi import HTTPException

    import src.security.rbac as rbac
    from src.db.communities.discussion_comments import DiscussionComment
    from src.services.communities import juntar_posts as J

    async def si(*a, **k):
        return True

    monkeypatch.setattr(rbac, "authorization_verify_based_on_org_admin_status", si)
    db.add(_canal("community_p", "👋 Presentaciones", "posts"))
    await db.commit()
    p = (await db.execute(select(Community))).scalars().first()
    doc = lambda t, **x: json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": t}]}], **x})
    filas = [
        ("discussion_a", 1, "Hoi", doc("Hoi"), "2026-10-01 10:00:00"),
        ("discussion_b", 1, "Ik ben Ana", doc("Ik ben Ana"), "2026-10-01 10:01:00"),
        ("discussion_otro", 2, "Ik ben Piet", doc("Ik ben Piet"), "2026-10-01 10:00:30"),
        ("discussion_r", 2, "Welkom!", doc("Welkom!", threadParent="discussion_a"), "2026-10-01 11:00:00"),
    ]
    for uuid, autor, t, c, f in filas:
        db.add(Discussion(title=t, content=c, community_id=p.id, org_id=1, author_id=autor, discussion_uuid=uuid, creation_date=f, update_date=f))
    await db.commit()
    a = (await db.execute(select(Discussion).where(Discussion.discussion_uuid == "discussion_a"))).scalars().first()
    db.add(DiscussionComment(discussion_id=a.id, author_id=2, content="Leuk!", comment_uuid="c1", creation_date="x", update_date="x"))
    await db.commit()
    yo = type("U", (), {"id": 9})()

    # De dos personas distintas, no; la misma dos veces, tampoco; sin título, tampoco.
    with pytest.raises(HTTPException):
        await J.juntar(None, "discussion_a", "discussion_otro", "x y", yo, db)
    with pytest.raises(HTTPException):
        await J.juntar(None, "discussion_a", "discussion_a", "x y", yo, db)
    with pytest.raises(HTTPException):
        await J.juntar(None, "discussion_b", "discussion_a", " ", yo, db)

    # Arriba la de «Ik ben Ana» (la más nueva), debajo el «Hoi», con el título elegido.
    r = await J.juntar(None, "discussion_b", "discussion_a", "  Ik ben   Ana ", yo, db)
    assert r == {"discussion_uuid": "discussion_b", "title": "Ik ben Ana"}
    uuids = {d.discussion_uuid for d in (await db.execute(select(Discussion))).scalars().all()}
    assert uuids == {"discussion_b", "discussion_otro", "discussion_r"}
    b = (await db.execute(select(Discussion).where(Discussion.discussion_uuid == "discussion_b"))).scalars().first()
    textos = [x["content"][0]["text"] for x in json.loads(b.content)["content"]]
    assert textos == ["Ik ben Ana", "Hoi"]
    com = (await db.execute(select(DiscussionComment))).scalars().first()
    assert com.discussion_id == b.id
    resp = (await db.execute(select(Discussion).where(Discussion.discussion_uuid == "discussion_r"))).scalars().first()
    assert json.loads(resp.content)["threadParent"] == "discussion_b"

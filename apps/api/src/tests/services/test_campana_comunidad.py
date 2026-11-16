"""La campana y la comunidad, repaso del 16/11/2026.

- Los enlaces a un canal van sin el prefijo `community_` (la página lo pone).
- El punto rojo compara fechas como instantes, no como texto.
- «Ana ha comentado tu publicación».
- Contar lo nuevo en SQL da lo mismo que traer los mensajes.
- El equipo (profes incluidos) fija y borra en la comunidad; el closer, no.
"""

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from src.db.communities.discussions import Discussion
from src.db.user_organizations import UserOrganization
from src.services.communities import engagement as E


def _doc(texto: str) -> str:
    return json.dumps(
        {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}]}
    )


# ── Enlaces ─────────────────────────────────────────────────────────────


def test_ruta_canal_sin_prefijo():
    assert E.ruta_canal("community_abc") == "/community/abc"
    assert E.ruta_canal("abc") == "/community/abc"
    assert E.ruta_canal("community_abc", "discussion_x") == "/community/abc/discussion/x"


def test_el_recordatorio_lleva_al_canal_sin_prefijo():
    from src.services.panel.recordatorio import DE_FABRICA

    assert "/community/community_" not in DE_FABRICA["enlaces"]["victoria"]


# ── El punto rojo ───────────────────────────────────────────────────────


def test_un_mensaje_del_mismo_dia_enciende_el_punto():
    ahora = datetime.now()
    visto = (ahora - timedelta(minutes=5)).astimezone(timezone.utc).isoformat()  # «2026-…T…+00:00»
    mensaje = str(ahora)  # «2026-… 09:00:00.1», como se guardan los mensajes
    assert E.es_nuevo(mensaje, visto)
    assert not E.es_nuevo(str(ahora - timedelta(minutes=10)), visto)
    assert E.es_nuevo(mensaje, "")
    assert not E.es_nuevo("", visto)


def test_ordenar_fechas_de_formatos_distintos():
    ahora = datetime.now()
    fechas = [
        str(ahora - timedelta(hours=1)),
        (ahora - timedelta(minutes=1)).astimezone(timezone.utc).isoformat(),
        "",
    ]
    orden = sorted(fechas, key=E.instante, reverse=True)
    assert orden == [fechas[1], fechas[0], ""]


# ── Comentarios en tus publicaciones ────────────────────────────────────


def _c(autor, fecha, texto="Muy bien"):
    return SimpleNamespace(author_id=autor, creation_date=fecha, content=_doc(texto))


def test_avisos_de_comentarios():
    yo = 7
    canal = SimpleNamespace(community_uuid="community_c1", id=1)
    mio = SimpleNamespace(author_id=yo, discussion_uuid="discussion_p1", title="Mi presentación")
    ajeno = SimpleNamespace(author_id=9, discussion_uuid="discussion_p2", title="Otra")
    ana = SimpleNamespace(first_name="Ana", username="ana")
    luis = SimpleNamespace(first_name="Luis", username="luis")
    filas = [
        (_c(2, "2026-11-16 10:00:00", "¡Bienvenida!"), mio, canal, ana),
        (_c(3, "2026-11-16 09:00:00"), mio, canal, luis),
        (_c(2, "2026-11-16 08:00:00"), mio, canal, ana),
        (_c(yo, "2026-11-16 11:00:00"), mio, canal, SimpleNamespace(first_name="Yo")),  # lo mío no
        (_c(2, "2026-11-16 11:00:00"), ajeno, canal, ana),  # no es mía
    ]
    avisos = E.avisos_de_comentarios(filas, yo)
    assert len(avisos) == 1
    a = avisos[0]
    assert a["title"] == "Ana y Luis han comentado tu publicación «Mi presentación»"
    assert a["url"] == "/community/c1/discussion/p1"
    assert a["id"] == "comment:discussion_p1:2026-11-16 10:00:00"
    assert a["excerpt"] == "¡Bienvenida!"
    assert a["kind"] == "comment"

    solo = E.avisos_de_comentarios(filas[1:2], yo)[0]
    assert solo["title"].startswith("Luis ha comentado tu publicación")


async def test_comentarios_contra_la_base_de_datos(db):
    from src.db.communities.communities import Community
    from src.db.communities.discussion_comments import DiscussionComment
    from src.db.users import User

    db.add_all([
        User(id=7, username="yo", first_name="Marta", last_name="", email="m@x.com", user_uuid="u7", password="x"),
        User(id=8, username="ana", first_name="Ana", last_name="", email="a@x.com", user_uuid="u8", password="x"),
        Community(id=1, name="Presentaciones", org_id=1, community_uuid="community_c1", public=True, kind="posts"),
        Discussion(id=10, title="Hola", content="", community_id=1, org_id=1, author_id=7,
                   discussion_uuid="discussion_p1", creation_date="2026-11-15 10:00:00"),
        DiscussionComment(id=1, discussion_id=10, author_id=8, content=_doc("¡Hola!"),
                          comment_uuid="comment_1", creation_date="2026-11-16 10:00:00"),
    ])
    await db.commit()
    user = (await db.get(User, 7))
    avisos = await E._comment_items(user, [1], db)
    assert [a["title"] for a in avisos] == ["Ana ha comentado tu publicación «Hola»"]


# ── Contar en SQL da lo mismo ───────────────────────────────────────────


def _m(n, canal, autor, fecha, texto=""):
    return Discussion(
        title=f"m{n}", content=_doc(texto) if texto else "", community_id=canal, org_id=1, author_id=autor,
        discussion_uuid=f"discussion_{n}", creation_date=fecha, update_date=fecha,
    )


async def test_resumen_nuevos_da_lo_mismo(db):
    YO, OTRO, ALTA = 7, 8, "2026-11-01 00:00:00.000000"
    db.add_all([
        _m(1, 1, OTRO, "2026-11-04 10:00:00.000000"),
        _m(2, 1, OTRO, "2026-11-06 10:00:00.000000", "Hola @marta"),
        _m(3, 1, YO, "2026-11-07 10:00:00.000000", "@all lo mío"),
        _m(4, 2, OTRO, "2026-10-20 10:00:00.000000"),
        _m(5, 2, OTRO, "2026-11-02 10:00:00.000000", "@all clase hoy"),
        _m(6, 2, OTRO, "2026-11-03 10:00:00.000000", "lo último"),
        _m(7, 3, OTRO, "2026-11-02 10:00:00.000000"),
    ])
    await db.commit()
    canales = [SimpleNamespace(id=i) for i in (1, 2, 3, 4)]
    read_map = {1: "2026-11-05T00:00:00+00:00", 3: "2026-11-09T00:00:00+00:00"}
    marta = SimpleNamespace(username="marta", first_name="Marta", last_name="")

    antes = await E._nuevos_por_canal(YO, canales, read_map, ALTA, db)
    ahora = await E._resumen_nuevos(YO, canales, read_map, ALTA, db, user=marta, con_all=True)
    assert {c: r["n"] for c, r in ahora.items()} == {c: len(f) for c, f in antes.items()}
    for cid, filas in antes.items():
        ultimo = max(filas, key=lambda d: d.creation_date)
        assert ahora[cid]["ultima"] == ultimo.creation_date
        assert ahora[cid]["ultimo"][1] == ultimo.content
        assert ahora[cid]["menciones"] == sum(
            1 for d in filas if E.mentions_user(E.texto_para_menciones(d), marta)
        )
    assert ahora[1]["menciones"] == 1 and ahora[2]["menciones"] == 1
    # El equipo: el @all no le cuenta, su nombre sí.
    equipo = await E._resumen_nuevos(YO, canales, read_map, ALTA, db, user=marta, con_all=False)
    assert equipo[1]["menciones"] == 1 and equipo[2]["menciones"] == 0
    assert await E._resumen_nuevos(YO, [], read_map, ALTA, db) == {}


# ── Moderar: el equipo sí, el closer no ─────────────────────────────────


async def test_el_equipo_modera_y_el_closer_no(db):
    from src.services.communities.discussions import _modera

    db.add_all([
        UserOrganization(user_id=1, org_id=1, role_id=5, creation_date="", update_date=""),  # profe
        UserOrganization(user_id=2, org_id=1, role_id=6, creation_date="", update_date=""),  # closer
        UserOrganization(user_id=3, org_id=1, role_id=4, creation_date="", update_date=""),  # alumno
        UserOrganization(user_id=4, org_id=1, role_id=2, creation_date="", update_date=""),  # moderador
    ])
    await db.commit()
    assert await _modera(1, 1, db)
    assert not await _modera(2, 1, db)
    assert not await _modera(3, 1, db)
    assert await _modera(4, 1, db)
    assert not await _modera(1, 2, db)  # en otra escuela, no


# ── Una fuente que falla no tumba las demás ─────────────────────────────


async def test_si_una_fuente_falla_se_deshace_y_siguen_las_demas(db, monkeypatch):
    from src.db.users import User

    db.add_all([
        User(id=7, username="yo", first_name="Marta", last_name="", email="m@x.com", user_uuid="u7", password="x"),
        UserOrganization(user_id=7, org_id=1, role_id=4, creation_date="", update_date=""),
    ])
    await db.commit()

    async def rota(*a, **k):
        raise RuntimeError("SQL roto")

    async def bien(*a, **k):
        return [{"id": "x", "kind": "lectura", "title": "Lectura", "excerpt": "", "url": "/recursos",
                 "date": str(datetime.now())}]

    deshechas = []
    original = db.rollback

    async def contar():
        deshechas.append(1)
        await original()

    monkeypatch.setattr(E, "_mention_items", rota)
    monkeypatch.setattr(E, "_lectura_items", bien)
    monkeypatch.setattr(db, "rollback", contar)
    feed = await E.list_notifications(SimpleNamespace(id=7), db)
    assert deshechas, "tras el fallo hay que deshacer la transacción"
    assert "x" in [i.id for i in feed.items]
    assert next(i for i in feed.items if i.id == "x").is_new

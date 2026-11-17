"""La analítica de las webs (17/11/2026).

- Las visitas: una fila por sesión, sin bots ni otras webs, y el subdominio de
  Black Friday con sus páginas como /black-friday/….
- De dónde viene cada uno: anuncio (por el enlace o por la página del
  anuncio), red, web de origen, directo; Black Friday aunque llegue sin
  campaña.
- A quién se da el mérito con cada modelo.
- La cohorte: quien entró en las fechas, y si reservó, vino y pagó aunque
  fuera después; quien solo está en Calendly entra por su campaña de Calendly.
- Los filtros, Black Friday «entera» y el gasto repartido por días.
"""

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlmodel import select

from src.db.web_visita import WebVisita
from src.services.stats import analitica as A

S = "sesion-de-prueba-1"
AHORA = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)


def test_lo_que_no_vale_se_ignora():
    assert A.leer_visita({"s": S, "h": "www.holandesnawar.com", "r": "/"}, "Googlebot/2.1") is None
    assert A.leer_visita({"s": S, "h": "nawar-web.vercel.app", "r": "/"}) is None
    assert A.leer_visita({"s": "x", "h": "www.holandesnawar.com", "r": "/"}) is None
    v = A.leer_visita({"s": S, "h": "blackfriday.holandesnawar.com", "r": "/ebook/?x=1", "ref": "www.instagram.com", "w": 390})
    assert v["pagina"] == "/black-friday/ebook" and v["referrer"] == "instagram.com" and v["dispositivo"] == "movil"
    assert A.leer_visita({"s": S, "h": "blackfriday.holandesnawar.com", "r": "/"})["pagina"] == "/black-friday"
    # La web propia no cuenta como «de dónde venía».
    assert A.leer_visita({"s": S, "h": "www.holandesnawar.com", "r": "/blog/x", "ref": "www.holandesnawar.com"})["referrer"] == ""


@pytest.mark.asyncio
async def test_cada_pagina_suma_a_la_misma_sesion(db):
    base = {"s": S, "h": "www.holandesnawar.com", "w": 1400}
    assert await A.apuntar_visita({**base, "r": "/", "ref": "google.com"}, "Mozilla/5.0", db)
    assert await A.apuntar_visita({**base, "r": "/blog/hebben", "utm_source": "instagram", "utm_campaign": "x"}, "Mozilla/5.0", db)
    assert await A.apuntar_visita({**base, "r": "/"}, "Mozilla/5.0", db)
    filas = (await db.execute(select(WebVisita))).scalars().all()
    assert len(filas) == 1
    f = filas[0]
    assert f.entrada == "/" and json.loads(f.paginas) == ["/", "/blog/hebben"] and f.vistas == 3
    assert f.referrer == "google.com" and f.utm_source == "instagram" and f.dispositivo == "ordenador"
    assert not await A.apuntar_visita({**base, "r": "/"}, "HeadlessChrome", db)


def test_de_donde_viene():
    c = A.clasificar
    assert c({"utm_source": "facebook", "utm_medium": "paid", "utm_campaign": "vsl-matricula-oct26", "utm_content": "VIDEO%20%7C%20A"}) == {
        "canal": "ads", "fuente": "Meta · anuncios", "campana": "vsl-matricula-oct26", "anuncio": "VIDEO | A"}
    # La página del anuncio sin enlace: anuncio de Meta igual.
    assert c({"paginas": ["/formacion-nawar-fb"]})["canal"] == "ads"
    assert c({"recorrido": "bf-ebook-ads"})["fuente"] == "Meta · anuncios"
    assert c({"utm_source": "google", "utm_medium": "cpc"})["fuente"] == "Google · anuncios"
    assert c({"utm_source": "instagram", "utm_medium": "dm"})["fuente"] == "Instagram"
    assert c({"kind": "instagram"})["fuente"] == "Instagram"
    assert c({"utm_source": "systeme", "utm_campaign": "black-friday"}) == {"canal": "organico", "fuente": "Correo", "campana": "black-friday", "anuncio": ""}
    assert c({"referrer": "l.instagram.com"})["fuente"] == "Instagram"
    assert c({"referrer": "google.es"})["fuente"] == "Google"
    assert c({"referrer": "foro.ejemplo.com"})["fuente"] == "Otras webs"
    assert c({})["fuente"] == "Directo"
    # Black Friday sin campaña: por el subdominio, sus páginas o sus pasos.
    assert c({"host": "blackfriday.holandesnawar.com"})["campana"] == "black-friday"
    assert c({"kind": "bf-lista"})["campana"] == "black-friday"
    assert c({"recorrido": "home,bf-desbloquear"})["campana"] == "black-friday"
    assert c({"utm_campaign": "BlackFriday2026"})["campana"] == "black-friday"
    assert c({"utm_campaign": "{{campaign.name}}"})["campana"] == ""


def _ev(kind, when, **kw):
    return {"kind": kind, "when": when, **kw}


def test_a_quien_se_le_da_el_merito():
    toques = [
        _ev("guia-bases", "2026-10-01T10:00:00+00:00", utm_source="instagram", utm_medium="bio"),
        _ev("solicitud", "2026-10-05T10:00:00+00:00", utm_source="facebook", utm_medium="paid", utm_campaign="vsl"),
        _ev("correo-bf", "2026-10-06T10:00:00+00:00", utm_source="email"),  # lo manda la escuela
        _ev("bf-lista", "2026-11-03T10:00:00+00:00", utm_source="systeme", utm_campaign="black-friday"),
        _ev("reunion", "2026-11-04T10:00:00+00:00"),
        _ev("bf-lista", "2026-11-10T10:00:00+00:00", utm_source="web", utm_campaign="black-friday"),
    ]
    assert A.clasificar(A.toque_de(toques, "primera"))["fuente"] == "Instagram"
    assert A.clasificar(A.toque_de(toques, "ficha"))["fuente"] == "Meta · anuncios"
    ultima = A.clasificar(A.toque_de(toques, "ultima", "2026-11-04T10:00:00+00:00"))
    assert ultima["fuente"] == "Correo" and ultima["campana"] == "black-friday"
    # Sin nada que diga de dónde: el primer paso, «Directo».
    assert A.clasificar(A.toque_de([_ev("matricula", "2026-10-01T10:00:00+00:00")], "ficha"))["fuente"] == "Directo"


def _ficha(email, eventos, etapa="lead", pasos=None):
    return {"email": email, "nombre": email.split("@")[0], "eventos": eventos, "etapa": etapa, "pasos": pasos or []}


def _personas(fichas, citas=(), resultados=(), pagaron=(), importes=None, modelo="ficha", fuera=()):
    return A.personas_de(list(fichas), list(citas), list(resultados), set(pagaron), importes or {}, set(fuera), modelo, AHORA)


def test_la_cohorte_y_calendly():
    fichas = [
        _ficha("ana@x.com", [_ev("admision", "2026-11-02T09:00:00+00:00", utm_source="facebook", utm_medium="paid", utm_campaign="vsl", utm_content="A"),
                             _ev("reunion", "2026-11-02T09:30:00+00:00"), _ev("pago", "2026-11-05T10:00:00+00:00")], etapa="alumno"),
        _ficha("bea@x.com", [_ev("guia-bases", "2026-11-03T09:00:00+00:00", referrer="google.com")]),
        _ficha("cris@x.com", [_ev("bf-lista", "2026-11-04T09:00:00+00:00", utm_source="instagram", utm_medium="dm", utm_campaign="black-friday"),
                              _ev("reunion", "2026-11-04T09:30:00+00:00")]),
        _ficha("vieja@x.com", [_ev("guia-bases", "2026-09-01T09:00:00+00:00")]),
        _ficha("prueba@x.com", [_ev("guia-bases", "2026-11-03T09:00:00+00:00")]),
    ]
    citas = [
        {"id": "c1:ana@x.com", "email": "ana@x.com", "inicio": "2026-11-03T15:00:00+00:00", "reservada": "2026-11-02T09:30:00+00:00", "utm": {}},
        {"id": "c2:cris@x.com", "email": "cris@x.com", "inicio": "2026-11-06T15:00:00+00:00", "reservada": "2026-11-04T09:30:00+00:00", "utm": {}},
        # Reservó directo en Calendly con el enlace de un setter.
        {"id": "c3:dani@x.com", "email": "dani@x.com", "inicio": "2026-11-08T15:00:00+00:00", "reservada": "2026-11-07T09:00:00+00:00",
         "utm": {"utm_source": "instagram", "utm_medium": "dm", "utm_content": "setter-laura"}},
    ]
    resultados = [{"cita_id": "c2:cris@x.com", "email": "cris@x.com", "resultado": "no-vino"}]
    ps = {p["email"]: p for p in _personas(fichas, citas, resultados, pagaron={"ana@x.com"}, importes={"ana@x.com": 43500}, fuera={"prueba@x.com"})}
    assert "prueba@x.com" not in ps
    ana = ps["ana@x.com"]
    assert ana["canal"] == "ads" and ana["anuncio"] == "A" and ana["reservo"] and ana["vino"] and ana["pago"] and ana["cents"] == 43500
    assert ps["cris@x.com"]["no_vino"] and not ps["cris@x.com"]["vino"] and ps["cris@x.com"]["campana"] == "black-friday"
    dani = ps["dani@x.com"]
    assert dani["fuente"] == "Instagram" and dani["anuncio"] == "setter-laura" and dani["reservo"] and dani["dia"] == "2026-11-07"
    assert ps["bea@x.com"]["fuente"] == "Google" and not ps["bea@x.com"]["reservo"]

    visitas = A.visitas_de([
        SimpleNamespace(dia="2026-11-02", entrada="/formacion-nawar-fb", paginas='["/formacion-nawar-fb"]', vistas=2, dispositivo="movil",
                        utm_source="facebook", utm_medium="paid", utm_campaign="vsl", utm_content="A", referrer="", host="www.holandesnawar.com"),
        SimpleNamespace(dia="2026-11-03", entrada="/", paginas='["/", "/blog/x"]', vistas=3, dispositivo="ordenador",
                        utm_source="", utm_medium="", utm_campaign="", utm_content="", referrer="google.com", host="www.holandesnawar.com"),
        SimpleNamespace(dia="2026-11-04", entrada="/black-friday", paginas='["/black-friday"]', vistas=1, dispositivo="movil",
                        utm_source="", utm_medium="", utm_campaign="", utm_content="", referrer="instagram.com", host="blackfriday.holandesnawar.com"),
    ])
    todo = A.calcular(personas=list(ps.values()), visitas=visitas, desde="2026-11-01", hasta="2026-11-30", filtros={})
    r = todo["resumen"]
    assert (r["visitas"], r["leads"], r["reservaron"], r["vinieron"], r["no_vinieron"], r["pagaron"], r["cents"]) == (3, 4, 3, 1, 1, 1, 43500)
    canales = {c["valor"]: c for c in todo["por_canal"]}
    assert canales["ads"]["leads"] == 1 and canales["ads"]["pagaron"] == 1 and canales["organico"]["leads"] == 3
    assert canales["ads"]["visitas"] == 1 and canales["organico"]["visitas"] == 2
    assert {p["pagina"]: p["sesiones"] for p in todo["paginas"]}["/blog/x"] == 1
    assert todo["opciones"]["campanas"][0]["valor"] == "black-friday"

    bf = A.calcular(personas=list(ps.values()), visitas=visitas, desde="2026-11-01", hasta="2026-11-30", filtros={"campana": "black-friday"})
    assert bf["resumen"]["leads"] == 1 and bf["resumen"]["visitas"] == 1
    solo_ads = A.calcular(personas=list(ps.values()), visitas=visitas, desde="2026-11-01", hasta="2026-11-30", filtros={"canal": "ads"})
    assert [p["email"] for p in solo_ads["personas"]] == ["ana@x.com"]


def test_black_friday_entera_cuenta_a_quien_llego_antes_por_otro_sitio():
    fichas = [_ficha("eva@x.com", [_ev("guia-bases", "2026-11-01T09:00:00+00:00", utm_source="instagram", utm_medium="bio"),
                                  _ev("bf-lista", "2026-11-05T09:00:00+00:00")])]
    ps = _personas(fichas, modelo="primera")
    estricto = A.calcular(personas=ps, visitas=[], desde="2026-11-01", hasta="2026-11-30", filtros={"campana": "black-friday"})
    entera = A.calcular(personas=ps, visitas=[], desde="2026-11-01", hasta="2026-11-30", filtros={"campana": "black-friday", "bf_todo": True})
    assert estricto["resumen"]["leads"] == 0 and entera["resumen"]["leads"] == 1


def test_el_gasto_de_la_campana_se_reparte_por_dias():
    camp = {"gasto_cents": 3000, "inicio": "2026-11-01", "fin": "2026-11-30"}
    assert A._gasto_en(camp, "2026-11-01", "2026-11-10", "2026-11-30") == 1000
    assert A._gasto_en(camp, "2026-12-01", "2026-12-10", "2026-12-10") == 0
    assert A._gasto_en({"gasto_cents": 500}, "2026-11-01", "2026-11-02", "2026-11-02") == 500

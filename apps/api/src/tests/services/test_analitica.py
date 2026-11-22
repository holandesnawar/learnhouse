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


def _ficha(email, eventos, etapa="lead", pasos=None, telefono=""):
    return {"email": email, "nombre": email.split("@")[0], "eventos": eventos, "etapa": etapa, "pasos": pasos or [], "telefono": telefono}


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


# ── 22/11/2026: comparar con el periodo de antes, páginas, tiempos y «quién visita» ──


def test_el_pais_sale_de_la_zona_o_del_prefijo():
    assert A.pais_de("Europe/Amsterdam") == "Países Bajos"
    assert A.pais_de("Europe/Brussels") == "Bélgica"
    assert A.pais_de("Atlantic/Canary") == "España"
    assert A.pais_de("America/Argentina/Cordoba") == "Latinoamérica" and A.pais_de("America/Bogota") == "Latinoamérica"
    assert A.pais_de("America/Curacao") == "Caribe neerlandés"
    assert A.pais_de("America/New_York") == "Otros"
    # Una visita de antes del cambio no trae zona: no se inventa.
    assert A.pais_de("") == A.SIN_DATO
    assert A.pais_del_telefono("+31 6 1234 5678") == "Países Bajos"
    assert A.pais_del_telefono("0032470123456") == "Bélgica"
    assert A.pais_del_telefono("+1 809 555 1234") == "Latinoamérica"
    # Un 06… a secas no dice el país.
    assert A.pais_del_telefono("0612345678") == A.SIN_DATO and A.pais_del_telefono("") == A.SIN_DATO


def test_la_visita_trae_zona_si_vuelve_y_si_dejo_datos():
    base = {"s": S, "h": "www.holandesnawar.com", "r": "/"}
    v = A.leer_visita({**base, "z": "Europe/Amsterdam", "v": 1})
    assert v["zona"] == "Europe/Amsterdam" and v["vuelve"] and not v["datos"]
    # Una zona que no lo parece se tira (no se guarda texto libre).
    assert A.leer_visita({**base, "z": "<script>"})["zona"] == ""
    fila = SimpleNamespace(paginas="", vistas=0, entrada="", host="", referrer="", dispositivo="", utm_source="",
                           utm_medium="", utm_campaign="", zona="", vuelve=False, dejo_datos=False, updated_at="")
    A.aplicar_visita(fila, v, "t1")
    A.aplicar_visita(fila, A.leer_visita({**base, "r": "/blog/x", "z": "Europe/Madrid", "v": 0}), "t2")
    # La zona y «vuelve» son los de la primera página.
    assert (fila.vistas, fila.zona, fila.vuelve, fila.dejo_datos) == (2, "Europe/Amsterdam", True, False)
    # El aviso de «dejó sus datos» no es otra página vista.
    A.aplicar_visita(fila, A.leer_visita({**base, "r": "/blog/x", "e": "datos", "d": 1}), "t3")
    assert (fila.vistas, fila.dejo_datos, fila.updated_at) == (2, True, "t3")
    assert json.loads(fila.paginas) == ["/", "/blog/x"]


def _visita(dia, entrada="/", paginas=None, vistas=1, zona="", vuelve=False, datos=False, creada="", ultima="", **mas):
    campos = {"utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_content": "", "referrer": "",
              "host": "www.holandesnawar.com", "dispositivo": "movil"}
    campos.update(mas)
    return SimpleNamespace(dia=dia, entrada=entrada, paginas=json.dumps(paginas or [entrada]), vistas=vistas, zona=zona,
                           vuelve=vuelve, dejo_datos=datos, created_at=creada or f"{dia}T19:30:00+00:00",
                           updated_at=ultima or creada or f"{dia}T19:30:00+00:00", **campos)


def test_se_compara_con_el_periodo_de_antes():
    assert A.periodo_anterior("2026-11-11", "2026-11-20") == ("2026-11-01", "2026-11-10")
    fichas = [
        _ficha("ana@x.com", [_ev("admision", "2026-11-12T09:00:00+00:00", referrer="instagram.com")]),
        _ficha("bea@x.com", [_ev("admision", "2026-11-13T09:00:00+00:00", referrer="instagram.com")]),
        _ficha("cris@x.com", [_ev("admision", "2026-11-03T09:00:00+00:00", referrer="instagram.com")]),
    ]
    visitas = A.visitas_de([
        _visita("2026-11-12", referrer="instagram.com"), _visita("2026-11-13", referrer="instagram.com"),
        _visita("2026-11-14", referrer="google.com"), _visita("2026-11-04", referrer="instagram.com"),
    ])
    args = dict(personas=_personas(fichas), visitas=visitas, desde="2026-11-11", hasta="2026-11-20", filtros={})
    todo = A.calcular(**args, visitas_desde="2026-10-20")
    assert todo["resumen"]["leads"] == 2 and todo["resumen"]["visitas"] == 3
    antes = todo["anterior"]
    assert (antes["desde"], antes["hasta"]) == ("2026-11-01", "2026-11-10")
    assert antes["resumen"]["leads"] == 1 and antes["resumen"]["visitas"] == 1 and antes["visitas_comparables"]
    assert len(antes["serie"]) == len(todo["serie"]) == 10
    insta = next(f for f in todo["por_fuente"] if f["valor"] == "Instagram")
    assert (insta["visitas"], insta["visitas_antes"], insta["leads"], insta["leads_antes"]) == (2, 1, 2, 1)
    # Si antes aún no se contaban las visitas, no se comparan: 0 → 3 no es una subida.
    corto = A.calcular(**args, visitas_desde="2026-11-05")
    assert corto["anterior"]["resumen"]["visitas"] is None and not corto["anterior"]["visitas_comparables"]
    assert next(f for f in corto["por_fuente"] if f["valor"] == "Instagram")["visitas_antes"] is None
    # Y se puede apagar.
    assert A.calcular(**args, comparar=False)["anterior"] is None


def test_las_paginas_por_las_que_entran_y_por_las_que_se_van():
    vs = A.visitas_de([
        # Entra por el blog y se va sin más (de antes del cambio: no se sabe si dejó datos).
        _visita("2026-11-20", "/blog/de-het"),
        # Entra por el blog, pasa a la guía y deja sus datos.
        _visita("2026-11-22", "/blog/de-het", ["/blog/de-het", "/guia/bases-neerlandes"], 2, zona="Europe/Amsterdam", datos=True),
        _visita("2026-11-22", "/blog/de-het", zona="Europe/Brussels"),
        _visita("2026-11-22", "/", ["/", "/formacion"], 3, zona="Europe/Amsterdam"),
    ])
    p = A.paginas_de(vs)
    blog = next(e for e in p["entrada"] if e["pagina"] == "/blog/de-het")
    assert (blog["entraron"], blog["rebotes"], blog["pct_rebote"]) == (3, 2, 66.7)
    # «Dejan sus datos» va sobre las visitas medidas (las que traen zona): 1 de 2.
    assert (blog["medidas"], blog["datos"], blog["pct_datos"]) == (2, 1, 50.0)
    salidas = {x["pagina"]: x["salidas"] for x in p["salida"]}
    assert salidas == {"/blog/de-het": 2, "/guia/bases-neerlandes": 1, "/formacion": 1}
    assert [x["pagina"] for x in p["blog"]] == ["/blog/de-het"] and p["blog"][0]["sesiones"] == 3


def test_cuanto_tardan_de_un_paso_al_siguiente():
    fichas = [
        _ficha("ana@x.com", [_ev("admision", "2026-11-01T09:00:00+00:00"), _ev("reunion", "2026-11-03T09:00:00+00:00"),
                             _ev("pago", "2026-11-07T09:00:00+00:00")]),
        _ficha("bea@x.com", [_ev("admision", "2026-11-02T09:00:00+00:00"), _ev("reunion", "2026-11-02T21:00:00+00:00")]),
        _ficha("cris@x.com", [_ev("admision", "2026-11-02T09:00:00+00:00")]),
    ]
    t = A.tiempos_de(_personas(fichas, pagaron={"ana@x.com"}))
    assert t["lead_reserva"] == {"n": 2, "mediana_dias": 1.2, "media_dias": 1.2}
    assert t["reserva_pago"]["n"] == 1 and t["reserva_pago"]["mediana_dias"] == 4.0
    assert t["lead_pago"]["mediana_dias"] == 6.0


def test_quien_visita_pais_hora_y_si_vuelven():
    vs = A.visitas_de([
        # Domingo 22 nov a las 20:30 de Países Bajos, 4 minutos en la web.
        _visita("2026-11-22", "/", ["/", "/formacion"], 2, zona="Europe/Amsterdam", vuelve=True, datos=True,
                creada="2026-11-22T19:30:00+00:00", ultima="2026-11-22T19:34:00+00:00"),
        _visita("2026-11-22", zona="Europe/Brussels", creada="2026-11-22T19:40:00+00:00", dispositivo="ordenador"),
        # Una pestaña olvidada: cuenta media hora como mucho.
        _visita("2026-11-22", "/", ["/", "/blog/x"], 2, zona="America/Bogota",
                creada="2026-11-22T08:00:00+00:00", ultima="2026-11-22T15:00:00+00:00"),
        # De antes del cambio: sin país y fuera de «vuelven».
        _visita("2026-11-18", creada="2026-11-18T10:00:00+00:00"),
    ])
    assert [v["pais"] for v in vs] == ["Países Bajos", "Bélgica", "Latinoamérica", A.SIN_DATO]
    assert vs[0]["dia_semana"] == 6 and vs[0]["hora"] == 20 and vs[2]["segundos"] == 1800 and vs[3]["vuelve"] is None
    fichas = [_ficha("ana@x.com", [_ev("admision", "2026-11-22T09:00:00+00:00")], telefono="+31612345678")]
    q = A.quien_visita(vs, _personas(fichas))
    assert (q["sesiones"], q["medidas"], q["vuelven"], q["nuevos"], q["pct_vuelven"]) == (4, 3, 1, 2, 33.3)
    assert (q["movil"], q["ordenador"], q["pct_rebote"]) == (3, 1, 50.0)
    assert q["segundos"] == (240 + 1800) // 2
    assert [(p["pais"], p["visitas"]) for p in q["paises"]][0] == ("Países Bajos", 1) and len(q["paises"]) == 3
    assert q["calor"][6][10] == 2 and q["mejores"][0] == {"dia": 6, "franja": 10, "n": 2}
    assert q["paises_personas"] == [{"pais": "Países Bajos", "leads": 1, "reservaron": 0, "pagaron": 0, "cents": 0}]
    # El filtro por país vale para visitas y personas.
    todo = A.calcular(personas=_personas(fichas), visitas=vs, desde="2026-11-16", hasta="2026-11-22", filtros={"pais": "Bélgica"})
    assert todo["resumen"]["visitas"] == 1 and todo["resumen"]["leads"] == 0
    assert "Países Bajos" in todo["opciones"]["paises"]
    # «En la web ahora»: quien ha cargado una página en los últimos 5 minutos.
    assert A.en_la_web_ahora(vs, datetime(2026, 11, 22, 19, 42, tzinfo=timezone.utc)) == 1


def test_el_gasto_de_la_campana_llega_a_su_fuente():
    fichas = [_ficha("ana@x.com", [_ev("admision", "2026-11-12T09:00:00+00:00", utm_source="facebook", utm_medium="paid", utm_campaign="vsl"),
                                   _ev("pago", "2026-11-13T09:00:00+00:00")])]
    vs = A.visitas_de([_visita("2026-11-12", utm_source="facebook", utm_medium="paid", utm_campaign="vsl") for _ in range(4)])
    todo = A.calcular(
        personas=_personas(fichas, pagaron={"ana@x.com"}, importes={"ana@x.com": 59700}), visitas=vs,
        desde="2026-11-11", hasta="2026-11-20", filtros={},
        campanas_apuntadas=[{"nombre": "VSL", "utm_campaign": "vsl", "inicio": "2026-11-11", "fin": "2026-11-20", "gasto_cents": 20000}],
    )
    meta = next(f for f in todo["por_fuente"] if f["valor"] == "Meta · anuncios")
    assert (meta["gasto_cents"], meta["retorno"], meta["cents_por_visita"], meta["coste_lead_cents"]) == (20000, 2.98, 14925, 20000)
    assert todo["resumen"]["cents_por_visita"] == 14925 and todo["resumen"]["ventas_por_100_visitas"] == 25.0

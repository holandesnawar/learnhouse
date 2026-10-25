"""Los KPIs de ventas (20/10/2026): entradas, embudo de ventas, llamadas
(asistencia, no-show, cierre), reservas y ventas, con un caso inventado
completo. Quien está fuera de los números no cuenta en nada."""

from datetime import datetime, timezone
from types import SimpleNamespace

from src.services.contactos.contactos import _evento, fusionar_contactos
from src.services.stats.kpis import calcular, cuando_entro, dia_nl, para_el_closer

AHORA = datetime(2026, 10, 20, 20, 0, tzinfo=timezone.utc)


def _cita(email, inicio, reservada, estado="activa", cid=None):
    return {"id": cid or f"ev-{email}-{inicio[:10]}:{email}", "email": email, "inicio": inicio,
            "reservada": reservada, "estado": estado}


def _datos():
    ev = [
        _evento("admision", "2026-10-15T10:00:00+00:00", "ana@x.com", extra={"embudo": "admision", "video": "visto"}),
        _evento("cualificacion", "2026-10-15T10:10:00+00:00", "ana@x.com", extra={"apto": True}),
        _evento("reunion", "2026-10-15T10:12:00+00:00", "ana@x.com"),
        _evento("pago", "2026-10-17T09:00:00+00:00", "ana@x.com"),
        _evento("admision", "2026-10-16T08:00:00+00:00", "ben@x.com", extra={"embudo": "admision"}),
        _evento("solicitud", "2026-10-18T12:00:00+00:00", "carla@x.com", utm_medium="paid", utm_source="facebook"),
        _evento("cualificacion", "2026-10-18T13:00:00+00:00", "dani@x.com", extra={"apto": True}),
        _evento("admision", "2026-10-20T09:00:00+00:00", "eva@x.com", extra={"embudo": "admision"}, utm_medium="paid"),
        _evento("admision", "2026-10-18T09:00:00+00:00", "prueba@x.com", extra={"embudo": "admision"}),
        _evento("matricula", "2026-10-01T09:00:00+00:00", "old@x.com"),
    ]
    fichas = fusionar_contactos(ev, set())
    citas = [
        _cita("ana@x.com", "2026-10-16T16:00:00Z", "2026-10-15T10:12:00Z"),
        _cita("ben@x.com", "2026-10-17T16:00:00Z", "2026-10-16T08:30:00Z", estado="cancelada"),
        _cita("carla@x.com", "2026-10-19T16:00:00Z", "2026-10-18T12:30:00Z"),
        _cita("dani@x.com", "2026-10-19T17:00:00Z", "2026-10-18T13:05:00Z"),
        _cita("eva@x.com", "2026-10-21T16:00:00Z", "2026-10-20T09:30:00Z"),
        _cita("old@x.com", "2026-10-14T16:00:00Z", "2026-10-10T09:00:00Z"),
        _cita("prueba@x.com", "2026-10-19T10:00:00Z", "2026-10-18T09:10:00Z"),
    ]
    resultados = [
        {"cita_id": citas[0]["id"], "email": "ana@x.com", "resultado": "compra", "inicio": citas[0]["inicio"]},
        {"cita_id": citas[3]["id"], "email": "dani@x.com", "resultado": "no-vino", "inicio": citas[3]["inicio"]},
        {"cita_id": citas[5]["id"], "email": "old@x.com", "resultado": "piensa", "inicio": citas[5]["inicio"]},
        {"cita_id": citas[6]["id"], "email": "prueba@x.com", "resultado": "pagado", "inicio": citas[6]["inicio"]},
    ]
    ventas = [
        {"email": "ana@x.com", "paid_at": "2026-10-17T09:00:00", "amount_cents": 43500, "recorrido": ""},
        {"email": "prueba@x.com", "paid_at": "2026-10-19T09:00:00", "amount_cents": 100, "recorrido": ""},
    ]
    visitas = [
        SimpleNamespace(embudo="anuncio", canal="ads", dia="2026-10-19", visita=True, datos=True, video_pct=100,
                        formulario=True, preguntas=False, reserva=False),
        SimpleNamespace(embudo="anuncio", canal="ads", dia="2026-10-19", visita=True, datos=False, video_pct=0,
                        formulario=False, preguntas=False, reserva=False),
    ]
    return calcular(
        fichas=fichas, citas=citas, resultados=resultados, pagaron={"ana@x.com", "prueba@x.com"},
        fuera={"prueba@x.com"}, visitas=visitas, ventas=ventas, plazos_emails=set(),
        desde="2026-10-14", hasta="2026-10-20", ahora=AHORA,
    )


def test_entradas_y_ventas():
    k = _datos()
    assert k["dias"] == 7
    assert k["entradas"] == {"n": 5, "ads": 2, "organico": 3, "por_dia": round(5 / 7, 1)}
    assert k["ventas"]["n"] == 1 and k["ventas"]["cobrado_cents"] == 43500 and k["ventas"]["con_llamada"] == 1
    assert k["ventas"]["tipos"] == {"unico": 1, "plazos": 0, "otro": 0}


def test_llamadas_asistencia_no_show_y_cierre():
    ll = _datos()["llamadas"]
    # ana (va a pagar), carla (sin apuntar), dani (no vino), old (lo piensa); la
    # de ben, cancelada; la de eva es de mañana (fuera del periodo); la de
    # prueba, fuera de los números.
    assert ll["agendadas"] == 4 and ll["canceladas"] == 1
    assert ll["presentadas"] == 2 and ll["no_vino"] == 1 and ll["sin_apuntar"] == 1 and ll["futuras"] == 0
    assert ll["pct_asistencia"] == 66.7 and ll["pct_no_show"] == 33.3
    assert ll["personas_presentadas"] == 2 and ll["personas_cerradas"] == 1 and ll["pct_cierre"] == 50.0
    assert ll["van_a_pagar_sin_pagar"] == 0


def test_embudo_de_ventas_es_una_cohorte():
    pasos = {p["clave"]: p for p in _datos()["embudo_ventas"]["pasos"]}
    assert pasos["entran"]["n"] == 5
    assert pasos["admision"]["n"] == 3 and pasos["video"]["n"] == 1 and pasos["video"]["pct"] == 33.3
    assert pasos["preguntas"]["n"] == 2 and pasos["encajan"]["n"] == 2
    assert pasos["reservan"]["n"] == 4 and pasos["presentan"]["n"] == 1 and pasos["pagan"]["n"] == 1


def test_por_dia_reservas_y_visitas():
    k = _datos()
    dia = {d["dia"]: d for d in k["serie"]}
    assert dia["2026-10-19"]["llamadas"] == 2 and dia["2026-10-19"]["no_vino"] == 1
    assert dia["2026-10-19"]["visitas"] == 2 and dia["2026-10-19"]["datos"] == 1
    assert dia["2026-10-17"]["ventas"] == 1
    # Reservas por el día en que se reservaron (la de ben cuenta aunque luego
    # la cancelara; la de prueba no).
    assert k["reservas"]["n"] == 5
    assert dia["2026-10-18"]["reservas"] == 2 and dia["2026-10-15"]["reservas"] == 1
    web = {p["clave"]: p for p in k["embudo_web"]["anuncio"]["canales"]["ads"]}
    assert web["visita"]["n"] == 2 and web["datos"]["n"] == 1 and web["datos"]["pct_anterior"] == 50.0


def test_cuando_entro_y_el_dia_en_hora_de_paises_bajos():
    assert dia_nl("2026-10-19T23:30:00Z") == "2026-10-20"  # medianoche y media en NL
    assert cuando_entro({"matricula_at": "", "eventos": [{"kind": "guia-bases", "when": "2026-10-01T00:00:00Z"}]}) == ""
    assert cuando_entro({"matricula_at": "2026-10-10T00:00:00Z", "eventos": [{"kind": "enlace-pago", "when": "2026-10-05T00:00:00Z"}]}) == "2026-10-05T00:00:00Z"


def test_el_closer_ve_los_kpis_sin_el_dinero():
    k = _datos()
    assert k["ventas"]["cobrado_cents"] > 0
    c = para_el_closer(k)
    # De las ventas, solo cuántas: ni lo cobrado, ni el ticket, ni el reparto.
    assert c["ventas"] == {"n": k["ventas"]["n"]} and c["para_closer"] is True
    # Lo demás, igual.
    assert c["llamadas"] == k["llamadas"] and c["serie"] == k["serie"] and c["embudo_ventas"] == k["embudo_ventas"]
    # No toca los datos del administrador.
    assert "cobrado_cents" in k["ventas"] and "para_closer" not in k

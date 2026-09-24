"""La fusión de contactos es una función pura: aquí se prueba sin base de datos."""

from src.services.contactos.contactos import _evento, fusionar_contactos


def _ev(kind, when, email, **c):
    return _evento(kind, when, email, **c)


def test_una_persona_con_varias_cosas_sale_una_vez_con_su_historial_en_orden():
    eventos = [
        _ev("matricula", "2026-09-20T10:00:00", "ana@x.com", first_name="Ana", recorrido="home,landing"),
        _ev("guia-bases", "2026-09-01T10:00:00+00:00", "ana@x.com", first_name="Ana", utm_campaign="bases-sept"),
        _ev("solicitud", "2026-09-10T10:00:00", "ana@x.com", phone="+31 6 1234"),
    ]
    fichas = fusionar_contactos(eventos, set())
    assert len(fichas) == 1
    f = fichas[0]
    assert [e["kind"] for e in f["eventos"]] == ["guia-bases", "solicitud", "matricula"]
    assert f["primer_contacto"]["kind"] == "guia-bases"
    assert f["ultimo_contacto"]["kind"] == "matricula"
    assert f["nombre"] == "Ana"
    assert f["telefono"] == "+31 6 1234"
    # La campaña se conserva aunque la matrícula viniera sin utm.
    assert f["utm_campaign"] == "bases-sept"


def test_el_estado_sale_de_lo_mas_lejos_que_llego():
    lead = fusionar_contactos([_ev("guia-bases", "2026-09-01", "a@x.com")], set())[0]
    sin_pagar = fusionar_contactos([_ev("matricula", "2026-09-01", "b@x.com")], set())[0]
    pago = fusionar_contactos([_ev("pago", "2026-09-01", "c@x.com")], set())[0]
    con_cuenta = fusionar_contactos([_ev("guia-bases", "2026-09-01", "d@x.com")], {"d@x.com"})[0]
    assert lead["estado"] == "lead"
    assert sin_pagar["estado"] == "matriculado-sin-pagar"
    assert pago["estado"] == "alumno"
    assert con_cuenta["estado"] == "alumno"


def test_vio_el_precio_si_paso_por_la_landing_con_precio_o_llego_al_pago():
    no = fusionar_contactos([_ev("guia-bases", "2026-09-01", "a@x.com", recorrido="home,landing")], set())[0]
    si_landing = fusionar_contactos([_ev("solicitud", "2026-09-01", "b@x.com", recorrido="landing-precio")], set())[0]
    si_pago = fusionar_contactos([_ev("matricula", "2026-09-01", "c@x.com")], set())[0]
    assert no["vio_precio"] is False
    assert si_landing["vio_precio"] is True
    assert si_pago["vio_precio"] is True


def test_la_lista_va_del_mas_reciente_al_mas_antiguo_y_una_fecha_rota_no_revienta():
    eventos = [
        _ev("guia-bases", "2026-09-01T10:00:00", "vieja@x.com"),
        _ev("guia-bases", "no es una fecha", "rota@x.com"),
        _ev("guia-bases", "2026-09-21T10:00:00", "nueva@x.com"),
    ]
    fichas = fusionar_contactos(eventos, set())
    assert [f["email"] for f in fichas] == ["nueva@x.com", "vieja@x.com", "rota@x.com"]


def test_las_etiquetas_se_juntan_sin_repetir():
    eventos = [
        _ev("guia-bases", "2026-09-01", "a@x.com", tag="Guía Bases"),
        _ev("instagram", "2026-09-02", "a@x.com", tag="Lista de espera"),
        _ev("guia-bases", "2026-09-03", "a@x.com", tag="Guía Bases"),
    ]
    assert fusionar_contactos(eventos, set())[0]["etiquetas"] == ["Guía Bases", "Lista de espera"]


def test_una_sola_etapa_por_persona_la_mas_avanzada():
    def etapa(eventos, cuentas=()):
        return fusionar_contactos(eventos, set(cuentas))[0]["etapa"]

    assert etapa([_ev("guia-bases", "2026-09-01", "a@x.com")]) == "lead"
    assert etapa([_ev("guia-bases", "2026-09-01", "a@x.com"), _ev("solicitud", "2026-09-02", "a@x.com")]) == "pidio"
    assert etapa([_ev("agendar-empezado", "2026-09-02", "a@x.com")]) == "pidio"
    assert etapa([_ev("solicitud", "2026-09-02", "a@x.com"), _ev("matricula", "2026-09-03", "a@x.com")]) == "en-pago"
    assert etapa([_ev("matricula", "2026-09-03", "a@x.com"), _ev("pago", "2026-09-03", "a@x.com")]) == "alumno"
    assert etapa([_ev("guia-bases", "2026-09-01", "a@x.com")], ["a@x.com"]) == "alumno"


def test_la_fecha_de_matricula_es_la_primera_solicitud_o_matricula():
    f = fusionar_contactos(
        [
            _ev("guia-bases", "2026-09-01T10:00:00", "a@x.com"),
            _ev("matricula", "2026-09-12T10:00:00", "a@x.com"),
            _ev("solicitud", "2026-09-05T10:00:00", "a@x.com"),
        ],
        set(),
    )[0]
    assert f["matricula_at"] == "2026-09-05T10:00:00"
    solo_guia = fusionar_contactos([_ev("guia-bases", "2026-09-01", "b@x.com")], set())[0]
    assert solo_guia["matricula_at"] == ""

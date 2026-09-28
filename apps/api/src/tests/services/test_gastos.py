"""Gastos contra ventas: la cuenta es pura y se prueba sin base de datos."""

from src.services.stats.gastos import resumen_gastos


def test_margen_y_coste_por_matricula_por_mes():
    ventas = [("2026-09-10T10:00:00+00:00", 39700), ("2026-09-12T10:00:00", 39700), ("2026-10-01", 19700)]
    gastos = [
        ("2026-09-01", "publicidad", 20000),
        ("2026-09-15", "profes", 30000),
        ("2026-10-03", "herramientas", 5000),
    ]
    r = resumen_gastos(ventas, gastos, alumnos=10)
    sept = next(m for m in r["meses"] if m["mes"] == "2026-09")
    assert sept["ventas"] == 2
    assert sept["ingresos_cents"] == 79400
    assert sept["gastos_cents"] == 50000
    assert sept["margen_cents"] == 29400
    # Solo la publicidad entre las ventas: lo que cuesta traer a alguien.
    assert sept["coste_por_matricula_cents"] == 10000
    # Todo el gasto del mes entre los alumnos.
    assert sept["coste_por_alumno_cents"] == 5000
    # El mes más reciente, primero.
    assert r["meses"][0]["mes"] == "2026-10"
    assert r["total"]["ingresos_cents"] == 99100
    assert r["total"]["gastos_cents"] == 55000
    assert r["total"]["por_categoria"]["profes"] == 30000


def test_sin_ventas_ni_publicidad_no_se_inventa_coste():
    r = resumen_gastos([], [("2026-09-01", "profes", 1000)], alumnos=0)
    m = r["meses"][0]
    assert m["coste_por_matricula_cents"] is None
    assert m["coste_por_alumno_cents"] is None
    assert r["total"]["margen_pct"] is None


def test_categoria_desconocida_va_a_otros():
    r = resumen_gastos([], [("2026-09-01", "cafe", 500)], alumnos=1)
    assert r["meses"][0]["por_categoria"]["otros"] == 500


# ── Gastos fijos mensuales ──────────────────────────────────────────────────
from src.services.stats.gastos import expandir_fijos, fijo_activo  # noqa: E402


def test_un_fijo_cuenta_cada_mes_hasta_hoy():
    filas = expandir_fijos([{"desde": "2026-07", "hasta": "", "categoria": "herramientas", "importe_cents": 2000}], "2026-09")
    assert filas == [
        ("2026-07-01", "herramientas", 2000),
        ("2026-08-01", "herramientas", 2000),
        ("2026-09-01", "herramientas", 2000),
    ]


def test_dado_de_baja_deja_de_contar():
    filas = expandir_fijos([{"desde": "2026-07", "hasta": "2026-08", "categoria": "profes", "importe_cents": 500}], "2026-12")
    assert [f[0] for f in filas] == ["2026-07-01", "2026-08-01"]


def test_cruza_el_cambio_de_anno():
    filas = expandir_fijos([{"desde": "2026-11", "hasta": "", "categoria": "otros", "importe_cents": 1}], "2027-02")
    assert [f[0] for f in filas] == ["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]


def test_un_fijo_que_empieza_en_el_futuro_no_cuenta_aun():
    assert expandir_fijos([{"desde": "2027-01", "categoria": "otros", "importe_cents": 1}], "2026-09") == []
    assert not fijo_activo({"desde": "2027-01", "hasta": ""}, "2026-09")
    assert fijo_activo({"desde": "2026-01", "hasta": ""}, "2026-09")
    assert not fijo_activo({"desde": "2026-01", "hasta": "2026-08"}, "2026-09")


def test_los_fijos_suman_en_el_resumen():
    from src.services.stats.gastos import resumen_gastos

    r = resumen_gastos([("2026-09-10", 39700)], expandir_fijos([{"desde": "2026-09", "categoria": "herramientas", "importe_cents": 5000}], "2026-09"), 1)
    assert r["total"]["gastos_cents"] == 5000
    assert r["total"]["margen_cents"] == 34700


# ── Facturas de la empresa ──────────────────────────────────────────────────
from src.services.stats.gastos import extension_valida, ruta_segura  # noqa: E402


def test_solo_pdf_o_foto():
    assert extension_valida("factura.PDF") == ".pdf"
    assert extension_valida("ticket.jpeg") == ".jpeg"
    assert extension_valida("virus.exe") == ""
    assert extension_valida("sin_extension") == ""


def test_la_ruta_de_una_factura_no_se_sale_de_privado():
    assert ruta_segura("privado/facturas/1/abc.pdf") is not None
    assert ruta_segura("privado/../orgs/logo.png") is None
    assert ruta_segura("orgs/x/logo.png") is None
    assert ruta_segura("/etc/passwd") is None
    assert ruta_segura("") is None


def test_content_nunca_sirve_privado():
    import asyncio

    import pytest
    from fastapi import HTTPException

    from src.db.users import AnonymousUser
    from src.routers.local_content import _check_content_access

    with pytest.raises(HTTPException) as e:
        asyncio.run(_check_content_access("privado/facturas/1/abc.pdf", AnonymousUser(), None))
    assert e.value.status_code == 403

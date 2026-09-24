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

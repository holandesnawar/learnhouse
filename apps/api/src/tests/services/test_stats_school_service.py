from datetime import date

from src.services.stats.school import _margin_block, _retention


class TestRetention:
    """La retención cuenta desde el alta de cada alumno, no por calendario."""

    def test_counts_each_week_from_the_student_own_start(self):
        today = date(2026, 10, 1)
        joined = {1: "2026-09-01", 2: "2026-09-01"}
        visits = {
            # El alumno 1 entra en su semana 0, 1 y 3 (se salta la 2).
            1: {"2026-09-02", "2026-09-10", "2026-09-24"},
            # El alumno 2 solo la primera semana.
            2: {"2026-09-01"},
        }
        out = _retention(joined, visits, today, "2026-09-01")
        # Semana 0: los dos · semana 1: solo el 1 · semana 2: ninguno
        assert out["weeks"][0] == 100.0
        assert out["weeks"][1] == 50.0
        assert out["weeks"][2] == 0.0
        assert out["weeks"][3] == 50.0

    def test_a_week_that_has_not_finished_does_not_count_as_churn(self):
        # Alta hoy: su semana 0 sigue en curso, así que no puede contar como
        # "no volvió" ni hundir el porcentaje.
        today = date(2026, 9, 3)
        out = _retention({1: "2026-09-03"}, {1: set()}, today, "2026-09-01")
        assert out["weeks"][0] is None
        assert out["cohorts"][0]["size"] == 1

    def test_an_unfinished_week_does_count_when_the_student_was_active(self):
        today = date(2026, 9, 3)
        out = _retention({1: "2026-09-03"}, {1: {"2026-09-03"}}, today, "2026-09-01")
        assert out["weeks"][0] == 100.0

    def test_weeks_in_the_future_are_left_empty(self):
        today = date(2026, 9, 3)
        out = _retention({1: "2026-09-01"}, {1: {"2026-09-01"}}, today, "2026-09-01")
        assert out["weeks"][2] is None
        assert out["weeks"][5] is None

    def test_groups_by_month_of_signup(self):
        today = date(2026, 11, 1)
        joined = {1: "2026-09-05", 2: "2026-10-05"}
        visits = {1: {"2026-09-06"}, 2: {"2026-10-06"}}
        out = _retention(joined, visits, today, "2026-09-06")
        keys = [c["key"] for c in out["cohorts"]]
        assert keys == ["2026-10", "2026-09"]  # la más reciente primero
        assert all(c["size"] == 1 for c in out["cohorts"])

    def test_survives_students_without_a_usable_signup_date(self):
        today = date(2026, 10, 1)
        out = _retention({1: "", 2: "no es una fecha"}, {}, today, "2026-09-01")
        assert out["cohorts"] == []
        assert out["weeks"] == [None] * 6

    def test_without_history_nothing_is_zero_percent(self):
        """El caso real: la tabla de visitas se acaba de crear y los alumnos
        son de hace meses. Sin historial NO se sabe si volvieron, y decir 0%
        sería mentir: todas las semanas salen vacías."""
        today = date(2026, 10, 1)
        out = _retention({1: "2026-06-01", 2: "2026-07-01"}, {}, today, None)
        assert out["weeks"] == [None] * 6
        for cohort in out["cohorts"]:
            assert cohort["weeks"] == [None] * 6
        # Pero las cohortes siguen ahí, con su mes y cuánta gente entró.
        assert sorted(c["key"] for c in out["cohorts"]) == ["2026-06", "2026-07"]
        assert all(c["size"] == 1 for c in out["cohorts"])

    def test_weeks_before_the_history_started_are_unknown(self):
        """Alumno de junio, historial desde septiembre: sus primeras semanas
        no se saben, pero las que caen dentro del historial sí."""
        today = date(2026, 10, 15)
        joined = {1: "2026-06-01"}
        visits = {1: {"2026-09-08"}}
        out = _retention(joined, visits, today, "2026-09-01")
        # Semanas 0-5 del alumno son de junio y julio: fuera del historial.
        assert out["weeks"] == [None] * 6

    def test_reports_since_when_there_is_history(self):
        out = _retention({1: "2026-09-01"}, {1: {"2026-09-01"}}, date(2026, 10, 1), "2026-09-01")
        assert out["tracking_since"] == "2026-09-01"


def month(key: str, revenue: int, sales: int, ticket: int) -> dict:
    return {"key": key, "revenue_cents": revenue, "sales": sales, "avg_ticket_cents": ticket}


class TestMargin:
    def test_subtracts_both_buckets_and_splits_per_student(self):
        sales = {"by_month": [month("2026-09", 397000, 10, 39700)]}
        manual = {
            "costs": [{"period": "2026-09", "cost_cents": 20000}],       # captar
            "delivery": [{"period": "2026-09", "cost_cents": 100000}],   # profes
        }
        row = _margin_block(sales, manual)[0]
        assert row["margin_cents"] == 397000 - 120000
        assert row["margin_per_student_cents"] == round(277000 / 10)
        # 1.200 € de gasto (200 de captar + 1.000 de profes) con ticket de
        # 397 € → 3,02 ventas, o sea 4 para cubrirlo.
        assert row["breakeven_sales"] == 4

    def test_breakeven_rounds_up_because_you_cannot_sell_half_a_place(self):
        sales = {"by_month": [month("2026-09", 397000, 10, 39700)]}
        manual = {"costs": [], "delivery": [{"period": "2026-09", "cost_cents": 100000}]}
        row = _margin_block(sales, manual)[0]
        # 1000 € de profes / 397 € = 2,5 → hacen falta 3 ventas.
        assert row["breakeven_sales"] == 3

    def test_a_month_with_costs_and_no_sales_still_shows_up(self):
        sales = {"by_month": []}
        manual = {"costs": [{"period": "2026-08", "cost_cents": 5000}], "delivery": []}
        row = _margin_block(sales, manual)[0]
        assert row["revenue_cents"] == 0
        assert row["margin_cents"] == -5000
        # Sin ventas no hay margen por alumno ni ticket con el que calcular.
        assert row["margin_per_student_cents"] is None
        assert row["breakeven_sales"] is None

    def test_without_data_returns_nothing(self):
        assert _margin_block(None, None) == []
        assert _margin_block({"by_month": []}, {"costs": [], "delivery": []}) == []

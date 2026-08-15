from src.services.stats.periods import (
    group_sales,
    month_key,
    month_label,
    pct,
    quarter_key,
    quarter_label,
    undated_sales,
)


class TestKeys:
    def test_month_key_reads_the_start_of_an_iso_date(self):
        assert month_key("2026-09-17T10:00:00+00:00") == "2026-09"
        assert month_key("2026-01-02") == "2026-01"

    def test_month_key_rejects_junk(self):
        assert month_key("") is None
        assert month_key("mañana") is None
        assert month_key("2026/09/17") is None
        assert month_key("2026-13-01") is None
        assert month_key(None) is None  # type: ignore[arg-type]

    def test_quarter_key_puts_each_month_in_its_quarter(self):
        assert quarter_key("2026-01-15") == "2026-T1"
        assert quarter_key("2026-03-31") == "2026-T1"
        assert quarter_key("2026-04-01") == "2026-T2"
        assert quarter_key("2026-09-17") == "2026-T3"
        assert quarter_key("2026-12-31") == "2026-T4"

    def test_labels_are_in_spanish(self):
        assert month_label("2026-09") == "septiembre 2026"
        assert quarter_label("2026-T3") == "T3 2026 (jul-sep)"
        # Una clave rara no revienta la tabla: se enseña tal cual.
        assert month_label("cualquiera") == "cualquiera"


def sale(date: str, cents: int, product: str = "formacion-a0-a1") -> dict:
    return {"date": date, "amount_cents": cents, "product": product}


class TestGroupSales:
    def test_groups_by_month_newest_first(self):
        rows = group_sales(
            [
                sale("2026-09-01", 39700),
                sale("2026-09-20", 39700),
                sale("2026-10-02", 49700),
            ]
        )
        assert [r["key"] for r in rows] == ["2026-10", "2026-09"]
        assert rows[1]["sales"] == 2
        assert rows[1]["revenue_cents"] == 79400
        assert rows[1]["avg_ticket_cents"] == 39700

    def test_groups_by_quarter(self):
        rows = group_sales(
            [sale("2026-09-01", 39700), sale("2026-07-15", 39700), sale("2026-10-02", 49700)],
            granularity="quarter",
        )
        assert [r["key"] for r in rows] == ["2026-T4", "2026-T3"]
        assert rows[1]["sales"] == 2

    def test_splits_by_product_so_the_next_course_fits(self):
        rows = group_sales(
            [
                sale("2026-09-01", 39700, "formacion-a0-a1"),
                sale("2026-09-02", 99700, "vip-a0-a1"),
                sale("2026-09-03", 39700, "formacion-a0-a1"),
            ]
        )
        productos = rows[0]["by_product"]
        assert productos["formacion-a0-a1"] == {"sales": 2, "revenue_cents": 79400}
        assert productos["vip-a0-a1"] == {"sales": 1, "revenue_cents": 99700}

    def test_sales_without_a_usable_date_are_left_out_and_counted(self):
        ventas = [sale("2026-09-01", 39700), sale("", 39700), sale("nunca", 100)]
        rows = group_sales(ventas)
        assert len(rows) == 1
        assert rows[0]["sales"] == 1
        assert undated_sales(ventas) == 2

    def test_no_sales_no_rows(self):
        assert group_sales([]) == []

    def test_average_ticket_does_not_divide_by_zero(self):
        rows = group_sales([sale("2026-09-01", 0)])
        assert rows[0]["avg_ticket_cents"] == 0


class TestPct:
    def test_rounds_to_one_decimal(self):
        assert pct(1, 3) == 33.3
        assert pct(40, 40) == 100.0

    def test_zero_universe_is_zero_not_infinity(self):
        assert pct(0, 0) == 0.0
        assert pct(5, 0) == 0.0

import polars as pl
import pytest

from season_sources import fetch_optional, nextgen_season

NGS_KEYS = [
    "timeToThrow", "aggressiveness", "airYardsToSticks",
    "separation", "cushion", "yacOverExpected", "catchRate",
    "ryoePerAtt", "runsOverExpectedPct", "eightBoxPct", "timeToLos",
]


def passing_frame(rows):
    base = {
        "season": 2024, "season_type": "REG", "week": 0,
        "player_gsis_id": "P1", "attempts": 500,
        "avg_time_to_throw": 2.7, "aggressiveness": 15.0,
        "avg_air_yards_to_sticks": 0.5,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def receiving_frame(rows):
    base = {
        "season": 2024, "season_type": "REG", "week": 0,
        "player_gsis_id": "R1", "targets": 100,
        "avg_separation": 3.0, "avg_cushion": 6.0,
        "avg_yac_above_expectation": 0.4, "catch_percentage": 65.0,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def rushing_frame(rows):
    base = {
        "season": 2024, "season_type": "REG", "week": 0,
        "player_gsis_id": "B1", "rush_attempts": 200,
        "rush_yards_over_expected_per_att": 0.3,
        "rush_pct_over_expected": 0.4,
        "percent_attempts_gte_eight_defenders": 20.0,
        "avg_time_to_los": 2.6,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def test_nextgen_uses_regular_season_week_zero_only():
    p = passing_frame([
        {"week": 0, "avg_time_to_throw": 2.8},
        {"week": 3, "avg_time_to_throw": 3.5},
        {"season_type": "POST", "week": 0, "avg_time_to_throw": 3.9},
    ])
    out = nextgen_season({"passing": p, "receiving": None, "rushing": None})
    assert out.filter(pl.col("playerId") == "P1")["timeToThrow"][0] == 2.8


def test_nextgen_scales_percent_columns_to_decimals():
    p = passing_frame([{"aggressiveness": 16.2}])
    r = receiving_frame([{"catch_percentage": 65.0}])
    b = rushing_frame([{"percent_attempts_gte_eight_defenders": 25.0}])
    out = nextgen_season({"passing": p, "receiving": r, "rushing": b})
    assert out.filter(pl.col("playerId") == "P1")["aggressiveness"][0] == pytest.approx(0.162)
    assert out.filter(pl.col("playerId") == "R1")["catchRate"][0] == pytest.approx(0.65)
    assert out.filter(pl.col("playerId") == "B1")["eightBoxPct"][0] == pytest.approx(0.25)


def test_nextgen_traded_player_keeps_highest_volume_row():
    r = receiving_frame([
        {"player_gsis_id": "R1", "targets": 40, "avg_separation": 2.5},
        {"player_gsis_id": "R1", "targets": 70, "avg_separation": 3.1},
    ])
    out = nextgen_season({"passing": None, "receiving": r, "rushing": None})
    rows = out.filter(pl.col("playerId") == "R1")
    assert rows.height == 1
    assert rows["separation"][0] == 3.1


def test_nextgen_missing_or_empty_source_yields_null_columns():
    empty = receiving_frame([{}]).clear()
    out = nextgen_season({
        "passing": None,
        "receiving": empty,
        "rushing": rushing_frame([{}]),
    })
    assert "playerId" in out.columns
    for k in NGS_KEYS:
        assert k in out.columns
    assert out.height == 1
    row = out.row(0, named=True)
    for k in ("timeToThrow", "separation", "catchRate"):
        assert row[k] is None
    assert row["timeToLos"] == 2.6


def test_fetch_optional_skips_before_since_without_calling():
    def boom():
        raise AssertionError("should not be called")

    assert fetch_optional("pfr", 2017, boom, since=2018) is None


def _conn_error(status):
    class Resp:
        status_code = status

    class Cause(Exception):
        response = Resp()

    err = ConnectionError("fetch failed")
    err.__cause__ = Cause()
    return err


def test_fetch_optional_skips_404_and_reraises_other_errors(capsys):
    def raise_404():
        raise _conn_error(404)

    assert fetch_optional("pfr", 2024, raise_404) is None
    assert "pfr" in capsys.readouterr().out

    def raise_key():
        raise KeyError("x")

    with pytest.raises(KeyError):
        fetch_optional("pfr", 2024, raise_key)

    def raise_500():
        raise _conn_error(500)

    with pytest.raises(ConnectionError):
        fetch_optional("pfr", 2024, raise_500)

    assert fetch_optional("pfr", 2024, lambda: 7, since=2018) == 7

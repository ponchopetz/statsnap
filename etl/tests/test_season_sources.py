import polars as pl
import pytest

from season_sources import (
    big_plays_season,
    expected_points_season,
    fetch_optional,
    nextgen_season,
)

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


def ff_frame(rows):
    base = {
        "player_id": "P1", "game_id": "2024_01_ARI_BUF", "week": 1.0,
        "total_fantasy_points_exp": 10.0, "total_fantasy_points_diff": 1.0,
        "total_touchdown_exp": 0.5, "receptions_exp": 4.0,
    }
    return pl.DataFrame(
        [{**base, **r} for r in rows],
        schema_overrides={"week": pl.Float64},
    )


def test_expected_points_sums_regular_season_games_only():
    ff = ff_frame([
        {"game_id": "g1", "week": 1.0, "total_fantasy_points_exp": 10.0,
         "total_fantasy_points_diff": 2.0, "total_touchdown_exp": 0.4, "receptions_exp": 3.0},
        {"game_id": "g2", "week": 2.0, "total_fantasy_points_exp": 12.5,
         "total_fantasy_points_diff": -1.0, "total_touchdown_exp": 0.6, "receptions_exp": 5.0},
        {"game_id": "g19", "week": 19.0, "total_fantasy_points_exp": 30.0,
         "total_fantasy_points_diff": 9.0, "total_touchdown_exp": 2.0, "receptions_exp": 9.0},
    ])
    out = expected_points_season(ff, {"g1", "g2"}, 18)
    assert out.columns == [
        "playerId", "expectedPprPoints", "pprPointsOverExpected",
        "expectedTds", "expectedReceptions",
    ]
    row = out.row(0, named=True)
    assert out.height == 1
    assert row["playerId"] == "P1"
    assert row["expectedPprPoints"] == pytest.approx(22.5)
    assert row["pprPointsOverExpected"] == pytest.approx(1.0)
    assert row["expectedTds"] == pytest.approx(1.0)
    assert row["expectedReceptions"] == pytest.approx(8.0)


def test_expected_points_falls_back_to_week_filter_when_game_ids_do_not_match():
    ff = ff_frame(
        [{"game_id": f"x{w}", "week": float(w), "total_fantasy_points_exp": 1.0}
         for w in range(1, 20)]
    )
    out = expected_points_season(ff, {"nomatch"}, 18)
    assert out["expectedPprPoints"][0] == pytest.approx(18.0)


def test_expected_points_missing_source_yields_typed_empty_frame():
    for src in (None, ff_frame([{}]).clear()):
        out = expected_points_season(src, {"g1"}, 18)
        assert out.height == 0
        assert out.columns == [
            "playerId", "expectedPprPoints", "pprPointsOverExpected",
            "expectedTds", "expectedReceptions",
        ]


def raw_frame(rows):
    base = {
        "player_id": "P1", "position": "QB",
        "passing_20": 0, "passing_40": 0,
        "rushing_20": 0, "rushing_40": 0,
        "receiving_20": 0, "receiving_40": 0,
        "sack_fumbles": 0, "rushing_fumbles": 0, "receiving_fumbles": 0,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def test_big_plays_use_position_specific_columns():
    raw = raw_frame([
        {"player_id": "Q", "position": "QB", "passing_20": 3, "passing_40": 1, "rushing_20": 2},
        {"player_id": "B", "position": "RB", "rushing_20": 4, "receiving_20": 1},
        {"player_id": "W", "position": "WR", "receiving_20": 5, "receiving_40": 2},
    ])
    out = big_plays_season(raw)
    assert out.columns == ["playerId", "plays20Plus", "plays40Plus", "fumbles"]
    rows = {r["playerId"]: r for r in out.iter_rows(named=True)}
    assert rows["Q"]["plays20Plus"] == 3
    assert rows["Q"]["plays40Plus"] == 1
    assert rows["B"]["plays20Plus"] == 4
    assert rows["W"]["plays40Plus"] == 2


def test_fumbles_count_sack_rushing_and_receiving_fumbles():
    raw = raw_frame([
        {"player_id": "A", "sack_fumbles": 1, "rushing_fumbles": 2, "receiving_fumbles": 1},
        {"player_id": "N", "sack_fumbles": None, "rushing_fumbles": 1, "receiving_fumbles": None},
    ])
    rows = {r["playerId"]: r for r in big_plays_season(raw).iter_rows(named=True)}
    assert rows["A"]["fumbles"] == 4
    assert rows["N"]["fumbles"] == 1


def test_big_plays_sum_across_multiple_rows_per_player():
    raw = raw_frame([
        {"player_id": "W", "position": "WR", "receiving_20": 2, "receiving_40": 1, "rushing_fumbles": 1},
        {"player_id": "W", "position": "WR", "receiving_20": 3, "receiving_40": 0, "rushing_fumbles": 1},
    ])
    out = big_plays_season(raw)
    assert out.height == 1
    row = out.row(0, named=True)
    assert (row["plays20Plus"], row["plays40Plus"], row["fumbles"]) == (5, 1, 2)

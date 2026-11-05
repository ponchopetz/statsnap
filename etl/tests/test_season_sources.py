import polars as pl
import pytest

from season_sources import (
    big_plays_season,
    crosswalk_from_rosters,
    expected_points_season,
    fetch_optional,
    nextgen_season,
    passer_rating_expr,
    pfr_season,
    season_values_map,
    snap_share_season,
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


CROSSWALK = pl.DataFrame({"pfr_id": ["PF1", "PF2"], "playerId": ["G1", "G2"]})


def snap_rows(rows):
    base = {"game_id": "g1", "game_type": "REG", "team": "AAA",
            "pfr_player_id": "PF1", "offense_snaps": 0}
    return pl.DataFrame([{**base, **r} for r in rows])


def test_crosswalk_drops_nulls_and_duplicates():
    rosters = pl.DataFrame({
        "gsis_id": ["G1", "G1", "G2", None, "G3"],
        "pfr_id": ["PF1", "PF1", None, "PF4", "PF3"],
    })
    out = crosswalk_from_rosters(rosters)
    assert out.columns == ["pfr_id", "playerId"]
    assert sorted(out.rows()) == [("PF1", "G1"), ("PF3", "G3")]


def test_snap_share_divides_by_team_snaps_in_games_with_offensive_snaps():
    snaps = snap_rows([
        {"game_id": "g1", "offense_snaps": 45},
        {"game_id": "g1", "pfr_player_id": "PF2", "offense_snaps": 60},
        {"game_id": "g2", "offense_snaps": 0},
        {"game_id": "g2", "pfr_player_id": "PF2", "offense_snaps": 70},
        {"game_id": "g3", "game_type": "POST", "offense_snaps": 50},
    ])
    out = snap_share_season(snaps, CROSSWALK)
    assert out.columns == ["playerId", "snapShare"]
    rows = {r["playerId"]: r["snapShare"] for r in out.iter_rows(named=True)}
    assert rows["G1"] == pytest.approx(0.75)


def test_snap_share_none_gives_typed_empty_frame():
    out = snap_share_season(None, CROSSWALK)
    assert out.columns == ["playerId", "snapShare"]
    assert out.height == 0


def test_passer_rating_formula_and_clamps():
    def rating(*args):
        return pl.select(passer_rating_expr(*[pl.lit(a) for a in args]).alias("r"))["r"][0]

    assert rating(100, 70, 1000, 8, 1) == pytest.approx(124.583, abs=1e-3)
    assert rating(10, 10, 300, 5, 0) == pytest.approx(158.333, abs=1e-3)
    assert rating(10, 0, 0, 0, 5) == 0.0
    assert rating(0, 0, 0, 0, 0) is None


def pfr_weekly(rows):
    base = {"playerId": "G1", "week": 1, "attempts": 0, "sacksSuffered": 0,
            "targets": 0, "receptions": 0, "receivingYards": 0, "receivingTds": 0}
    return pl.DataFrame([{**base, **r} for r in rows])


def pass_frame(rows):
    base = {"game_id": "g1", "season": 2024, "week": 1, "game_type": "REG",
            "pfr_player_id": "PF1", "times_pressured": 0, "passing_bad_throws": 0}
    return pl.DataFrame([{**base, **r} for r in rows])


def rush_frame(rows):
    base = {"game_id": "g1", "season": 2024, "week": 1, "game_type": "REG",
            "pfr_player_id": "PF1", "carries": 0, "rushing_yards_before_contact": 0.0,
            "rushing_yards_after_contact": 0.0, "rushing_broken_tackles": 0,
            "receiving_broken_tackles": 0}
    return pl.DataFrame([{**base, **r} for r in rows])


def rec_frame(rows):
    base = {"game_id": "g1", "season": 2024, "week": 1, "game_type": "REG",
            "pfr_player_id": "PF1", "rushing_broken_tackles": 0,
            "receiving_broken_tackles": 0, "receiving_drop": 0, "receiving_int": 0}
    return pl.DataFrame([{**base, **r} for r in rows])


def test_pfr_denominators_use_only_games_with_pfr_rows():
    weekly = pfr_weekly([
        {"week": 1, "attempts": 30, "sacksSuffered": 2},
        {"week": 2, "attempts": 40, "sacksSuffered": 2},
    ])
    p = pass_frame([{"times_pressured": 8, "passing_bad_throws": 6}])
    out = pfr_season({"pass": p, "rush": None, "rec": None}, weekly, CROSSWALK)
    row = out.filter(pl.col("playerId") == "G1").row(0, named=True)
    assert row["pressureRate"] == pytest.approx(8 / 32)
    assert row["badThrowPct"] == pytest.approx(6 / 30)


def test_pfr_broken_tackles_dedupe_player_game_across_rush_and_rec_files():
    rush = rush_frame([{"rushing_broken_tackles": 3}])
    rec = rec_frame([{"receiving_broken_tackles": 1}])
    out = pfr_season({"pass": None, "rush": rush, "rec": rec}, pfr_weekly([{}]), CROSSWALK)
    assert out.filter(pl.col("playerId") == "G1")["brokenTackles"][0] == 4


def test_pfr_receiving_and_rushing_rates():
    weekly = pfr_weekly([
        {"week": 1, "targets": 10, "receptions": 7, "receivingYards": 100, "receivingTds": 1},
        {"week": 2, "targets": 10, "receptions": 5, "receivingYards": 80, "receivingTds": 0},
    ])
    rec = rec_frame([
        {"week": 1, "game_id": "g1", "receiving_drop": 2, "receiving_int": 1},
        {"week": 2, "game_id": "g2", "receiving_drop": 1, "receiving_int": 0},
    ])
    rush = rush_frame([
        {"carries": 10, "rushing_yards_before_contact": 40.0, "rushing_yards_after_contact": 30.0},
        {"week": 2, "game_id": "g2", "carries": 10,
         "rushing_yards_before_contact": 20.0, "rushing_yards_after_contact": 10.0},
    ])
    out = pfr_season({"pass": None, "rush": rush, "rec": rec}, weekly, CROSSWALK)
    row = out.filter(pl.col("playerId") == "G1").row(0, named=True)
    assert row["dropRate"] == pytest.approx(3 / 20)
    assert row["intsWhenTargeted"] == 1
    expected = pl.select(passer_rating_expr(
        pl.lit(20), pl.lit(12), pl.lit(180), pl.lit(1), pl.lit(1)).alias("r"))["r"][0]
    assert row["ratingWhenTargeted"] == pytest.approx(expected)
    assert row["beforeContactPerAtt"] == pytest.approx(3.0)
    assert row["afterContactPerAtt"] == pytest.approx(2.0)


def test_pfr_zero_denominator_is_null_not_nan():
    weekly = pfr_weekly([{"attempts": 0, "sacksSuffered": 0}])
    p = pass_frame([{"times_pressured": 0}])
    out = pfr_season({"pass": p, "rush": None, "rec": None}, weekly, CROSSWALK)
    value = out.filter(pl.col("playerId") == "G1")["pressureRate"]
    assert value[0] is None
    assert value.is_nan().sum() == 0


def test_pfr_rows_missing_from_crosswalk_are_dropped():
    weekly = pfr_weekly([{"attempts": 30}])
    p = pass_frame([{"pfr_player_id": "UNMAPPED", "times_pressured": 5}])
    out = pfr_season({"pass": p, "rush": None, "rec": None}, weekly, CROSSWALK)
    assert out.filter(pl.col("playerId") == "G1").height == 0
    assert out.height == 0


def test_pfr_filters_to_regular_season():
    weekly = pfr_weekly([{"attempts": 30}])
    p = pass_frame([{"game_type": "WC", "times_pressured": 9}])
    out = pfr_season({"pass": p, "rush": None, "rec": None}, weekly, CROSSWALK)
    assert out.height == 0


def test_pfr_all_sources_none_gives_typed_empty_frame():
    out = pfr_season({"pass": None, "rush": None, "rec": None}, pfr_weekly([]), CROSSWALK)
    assert out.height == 0
    assert out.columns[0] == "playerId"
    assert len(out.columns) == 9


def test_pfr_missing_required_column_raises():
    weekly = pfr_weekly([{"attempts": 30}])
    p = pass_frame([{}]).drop("times_pressured")
    with pytest.raises(ValueError, match="times_pressured"):
        pfr_season({"pass": p, "rush": None, "rec": None}, weekly, CROSSWALK)


def test_season_values_map_drops_null_and_non_finite():
    frame_ = pl.DataFrame(
        {"playerId": ["a", "b"], "x": [None, 0.0], "y": [float("nan"), 2.5],
         "z": [float("inf"), -1.0]},
        schema={"playerId": pl.Utf8, "x": pl.Float64, "y": pl.Float64, "z": pl.Float64},
    )
    assert season_values_map(frame_) == {"b": {"x": 0.0, "y": 2.5, "z": -1.0}}

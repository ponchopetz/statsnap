"""Season aggregation and cohort ranking in etl/percentiles.py.

These are the numbers the Advanced tab's percentile bars are built from, so
every rule here is a rule the UI silently depends on.
"""
import math

import pytest
from polars import col

from percentiles import POSITION_CONFIGS, _aggregate_season, _rank_cohort, compute_percentiles
from tests.helpers import frame, qb_week, rb_week, wr_week


def season(df, player_id):
    return df.filter(col("playerId") == player_id).to_dicts()[0]


# ── Ratio-of-sums aggregation ─────────────────────────────────────────────────

class TestRatioOfSums:
    def test_epa_per_play_is_ratio_of_sums_not_mean_of_weekly_totals(self):
        # 10 EPA on 20 att, 2 EPA on 40 att → 12/60 = 0.2 (mean of weekly totals = 6.0)
        df = frame(("qb", "QB", [qb_week(1, 20, epa=10.0), qb_week(2, 40, epa=2.0)]))
        row = season(_aggregate_season(df), "qb")
        assert row["passingEpa"] == pytest.approx(0.2)

    def test_null_epa_week_drops_its_attempts_from_the_denominator(self):
        # The bug that created the contract: 30 attempts with null EPA must
        # not count as 30 attempts of zero EPA.
        df = frame(("qb", "QB", [qb_week(1, 30, epa=None), qb_week(2, 30, epa=6.0)]))
        row = season(_aggregate_season(df), "qb")
        assert row["passingEpa"] == pytest.approx(0.2)

    def test_cpoe_is_attempt_weighted_and_skips_null_weeks(self):
        df = frame(("qb", "QB", [
            qb_week(1, 10, cpoe=10.0),
            qb_week(2, 30, cpoe=-2.0),
            qb_week(3, 50, cpoe=None),
        ]))
        row = season(_aggregate_season(df), "qb")
        assert row["passingCpoe"] == pytest.approx((100 - 60) / 40)

    def test_rushing_and_receiving_epa_use_their_own_denominators(self):
        df = frame(
            ("rb", "RB", [rb_week(1, 10, epa=3.0), rb_week(2, 30, epa=-1.0)]),
            ("wr", "WR", [wr_week(1, 5, epa=2.5), wr_week(2, 15, epa=1.5)]),
        )
        agg = _aggregate_season(df)
        assert season(agg, "rb")["rushingEpa"] == pytest.approx(2 / 40)
        assert season(agg, "wr")["receivingEpa"] == pytest.approx(4 / 20)

    def test_share_metrics_are_averaged_over_non_null_weeks(self):
        df = frame(("wr", "WR", [wr_week(1, 8, share=0.30), wr_week(2, 1, share=None), wr_week(3, 8, share=0.10)]))
        row = season(_aggregate_season(df), "wr")
        assert row["targetShare"] == pytest.approx(0.20)
        assert row["wopr"] == pytest.approx(0.20)

    def test_counting_stats_treat_null_as_zero(self):
        df = frame(("qb", "QB", [
            {"week": 1, "attempts": 10, "passingAirYards": 80, "sacksSuffered": None},
            {"week": 2, "attempts": None, "passingAirYards": None, "sacksSuffered": 3},
        ]))
        row = season(_aggregate_season(df), "qb")
        assert row["passingAirYards"] == 80
        assert row["sacksSuffered"] == 3
        assert row["_sum_attempts"] == 10


class TestZeroAndUndefinedDenominators:
    def test_zero_attempts_makes_adot_null_and_zero_air_yards_makes_pacr_null(self):
        df = frame(("qb", "QB", [qb_week(1, 0, air=0, yards=0)]))
        row = season(_aggregate_season(df), "qb")
        assert row["adot"] is None
        assert row["pacr"] is None
        assert row["passingEpa"] is None
        assert row["passingCpoe"] is None

    def test_all_checkdowns_zero_air_yards_gives_legitimate_zero_adot(self):
        df = frame(("qb", "QB", [qb_week(1, 12, air=0, yards=70)]))
        row = season(_aggregate_season(df), "qb")
        assert row["adot"] == 0.0
        assert row["pacr"] is None  # 70 / 0 has no meaning

    def test_negative_season_air_yards_null_out_racr_and_pacr(self):
        # A screen-only receiver can net negative air yards; the ratio is
        # gated on > 0, so it is null and the player is excluded from that
        # metric's ranking rather than ranked on a negative conversion ratio.
        df = frame(
            ("te", "TE", [wr_week(1, 5, air=-5, yards=40), wr_week(2, 4, air=-8, yards=20)]),
            ("qb", "QB", [qb_week(1, 10, air=-12, yards=50)]),
        )
        agg = _aggregate_season(df)
        assert season(agg, "te")["racr"] is None
        assert season(agg, "qb")["pacr"] is None
        assert season(agg, "qb")["adot"] == pytest.approx(-1.2)

    def test_zero_receptions_makes_yac_per_rec_null(self):
        df = frame(("wr", "WR", [wr_week(1, 3, rec=0, yac=0)]))
        assert season(_aggregate_season(frame(("wr", "WR", [wr_week(1, 3, rec=0, yac=0)]))), "wr")["yacPerRec"] is None

    def test_single_week_tiny_sample_still_aggregates(self):
        df = frame(("wr", "WR", [wr_week(1, 1, epa=0.7, share=0.05, rec=1, yards=9, yac=4, air=6)]))
        row = season(_aggregate_season(df), "wr")
        assert row["receivingEpa"] == pytest.approx(0.7)
        assert row["racr"] == pytest.approx(1.5)
        assert row["yacPerRec"] == pytest.approx(4.0)
        assert row["targetShare"] == pytest.approx(0.05)

    def test_all_null_weeks_yield_null_rates_and_zero_counts(self):
        df = frame(("qb", "QB", [{"week": 1}, {"week": 2}]))
        row = season(_aggregate_season(df), "qb")
        assert row["passingEpa"] is None
        assert row["pacr"] is None
        assert row["adot"] is None
        assert row["targetShare"] is None
        assert row["passingAirYards"] == 0

    def test_no_nan_ever_leaves_aggregation(self):
        df = frame(("qb", "QB", [qb_week(1, 0, air=0, yards=0, epa=None)]))
        for value in season(_aggregate_season(df), "qb").values():
            assert not (isinstance(value, float) and math.isnan(value))


# ── Cohort ranking ────────────────────────────────────────────────────────────

def ranked(values: dict[str, float | None], metric="m", inverted=frozenset()):
    import polars as pl
    df = pl.DataFrame(
        {"playerId": list(values), metric: list(values.values())},
        schema={"playerId": pl.Utf8, metric: pl.Float64},
    )
    return _rank_cohort(df, metrics=[metric], inverted=set(inverted))


class TestRankCohort:
    def test_percentile_spans_zero_to_one_across_the_cohort(self):
        result = ranked({"low": 1.0, "mid": 2.0, "high": 3.0})
        assert result["low"]["m"] == 0.0
        assert result["mid"]["m"] == 0.5
        assert result["high"]["m"] == 1.0

    def test_ties_share_the_average_rank(self):
        # Ranks: a=1, b/c tie for 2nd and 3rd → 2.5 each, d=4 → (2.5-1)/3
        result = ranked({"a": 1.0, "b": 2.0, "c": 2.0, "d": 3.0})
        assert result["b"]["m"] == result["c"]["m"] == 0.5
        assert result["d"]["m"] == 1.0

    def test_tie_at_the_top_means_nobody_reaches_1(self):
        result = ranked({"a": 1.0, "b": 5.0, "c": 5.0})
        assert result["b"]["m"] == result["c"]["m"] == 0.75
        assert result["a"]["m"] == 0.0

    def test_all_tied_cohort_collapses_to_the_midpoint(self):
        result = ranked({"a": 2.0, "b": 2.0, "c": 2.0})
        assert {v["m"] for v in result.values()} == {0.5}

    def test_lone_qualifier_gets_neutral_half(self):
        assert ranked({"only": 42.0}) == {"only": {"m": 0.5}}

    def test_two_player_cohort_is_exactly_zero_and_one(self):
        result = ranked({"a": 1.0, "b": 2.0})
        assert result == {"a": {"m": 0.0}, "b": {"m": 1.0}}

    def test_inverted_metric_ranks_fewest_as_best_with_correct_ties(self):
        result = ranked({"clean": 10.0, "sacked": 40.0, "also": 40.0}, inverted={"m"})
        assert result["clean"]["m"] == 1.0
        assert result["sacked"]["m"] == result["also"]["m"] == 0.25

    def test_null_metric_omits_that_key_but_keeps_the_player_elsewhere(self):
        import polars as pl
        df = pl.DataFrame(
            {"playerId": ["a", "b", "c"], "x": [1.0, 2.0, 3.0], "y": [1.0, None, 3.0]},
            schema={"playerId": pl.Utf8, "x": pl.Float64, "y": pl.Float64},
        )
        result = _rank_cohort(df, metrics=["x", "y"], inverted=set())
        assert set(result["b"]) == {"x"}
        assert result["a"]["y"] == 0.0 and result["c"]["y"] == 1.0

    def test_percentiles_are_rounded_to_three_places(self):
        result = ranked({str(i): float(i) for i in range(7)})
        assert result["1"]["m"] == 0.167
        assert result["2"]["m"] == 0.333


class TestComputePercentiles:
    def test_qualifier_gate_excludes_sub_threshold_players_entirely(self):
        df = frame(
            ("starter", "QB", [qb_week(1, 200, epa=20.0, cpoe=1.0)]),
            ("backup", "QB", [qb_week(1, 149, epa=30.0, cpoe=5.0)]),
            ("starter2", "QB", [qb_week(1, 150, epa=5.0, cpoe=0.0)]),
        )
        result = compute_percentiles(df)
        assert "backup" not in result
        assert set(result) == {"starter", "starter2"}

    def test_qualifier_accumulates_across_weeks(self):
        weeks = [qb_week(w, 30, epa=1.0, cpoe=0.5) for w in range(1, 6)]  # 150 total
        result = compute_percentiles(frame(("qb", "QB", weeks), ("other", "QB", [qb_week(1, 160, epa=2.0, cpoe=1.0)])))
        assert "qb" in result

    def test_wr_and_te_are_ranked_as_separate_cohorts(self):
        df = frame(
            ("wr1", "WR", [wr_week(1, 40, epa=10.0, share=0.30)]),
            ("wr2", "WR", [wr_week(1, 40, epa=5.0, share=0.20)]),
            ("te1", "TE", [wr_week(1, 40, epa=1.0, share=0.10)]),
            ("te2", "TE", [wr_week(1, 40, epa=0.5, share=0.05)]),
        )
        result = compute_percentiles(df)
        # te1 is worst league-wide but best among TEs.
        assert result["te1"]["receivingEpa"] == 1.0
        assert result["wr2"]["receivingEpa"] == 0.0

    def test_rb_qualifier_is_carries_and_metrics_match_config(self):
        df = frame(
            ("rb1", "RB", [rb_week(1, 30, epa=1.0), rb_week(2, 25, epa=2.0)]),
            ("rb2", "RB", [rb_week(1, 49, epa=9.0)]),
        )
        result = compute_percentiles(df)
        assert "rb2" not in result
        assert set(result["rb1"]) <= set(POSITION_CONFIGS["RB"]["metrics"])

    def test_every_percentile_is_within_unit_interval(self):
        df = frame(*[
            (f"qb{i}", "QB", [qb_week(1, 200, epa=float(i), cpoe=float(i) / 2)]) for i in range(5)
        ])
        for metrics in compute_percentiles(df).values():
            for value in metrics.values():
                assert 0.0 <= value <= 1.0

    def test_empty_frame_and_unknown_positions_return_nothing(self):
        assert compute_percentiles(frame()) == {}
        assert compute_percentiles(frame(("k", "K", [qb_week(1, 200, epa=1.0)]))) == {}

    def test_mid_season_team_change_is_one_player_with_combined_volume(self):
        # percentiles.py groups by playerId only; team is not a key, so a
        # traded player's weeks combine into one qualifying line.
        df = frame(
            ("traded", "QB", [qb_week(1, 80, epa=8.0, cpoe=1.0), qb_week(9, 80, epa=8.0, cpoe=1.0)]),
            ("stayed", "QB", [qb_week(1, 160, epa=4.0, cpoe=0.0)]),
        )
        result = compute_percentiles(df)
        assert "traded" in result
        assert result["traded"]["passingEpa"] == 1.0

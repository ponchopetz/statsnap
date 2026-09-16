"""Pure DataFrame stages of etl/transform.py (no network, no database)."""
from datetime import date

import polars as pl
import pytest
from polars import col

import transform
from transform import (
    compute_derived,
    enrich_with_game_context,
    enrich_with_identity,
    filter_positions,
    handle_nulls,
    rename_columns,
    RENAME_MAP,
    KEEP_COLUMNS,
)


def test_rename_map_covers_exactly_the_kept_columns():
    # KEEP_COLUMNS is what we select; RENAME_MAP is the contract. A column in
    # one but not the other is either silently dropped or a KeyError at 2am.
    assert set(KEEP_COLUMNS) == set(RENAME_MAP)


def test_rename_map_targets_are_unique():
    targets = list(RENAME_MAP.values())
    assert len(targets) == len(set(targets))


def test_filter_positions_keeps_skill_positions_in_regular_season_only():
    df = pl.DataFrame({
        "position": ["QB", "K", "WR", "RB", "TE", "OL"],
        "season_type": ["REG", "REG", "POST", "REG", "REG", "REG"],
    })
    out = filter_positions(df)
    assert out["position"].to_list() == ["QB", "RB", "TE"]


class TestGameContext:
    @pytest.fixture
    def schedules(self):
        return pl.DataFrame({
            "season": [2024, 2024],
            "week": [1, 2],
            "home_team": ["KC", "BUF"],
            "away_team": ["BAL", "KC"],
            "home_score": [27, 20],
            "away_score": [20, 20],
            "gameday": [date(2024, 9, 5), date(2024, 9, 15)],
            "overtime": [0, 1],
            "game_id": ["a", "b"],
        })

    def test_home_and_away_perspectives_and_result(self, schedules):
        stats = pl.DataFrame({
            "player_id": ["kc-qb", "kc-qb", "bal-qb"],
            "season": [2024, 2024, 2024],
            "week": [1, 2, 1],
            "team": ["KC", "KC", "BAL"],
            "opponent_team": ["BAL", "BUF", "KC"],
        })
        out = enrich_with_game_context(stats, schedules).sort(["player_id", "week"])
        rows = out.to_dicts()

        bal = rows[0]
        assert bal["homeAway"] == "away" and bal["teamScore"] == 20 and bal["opponentScore"] == 27
        assert bal["result"] == "L"

        kc_w1, kc_w2 = rows[1], rows[2]
        assert kc_w1["homeAway"] == "home" and kc_w1["result"] == "W"
        assert kc_w2["homeAway"] == "away" and kc_w2["result"] == "T" and kc_w2["overtime"] == 1

    def test_missing_schedule_row_leaves_context_null(self, schedules):
        stats = pl.DataFrame({
            "player_id": ["x"], "season": [2024], "week": [7], "team": ["KC"], "opponent_team": ["DEN"],
        })
        row = enrich_with_game_context(stats, schedules).to_dicts()[0]
        assert row["homeAway"] is None and row["teamScore"] is None
        # Null vs null comparisons fall through to the otherwise branch.
        assert row["result"] == "T"

    def test_warns_when_opponent_disagrees_with_schedule(self, schedules, capsys):
        stats = pl.DataFrame({
            "player_id": ["x"], "season": [2024], "week": [1], "team": ["KC"], "opponent_team": ["DEN"],
        })
        enrich_with_game_context(stats, schedules)
        assert "WARNING: 1 rows where opponent_team disagrees" in capsys.readouterr().out


class TestIdentity:
    def test_left_joins_keep_stats_for_undrafted_and_unrostered_players(self):
        stats = pl.DataFrame({"player_id": ["a", "b"], "team": ["KC", "XX"]})
        rosters = pl.DataFrame({
            "gsis_id": ["a"], "jersey_number": [15], "birth_date": [date(1995, 9, 17)],
            "height": [74], "weight": [225], "college": ["Texas Tech"], "years_exp": [7],
            "headshot_url": ["u"],
        })
        draft = pl.DataFrame({"gsis_id": ["a"], "season": [2017], "round": [1], "pick": [10]})
        out = enrich_with_identity(stats, rosters, draft).sort("player_id").to_dicts()

        assert out[0]["draft_year"] == 2017 and out[0]["team_city"] == "Kansas City"
        assert out[1]["jersey_number"] is None and out[1]["draft_round"] is None
        # Unknown abbreviations pass through the city lookup unchanged.
        assert out[1]["team_city"] == "XX"


class TestDerived:
    def _renamed(self, weeks):
        return pl.DataFrame({
            "playerId": ["p"] * len(weeks),
            "season": [2024] * len(weeks),
            "week": weeks,
            "receivingYac": [30.0, 0.0, None][: len(weeks)],
            "receptions": [3.0, 0.0, None][: len(weeks)],
            "passingAirYards": [None, None, None][: len(weeks)],
            "attempts": [None, None, None][: len(weeks)],
        })

    def test_division_by_zero_becomes_null_not_nan(self, monkeypatch):
        monkeypatch.setattr(transform, "SEASON", 2024)
        out = compute_derived(self._renamed([1, 2, 3])).to_dicts()
        assert out[0]["yacPerRec"] == 10.0
        assert out[1]["yacPerRec"] is None  # 0 / 0
        assert out[2]["yacPerRec"] is None  # null / null
        assert all(r["adot"] is None for r in out)

    def test_games_played_counts_weeks_per_player_season(self, monkeypatch):
        monkeypatch.setattr(transform, "SEASON", 2024)
        out = compute_derived(self._renamed([1, 2, 3]))
        assert out["gamesPlayed"].to_list() == [3, 3, 3]

    @pytest.mark.parametrize("season,max_week,expected", [
        (2024, 18, True), (2024, 17, False), (2020, 17, True), (2020, 16, False),
    ])
    def test_season_complete_depends_on_league_final_week(self, monkeypatch, season, max_week, expected):
        monkeypatch.setattr(transform, "SEASON", season)
        out = compute_derived(self._renamed([1, max_week]))
        assert out["seasonComplete"].to_list() == [expected, expected]


def test_handle_nulls_sweeps_nan_in_every_float_column():
    df = pl.DataFrame({"a": [float("nan"), 1.0], "b": [2, 3], "c": [None, float("nan")]})
    out = handle_nulls(df).to_dicts()
    assert out[0]["a"] is None and out[1]["c"] is None
    assert out[1]["a"] == 1.0 and out[0]["b"] == 2


def test_rename_columns_formats_dates_and_stringifies_gameday():
    df = pl.DataFrame({
        **{c: [None] for c in KEEP_COLUMNS if c not in ("birth_date", "gameday", "player_id")},
        "player_id": ["p"],
        "birth_date": [date(1995, 9, 17)],
        "gameday": [date(2024, 9, 5)],
    })
    out = rename_columns(df).to_dicts()[0]
    assert out["birthDate"] == "1995-09-17"
    assert out["gameday"] == "2024-09-05"
    assert "experience" in out and "years_exp" not in out

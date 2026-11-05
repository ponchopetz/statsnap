"""Extra nflverse datasets reduced to one row of raw season values per player."""
from typing import Callable, TypeVar

import polars as pl

T = TypeVar("T")

PFR_FIRST_SEASON = 2018

# stat_type -> {metricKey: (ngs_column, scale)}. Percent columns that nflverse
# publishes on a 0-100 scale use 0.01 so every stored percent is a 0..1 decimal.
# Probed against 2024: aggressiveness max 40.6, catch_percentage max 100.0,
# percent_attempts_gte_eight_defenders max 75.0 (all 0-100); rush_pct_over_expected
# max 0.75 (already a decimal).
NGS_FIELDS: dict[str, dict[str, tuple[str, float]]] = {
    "passing": {
        "timeToThrow": ("avg_time_to_throw", 1.0),
        "aggressiveness": ("aggressiveness", 0.01),
        "airYardsToSticks": ("avg_air_yards_to_sticks", 1.0),
    },
    "receiving": {
        "separation": ("avg_separation", 1.0),
        "cushion": ("avg_cushion", 1.0),
        "yacOverExpected": ("avg_yac_above_expectation", 1.0),
        "catchRate": ("catch_percentage", 0.01),
    },
    "rushing": {
        "ryoePerAtt": ("rush_yards_over_expected_per_att", 1.0),
        "runsOverExpectedPct": ("rush_pct_over_expected", 1.0),
        "eightBoxPct": ("percent_attempts_gte_eight_defenders", 0.01),
        "timeToLos": ("avg_time_to_los", 1.0),
    },
}

_NGS_VOLUME = {"passing": "attempts", "receiving": "targets", "rushing": "rush_attempts"}


def _one_source(stat_type: str, df: pl.DataFrame | None) -> pl.DataFrame:
    fields = NGS_FIELDS[stat_type]
    schema = {"playerId": pl.Utf8, **{k: pl.Float64 for k in fields}}
    if df is None or df.height == 0:
        return pl.DataFrame(schema=schema)
    vol = _NGS_VOLUME[stat_type]
    return (
        df.filter((pl.col("week") == 0) & (pl.col("season_type") == "REG"))
        .sort(vol, descending=True, nulls_last=True)
        .unique(subset="player_gsis_id", keep="first", maintain_order=True)
        .select(
            pl.col("player_gsis_id").alias("playerId"),
            *[
                (pl.col(col).cast(pl.Float64) * scale).alias(key)
                for key, (col, scale) in fields.items()
            ],
        )
        .cast(schema)
    )


def nextgen_season(ngs: dict[str, pl.DataFrame | None]) -> pl.DataFrame:
    """One row per player with the 11 Next Gen keys; missing sources are null."""
    out: pl.DataFrame | None = None
    for stat_type in NGS_FIELDS:
        part = _one_source(stat_type, ngs.get(stat_type))
        out = part if out is None else out.join(
            part, on="playerId", how="full", coalesce=True
        )
    return out


def is_not_published(err: Exception) -> bool:
    """True for a ConnectionError caused by an HTTP 404 (file not published yet)."""
    if not isinstance(err, ConnectionError):
        return False
    status = getattr(getattr(err.__cause__, "response", None), "status_code", None)
    return status == 404


def fetch_optional(
    name: str, season: int, call: Callable[[], T], since: int | None = None
) -> T | None:
    """Run an optional source fetch; None if it predates `since` or is unpublished."""
    if since is not None and season < since:
        return None
    try:
        return call()
    except ConnectionError as e:
        if is_not_published(e):
            print(f"nflverse has no {name} data for season {season} yet; skipping.")
            return None
        raise


EXPECTED_FIELDS = {
    "expectedPprPoints": "total_fantasy_points_exp",
    "pprPointsOverExpected": "total_fantasy_points_diff",
    "expectedTds": "total_touchdown_exp",
    "expectedReceptions": "receptions_exp",
}


def expected_points_season(
    ff: pl.DataFrame | None, reg_game_ids: set[str], reg_last_week: int
) -> pl.DataFrame:
    """Sum weekly ff_opportunity expectations over the regular season per player."""
    schema = {"playerId": pl.Utf8, **{k: pl.Float64 for k in EXPECTED_FIELDS}}
    if ff is None or ff.height == 0:
        return pl.DataFrame(schema=schema)
    by_game = ff.filter(pl.col("game_id").is_in(list(reg_game_ids)))
    # Fall back to the week cutoff when the schedule ids do not line up with ff's.
    reg = by_game if by_game.height else ff.filter(pl.col("week") <= reg_last_week)
    return (
        reg.group_by("player_id", maintain_order=True)
        .agg(*[pl.col(col).cast(pl.Float64).fill_null(0).sum().alias(k)
               for k, col in EXPECTED_FIELDS.items()])
        .rename({"player_id": "playerId"})
        .cast(schema)
    )


# position -> (20+ column, 40+ column); each counts plays gaining at least N yards.
_BIG_PLAY_COLUMNS = {
    "QB": ("passing_20", "passing_40"),
    "RB": ("rushing_20", "rushing_40"),
    "WR": ("receiving_20", "receiving_40"),
    "TE": ("receiving_20", "receiving_40"),
}
_FUMBLE_COLUMNS = ("sack_fumbles", "rushing_fumbles", "receiving_fumbles")


def _position_value(index: int) -> pl.Expr:
    expr = pl.lit(0)
    for pos, cols in _BIG_PLAY_COLUMNS.items():
        expr = pl.when(pl.col("position") == pos).then(
            pl.col(cols[index]).fill_null(0)
        ).otherwise(expr)
    return expr


def big_plays_season(raw_stats: pl.DataFrame) -> pl.DataFrame:
    """20+/40+ yard plays (by position) and total fumbles per player."""
    return (
        raw_stats.select(
            pl.col("player_id").alias("playerId"),
            _position_value(0).alias("plays20Plus"),
            _position_value(1).alias("plays40Plus"),
            pl.sum_horizontal(
                *[pl.col(c).fill_null(0) for c in _FUMBLE_COLUMNS]
            ).alias("fumbles"),
        )
        .group_by("playerId", maintain_order=True)
        .agg(pl.col("plays20Plus", "plays40Plus", "fumbles").sum())
    )

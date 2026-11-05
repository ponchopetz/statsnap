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


def _ratio(num: pl.Expr, den: pl.Expr) -> pl.Expr:
    """num / den as Float64, null (never NaN or inf) when den is not positive."""
    return pl.when(den > 0).then(num / den).otherwise(None).cast(pl.Float64)


def crosswalk_from_rosters(rosters: pl.DataFrame) -> pl.DataFrame:
    """Unique (pfr_id, playerId) pairs; rows missing either id are dropped."""
    return (
        rosters.select(pl.col("pfr_id"), pl.col("gsis_id").alias("playerId"))
        .drop_nulls()
        .unique(maintain_order=True)
    )


def snap_share_season(snaps: pl.DataFrame | None, crosswalk: pl.DataFrame) -> pl.DataFrame:
    """Offensive snaps over team offensive snaps, in regular-season games played."""
    schema = {"playerId": pl.Utf8, "snapShare": pl.Float64}
    if snaps is None or snaps.height == 0:
        return pl.DataFrame(schema=schema)
    reg = snaps.filter(pl.col("game_type") == "REG").with_columns(
        pl.col("offense_snaps").max().over("game_id", "team").alias("team_snaps")
    )
    return (
        reg.filter(pl.col("offense_snaps") > 0)
        .join(crosswalk, left_on="pfr_player_id", right_on="pfr_id", how="inner")
        .group_by("playerId", maintain_order=True)
        .agg(pl.col("offense_snaps").sum().alias("snaps"),
             pl.col("team_snaps").sum().alias("team"))
        .select("playerId", _ratio(pl.col("snaps"), pl.col("team")).alias("snapShare"))
        .cast(schema)
    )


def passer_rating_expr(att, comp, yds, td, ints) -> pl.Expr:
    """NFL passer rating from season totals; null when there are no attempts."""
    def clip(e: pl.Expr) -> pl.Expr:
        return e.clip(0, 2.375)

    a = clip((comp / att - 0.3) * 5)
    b = clip((yds / att - 3) * 0.25)
    c = clip(td / att * 20)
    d = clip(2.375 - ints / att * 25)
    return pl.when(att > 0).then((a + b + c + d) / 6 * 100).otherwise(None).cast(pl.Float64)


PFR_KEYS = (
    "pressureRate", "badThrowPct", "dropRate", "brokenTackles",
    "ratingWhenTargeted", "intsWhenTargeted",
    "beforeContactPerAtt", "afterContactPerAtt",
)


def _pfr_reg(
    name: str, df: pl.DataFrame | None, required: tuple[str, ...], crosswalk: pl.DataFrame
):
    """Regular-season PFR rows keyed by playerId and an Int64 week, or None if unpublished."""
    if df is None or df.height == 0:
        return None
    # A renamed or dropped column must fail the run, not become a zero stat.
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"PFR {name} data is missing expected columns: {missing}")
    return (
        df.filter(pl.col("game_type") == "REG")
        .join(crosswalk, left_on="pfr_player_id", right_on="pfr_id", how="inner")
        .with_columns(pl.col("week").cast(pl.Int64))
    )


def _pfr_weekly_joined(pfr: pl.DataFrame, weekly: pl.DataFrame) -> pl.DataFrame:
    """PFR rows joined to weekly on (playerId, week); unmatched weeks are dropped."""
    w = weekly.with_columns(pl.col("week").cast(pl.Int64))
    return pfr.unique(subset=["playerId", "week"], keep="first").join(
        w, on=["playerId", "week"], how="inner"
    )


def pfr_season(
    pfr: dict[str, pl.DataFrame | None], weekly: pl.DataFrame, crosswalk: pl.DataFrame
) -> pl.DataFrame:
    """One row per player with the 8 PFR keys; absent sources leave nulls."""
    schema = {"playerId": pl.Utf8, **{k: pl.Float64 for k in PFR_KEYS}}
    parts: list[pl.DataFrame] = []

    passing = _pfr_reg("pass", pfr.get("pass"), ("times_pressured", "passing_bad_throws"), crosswalk)
    if passing is not None:
        j = _pfr_weekly_joined(passing, weekly)
        parts.append(
            j.group_by("playerId", maintain_order=True)
            .agg(pl.col("times_pressured").fill_null(0).sum().alias("pressured"),
                 pl.col("passing_bad_throws").fill_null(0).sum().alias("bad"),
                 pl.col("attempts").sum().alias("att"),
                 pl.col("sacksSuffered").fill_null(0).sum().alias("sacks"))
            .select("playerId",
                    _ratio(pl.col("pressured"), pl.col("att") + pl.col("sacks")).alias("pressureRate"),
                    _ratio(pl.col("bad"), pl.col("att")).alias("badThrowPct"))
        )

    bt_cols = ("rushing_broken_tackles", "receiving_broken_tackles")
    receiving = _pfr_reg(
        "rec", pfr.get("rec"), ("receiving_drop", "receiving_int", *bt_cols), crosswalk
    )
    if receiving is not None:
        j = _pfr_weekly_joined(receiving, weekly)
        agg = j.group_by("playerId", maintain_order=True).agg(
            pl.col("receiving_drop").fill_null(0).sum().alias("drops"),
            pl.col("receiving_int").fill_null(0).sum().alias("ints"),
            pl.col("targets").sum().alias("tgt"),
            pl.col("receptions").sum().alias("rec"),
            pl.col("receivingYards").sum().alias("yds"),
            pl.col("receivingTds").sum().alias("td"),
        )
        parts.append(agg.select(
            "playerId",
            _ratio(pl.col("drops"), pl.col("tgt")).alias("dropRate"),
            passer_rating_expr(
                pl.col("tgt"), pl.col("rec"), pl.col("yds"), pl.col("td"), pl.col("ints")
            ).alias("ratingWhenTargeted"),
            pl.col("ints").cast(pl.Float64).alias("intsWhenTargeted"),
        ))

    rushing = _pfr_reg(
        "rush",
        pfr.get("rush"),
        ("carries", "rushing_yards_before_contact", "rushing_yards_after_contact", *bt_cols),
        crosswalk,
    )
    if rushing is not None:
        parts.append(
            rushing.group_by("playerId", maintain_order=True)
            .agg(pl.col("carries").fill_null(0).sum().alias("carries"),
                 pl.col("rushing_yards_before_contact").fill_null(0).sum().alias("before"),
                 pl.col("rushing_yards_after_contact").fill_null(0).sum().alias("after"))
            .select("playerId",
                    _ratio(pl.col("before"), pl.col("carries")).alias("beforeContactPerAtt"),
                    _ratio(pl.col("after"), pl.col("carries")).alias("afterContactPerAtt"))
        )

    # Rush and rec files can both list a player-game's broken tackles, so count
    # each player-game once (max per column) rather than summing across files.
    bt_frames = [
        f.select("playerId", "game_id",
                 pl.col("rushing_broken_tackles").cast(pl.Float64),
                 pl.col("receiving_broken_tackles").cast(pl.Float64))
        for f in (rushing, receiving)
        if f is not None
    ]
    if bt_frames:
        parts.append(
            pl.concat(bt_frames)
            .group_by("playerId", "game_id")
            .agg(pl.col("rushing_broken_tackles").max().fill_null(0),
                 pl.col("receiving_broken_tackles").max().fill_null(0))
            .group_by("playerId", maintain_order=True)
            .agg((pl.col("rushing_broken_tackles") + pl.col("receiving_broken_tackles"))
                 .sum().alias("brokenTackles"))
        )

    out = pl.DataFrame(schema=schema)
    for part in parts:
        out = out.join(part, on="playerId", how="full", coalesce=True, suffix="_new")
        for key in PFR_KEYS:
            if f"{key}_new" in out.columns:
                out = out.with_columns(pl.col(f"{key}_new").alias(key)).drop(f"{key}_new")
    return out.select(list(schema)).cast(schema)

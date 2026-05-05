import os
from dotenv import load_dotenv
import polars as pl
from polars import col
import nflreadpy

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────

SEASON = int(os.environ.get("SEASON", 2024))
SKILL_POSITIONS = ["QB", "WR", "TE", "RB"]

# Columns to keep from the raw 114-column DataFrame, in nflverse snake_case.
# Order here doesn't matter — Polars .select() preserves the list order.
KEEP_COLUMNS = [
    # Identity
    "player_id",
    "player_display_name",
    "position",
    "team",
    "season",
    "week",
    "season_type",
    # QB
    "attempts",
    "completions",
    "passing_epa",
    "pacr",
    "passing_cpoe",
    "passing_air_yards",
    "sacks_suffered",
    "sack_yards_lost",
    # WR / TE / RB
    "targets",
    "receptions",
    "target_share",
    "air_yards_share",
    "wopr",
    "racr",
    "receiving_epa",
    "receiving_air_yards",
    "receiving_yards_after_catch",
    # RB
    "rushing_epa",
    "carries",
]

# The rename map is the API contract in one place.
# Left side: what nflverse calls it. Right side: what StatSnap calls it.
RENAME_MAP = {
    "player_id": "playerId",
    "player_display_name": "displayName",
    "position": "position",
    "team": "team",
    "season": "season",
    "week": "week",
    "season_type": "seasonType",
    "attempts": "attempts",
    "completions": "completions",
    "passing_epa": "passingEpa",
    "pacr": "pacr",
    "passing_cpoe": "passingCpoe",
    "passing_air_yards": "passingAirYards",
    "sacks_suffered": "sacksSuffered",
    "sack_yards_lost": "sackYardsLost",
    "targets": "targets",
    "receptions": "receptions",
    "target_share": "targetShare",
    "air_yards_share": "airYardsShare",
    "wopr": "wopr",
    "racr": "racr",
    "receiving_epa": "receivingEpa",
    "receiving_air_yards": "receivingAirYards",
    "receiving_yards_after_catch": "receivingYac",
    "rushing_epa": "rushingEpa",
    "carries": "carries",
}

# ── Pipeline stages ───────────────────────────────────────────────────────────

def extract():
    """Pull raw week-level player stats from nflreadpy."""
    return nflreadpy.load_player_stats(SEASON, summary_level="week")


def filter_positions(df):
    """Keep only skill positions, regular season only."""
    return df.filter(
        col("position").is_in(SKILL_POSITIONS) &
        (col("season_type") == "REG")
    )


def select_columns(df):
    """Drop the 88 columns StatSnap doesn't need."""
    return df.select(KEEP_COLUMNS)


def rename_columns(df):
    """Enforce the API contract: nflverse snake_case → StatSnap camelCase."""
    return df.rename(RENAME_MAP)


def compute_derived(df):
    """
    Add three fields that don't exist in nflverse directly.

    yacPerRec  — efficiency metric: how much YAC a receiver generates per catch
    adot       — depth-of-target proxy: how far downfield a QB's throws travel
    gamesPlayed — how many weeks a player appeared in, written back onto every
                  row for that player via a window function (.over())
    """
    return (
        df
        .with_columns([
            (col("receivingYac") / col("receptions")).alias("yacPerRec"),
            (col("passingAirYards") / col("attempts")).alias("adot"),
            pl.len().over(["playerId", "season"]).alias("gamesPlayed"),
        ])
        # Division by zero produces NaN, not null. NaN survives into pymongo
        # as float('nan'), which causes write errors. fill_nan converts NaN
        # → null so pymongo stores it cleanly as None.
        .with_columns([
            col("yacPerRec").fill_nan(None),
            col("adot").fill_nan(None),
        ])
    )


def handle_nulls(df):
    """
    Convert any remaining NaN values in float columns to null.

    nflverse sometimes leaves NaN in columns we didn't compute ourselves
    (e.g. pacr, racr on weeks with no targets). This sweep catches those.
    """
    float_cols = [
        name for name, dtype in zip(df.columns, df.dtypes)
        if dtype in (pl.Float32, pl.Float64)
    ]
    return df.with_columns([
        col(c).fill_nan(None) for c in float_cols
    ])


def sample_by_position(df):
    """Print 3 rows per position so we can eyeball the shape."""
    for pos in SKILL_POSITIONS:
        sample = df.filter(col("position") == pos).head(3)
        print(f"\n{'─' * 60}")
        print(f"  {pos} — 3 rows")
        print(f"{'─' * 60}")
        print(sample)


# ── Entry point ───────────────────────────────────────────────────────────────

def transform():
    raw        = extract()
    filtered   = filter_positions(raw)
    selected   = select_columns(filtered)
    renamed    = rename_columns(selected)
    derived    = compute_derived(renamed)
    clean      = handle_nulls(derived)

    print(f"\nTotal rows after transform: {len(clean)}")
    print(f"Columns: {clean.columns}")
    sample_by_position(clean)

    return clean


if __name__ == "__main__":
    transform()

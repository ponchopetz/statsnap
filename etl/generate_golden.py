"""Generate the golden file that pins frontend/src/utils/stats.js to
etl/percentiles.py.

The two files implement the same season-aggregation contract in two
languages (Python for percentile ranking, JS for raw display values).
This script feeds a synthetic set of per-week rows through the Python
aggregation and writes both the input and the expected outputs to a JSON
file checked into the frontend. The Vitest suite then asserts the JS
helpers produce identical numbers from the same weeks.

Run from etl/ (no database access, no network):

    python generate_golden.py

Regenerate whenever the aggregation contract changes in percentiles.py.
"""

import json
from pathlib import Path

import polars as pl

from percentiles import _aggregate_season

OUTPUT = (
    Path(__file__).resolve().parent.parent
    / "frontend" / "src" / "utils" / "__tests__" / "golden-season-aggregates.json"
)

# Columns _aggregate_season reads, all nullable floats except identity.
SCHEMA = {
    "playerId": pl.Utf8,
    "position": pl.Utf8,
    "week": pl.Int64,
    "attempts": pl.Float64,
    "completions": pl.Float64,
    "targets": pl.Float64,
    "receptions": pl.Float64,
    "carries": pl.Float64,
    "passingYards": pl.Float64,
    "receivingYards": pl.Float64,
    "receivingYac": pl.Float64,
    "passingAirYards": pl.Float64,
    "receivingAirYards": pl.Float64,
    "sacksSuffered": pl.Float64,
    "sackYardsLost": pl.Float64,
    "targetShare": pl.Float64,
    "airYardsShare": pl.Float64,
    "wopr": pl.Float64,
    "passingCpoe": pl.Float64,
    "passingEpa": pl.Float64,
    "rushingEpa": pl.Float64,
    "receivingEpa": pl.Float64,
}

# Synthetic players covering the aggregation edge cases the contract is
# built around: null-EPA weeks whose attempts must leave the denominator,
# null-CPOE weeks, zero-air-yards ratios, and ordinary volume.
PLAYERS = [
    {
        "playerId": "qb-normal",
        "position": "QB",
        "weeks": [
            {"week": 1, "attempts": 30, "completions": 20, "passingYards": 250,
             "passingAirYards": 240, "sacksSuffered": 2, "sackYardsLost": -14,
             "passingCpoe": 3.1, "passingEpa": 8.4},
            {"week": 2, "attempts": 41, "completions": 28, "passingYards": 310,
             "passingAirYards": 305, "sacksSuffered": 3, "sackYardsLost": -22,
             "passingCpoe": -1.2, "passingEpa": -4.2},
            {"week": 4, "attempts": 25, "completions": 15, "passingYards": 180,
             "passingAirYards": 199, "sacksSuffered": 1, "sackYardsLost": -7,
             "passingCpoe": 0.5, "passingEpa": 2.75},
        ],
    },
    {
        # The bug that created the doctrine: a week with null EPA/CPOE must
        # drop its attempts from those denominators, not count them as zero.
        "playerId": "qb-null-epa-week",
        "position": "QB",
        "weeks": [
            {"week": 1, "attempts": 35, "completions": 22, "passingYards": 280,
             "passingAirYards": 260, "sacksSuffered": 4, "sackYardsLost": -31,
             "passingCpoe": 5.5, "passingEpa": 11.0},
            {"week": 2, "attempts": 2, "completions": 1, "passingYards": 9,
             "passingAirYards": 6, "sacksSuffered": 0, "sackYardsLost": 0,
             "passingCpoe": None, "passingEpa": None},
            {"week": 3, "attempts": 38, "completions": 25, "passingYards": 301,
             "passingAirYards": 290, "sacksSuffered": 2, "sackYardsLost": -13,
             "passingCpoe": -2.0, "passingEpa": -6.5},
        ],
    },
    {
        # All checkdowns: zero air yards makes PACR undefined (null), while
        # aDOT is a legitimate 0.0 — the null-vs-zero distinction in one player.
        "playerId": "qb-zero-air-yards",
        "position": "QB",
        "weeks": [
            {"week": 1, "attempts": 12, "completions": 10, "passingYards": 70,
             "passingAirYards": 0, "sacksSuffered": 1, "sackYardsLost": -8,
             "passingCpoe": 1.0, "passingEpa": 0.9},
        ],
    },
    {
        "playerId": "wr-normal",
        "position": "WR",
        "weeks": [
            {"week": 1, "targets": 9, "receptions": 6, "receivingYards": 88,
             "receivingYac": 31, "receivingAirYards": 96, "targetShare": 0.24,
             "airYardsShare": 0.31, "wopr": 0.58, "receivingEpa": 4.1},
            {"week": 2, "targets": 12, "receptions": 8, "receivingYards": 131,
             "receivingYac": 45, "receivingAirYards": 128, "targetShare": 0.29,
             "airYardsShare": 0.36, "wopr": 0.69, "receivingEpa": 6.8},
            {"week": 3, "targets": 3, "receptions": 1, "receivingYards": 12,
             "receivingYac": 2, "receivingAirYards": 40, "targetShare": 0.11,
             "airYardsShare": 0.18, "wopr": 0.29, "receivingEpa": -1.3},
        ],
    },
    {
        # Null receiving EPA and share metrics on one week (early exit) —
        # the averages must skip the nulls and the EPA denominator must
        # drop that week's targets.
        "playerId": "wr-null-week",
        "position": "WR",
        "weeks": [
            {"week": 1, "targets": 10, "receptions": 7, "receivingYards": 104,
             "receivingYac": 38, "receivingAirYards": 110, "targetShare": 0.27,
             "airYardsShare": 0.33, "wopr": 0.64, "receivingEpa": 5.2},
            {"week": 2, "targets": 1, "receptions": 0, "receivingYards": 0,
             "receivingYac": 0, "receivingAirYards": 8, "targetShare": None,
             "airYardsShare": None, "wopr": None, "receivingEpa": None},
        ],
    },
    {
        "playerId": "rb-normal",
        "position": "RB",
        "weeks": [
            {"week": 1, "carries": 18, "targets": 4, "receptions": 4,
             "receivingYards": 28, "receivingYac": 30, "receivingAirYards": -6,
             "targetShare": 0.10, "wopr": 0.13, "rushingEpa": 2.4,
             "receivingEpa": 1.1},
            {"week": 2, "carries": 22, "targets": 2, "receptions": 1,
             "receivingYards": 5, "receivingYac": 7, "receivingAirYards": -2,
             "targetShare": 0.05, "wopr": 0.07, "rushingEpa": -3.1,
             "receivingEpa": None},
            {"week": 5, "carries": 9, "targets": 6, "receptions": 5,
             "receivingYards": 44, "receivingYac": 40, "receivingAirYards": 12,
             "targetShare": 0.14, "wopr": 0.19, "rushingEpa": None,
             "receivingEpa": 2.6},
        ],
    },
]

# Which aggregated metrics each position's test should compare. Mirrors
# the per-position rows in stats.js ADVANCED_CONFIG.
COMPARED_METRICS = {
    "QB": ["passingEpa", "pacr", "passingCpoe", "passingAirYards", "adot",
           "sacksSuffered", "sackYardsLost"],
    "WR": ["targetShare", "airYardsShare", "wopr", "racr",
           "receivingAirYards", "yacPerRec", "receivingEpa"],
    "RB": ["rushingEpa", "targetShare", "wopr", "yacPerRec", "carries",
           "receivingAirYards"],
}


def build_dataframe() -> pl.DataFrame:
    rows = []
    for player in PLAYERS:
        for week in player["weeks"]:
            row = {name: None for name in SCHEMA}
            row["playerId"] = player["playerId"]
            row["position"] = player["position"]
            row.update(week)
            rows.append(row)
    return pl.DataFrame(rows, schema=SCHEMA)


def main() -> None:
    df = build_dataframe()
    agg = _aggregate_season(df)

    expected = {}
    for record in agg.to_dicts():
        pid = record["playerId"]
        metrics = COMPARED_METRICS[record["position"]]
        expected[pid] = {m: record[m] for m in metrics}

    golden = {
        "_comment": (
            "Generated by etl/generate_golden.py - do not edit by hand. "
            "Pins stats.js season helpers to the percentiles.py aggregation."
        ),
        "players": [
            {
                "playerId": p["playerId"],
                "position": p["position"],
                "weeks": p["weeks"],
            }
            for p in PLAYERS
        ],
        "expected": expected,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(golden, indent=2) + "\n")
    print(f"Wrote {OUTPUT}")
    print(f"Players: {len(PLAYERS)}, expected maps: {len(expected)}")


if __name__ == "__main__":
    main()

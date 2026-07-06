import nflreadpy as nfl

SKILL_POSITIONS = {"QB", "WR", "TE", "RB"}

DESIRED_COLUMNS = [
    "player_name",
    "position",
    "team",           # was "recent_team" — confirmed column name is "team"
    "week",
    "target_share",
    "air_yards_share",
    "wopr",
    "racr",
    "receiving_epa",
    "passing_epa",
    "pacr",
    "passing_cpoe",   # replaced "dakota" — not in player stats, confirmed absent
]

df = nfl.load_player_stats(2024, summary_level="week")

print(f"Total rows: {len(df)}")
print(f"\nAll columns ({len(df.columns)}):")
for col in df.columns:
    print(f"  {col}")

filtered = df.filter(df["position"].is_in(SKILL_POSITIONS))
print(f"\nRows after filtering to {SKILL_POSITIONS}: {len(filtered)}")

present = [col for col in DESIRED_COLUMNS if col in filtered.columns]
missing = [col for col in DESIRED_COLUMNS if col not in filtered.columns]

print(f"\nFirst 3 rows — available desired columns:")
print(filtered.select(present).head(3))  # Polars DataFrames print cleanly on their own

if missing:
    print(f"\nMISSING columns (not in this dataset): {missing}")
else:
    print("\nAll desired columns are present.")

import polars as pl
from polars import col

# ── Position configuration ────────────────────────────────────────────────────

# Drives the entire module: which metrics belong to each cohort, the
# qualifier gate that a player must pass to enter the cohort at all,
# and which metrics are inverted (fewer is better → higher percentile).
# WR and TE share the same metric set but are ranked as separate cohorts.
POSITION_CONFIGS: dict[str, dict] = {
    "QB": {
        "metrics": [
            "passingEpa", "pacr", "passingCpoe",
            "passingAirYards", "adot",
            "sacksSuffered", "sackYardsLost",
        ],
        "qualifier_col": "_sum_attempts",
        "qualifier_min": 150,
        "inverted": {"sacksSuffered", "sackYardsLost"},
    },
    "WR": {
        "metrics": [
            "targetShare", "airYardsShare", "wopr",
            "racr", "receivingAirYards", "yacPerRec", "receivingEpa",
        ],
        "qualifier_col": "_sum_targets",
        "qualifier_min": 30,
        "inverted": set(),
    },
    "TE": {
        "metrics": [
            "targetShare", "airYardsShare", "wopr",
            "racr", "receivingAirYards", "yacPerRec", "receivingEpa",
        ],
        "qualifier_col": "_sum_targets",
        "qualifier_min": 30,
        "inverted": set(),
    },
    "RB": {
        "metrics": [
            "rushingEpa", "targetShare", "wopr",
            "yacPerRec", "carries", "receivingAirYards",
        ],
        "qualifier_col": "carries",
        "qualifier_min": 50,
        "inverted": set(),
    },
}

# ── Aggregation ───────────────────────────────────────────────────────────────

def _aggregate_season(df: pl.DataFrame) -> pl.DataFrame:
    """
    Collapse per-week rows into one row per player with season-level values.

    Each metric family follows a different aggregation rule:
      SUM: null weeks contribute 0 (fill_null before summing). Correct for
        counting stats where a missing week means zero participation, not
        unknown participation.
      RATIO OF SUMS: sum the raw numerator and denominator columns separately,
        then divide after the group_by. This gives the correct season-level
        ratio rather than the average of weekly ratios (which would weight
        low-volume weeks equally to high-volume ones).
      AVERAGE: Polars mean() skips nulls, giving the correct non-null-week
        average without any special treatment. A bye week (null) is excluded,
        not counted as 0 EPA.
      WEIGHTED AVERAGE (passingCpoe only): weight each week's cpoe by that
        week's attempts. Null-cpoe weeks must be excluded from both numerator
        and denominator; achieved by letting the null product propagate to
        zero in the numerator and using when/then to null out the denominator
        contribution for those weeks.
    """
    agg = df.group_by("playerId").agg([
        pl.first("position"),

        # Qualifier accumulators — needed for gate checks, not ranked metrics.
        col("attempts").fill_null(0).sum().alias("_sum_attempts"),
        col("targets").fill_null(0).sum().alias("_sum_targets"),
        col("receptions").fill_null(0).sum().alias("_sum_receptions"),

        # SUM metrics (null treated as 0 per spec).
        col("passingAirYards").fill_null(0).sum().alias("passingAirYards"),
        col("receivingAirYards").fill_null(0).sum().alias("receivingAirYards"),
        col("carries").fill_null(0).sum().alias("carries"),
        col("sacksSuffered").fill_null(0).sum().alias("sacksSuffered"),
        col("sackYardsLost").fill_null(0).sum().alias("sackYardsLost"),

        # AVERAGE metrics (Polars mean already excludes nulls — correct behavior).
        col("passingEpa").mean().alias("passingEpa"),
        col("receivingEpa").mean().alias("receivingEpa"),
        col("rushingEpa").mean().alias("rushingEpa"),
        col("targetShare").mean().alias("targetShare"),
        col("airYardsShare").mean().alias("airYardsShare"),
        col("wopr").mean().alias("wopr"),

        # Raw components for RATIO metrics. Summed here, divided below.
        col("passingYards").fill_null(0).sum().alias("_sum_passingYards"),
        col("receivingYards").fill_null(0).sum().alias("_sum_receivingYards"),
        col("receivingYac").fill_null(0).sum().alias("_sum_receivingYac"),

        # Attempt-weighted passingCpoe components.
        # The product is null whenever either operand is null, so null-cpoe
        # weeks drop out of the numerator automatically via sum-of-nulls=0.
        (col("passingCpoe") * col("attempts")).sum().alias("_cpoe_numerator"),
        # Denominator: only count attempts from weeks where cpoe is non-null.
        pl.when(col("passingCpoe").is_not_null())
            .then(col("attempts"))
            .otherwise(None)
            .sum()
            .alias("_cpoe_denominator"),
    ])

    # Derive RATIO metrics from the summed components. When the denominator
    # sums to 0 (e.g. a QB who never threw a pass with air yards), the ratio
    # is undefined and becomes null, which excludes the player from that
    # metric's ranking without affecting their other metrics.
    return agg.with_columns([
        pl.when(col("passingAirYards") > 0)
            .then(col("_sum_passingYards") / col("passingAirYards"))
            .otherwise(None)
            .alias("pacr"),

        pl.when(col("receivingAirYards") > 0)
            .then(col("_sum_receivingYards") / col("receivingAirYards"))
            .otherwise(None)
            .alias("racr"),

        pl.when(col("_sum_attempts") > 0)
            .then(col("passingAirYards") / col("_sum_attempts"))
            .otherwise(None)
            .alias("adot"),

        pl.when(col("_sum_receptions") > 0)
            .then(col("_sum_receivingYac") / col("_sum_receptions"))
            .otherwise(None)
            .alias("yacPerRec"),

        pl.when(col("_cpoe_denominator") > 0)
            .then(col("_cpoe_numerator") / col("_cpoe_denominator"))
            .otherwise(None)
            .alias("passingCpoe"),
    ])


# ── Ranking ───────────────────────────────────────────────────────────────────

def _rank_cohort(
    qualified: pl.DataFrame,
    metrics: list[str],
    inverted: set[str],
) -> dict[str, dict[str, float]]:
    """
    Rank players within a position cohort and return {playerId: {metric: pct}}.

    Percentile formula: (rank - 1) / (n - 1), which maps the worst-ranked
    player to 0.0 and the best-ranked to 1.0. With exactly one qualifier the
    formula is undefined (0/0), so 0.5 is used as a neutral value.

    For each metric, only players with a non-null season value participate in
    the ranking. A null value (e.g. pacr when passingAirYards == 0) causes
    that metric to be omitted from the player's map entirely rather than
    ranked as 0. All other metrics the player qualifies for are still ranked.

    Inverted metrics (sacksSuffered, sackYardsLost) are ranked with
    descending=True so the player with the fewest sacks receives rank N
    (best) rather than rank 1. This keeps tie-handling correct — (1 - p) on
    a forward rank would produce identical tie percentiles only by accident.
    """
    result: dict[str, dict[str, float]] = {}

    for metric in metrics:
        descending = metric in inverted
        metric_df = (
            qualified
            .filter(col(metric).is_not_null())
            .select(["playerId", metric])
        )
        n = len(metric_df)
        if n == 0:
            continue

        ranked = metric_df.with_columns(
            col(metric).rank(method="average", descending=descending).alias("_rank")
        )

        if n == 1:
            ranked = ranked.with_columns(pl.lit(0.5).alias("_pct"))
        else:
            ranked = ranked.with_columns(
                ((col("_rank") - 1) / (n - 1)).round(3).alias("_pct")
            )

        for row in ranked.select(["playerId", "_pct"]).to_dicts():
            pid = row["playerId"]
            if pid not in result:
                result[pid] = {}
            result[pid][metric] = row["_pct"]

    return result


# ── Entry point ───────────────────────────────────────────────────────────────

def compute_percentiles(df: pl.DataFrame) -> dict[str, dict[str, float]]:
    """
    Compute per-player position-cohort percentiles for advanced metrics.

    Takes the full per-week DataFrame for one season (post-rename, post-derive)
    and returns a dict keyed by playerId. Each value is a metric-to-percentile
    map for that player's position cohort. Only qualifying players appear in the
    result; non-qualifiers are omitted entirely so the caller can treat a
    missing key as "no advanced data" — the Mongoose document gets no
    'advanced' field rather than an empty object.

    QB, RB, WR, and TE are ranked as four independent cohorts. WR and TE share
    the same metric set but are NOT merged into a single cohort — a TE's
    targetShare percentile is relative to other TEs only.

    The df is expected to cover exactly one season (transform.py runs per-season
    via the SEASON env var), so playerId is unique within the input.
    """
    agg = _aggregate_season(df)
    result: dict[str, dict[str, float]] = {}

    for position, config in POSITION_CONFIGS.items():
        pos_agg = agg.filter(col("position") == position)
        if len(pos_agg) == 0:
            continue

        qualified = pos_agg.filter(
            col(config["qualifier_col"]) >= config["qualifier_min"]
        )
        if len(qualified) == 0:
            continue

        cohort_result = _rank_cohort(
            qualified,
            metrics=config["metrics"],
            inverted=config["inverted"],
        )
        result.update(cohort_result)

    return result

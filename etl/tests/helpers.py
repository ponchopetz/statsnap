"""Row builders for per-week DataFrames in the shape percentiles.py expects."""
import polars as pl

from generate_golden import SCHEMA


def week_rows(player_id: str, position: str, weeks: list[dict]) -> list[dict]:
    rows = []
    for week in weeks:
        row = {name: None for name in SCHEMA}
        row["playerId"] = player_id
        row["position"] = position
        row.update(week)
        rows.append(row)
    return rows


def frame(*players: tuple[str, str, list[dict]]) -> pl.DataFrame:
    rows = []
    for player_id, position, weeks in players:
        rows.extend(week_rows(player_id, position, weeks))
    return pl.DataFrame(rows, schema=SCHEMA)


def qb_week(week: int, attempts: int, epa=None, cpoe=None, air=None, yards=None) -> dict:
    return {
        "week": week,
        "attempts": attempts,
        "completions": attempts // 2,
        "passingYards": yards if yards is not None else attempts * 7,
        "passingAirYards": air if air is not None else attempts * 8,
        "passingEpa": epa,
        "passingCpoe": cpoe,
    }


def wr_week(week: int, targets: int, epa=None, share=None, air=None, yards=None, yac=None, rec=None) -> dict:
    return {
        "week": week,
        "targets": targets,
        "receptions": rec if rec is not None else max(targets - 2, 0),
        "receivingYards": yards if yards is not None else targets * 10,
        "receivingYac": yac if yac is not None else targets * 3,
        "receivingAirYards": air if air is not None else targets * 9,
        "targetShare": share,
        "airYardsShare": share,
        "wopr": share,
        "receivingEpa": epa,
    }


def rb_week(week: int, carries: int, epa=None) -> dict:
    return {"week": week, "carries": carries, "rushingEpa": epa}

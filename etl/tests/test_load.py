"""reshape() and the idempotent bulk upsert in etl/load.py.

The upsert tests run against a throwaway local mongod (see conftest.py).
They never touch the URI in etl/.env.
"""
import copy

import polars as pl
import pytest

from load import TOP_LEVEL_FIELDS, WEEK_FIELDS, ensure_index, reshape, upsert_documents


def flat_rows(player_id="p1", season=2024, weeks=(3, 1, 2), team_by_week=None):
    """Minimal flat per-week rows with every column reshape() hoists or nests."""
    rows = []
    for w in weeks:
        row = {f: None for f in TOP_LEVEL_FIELDS + WEEK_FIELDS}
        row.update({
            "playerId": player_id,
            "season": season,
            "week": w,
            "displayName": "Test Player",
            "position": "QB",
            "team": (team_by_week or {}).get(w, "KC"),
            "gamesPlayed": len(weeks),
            "seasonComplete": True,
            "experience": 3,
            "attempts": 30 + w,
            "passingYards": 200 + w,
            "opponent": "DEN",
            "result": "W",
        })
        rows.append(row)
    return rows


class TestReshape:
    def test_one_document_per_player_season_with_weeks_in_order(self):
        docs = reshape(pl.DataFrame(flat_rows(weeks=(3, 1, 2)) + flat_rows(player_id="p2", weeks=(5,))))
        assert sorted(d["playerId"] for d in docs) == ["p1", "p2"]
        p1 = next(d for d in docs if d["playerId"] == "p1")
        assert [w["week"] for w in p1["weeks"]] == [1, 2, 3]
        assert p1["weeks"][0]["attempts"] == 31
        assert p1["displayName"] == "Test Player" and p1["experience"] == 3
        assert set(p1["weeks"][0]) == set(WEEK_FIELDS)

    def test_same_player_in_two_seasons_becomes_two_documents(self):
        docs = reshape(pl.DataFrame(flat_rows(season=2023) + flat_rows(season=2024)))
        assert sorted((d["playerId"], d["season"]) for d in docs) == [("p1", 2023), ("p1", 2024)]

    def test_mid_season_trade_yields_one_document_stamped_with_the_first_week_team(self):
        # Documented current behaviour, not an endorsement: the schema has no
        # per-week team, and pl.first() after a week sort picks the EARLIEST
        # team. A player traded in week 8 renders with their old team for the
        # whole season. Changing this needs a schema decision (per-week team
        # or last-week team), not a test tweak.
        rows = flat_rows(weeks=(1, 8, 9), team_by_week={1: "NYG", 8: "PHI", 9: "PHI"})
        docs = reshape(pl.DataFrame(rows))
        assert len(docs) == 1
        assert docs[0]["team"] == "NYG"
        assert len(docs[0]["weeks"]) == 3


class TestUpsertIdempotency:
    def test_running_the_same_load_twice_does_not_duplicate_or_change_documents(self, collection):
        docs = reshape(pl.DataFrame(flat_rows() + flat_rows(player_id="p2")))

        upsert_documents(collection, copy.deepcopy(docs))
        first_pass = {d["playerId"]: d for d in collection.find({}, {"_id": 0})}
        assert collection.count_documents({}) == 2

        upsert_documents(collection, copy.deepcopy(docs))
        second_pass = {d["playerId"]: d for d in collection.find({}, {"_id": 0})}

        assert collection.count_documents({}) == 2
        assert second_pass == first_pass

    def test_second_run_reports_matches_not_inserts(self, collection, capsys):
        docs = reshape(pl.DataFrame(flat_rows()))
        upsert_documents(collection, copy.deepcopy(docs))
        capsys.readouterr()
        upsert_documents(collection, copy.deepcopy(docs))
        out = capsys.readouterr().out
        assert "Matched (existing documents updated): 1" in out
        assert "Upserted (new documents created):     0" in out

    def test_rerun_with_fresher_data_replaces_fields_in_place(self, collection):
        upsert_documents(collection, reshape(pl.DataFrame(flat_rows(weeks=(1, 2)))))
        original_id = collection.find_one({"playerId": "p1"})["_id"]

        # Next week's load: a third week appears and an earlier stat is corrected.
        rows = flat_rows(weeks=(1, 2, 3))
        rows[0]["passingYards"] = 999
        upsert_documents(collection, reshape(pl.DataFrame(rows)))

        doc = collection.find_one({"playerId": "p1", "season": 2024})
        assert collection.count_documents({}) == 1
        assert doc["_id"] == original_id
        assert [w["week"] for w in doc["weeks"]] == [1, 2, 3]
        assert doc["weeks"][0]["passingYards"] == 999

    def test_a_season_load_never_touches_other_seasons(self, collection):
        upsert_documents(collection, reshape(pl.DataFrame(flat_rows(season=2023))))
        upsert_documents(collection, reshape(pl.DataFrame(flat_rows(season=2024))))
        assert collection.count_documents({"season": 2023}) == 1
        assert collection.count_documents({"season": 2024}) == 1

    def test_advanced_map_round_trips_and_is_replaced_not_merged(self, collection):
        docs = reshape(pl.DataFrame(flat_rows()))
        docs[0]["advanced"] = {"passingEpa": 0.8, "pacr": 0.4}
        upsert_documents(collection, copy.deepcopy(docs))

        docs[0]["advanced"] = {"passingEpa": 0.9}
        upsert_documents(collection, copy.deepcopy(docs))

        # $set replaces the whole sub-document, so the stale pacr key is gone.
        assert collection.find_one({"playerId": "p1"})["advanced"] == {"passingEpa": 0.9}

    def test_empty_batch_writes_nothing(self, collection, capsys):
        upsert_documents(collection, [])
        assert collection.count_documents({}) == 0
        assert "Skipping write" in capsys.readouterr().out

    def test_ensure_index_is_repeatable_and_unique_by_name(self, collection):
        ensure_index(collection)
        ensure_index(collection)
        info = collection.index_information()
        assert "playerId_season" in info
        assert info["playerId_season"]["key"] == [("playerId", 1), ("season", -1)]

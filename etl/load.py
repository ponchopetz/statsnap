import os
import polars as pl
from polars import col
import certifi
from pymongo import MongoClient, UpdateOne, ASCENDING, DESCENDING
from dotenv import load_dotenv

from transform import transform, SEASON

# ── Environment ───────────────────────────────────────────────────────────────

load_dotenv()  # reads MONGO_URI from etl/.env into os.environ

MONGO_URI        = os.environ.get("MONGO_URI")
DB_NAME            = "statsnap"
COLLECTION_NAME    = "playerstats"

# ── Column lists ──────────────────────────────────────────────────────────────

# These stay at the top level of the document — same value on every week
# row for a given player, so we hoist them up once with pl.first().
TOP_LEVEL_FIELDS = [
    "displayName",
    "position",
    "team",
    "gamesPlayed",
    "seasonComplete",
    "jerseyNumber",
    "birthDate",
    "heightInches",
    "weight",
    "college",
    "experience",
    "headshotUrl",
    "draftYear",
    "draftRound",
    "draftPick",
    "teamCity",
]

# These belong inside the weeks array — different value per week.
# seasonType is intentionally excluded: we already filtered to REG in
# transform.py, so it carries no information worth storing.
WEEK_FIELDS = [
    "week",
    # QB
    "attempts",
    "completions",
    "passingYards",
    "passingTds",
    "interceptions",
    "passingFirstDowns",
    "passingTwoPtConversions",
    "passingEpa",
    "pacr",
    "passingCpoe",
    "passingAirYards",
    "sacksSuffered",
    "sackYardsLost",
    "adot",
    # WR / TE / RB
    "targets",
    "receptions",
    "receivingYards",
    "receivingTds",
    "receivingFirstDowns",
    "receivingFumblesLost",
    "receivingTwoPtConversions",
    "targetShare",
    "airYardsShare",
    "wopr",
    "racr",
    "receivingEpa",
    "receivingAirYards",
    "receivingYac",
    "yacPerRec",
    # RB
    "rushingEpa",
    "carries",
    "rushingYards",
    "rushingTds",
    "rushingFirstDowns",
    "rushingFumblesLost",
    "rushingTwoPtConversions",
    # Other
    "specialTeamsTds",
    "fantasyPoints",
    "fantasyPointsPpr",
    # Game context (added Chunk 14c.1)
    "opponent",
    "homeAway",
    "teamScore",
    "opponentScore",
    "gameday",
    "overtime",
    "result",
]

# ── Stage 1: reshape ──────────────────────────────────────────────────────────

def reshape(df):
    """
    Convert the flat per-week DataFrame into one document per player-season.

    Steps:
      1. Sort by week so the embedded weeks array is always in order (week 1
         through week 17). group_by makes no ordering guarantee on its own.
      2. group_by playerId + season — each unique combination becomes one
         document.
      3. agg pulls identity fields up to the top level (pl.first) and
         packages week-level stats into a list of structs (pl.struct + list).
      4. to_dicts() converts the Polars DataFrame into plain Python dicts
         that pymongo knows how to write.
    """
    docs = (
        df
        # Sort first so week order is preserved inside each group
        .sort("week")
        .group_by(["playerId", "season"])
        .agg(
            # Identity fields — hoist to top level, same value every week
            [pl.first(f) for f in TOP_LEVEL_FIELDS]
            +
            # Week-level stats — package each row as an object, collect into list
            [pl.struct(WEEK_FIELDS).alias("weeks")]
        )
    )

    # Convert Polars rows → plain Python dicts for pymongo.
    # Polars null becomes Python None, Polars list becomes Python list.
    return docs.to_dicts()


# ── Stage 2: ensure_index ─────────────────────────────────────────────────────

def ensure_index(collection):
    """
    Create a compound index on (playerId ASC, season DESC) if it doesn't
    exist yet. MongoDB skips creation silently if the index is already there,
    so this is safe to call on every ETL run.

    Why this index:
      - Every Express query hits the collection with { playerId, season }.
        Without an index MongoDB scans every document; with it, the lookup
        is essentially instant regardless of collection size.
      - season DESC means when you query without specifying a year (e.g.
        "get the most recent season for this player") MongoDB returns the
        highest season number first — the natural direction for a stats app.
    """
    collection.create_index(
        [("playerId", ASCENDING), ("season", DESCENDING)],
        name="playerId_season",
    )
    print("Index ensured: playerId_season")


# ── Stage 3: upsert ───────────────────────────────────────────────────────────

def upsert_documents(collection, docs):
    """
    Write documents to MongoDB using bulk upsert.

    Why upsert, not insert:
      This ETL runs weekly. On the first run of the season, documents don't
      exist yet — they need to be created. On every subsequent run, the same
      players' documents already exist and need to be replaced with fresher
      data. upsert handles both cases: create if missing, replace if found.

    Why bulk_write instead of calling update_one in a loop:
      Sending 400 individual update_one calls means 400 round trips to
      MongoDB Atlas over the network. bulk_write batches all 400 operations
      into a single request. Faster and much less network overhead.

    Each UpdateOne operation:
      - filter: { playerId, season } — the unique key for this document
      - update: { $set: doc } — replace all fields with fresh data
      - upsert=True — create the document if the filter finds nothing
    """
    if not docs:
        print(
            "No documents to upsert; transform produced zero rows "
            "(season with no data yet). Skipping write so an empty "
            "batch never reaches MongoDB."
        )
        return

    operations = [
        UpdateOne(
            { "playerId": doc["playerId"], "season": doc["season"] },
            { "$set": doc },
            upsert=True,
        )
        for doc in docs
    ]

    result = collection.bulk_write(operations)

    print(f"Upsert complete:")
    print(f"  Matched (existing documents updated): {result.matched_count}")
    print(f"  Upserted (new documents created):     {result.upserted_count}")


# ── Entry point ───────────────────────────────────────────────────────────────

def load():
    if not MONGO_URI:
        raise EnvironmentError(
            "MONGO_URI not found. Make sure etl/.env exists and contains "
            "MONGO_URI=your_connection_string"
        )

    # Step 1: run the full transform pipeline
    print("Running transform...")
    try:
        clean_df, advanced_map = transform()
    except ConnectionError as e:
        # nflverse 404s a season's file rather than returning an empty one
        # until that season's data pipeline creates it, so a pull for a
        # season that hasn't started yet raises here instead of reaching
        # the empty-docs guard below. Only swallow a clean 404 — any other
        # connection failure (real outage, timeout) still surfaces as a
        # failed run, which is what we want.
        status = getattr(getattr(e.__cause__, "response", None), "status_code", None)
        if status == 404:
            print(
                f"nflverse has no player-stats file for season {SEASON} yet "
                "(season hasn't started). Skipping load; this is a clean "
                "no-op, not a failure."
            )
            return
        raise
    print(f"Transform complete: {len(clean_df)} rows")

    # Step 2: reshape flat DataFrame → list of player-season dicts
    print("\nReshaping to player-season documents...")
    docs = reshape(clean_df)
    print(f"Reshape complete: {len(docs)} documents")

    # Attach the per-player advanced metrics map. Done here rather than inside
    # reshape() because the map has position-varying string keys that Polars
    # cannot represent as a struct column without a fixed schema. Plain-Python
    # dict mutation after to_dicts() is the natural fit and leaves reshape()
    # unchanged.
    advanced_count = 0
    for doc in docs:
        pid = doc["playerId"]
        if pid in advanced_map:
            doc["advanced"] = advanced_map[pid]
            advanced_count += 1
    print(f"Advanced metrics attached to {advanced_count} documents")

    # Step 3: connect to MongoDB and write
    print("\nConnecting to MongoDB...")
    client     = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db         = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    ensure_index(collection)
    upsert_documents(collection, docs)

    client.close()
    print("\nDone. MongoDB connection closed.")


if __name__ == "__main__":
    load()

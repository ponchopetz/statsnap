"""Shared fixtures for the ETL test suite.

Two safety rails run before any project module is imported:

1. MONGO_URI is forced to a loopback port nothing listens on. transform.py
   calls load_dotenv() at import time, and dotenv never overrides a key that
   already exists in the environment, so a real Atlas URI in etl/.env can
   never leak into a test run.
2. The database-backed tests use a throwaway mongod. Set TEST_MONGO_URI to
   point at a local instance (CI uses a mongo service container); otherwise
   a temporary `mongod` is started from PATH with a fresh data directory.
   Anything that looks like an Atlas/SRV URI is refused outright.
"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pytest

os.environ["MONGO_URI"] = "mongodb://127.0.0.1:1/statsnap-tests-never-connect"
os.environ.setdefault("SEASON", "2024")

# Make `import transform`, `import load`, etc. work from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _refuse_non_local(uri: str) -> None:
    lowered = uri.lower()
    if "mongodb+srv" in lowered or "mongodb.net" in lowered:
        raise RuntimeError(
            "TEST_MONGO_URI looks like an Atlas cluster; the ETL tests only run "
            "against a local throwaway mongod."
        )
    if "127.0.0.1" not in lowered and "localhost" not in lowered:
        raise RuntimeError("TEST_MONGO_URI must point at localhost/127.0.0.1.")


@pytest.fixture(scope="session")
def mongo_uri():
    explicit = os.environ.get("TEST_MONGO_URI")
    if explicit:
        _refuse_non_local(explicit)
        yield explicit
        return

    mongod = shutil.which("mongod")
    if not mongod:
        pytest.skip("No mongod on PATH and TEST_MONGO_URI not set; skipping DB tests")

    port = _free_port()
    dbpath = tempfile.mkdtemp(prefix="statsnap-mongod-")
    proc = subprocess.Popen(
        [mongod, "--dbpath", dbpath, "--port", str(port), "--bind_ip", "127.0.0.1", "--quiet"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    uri = f"mongodb://127.0.0.1:{port}"

    from pymongo import MongoClient
    deadline = time.time() + 30
    while True:
        try:
            MongoClient(uri, serverSelectionTimeoutMS=500).admin.command("ping")
            break
        except Exception:
            if proc.poll() is not None or time.time() > deadline:
                proc.kill()
                shutil.rmtree(dbpath, ignore_errors=True)
                raise RuntimeError("temporary mongod failed to start")
            time.sleep(0.2)
    try:
        yield uri
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(dbpath, ignore_errors=True)


@pytest.fixture
def collection(mongo_uri):
    """A fresh, empty collection in a scratch database for each test."""
    from pymongo import MongoClient

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
    db = client["statsnap_test"]
    coll = db["playerstats"]
    coll.drop()
    try:
        yield coll
    finally:
        coll.drop()
        client.close()

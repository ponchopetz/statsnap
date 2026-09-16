"""The checked-in golden file must be what the Python aggregation produces
right now. If percentiles.py changes and nobody regenerates the file, this
fails on the Python side; if stats.js changes, the Vitest golden suite fails
on the JS side. Together they close the loop on the mirrored contract.
"""
import json

import generate_golden


def test_checked_in_golden_file_matches_current_python_aggregation():
    on_disk = json.loads(generate_golden.OUTPUT.read_text())
    fresh = generate_golden.build_golden()
    assert on_disk == fresh, (
        "golden-season-aggregates.json is stale. Run `python generate_golden.py` "
        "from etl/ and commit the result alongside the contract change."
    )


def test_golden_covers_every_ranked_metric_for_every_position():
    golden = generate_golden.build_golden()
    from percentiles import POSITION_CONFIGS

    for position, config in POSITION_CONFIGS.items():
        compared = set(generate_golden.COMPARED_METRICS[position])
        assert compared == set(config["metrics"]), position
        assert golden["positionConfigs"][position]["metrics"] == config["metrics"]
        assert golden["positionConfigs"][position]["qualifierMin"] == config["qualifier_min"]

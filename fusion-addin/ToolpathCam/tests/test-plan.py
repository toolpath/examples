import os
import subprocess
import sys

import pytest

from lib import plan

PACKAGE = os.path.join(os.path.dirname(__file__), "..", "..")
BENCHMARKS = os.path.join(PACKAGE, "benchmarks")


def test_setup_axes_square_x_to_the_direction():
    axes = plan.setup_axes({"x": 0, "y": 0, "z": 1})
    assert axes == {"z": [0.0, 0.0, 1.0], "x": [1.0, 0.0, 0.0]}

    # Along world X there is no X to project, so Y is used.
    assert plan.setup_axes({"x": -1, "y": 0, "z": 0})["x"] == [0.0, 1.0, 0.0]

    tilted = plan.setup_axes({"x": 0, "y": 1, "z": 1}, reference={"x": 1, "y": 0, "z": 0})
    assert tilted["z"] == pytest.approx([0, 0.7071067812, 0.7071067812])
    assert tilted["x"] == [1.0, 0.0, 0.0]


def test_setup_axes_refuse_the_zero_vector():
    with pytest.raises(ValueError):
        plan.setup_axes({"x": 0, "y": 0, "z": 0})


def test_stock_box_is_placed_through_its_frame():
    stock = plan.stock_solid(
        {
            "shape": "box",
            "frame": {
                "location": {"x": 100, "y": 0, "z": 0},
                "axis": {"x": 0, "y": 0, "z": -1},
                "refDirection": {"x": 1, "y": 0, "z": 0},
            },
            "lower": {"x": 0, "y": 0, "z": 0},
            "upper": {"x": 20, "y": 10, "z": 4},
        }
    )
    # y runs along axis × refDirection, which is -Y for a frame looking down.
    assert stock["center"] == [11.0, -0.5, -0.2]
    assert stock["widthDirection"] == [0.0, -1.0, 0.0]
    assert (stock["length"], stock["width"], stock["height"]) == (2.0, 1.0, 0.4)


def test_stock_cylinder_and_nothing_to_model():
    cylinder = plan.stock_solid(
        {
            "shape": "cylinder",
            "origin": {"x": 0, "y": 0, "z": 0},
            "axis": {"x": 0, "y": 0, "z": 1},
            "diameter": 30,
            "length": 50,
        }
    )
    assert cylinder == {"kind": "cylinder", "base": [0.0, 0.0, 0.0], "top": [0.0, 0.0, 5.0], "radius": 1.5}
    assert plan.stock_solid(None) is None
    assert plan.stock_solid({"shape": "body", "bodyIndex": 1, "materialFreeRegions": []}) is None


def test_toolpath_runs_join_sections_and_read_unknown_kinds_as_links():
    toolpath = {
        "points": [0, 0, 10, 0, 0, 0, 10, 0, 0, 10, 0, 10],
        "sections": [
            {"start": 0, "end": 2, "kind": "Approach"},
            {"start": 1, "end": 3, "kind": "Cutting"},
            {"start": 2, "end": 4, "kind": "SomethingNew"},
        ],
    }
    runs = plan.toolpath_runs(toolpath, max_points=100)
    assert [run["kind"] for run in runs] == ["link", "cut", "link"]
    assert runs[1]["points"] == [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]]


def test_toolpath_runs_read_older_segments_and_skip_empty_files():
    assert plan.toolpath_runs(
        {"points": [0, 0, 0, 1, 0, 0], "segments": [{"start": 0, "end": 2, "kind": "Cutting"}]}, 10
    )
    assert plan.toolpath_runs(None, 10) == []
    assert plan.toolpath_runs({"points": [0, 0, 0], "sections": [{"start": 0, "end": 1, "kind": "Cutting"}]}, 10) == []


def test_toolpath_runs_thin_long_paths_but_keep_the_ends():
    points = [coordinate for i in range(101) for coordinate in (i, 0, 0)]
    runs = plan.toolpath_runs({"points": points, "sections": [{"start": 0, "end": 101, "kind": "Cutting"}]}, 10)
    xs = [p[0] for p in runs[0]["points"]]
    assert len(xs) <= 12
    assert xs[0] == 0.0 and xs[-1] == 10.0


def test_setups_without_a_direction_are_left_out():
    begin = {
        "setups": [{"idx": 0, "direction": None, "actions": []}, {"idx": 1, "direction": {"x": 0, "y": 0, "z": 1}}]
    }
    setups = plan.plan_setups(begin)
    assert [(s["idx"], s["name"], s["stock"]) for s in setups] == [(1, "Toolpath 1 (+Z)", "default")]


@pytest.mark.parametrize(
    "benchmark", sorted(d for d in os.listdir(BENCHMARKS) if os.path.isdir(os.path.join(BENCHMARKS, d)))
)
def test_benchmarks_match_their_baselines(benchmark):
    path = os.path.join(BENCHMARKS, benchmark)
    result = subprocess.run(
        [sys.executable, os.path.join(PACKAGE, "bin", "run-import.py"), path, "--check"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr

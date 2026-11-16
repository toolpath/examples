#!/usr/bin/env python3
"""Prints the import plan for a benchmark, or with --check diffs it against expected.json.

Usage: bin/run-import.py benchmarks/<name> [--check | --update] [--max-points N]
"""

import argparse
import difflib
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ToolpathCam"))

from lib.plan import import_plan  # noqa: E402

DEFAULT_MAX_POINTS = 10
NUMBERS = re.compile(r"\[\s+([-\d.,\s]+?)\s+\]")


def render(benchmark: str, max_points: int) -> str:
    with open(os.path.join(benchmark, "begin.json"), encoding="utf-8") as f:
        begin = json.load(f)
    with open(os.path.join(benchmark, "actions.json"), encoding="utf-8") as f:
        actions = json.load(f)
    text = json.dumps(import_plan(begin, actions, max_points), indent=2, ensure_ascii=False)
    # One line per point keeps the baseline diffable.
    return NUMBERS.sub(lambda m: "[" + ", ".join(n.strip() for n in m.group(1).split(",")) + "]", text) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("benchmark")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--max-points", type=int, default=DEFAULT_MAX_POINTS)
    args = parser.parse_args()

    actual = render(args.benchmark, args.max_points)
    expected_path = os.path.join(args.benchmark, "expected.json")
    if args.update:
        with open(expected_path, "w", encoding="utf-8") as f:
            f.write(actual)
        return 0
    if not args.check:
        sys.stdout.write(actual)
        return 0

    with open(expected_path, encoding="utf-8") as f:
        expected = f.read()
    diff = list(difflib.unified_diff(expected.splitlines(True), actual.splitlines(True), "expected", "actual"))
    sys.stdout.writelines(diff)
    return 1 if diff else 0


if __name__ == "__main__":
    sys.exit(main())

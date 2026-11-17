"""Defaults, overridden by an optional config.json beside the add-in."""

import json
import os

DEFAULTS = {
    "app_url": None,
    "api_url": "https://api.toolpath.com",
    "portal_url": "https://portal.toolpath.com",
    # The API key must allow http://localhost:<port> as a browser origin.
    "port": 47831,
    "max_sketch_points_per_action": 2000,
    "sketch_links": True,
    "debug": False,
    # Where past runs are kept; null for the per-user default (see runs.py).
    "runs_dir": None,
}


def load(addin_dir: str) -> dict:
    config = dict(DEFAULTS)
    try:
        with open(os.path.join(addin_dir, "config.json"), encoding="utf-8") as f:
            config.update(json.load(f))
    except FileNotFoundError:
        pass
    return config


def version(addin_dir: str) -> str:
    try:
        with open(os.path.join(addin_dir, "ToolpathCam.manifest"), encoding="utf-8") as f:
            return json.load(f).get("version", "0.0.0")
    except (OSError, ValueError):
        return "0.0.0"

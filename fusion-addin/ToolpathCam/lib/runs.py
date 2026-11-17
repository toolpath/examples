"""Past runs, one JSON file each, in a folder that survives add-in updates.

A run holds ids and statuses only: never CAD content, the API key or presigned URLs.
"""

import json
import os
import re
import sys

RUN_ID = re.compile(r"^[A-Za-z0-9-]{1,64}$")


def default_directory() -> str:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "Toolpath", "fusion-addin", "runs")


class RunStore:
    def __init__(self, directory: str):
        self.directory = directory

    def _path(self, run_id: str) -> str:
        if not RUN_ID.match(run_id or ""):
            raise ValueError("Not a run id.")
        return os.path.join(self.directory, f"{run_id}.json")

    def load(self) -> list:
        try:
            names = os.listdir(self.directory)
        except FileNotFoundError:
            return []
        runs = []
        for name in names:
            if not name.endswith(".json"):
                continue
            try:
                with open(os.path.join(self.directory, name), encoding="utf-8") as f:
                    run = json.load(f)
            except (OSError, ValueError):
                continue
            if isinstance(run, dict) and RUN_ID.match(str(run.get("runId", ""))):
                runs.append(run)
        return runs

    def save(self, run: dict):
        path = self._path(run["runId"])
        os.makedirs(self.directory, exist_ok=True)
        temporary = f"{path}.tmp"
        with open(temporary, "w", encoding="utf-8") as f:
            json.dump(run, f, indent=2)
        os.replace(temporary, path)

    def delete(self, run_id: str):
        try:
            os.remove(self._path(run_id))
        except FileNotFoundError:
            pass

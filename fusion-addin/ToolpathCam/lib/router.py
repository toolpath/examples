"""Handles messages from the two palettes and relays between them.

main: the visible panel. worker: a hidden palette that polls jobs and imports results.
Jobs belong to runs, which are saved to disk on every change (`runs.py`).
Replies go back in `args.returnData`; errors as {"error": "..."}.
"""

import json
import webbrowser
from datetime import datetime, timezone

from . import document, importer

MAIN = "main"
WORKER = "worker"
FINAL_STATUSES = frozenset({"succeeded", "failed"})

RUN_FIELDS = ("runId", "createdAt", "bodyName", "bodyToken", "documentId", "documentName", "partId")
JOB_FIELDS = (
    "jobId",
    "runId",
    "kind",
    "partId",
    "planId",
    "bodyToken",
    "bodyName",
    "documentId",
    "directions",
    "status",
    "progress",
    "error",
    "createdAt",
    "importStatus",
    "importError",
    "importSummary",
)


def parse(raw):
    if not raw or raw in ("undefined", "null"):
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return raw


class Router:
    def __init__(self, *, send, context, config, log, store, selection):
        self._send = send
        self._context = context
        self._config = config
        self._log = log
        self._store = store
        self._selection = selection
        self.runs = {run["runId"]: run for run in store.load()}
        # In memory only, for the worker; never written or logged.
        self.api_key = None
        self.imports = {}

    def handle(self, role: str, action: str, raw: str):
        data = parse(raw)
        handler = _ACTIONS.get(action)
        if handler is None:
            return {}
        roles, method = handler
        if role not in roles:
            raise ValueError(f"`{action}` is not available to the {role} palette.")
        reply = method(self, data if data is not None else {})
        if action == "getContext" and role == WORKER:
            reply["apiKey"] = self.api_key
        return reply

    def _get_context(self, _data):
        context = dict(self._context())
        context["jobs"] = self.jobs()
        return context

    def _open_external(self, url):
        webbrowser.open(str(url))
        return {"success": True}

    def _log_message(self, message):
        self._log(f"[web] {message}")
        return {"success": True}

    def _get_document_info(self, _data):
        return document.document_info()

    def _export_body(self, data):
        return document.export_body(data.get("token"))

    def _enable_body_selection(self, _data):
        self._selection.enable()
        return {"success": True}

    def _disable_body_selection(self, _data):
        self._selection.disable()
        return {"success": True}

    def _set_api_key(self, data):
        self.api_key = data.get("apiKey") or None
        self._send(WORKER, "apiKeyChanged", {"apiKey": self.api_key})
        return {"success": True}

    def _list_runs(self, _data):
        return {"runs": sorted(self.runs.values(), key=lambda run: run.get("createdAt", ""), reverse=True)}

    def _save_run(self, data):
        update = data["run"]
        run = dict(self.runs.get(update.get("runId"), {"jobs": []}))
        for key in RUN_FIELDS:
            if key in update:
                run[key] = update[key]
        self._write(run)
        return {"run": run}

    def _delete_run(self, data):
        self._store.delete(data["runId"])
        self.runs.pop(data["runId"], None)
        return {"success": True}

    def _watch_job(self, data):
        job = self._merge(data["job"])
        self._send(WORKER, "watchJob", {"job": job})
        return {"job": job}

    def _retry_import(self, data):
        job = self._merge({"jobId": data["jobId"], "importStatus": None, "importError": None})
        self._send(WORKER, "watchJob", {"job": job})
        return {"job": job}

    def _job_update(self, data):
        job = self._merge(data["job"])
        self._send(MAIN, "jobUpdated", {"job": job})
        return {"job": job}

    def _import_begin(self, data):
        job_id = data["jobId"]
        self._update_import(job_id, "importing")
        try:
            session = importer.ImportSession(data, self._config)
            session.begin()
        except Exception as e:
            self._update_import(job_id, "failed", error=str(e))
            raise
        self.imports[data["importId"]] = session
        return {"success": True}

    def _import_action(self, data):
        session = self._session(data["importId"])
        try:
            sketched = session.add_action(data)
        except Exception as e:
            self.imports.pop(data["importId"], None)
            self._update_import(session.job_id, "failed", error=str(e))
            raise
        return {"sketched": sketched}

    def _import_end(self, data):
        session = self.imports.pop(data["importId"], None)
        if session is None:
            raise ValueError("That import is not in progress.")
        try:
            summary = session.end()
        except Exception as e:
            self._update_import(session.job_id, "failed", error=str(e))
            raise
        job = self._update_import(session.job_id, "imported", summary=summary)
        self._send(MAIN, "importCompleted", {"job": job, "summary": summary})
        return {"summary": summary}

    def _session(self, import_id):
        session = self.imports.get(import_id)
        if session is None:
            raise ValueError("That import is not in progress.")
        return session

    def jobs(self) -> list:
        return [job for run in self.runs.values() for job in run.get("jobs", [])]

    def _write(self, run: dict):
        run["updatedAt"] = datetime.now(timezone.utc).isoformat()
        self._store.save(run)
        self.runs[run["runId"]] = run

    def _merge(self, update: dict) -> dict:
        job_id = update.get("jobId")
        if not job_id:
            raise ValueError("A job needs a jobId.")
        run = next((r for r in self.runs.values() if any(j["jobId"] == job_id for j in r.get("jobs", []))), None)
        if run is None:
            run = self.runs.get(update.get("runId"))
            if run is None:
                raise ValueError("Save the job's run before watching it.")
            run = {**run, "jobs": [*run.get("jobs", []), {"jobId": job_id}]}
        jobs = run["jobs"]
        index = next(i for i, j in enumerate(jobs) if j["jobId"] == job_id)
        current = jobs[index]
        merged = dict(current)
        for key in JOB_FIELDS:
            if key in update:
                merged[key] = update[key]
        merged["runId"] = run["runId"]
        if current.get("status") in FINAL_STATUSES:
            merged["status"] = current["status"]
            merged["error"] = current.get("error")
        self._write({**run, "jobs": [*jobs[:index], merged, *jobs[index + 1 :]]})
        return merged

    def _update_import(self, job_id, status, *, error=None, summary=None):
        update = {"jobId": job_id, "importStatus": status, "importError": error}
        if summary is not None:
            update["importSummary"] = summary
        job = self._merge(update)
        self._send(MAIN, "jobUpdated", {"job": job})
        return job


_BOTH = (MAIN, WORKER)
_ACTIONS = {
    "getContext": (_BOTH, Router._get_context),
    "openExternal": (_BOTH, Router._open_external),
    "log": (_BOTH, Router._log_message),
    "getDocumentInfo": ((MAIN,), Router._get_document_info),
    "exportBody": ((MAIN,), Router._export_body),
    "enableBodySelection": ((MAIN,), Router._enable_body_selection),
    "disableBodySelection": ((MAIN,), Router._disable_body_selection),
    "setApiKey": ((MAIN,), Router._set_api_key),
    "listRuns": ((MAIN,), Router._list_runs),
    "saveRun": ((MAIN,), Router._save_run),
    "deleteRun": ((MAIN,), Router._delete_run),
    "watchJob": ((MAIN,), Router._watch_job),
    "retryImport": ((MAIN,), Router._retry_import),
    "jobUpdate": ((WORKER,), Router._job_update),
    "importBegin": ((WORKER,), Router._import_begin),
    "importAction": ((WORKER,), Router._import_action),
    "importEnd": ((WORKER,), Router._import_end),
}

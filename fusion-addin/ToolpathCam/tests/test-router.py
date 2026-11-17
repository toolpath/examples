import json

import pytest
from lib.router import MAIN, WORKER, Router
from lib.runs import RunStore

from lib import router as router_module


class FakeSelection:
    def __init__(self):
        self.active = False

    def enable(self):
        self.active = True

    def disable(self):
        self.active = False


class FakeSession:
    def __init__(self, begin, config):
        self.job_id = begin["jobId"]
        self.began = False
        self.actions = []

    def begin(self):
        self.began = True

    def add_action(self, data):
        self.actions.append(data)
        return 3

    def end(self):
        return {"setups": 1, "actions": len(self.actions)}


def make_router(directory, sent):
    return Router(
        send=lambda role, action, payload: sent.append((role, action, payload)) or True,
        context=lambda: {"version": "0.1.0", "apiUrl": "https://api.test"},
        config={},
        log=lambda message: None,
        store=RunStore(str(directory)),
        selection=FakeSelection(),
    )


@pytest.fixture
def setup(monkeypatch, tmp_path):
    monkeypatch.setattr(router_module.importer, "ImportSession", FakeSession)
    sent = []
    router = make_router(tmp_path, sent)
    call(router, MAIN, "saveRun", {"run": {"runId": "run-1", "createdAt": "2026-11-12T00:00:00Z", "bodyName": "Block"}})
    return router, sent


def call(router, role, action, data=None):
    return router.handle(role, action, json.dumps(data) if data is not None else "")


def job(**overrides):
    return {"jobId": "job-1", "runId": "run-1", "kind": "toolpaths", "status": "queued", **overrides}


def stored(router, job_id="job-1"):
    return next(j for j in router.jobs() if j["jobId"] == job_id)


def test_watch_job_registers_it_and_tells_the_worker(setup):
    router, sent = setup
    reply = call(router, MAIN, "watchJob", {"job": job()})
    assert reply["job"]["jobId"] == "job-1"
    assert sent == [(WORKER, "watchJob", {"job": stored(router)})]
    assert call(router, WORKER, "getContext")["jobs"] == [stored(router)]


def test_a_job_needs_a_saved_run(setup):
    router, _ = setup
    with pytest.raises(ValueError, match="Save the job's run"):
        call(router, MAIN, "watchJob", {"job": job(runId="unknown")})


def test_job_updates_go_to_the_main_palette_and_final_stays_final(setup):
    router, sent = setup
    call(router, MAIN, "watchJob", {"job": job()})
    call(router, WORKER, "jobUpdate", {"job": {"jobId": "job-1", "status": "succeeded", "progress": 100}})
    call(router, WORKER, "jobUpdate", {"job": {"jobId": "job-1", "status": "running", "secret": "x"}})
    assert stored(router)["status"] == "succeeded"
    assert "secret" not in stored(router)
    assert sent[-1][:2] == (MAIN, "jobUpdated")


def test_only_the_worker_gets_the_api_key(setup):
    router, sent = setup
    call(router, MAIN, "setApiKey", {"apiKey": "tp_test"})
    assert sent == [(WORKER, "apiKeyChanged", {"apiKey": "tp_test"})]
    assert call(router, WORKER, "getContext")["apiKey"] == "tp_test"
    assert "apiKey" not in call(router, MAIN, "getContext")


def test_actions_are_limited_to_their_palette(setup):
    router, _ = setup
    with pytest.raises(ValueError):
        call(router, MAIN, "importBegin", {"importId": "i", "jobId": "job-1"})
    with pytest.raises(ValueError):
        call(router, WORKER, "exportBody", {})
    assert call(router, MAIN, "someFusionHousekeeping") == {}


def test_an_import_runs_begin_actions_end(setup):
    router, sent = setup
    call(router, MAIN, "watchJob", {"job": job(status="succeeded")})
    call(router, WORKER, "importBegin", {"importId": "i", "jobId": "job-1"})
    assert stored(router)["importStatus"] == "importing"
    assert call(router, WORKER, "importAction", {"importId": "i", "setupIdx": 0, "actionIdx": 0}) == {"sketched": 3}
    assert call(router, WORKER, "importEnd", {"importId": "i"}) == {"summary": {"setups": 1, "actions": 1}}
    assert stored(router)["importStatus"] == "imported"
    assert sent[-1][:2] == (MAIN, "importCompleted")
    with pytest.raises(ValueError):
        call(router, WORKER, "importEnd", {"importId": "i"})


def test_a_failed_import_is_recorded(setup, monkeypatch):
    router, _ = setup

    class Failing(FakeSession):
        def begin(self):
            raise ValueError("Switch back to the design")

    monkeypatch.setattr(router_module.importer, "ImportSession", Failing)
    call(router, MAIN, "watchJob", {"job": job(status="succeeded")})
    with pytest.raises(ValueError):
        call(router, WORKER, "importBegin", {"importId": "i", "jobId": "job-1"})
    assert stored(router)["importStatus"] == "failed"
    assert stored(router)["importError"] == "Switch back to the design"


def test_runs_survive_a_restart_and_list_newest_first(setup, tmp_path):
    router, _ = setup
    call(router, MAIN, "saveRun", {"run": {"runId": "run-2", "createdAt": "2026-11-13T00:00:00Z", "bodyName": "Plate"}})
    call(router, MAIN, "watchJob", {"job": job(status="running")})

    restarted = make_router(tmp_path, [])
    runs = call(restarted, MAIN, "listRuns")["runs"]
    assert [run["runId"] for run in runs] == ["run-2", "run-1"]
    assert runs[1]["jobs"][0]["status"] == "running"
    assert call(restarted, WORKER, "getContext")["jobs"][0]["jobId"] == "job-1"

    call(restarted, MAIN, "deleteRun", {"runId": "run-1"})
    assert [run["runId"] for run in call(make_router(tmp_path, []), MAIN, "listRuns")["runs"]] == ["run-2"]


def test_saving_a_run_keeps_its_jobs_and_ignores_unknown_fields(setup):
    router, _ = setup
    call(router, MAIN, "watchJob", {"job": job()})
    run = call(router, MAIN, "saveRun", {"run": {"runId": "run-1", "partId": "part-1", "apiKey": "tp_x"}})["run"]
    assert run["partId"] == "part-1"
    assert "apiKey" not in run
    assert [j["jobId"] for j in run["jobs"]] == ["job-1"]


def test_run_ids_cannot_leave_the_folder(setup):
    router, _ = setup
    with pytest.raises(ValueError):
        call(router, MAIN, "saveRun", {"run": {"runId": "../escape"}})


def test_retry_import_clears_the_failure_and_tells_the_worker(setup):
    router, sent = setup
    call(router, MAIN, "watchJob", {"job": job(status="succeeded", importStatus="failed", importError="x")})
    call(router, MAIN, "retryImport", {"jobId": "job-1"})
    assert stored(router)["importStatus"] is None
    assert sent[-1] == (WORKER, "watchJob", {"job": stored(router)})


def test_body_selection_is_toggled_from_the_main_palette(setup):
    router, _ = setup
    call(router, MAIN, "enableBodySelection")
    assert router._selection.active
    call(router, MAIN, "disableBodySelection")
    assert not router._selection.active
    with pytest.raises(ValueError):
        call(router, WORKER, "enableBodySelection")

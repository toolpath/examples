import json
import os
from unittest import mock

import pytest

from lib import importer

BENCHMARK = os.path.join(os.path.dirname(__file__), "..", "..", "benchmarks", "two-setup-block")
CONFIG = {"max_sketch_points_per_action": 2000, "sketch_links": True}


def load(name):
    with open(os.path.join(BENCHMARK, name), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def design(fusion, monkeypatch):
    design = fusion.fusion.Design.return_value
    design.designType = fusion.fusion.DesignTypes.ParametricDesignType
    monkeypatch.setattr(importer.document, "design", lambda: design)
    monkeypatch.setattr(importer.document, "find_body", lambda token: f"body:{token}")
    fusion.core.Application.get.return_value.activeDocument.creationId = "doc-1"
    return design


def test_builds_stock_setups_and_sketches(fusion, design):
    session = importer.ImportSession(load("begin.json"), CONFIG)
    session.begin()
    sketched = [session.add_action(action) for action in load("actions.json")]
    summary = session.end()

    assert sketched == [6, 20, 0]
    assert summary == {
        "setups": 2,
        "actions": 3,
        "sketchLines": 26,
        "thinned": False,
        "warnings": [],
    }
    fusion.fusion.TemporaryBRepManager.get.return_value.createBox.assert_called_once()

    cam = fusion.cam.CAM.cast.return_value
    setup_inputs = cam.setups.createInput.return_value
    assert cam.setups.add.call_count == 2
    assert setup_inputs.parameters.itemByName.return_value.expression == "'axesZX'"


def test_refuses_another_document(fusion, design):
    fusion.core.Application.get.return_value.activeDocument.creationId = "another"
    with pytest.raises(ValueError, match="Switch back"):
        importer.ImportSession(load("begin.json"), CONFIG).begin()


def test_each_setup_gets_its_own_hidden_component_and_timeline_group(fusion, design):
    names = []
    occurrence = design.rootComponent.occurrences.addNewComponent.return_value
    type(occurrence.component).name = property(lambda self: None, lambda self, value: names.append(value))
    session = importer.ImportSession(load("begin.json"), CONFIG)
    session.begin()
    for action in load("actions.json"):
        session.add_action(action)
    session.end()

    assert names == [
        "Toolpath geometry: Do not edit: Toolpath 1 (+Z)",
        "Toolpath geometry: Do not edit: Toolpath 2 (-Z)",
    ]
    assert occurrence.isLightBulbOn is False
    groups = design.timeline.timelineGroups
    assert groups.add.call_count == 2
    assert groups.add.return_value.name == "TP Geometry: Toolpath 2 (-Z)"


def test_links_can_be_left_out(fusion, design):
    session = importer.ImportSession(load("begin.json"), {**CONFIG, "sketch_links": False})
    session.begin()
    assert session.add_action(load("actions.json")[0]) == 4


def test_stock_is_applied_after_the_setup_is_created(fusion, design):
    session = importer.ImportSession(load("begin.json"), CONFIG)
    session.begin()
    session.end()

    setup_input = fusion.cam.CAM.cast.return_value.setups.createInput.return_value
    # Never set on the input: Fusion refuses a solid-stock setup created without its solid.
    assert setup_input.stockMode is not fusion.cam.SetupStockModes.SolidStock
    setup = fusion.cam.CAM.cast.return_value.setups.add.return_value
    modes = [c.args for c in setup.parameters.itemByName.call_args_list]
    assert ("job_stockMode",) in modes and ("job_stockSolid",) in modes


def test_a_refused_setup_is_retried_plain_then_oriented(fusion, design):
    setups = fusion.cam.CAM.cast.return_value.setups
    calls = []

    def add(setup_input):
        calls.append(setup_input)
        if len(calls) == 1:
            raise RuntimeError("3 : Setup creation failed")
        return setups.add.return_value

    setups.add.side_effect = add
    session = importer.ImportSession(load("begin.json"), CONFIG)
    session.begin()
    session.end()

    assert len(calls) == 3
    assert session.end()["warnings"] == []


def test_a_setup_fusion_refuses_twice_names_the_setup(fusion, design):
    fusion.cam.CAM.cast.return_value.setups.add.side_effect = RuntimeError("3 : Setup creation failed")
    session = importer.ImportSession(load("begin.json"), CONFIG)
    session.begin()
    with pytest.raises(RuntimeError, match=r"Fusion refused Toolpath 1 \(\+Z\) \(3 : Setup creation failed\)"):
        session.add_action(load("actions.json")[0])


def test_a_design_without_a_cam_product_opens_manufacture_once(fusion, design):
    doc = fusion.core.Application.get.return_value.activeDocument
    calls = []

    def item_by_product_type(product_type):
        calls.append(product_type)
        if len(calls) == 1:
            raise RuntimeError("3 : failed to find product")
        return mock.sentinel.cam

    doc.products.itemByProductType.side_effect = item_by_product_type
    importer.ImportSession(load("begin.json"), CONFIG).begin()

    workspaces = fusion.core.Application.get.return_value.userInterface.workspaces
    workspaces.itemById.assert_called_with("CAMEnvironment")
    assert calls == ["CAMProductType", "CAMProductType"]

from unittest import mock

import pytest
from lib.selection import BodySelection

from lib import selection as selection_module


@pytest.fixture
def picker(fusion, monkeypatch):
    sent = []
    body = mock.Mock(entityToken="body-token")
    body.name = "Bracket"
    selected = {"body": None}
    monkeypatch.setattr(selection_module.document, "selected_body", lambda: selected["body"])
    return BodySelection(lambda action, payload: sent.append((action, payload))), sent, body, selected


def test_one_pick_then_done(fusion, picker):
    selection, sent, body, selected = picker
    selection.enable()
    selection.on_selection_changed()
    assert sent == []

    selected["body"] = body
    selection.on_selection_changed()
    assert sent == [("bodySelected", {"token": "body-token", "name": "Bracket"})]
    assert not selection.active

    selection.on_selection_changed()
    assert len(sent) == 1


def test_ignores_the_canvas_until_enabled(fusion, picker):
    selection, sent, body, selected = picker
    selected["body"] = body
    selection.on_selection_changed()
    assert sent == []


def test_body_priority_toggles_only_to_change_state(fusion, picker):
    selection, *_ = picker
    command = fusion.core.Application.get.return_value.userInterface.commandDefinitions.itemById.return_value
    selection.set_priority(True)
    selection.set_priority(True)
    selection.set_priority(False)
    selection.set_priority(False)
    assert command.execute.call_count == 2


def test_no_selections_while_documents_change(fusion, monkeypatch):
    from lib import document

    fusion.core.Application.get.return_value.userInterface.activeSelections = None
    assert document.selected_body() is None

"""Picking a body in the canvas, like a Fusion selection input: one pick, then done."""

import adsk.core

from . import document

PRIORITY_EVENT_ID = "ToolpathCamSelectionPriority"
PRIORITY_COMMAND_ID = "SelectBodyPriorityCommand"


class BodySelection:
    def __init__(self, send):
        """`send(action, payload)` pushes to the main palette."""
        self._send = send
        self.active = False
        self._priority_on = False

    def enable(self):
        self.active = True
        selections = adsk.core.Application.get().userInterface.activeSelections
        if selections is not None:
            selections.clear()
        self._request_priority(True)

    def disable(self):
        self.active = False
        self._request_priority(False)

    def on_selection_changed(self):
        if not self.active:
            return
        body = document.selected_body()
        if body is None:
            return
        self.active = False
        # Keep the body highlighted, as a Fusion selection input does.
        selections = adsk.core.Application.get().userInterface.activeSelections
        if selections is not None:
            selections.clear()
            selections.add(body)
        self._send("bodySelected", {"token": body.entityToken, "name": body.name})
        self._request_priority(False)

    def set_priority(self, enabled: bool):
        """Body priority, so a click picks the body rather than a face. Runs on the main thread."""
        if enabled == self._priority_on:
            return
        command = adsk.core.Application.get().userInterface.commandDefinitions.itemById(PRIORITY_COMMAND_ID)
        if command is None:
            return
        # The command toggles, so it runs only to change the state.
        command.execute()
        self._priority_on = enabled

    def _request_priority(self, enabled: bool):
        # Fusion won't run a command from inside a palette callback; a custom event runs it after.
        adsk.core.Application.get().fireCustomEvent(PRIORITY_EVENT_ID, "1" if enabled else "0")

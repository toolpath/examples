"""Toolpath CAM: an example Fusion add-in for Toolpath's CAM API."""

import json
import os
import sys
import threading
import time
import traceback

import adsk.core

# Fusion keeps an add-in's submodules loaded across Stop and Run; drop them so edits take effect.
for _module in [name for name in sys.modules if __package__ and name.startswith(f"{__package__}.lib")]:
    del sys.modules[_module]

from .lib import config as addin_config  # noqa: E402
from .lib import document, server  # noqa: E402
from .lib.router import MAIN, WORKER, Router  # noqa: E402
from .lib.runs import RunStore, default_directory  # noqa: E402
from .lib.selection import PRIORITY_EVENT_ID, BodySelection  # noqa: E402
from .lib.theme import get_theme  # noqa: E402

ADDIN_DIR = os.path.dirname(os.path.abspath(__file__))
CMD_ID = "ToolpathCamShowPanel"
CMD_NAME = "Toolpath CAM"
CMD_TOOLTIP = "Send a body to Toolpath, pick its machining directions and import the setups and toolpaths."
PALETTE_IDS = {MAIN: "ToolpathCamPalette", WORKER: "ToolpathCamWorker"}
# (workspace, tab, panel): a "Toolpath CAM" panel on Design's Solid tab and Manufacture's Milling tab.
PANELS = (
    ("FusionSolidEnvironment", "SolidTab", "ToolpathCamSolidPanel"),
    ("CAMEnvironment", "MillingTab", "ToolpathCamMillingPanel"),
)
THEME_EVENT_ID = "ToolpathCamThemePoll"
THEME_POLL_SECONDS = 2

# Fusion holds only weak references to handlers; keep them alive here.
_handlers = []
_palette_handlers = {}
# (event, handler) pairs on app-wide events, removed again in stop().
_app_events = []
_theme_poll_stop = threading.Event()
_router = None
_selection = None


def _log(message: str):
    try:
        adsk.core.Application.get().log(f"[Toolpath CAM] {message}")
    except Exception:
        print(f"[Toolpath CAM] {message}")


def _ui() -> adsk.core.UserInterface:
    return adsk.core.Application.get().userInterface


def _palette(role: str):
    return _ui().palettes.itemById(PALETTE_IDS[role])


def _panels(create: bool) -> list:
    panels = []
    for workspace_id, tab_id, panel_id in PANELS:
        workspace = _ui().workspaces.itemById(workspace_id)
        tab = workspace.toolbarTabs.itemById(tab_id) if workspace else None
        if tab is None:
            continue
        panel = tab.toolbarPanels.itemById(panel_id)
        if panel is None and create:
            panel = tab.toolbarPanels.add(panel_id, CMD_NAME)
        if panel is not None:
            panels.append(panel)
    return panels


def _palette_url(config: dict, role: str) -> str:
    base = config.get("app_url") or server.start(os.path.join(ADDIN_DIR, "web"), int(config["port"]))
    return f"{base.rstrip('/')}/?role={role}&_t={int(time.time() * 1000)}"


def _send(role: str, action: str, payload: dict) -> bool:
    palette = _palette(role)
    if palette is None and role == WORKER:
        palette = _open_worker()
    if palette is None:
        return False
    palette.sendInfoToHTML(action, json.dumps(payload))
    return True


def _context() -> dict:
    config = addin_config.load(ADDIN_DIR)
    return {
        "version": addin_config.version(ADDIN_DIR),
        "theme": get_theme(),
        "apiUrl": config["api_url"],
        "portalUrl": config["portal_url"],
        "document": document.document_info(),
    }


class _HTMLHandler(adsk.core.HTMLEventHandler):
    def __init__(self, role: str):
        super().__init__()
        self._role = role

    def notify(self, args):
        html_args = adsk.core.HTMLEventArgs.cast(args)
        try:
            args.returnData = json.dumps(_router.handle(self._role, html_args.action, html_args.data))
        except Exception as e:
            _log(f"{html_args.action} failed:\n{traceback.format_exc()}")
            args.returnData = json.dumps({"error": str(e)})


def _add_palette(role: str, url: str, config: dict):
    ui = _ui()
    if role == MAIN:
        # id, name, url, isVisible, showCloseButton, isResizable, width, height, useNewWebBrowser
        palette = ui.palettes.add(PALETTE_IDS[role], CMD_NAME, url, True, True, True, 420, 760, True)
        palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateRight
        palette.setMinimumSize(360, 480)
    else:
        palette = ui.palettes.add(PALETTE_IDS[role], f"{CMD_NAME} worker", url, False, False, False, 1, 1, True)
    palette.isDebuggingEnabled = bool(config.get("debug"))

    handler = _HTMLHandler(role)
    palette.incomingFromHTML.add(handler)
    _palette_handlers[role] = handler
    return palette


def _open_worker():
    config = addin_config.load(ADDIN_DIR)
    try:
        return _add_palette(WORKER, _palette_url(config, WORKER), config)
    except OSError:
        _log(f"Could not start the local web server for the worker:\n{traceback.format_exc()}")
        return None


def _show_palette():
    palette = _palette(MAIN)
    if palette:
        palette.isVisible = True
        return

    config = addin_config.load(ADDIN_DIR)
    try:
        url = _palette_url(config, MAIN)
    except OSError as e:
        _ui().messageBox(
            f"Toolpath CAM could not start its local web server on port {config['port']}.\n\n{e}\n\n"
            "Close anything else using that port, or change `port` in config.json "
            "(and the allowed origin on your Toolpath API key to match)."
        )
        return
    _add_palette(MAIN, url, config)
    if _palette(WORKER) is None:
        _open_worker()


class _DocumentHandler(adsk.core.DocumentEventHandler):
    def notify(self, args):
        # The export's scratch document fires these too.
        if document.is_exporting():
            return
        try:
            _send(MAIN, "documentChanged", document.document_info())
        except Exception:
            _log(traceback.format_exc())


class _SelectionHandler(adsk.core.ActiveSelectionEventHandler):
    def notify(self, args):
        if document.is_exporting() or _selection is None:
            return
        try:
            _selection.on_selection_changed()
        except Exception:
            _log(traceback.format_exc())


class _SelectionPriorityHandler(adsk.core.CustomEventHandler):
    def notify(self, args):
        try:
            _selection.set_priority(adsk.core.CustomEventArgs.cast(args).additionalInfo == "1")
        except Exception:
            _log(traceback.format_exc())


# Fusion has no theme-changed event; a thread fires this, which runs on the main thread.
class _ThemePollHandler(adsk.core.CustomEventHandler):
    def __init__(self):
        super().__init__()
        self._last = None

    def notify(self, args):
        try:
            theme = get_theme()
            if theme != self._last and _send(MAIN, "themeChanged", {"theme": theme}):
                self._last = theme
        except Exception:
            _log(traceback.format_exc())


def _poll_theme():
    app = adsk.core.Application.get()
    while not _theme_poll_stop.wait(THEME_POLL_SECONDS):
        app.fireCustomEvent(THEME_EVENT_ID)


class _CommandExecuteHandler(adsk.core.CommandEventHandler):
    def notify(self, args):
        try:
            _show_palette()
        except Exception:
            _ui().messageBox(f"Toolpath CAM failed to open:\n{traceback.format_exc()}")


class _CommandCreatedHandler(adsk.core.CommandCreatedEventHandler):
    def __init__(self):
        super().__init__()
        self._on_execute = _CommandExecuteHandler()

    def notify(self, args):
        command = adsk.core.CommandCreatedEventArgs.cast(args).command
        command.execute.add(self._on_execute)
        command.isAutoExecute = True


def run(context):
    global _router, _selection
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        config = addin_config.load(ADDIN_DIR)
        store = RunStore(config.get("runs_dir") or default_directory())
        _selection = BodySelection(lambda action, payload: _send(MAIN, action, payload))
        _router = Router(send=_send, context=_context, config=config, log=_log, store=store, selection=_selection)

        # Recreated on every run, so a definition left by an earlier run can't keep stale icons.
        existing = ui.commandDefinitions.itemById(CMD_ID)
        if existing:
            existing.deleteMe()
        cmd_def = ui.commandDefinitions.addButtonDefinition(
            CMD_ID, CMD_NAME, CMD_TOOLTIP, os.path.join(ADDIN_DIR, "resources", "logo")
        )
        on_created = _CommandCreatedHandler()
        cmd_def.commandCreated.add(on_created)
        _handlers.append(on_created)

        for panel in _panels(create=True):
            if not panel.controls.itemById(CMD_ID):
                panel.controls.addCommand(cmd_def).isPromoted = True

        theme_event = app.registerCustomEvent(THEME_EVENT_ID)
        priority_event = app.registerCustomEvent(PRIORITY_EVENT_ID)
        _theme_poll_stop.clear()
        threading.Thread(target=_poll_theme, name="ToolpathCamThemePoll", daemon=True).start()

        for event, handler in (
            (theme_event, _ThemePollHandler()),
            (priority_event, _SelectionPriorityHandler()),
            (app.documentActivated, _DocumentHandler()),
            (app.documentSaved, _DocumentHandler()),
            (ui.activeSelectionChanged, _SelectionHandler()),
        ):
            event.add(handler)
            _app_events.append((event, handler))

        _open_worker()
    except Exception:
        adsk.core.Application.get().userInterface.messageBox(f"Toolpath CAM failed to start:\n{traceback.format_exc()}")


def _attempt(step):
    try:
        step()
    except Exception:
        _log(traceback.format_exc())


def _delete_palettes():
    for role in (MAIN, WORKER):
        palette = _palette(role)
        if palette:
            palette.deleteMe()


def _delete_command():
    for panel in _panels(create=False):
        panel.deleteMe()
    cmd_def = _ui().commandDefinitions.itemById(CMD_ID)
    if cmd_def:
        cmd_def.deleteMe()


def _remove_events():
    _theme_poll_stop.set()
    for event, handler in _app_events:
        event.remove(handler)
    _app_events.clear()
    if _selection is not None:
        _selection.set_priority(False)
    adsk.core.Application.get().unregisterCustomEvent(THEME_EVENT_ID)
    adsk.core.Application.get().unregisterCustomEvent(PRIORITY_EVENT_ID)


def stop(context):
    global _router, _selection
    # Each step on its own, so one failure doesn't leave the button or events behind.
    _attempt(_delete_palettes)
    _attempt(server.stop)
    _attempt(_delete_command)
    _attempt(_remove_events)
    _handlers.clear()
    _palette_handlers.clear()
    _router = None
    _selection = None

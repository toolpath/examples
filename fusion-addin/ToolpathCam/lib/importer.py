"""Builds CAM results into the open design, grouped the way Toolpath's Fusion add-in groups them.

Each setup gets a hidden component, "Toolpath geometry: Do not edit: <setup>", holding its
WCS sketch and one sketch per toolpath (the first also holds the stock), a Manufacture setup,
and, in parametric designs, a timeline group "TP Geometry: <setup>".

The API returns toolpaths as points, not Fusion operations, so the setups have no operations.
"""

import adsk.cam
import adsk.core
import adsk.fusion

from . import document, plan

WCS_SKETCH = "WCS Sketch (Toolpath)"
TIMELINE_GROUP = "TP Geometry"


def _point(p) -> adsk.core.Point3D:
    return adsk.core.Point3D.create(p[0], p[1], p[2])


def _vector(v) -> adsk.core.Vector3D:
    return adsk.core.Vector3D.create(v[0], v[1], v[2])


def _cam(doc) -> adsk.cam.CAM:
    product = document.product(doc, "CAMProductType")
    if product is None:
        # A design gets its CAM product the first time Manufacture opens on it.
        ui = adsk.core.Application.get().userInterface
        design_ws = ui.activeWorkspace
        ui.workspaces.itemById("CAMEnvironment").activate()
        product = document.product(doc, "CAMProductType")
        if design_ws is not None:
            design_ws.activate()
    cam = adsk.cam.CAM.cast(product) if product else None
    if cam is None:
        raise RuntimeError("Fusion could not open the Manufacture workspace for this design.")
    return cam


class _BuiltSetup:
    def __init__(self, occurrence):
        self.occurrence = occurrence
        self.component = occurrence.component
        self.last = None


class ImportSession:
    def __init__(self, begin: dict, config: dict):
        self.job_id = begin["jobId"]
        self._begin = begin
        self._max_points = int(config["max_sketch_points_per_action"])
        self._sketch_links = bool(config["sketch_links"])
        self._setups = plan.plan_setups(begin)
        self._stock = plan.stock_solid(begin.get("stock"))
        self._position = {s["idx"]: i for i, s in enumerate(self._setups)}
        self._names = {(s["idx"], a["idx"]): a["name"] for s in self._setups for a in s["actions"]}
        self._built = []
        self._lines = 0
        self._actions = 0
        self._thinned = False
        self.warnings = []

    def begin(self):
        app = adsk.core.Application.get()
        doc = app.activeDocument
        document_id = self._begin.get("documentId")
        if doc is None or (document_id and doc.creationId != document_id):
            raise ValueError("Switch back to the design the part was sent from, then import again.")
        self._design = document.design()
        self._body = document.find_body(self._begin["bodyToken"])
        self._cam = _cam(doc)

    def add_action(self, data: dict) -> int:
        name = self._names.get((data["setupIdx"], data["actionIdx"]))
        if name is None:
            return 0
        # Setups are built in order as their toolpaths arrive, so each one's timeline items stay together.
        built = self._build_through(self._position[data["setupIdx"]])
        self._actions += 1
        toolpath = data.get("toolpath")
        runs = plan.toolpath_runs(toolpath, self._max_points)
        points_in = len((toolpath or {}).get("points") or []) // 3
        if sum(len(r["points"]) for r in runs) < points_in * 0.5:
            self._thinned = True
        if not self._sketch_links:
            runs = [r for r in runs if r["kind"] != "link"]
        if not runs:
            return 0

        sketch = built.component.sketches.add(built.component.xYConstructionPlane)
        sketch.name = name
        sketch.isComputeDeferred = True
        drawn = 0
        try:
            lines = sketch.sketchCurves.sketchLines
            for run in runs:
                points = run["points"]
                previous = None
                for i in range(1, len(points)):
                    start = previous.endSketchPoint if previous else _point(points[0])
                    line = lines.addByTwoPoints(start, _point(points[i]))
                    if run["kind"] == "link":
                        line.isConstruction = True
                    previous = line
                    drawn += 1
        finally:
            sketch.isComputeDeferred = False
        built.last = sketch
        self._lines += drawn
        return drawn

    def end(self) -> dict:
        self._build_through(len(self._setups) - 1)
        if self._design.designType == adsk.fusion.DesignTypes.ParametricDesignType:
            for planned, built in zip(self._setups, self._built):
                self._group_on_timeline(planned, built)
        return {
            "setups": len(self._setups),
            "actions": self._actions,
            "sketchLines": self._lines,
            "thinned": self._thinned,
            "warnings": self.warnings,
        }

    def _build_through(self, position: int):
        while len(self._built) <= position:
            self._built.append(self._build(self._setups[len(self._built)], first=not self._built))
        return self._built[position] if position >= 0 else None

    def _build(self, planned: dict, *, first: bool) -> _BuiltSetup:
        occurrence = self._design.rootComponent.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        occurrence.component.name = planned["component"]
        occurrence.isGroundToParent = False
        occurrence.isLightBulbOn = False
        built = _BuiltSetup(occurrence)
        stock_body = self._add_stock(built) if first and self._stock else None
        self._add_setup(built, planned, stock_body)
        return built

    def _group_on_timeline(self, planned: dict, built: _BuiltSetup):
        try:
            start = built.occurrence.timelineObject.index
            end = built.last.timelineObject.index
            self._design.timeline.timelineGroups.add(start, end).name = f"{TIMELINE_GROUP}: {planned['name']}"
        except Exception:
            # Grouping is tidying only; a group already in the way leaves the timeline as it is.
            pass

    def _add_stock(self, built: _BuiltSetup):
        manager = adsk.fusion.TemporaryBRepManager.get()
        stock = self._stock
        if stock["kind"] == "box":
            box = adsk.core.OrientedBoundingBox3D.create(
                _point(stock["center"]),
                _vector(stock["lengthDirection"]),
                _vector(stock["widthDirection"]),
                stock["length"],
                stock["width"],
                stock["height"],
            )
            solid = manager.createBox(box)
        else:
            solid = manager.createCylinderOrCone(
                _point(stock["base"]), stock["radius"], _point(stock["top"]), stock["radius"]
            )

        bodies = built.component.bRepBodies
        if self._design.designType == adsk.fusion.DesignTypes.ParametricDesignType:
            base = built.component.features.baseFeatures.add()
            base.startEdit()
            try:
                body = bodies.add(solid, base)
            finally:
                base.finishEdit()
        else:
            body = bodies.add(solid)
        body.name = "Stock"
        return body.createForAssemblyContext(built.occurrence)

    def _add_setup(self, built: _BuiltSetup, planned: dict, stock_body):
        # Fusion sets a WCS from geometry, so the axes are construction lines.
        sketch = built.component.sketches.add(built.component.xYConstructionPlane)
        sketch.name = WCS_SKETCH
        lines = sketch.sketchCurves.sketchLines
        z_line = lines.addByTwoPoints(_point((0, 0, 0)), _point(planned["z"]))
        x_line = lines.addByTwoPoints(z_line.startSketchPoint, _point(planned["x"]))
        z_line.isConstruction = True
        x_line.isConstruction = True
        built.last = sketch

        cam = self._cam
        z_axis = z_line.createForAssemblyContext(built.occurrence)
        x_axis = x_line.createForAssemblyContext(built.occurrence)
        try:
            setup = cam.setups.add(_setup_input(cam, planned, self._body, (z_axis, x_axis)))
        except Exception as oriented:
            # Fusion refuses some setups at creation; a plain one, oriented afterwards, often goes through.
            try:
                setup = cam.setups.add(_setup_input(cam, planned, self._body, None))
            except Exception:
                raise RuntimeError(f"Fusion refused {planned['name']} ({oriented}).") from oriented
            self._try(planned, "orient the WCS", lambda: _orient(setup.parameters, z_axis, x_axis))

        # Stock goes on after creation: a setup created as solid stock without its solid is refused.
        if planned["stock"] == "solid" and stock_body is not None:
            self._try(planned, "use the stock body", lambda: _solid_stock(setup, stock_body))
        elif planned["stock"] == "previous":
            self._try(planned, "continue from the previous setup's stock", lambda: _previous_stock(setup))
        self._try(planned, "put the WCS origin on the stock", lambda: _origin_on_stock(setup))
        return setup

    def _try(self, planned, what, step):
        try:
            step()
        except Exception as e:
            self.warnings.append(f"{planned['name']}: could not {what} ({e}).")


def _setup_input(cam, planned: dict, body, axes):
    setup_input = cam.setups.createInput(adsk.cam.OperationTypes.MillingOperation)
    setup_input.models = [body]
    setup_input.name = planned["name"]
    if axes is not None:
        _orient(setup_input.parameters, *axes)
    return setup_input


def _orient(parameters, z_axis, x_axis):
    parameters.itemByName("wcs_orientation_mode").expression = "'axesZX'"
    _set_geometry(parameters, "wcs_orientation_axisZ", z_axis)
    _set_geometry(parameters, "wcs_orientation_axisX", x_axis)


def _solid_stock(setup, stock_body):
    setup.parameters.itemByName("job_stockMode").expression = "'solid'"
    _set_geometry(setup.parameters, "job_stockSolid", stock_body)


def _previous_stock(setup):
    setup.parameters.itemByName("job_stockMode").expression = "'previoussetup'"


def _set_geometry(parameters, name: str, entity):
    value = adsk.cam.CadObjectParameterValue.cast(parameters.itemByName(name).value)
    entities = value.value
    entities.append(entity)
    value.value = entities


def _origin_on_stock(setup):
    setup.parameters.itemByName("wcs_origin_mode").expression = "'stockPoint'"
    setup.parameters.itemByName("wcs_origin_boxPoint").expression = "'top center'"

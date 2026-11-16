"""Reads the active document, selects bodies and exports them as STEP."""

import base64
import os
import tempfile

import adsk.core
import adsk.fusion


def _app() -> adsk.core.Application:
    return adsk.core.Application.get()


def product(doc, product_type: str):
    """The document's product of a type, or None: Fusion raises rather than returning None for a missing one."""
    try:
        return doc.products.itemByProductType(product_type)
    except RuntimeError:
        return None


def _design():
    # From the document, so it works in Manufacture too.
    doc = _app().activeDocument
    if doc is None:
        return None
    found = product(doc, "DesignProductType")
    return adsk.fusion.Design.cast(found) if found else None


def design() -> adsk.fusion.Design:
    found = _design()
    if found is None:
        raise ValueError("Open a design to work on.")
    return found


def _body_path(body: adsk.fusion.BRepBody) -> str:
    occ = body.assemblyContext
    if occ is None:
        return body.name
    return f"{occ.fullPathName.replace('+', ' / ')} / {body.name}"


def _all_solid_bodies(design: adsk.fusion.Design):
    root = design.rootComponent
    for body in root.bRepBodies:
        if body.isSolid:
            yield body
    for occ in root.allOccurrences:
        for body in occ.bRepBodies:
            if body.isSolid:
                yield body


def selected_body():
    # A selected face or edge counts as its body.
    selections = _app().userInterface.activeSelections
    # None while documents open or close.
    if selections is None:
        return None
    for i in range(selections.count):
        entity = selections.item(i).entity
        body = adsk.fusion.BRepBody.cast(entity)
        if body is None:
            face = adsk.fusion.BRepFace.cast(entity)
            edge = adsk.fusion.BRepEdge.cast(entity)
            body = face.body if face else edge.body if edge else None
        if body is not None and body.isSolid:
            return body
    return None


def selected_body_token():
    body = selected_body()
    return body.entityToken if body else None


def document_info() -> dict:
    app = _app()
    doc = app.activeDocument
    design = _design()
    if doc is None:
        return {"hasDocument": False}

    info = {
        "hasDocument": True,
        "id": doc.creationId,
        "name": doc.name,
        "isDesign": design is not None,
        "units": None,
        "bodies": [],
        "selectedBodyToken": None,
    }
    if design is None:
        return info

    info["units"] = design.unitsManager.defaultLengthUnits
    info["bodies"] = [
        {
            "token": body.entityToken,
            "name": body.name,
            "path": _body_path(body),
            "isVisible": body.isVisible,
        }
        for body in _all_solid_bodies(design)
    ]
    info["selectedBodyToken"] = selected_body_token()
    return info


def find_body(token: str) -> adsk.fusion.BRepBody:
    design = _design()
    if design is None:
        raise ValueError("Open the design the part came from to import its results.")
    return _find_body(design, token)


def _find_body(design: adsk.fusion.Design, token: str) -> adsk.fusion.BRepBody:
    found = design.findEntityByToken(token)
    for entity in found or []:
        body = adsk.fusion.BRepBody.cast(entity)
        if body is not None:
            return body
    raise ValueError("That body no longer exists. Refresh the body list and try again.")


def _world_copy(body: adsk.fusion.BRepBody) -> adsk.fusion.BRepBody:
    """A temporary copy placed where the body sits in the assembly."""
    manager = adsk.fusion.TemporaryBRepManager.get()
    native = body.nativeObject or body
    copy = manager.copy(native)
    occ = body.assemblyContext
    if occ is not None:
        manager.transform(copy, occ.transform2)
    return copy


def _safe_name(name: str) -> str:
    cleaned = "".join(c if c.isalnum() or c in "-_ " else "_" for c in name).strip()
    return cleaned or "part"


# True while the export's scratch document is open.
_exporting = False


def is_exporting() -> bool:
    return _exporting


def _write_step(body: adsk.fusion.BRepBody, path: str):
    # STEP export takes a whole component, so the body goes through a scratch document.
    global _exporting
    app = _app()
    original = app.activeDocument
    copy = _world_copy(body)

    _exporting = True
    scratch = None
    try:
        scratch = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(scratch.products.itemByProductType("DesignProductType"))
        design.designType = adsk.fusion.DesignTypes.DirectDesignType
        root = design.rootComponent
        root.bRepBodies.add(copy).name = body.name
        try:
            root.name = body.name
        except Exception:
            pass

        exporter = design.exportManager
        if not exporter.execute(exporter.createSTEPExportOptions(path, root)):
            raise RuntimeError("Fusion could not export the body as STEP.")
    finally:
        if scratch is not None:
            scratch.close(False)
        if original is not None and app.activeDocument != original:
            original.activate()
        _exporting = False


def export_body(token) -> dict:
    design = _design()
    if design is None:
        raise ValueError("Open a design to send a body to Toolpath.")

    if token:
        body = _find_body(design, token)
    else:
        visible = [b for b in _all_solid_bodies(design) if b.isVisible]
        if len(visible) != 1:
            raise ValueError("Pick which body to send to Toolpath.")
        body = visible[0]

    fd, path = tempfile.mkstemp(suffix=".step")
    os.close(fd)
    try:
        _write_step(body, path)
        with open(path, "rb") as f:
            data = f.read()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass

    return {
        "fileName": f"{_safe_name(body.name)}.step",
        "bodyName": body.name,
        "bodyToken": body.entityToken,
        "size": len(data),
        "data": base64.b64encode(data).decode("ascii"),
    }

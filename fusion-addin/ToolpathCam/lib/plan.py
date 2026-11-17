"""Turns Toolpath CAM results into a Fusion import plan. Pure Python; lengths out are cm."""

import math

MM_TO_CM = 0.1

CUT_KINDS = frozenset({"Cutting"})
LEAD_KINDS = frozenset({"LeadIn", "LeadOut"})

AXIS_EPSILON = 1e-9


def _vec(v) -> tuple:
    return (float(v["x"]), float(v["y"]), float(v["z"]))


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _scale(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _normalize(a):
    length = math.sqrt(_dot(a, a))
    if length < AXIS_EPSILON:
        raise ValueError("A direction must not be the zero vector.")
    return _scale(a, 1.0 / length)


def _rounded(a, digits=9):
    return [round(c, digits) + 0.0 for c in a]


def direction_label(direction) -> str:
    """`+Z` for an axis, otherwise the components; matches `@toolpath/viewer`."""
    v = _vec(direction)
    non_zero = [(name, value) for name, value in zip("XYZ", v) if abs(value) > 1e-6]
    if len(non_zero) == 1 and abs(abs(non_zero[0][1]) - 1) < 1e-6:
        name, value = non_zero[0]
        return f"{'+' if value > 0 else '-'}{name}"
    return ", ".join(f"{c:.3f}".rstrip("0").rstrip(".") for c in v)


def setup_axes(direction, reference=None) -> dict:
    """WCS axes: Z is the direction the tool comes from, X the reference (or world X/Y) squared to Z."""
    z = _normalize(_vec(direction))
    candidates = []
    if reference is not None:
        candidates.append(_vec(reference))
    candidates += [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
    for candidate in candidates:
        projected = _sub(candidate, _scale(z, _dot(candidate, z)))
        if math.sqrt(_dot(projected, projected)) > 0.1:
            x = _normalize(projected)
            return {"z": _rounded(z), "x": _rounded(x)}
    raise ValueError("No X axis found for the setup.")


def stock_solid(resolved) -> dict | None:
    """The starting stock as a solid to model, or None (none resolved, or cut from another body)."""
    if not resolved:
        return None
    shape = resolved.get("shape")
    if shape == "box":
        frame = resolved["frame"]
        origin = _vec(frame["location"])
        axis = _normalize(_vec(frame["axis"]))
        ref = _normalize(_vec(frame["refDirection"]))
        y_dir = _cross(axis, ref)
        lower, upper = _vec(resolved["lower"]), _vec(resolved["upper"])
        mid = _scale(_add(lower, upper), 0.5)
        center = _add(_add(_add(origin, _scale(ref, mid[0])), _scale(y_dir, mid[1])), _scale(axis, mid[2]))
        return {
            "kind": "box",
            "center": _rounded(_scale(center, MM_TO_CM)),
            "lengthDirection": _rounded(ref),
            "widthDirection": _rounded(y_dir),
            "length": round((upper[0] - lower[0]) * MM_TO_CM, 9),
            "width": round((upper[1] - lower[1]) * MM_TO_CM, 9),
            "height": round((upper[2] - lower[2]) * MM_TO_CM, 9),
        }
    if shape == "cylinder":
        base = _vec(resolved["origin"])
        axis = _normalize(_vec(resolved["axis"]))
        top = _add(base, _scale(axis, float(resolved["length"])))
        return {
            "kind": "cylinder",
            "base": _rounded(_scale(base, MM_TO_CM)),
            "top": _rounded(_scale(top, MM_TO_CM)),
            "radius": round(float(resolved["diameter"]) * 0.5 * MM_TO_CM, 9),
        }
    return None


def stock_reference(resolved):
    if resolved and resolved.get("shape") == "box":
        return resolved["frame"]["refDirection"]
    return None


def plan_setups(begin: dict) -> list:
    reference = stock_reference(begin.get("stock"))
    has_stock = stock_solid(begin.get("stock")) is not None
    planned = []
    for setup in begin["setups"]:
        direction = setup.get("direction")
        if direction is None:
            continue
        number = len(planned) + 1
        axes = setup_axes(direction, reference if number == 1 else None)
        name = f"Toolpath {number} ({direction_label(direction)})"
        planned.append(
            {
                "idx": setup["idx"],
                "name": name,
                # Named as Toolpath's Fusion add-in names its per-setup geometry.
                "component": f"Toolpath geometry: Do not edit: {name}",
                "z": axes["z"],
                "x": axes["x"],
                "stock": ("solid" if has_stock else "default") if number == 1 else "previous",
                "actions": [
                    {"idx": action["idx"], "name": action_name(number, i + 1, action)}
                    for i, action in enumerate(setup.get("actions", []))
                ],
            }
        )
    return planned


def action_name(setup_number: int, action_number: int, action: dict) -> str:
    """e.g. "T1.2 Roughing · 12.7 mm flat endmill · 3:05"."""
    parts = [f"T{setup_number}.{action_number} {_intent_label(action.get('intent'))}"]
    if action.get("toolName"):
        parts.append(str(action["toolName"]))
    seconds = action.get("machiningTime")
    if isinstance(seconds, (int, float)):
        minutes, rest = divmod(int(round(seconds)), 60)
        parts.append(f"{minutes}:{rest:02d}")
    return " · ".join(parts)


def _intent_label(intent) -> str:
    if not intent:
        return "Action"
    words = []
    for ch in str(intent):
        if ch.isupper() and words:
            words.append(" ")
        words.append(ch.lower() if words else ch)
    return "".join(words)


def _kind_bucket(kind) -> str:
    if kind in CUT_KINDS:
        return "cut"
    if kind in LEAD_KINDS:
        return "lead"
    return "link"


def toolpath_runs(toolpath, max_points: int) -> list:
    """Polylines (cm) per run of cut, lead or link moves, thinned to about `max_points` points."""
    if not toolpath:
        return []
    flat = toolpath.get("points") or []
    count = len(flat) // 3
    sections = toolpath.get("sections")
    if sections is None:
        sections = toolpath.get("segments") or []

    runs = []
    for section in sections:
        start, end = max(0, int(section["start"])), min(count, int(section["end"]))
        if end - start < 1:
            continue
        bucket = _kind_bucket(section.get("kind"))
        points = [tuple(flat[i * 3 : i * 3 + 3]) for i in range(start, end)]
        if runs and runs[-1]["kind"] == bucket:
            previous = runs[-1]["points"]
            runs[-1]["points"] = previous + (points[1:] if points[0] == previous[-1] else points)
        else:
            runs.append({"kind": bucket, "points": points})

    for run in runs:
        run["points"] = _dedupe(run["points"])
    runs = [run for run in runs if len(run["points"]) >= 2]

    total = sum(len(run["points"]) for run in runs)
    stride = max(1, math.ceil(total / max_points)) if max_points > 0 else 1
    for run in runs:
        points = run["points"]
        if stride > 1:
            points = points[::stride] if (len(points) - 1) % stride == 0 else points[::stride] + [points[-1]]
        run["points"] = [_rounded(_scale(p, MM_TO_CM)) for p in points]
    return runs


def _dedupe(points):
    kept = [points[0]]
    for p in points[1:]:
        if p != kept[-1]:
            kept.append(p)
    return kept


def import_plan(begin: dict, actions: list, max_points: int) -> dict:
    """The whole import as data, from an `importBegin` payload and its `importAction` payloads."""
    setups = plan_setups(begin)
    by_key = {(a["setupIdx"], a["actionIdx"]): a for a in actions}
    for setup in setups:
        for action in setup["actions"]:
            payload = by_key.get((setup["idx"], action["idx"]))
            action["runs"] = toolpath_runs(payload.get("toolpath") if payload else None, max_points)
    return {"stock": stock_solid(begin.get("stock")), "setups": setups}

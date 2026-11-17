---
name: test-addin
description: Run the Fusion add-in's type, lint and test checks. Use after any change to src/, tests/ or ToolpathCam/.
---

# Check the add-in

From the repository root:

1. `pnpm --filter @toolpath/example-fusion-addin check-types`
2. `pnpm --filter @toolpath/example-fusion-addin lint`: ruff on `ToolpathCam` and `bin` (needs uv).
3. `pnpm exec eslint fusion-addin --max-warnings=0`
4. `pnpm --filter @toolpath/example-fusion-addin test`: vitest, then pytest (needs uv).
5. `pnpm --filter @toolpath/example-fusion-addin build` when `src/` changed.

Report each as ✓ passed, ✗ failed (with its output) or ⊘ skipped (with the reason). These run with a fake `adsk`,
so they don't show that Fusion accepts the calls. Say so, and suggest `install-addin` for anything that touches
`importer.py`, `document.py` or `ToolpathCam.py`.

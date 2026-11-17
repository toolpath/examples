---
name: test-import
description: Diff the add-in's import plan against its benchmarks. Use after changing ToolpathCam/lib/plan.py, importer.py or the import messages.
---

# Check the import plan

1. For each directory in `benchmarks/`, run `bin/run-import.py benchmarks/<name> --check`.
2. If it fails, report the error and stop.
3. If it shows a diff, summarize it for the user:
   - Expected: names, or the effects of the change they asked for.
   - Flag: anything else that moves stock, setup axes or toolpath points. These move geometry in Fusion.
4. Update a baseline (`--update`) only after the user accepts the diff.

The plan shows what the importer is asked to build, not what Fusion makes of it. For that, use `install-addin`.

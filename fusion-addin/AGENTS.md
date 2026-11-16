# Toolpath CAM Fusion add-in

A boilerplate Fusion add-in for Toolpath's CAM API. Read [README.md](README.md) first.

## How it fits together

- `ToolpathCam/ToolpathCam.py` opens two palettes from one web build, served on `http://localhost:<port>`:
  `?role=main` (the panel) and `?role=worker` (hidden, open from start-up).
- The palettes call the Toolpath API directly. They never talk to each other: each sends actions to
  `lib/router.py`, which relays to the other palette. The message types live in `src/fusion/protocol.ts`.
- The worker polls jobs (`src/api/poll.ts`) and imports results through `importBegin`, one `importAction` per
  action, then `importEnd`.
- `lib/plan.py` turns results into an import plan with no Fusion API calls. `lib/importer.py` builds that plan in Fusion.

## Rules

- Change `router.py` and `protocol.ts` together.
- The API speaks mm; Fusion's API speaks cm. Convert only in `plan.py`.
- Send directions back to the API exactly as served. Never recompute them.
- Never log or persist the API key. Python keeps it in memory only, for the worker.
- Runs (`lib/runs.py`) hold ids and statuses only: no CAD content, keys or presigned URLs. Python accepts only the
  fields in `RUN_FIELDS` and `JOB_FIELDS`.
- Use kebab-case for every file except the add-in folder, `ToolpathCam/`, whose name Fusion shows (its `.py` and
  `.manifest` must match it). Python modules are single words, so they stay importable.
- Never edit `ToolpathCam/web/`: `pnpm build` writes it.
- Don't claim an import change works until its benchmark diff has been reviewed (`test-import`).

## Skills

| Skill           | Use it to                                                          |
| --------------- | ------------------------------------------------------------------ |
| `test-addin`    | run the type, lint and test checks after any change                |
| `test-import`   | diff the import plan against the benchmarks after an import change |
| `install-addin` | build the add-in and link it into Fusion to try it                 |

Each skill is in `.claude/skills/<name>/SKILL.md` and, for other agents, `.agents/skills/<name>/SKILL.md`. If your
tool can't see them, look in the other folder and offer to copy them.

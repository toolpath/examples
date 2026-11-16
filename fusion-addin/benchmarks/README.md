# Benchmarks

Each directory holds the messages the worker sends when it imports a job, plus the import plan they should produce:

| File            |                                                               |
| --------------- | ------------------------------------------------------------- |
| `begin.json`    | the `importBegin` payload: setups, actions and stock          |
| `actions.json`  | the `importAction` payloads: each action's toolpath file      |
| `expected.json` | `lib/plan.py`'s import plan, in cm: what `importer.py` builds |

```sh
bin/run-import.py benchmarks/<name>            # print the plan
bin/run-import.py benchmarks/<name> --check    # diff against expected.json
bin/run-import.py benchmarks/<name> --update   # accept the new plan
```

Runs use `--max-points 10` so thinning shows up. `two-setup-block` is synthetic, shaped to the API contract. To add a
real benchmark, save a job's `importBegin` and `importAction` messages with the palette's web inspector (`debug: true`),
then run `--update` and review the plan.

Before you `--update`, read the diff. A change to stock, axes or point coordinates moves geometry in Fusion.

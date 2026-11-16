# Toolpath examples

Small, runnable examples for the [Toolpath API](https://developers.toolpath.com/) and the
Toolpath packages published from [toolpath/ui-packages](https://github.com/toolpath/ui-packages).

| Example                          | What it shows                                                                                                                                                           | Needs an API key |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| [`typescript/`](typescript/)     | Analyzing a STEP file with [`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api): create a part, upload, wait for the job, fetch datasheets, print the report. | Yes              |
| [`python/`](python/)             | The same flow with the `toolpath` Python SDK.                                                                                                                           | Yes              |
| [`fusion-addin/`](fusion-addin/) | An Autodesk Fusion add-in: send a body through the CAM API, pick machining directions, and import the setups and toolpaths into Fusion.                                 | Yes              |
| [`react-viewer/`](react-viewer/) | A local Vite app for [`@toolpath/viewer`](https://www.npmjs.com/package/@toolpath/viewer): procedural parts, stock, section, measure, explode and sharp corners.        | No               |

## Prerequisites

- **A Toolpath API key** for `typescript/`, `python/` and `fusion-addin/`. See the
  [authentication guide](https://developers.toolpath.com/authentication). Keep it in your
  environment (`TOOLPATH_API_KEY`); each example's `.env.example` lists the variables it reads.
  The Fusion add-in asks for its key in its panel instead. Never commit a key.
- **Node.js and pnpm** for `typescript/`, `react-viewer/` and `fusion-addin/`, at the versions in
  `.tool-versions`.
- **Python 3.11+ and [uv](https://docs.astral.sh/uv/)** for `python/`, and for the add-in's
  Python tests.
- **Autodesk Fusion** to run `fusion-addin/`.

## Run them

From the repository root:

```bash
pnpm install --frozen-lockfile

# TypeScript: analyze a part
TOOLPATH_API_KEY="your-api-key" pnpm --filter @toolpath/example-typescript analyze -- "/path/to/part.step"

# Python: analyze a part
TOOLPATH_API_KEY="your-api-key" uv run --project python python python/src/analyze_part.py "/path/to/part.step"

# Fusion add-in: build it, then link it into Fusion (see fusion-addin/README.md)
pnpm --filter @toolpath/example-fusion-addin build
fusion-addin/bin/install-addin.sh

# React viewer: start the dev server
pnpm --filter @toolpath/example-react-viewer dev
```

Each example's README has the details, including Windows commands.

## Checks

```bash
pnpm check-types   # TypeScript, all Node examples
pnpm build         # type-check and build
pnpm test          # unit tests, the add-in's pytest suite, and the viewer's Playwright suite
pnpm lint          # ESLint, and ruff for the Python code
pnpm format:check  # Prettier
```

Install Chromium for the viewer tests with
`pnpm --filter @toolpath/example-react-viewer exec playwright install chromium`. None of the
checks call the Toolpath API.

## License

[MIT](LICENSE)

# Toolpath examples

Small, runnable examples for the [Toolpath API](https://developers.toolpath.com/) and the
Toolpath packages published from [toolpath/ui-packages](https://github.com/toolpath/ui-packages).

| Example                          | What it shows                                                                                                                                                           | Needs an API key |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| [`typescript/`](typescript/)     | Analyzing a STEP file with [`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api): create a part, upload, wait for the job, fetch datasheets, print the report. | Yes              |
| [`python/`](python/)             | The same flow with the `toolpath` Python SDK.                                                                                                                           | Yes              |
| [`react-viewer/`](react-viewer/) | A local Vite app for [`@toolpath/viewer`](https://www.npmjs.com/package/@toolpath/viewer): procedural parts, stock, section, measure, explode and sharp corners.        | No               |

## Prerequisites

- **A Toolpath API key** for `typescript/` and `python/`. See the
  [authentication guide](https://developers.toolpath.com/authentication). Keep it in your
  environment (`TOOLPATH_API_KEY`); each example's `.env.example` lists the variables it reads.
  Never commit a key.
- **Node.js and pnpm** for `typescript/` and `react-viewer/`, at the versions in
  `.tool-versions`.
- **Python 3.11+ and [uv](https://docs.astral.sh/uv/)** for `python/`.

## Run them

From the repository root:

```bash
pnpm install --frozen-lockfile

# TypeScript: analyze a part
TOOLPATH_API_KEY="your-api-key" pnpm --filter @toolpath/example-typescript analyze -- "/path/to/part.step"

# Python: analyze a part
TOOLPATH_API_KEY="your-api-key" uv run --project python python python/src/analyze_part.py "/path/to/part.step"

# React viewer: start the dev server
pnpm --filter @toolpath/example-react-viewer dev
```

Each example's README has the details, including Windows commands.

## Checks

```bash
pnpm check-types   # TypeScript, both Node examples
pnpm build         # type-check and build
pnpm test          # unit tests, and the viewer's Playwright suite (needs Chromium)
pnpm lint          # ESLint, and ruff for the Python example
pnpm format:check  # Prettier
```

Install Chromium for the viewer tests with
`pnpm --filter @toolpath/example-react-viewer exec playwright install chromium`. None of the
checks call the Toolpath API.

## License

[MIT](LICENSE)

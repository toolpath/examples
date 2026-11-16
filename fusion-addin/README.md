# Fusion add-in

A boilerplate Autodesk Fusion add-in that machines a body with Toolpath's CAM API:

1. Pick a body. It is exported as STEP and sent for feature analysis.
2. Pick machining directions from the part's candidates, shown in a 3D viewer. The order you pick is the setup order.
3. Toolpath plans the part and calculates its toolpaths. A hidden palette polls the job and imports the results.

Each body you send is a run. Past runs are listed in the panel: open one to see its results, import them again,
or request toolpaths from other directions. Runs are saved as JSON files, one per run, in
`~/Library/Application Support/Toolpath/fusion-addin/runs` (macOS) or `%APPDATA%\Toolpath\fusion-addin\runs`
(Windows). They hold ids and statuses only, never CAD content or your API key. In a browser they are kept in
localStorage.

Built with the published [`@toolpath/ui`](https://www.npmjs.com/package/@toolpath/ui),
[`@toolpath/viewer`](https://www.npmjs.com/package/@toolpath/viewer) and
[`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api).

## What gets imported

- A component, `Toolpath CAM: <body>`, holding the stock as a hidden body.
- One Manufacture setup per Toolpath setup. Its WCS Z is the setup direction and its origin is the top center of the stock.
- One sketch per action, holding its toolpath: cuts and leads as lines, links as construction lines.

The API returns toolpaths as points, not Fusion operations, so the setups have no operations. Sketching is slow in
Fusion, so a long toolpath is thinned to `max_sketch_points_per_action` points.

## Setup

1. Create an API key in the [Toolpath portal](https://portal.toolpath.com/keys) with Core, DFM and Quoting access.
   Add `http://localhost:47831` to its allowed browser origins.
2. From the repository root, build the web app into the add-in, then link the add-in into Fusion:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @toolpath/example-fusion-addin build
   fusion-addin/bin/install-addin.sh      # macOS
   fusion-addin\bin\install-addin.ps1     # Windows
   ```

3. In Fusion, open **Utilities › Add-Ins**, run `ToolpathCam`, then click **Toolpath CAM** on the Solid tab (or Manufacture’s Milling tab).

## Development

`pnpm --filter @toolpath/example-fusion-addin dev` serves the app on port 47831 with hot reload. To
load it inside Fusion, set `"app_url": "http://localhost:47831"` in `ToolpathCam/config.json`,
copying `config.example.json` to start. In a plain browser,
the app takes a CAD file instead of a Fusion body, and shows results without importing them.

| `config.json` key              | Default    |                                                         |
| ------------------------------ | ---------- | ------------------------------------------------------- |
| `api_url`, `portal_url`        | production | override the API and portal base URLs                   |
| `app_url`                      | `null`     | load a dev server instead of `web/`                     |
| `port`                         | `47831`    | the palettes' origin; the API key must allow it         |
| `max_sketch_points_per_action` | `2000`     | longer toolpaths are thinned                            |
| `sketch_links`                 | `true`     | sketch approach, retract and connection moves           |
| `debug`                        | `false`    | right-click a palette to open its web inspector         |
| `runs_dir`                     | `null`     | where past runs are saved; `null` for the default above |

## Testing

```sh
pnpm --filter @toolpath/example-fusion-addin test   # vitest, then pytest (needs uv)
fusion-addin/bin/run-import.py fusion-addin/benchmarks/two-setup-block --check
```

The benchmarks hold API results and the import plan they should produce, so you can check import changes without
running Fusion. See [benchmarks/README.md](benchmarks/README.md). Things only Fusion can show, like the sketches,
setups and WCS, still need a run in Fusion.

## Layout

| Path                         |                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/components`             | the main palette's React UI                                                                             |
| `src/api`                    | Toolpath API calls (`cam.ts`) and job polling (`poll.ts`)                                               |
| `src/worker`                 | the hidden palette: polling and import                                                                  |
| `src/fusion`                 | the palette ↔ Python bridge and its message types                                                      |
| `ToolpathCam/ToolpathCam.py` | add-in entry: button, palettes, events                                                                  |
| `src/runs`                   | past runs: status helpers and storage                                                                   |
| `ToolpathCam/lib`            | `router.py` (messages), `runs.py` (run files), `plan.py` (pure import plan), `importer.py` (Fusion API) |
| `benchmarks`, `bin`          | import baselines, the import runner and the install scripts                                             |

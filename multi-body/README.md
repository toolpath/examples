# Multi-body files

The smallest app that uploads a CAD file holding several solid bodies and draws them all with
[`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api) and
[`@toolpath/viewer`](https://www.npmjs.com/package/@toolpath/viewer).

## Run it

```bash
pnpm install --frozen-lockfile
cp multi-body/.env.example multi-body/.env   # then set your API key
pnpm --filter @toolpath/example-multi-body dev
```

Open the URL Vite prints and choose a CAD file. Point at a body in the list to see it alone, or
click it, there or in the scene, to keep it that way. Click its row again to bring the others back.

## Read it

| File                                       | What it does                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| [`src/upload-file.ts`](src/upload-file.ts) | Every API call, in order: file to meshes in four numbered steps.               |
| [`src/main.tsx`](src/main.tsx)             | Meshes to pixels: `displayMeshModel`, `usePartCollection`, `<PartCollection>`. |
| [`vite.config.ts`](vite.config.ts)         | Forwards `/v1` to the API, so any key works from `localhost`.                  |

All of these calls are free. Only analysis (`PATCH /v1/parts/{id}`) is billed, and this example
stops before it. To analyze a body, use its `partId` as you would any other part's.

The Files API is experimental and may change in a minor API release. See the
[API reference](https://developers.toolpath.com/) before upgrading.

## Before you ship something like this

- **Keep your key on a server.** This example puts it in the browser to stay short, and `vite build`
  writes it into the bundle. Anyone who can load the page can read it.
- **Limit concurrent requests.** Step 4 starts every body at once. For files of many bodies, run a
  few at a time and retry on `429`.

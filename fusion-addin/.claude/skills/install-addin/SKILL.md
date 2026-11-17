---
name: install-addin
description: Build the Fusion add-in and link it into Fusion's AddIns folder. Use when the user wants to try the add-in in Fusion.
---

# Install the add-in into Fusion

1. `pnpm --filter @toolpath/example-fusion-addin build` writes the web app to `ToolpathCam/web/`.
2. Link the add-in. On macOS run `bin/install-addin.sh`; on Windows run `bin/install-addin.ps1`.
   `--uninstall` / `-Uninstall` removes the link.
3. Tell the user to open **Utilities › Add-Ins** in Fusion, run `ToolpathCam`, then click **Toolpath CAM** on the Solid tab.
4. Their API key must allow `http://localhost:<port>` (47831 by default) as a browser origin.

For hot reload, set `"app_url": "http://localhost:47831"` in `ToolpathCam/config.json` and run `pnpm dev`.
Set `"debug": true` to open a palette's web inspector. Python output goes to Fusion's Text Commands window.

#!/usr/bin/env bash
# Links ToolpathCam into Fusion's AddIns folder. Usage: bin/install-addin.sh [--uninstall]
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../ToolpathCam" && pwd)"

case "$(uname -s)" in
  Darwin) ADDINS="$HOME/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns" ;;
  *) echo "Use bin/install-addin.ps1 on Windows; Fusion has no Linux build." >&2; exit 1 ;;
esac
TARGET="$ADDINS/ToolpathCam"

if [[ "${1:-}" == "--uninstall" ]]; then
  [[ -L "$TARGET" ]] && rm "$TARGET" && echo "Removed $TARGET"
  exit 0
fi

[[ -f "$SOURCE/web/index.html" ]] || echo "Warning: no web build yet; run pnpm build first." >&2
mkdir -p "$ADDINS"
if [[ -e "$TARGET" && ! -L "$TARGET" ]]; then
  echo "$TARGET exists and is not a link; remove it first." >&2
  exit 1
fi
ln -sfn "$SOURCE" "$TARGET"
echo "Linked $TARGET -> $SOURCE"
echo "In Fusion: Utilities > Add-Ins > ToolpathCam > Run."

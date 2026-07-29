#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

printf '%s\n' \
  "MindMap Phase 2C-B1b — ONE authorized read-only dry run" \
  "" \
  "Expected source:" \
  "  size: 5,070,848 bytes" \
  "  SHA-256: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918" \
  "" \
  "Target: fresh isolated temporary IndexedDB namespaces only" \
  "Model: without AI" \
  "External network: disabled" \
  "Automatic retry: disabled" \
  "Actual migration: NOT authorized and NOT performed" \
  ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13 or newer is required." >&2
  read -r -n 1 -p "Press any key to close..."
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "${NODE_MAJOR}" -lt 22 ]]; then
  echo "Node.js 22.13 or newer is required; current: $(node -v)." >&2
  read -r -n 1 -p "Press any key to close..."
  exit 1
fi

SOURCE_PATH="$(osascript <<'APPLESCRIPT'
set selectedFile to choose file with prompt "Select the exact MindMap SQLite source (mindmap-legacy-...sqlite)"
POSIX path of selectedFile
APPLESCRIPT
)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_DIR="$HOME/Desktop/MindMap-B1b-Evidence-$STAMP"
mkdir -p "$OUTPUT_DIR"

echo "Selected source: $(basename "$SOURCE_PATH")"
echo "Evidence directory: $OUTPUT_DIR"
echo "Starting the one authorized run. This package cannot retry automatically."

set +e
node --experimental-strip-types scripts/run-phase2cb-b1b-one-shot.mjs \
  --source "$SOURCE_PATH" \
  --output "$OUTPUT_DIR"
STATUS=$?
set -e

if [[ "$STATUS" -eq 0 ]]; then
  echo ""
  echo "B1b dry run completed. Open: $OUTPUT_DIR"
  echo "Do not send the SQLite file. Send only the JSON manifest/evidence for review."
else
  echo ""
  echo "B1b stopped safely. No automatic retry is allowed."
  echo "Keep the stopped JSON in: $OUTPUT_DIR"
fi

read -r -n 1 -p "Press any key to close..."
exit "$STATUS"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPOSITORY="${MINDMAP_PACKAGE_REPOSITORY:-ne-agalakov/mindmap-local}"
COMMIT="$(git rev-parse HEAD)"
if [[ -n "${MINDMAP_PACKAGE_COMMIT_SHA:-}" ]]; then
  REQUESTED_COMMIT="$(git rev-parse "${MINDMAP_PACKAGE_COMMIT_SHA}^{commit}")"
  if [[ "$REQUESTED_COMMIT" != "$COMMIT" ]]; then
    printf 'Refusing to package commit %s from checkout %s.\n' "$REQUESTED_COMMIT" "$COMMIT" >&2
    exit 1
  fi
fi
TREE="$(git rev-parse "${COMMIT}^{tree}")"
SHORT="${COMMIT:0:12}"
OUTPUT_DIR="$ROOT/release-artifacts"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/mindmap-b1b-package.XXXXXX")"
PACKAGE_DIR="$STAGE/MindMap-Phase2CB-B1b-One-Shot-$SHORT"
ZIP_NAME="mindmap-phase2cb-b1b-one-shot-$SHORT.zip"
ZIP_PATH="$OUTPUT_DIR/$ZIP_NAME"
SHA_PATH="$ZIP_PATH.sha256"
trap 'rm -rf "$STAGE"' EXIT

npm run build:phase2cb-b1b-harness
mkdir -p "$OUTPUT_DIR" "$PACKAGE_DIR/scripts" "$PACKAGE_DIR/tools" "$PACKAGE_DIR/browser"

cp start-phase2cb-b1b.command "$PACKAGE_DIR/start-phase2cb-b1b.command"
cp scripts/run-phase2cb-b1b-one-shot.mjs "$PACKAGE_DIR/scripts/run-phase2cb-b1b-one-shot.mjs"
cp tools/phase2cb-b1b-exact-source.mjs "$PACKAGE_DIR/tools/phase2cb-b1b-exact-source.mjs"
cp -R tools/browser-phase2cb-b1b-harness/dist "$PACKAGE_DIR/browser/dist"
chmod 0755 "$PACKAGE_DIR/start-phase2cb-b1b.command"
chmod 0644 "$PACKAGE_DIR/scripts/run-phase2cb-b1b-one-shot.mjs" "$PACKAGE_DIR/tools/phase2cb-b1b-exact-source.mjs"

cat > "$PACKAGE_DIR/B1B_PACKAGE.json" <<JSON
{
  "schema": "mindmap-phase2cb-b1b-one-shot-package-v1",
  "repository": "$REPOSITORY",
  "commit": "$COMMIT",
  "tree": "$TREE",
  "authorizationId": "artem-2026-07-27-b1b-once",
  "expectedSourceSizeBytes": 5070848,
  "expectedSourceSha256": "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918",
  "targetNamespacePattern": "mindmap-state-core-v1-phase2cb-b1-<run-id>-{first|second|rollback}",
  "sourceOpenMode": "readonly-query-only",
  "externalNetworkAllowed": false,
  "modelCallsAllowed": false,
  "automaticRetryAllowed": false,
  "actualMigrationAllowed": false,
  "rawSourceIncluded": false
}
JSON

cat > "$PACKAGE_DIR/README.txt" <<'TXT'
MindMap Phase 2C-B1b — one authorized exact-source read-only dry run

Run by double-clicking start-phase2cb-b1b.command on the target Mac.

The package will ask you to select the exact SQLite source. It accepts only:
- 5,070,848 bytes
- SHA-256 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918

It creates only isolated temporary IndexedDB targets, runs two clean passes and one
injected rollback pass, deletes the temporary targets after evidence capture, and writes
sanitized JSON evidence to a new Desktop folder.

External network/model calls are disabled. Automatic retry is disabled. Actual migration
is not authorized and is not performed. Never upload or send the SQLite source.
TXT

find "$PACKAGE_DIR" -type f -exec touch -t 202607270000 {} +
(
  cd "$STAGE"
  zip -X -q -r "$ZIP_PATH" "$(basename "$PACKAGE_DIR")"
)
(
  cd "$OUTPUT_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$ZIP_NAME" > "$(basename "$SHA_PATH")"
  else
    shasum -a 256 "$ZIP_NAME" > "$(basename "$SHA_PATH")"
  fi
)

printf '%s\n' "$ZIP_PATH" "$SHA_PATH"

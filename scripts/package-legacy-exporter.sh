#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

command -v git >/dev/null || { echo "git is required" >&2; exit 69; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 69; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Legacy exporter packaging refused: the Git worktree is dirty." >&2
  exit 65
fi

commit_sha="$(git rev-parse HEAD)"
version="$(node -p 'require("./package.json").version')"
short_sha="${commit_sha:0:12}"
out_dir="${project_root}/release-artifacts"
stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT
archive_root="mindmap-legacy-exporter-v${version}-${short_sha}"
archive_dir="${stage}/${archive_root}"
mkdir -p "${archive_dir}/tools"

# Extract only the standalone exporter. No old app, package dependencies, runtime
# cache, database, diagnostics, or semantic code are included.
git archive --format=tar HEAD \
  start-legacy-exporter.command \
  tools/browser-legacy-exporter \
  | tar -xf - -C "${archive_dir}"

# GitHub's contents API records new files as non-executable. The user-facing Mac
# launcher must be executable in the downloaded ZIP regardless of the repository
# mode bit, so packaging establishes that mode explicitly and tests the archive.
chmod 0755 "${archive_dir}/start-legacy-exporter.command"

node --input-type=module - "${archive_dir}/EXPORTER_REVISION.json" "${commit_sha}" "${version}" <<'NODE'
import { writeFile } from "node:fs/promises";
const [path, commitSha, version] = process.argv.slice(2);
const marker = {
  format: "mindmap-legacy-browser-exporter",
  schemaVersion: 1,
  appVersion: version,
  repository: "ne-agalakov/mindmap-local",
  repositoryCommit: commitSha,
  packagedAt: new Date().toISOString(),
  status: "phase0-read-only-exporter-accepted-evidence-preserved",
  expectedOrigin: "http://127.0.0.1:5173",
  storage: {
    databaseName: "mindmap-local-semantic-v060",
    storeName: "database",
    key: "mindmap-v0.6.sqlite",
    transactionMode: "readonly"
  },
  safety: {
    oldApplicationIncluded: false,
    packageDependenciesIncluded: false,
    databaseIncluded: false,
    diagnosticsIncluded: false,
    databaseWritePathIncluded: false,
    databaseMigrationPathIncluded: false,
    networkFetchPathIncluded: false,
    ollamaPathIncluded: false,
    qwenPathIncluded: false,
    deepseekPathIncluded: false
  }
};
await writeFile(path, `${JSON.stringify(marker, null, 2)}\n`);
NODE

mkdir -p "${out_dir}"
(
  cd "${stage}"
  zip -qr "${out_dir}/${archive_root}.zip" "${archive_root}"
)

(
  cd "${out_dir}"
  if command -v sha256sum >/dev/null; then
    sha256sum "${archive_root}.zip" > "${archive_root}.zip.sha256"
  elif command -v shasum >/dev/null; then
    shasum -a 256 "${archive_root}.zip" > "${archive_root}.zip.sha256"
  else
    echo "sha256sum or shasum is required" >&2
    exit 69
  fi
)

echo "${out_dir}/${archive_root}.zip"

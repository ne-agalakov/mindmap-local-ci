#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

command -v git >/dev/null || { echo "git is required" >&2; exit 69; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 69; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Release packaging refused: the Git worktree is dirty." >&2
  exit 65
fi

commit_sha="$(git rev-parse HEAD)"
version="$(node -p 'require("./package.json").version')"
short_sha="${commit_sha:0:12}"
out_dir="${project_root}/release-artifacts"
stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT
archive_root="mindmap-local-v${version}-${short_sha}"
mkdir -p "${stage}/${archive_root}"

git archive --format=tar HEAD | tar -xf - -C "${stage}/${archive_root}"
rm -f "${stage}/${archive_root}/public/sql-wasm.wasm"

node --input-type=module - "${stage}/${archive_root}/ARTIFACT_REVISION.json" "${commit_sha}" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [path, commitSha] = process.argv.slice(2);
const marker = JSON.parse(await readFile(path, "utf8"));
marker.repository = "ne-agalakov/mindmap-local";
marker.repositoryCommit = commitSha;
marker.gitStatus = "clean GitHub commit";
marker.packagedAt = new Date().toISOString();
await writeFile(path, `${JSON.stringify(marker, null, 2)}\n`);
NODE

mkdir -p "${out_dir}"
(
  cd "${stage}"
  zip -qr "${out_dir}/${archive_root}.zip" "${archive_root}"
)

# Write a portable checksum manifest. The filename must be relative so the
# downloaded artifact can be verified from any directory, not only on the
# original GitHub Actions runner path.
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

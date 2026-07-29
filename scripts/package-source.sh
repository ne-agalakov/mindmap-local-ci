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

resolve_repository() {
  if [[ -n "${MINDMAP_REPOSITORY_OVERRIDE:-}" ]]; then
    printf '%s' "${MINDMAP_REPOSITORY_OVERRIDE}"
    return
  fi

  local remote_url
  remote_url="$(git config --get remote.origin.url || true)"
  case "${remote_url}" in
    https://github.com/*)
      remote_url="${remote_url#https://github.com/}"
      ;;
    http://github.com/*)
      remote_url="${remote_url#http://github.com/}"
      ;;
    git@github.com:*)
      remote_url="${remote_url#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      remote_url="${remote_url#ssh://git@github.com/}"
      ;;
    *)
      echo "Release packaging refused: cannot resolve GitHub repository from remote.origin.url; set MINDMAP_REPOSITORY_OVERRIDE." >&2
      exit 65
      ;;
  esac

  remote_url="${remote_url%.git}"
  if [[ ! "${remote_url}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "Release packaging refused: invalid repository identity ${remote_url}." >&2
    exit 65
  fi
  printf '%s' "${remote_url}"
}

commit_sha="$(git rev-parse HEAD)"
repository="$(resolve_repository)"
version="$(node -p 'require("./package.json").version')"
short_sha="${commit_sha:0:12}"
out_dir="${project_root}/release-artifacts"
stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT
archive_root="mindmap-local-v${version}-${short_sha}"
mkdir -p "${stage}/${archive_root}"

git archive --format=tar HEAD | tar -xf - -C "${stage}/${archive_root}"
rm -f "${stage}/${archive_root}/public/sql-wasm.wasm"

node --input-type=module - "${stage}/${archive_root}/ARTIFACT_REVISION.json" "${commit_sha}" "${repository}" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [path, commitSha, repository] = process.argv.slice(2);
const marker = JSON.parse(await readFile(path, "utf8"));
marker.repository = repository;
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

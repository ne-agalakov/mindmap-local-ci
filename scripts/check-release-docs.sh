#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

package_version="$(
  node --input-type=module -e 'import packageJson from "./package.json" with { type: "json" }; process.stdout.write(packageJson.version)'
)"
release_label="${package_version%.0-alpha.*}-alpha.${package_version##*.}"
alpha_number="${package_version##*.}"

require_text() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq -- "${expected}" "${file}"; then
    echo "Release documentation gate failed: ${file} does not contain ${expected}" >&2
    exit 65
  fi
}

require_text "app/lib/semantic-pipeline.ts" "SEMANTIC_PIPELINE_VERSION = \"${package_version}\""
require_text "app/page.tsx" "appVersion: \"${package_version}\""
require_text "app/page.tsx" "<small>v0.6 alpha.${alpha_number}</small>"
require_text "README.md" "# MindMap Local v${release_label}"
require_text "README.md" "b4b35dcd7125c820f75f89387bc18ac3fa509cb0"
require_text "README.md" "npm run test:indexeddb-storage"
require_text "README.md" "npm run test:browser-storage"
require_text "start-mindmap.command" "MindMap v${release_label}"
require_text "project-docs/PROJECT_STATUS.md" "## Phase 2B — принята"
require_text "project-docs/PROJECT_STATUS.md" "## Следующий проверяемый шаг"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Актуально для v${release_label}"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "## Принятые Phase 2B recovery invariants"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "## Phase 2C — migration dry-run protocol"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Alpha.${alpha_number}"
require_text "project-docs/PROJECT_INSTRUCTION.md" "REQ-OBS-001"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Phase 2B принята merge"
require_text "project-docs/PROJECT_INSTRUCTION.md" "## Phase 2C — migration dry-run"
require_text "docs/architecture/ADR-0001-PHASE2-STORAGE-ADAPTER.md" "Use **native IndexedDB behind a thin, typed adapter**"
require_text "docs/architecture/PHASE2A_RESULT.md" "Status: accepted and merged"
require_text "docs/architecture/PHASE2B_RESULT.md" "Status: accepted and merged"
require_text "docs/architecture/PHASE2B_RESULT.md" "b4b35dcd7125c820f75f89387bc18ac3fa509cb0"
require_text "docs/architecture/WORK_STOP.md" "Work boundary after Phase 2B acceptance"
require_text "project-docs/GITHUB_PROVENANCE.md" "Mandatory release invariant"
require_text "project-docs/GITHUB_PROVENANCE.md" "82fc0691274b4b32070723e3da31b48ddcd39398"
require_text "ARTIFACT_REVISION.json" "ne-agalakov/mindmap-local"
require_text "ARTIFACT_REVISION.json" "b4b35dcd7125c820f75f89387bc18ac3fa509cb0"

instruction_length="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md", "utf8")).length))')"
if (( instruction_length > 8000 )); then
  echo "Release documentation gate failed: project instruction is ${instruction_length} characters; limit is 8000." >&2
  exit 65
fi

node --input-type=module - "${package_version}" <<'NODE'
import { readFile } from "node:fs/promises";

const expectedVersion = process.argv[2];
let drive;
let artifact;
try {
  drive = JSON.parse(await readFile("project-docs/DRIVE_SYNC.json", "utf8"));
  artifact = JSON.parse(await readFile("ARTIFACT_REVISION.json", "utf8"));
} catch {
  console.error("Release documentation gate failed: DRIVE_SYNC.json or ARTIFACT_REVISION.json is absent or invalid.");
  process.exit(65);
}

const requiredDocuments = new Set([
  "MindMap — инструкция проекта.md",
  "MindMap — решения и статус.md",
  "MindMap — восстановление и бюджет локальной модели.md",
]);
const syncedDocuments = new Set(
  Array.isArray(drive.documents)
    ? drive.documents
        .filter((item) => typeof item?.driveFileId === "string" && item.driveFileId.length > 0)
        .map((item) => item.name)
    : [],
);
const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;
const requiredReadbackMarkers = new Set([
  "Phase 2B — принята и слита",
  "Phase 2B — принята в GitHub",
  "Phase 2B — browser storage принят",
  "b4b35dcd7125c820f75f89387bc18ac3fa509cb0",
  "5a8b4f6a418b465da7383d7c999485bae1f9a900",
  "706a463af20e4cc1aaa956a8e0812376886e543e83f249aa1359b9ce673881c7",
]);
const actualReadbackMarkers = new Set(
  Array.isArray(drive.readBackChecks)
    ? drive.readBackChecks.flatMap((item) => Array.isArray(item?.verifiedMarkers) ? item.verifiedMarkers : [])
    : [],
);

if (drive.version !== expectedVersion
  || typeof drive.syncedAt !== "string"
  || drive.syncedAt.length === 0
  || drive.readBackAt !== drive.syncedAt
  || drive.syncStatus !== "synced_native_google_docs_verified"
  || ![...requiredDocuments].every((name) => syncedDocuments.has(name))
  || ![...requiredReadbackMarkers].every((marker) => actualReadbackMarkers.has(marker))
  || drive.architectureAudit?.phase2BMergeCommit !== "b4b35dcd7125c820f75f89387bc18ac3fa509cb0"
  || drive.architectureAudit?.phase2BFinalReviewedHead !== "5a8b4f6a418b465da7383d7c999485bae1f9a900"
  || drive.architectureAudit?.phase2BTargetNamespacePrefix !== "mindmap-state-core-v1"
  || drive.architectureAudit?.phase2BAccepted !== true
  || drive.architectureAudit?.migrationDryRunAllowed !== true
  || drive.architectureAudit?.actualMigrationAllowed !== false
  || artifact.appVersion !== expectedVersion
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "ne-agalakov/mindmap-local"
  || artifact.repositoryArtifactPortabilityMergeCommit !== "82fc0691274b4b32070723e3da31b48ddcd39398"
  || artifact.phase2BMergeCommit !== "b4b35dcd7125c820f75f89387bc18ac3fa509cb0"
  || artifact.phase2BFinalReviewedHead !== "5a8b4f6a418b465da7383d7c999485bae1f9a900"
  || artifact.phase2BTargetNamespacePrefix !== "mindmap-state-core-v1"
  || artifact.phase2BAccepted !== true
  || artifact.migrationDryRunAllowed !== true
  || artifact.actualMigrationAllowed !== false
  || artifact.targetMigrationPerformedDuringPhase2B !== false
  || artifact.legacyDatabaseOpenedDuringPhase2B !== false
  || artifact.zeroModelCallsDuringPhase2B !== true) {
  console.error(
    `Release documentation gate failed: Drive, artifact, or accepted Phase 2B provenance is not synchronized for ${expectedVersion}.`,
  );
  process.exit(65);
}
NODE

echo "Release documentation gate passed for ${package_version}."

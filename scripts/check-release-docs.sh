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
require_text "README.md" "Accepted Phase 2C-A"
require_text "README.md" "292634312ad04fa6e6cfc5a5ded311ac1020094d"
require_text "README.md" "Same-fixture cross-environment"
require_text "start-mindmap.command" "MindMap v${release_label}"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-A — принята"
require_text "project-docs/PROJECT_STATUS.md" "## Следующий проверяемый шаг"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Актуально для v${release_label}"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Accepted Phase 2C-A recovery invariants"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Alpha.${alpha_number}"
require_text "project-docs/PROJECT_INSTRUCTION.md" "REQ-OBS-001"
require_text "project-docs/PROJECT_INSTRUCTION.md" "292634312ad04fa6e6cfc5a5ded311ac1020094d"
require_text "docs/architecture/ADR-0002-PHASE2C-GRAPH-PAYLOAD-STORAGE.md" "Status: accepted"
require_text "docs/architecture/PHASE2CA_VERIFICATION.md" "Status: accepted and merged"
require_text "docs/architecture/PHASE2CA_VERIFICATION.md" "ee5401a4a2ca7763467562417b9c5c4aece01214"
require_text "docs/architecture/WORK_STOP.md" "after Phase 2C-A acceptance"
require_text "docs/architecture/KNOWN_GAPS.md" "292634312ad04fa6e6cfc5a5ded311ac1020094d"
require_text "docs/architecture/README.md" "292634312ad04fa6e6cfc5a5ded311ac1020094d"
require_text "docs/architecture/DECISION_LOG.md" "ADR-007"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-A exact-tree public mirror"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-phase2ca-accepted"
require_text "ARTIFACT_REVISION.json" "2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c"

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
  console.error("Release documentation gate failed: synchronized JSON is absent or invalid.");
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
const requiredMarkers = new Set([
  "Phase 2C-A — принята и слита",
  "Phase 2C-A — accepted merge provenance",
  "Phase 2C-A — accepted recovery/storage boundary",
  "29a317b58cbecaea13e4f21c02af2b945a6e6edc",
  "292634312ad04fa6e6cfc5a5ded311ac1020094d",
  "ee5401a4a2ca7763467562417b9c5c4aece01214",
  "actual target-Mac migration",
]);
const actualMarkers = new Set(
  Array.isArray(drive.readBackChecks)
    ? drive.readBackChecks.flatMap((item) => Array.isArray(item?.verifiedMarkers) ? item.verifiedMarkers : [])
    : [],
);
const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;

if (drive.version !== expectedVersion
  || drive.readBackAt !== drive.syncedAt
  || drive.syncStatus !== "synced_native_google_docs_verified"
  || ![...requiredDocuments].every((name) => syncedDocuments.has(name))
  || ![...requiredMarkers].every((marker) => actualMarkers.has(marker))
  || drive.architectureAudit?.phase2CAMergeCommit !== "292634312ad04fa6e6cfc5a5ded311ac1020094d"
  || drive.architectureAudit?.phase2CAAccepted !== true
  || drive.architectureAudit?.phase2CBAllowed !== true
  || drive.architectureAudit?.actualMigrationAllowed !== false
  || drive.architectureAudit?.zeroModelCalls !== true
  || artifact.appVersion !== expectedVersion
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "ne-agalakov/mindmap-local"
  || artifact.phase2CAMergeCommit !== "292634312ad04fa6e6cfc5a5ded311ac1020094d"
  || artifact.phase2CAAccepted !== true
  || artifact.phase2CBAllowed !== true
  || artifact.actualMigrationAllowed !== false
  || artifact.zeroModelCallsDuringPhase2CA !== true
  || artifact.legacyDatabaseOpenedDuringPhase2CA !== false
  || artifact.legacyDatabaseWritePerformedDuringPhase2CA !== false
  || artifact.targetMigrationPerformedDuringPhase2CA !== false) {
  console.error(`Release documentation gate failed: Phase 2C-A accepted provenance is not synchronized for ${expectedVersion}.`);
  process.exit(65);
}
NODE

echo "Release documentation gate passed for ${package_version}."

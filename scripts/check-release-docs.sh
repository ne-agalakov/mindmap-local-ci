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
require_text "README.md" "Phase 2C-A"
require_text "README.md" "30196934408"
require_text "README.md" "same-fixture cross-environment"
require_text "start-mindmap.command" "MindMap v${release_label}"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-A — final gates passed, merge pending"
require_text "project-docs/PROJECT_STATUS.md" "## Следующий проверяемый шаг"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Актуально для v${release_label}"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-A recovery/storage evidence"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Alpha.${alpha_number}"
require_text "project-docs/PROJECT_INSTRUCTION.md" "REQ-OBS-001"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Phase 2C-A"
require_text "docs/architecture/ADR-0002-PHASE2C-GRAPH-PAYLOAD-STORAGE.md" "Acceptance is pending PR #38 merge"
require_text "docs/architecture/PHASE2CA_VERIFICATION.md" "30196934411"
require_text "docs/architecture/PHASE2CA_VERIFICATION.md" "same-fixture cross-environment"
require_text "docs/architecture/WORK_STOP.md" "Phase 2C-A final merge gate"
require_text "docs/architecture/KNOWN_GAPS.md" "same-fixture cross-environment"
require_text "project-docs/GITHUB_PROVENANCE.md" "Mandatory release invariant"
require_text "ARTIFACT_REVISION.json" "phase2ca-final-gate-merge-pending"
require_text "ARTIFACT_REVISION.json" "c26b5d16138713b69eba3aedba1d84512cac8e0c9429a598921a8ead8fab1c67"

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
const requiredReadbackMarkers = new Set([
  "Phase 2C-A — финальный gate перед merge",
  "Phase 2C-A — CI и artifact gate пройдены, merge pending",
  "Phase 2C-A — recovery/storage gate перед merge",
  "85b158ebed11f494fe7e4766453693de01d75bfe",
  "30196934408",
  "30196934411",
  "same-fixture cross-environment equality",
]);
const actualReadbackMarkers = new Set(
  Array.isArray(drive.readBackChecks)
    ? drive.readBackChecks.flatMap((item) => Array.isArray(item?.verifiedMarkers) ? item.verifiedMarkers : [])
    : [],
);
const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;

if (drive.version !== expectedVersion
  || drive.readBackAt !== drive.syncedAt
  || drive.syncStatus !== "synced_native_google_docs_verified"
  || ![...requiredDocuments].every((name) => syncedDocuments.has(name))
  || ![...requiredReadbackMarkers].every((marker) => actualReadbackMarkers.has(marker))
  || drive.architectureAudit?.phase2CACodeHead !== "02df8758a7c42b33b22b397dae74445cd6a5f7ac"
  || drive.architectureAudit?.phase2CAImplemented !== true
  || drive.architectureAudit?.phase2CAAccepted !== false
  || drive.architectureAudit?.phase2CBAllowed !== false
  || drive.architectureAudit?.actualMigrationAllowed !== false
  || drive.architectureAudit?.zeroModelCalls !== true
  || artifact.appVersion !== expectedVersion
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "ne-agalakov/mindmap-local"
  || artifact.phase2CACodeHead !== "02df8758a7c42b33b22b397dae74445cd6a5f7ac"
  || artifact.phase2CAImplemented !== true
  || artifact.phase2CAAccepted !== false
  || artifact.phase2CBAllowed !== false
  || artifact.actualMigrationAllowed !== false
  || artifact.zeroModelCallsDuringPhase2CA !== true
  || artifact.legacyDatabaseOpenedDuringPhase2CA !== false
  || artifact.legacyDatabaseWritePerformedDuringPhase2CA !== false
  || artifact.targetMigrationPerformedDuringPhase2CA !== false) {
  console.error(
    `Release documentation gate failed: Phase 2C-A pre-merge evidence is not synchronized for ${expectedVersion}.`,
  );
  process.exit(65);
}
NODE

echo "Release documentation gate passed for ${package_version}."

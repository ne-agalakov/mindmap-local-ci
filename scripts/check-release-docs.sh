#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

package_version="$(node --input-type=module -e 'import packageJson from "./package.json" with { type: "json" }; process.stdout.write(packageJson.version)')"
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
require_text "start-mindmap.command" "MindMap v${release_label}"
require_text "README.md" "# MindMap Local v${release_label}"
require_text "README.md" "Phase 2C-B0 — implemented, not accepted"
require_text "README.md" "69429ee80d7be0425501054ed54f3052867c9968"
require_text "README.md" "8fc83312f71a29ec50fd57659fb39ff9ae5c0784"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-B0 — реализована, но не принята"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-B0 Drive readback"
require_text "project-docs/PROJECT_STATUS.md" "## Следующий проверяемый шаг"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Alpha.${alpha_number}"
require_text "project-docs/PROJECT_INSTRUCTION.md" "REQ-OBS-001"
require_text "project-docs/PROJECT_INSTRUCTION.md" "phase2cb-mapping-v1"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Актуально для v${release_label}"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-B0 recovery boundary"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-B0 canonical Drive readback"
require_text "docs/architecture/PHASE2CB_MAPPING_CONTRACT.md" "phase2cb-mapping-v1"
require_text "docs/architecture/PHASE2CB_MAPPING_CONTRACT.md" "Status: implemented"
require_text "docs/architecture/WORK_STOP.md" "Phase 2C-B0 final gate"
require_text "docs/architecture/KNOWN_GAPS.md" "exact final-head rerun"
require_text "docs/architecture/DECISION_LOG.md" "ADR-009"
require_text "project-docs/evidence/PHASE2CB_B0_PUBLIC_CI_GATE.md" "ada806f53d27c83a3375aa4fd01879d0dca48881"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-phase2cb-b0-final-gate-pending"
require_text "ARTIFACT_REVISION.json" "66d641699fd1d11f3e8745890bfa5dc7a4325b57f67d9cad78ebd72fdbc967a2"

instruction_length="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md", "utf8")).length))')"
if (( instruction_length > 8000 )); then
  echo "Release documentation gate failed: project instruction is ${instruction_length} characters; limit is 8000." >&2
  exit 65
fi

node --input-type=module - "${package_version}" <<'NODE'
import { readFile } from "node:fs/promises";

const expectedVersion = process.argv[2];
const fail = (message) => { console.error(`Release documentation gate failed: ${message}`); process.exit(65); };
let drive;
let artifact;
try {
  drive = JSON.parse(await readFile("project-docs/DRIVE_SYNC.json", "utf8"));
  artifact = JSON.parse(await readFile("ARTIFACT_REVISION.json", "utf8"));
} catch {
  fail("synchronized JSON is absent or invalid.");
}

const requiredDocuments = new Set([
  "MindMap — инструкция проекта.md",
  "MindMap — решения и статус.md",
  "MindMap — восстановление и бюджет локальной модели.md",
]);
const documents = Array.isArray(drive.documents) ? drive.documents : [];
const documentNames = new Set(documents.map((item) => item?.name));
const revisionsValid = documents.length === 3 && documents.every((item) =>
  typeof item?.driveFileId === "string" && item.driveFileId.length > 0
  && typeof item?.revisionId === "string" && item.revisionId.length > 20
  && item.revisionId === item.driveRevisionId
  && item.readBackStatus === "verified"
);
const checks = Array.isArray(drive.readBackChecks) ? drive.readBackChecks : [];
const checksValid = checks.length === 3 && checks.every((item) =>
  item?.status === "verified"
  && typeof item?.revisionId === "string"
  && item.revisionId === item.driveRevisionId
  && Array.isArray(item.verifiedMarkers)
  && item.verifiedMarkers.length >= 4
);
const allMarkers = new Set(checks.flatMap((item) => item.verifiedMarkers ?? []));
const requiredMarkers = [
  "Phase 2C-B0 — финальный gate перед принятием",
  "Phase 2C-B0 — exact-head результат и текущий blocker",
  "Phase 2C-B0 — recovery и AI-бюджетная граница",
  "B1 пока запрещена",
];
const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;

if (drive.version !== expectedVersion) fail("Drive version mismatch.");
if (drive.artifactRevision !== 6) fail("Drive artifact revision is not 6.");
if (drive.syncStatus !== "synced_native_google_docs_verified") fail("Drive sync status is not verified.");
if (!drive.syncedAt || drive.readBackAt !== drive.syncedAt) fail("Drive readback time does not match sync time.");
if (![...requiredDocuments].every((name) => documentNames.has(name))) fail("canonical Drive document inventory is incomplete.");
if (!revisionsValid || !checksValid) fail("Drive revision/readback evidence is incomplete.");
if (!requiredMarkers.every((marker) => allMarkers.has(marker))) fail("required B0 Drive markers were not reverse-read.");

const audit = drive.architectureAudit ?? {};
if (audit.phase2CAAccepted !== true
  || audit.phase2CB0Implemented !== true
  || audit.phase2CB0Accepted !== false
  || audit.phase2CB1Allowed !== false
  || audit.actualMigrationAllowed !== false
  || audit.phase2CB0DriveReadback !== true
  || audit.zeroModelCallsDuringPhase2CB0 !== true
  || audit.legacyDatabaseOpenedDuringPhase2CB0 !== false
  || audit.targetDatabaseCreatedDuringPhase2CB0 !== false) {
  fail("B0 architecture boundary is not synchronized in DRIVE_SYNC.json.");
}

if (artifact.appVersion !== expectedVersion
  || artifact.artifactRevision !== 6
  || artifact.status !== "frozen-legacy-runtime-phase2cb-b0-final-gate-pending"
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "ne-agalakov/mindmap-local"
  || artifact.phase2CAAccepted !== true
  || artifact.phase2CB0Implemented !== true
  || artifact.phase2CB0Accepted !== false
  || artifact.phase2CB1Allowed !== false
  || artifact.actualMigrationAllowed !== false
  || artifact.phase2CB0DriveReadback !== true
  || artifact.zeroModelCallsDuringPhase2CB0 !== true
  || artifact.legacyDatabaseOpenedDuringPhase2CB0 !== false
  || artifact.targetDatabaseCreatedDuringPhase2CB0 !== false) {
  fail("ARTIFACT_REVISION.json does not preserve the B0 final-gate boundary.");
}
NODE

echo "Release documentation gate passed for ${package_version} Phase 2C-B0 final tree."

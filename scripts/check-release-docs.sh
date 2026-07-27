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
require_text "README.md" "Phase 2C-B1a — implemented, final documentation gate pending"
require_text "README.md" "8ef2603b85aef1e7f1ff055cce7579259e3ee659"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-B1a — реализована, финальный documentation gate ожидается"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Текущая стоп-линия"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-B1a — pre-merge recovery boundary"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-B1a corrected exact-tree pre-merge provenance"
require_text "docs/architecture/PHASE2CB_MAPPING_CONTRACT.md" "phase2cb-mapping-v1"
require_text "docs/architecture/PHASE2CB_B1_EXECUTION_PLAN.md" "B1a — executor and harness on sanitized fixtures"
require_text "docs/architecture/WORK_STOP.md" "Work boundary after Phase 2C-B1a corrected exact-tree gate"
require_text "docs/architecture/KNOWN_GAPS.md" "Known gaps after Phase 2C-B1a corrected exact-tree gate"
require_text "docs/architecture/DECISION_LOG.md" "ADR-011"
require_text "project-docs/evidence/PHASE2CB_B1A_FINAL_GATE.md" "8ef2603b85aef1e7f1ff055cce7579259e3ee659"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-phase2cb-b1a-implemented-pre-merge"
require_text "ARTIFACT_REVISION.json" "df2570b6cfea74296248297b7000b29876036e95"
instruction_length="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md", "utf8")).length))')"
if (( instruction_length > 8000 )); then
  echo "Release documentation gate failed: project instruction is ${instruction_length} characters; limit is 8000." >&2
  exit 65
fi
node --input-type=module - "${package_version}" <<'NODE'
import { readFile } from "node:fs/promises";
const expectedVersion = process.argv[2];
const fail = (message) => {
  console.error(`Release documentation gate failed: ${message}`);
  process.exit(65);
};
let drive;
let artifact;
try {
  drive = JSON.parse(await readFile("project-docs/DRIVE_SYNC.json", "utf8"));
  artifact = JSON.parse(await readFile("ARTIFACT_REVISION.json", "utf8"));
} catch {
  fail("synchronized JSON is absent or invalid.");
}
const documents = Array.isArray(drive.documents) ? drive.documents : [];
const checks = Array.isArray(drive.readBackChecks) ? drive.readBackChecks : [];
const revisionsValid = documents.length === 3 && documents.every((item) =>
  typeof item?.revisionId === "string"
  && item.revisionId.length > 20
  && item.revisionId === item.driveRevisionId
  && item.readBackStatus === "verified"
);
const checksValid = checks.length === 3 && checks.every((item) =>
  item?.status === "verified"
  && item.revisionId === item.driveRevisionId
  && Array.isArray(item.verifiedMarkers)
  && item.verifiedMarkers.length >= 5
);
const markers = new Set(checks.flatMap((item) => item.verifiedMarkers ?? []));
const requiredMarkers = [
  "Phase 2C-B1a — exact-tree implementation gate пройден (27 июля 2026)",
  "Статус B1a: `implemented / final documentation gate pending`.",
  "B1b разрешается только после полного принятия B1a",
  "df2570b6cfea74296248297b7000b29876036e95",
  "8ef2603b85aef1e7f1ff055cce7579259e3ee659",
];
if (drive.version !== expectedVersion) fail("Drive version mismatch.");
if (drive.artifactRevision !== 8) fail("Drive artifact revision is not 8.");
if (drive.syncStatus !== "synced_native_google_docs_verified") fail("Drive sync status is not verified.");
if (!drive.syncedAt || drive.readBackAt !== drive.syncedAt) fail("Drive readback time mismatch.");
if (!revisionsValid || !checksValid) fail("Drive revision/readback evidence is incomplete.");
if (!requiredMarkers.every((marker) => markers.has(marker))) fail("required B1a Drive markers were not reverse-read.");
const audit = drive.architectureAudit ?? {};
if (
  audit.phase2CB0Accepted !== true
  || audit.phase2CB1PlanAccepted !== true
  || audit.phase2CB1aAllowed !== true
  || audit.phase2CB1aImplemented !== true
  || audit.phase2CB1aAccepted !== false
  || audit.phase2CB1bAllowed !== false
  || audit.actualMigrationAllowed !== false
  || audit.phase2CB1aDriveReadback !== true
  || audit.zeroModelCallsDuringPhase2CB1a !== true
  || audit.zeroNetworkCallsDuringPhase2CB1a !== true
  || audit.exactSourceOpenedDuringPhase2CB1a !== false
  || audit.realMigrationTargetCreatedDuringPhase2CB1a !== false
  || audit.sanitizedTemporaryTargetsUsedDuringPhase2CB1a !== true
  || audit.migrationExecutedDuringPhase2CB1a !== false
  || audit.automaticRetryAllowedDuringPhase2CB1a !== false
) fail("B1a implemented / B1b blocked architecture boundary is not synchronized in DRIVE_SYNC.json.");
const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;
if (
  artifact.appVersion !== expectedVersion
  || artifact.artifactRevision !== 8
  || artifact.status !== "frozen-legacy-runtime-phase2cb-b1a-implemented-pre-merge"
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "ne-agalakov/mindmap-local"
  || artifact.phase2CB0Accepted !== true
  || artifact.phase2CB1PlanAccepted !== true
  || artifact.phase2CB1aAllowed !== true
  || artifact.phase2CB1aImplemented !== true
  || artifact.phase2CB1aAccepted !== false
  || artifact.phase2CB1bAllowed !== false
  || artifact.actualMigrationAllowed !== false
  || artifact.phase2CB1aDriveReadback !== true
  || artifact.zeroModelCallsDuringPhase2CB1a !== true
  || artifact.zeroNetworkCallsDuringPhase2CB1a !== true
  || artifact.exactSourceOpenedDuringPhase2CB1a !== false
  || artifact.realMigrationTargetCreatedDuringPhase2CB1a !== false
  || artifact.sanitizedTemporaryTargetsUsedDuringPhase2CB1a !== true
  || artifact.migrationExecutedDuringPhase2CB1a !== false
  || artifact.automaticRetryAllowedDuringPhase2CB1a !== false
) fail("ARTIFACT_REVISION.json does not preserve implemented B1a / blocked B1b boundary.");
NODE
echo "Release documentation gate passed for ${package_version} Phase 2C-B1a implemented pre-merge boundary."

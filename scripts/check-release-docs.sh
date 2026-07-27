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
require_text "README.md" "Phase 2C-B1a — accepted"
require_text "README.md" "aec5edaca877cec5d769f4ce4efff674a9c92a7d"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-B1a — принята"
require_text "project-docs/PROJECT_INSTRUCTION.md" "B1a принята"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-B1a — accepted recovery boundary"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-B1a merge and post-merge Drive provenance"
require_text "docs/architecture/WORK_STOP.md" "Work boundary after Phase 2C-B1a acceptance"
require_text "docs/architecture/KNOWN_GAPS.md" "Known gaps after Phase 2C-B1a acceptance"
require_text "docs/architecture/DECISION_LOG.md" "ADR-012"
require_text "project-docs/evidence/PHASE2CB_B1A_ACCEPTANCE.md" "58d2bb0e9b7edebb3d3d830064406feffbff5181"
require_text "project-docs/evidence/PHASE2CB_B1A_ACCEPTANCE.md" "B1b is not authorized automatically"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-phase2cb-b1a-accepted-b1b-blocked"
require_text "ARTIFACT_REVISION.json" "aec5edaca877cec5d769f4ce4efff674a9c92a7d"

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

const expectedRevisions = {
  instruction: "AIroW35Y1U0r_r73mOrdrwqiiIOSGsKbah6EXtyEdM28wfo8egtsiBsD4Q7EsKr-QYPnXd-gsFEUqO3zDx_PYYnk2Q8D_i_ZQYAdo164AXc",
  status: "AIroW34oLCkzUN9QtOSaR-ptpPWPh03tV5RVUAHyxOwfyzbSH58we1dihjmRUsrfLq0ucd3w5FGbmSYZBjrmNZ0rAJJ1S_K9mpKNwBlQe6c",
  recovery: "AIroW35wmk74YOmnEwaipn2u_530U4qTtSsbRFFwsWmmhc4rvNmhnYFc7rdz-9F1XRDcG_C1VdWIhe0q_dFxBfsOZH3i5BXOrmyenwcuudk",
};

if (drive.version !== expectedVersion) fail("Drive version mismatch.");
if (drive.artifactRevision !== 9) fail("Drive artifact revision is not 9.");
if (drive.syncStatus !== "synced_native_google_docs_verified") fail("Drive sync is not verified.");
if (drive.readBackAt !== drive.syncedAt) fail("Drive readback time mismatch.");

const documents = Array.isArray(drive.documents) ? drive.documents : [];
if (documents.length !== 3 || documents.some((item) =>
  item?.revisionId !== item?.driveRevisionId
  || item?.readBackStatus !== "verified"
)) fail("Drive document revision/readback evidence is incomplete.");

const revisions = Object.fromEntries(documents.map((item) => [item.name, item.revisionId]));
if (revisions["MindMap — инструкция проекта.md"] !== expectedRevisions.instruction) fail("instruction revision mismatch.");
if (revisions["MindMap — решения и статус.md"] !== expectedRevisions.status) fail("status revision mismatch.");
if (revisions["MindMap — восстановление и бюджет локальной модели.md"] !== expectedRevisions.recovery) fail("recovery revision mismatch.");

const audit = drive.architectureAudit ?? {};
if (
  audit.phase2CB1aImplemented !== true
  || audit.phase2CB1aAccepted !== true
  || audit.phase2CB1bAllowed !== false
  || audit.phase2CB1Allowed !== false
  || audit.actualMigrationAllowed !== false
  || audit.phase2CB1aPostMergeDriveReadback !== true
  || audit.exactSourceOpenedDuringPhase2CB1a !== false
  || audit.realMigrationTargetCreatedDuringPhase2CB1a !== false
  || audit.migrationExecutedDuringPhase2CB1a !== false
  || audit.zeroModelCallsDuringPhase2CB1a !== true
  || audit.zeroNetworkCallsDuringPhase2CB1a !== true
  || audit.automaticRetryAllowedDuringPhase2CB1a !== false
) fail("DRIVE_SYNC.json does not preserve accepted B1a / blocked B1b boundary.");

const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;
if (
  artifact.appVersion !== expectedVersion
  || artifact.artifactRevision !== 9
  || artifact.status !== "frozen-legacy-runtime-phase2cb-b1a-accepted-b1b-blocked"
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.phase2CB1aImplemented !== true
  || artifact.phase2CB1aAccepted !== true
  || artifact.phase2CB1bAllowed !== false
  || artifact.phase2CB1Allowed !== false
  || artifact.actualMigrationAllowed !== false
  || artifact.phase2CB1aPostMergeDriveReadback !== true
  || artifact.exactSourceOpenedDuringPhase2CB1a !== false
  || artifact.realMigrationTargetCreatedDuringPhase2CB1a !== false
  || artifact.migrationExecutedDuringPhase2CB1a !== false
  || artifact.zeroModelCallsDuringPhase2CB1a !== true
  || artifact.zeroNetworkCallsDuringPhase2CB1a !== true
  || artifact.automaticRetryAllowedDuringPhase2CB1a !== false
  || artifact.phase2CB1aMergeCommit !== "aec5edaca877cec5d769f4ce4efff674a9c92a7d"
  || artifact.phase2CB1aFinalSharedTree !== "58d2bb0e9b7edebb3d3d830064406feffbff5181"
) fail("ARTIFACT_REVISION.json does not preserve accepted B1a / blocked B1b provenance.");
NODE

echo "Release documentation gate passed for ${package_version} Phase 2C-B1a accepted / B1b blocked boundary."

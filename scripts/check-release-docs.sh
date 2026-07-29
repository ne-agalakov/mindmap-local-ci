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
require_text "README.md" "Phase 2C-B1b — accepted boundary"
require_text "README.md" "Phase 2C-C0 — active design gate"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-C0 — активный design gate"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Активный этап — Phase 2C-C0"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-C0 — immutable-generation recovery architecture"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-C0 provenance rule"
require_text "docs/architecture/WORK_STOP.md" "Work boundary during Phase 2C-C0 design"
require_text "docs/architecture/KNOWN_GAPS.md" "Known gaps during Phase 2C-C0"
require_text "docs/architecture/DECISION_LOG.md" "ADR-014 — Immutable generations and atomic activation registry"
require_text "docs/architecture/DECISION_LOG.md" "ADR-015 — Source artifact provenance must identify the actual checkout"
require_text "project-docs/evidence/PHASE2CB_B1B_ACCEPTANCE.md" "6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689"
require_text "project-docs/architecture/ADR-0002_PHASE2CC_GENERATION_REGISTRY.md" "mindmap-state-core-control-v1"
require_text "project-docs/evidence/PHASE2CC_C0_CONTRACT.md" "execution prohibited"
require_text "project-docs/evidence/PHASE2CC_C0_FAILURE_MATRIX.md" "zero automatic retry"
require_text "project-docs/evidence/PHASE2CC_C0_IMPLEMENTATION_PLAN.md" "C3 — sanitized runtime resolver integration"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-b1b-accepted-phase2cc-c0-design-active"
require_text "ARTIFACT_REVISION.json" "4fd14e515d2c4234f70effa475381f47bbb50e8b"
require_text "ARTIFACT_REVISION.json" "mindmap-state-core-v1-generation-"

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
  instruction: "AIroW36ZcWf_JfFt7lK5XDAm_EdJkxW3yXl7wQnfTToXePFL68CY6a_X3hKsPoNG0TgPjKbmlzRIZvvBQMFpJgOW19KCPufzQS_DfhD68hU",
  status: "AIroW34l1sBtHBG5ZUYUU2SwNRaYFkstTjjtij-ToqQygfDwhmKl9ToxveQyp_2jXaa3thobaQFYELKCMNlYg7bOeMf852cnLvyDRZ-QmaA",
  recovery: "AIroW37oAXT98v14qVvTmdfUH492jkIdla-LdeGCrmHK4Q0P7KGX3FnpZBfRVeWF2VSegDdqdnZf0kUitkbRev0IbdjUHAM-KWMSKhjfr5Y",
};

if (drive.version !== expectedVersion) fail("Drive version mismatch.");
if (drive.artifactRevision !== 10) fail("Drive artifact revision is not 10.");
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
  audit.phase2CB1bAccepted !== true
  || audit.phase2CB1bAttemptConsumed !== true
  || audit.phase2CB1bMergeCommit !== "4fd14e515d2c4234f70effa475381f47bbb50e8b"
  || audit.phase2CC0Allowed !== true
  || audit.phase2CC0DesignImplemented !== true
  || audit.phase2CC0Accepted !== false
  || audit.phase2CC1Allowed !== false
  || audit.actualMigrationAllowed !== false
  || audit.exactSourceOpenedDuringPhase2CC0 !== false
  || audit.backupCreatedDuringPhase2CC0 !== false
  || audit.controlRegistryCreatedDuringPhase2CC0 !== false
  || audit.productionGenerationCreatedDuringPhase2CC0 !== false
  || audit.actualMigrationExecutedDuringPhase2CC0 !== false
  || audit.zeroModelCallsDuringPhase2CC0 !== true
  || audit.zeroNetworkCallsDuringPhase2CC0 !== true
  || audit.automaticRetryAllowedDuringPhase2CC0 !== false
  || audit.controlRegistryName !== "mindmap-state-core-control-v1"
  || audit.generationPrefix !== "mindmap-state-core-v1-generation-"
) fail("DRIVE_SYNC.json does not preserve accepted B1b / C0-design-only boundary.");

const expectedDriveStatus = `synced_native_google_docs_verified_${drive.syncedAt}`;
if (
  artifact.appVersion !== expectedVersion
  || artifact.artifactRevision !== 10
  || artifact.status !== "frozen-legacy-runtime-b1b-accepted-phase2cc-c0-design-active"
  || artifact.driveSyncStatus !== expectedDriveStatus
  || artifact.repository !== "resolved-from-actual-checkout-at-package-time"
  || artifact.repositoryCommit !== "resolved-at-build-or-package-time"
  || artifact.phase2CB1bAccepted !== true
  || artifact.phase2CB1bAttemptConsumed !== true
  || artifact.phase2CB1bMergeCommit !== "4fd14e515d2c4234f70effa475381f47bbb50e8b"
  || artifact.phase2CB1bActualMigrationPerformed !== false
  || artifact.phase2CB1bAutomaticRetryAllowed !== false
  || artifact.phase2CC0Allowed !== true
  || artifact.phase2CC0DesignImplemented !== true
  || artifact.phase2CC0Accepted !== false
  || artifact.phase2CC1Allowed !== false
  || artifact.actualMigrationAllowed !== false
  || artifact.phase2CC0ExactSourceOpened !== false
  || artifact.phase2CC0BackupCreated !== false
  || artifact.phase2CC0ControlRegistryCreated !== false
  || artifact.phase2CC0ProductionGenerationCreated !== false
  || artifact.phase2CC0ActualMigrationPerformed !== false
  || artifact.phase2CC0ZeroModelCalls !== true
  || artifact.phase2CC0ZeroNetworkCalls !== true
  || artifact.phase2CC0AutomaticRetryAllowed !== false
  || artifact.phase2CC0ControlRegistryName !== "mindmap-state-core-control-v1"
  || artifact.phase2CC0GenerationPrefix !== "mindmap-state-core-v1-generation-"
  || artifact.driveRevisions?.instruction !== expectedRevisions.instruction
  || artifact.driveRevisions?.status !== expectedRevisions.status
  || artifact.driveRevisions?.recovery !== expectedRevisions.recovery
) fail("ARTIFACT_REVISION.json does not preserve accepted B1b / C0-design-only provenance.");
NODE

echo "Release documentation gate passed for ${package_version}: B1b accepted and consumed; Phase 2C-C0 design active; actual migration blocked."

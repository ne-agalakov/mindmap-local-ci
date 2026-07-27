#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"
package_version="$(node --input-type=module -e 'import packageJson from "./package.json" with { type: "json" }; process.stdout.write(packageJson.version)')"
release_label="${package_version%.0-alpha.*}-alpha.${package_version##*.}"
alpha_number="${package_version##*.}"
require_text() {
  local file="$1"; local expected="$2"
  if ! grep -Fq -- "${expected}" "${file}"; then
    echo "Release documentation gate failed: ${file} does not contain ${expected}" >&2; exit 65
  fi
}
require_text "app/lib/semantic-pipeline.ts" "SEMANTIC_PIPELINE_VERSION = \"${package_version}\""
require_text "app/page.tsx" "appVersion: \"${package_version}\""
require_text "app/page.tsx" "<small>v0.6 alpha.${alpha_number}</small>"
require_text "start-mindmap.command" "MindMap v${release_label}"
require_text "README.md" "# MindMap Local v${release_label}"
require_text "README.md" "Phase 2C-B0 — accepted"
require_text "README.md" "dbf2484c78e4eedcbb2efb3f0b61394b79a6d216"
require_text "project-docs/PROJECT_STATUS.md" "Phase 2C-B0 — принята"
require_text "project-docs/PROJECT_STATUS.md" "Следующий проверяемый шаг после B0"
require_text "project-docs/PROJECT_INSTRUCTION.md" "Принятая граница Phase 2C-B0"
require_text "project-docs/RECOVERY_AND_MODEL_BUDGET.md" "Phase 2C-B0 — принятая recovery boundary"
require_text "project-docs/GITHUB_PROVENANCE.md" "Phase 2C-B0 final acceptance provenance"
require_text "docs/architecture/PHASE2CB_MAPPING_CONTRACT.md" "phase2cb-mapping-v1"
require_text "docs/architecture/WORK_STOP.md" "Work boundary after Phase 2C-B0 acceptance"
require_text "docs/architecture/KNOWN_GAPS.md" "Known gaps after Phase 2C-B0 acceptance"
require_text "docs/architecture/DECISION_LOG.md" "ADR-010"
require_text "project-docs/evidence/PHASE2CB_B0_ACCEPTANCE_PROVENANCE.md" "10b0cd7fea77fdff04cf2e072be9604d2a5c05cb"
require_text "ARTIFACT_REVISION.json" "frozen-legacy-runtime-phase2cb-b0-accepted"
require_text "ARTIFACT_REVISION.json" "e13780b4a53b9ebbbd3d2d356e70e42812eb0fcb7a6e71687c012019c88a4069"
instruction_length="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md", "utf8")).length))')"
if (( instruction_length > 8000 )); then echo "Release documentation gate failed: project instruction is ${instruction_length} characters; limit is 8000." >&2; exit 65; fi
node --input-type=module - "${package_version}" <<'NODE'
import { readFile } from "node:fs/promises";
const expectedVersion=process.argv[2];
const fail=(m)=>{console.error(`Release documentation gate failed: ${m}`);process.exit(65)};
let drive,artifact;
try { drive=JSON.parse(await readFile("project-docs/DRIVE_SYNC.json","utf8")); artifact=JSON.parse(await readFile("ARTIFACT_REVISION.json","utf8")); } catch { fail("synchronized JSON is absent or invalid."); }
const documents=Array.isArray(drive.documents)?drive.documents:[];
const checks=Array.isArray(drive.readBackChecks)?drive.readBackChecks:[];
const revisionsValid=documents.length===3 && documents.every((x)=>typeof x?.revisionId==="string" && x.revisionId.length>20 && x.revisionId===x.driveRevisionId && x.readBackStatus==="verified");
const checksValid=checks.length===3 && checks.every((x)=>x?.status==="verified" && x.revisionId===x.driveRevisionId && Array.isArray(x.verifiedMarkers) && x.verifiedMarkers.length>=4);
const markers=new Set(checks.flatMap((x)=>x.verifiedMarkers??[]));
const requiredMarkers=["Phase 2C-B0 — принято после финального gate","Phase 2C-B0 — принят","Phase 2C-B0 — принятая recovery-граница","dbf2484c78e4eedcbb2efb3f0b61394b79a6d216"];
if(drive.version!==expectedVersion)fail("Drive version mismatch.");
if(drive.artifactRevision!==7)fail("Drive artifact revision is not 7.");
if(drive.syncStatus!=="synced_native_google_docs_verified")fail("Drive sync status is not verified.");
if(!drive.syncedAt || drive.readBackAt!==drive.syncedAt)fail("Drive readback time mismatch.");
if(!revisionsValid || !checksValid)fail("Drive revision/readback evidence is incomplete.");
if(!requiredMarkers.every((m)=>markers.has(m)))fail("required accepted B0 Drive markers were not reverse-read.");
const audit=drive.architectureAudit??{};
if(audit.phase2CAAccepted!==true || audit.phase2CB0Implemented!==true || audit.phase2CB0Accepted!==true || audit.phase2CB1Allowed!==false || audit.actualMigrationAllowed!==false || audit.phase2CB0PostMergeDriveReadback!==true || audit.zeroModelCallsDuringPhase2CB0!==true || audit.legacyDatabaseOpenedDuringPhase2CB0!==false || audit.targetDatabaseCreatedDuringPhase2CB0!==false) fail("accepted B0 architecture boundary is not synchronized in DRIVE_SYNC.json.");
const expectedDriveStatus=`synced_native_google_docs_verified_${drive.syncedAt}`;
if(artifact.appVersion!==expectedVersion || artifact.artifactRevision!==7 || artifact.status!=="frozen-legacy-runtime-phase2cb-b0-accepted" || artifact.driveSyncStatus!==expectedDriveStatus || artifact.repository!=="ne-agalakov/mindmap-local" || artifact.phase2CAAccepted!==true || artifact.phase2CB0Implemented!==true || artifact.phase2CB0Accepted!==true || artifact.phase2CB1Allowed!==false || artifact.actualMigrationAllowed!==false || artifact.phase2CB0PostMergeDriveReadback!==true || artifact.zeroModelCallsDuringPhase2CB0!==true || artifact.legacyDatabaseOpenedDuringPhase2CB0!==false || artifact.targetDatabaseCreatedDuringPhase2CB0!==false) fail("ARTIFACT_REVISION.json does not preserve the accepted B0 / blocked B1 boundary.");
NODE
echo "Release documentation gate passed for ${package_version} Phase 2C-B0 accepted boundary."

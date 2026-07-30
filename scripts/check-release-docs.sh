#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }

require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C3 — accepted"
require_text README.md "Phase 2C-C4 — planning contract implemented, acceptance pending"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C3 — принята"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C4 — planning candidate"
require_text project-docs/PROJECT_INSTRUCTION.md "C4 planning candidate"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "C4 planning recovery contract"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C3 accepted provenance"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C4 planning candidate"
require_text docs/architecture/PHASE2CC_C4_EXECUTION_CONTRACT.md "planning candidate only"
require_text docs/architecture/PHASE2CC_C4_FAILURE_MATRIX.md "No runner or exact-source action is authorized"
require_text docs/architecture/PHASE2CC_C4_PACKAGE_INVENTORY.md "No package is built by this document"
require_text project-docs/evidence/PHASE2CC_C4_PLANNING_ACCEPTANCE.md "Status: planning candidate"
require_text project-docs/evidence/PHASE2CC_C4_STATUS.md "Status: acceptance candidate; final exact-tree and factual merge pending"
require_text docs/architecture/DECISION_LOG.md "ADR-021 — Proposed C4 one-shot execution and separate rollback authorization"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-c2-c3-accepted-c4-planning-implemented-final-gate-pending"
require_text ARTIFACT_REVISION.json "115554301ca88330ca44a89de72eadd44e24d9f1"

length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }

node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={
  instruction:'AIroW37dz1nn6rBTdLtg0EHaC7Duk32o-q7tgRM2gUiw1QEQLTVtL0kaaI0Q2WrAAOcYWaX9a9IQFTtguJzIVO5kFNAL9tA5UO3fDGEwie0',
  status:'AIroW36TEfgFTf85Mf4KyB4mU1-xsKIYo0yanHePStI7CpFvarT3lImSpLDB4uscBbhHB0Asp4bS1xtJA86kot7bX-8r3WGLAmIN3N-eh1s',
  recovery:'AIroW36zpe6A-updBZsvcbBeWTiPhaeX3QN4YmfVsEsGOQKwdxXYGhvBCX5GGAtgusSuFPDDoROQoe47V1Bbhl973TgvHQ-PmE339hMWyyQ'
};
if(drive.artifactRevision!==18||artifact.artifactRevision!==18) fail('artifact revision is not 18');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
const docById=Object.fromEntries(drive.documents.map((d)=>[d.driveFileId,d]));
if(docById['1xgGXZfZ8zYxHugvj1kzNztyJwoLQHhWoxDHJqMtd5Go']?.revisionId!==revisions.instruction) fail('instruction Drive revision mismatch');
if(docById['1rMr251zul62o6cDlAjdK_fA0BRTZWmX4cTJldnfIKVQ']?.revisionId!==revisions.status) fail('status Drive revision mismatch');
if(docById['1cfEpjDRWdkyyH3JmbeCBSBBW4zIaKi13lzC_Feqe0aw']?.revisionId!==revisions.recovery) fail('recovery Drive revision mismatch');
if(!drive.architectureAudit?.phase2CC4PlanningImplemented||drive.architectureAudit?.phase2CC4PlanningAccepted!==false||drive.architectureAudit?.phase2CC4ImplementationAllowed!==false||drive.architectureAudit?.phase2CC4ExecutionAllowed!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C4 planning boundary invalid');
if(!artifact.phase2CC4PlanningImplemented||artifact.phase2CC4PlanningAccepted!==false||artifact.phase2CC4ImplementationAllowed!==false||artifact.phase2CC4ExecutionAllowed!==false||artifact.actualMigrationAllowed!==false) fail('artifact C4 planning boundary invalid');
if(artifact.phase2CC4InitialSharedTree!=='115554301ca88330ca44a89de72eadd44e24d9f1'||artifact.phase2CC4InitialVerifyRun!==30548925903||artifact.phase2CC4InitialPackageRun!==30548925878) fail('C4 initial evidence mismatch');
if(artifact.phase2CC4ExactSourceOpened||artifact.phase2CC4B1bRepeated||artifact.phase2CC4BackupAccessed||artifact.phase2CC4ProductionNamespaceUsed||artifact.phase2CC4RunnerCreated||artifact.phase2CC4LauncherCreated||artifact.phase2CC4PackageCreated||artifact.phase2CC4AuthorizationCreated||artifact.phase2CC4ActualMigrationPerformed||artifact.phase2CC4PromotionPerformed||artifact.phase2CC4RollbackPerformed||!artifact.phase2CC4ZeroNetworkCalls||!artifact.phase2CC4ZeroModelCalls||artifact.phase2CC4PersonalDataUsed||artifact.phase2CC4AutomaticResumeAllowed||artifact.phase2CC4AutomaticRetryAllowed) fail('prohibited C4 planning boundary changed');
NODE

echo "Release documentation gate passed: C4 planning implemented; final acceptance pending; implementation/execution and actual migration blocked."

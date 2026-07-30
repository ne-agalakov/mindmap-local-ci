#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C2 — final proof complete, merge pending"
require_text project-docs/PROJECT_STATUS.md "final proof complete, merge pending"
require_text project-docs/PROJECT_INSTRUCTION.md "C2 native IndexedDB final proof завершён"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "Phase 2C-C2 final recovery proof"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C2 final pre-merge provenance"
require_text project-docs/evidence/PHASE2CC_C2_STATUS.md "factual merge pending"
require_text project-docs/evidence/PHASE2CC_C2_ACCEPTANCE.md "not accepted before factual merge"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-accepted-c2-final-proof-complete-merge-pending"
require_text ARTIFACT_REVISION.json "158527376a989b304f097006ba39488d79a04c8f"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={instruction:'AIroW351BiZxRA9BlDODd4AoCRz66_zc2xF5MMc9ZTeeYCL9PxUlrxXtYcpmqEoRcnpvDQw2-PomWcbZISNyXFckzdbIDSZLAusXYEKJRBk',status:'AIroW37DcQZ0ZsyFsMTd1d3hCDgJDvN73isYLAh0j7dS9OAnWTvny2moNhnstAiy6bbBECKTac8ks82trFK08uJ5pRWJIHvHyqMEvcr7sdc',recovery:'AIroW35nLCHqqsHseRlCNKsP7HsxgygsSGLKGyrk5HMXc3YJvUU5ayvoqA0e1SvIyBEMOIC5QxEZMGG_6YbRLOisZ-AIIIWkNyHr151bIoc'};
if(drive.artifactRevision!==14||artifact.artifactRevision!==14) fail('artifact revision is not 14');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC1Accepted||!drive.architectureAudit?.phase2CC2FinalProofPassed||drive.architectureAudit?.phase2CC2Accepted!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive final C2 boundary invalid');
if(!artifact.phase2CC1Accepted||!artifact.phase2CC2Implemented||artifact.phase2CC2Accepted!==false||artifact.actualMigrationAllowed!==false) fail('artifact final C2 boundary invalid');
if(artifact.phase2CC2PrivatePullRequest!==54||artifact.phase2CC2FinalSharedTree!=='158527376a989b304f097006ba39488d79a04c8f'||artifact.phase2CC2FinalVerifyRun!==30516236010||artifact.phase2CC2FinalPackageRun!==30516236013) fail('final C2 identity mismatch');
if(artifact.driveRevisions?.instruction!==revisions.instruction||artifact.driveRevisions?.status!==revisions.status||artifact.driveRevisions?.recovery!==revisions.recovery) fail('Drive revisions mismatch');
if(artifact.phase2CC2ExactSourceOpened||artifact.phase2CC2B1bRepeated||artifact.phase2CC2BackupAccessed||artifact.phase2CC2ProductionNamespaceUsed||artifact.phase2CC2ActualMigrationPerformed||!artifact.phase2CC2ZeroNetworkCalls||!artifact.phase2CC2ZeroModelCalls||artifact.phase2CC2PersonalDataUsed||artifact.phase2CC2AutomaticResumeAllowed||artifact.phase2CC2AutomaticRetryAllowed) fail('prohibited C2 boundary changed');
NODE
echo "Release documentation gate passed: C2 final proof complete, factual merge pending, actual migration blocked."

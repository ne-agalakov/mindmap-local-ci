#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C2 — accepted"
require_text README.md "Phase 2C-C3 — allowed boundary"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C2 — принята"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C3 — разрешена, не начата"
require_text project-docs/PROJECT_INSTRUCTION.md "Phase 2C-C3 — разрешённая граница"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "Phase 2C-C2 — recovery contract принят"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C2 accepted provenance"
require_text project-docs/evidence/PHASE2CC_C2_STATUS.md "Status: accepted after factual merge"
require_text project-docs/evidence/PHASE2CC_C2_ACCEPTANCE.md "Status: accepted by factual merge"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-c2-accepted-c3-allowed"
require_text ARTIFACT_REVISION.json "2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={instruction:'AIroW352hFBMVLBL1oMIir5Zq5BCU0Sbb8Pwm2UFfv1itoswe3bsD6a5lsv72h1XsHGtC_AgdnqxteL_r1h6co9p5bAeTQtTbBqnFQ4Ab-Y',status:'AIroW37IXBsdEtyrUSjju2-lH_iLrilDjW4mm-W6_WkCN9CNmKGSi2gKWvGd00jtRS8TB3s0CokF83xEHOeU2vUQxXKfPLa1oI5Ma7rDr5Q',recovery:'AIroW37J7McEeBCWTQ5dA7ciVrDy7ywGBtTEO92Iuquy8Yb3gYtPxkQDuVtUInow1V-UlEMvKwmSaavIkFUZd35zyUCjdc4L9c0xcTHCLoc'};
if(drive.artifactRevision!==15||artifact.artifactRevision!==15) fail('artifact revision is not 15');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC2Accepted||!drive.architectureAudit?.phase2CC3Allowed||drive.architectureAudit?.phase2CC3Implemented!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C2/C3 boundary invalid');
if(!artifact.phase2CC2Accepted||artifact.phase2CC2MergeCommit!=='2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1'||!artifact.phase2CC3Allowed||artifact.phase2CC3Implemented!==false||artifact.actualMigrationAllowed!==false) fail('artifact C2/C3 boundary invalid');
if(artifact.phase2CC2FinalSharedTree!=='e6d0c0793ca6f5d20352d79e03fd12ca70f961bc'||artifact.phase2CC2FinalVerifyRun!==30517144927||artifact.phase2CC2FinalPackageRun!==30517144960) fail('accepted C2 identity mismatch');
if(artifact.driveRevisions?.instruction!==revisions.instruction||artifact.driveRevisions?.status!==revisions.status||artifact.driveRevisions?.recovery!==revisions.recovery) fail('Drive revisions mismatch');
if(artifact.phase2CC2ExactSourceOpened||artifact.phase2CC2B1bRepeated||artifact.phase2CC2BackupAccessed||artifact.phase2CC2ProductionNamespaceUsed||artifact.phase2CC2ActualMigrationPerformed||!artifact.phase2CC2ZeroNetworkCalls||!artifact.phase2CC2ZeroModelCalls||artifact.phase2CC2PersonalDataUsed||artifact.phase2CC2AutomaticResumeAllowed||artifact.phase2CC2AutomaticRetryAllowed) fail('prohibited C2 boundary changed');
NODE
echo "Release documentation gate passed: C2 accepted, C3 resolver boundary allowed, actual migration blocked."

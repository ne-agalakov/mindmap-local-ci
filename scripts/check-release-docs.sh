#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-B1a — accepted"
require_text README.md "Phase 2C-B1b — accepted boundary"
require_text README.md "Phase 2C-C0 — accepted"
require_text README.md "Phase 2C-C1 — accepted"
require_text README.md "Phase 2C-C2 — implementation verified, acceptance pending"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C1 — принята"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C2 — реализация проверена"
require_text project-docs/PROJECT_INSTRUCTION.md "Phase 2C-C2"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "Phase 2C-C2 native recovery proof"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C2 implementation proof"
require_text project-docs/evidence/PHASE2CC_C1_ACCEPTANCE.md "Status: accepted"
require_text project-docs/evidence/PHASE2CC_C2_STATUS.md "final documentation gate pending"
require_text project-docs/evidence/PHASE2CC_C2_ACCEPTANCE.md "Status: candidate"
require_text docs/architecture/ADR-0019-C2-NATIVE-INDEXEDDB.md "C2 native IndexedDB uses isolated physical fixture namespaces"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-accepted-c2-implemented-final-gate-pending"
require_text ARTIFACT_REVISION.json "088cdf17babc38f559559aa794360f2b1a4a9344"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={instruction:'AIroW36JUhPMHkePjIskqQvhd7CvVxor4PPe_z2ANYZDFtrKLphCUOYgiZ6GegkfFqofJc7J5T0K7jq1jh3WVKUS53NSCJZTg_w9rn8j_ac',status:'AIroW35EBFWTcaYlOxafpEyhuWhIPYvxC1oIfE94CwE0MUETWL_u3eTEL6WWi1SSx8NgZVO6RPzwr2PLSJa5Cgfu8huD6LduyWOLcO3jFVM',recovery:'AIroW37UeIKl_h4agBNEXM41SEMjrMYjGWlcRQWRLwf7FVPfRiZpSNb-goYBFZjRD2h5FY52C4A-rgtt0p2huHmHCv1r5YGsOZowIE6O-zA'};
if(drive.artifactRevision!==14||artifact.artifactRevision!==14) fail('artifact revision is not 14');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC1Accepted||!drive.architectureAudit?.phase2CC2Implemented||drive.architectureAudit?.phase2CC2Accepted!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C2 boundary invalid');
if(!artifact.phase2CC1Accepted||!artifact.phase2CC2Implemented||artifact.phase2CC2Accepted!==false||artifact.actualMigrationAllowed!==false) fail('artifact C2 boundary invalid');
if(artifact.phase2CC1MergeCommit!=='f8ac03fbb24493dbeac7385687b3f4a93eb10bf8') fail('C1 merge mismatch');
if(artifact.phase2CC2CandidateSharedTree!=='088cdf17babc38f559559aa794360f2b1a4a9344') fail('C2 candidate tree mismatch');
if(artifact.driveRevisions?.instruction!==revisions.instruction||artifact.driveRevisions?.status!==revisions.status||artifact.driveRevisions?.recovery!==revisions.recovery) fail('Drive revisions mismatch');
if(artifact.phase2CC2ExactSourceOpened||artifact.phase2CC2B1bRepeated||artifact.phase2CC2BackupAccessed||artifact.phase2CC2ProductionNamespaceUsed||artifact.phase2CC2ActualMigrationPerformed||!artifact.phase2CC2ZeroNetworkCalls||!artifact.phase2CC2ZeroModelCalls||artifact.phase2CC2PersonalDataUsed||artifact.phase2CC2AutomaticResumeAllowed||artifact.phase2CC2AutomaticRetryAllowed) fail('prohibited C2 boundary changed');
NODE
echo "Release documentation gate passed: C1 accepted, C2 implementation verified and acceptance pending, actual migration blocked."

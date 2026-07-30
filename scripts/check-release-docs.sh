#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C2 — accepted"
require_text README.md "Phase 2C-C3 — implementation verified, acceptance pending"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C3 — реализация проверена"
require_text project-docs/PROJECT_INSTRUCTION.md "Phase 2C-C3 — реализация проверена"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "Phase 2C-C3 recovery proof"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C3 implementation proof"
require_text project-docs/evidence/PHASE2CC_C3_STATUS.md "Status: implementation verified; final documentation gate pending"
require_text project-docs/evidence/PHASE2CC_C3_ACCEPTANCE.md "Status: candidate; not accepted"
require_text docs/architecture/ADR-0020-C3-PACKAGED-RUNTIME-RESOLVER.md "The packaged runtime resolves only the active immutable generation"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-c2-accepted-c3-implemented-final-gate-pending"
require_text ARTIFACT_REVISION.json "56e846d49a17f15bbbd1eedfc626f316e3a29a91"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={instruction:'AIroW36i4K512dFd3aOyA6k1NuKxUhb6e4yDBNZmNUhIRb2l7MI6S5DlD8z0e0sClsSj_nhW2amXsEOE8L6GKcN16cmTp1qJhdc2vI5KgxU',status:'AIroW367Kf20zX2jesCYRZrbABR7m7UT9wLQCI8clUla7RxAaorpvB5jFV-P7HbLHF-KgmdTiKI7S3oXwZTJUHNIvoxnOK3lCwTbSdGPYRM',recovery:'AIroW35QzcSOaWNSoOF1e3RrnWy8mDT4_dsAiGFAAdBxsf20sRGZyYidUOxJfzRVgVg3T3C-wzRFItKzvGeb4rE8pM4G3tRMZsdzm1UGsE4'};
if(drive.artifactRevision!==16||artifact.artifactRevision!==16) fail('artifact revision is not 16');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC2Accepted||!drive.architectureAudit?.phase2CC3Implemented||drive.architectureAudit?.phase2CC3Accepted!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C3 boundary invalid');
if(!artifact.phase2CC2Accepted||!artifact.phase2CC3Implemented||artifact.phase2CC3Accepted!==false||artifact.actualMigrationAllowed!==false) fail('artifact C3 boundary invalid');
if(artifact.phase2CC3InitialSharedTree!=='56e846d49a17f15bbbd1eedfc626f316e3a29a91'||artifact.phase2CC3InitialVerifyRun!==30535292820||artifact.phase2CC3InitialPackageRun!==30535292824) fail('C3 implementation identity mismatch');
if(artifact.driveRevisions?.instruction!==revisions.instruction||artifact.driveRevisions?.status!==revisions.status||artifact.driveRevisions?.recovery!==revisions.recovery) fail('Drive revisions mismatch');
if(artifact.phase2CC3ExactSourceOpened||artifact.phase2CC3B1bRepeated||artifact.phase2CC3BackupAccessed||artifact.phase2CC3ProductionNamespaceUsed||artifact.phase2CC3ActualMigrationPerformed||artifact.phase2CC3FallbackUsed||!artifact.phase2CC3ZeroNetworkCalls||!artifact.phase2CC3ZeroModelCalls||artifact.phase2CC3PersonalDataUsed||artifact.phase2CC3AutomaticResumeAllowed||artifact.phase2CC3AutomaticRetryAllowed) fail('prohibited C3 boundary changed');
NODE
echo "Release documentation gate passed: C3 implementation verified, final acceptance pending, C4 and actual migration blocked."

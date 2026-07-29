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
require_text README.md "Phase 2C-C1 — implementation verified, acceptance pending"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C1 — реализация проверена"
require_text project-docs/PROJECT_INSTRUCTION.md "Phase 2C-C1"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "C1 recovery contract"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C1 implementation proof"
require_text project-docs/evidence/PHASE2CC_C1_STATUS.md "final documentation gate pending"
require_text project-docs/evidence/PHASE2CC_C1_ACCEPTANCE.md "Status: candidate"
require_text docs/architecture/DECISION_LOG.md "ADR-018 — C1 acceptance requires a final documentation tree"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-accepted-c0-accepted-c1-implemented-final-gate-pending"
require_text ARTIFACT_REVISION.json "2a536a54779634647eff8ebf2476840c257b2813"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
const revisions={instruction:'AIroW34tzLmd8HTP9DN3NKmMSV7HCSbwHUe5cJGk4IWBFlh2so6uYEVZgV1_wjpy-txngVwmDthuCPru5ji_sC01ETSxjj_-ar4Y1nC6Psc',status:'AIroW36QEfxjBIgX4eBpJDs417UedU1tntDvR1xAYGfNV7gineBxkpqBaGcxUshjJVDgReUTZ8zJID5UtoKSFv6XAKlGIg1iEBtFuSXQX6A',recovery:'AIroW3622GpJz2bexdL7ckeGOfb_y23IwvozDlSrHcFSSvG9TAiau8_3pEEMy1Pb0bUq7orYWGtPfFXUYBKbr6TX6XNgApvxoY-qLsVDNO0'};
if(drive.artifactRevision!==13||artifact.artifactRevision!==13) fail('artifact revision is not 13');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC1Implemented||drive.architectureAudit?.phase2CC1Accepted!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C1 boundary invalid');
if(!artifact.phase2CC1Implemented||artifact.phase2CC1Accepted!==false||artifact.actualMigrationAllowed!==false) fail('artifact C1 boundary invalid');
if(artifact.phase2CC1InitialSharedTree!=='2a536a54779634647eff8ebf2476840c257b2813') fail('C1 tree mismatch');
if(artifact.driveRevisions?.instruction!==revisions.instruction||artifact.driveRevisions?.status!==revisions.status||artifact.driveRevisions?.recovery!==revisions.recovery) fail('Drive revisions mismatch');
if(artifact.phase2CC1ExactSourceOpened||artifact.phase2CC1BackupAccessed||artifact.phase2CC1NativeStorageUsed||artifact.phase2CC1ActualMigrationPerformed||!artifact.phase2CC1ZeroNetworkCalls||!artifact.phase2CC1ZeroModelCalls||artifact.phase2CC1AutomaticRetryAllowed) fail('prohibited C1 boundary changed');
NODE
echo "Release documentation gate passed: C1 implemented, final acceptance pending, actual migration blocked."

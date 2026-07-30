#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text() { grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C3 — accepted"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C3 — принята"
require_text project-docs/PROJECT_INSTRUCTION.md "C0–C3 приняты"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "C3 recovery accepted"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C3 accepted provenance"
require_text project-docs/evidence/PHASE2CC_C3_STATUS.md "Status: accepted after factual merge"
require_text project-docs/evidence/PHASE2CC_C3_ACCEPTANCE.md "Status: accepted"
require_text ARTIFACT_REVISION.json "frozen-legacy-runtime-b1b-consumed-c0-c1-c2-c3-accepted-c4-planning-only"
require_text ARTIFACT_REVISION.json "38b0e3fb9542174328396ae19bff76f18d637f21"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
(( length <= 8000 )) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const drive=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const artifact=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=(m)=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
if(drive.artifactRevision!==17||artifact.artifactRevision!==17) fail('artifact revision is not 17');
if(drive.syncStatus!=='synced_native_google_docs_verified'||drive.readBackAt!==drive.syncedAt) fail('Drive sync/readback invalid');
if(!drive.architectureAudit?.phase2CC3Accepted||!drive.architectureAudit?.phase2CC4PlanningAllowed||drive.architectureAudit?.phase2CC4ImplementationAllowed!==false||drive.architectureAudit?.phase2CC4ExecutionAllowed!==false||drive.architectureAudit?.actualMigrationAllowed!==false) fail('Drive C4 planning boundary invalid');
if(!artifact.phase2CC3Accepted||artifact.phase2CC3MergeCommit!=='38b0e3fb9542174328396ae19bff76f18d637f21'||!artifact.phase2CC4PlanningAllowed||artifact.phase2CC4ImplementationAllowed!==false||artifact.phase2CC4ExecutionAllowed!==false||artifact.actualMigrationAllowed!==false) fail('artifact C3/C4 boundary invalid');
if(artifact.phase2CC3ExactSourceOpened||artifact.phase2CC3B1bRepeated||artifact.phase2CC3BackupAccessed||artifact.phase2CC3ProductionNamespaceUsed||artifact.phase2CC3ActualMigrationPerformed||artifact.phase2CC3FallbackUsed||!artifact.phase2CC3ZeroNetworkCalls||!artifact.phase2CC3ZeroModelCalls||artifact.phase2CC3PersonalDataUsed||artifact.phase2CC3AutomaticResumeAllowed||artifact.phase2CC3AutomaticRetryAllowed) fail('prohibited C3 boundary changed');
NODE
echo "Release documentation gate passed: C3 accepted; C4 planning only; execution and actual migration blocked."

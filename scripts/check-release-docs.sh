#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
version="$(node --input-type=module -e 'import p from "./package.json" with { type: "json" }; process.stdout.write(p.version)')"
release_label="${version%.0-alpha.*}-alpha.${version##*.}"
require_text(){ grep -Fq -- "$2" "$1" || { echo "Release documentation gate failed: $1 missing $2" >&2; exit 65; }; }
require_text README.md "# MindMap Local v${release_label}"
require_text README.md "Phase 2C-C4 planning — accepted"
require_text project-docs/PROJECT_STATUS.md "Phase 2C-C4 planning — принята"
require_text project-docs/PROJECT_INSTRUCTION.md "Current implementation gate"
require_text project-docs/RECOVERY_AND_MODEL_BUDGET.md "Accepted C4 planning recovery"
require_text project-docs/GITHUB_PROVENANCE.md "Phase 2C-C4 planning accepted provenance"
require_text project-docs/evidence/PHASE2CC_C4_STATUS.md "Status: accepted"
require_text project-docs/evidence/PHASE2CC_C4_PLANNING_ACCEPTANCE.md "Status: accepted"
require_text docs/architecture/ADR-022_C4_PLANNING_ACCEPTED.md "Accept C4 planning contract; allow sanitized implementation only"
require_text ARTIFACT_REVISION.json "c4-planning-accepted-implementation-sanitized-only"
require_text ARTIFACT_REVISION.json "2c1f476685007a8c2fa52288ac00dfff188edb06"
length="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(String(Array.from(readFileSync("project-docs/PROJECT_INSTRUCTION.md","utf8")).length))')"
((length<=8000)) || { echo "Project instruction exceeds 8000 characters: $length" >&2; exit 65; }
node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
const d=JSON.parse(await readFile('project-docs/DRIVE_SYNC.json','utf8'));
const a=JSON.parse(await readFile('ARTIFACT_REVISION.json','utf8'));
const fail=m=>{console.error('Release documentation gate failed: '+m);process.exit(65)};
if(d.artifactRevision!==19||a.artifactRevision!==19) fail('artifact revision is not 19');
if(d.syncStatus!=='synced_native_google_docs_verified'||d.readBackAt!==d.syncedAt) fail('Drive sync invalid');
if(!a.phase2CC4PlanningAccepted||!a.phase2CC4ImplementationAllowed||a.phase2CC4ImplementationScope!=='sanitized-fixtures-only'||a.phase2CC4ExecutionAllowed||a.actualMigrationAllowed) fail('C4 boundary invalid');
if(a.phase2CC4MergeCommit!=='2c1f476685007a8c2fa52288ac00dfff188edb06'||a.phase2CC4FinalSharedTree!=='7d653175805e39eea9c50c5f76e401f285d07976') fail('C4 provenance invalid');
if(a.phase2CC4ExactSourceOpened||a.phase2CC4BackupAccessed||a.phase2CC4ProductionNamespaceUsed||a.phase2CC4ActualMigrationPerformed||a.phase2CC4PromotionPerformed||a.phase2CC4RollbackPerformed||!a.phase2CC4ZeroNetworkCalls||!a.phase2CC4ZeroModelCalls||a.phase2CC4PersonalDataUsed||a.phase2CC4AutomaticResumeAllowed||a.phase2CC4AutomaticRetryAllowed) fail('prohibited C4 action recorded');
NODE
echo "Release documentation gate passed: C4 planning accepted; sanitized implementation only; exact execution blocked."

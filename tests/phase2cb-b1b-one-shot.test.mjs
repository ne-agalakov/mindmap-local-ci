import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("one-shot runner freezes manifest before preflight stop and permanently disables automatic retry", () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-b1b-one-shot-"));
  const home = join(root, "home");
  const packageRoot = join(root, "package");
  const output1 = join(root, "evidence-1");
  const output2 = join(root, "evidence-2");
  mkdirSync(join(packageRoot, "scripts"), { recursive: true });
  mkdirSync(join(packageRoot, "tools"), { recursive: true });
  mkdirSync(home, { recursive: true });
  cpSync(join(process.cwd(), "scripts/run-phase2cb-b1b-one-shot.mjs"), join(packageRoot, "scripts/run-phase2cb-b1b-one-shot.mjs"));
  cpSync(join(process.cwd(), "tools/phase2cb-b1b-exact-source.mjs"), join(packageRoot, "tools/phase2cb-b1b-exact-source.mjs"));
  const commit = "a".repeat(40);
  writeFileSync(join(packageRoot, "B1B_PACKAGE.json"), JSON.stringify({
    schema: "mindmap-phase2cb-b1b-one-shot-package-v1",
    repository: "ne-agalakov/mindmap-local",
    commit,
    tree: "b".repeat(40),
    authorizationId: "artem-2026-07-27-b1b-once",
  }));
  const wrongSource = join(root, "wrong.sqlite");
  writeFileSync(wrongSource, "not the accepted source");

  const first = spawnSync(process.execPath, [
    "--experimental-strip-types", join(packageRoot, "scripts/run-phase2cb-b1b-one-shot.mjs"),
    "--source", wrongSource, "--output", output1, "--headless",
  ], { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.notEqual(first.status, 0);
  assert.match(`${first.stdout}\n${first.stderr}`, /source_size_mismatch/);
  const manifestPath = join(output1, "mindmap-phase2cb-b1b-run-manifest.json");
  const stoppedPath = join(output1, "mindmap-phase2cb-b1b-stopped.json");
  assert.equal(existsSync(manifestPath), true);
  assert.equal(existsSync(stoppedPath), true);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.manifestFrozenBeforeSourceOpen, true);
  assert.equal(manifest.automaticRetryAllowed, false);
  assert.equal(manifest.actualMigrationAllowed, false);
  const stopped = JSON.parse(readFileSync(stoppedPath, "utf8"));
  assert.equal(stopped.result, "stopped");
  assert.equal(stopped.boundaries.automaticRetryAllowed, false);
  assert.equal(stopped.boundaries.actualMigrationPerformed, false);
  assert.equal(stopped.privacy.sourcePathIncluded, false);
  assert.equal(existsSync(join(home, ".mindmap", `phase2cb-b1b-once-${commit}.lock`)), true);

  const second = spawnSync(process.execPath, [
    "--experimental-strip-types", join(packageRoot, "scripts/run-phase2cb-b1b-one-shot.mjs"),
    "--source", wrongSource, "--output", output2, "--headless",
  ], { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.notEqual(second.status, 0);
  assert.match(`${second.stdout}\n${second.stderr}`, /one_shot_already_consumed/);
  assert.equal(existsSync(join(output2, "mindmap-phase2cb-b1b-run-manifest.json")), false);
});

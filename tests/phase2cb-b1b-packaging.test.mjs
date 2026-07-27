import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

const run = (command, args, cwd, env = {}) => execFileSync(command, args, {
  cwd,
  encoding: "utf8",
  env: {
    ...process.env,
    ...env,
    GIT_AUTHOR_NAME: "MindMap CI",
    GIT_AUTHOR_EMAIL: "ci@example.invalid",
    GIT_COMMITTER_NAME: "MindMap CI",
    GIT_COMMITTER_EMAIL: "ci@example.invalid",
  },
}).trim();

test("B1b one-shot package is provenance-bound, executable and excludes source/private payloads", () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-b1b-package-test-"));
  for (const directory of ["scripts", "tools", "tools/browser-phase2cb-b1b-harness/dist/assets", "bin"]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const [source, target] of [
    ["scripts/package-phase2cb-b1b.sh", "scripts/package-phase2cb-b1b.sh"],
    ["scripts/run-phase2cb-b1b-one-shot.mjs", "scripts/run-phase2cb-b1b-one-shot.mjs"],
    ["tools/phase2cb-b1b-exact-source.mjs", "tools/phase2cb-b1b-exact-source.mjs"],
    ["start-phase2cb-b1b.command", "start-phase2cb-b1b.command"],
  ]) cpSync(join(process.cwd(), source), join(root, target));
  chmodSync(join(root, "scripts/package-phase2cb-b1b.sh"), 0o755);
  chmodSync(join(root, "start-phase2cb-b1b.command"), 0o644);
  writeFileSync(join(root, "tools/browser-phase2cb-b1b-harness/dist/index.html"), "<!doctype html><script src='/assets/app.js'></script>\n");
  writeFileSync(join(root, "tools/browser-phase2cb-b1b-harness/dist/assets/app.js"), "globalThis.fixture=true;\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.6.0-alpha.19" }, null, 2));
  writeFileSync(join(root, "bin/npm"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(root, "bin/npm"), 0o755);

  run("git", ["init", "-b", "main"], root);
  run("git", ["add", "."], root);
  run("git", ["commit", "-m", "fixture"], root);
  const commit = run("git", ["rev-parse", "HEAD"], root);
  const tree = run("git", ["rev-parse", "HEAD^{tree}"], root);
  const output = run("bash", ["scripts/package-phase2cb-b1b.sh"], root, { PATH: `${join(root, "bin")}:${process.env.PATH}` }).split("\n");
  const archivePath = output.at(-2);
  const shaPath = output.at(-1);
  const archiveName = basename(archivePath);
  const manifest = readFileSync(shaPath, "utf8").trim();
  const match = manifest.match(/^([a-f0-9]{64})\s{2}(.+)$/);
  assert.ok(match);
  assert.equal(match[2], archiveName);
  assert.equal(match[1], createHash("sha256").update(readFileSync(archivePath)).digest("hex"));

  const extracted = join(root, "extracted");
  mkdirSync(extracted);
  run("unzip", ["-q", archivePath, "-d", extracted], root);
  const firstEntry = run("unzip", ["-Z1", archivePath], root).split("\n").find(Boolean);
  const packageName = firstEntry.split("/")[0];
  const packageRoot = join(extracted, packageName);
  const files = run("find", [packageName, "-type", "f", "-print"], extracted).split("\n").filter(Boolean).sort();
  assert.deepEqual(files, [
    `${packageName}/B1B_PACKAGE.json`,
    `${packageName}/README.txt`,
    `${packageName}/browser/dist/assets/app.js`,
    `${packageName}/browser/dist/index.html`,
    `${packageName}/scripts/run-phase2cb-b1b-one-shot.mjs`,
    `${packageName}/start-phase2cb-b1b.command`,
    `${packageName}/tools/phase2cb-b1b-exact-source.mjs`,
  ]);
  const metadata = JSON.parse(readFileSync(join(packageRoot, "B1B_PACKAGE.json"), "utf8"));
  assert.equal(metadata.repository, "ne-agalakov/mindmap-local");
  assert.equal(metadata.commit, commit);
  assert.equal(metadata.tree, tree);
  assert.equal(metadata.authorizationId, "artem-2026-07-27-b1b-once");
  assert.equal(metadata.expectedSourceSizeBytes, 5_070_848);
  assert.equal(metadata.expectedSourceSha256, "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918");
  assert.equal(metadata.externalNetworkAllowed, false);
  assert.equal(metadata.modelCallsAllowed, false);
  assert.equal(metadata.automaticRetryAllowed, false);
  assert.equal(metadata.actualMigrationAllowed, false);
  assert.equal(metadata.rawSourceIncluded, false);
  assert.notEqual(statSync(join(packageRoot, "start-phase2cb-b1b.command")).mode & 0o111, 0);
  assert.equal(files.some((file) => /\.sqlite$|diagnostic|mindmap-diagnostics|node_modules|\.env/i.test(file)), false);
  const combined = files.map((file) => readFileSync(join(extracted, file), "utf8")).join("\n");
  assert.doesNotMatch(combined, /synthetic-001.*Original|private local MindMap data/);
});

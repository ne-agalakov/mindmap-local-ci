import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import test from "node:test";

const run = (command, args, cwd) => execFileSync(command, args, {
  cwd,
  encoding: "utf8",
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: "MindMap CI",
    GIT_AUTHOR_EMAIL: "ci@example.invalid",
    GIT_COMMITTER_NAME: "MindMap CI",
    GIT_COMMITTER_EMAIL: "ci@example.invalid",
  },
}).trim();

test("compact exporter package is portable, provenance-bound, and contains only read-only runtime files", () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-exporter-package-test-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "tools", "browser-legacy-exporter"), { recursive: true });

  cpSync(join(process.cwd(), "scripts", "package-legacy-exporter.sh"), join(root, "scripts", "package-legacy-exporter.sh"));
  chmodSync(join(root, "scripts", "package-legacy-exporter.sh"), 0o755);
  cpSync(join(process.cwd(), "start-legacy-exporter.command"), join(root, "start-legacy-exporter.command"));
  // GitHub contents writes create files as 0644. Reproduce that exact source mode
  // so the packaging regression proves it repairs the user-facing Mac launcher.
  chmodSync(join(root, "start-legacy-exporter.command"), 0o644);
  for (const name of ["README.md", "core.mjs", "index.html", "page.mjs", "server.mjs"]) {
    cpSync(
      join(process.cwd(), "tools", "browser-legacy-exporter", name),
      join(root, "tools", "browser-legacy-exporter", name),
    );
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.0.0-test" }, null, 2));

  run("git", ["init", "-b", "main"], root);
  run("git", ["add", "."], root);
  run("git", ["commit", "-m", "fixture"], root);
  const commitSha = run("git", ["rev-parse", "HEAD"], root);
  assert.equal(statSync(join(root, "start-legacy-exporter.command")).mode & 0o111, 0);

  const archivePath = run("bash", ["scripts/package-legacy-exporter.sh"], root).split("\n").at(-1);
  const archiveName = basename(archivePath);
  const archiveRoot = archiveName.replace(/\.zip$/, "");
  const manifestPath = `${archivePath}.sha256`;
  const manifest = readFileSync(manifestPath, "utf8").trim();
  const match = manifest.match(/^([a-f0-9]{64})\s{2}(.+)$/);

  assert.ok(match, `unexpected checksum format: ${manifest}`);
  assert.equal(match[2], archiveName);
  assert.equal(match[2].includes("/"), false, "checksum manifest must be portable");
  const actualHash = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  assert.equal(match[1], actualHash);

  const extracted = join(root, "verified-extraction");
  mkdirSync(extracted);
  run("unzip", ["-q", archivePath, "-d", extracted], root);
  const packageRoot = join(extracted, archiveRoot);
  const listed = run("find", [archiveRoot, "-type", "f", "-print"], extracted)
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.deepEqual(listed, [
    `${archiveRoot}/EXPORTER_REVISION.json`,
    `${archiveRoot}/start-legacy-exporter.command`,
    `${archiveRoot}/tools/browser-legacy-exporter/README.md`,
    `${archiveRoot}/tools/browser-legacy-exporter/core.mjs`,
    `${archiveRoot}/tools/browser-legacy-exporter/index.html`,
    `${archiveRoot}/tools/browser-legacy-exporter/page.mjs`,
    `${archiveRoot}/tools/browser-legacy-exporter/server.mjs`,
  ]);

  const revision = JSON.parse(readFileSync(join(packageRoot, "EXPORTER_REVISION.json"), "utf8"));
  assert.equal(revision.repository, "ne-agalakov/mindmap-local");
  assert.equal(revision.repositoryCommit, commitSha);
  assert.equal(revision.status, "phase0-read-only-exporter-accepted-evidence-preserved");
  assert.equal(revision.expectedOrigin, "http://127.0.0.1:5173");
  assert.equal(revision.storage.transactionMode, "readonly");
  assert.equal(revision.safety.oldApplicationIncluded, false);
  assert.equal(revision.safety.packageDependenciesIncluded, false);
  assert.equal(revision.safety.databaseIncluded, false);
  assert.equal(revision.safety.databaseWritePathIncluded, false);
  assert.equal(revision.safety.networkFetchPathIncluded, false);
  assert.equal(revision.safety.ollamaPathIncluded, false);

  const launcherMode = statSync(join(packageRoot, "start-legacy-exporter.command")).mode;
  assert.notEqual(launcherMode & 0o111, 0, "Mac launcher must stay executable");

  const combinedRuntime = [
    "start-legacy-exporter.command",
    "tools/browser-legacy-exporter/core.mjs",
    "tools/browser-legacy-exporter/page.mjs",
    "tools/browser-legacy-exporter/server.mjs",
  ].map((path) => readFileSync(join(packageRoot, path), "utf8")).join("\n").toLowerCase();
  for (const forbidden of [
    "node_modules",
    "npm ci",
    "npm run dev",
    "app/page",
    "app/api/",
    "sql.js",
    "fetch(",
    "127.0.0.1:11434",
    "/api/generate",
    "ollama_host",
    "qwen3",
    "deepseek-r1",
    ".put(",
    ".add(",
    ".delete(",
    ".clear(",
  ]) {
    assert.equal(combinedRuntime.includes(forbidden), false, `forbidden packaged runtime path: ${forbidden}`);
  }

  assert.equal(relative(root, archivePath).startsWith("release-artifacts/"), true);
});

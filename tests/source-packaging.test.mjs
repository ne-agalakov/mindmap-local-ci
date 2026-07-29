import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

const run = (command, args, cwd, extraEnv = {}) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "MindMap CI",
      GIT_AUTHOR_EMAIL: "ci@example.invalid",
      GIT_COMMITTER_NAME: "MindMap CI",
      GIT_COMMITTER_EMAIL: "ci@example.invalid",
      ...extraEnv,
    },
  }).trim();

test("source package checksum and checkout provenance are portable and exact", () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-package-test-"));
  mkdirSync(join(root, "scripts"), { recursive: true });

  cpSync(join(process.cwd(), "scripts", "package-source.sh"), join(root, "scripts", "package-source.sh"));
  chmodSync(join(root, "scripts", "package-source.sh"), 0o755);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.0.0-test" }, null, 2));
  writeFileSync(
    join(root, "ARTIFACT_REVISION.json"),
    `${JSON.stringify({ appVersion: "0.0.0-test", repository: null, repositoryCommit: null }, null, 2)}\n`,
  );
  writeFileSync(join(root, "README.md"), "fixture\n");

  run("git", ["init", "-b", "main"], root);
  run("git", ["remote", "add", "origin", "https://github.com/fixture/mindmap-package-test.git"], root);
  run("git", ["add", "."], root);
  run("git", ["commit", "-m", "fixture"], root);
  const expectedCommit = run("git", ["rev-parse", "HEAD"], root);

  const archivePath = run("bash", ["scripts/package-source.sh"], root).split("\n").at(-1);
  const archiveName = basename(archivePath);
  const manifestPath = `${archivePath}.sha256`;
  const manifest = readFileSync(manifestPath, "utf8").trim();
  const match = manifest.match(/^([a-f0-9]{64})\s{2}(.+)$/);

  assert.ok(match, `unexpected checksum format: ${manifest}`);
  assert.equal(match[2], archiveName, "checksum manifest must contain a relative archive filename");
  assert.equal(match[2].includes("/"), false, "checksum manifest must not contain a runner path");

  const actual = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  assert.equal(match[1], actual, "checksum must match the packaged archive bytes");

  const extractRoot = join(root, "artifact-review");
  mkdirSync(extractRoot, { recursive: true });
  run("unzip", ["-q", archivePath, "-d", extractRoot], root);
  const archiveRoot = archiveName.replace(/\.zip$/, "");
  const marker = JSON.parse(readFileSync(join(extractRoot, archiveRoot, "ARTIFACT_REVISION.json"), "utf8"));

  assert.equal(marker.repository, "fixture/mindmap-package-test");
  assert.equal(marker.repositoryCommit, expectedCommit);
  assert.equal(marker.gitStatus, "clean GitHub commit");
});

test("source package accepts an explicit repository override for an otherwise unresolvable remote", () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-package-override-test-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  cpSync(join(process.cwd(), "scripts", "package-source.sh"), join(root, "scripts", "package-source.sh"));
  chmodSync(join(root, "scripts", "package-source.sh"), 0o755);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.0.0-test" }, null, 2));
  writeFileSync(join(root, "ARTIFACT_REVISION.json"), "{\"repository\":null,\"repositoryCommit\":null}\n");

  run("git", ["init", "-b", "main"], root);
  run("git", ["add", "."], root);
  run("git", ["commit", "-m", "fixture"], root);

  const archivePath = run("bash", ["scripts/package-source.sh"], root, {
    MINDMAP_REPOSITORY_OVERRIDE: "fixture/override-repository",
  }).split("\n").at(-1);
  const extractRoot = join(root, "artifact-review");
  mkdirSync(extractRoot, { recursive: true });
  run("unzip", ["-q", archivePath, "-d", extractRoot], root);
  const archiveRoot = basename(archivePath).replace(/\.zip$/, "");
  const marker = JSON.parse(readFileSync(join(extractRoot, archiveRoot, "ARTIFACT_REVISION.json"), "utf8"));
  assert.equal(marker.repository, "fixture/override-repository");
});

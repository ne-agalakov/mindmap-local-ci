import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcher = await readFile(new URL("../start-mindmap.command", import.meta.url), "utf8");

test("macOS launcher clears quarantine only for native project dependencies before Vite", () => {
  const quarantineIndex = launcher.indexOf("com.apple.quarantine");
  const devIndex = launcher.indexOf("npm run dev");
  assert.ok(quarantineIndex >= 0, "quarantine handling must be present");
  assert.ok(devIndex > quarantineIndex, "quarantine handling must run before Vite");
  assert.match(launcher, /find \"\$PROJECT_DIR\/node_modules\"/);
  assert.match(launcher, /-name \"\*\.node\" -o -name \"\*\.dylib\"/);
  assert.doesNotMatch(launcher, /xattr -dr com\.apple\.quarantine \"\$PROJECT_DIR\"/);
});

test("macOS launcher preflights the ARM64 Rolldown binding", () => {
  assert.match(launcher, /@rolldown\/binding-darwin-arm64/);
  assert.match(launcher, /uname -m/);
});

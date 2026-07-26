import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { get } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";

const serverPath = fileURLToPath(new URL("../tools/browser-legacy-exporter/server.mjs", import.meta.url));

const requestRoot = () => new Promise((resolve, reject) => {
  const request = get("http://127.0.0.1:5173/", (response) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(chunk));
    response.on("end", () => resolve({
      statusCode: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    }));
  });
  request.on("error", reject);
});

test("standalone legacy exporter server boots and serves its page", { timeout: 15_000 }, async (t) => {
  const child = spawn(process.execPath, [serverPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 8_000);
    const inspect = () => {
      if (stdout.includes("MindMap legacy exporter запущен")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", inspect);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before readiness: code=${code} signal=${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });

  const response = await requestRoot();
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Экспорт точной legacy-базы/);
  assert.match(response.headers["content-security-policy"], /connect-src 'none'/);
  assert.equal(stderr, "");
});

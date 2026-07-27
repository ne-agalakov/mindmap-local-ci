#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HARNESS_TIMEOUT_MS = 30_000;
const PROCESS_STOP_TIMEOUT_MS = 5_000;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("free_port_resolution_failed"));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const lookup = spawnSync("which", [command], { encoding: "utf8" });
    if (lookup.status === 0 && lookup.stdout.trim()) return lookup.stdout.trim();
  }
  if (process.platform === "darwin") {
    const path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (spawnSync("test", ["-x", path]).status === 0) return path;
  }
  throw new Error("chrome_executable_not_found");
}

function waitForLine(child, marker, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => finish(
      reject,
      new Error(`process_readiness_timeout:${marker}\nstdout=${stdout}\nstderr=${stderr}`),
    ), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes(marker)) finish(resolve, { stdout, stderr });
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code, signal) => finish(
      reject,
      new Error(`process_exited_before_readiness:${marker}:code=${code}:signal=${signal}\nstdout=${stdout}\nstderr=${stderr}`),
    ));
  });
}

async function stopChild(child, name) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), PROCESS_STOP_TIMEOUT_MS)),
  ]);
  if (graceful) return;
  child.kill("SIGKILL");
  const forced = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), PROCESS_STOP_TIMEOUT_MS)),
  ]);
  if (!forced) throw new Error(`process_stop_timeout:${name}`);
}

async function waitForChromePage(debugPort, expectedUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        const page = pages.find((item) => item.type === "page" && item.url.startsWith(expectedUrl));
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`chrome_page_not_found:${lastError instanceof Error ? lastError.message : "timeout"}`);
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener("open", () => resolve({
      async send(method, params = {}) {
        const id = nextId++;
        const response = new Promise((resolveResponse, rejectResponse) => {
          pending.set(id, { resolve: resolveResponse, reject: rejectResponse });
        });
        socket.send(JSON.stringify({ id, method, params }));
        return response;
      },
      close() { socket.close(); },
    }), { once: true });
    socket.addEventListener("error", () => reject(new Error("cdp_websocket_error")), { once: true });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(`cdp_error:${message.error.message}`));
      else entry.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const entry of pending.values()) entry.reject(new Error("cdp_websocket_closed"));
      pending.clear();
    });
  });
}

async function waitForResult(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evaluated = await cdp.send("Runtime.evaluate", {
      expression: "JSON.stringify(globalThis.__MINDMAP_PHASE2CB_B1B_HARNESS_RESULT__ ?? null)",
      returnByValue: true,
      awaitPromise: true,
    });
    const value = evaluated?.result?.value;
    if (typeof value === "string" && value !== "null") return JSON.parse(value);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("browser_phase2cb_b1b_harness_result_timeout");
}

async function main() {
  execFileSync("npm", ["run", "build:phase2cb-b1b-harness"], { stdio: "inherit" });
  const serverPort = await freePort();
  const debugPort = await freePort();
  const url = `http://127.0.0.1:${serverPort}/`;
  const profile = await mkdtemp(join(tmpdir(), "mindmap-phase2cb-b1b-chrome-"));
  const server = spawn(process.execPath, ["tools/browser-phase2cb-b1b-harness/server.mjs"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, MINDMAP_PHASE2CB_B1B_HARNESS_PORT: String(serverPort) },
  });
  let chrome;
  try {
    await waitForLine(server, "MINDMAP_PHASE2CB_B1B_HARNESS_READY", 10_000);
    chrome = spawn(findChrome(), [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    const page = await waitForChromePage(debugPort, url, 15_000);
    const cdp = await connectCdp(page.webSocketDebuggerUrl);
    try {
      await cdp.send("Runtime.enable");
      const result = await waitForResult(cdp, HARNESS_TIMEOUT_MS);
      if (!result?.ok) throw new Error(`browser_phase2cb_b1b_harness_failed:${JSON.stringify(result)}`);
      for (const field of [
        "browserIndexedDb",
        "repeatPlanHashesEqual",
        "repeatTargetHashesEqual",
        "rollbackTargetEmpty",
        "sourceUnchangedAcrossHarness",
        "zeroNetworkCalls",
        "zeroModelCalls",
        "networkGuardsInstalled",
        "reqObsTrace",
        "liveObservabilityRendered",
        "diagnosticsDownloadAvailable",
      ]) {
        if (result[field] !== true) throw new Error(`browser_phase2cb_b1b_harness_missing_proof:${field}`);
      }
      if (result.sourceKind !== "sanitized-rehearsal" || result.exactSourceOpened !== false || result.actualMigrationPerformed !== false || result.automaticRetryAllowed !== false) {
        throw new Error("browser_phase2cb_b1b_harness_boundary_violation");
      }
      if (!/^[a-f0-9]{64}$/.test(result.portablePlanHash ?? "")
        || !/^[a-f0-9]{64}$/.test(result.targetSnapshotHash ?? "")) {
        throw new Error("browser_phase2cb_b1b_harness_invalid_hash");
      }
      console.log(JSON.stringify({ status: "passed", url, result }, null, 2));
    } finally {
      cdp.close();
    }
  } finally {
    await stopChild(chrome, "chrome");
    await stopChild(server, "phase2cb-b1b-harness-server");
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});

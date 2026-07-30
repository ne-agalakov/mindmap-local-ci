#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { B1B_EXPECTED_SOURCE, loadExactPhase2CbCandidate, snapshotExactSource } from "../tools/phase2cb-b1b-exact-source.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(ROOT, "..");
const BROWSER_ROOT = join(PACKAGE_ROOT, "browser", "dist");
const PROCESS_STOP_TIMEOUT_MS = 5_000;
const HARNESS_TIMEOUT_MS = 180_000;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isoNow = () => new Date().toISOString();

function parseArgs(argv) {
  const args = [...argv];
  const options = { source: null, output: null, chrome: null, headless: false };
  while (args.length) {
    const flag = args.shift();
    if (flag === "--headless") { options.headless = true; continue; }
    const value = args.shift();
    if (!value) throw new Error(`missing_value:${flag}`);
    if (flag === "--source") options.source = resolve(value);
    else if (flag === "--output") options.output = resolve(value);
    else if (flag === "--chrome") options.chrome = resolve(value);
    else throw new Error(`unknown_option:${flag}`);
  }
  if (!options.source || !options.output) throw new Error("usage: --source FILE --output DIRECTORY [--chrome FILE] [--headless]");
  return options;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(homedir(), "~").replace(/\/Users\/[^/\s]+/g, "/Users/<redacted>");
}

function observation(step, state, message, extras = {}) {
  const record = { at: isoNow(), step, workType: extras.workType ?? "local", state, model: "без AI", message, ...extras };
  process.stdout.write(`${JSON.stringify(record)}\n`);
  return record;
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("free_port_resolution_failed"));
      const port = address.port;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function findChrome(explicit) {
  if (explicit) {
    if (spawnSync("test", ["-x", explicit]).status === 0) return explicit;
    throw new Error("configured_chrome_not_executable");
  }
  if (process.platform === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (spawnSync("test", ["-x", mac]).status === 0) return mac;
  }
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const lookup = spawnSync("which", [command], { encoding: "utf8" });
    if (lookup.status === 0 && lookup.stdout.trim()) return lookup.stdout.trim();
  }
  throw new Error("chrome_executable_not_found");
}

async function stopChild(child, name) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  const graceful = await Promise.race([exited.then(() => true), new Promise((resolveWait) => setTimeout(() => resolveWait(false), PROCESS_STOP_TIMEOUT_MS))]);
  if (graceful) return;
  child.kill("SIGKILL");
  const forced = await Promise.race([exited.then(() => true), new Promise((resolveWait) => setTimeout(() => resolveWait(false), PROCESS_STOP_TIMEOUT_MS))]);
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
    } catch (error) { lastError = error; }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`chrome_page_not_found:${lastError instanceof Error ? lastError.message : "timeout"}`);
}

function connectCdp(webSocketUrl) {
  return new Promise((resolveConnection, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener("open", () => resolveConnection({
      async send(method, params = {}) {
        const id = nextId++;
        const response = new Promise((resolveResponse, rejectResponse) => pending.set(id, { resolve: resolveResponse, reject: rejectResponse }));
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
      if (message.error) entry.reject(new Error(`cdp_error:${message.error.message}`)); else entry.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const entry of pending.values()) entry.reject(new Error("cdp_websocket_closed"));
      pending.clear();
    });
  });
}

async function evaluateJson(cdp, expression) {
  const evaluated = await cdp.send("Runtime.evaluate", { expression: `JSON.stringify(${expression} ?? null)`, returnByValue: true, awaitPromise: true });
  const value = evaluated?.result?.value;
  return typeof value === "string" ? JSON.parse(value) : null;
}

async function waitForBrowserEvidence(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await evaluateJson(cdp, "globalThis.__MINDMAP_PHASE2CB_B1B_HARNESS_RESULT__");
    if (result) {
      const evidence = await evaluateJson(cdp, "globalThis.__MINDMAP_PHASE2CB_B1B_HARNESS_EVIDENCE__");
      return { result, evidence };
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("browser_phase2cb_b1b_result_timeout");
}

async function startInMemoryServer(port, bootstrap) {
  const indexTemplate = await readFile(join(BROWSER_ROOT, "index.html"), "utf8");
  const safeJson = JSON.stringify(bootstrap).replaceAll("<", "\\u003c");
  const index = indexTemplate.replace("<!--MINDMAP_B1B_BOOTSTRAP-->", `<script type="application/json" id="mindmap-b1b-bootstrap">${safeJson}</script>`);
  const server = createHttpServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return; }
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      let body;
      let extension;
      if (url.pathname === "/" || url.pathname === "/index.html") {
        body = Buffer.from(index, "utf8"); extension = ".html";
      } else {
        const relative = normalize(url.pathname.replace(/^\/+/, "")).replace(/^(\.\.(\/|\\|$))+/, "");
        const path = join(BROWSER_ROOT, relative);
        if (!path.startsWith(BROWSER_ROOT)) throw new Error("unsafe_static_path");
        body = await readFile(path); extension = extname(path);
      }
      response.writeHead(200, {
        "Content-Type": MIME[extension] ?? "application/octet-stream",
        "Content-Length": body.byteLength,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      if (request.method === "HEAD") response.end(); else response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }); response.end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  return server;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolveClose) => server.close(resolveClose));
}

function assertBrowserResult(result) {
  if (!result?.ok) throw new Error(`browser_phase2cb_b1b_failed:${result?.error ?? "unknown"}`);
  for (const field of [
    "browserIndexedDb", "repeatPlanHashesEqual", "repeatTargetHashesEqual", "rollbackTargetEmpty",
    "sourceUnchangedAcrossHarness", "zeroNetworkCalls", "zeroModelCalls", "networkGuardsInstalled",
    "reqObsTrace", "liveObservabilityRendered", "diagnosticsDownloadAvailable",
  ]) {
    if (result[field] !== true) throw new Error(`browser_phase2cb_b1b_missing_proof:${field}`);
  }
  if (result.sourceKind !== "exact-source" || result.exactSourceOpened !== true || result.actualMigrationPerformed !== false || result.automaticRetryAllowed !== false) {
    throw new Error("browser_phase2cb_b1b_boundary_violation");
  }
  if (!/^[a-f0-9]{64}$/.test(result.portablePlanHash ?? "") || !/^[a-f0-9]{64}$/.test(result.targetSnapshotHash ?? "")) {
    throw new Error("browser_phase2cb_b1b_invalid_hash");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageMetadata = JSON.parse(await readFile(join(PACKAGE_ROOT, "B1B_PACKAGE.json"), "utf8"));
  const sourceName = basename(options.source);
  const runId = `b1b-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${process.pid}`;
  await mkdir(options.output, { recursive: true });
  const lockRoot = join(homedir(), ".mindmap");
  await mkdir(lockRoot, { recursive: true });
  const lockPath = join(lockRoot, `phase2cb-b1b-once-${packageMetadata.commit}.lock`);
  const lock = await open(lockPath, "wx").catch((error) => {
    if (error?.code === "EEXIST") throw new Error("one_shot_already_consumed:new_explicit_confirmation_and_package_required");
    throw error;
  });
  const trace = [];
  const push = (step, state, message, extras) => trace.push(observation(step, state, message, extras));
  let browserServer;
  let chrome;
  let profile;
  let cdp;
  let sourceBefore;
  let sourceAfter;
  let inspection;
  let browserEvidence;
  let resultStatus = "stopped";
  let stopCode = null;
  try {
    await lock.writeFile(`${JSON.stringify({ packageCommit: packageMetadata.commit, runId, startedAt: isoNow(), automaticRetryAllowed: false }, null, 2)}\n`);
    await lock.close();
    const manifest = {
      format: "mindmap-phase2cb-b1b-run-manifest-v1",
      runId,
      authorizationId: packageMetadata.authorizationId,
      packageRepository: packageMetadata.repository,
      packageCommit: packageMetadata.commit,
      packageTree: packageMetadata.tree,
      createdAt: isoNow(),
      sourceName,
      sourcePathSha256: sha256(options.source),
      expectedSource: B1B_EXPECTED_SOURCE,
      targetNamespacePattern: "mindmap-state-core-v1-phase2cb-b1-<run-id>-{first|second|rollback}",
      modelMode: "без AI",
      externalNetworkAllowed: false,
      automaticRetryAllowed: false,
      actualMigrationAllowed: false,
      manifestFrozenBeforeSourceOpen: true,
    };
    const manifestPath = join(options.output, "mindmap-phase2cb-b1b-run-manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    push("freeze_manifest", "completed", "One-shot manifest written before SQLite open.");

    push("offline_preflight", "working", "Hashing exact source before SQLite open.", { processed: 0, total: B1B_EXPECTED_SOURCE.sizeBytes });
    sourceBefore = await snapshotExactSource(options.source);
    if (!sourceBefore.exists) throw new Error("source_not_found");
    if (sourceBefore.sizeBytes !== B1B_EXPECTED_SOURCE.sizeBytes) throw new Error("source_size_mismatch");
    if (sourceBefore.sha256 !== B1B_EXPECTED_SOURCE.sha256) throw new Error("source_hash_mismatch");
    if (!sourceBefore.sqliteHeaderValid) throw new Error("source_schema_mismatch");
    push("offline_preflight", "completed", "Exact size, SHA-256 and SQLite header matched.", { processed: sourceBefore.sizeBytes, total: sourceBefore.sizeBytes });

    push("read_only_extraction", "working", "Opening exact SQLite read-only/query-only.");
    const loaded = await loadExactPhase2CbCandidate(options.source, {
      manifestFrozenBeforeOpen: true,
      onBeforeDatabaseOpen() { push("read_only_extraction", "working", "Manifest confirmed; entering read-only SQLite boundary."); },
    });
    inspection = loaded.inspection;
    push("read_only_extraction", "completed", "Exact source candidate extracted in memory; raw payloads not written to evidence.", { processed: inspection.counts.thoughts, total: B1B_EXPECTED_SOURCE.thoughts });

    const serverPort = await freePort();
    const debugPort = await freePort();
    const url = `http://127.0.0.1:${serverPort}/`;
    profile = await mkdtemp(join(tmpdir(), "mindmap-phase2cb-b1b-chrome-"));
    browserServer = await startInMemoryServer(serverPort, {
      runId,
      sourceKind: "exact-source",
      exactSourceOpened: true,
      sourceSnapshot: loaded.sourceSnapshotAfter,
      candidate: loaded.candidate,
    });
    push("target_creation", "working", "Launching isolated Chrome profile and native IndexedDB targets.");
    const chromeArgs = [
      "--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-extensions",
      "--disable-sync", "--metrics-recording-only", "--no-first-run", "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
      options.headless ? "--headless=new" : `--app=${url}`,
    ];
    if (options.headless) chromeArgs.push("--disable-gpu", "--no-sandbox", url);
    chrome = spawn(findChrome(options.chrome), chromeArgs, { stdio: ["ignore", "pipe", "pipe"] });
    const page = await waitForChromePage(debugPort, url, 20_000);
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    const browser = await waitForBrowserEvidence(cdp, HARNESS_TIMEOUT_MS);
    assertBrowserResult(browser.result);
    browserEvidence = browser.evidence;
    push("verification", "completed", "Two clean targets matched and injected rollback left no target/receipt.");

    push("source_snapshot_after", "working", "Hashing exact source after all temporary-target runs.");
    sourceAfter = await snapshotExactSource(options.source);
    if (sourceAfter.sizeBytes !== sourceBefore.sizeBytes || sourceAfter.sha256 !== sourceBefore.sha256) throw new Error("source_changed_during_run");
    push("source_snapshot_after", "completed", "Exact source bytes unchanged.", { processed: sourceAfter.sizeBytes, total: sourceAfter.sizeBytes });

    const evidence = {
      format: "mindmap-phase2cb-b1b-exact-source-evidence-v1",
      result: "passed",
      runId,
      authorizationId: packageMetadata.authorizationId,
      package: { repository: packageMetadata.repository, commit: packageMetadata.commit, tree: packageMetadata.tree, packageSchema: packageMetadata.schema },
      source: {
        name: sourceName,
        expectedSizeBytes: B1B_EXPECTED_SOURCE.sizeBytes,
        actualSizeBytesBefore: sourceBefore.sizeBytes,
        actualSizeBytesAfter: sourceAfter.sizeBytes,
        expectedSha256: B1B_EXPECTED_SOURCE.sha256,
        sha256Before: sourceBefore.sha256,
        sha256After: sourceAfter.sha256,
        unchanged: true,
        openMode: "readonly",
        queryOnly: true,
        quickCheck: inspection.quickCheck,
        integrityCheck: inspection.integrityCheck,
        counts: inspection.counts,
        unresolvedThoughtCount: inspection.unresolvedThoughtCount,
        damagedReferenceCount: inspection.damagedReferenceCount,
      },
      dryRun: browserEvidence,
      boundaries: {
        localLoopbackOnly: true,
        externalNetworkCalls: 0,
        modelCalls: 0,
        exactSourceOpened: true,
        sourceWritePerformed: false,
        temporaryTargetsUsed: true,
        temporaryTargetsDeletedAfterEvidence: true,
        actualMigrationPerformed: false,
        actualMigrationAllowed: false,
        automaticRetryAllowed: false,
      },
      privacy: {
        sourceBytesIncluded: false,
        rawThoughtTextIncluded: false,
        nodeLabelsIncluded: false,
        rawModelPayloadsIncluded: false,
        sourcePathIncluded: false,
      },
      stepTrace: trace,
      finishedAt: isoNow(),
    };
    await writeFile(join(options.output, "mindmap-phase2cb-b1b-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
    resultStatus = "passed";
    push("complete", "completed", "B1b exact-source dry run passed. Actual migration remains blocked.");
    await writeFile(join(options.output, "README.txt"), [
      "MindMap Phase 2C-B1b one-shot evidence", "", "Result: PASSED", "Actual migration performed: NO", "Actual migration authorized: NO",
      "Source bytes unchanged: YES", "External network/model calls: 0", "Automatic retry: DISABLED", "",
      "Send only mindmap-phase2cb-b1b-evidence.json and the run manifest for review. Do not send the SQLite source.", "",
    ].join("\n"), { flag: "wx" });
  } catch (error) {
    stopCode = safeError(error);
    sourceAfter = sourceAfter ?? await snapshotExactSource(options.source).catch(() => null);
    const failure = {
      format: "mindmap-phase2cb-b1b-exact-source-evidence-v1",
      result: "stopped",
      stopCode,
      runId,
      package: { repository: packageMetadata.repository, commit: packageMetadata.commit, tree: packageMetadata.tree },
      source: {
        name: sourceName,
        expectedSizeBytes: B1B_EXPECTED_SOURCE.sizeBytes,
        expectedSha256: B1B_EXPECTED_SOURCE.sha256,
        ...(sourceBefore ? { actualSizeBytesBefore: sourceBefore.sizeBytes, sha256Before: sourceBefore.sha256 } : {}),
        ...(sourceAfter ? { actualSizeBytesAfter: sourceAfter.sizeBytes, sha256After: sourceAfter.sha256 } : {}),
      },
      boundaries: { externalNetworkCalls: 0, modelCalls: 0, actualMigrationPerformed: false, automaticRetryAllowed: false },
      privacy: { sourceBytesIncluded: false, rawThoughtTextIncluded: false, sourcePathIncluded: false },
      stepTrace: trace,
      finishedAt: isoNow(),
    };
    await writeFile(join(options.output, "mindmap-phase2cb-b1b-stopped.json"), `${JSON.stringify(failure, null, 2)}\n`).catch(() => {});
    push("complete", "stopped", `${stopCode}; no automatic retry. New explicit confirmation and package required.`);
    throw error;
  } finally {
    cdp?.close?.();
    await stopChild(chrome, "chrome").catch(() => {});
    await closeServer(browserServer).catch(() => {});
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {});
    await writeFile(lockPath, `${JSON.stringify({ packageCommit: packageMetadata.commit, runId, finishedAt: isoNow(), result: resultStatus, stopCode, automaticRetryAllowed: false }, null, 2)}\n`).catch(() => {});
  }
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});

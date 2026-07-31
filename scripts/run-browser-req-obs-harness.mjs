#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() { return await new Promise((resolve, reject) => { const server = createServer(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); const port = typeof address === "object" && address ? address.port : 0; server.close((error) => error ? reject(error) : resolve(port)); }); }); }
function findChrome() { for (const name of [process.env.CHROME_PATH, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) { const found = spawnSync("which", [name], { encoding: "utf8" }); if (found.status === 0 && found.stdout.trim()) return found.stdout.trim(); } throw new Error("chrome_executable_not_found"); }
async function stop(child) { if (!child || child.exitCode !== null) return; child.kill("SIGTERM"); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(2_000)]); if (child.exitCode === null) child.kill("SIGKILL"); }
async function waitForHttp(url) { const deadline = Date.now() + 10_000; while (Date.now() < deadline) { try { const response = await fetch(url); if (response.ok) return; } catch {} await sleep(50); } throw new Error("req_obs_server_timeout"); }
async function waitForPage(debugPort, expectedUrl) { const deadline = Date.now() + 15_000; while (Date.now() < deadline) { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); const pages = response.ok ? await response.json() : []; const page = pages.find((entry) => entry.type === "page" && entry.url.startsWith(expectedUrl)); if (page?.webSocketDebuggerUrl) return page; } catch {} await sleep(50); } throw new Error("req_obs_page_timeout"); }
function connect(webSocketUrl) { return new Promise((resolve, reject) => { const socket = new WebSocket(webSocketUrl); const pending = new Map(); let id = 0; socket.addEventListener("open", () => resolve({ send(method, params = {}) { const requestId = ++id; const answer = new Promise((resolveAnswer, rejectAnswer) => pending.set(requestId, { resolveAnswer, rejectAnswer })); socket.send(JSON.stringify({ id: requestId, method, params })); return answer; }, close() { socket.close(); } }), { once: true }); socket.addEventListener("error", () => reject(new Error("req_obs_cdp_error")), { once: true }); socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id); if (message.error) entry.rejectAnswer(new Error(message.error.message));
      else entry.resolveAnswer(message.result); }); }); }
async function evaluate(client, expression) { const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error("req_obs_browser_exception"); return result.result?.value; }

execFileSync("npm", ["run", "build:browser-req-obs"], { stdio: "inherit" });
const serverPort = await freePort();
const debugPort = await freePort();
const url = `http://127.0.0.1:${serverPort}/`;
const profile = await mkdtemp(join(tmpdir(), "mindmap-req-obs-chrome-"));
const server = spawn(process.execPath, ["tools/browser-req-obs-harness/server.mjs"], { env: { ...process.env, MINDMAP_REQ_OBS_HARNESS_PORT: String(serverPort) }, stdio: ["ignore", "pipe", "pipe"] });
let chrome;
let client;
try {
  await waitForHttp(url);
  chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-extensions", "--disable-sync", "--metrics-recording-only", "--no-first-run", "--no-default-browser-check", "--no-sandbox", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, url], { stdio: ["ignore", "pipe", "pipe"] });
  const page = await waitForPage(debugPort, url);
  client = await connect(page.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const deadline = Date.now() + 15_000;
  let result;
  while (Date.now() < deadline) {
    result = await evaluate(client, "globalThis.__MINDMAP_REQ_OBS_RESULT__ ?? null");
    if (result) break;
    await sleep(50);
  }
  if (!result?.ok) throw new Error(`req_obs_browser_failed:${JSON.stringify(result)}`);
  if (result.renderedCards !== 8 || result.downloadButtonVisible !== true) throw new Error("req_obs_visual_inventory_failed");
  const resources = await evaluate(client, "performance.getEntriesByType('resource').map((entry) => entry.name)");
  const apiCalls = resources.filter((entry) => /\/api\//.test(entry));
  if (apiCalls.length) throw new Error(`req_obs_unexpected_api_calls:${apiCalls.join(',')}`);
  console.log(JSON.stringify({ status: "passed", url, result, apiCalls }, null, 2));
} finally {
  client?.close();
  await stop(chrome);
  await stop(server);
  await rm(profile, { recursive: true, force: true });
}
process.exit(0);

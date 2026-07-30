#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number(process.env.MINDMAP_PHASE2CB_B1B_HARNESS_PORT ?? "4176");
const ROOT = fileURLToPath(new URL("./dist/", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return;
    }
    const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
    const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
    let path = join(ROOT, safe);
    const info = await stat(path).catch(() => undefined);
    if (info?.isDirectory()) path = join(path, "index.html");
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": MIME[extname(path)] ?? "application/octet-stream",
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
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
server.listen(PORT, HOST, () => console.log(`MINDMAP_PHASE2CB_B1B_HARNESS_READY http://${HOST}:${PORT}/`));
const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close); process.on("SIGTERM", close);

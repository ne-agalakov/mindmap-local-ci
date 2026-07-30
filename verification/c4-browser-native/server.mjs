#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.MINDMAP_PHASE2CC_C4_HARNESS_PORT ?? 4179);
const root = resolve("dist/browser-phase2cc-c4-harness");
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`,
    ).pathname;
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const candidate = normalize(join(root, relative));
    if (!candidate.startsWith(root)) throw new Error("path_escape");
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("not_file");
    const bytes = await readFile(candidate);
    response.writeHead(200, {
      "content-type": types.get(extname(candidate)) ?? "application/octet-stream",
      "cache-control": "no-store",
      "content-length": String(bytes.byteLength),
    });
    response.end(bytes);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MINDMAP_PHASE2CC_C4_HARNESS_READY http://127.0.0.1:${port}`);
});

#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 5173;
const ROOT = fileURLToPath(new URL("./", import.meta.url));
const ORIGIN = `http://${HOST}:${PORT}/`;
const files = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/page.mjs", "page.mjs"],
  ["/core.mjs", "core.mjs"],
]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    const path = new URL(request.url ?? "/", ORIGIN).pathname;
    const relative = files.get(path);
    if (!relative) {
      response.writeHead(404, { "Cache-Control": "no-store" });
      response.end("Not found");
      return;
    }
    const body = await readFile(join(ROOT, relative));
    response.writeHead(200, {
      "Content-Type": mime[extname(relative)] ?? "application/octet-stream",
      "Content-Length": body.byteLength,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Порт ${PORT} занят. Сначала закрой окно Терминала MindMap. Экспорт не запущен.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log("MindMap legacy exporter запущен в режиме только для чтения.");
  console.log(`Адрес: ${ORIGIN}`);
  console.log("Открой страницу в том же профиле Google Chrome, где запускался MindMap.");
  console.log("AI, Ollama, миграция и запись в IndexedDB отсутствуют.");
  if (process.platform === "darwin") {
    const child = spawn("open", ["-a", "Google Chrome", ORIGIN], { stdio: "ignore", detached: true });
    child.unref();
  }
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);

import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist/browser-req-obs-harness");
const port = Number(process.env.MINDMAP_REQ_OBS_HARNESS_PORT ?? 4179);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = normalize(join(root, relative));
  if (!file.startsWith(root) || !existsSync(file)) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});
server.listen(port, "127.0.0.1", () => console.log(`MINDMAP_REQ_OBS_HARNESS_READY:${port}`));

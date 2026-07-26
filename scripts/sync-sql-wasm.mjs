import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/sql.js/dist/sql-wasm.wasm");
const destination = resolve(projectRoot, "public/sql-wasm.wasm");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
const { size } = await stat(destination);
if (size < 100_000) {
  throw new Error(`Generated sql-wasm.wasm is unexpectedly small: ${size} bytes`);
}
console.log(`[postinstall] synchronized public/sql-wasm.wasm (${size} bytes)`);

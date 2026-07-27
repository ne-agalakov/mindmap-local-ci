import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const outDir = fileURLToPath(new URL("./dist", import.meta.url));

export default defineConfig({
  root,
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
});

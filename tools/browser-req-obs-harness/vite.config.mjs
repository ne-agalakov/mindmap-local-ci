import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("tools/browser-req-obs-harness"),
  build: {
    outDir: resolve("dist/browser-req-obs-harness"),
    emptyOutDir: true,
  },
});

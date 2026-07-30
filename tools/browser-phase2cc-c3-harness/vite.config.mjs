import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("tools/browser-phase2cc-c3-harness"),
  base: "./",
  build: {
    outDir: resolve("dist/browser-phase2cc-c3-harness"),
    emptyOutDir: true,
    rollupOptions: { input: resolve("tools/browser-phase2cc-c3-harness/index.html") },
  },
});

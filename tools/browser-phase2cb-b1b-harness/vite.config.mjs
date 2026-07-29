import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("tools/browser-phase2cb-b1b-harness"),
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve("tools/browser-phase2cb-b1b-harness/index.html") },
  },
});

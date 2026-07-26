import vinext from "vinext";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";


const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function readPackagedCommit(): string | undefined {
  try {
    const marker = JSON.parse(
      readFileSync(new URL("./ARTIFACT_REVISION.json", import.meta.url), "utf8"),
    ) as { repositoryCommit?: unknown };
    return typeof marker.repositoryCommit === "string"
      ? marker.repositoryCommit
      : undefined;
  } catch {
    return undefined;
  }
}

function resolveGitMetadata() {
  const explicit = process.env.MINDMAP_GIT_COMMIT_SHA?.trim();
  if (explicit) {
    return {
      commitSha: explicit,
      dirty: process.env.MINDMAP_GIT_DIRTY === "true",
    };
  }
  try {
    const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
    return { commitSha, dirty };
  } catch {
    return { commitSha: readPackagedCommit() ?? "unversioned", dirty: false };
  }
}

const gitMetadata = resolveGitMetadata();

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      __MINDMAP_GIT_COMMIT_SHA__: JSON.stringify(gitMetadata.commitSha),
      __MINDMAP_GIT_DIRTY__: JSON.stringify(gitMetadata.dirty),
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});

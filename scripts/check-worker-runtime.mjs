import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const vitestEntrypoint = resolve(repoRoot, "node_modules/vitest/vitest.mjs");

const result = spawnSync(
  process.execPath,
  [
    vitestEntrypoint,
    "run",
    "--project",
    "multihansa-workers",
    "apps/workers/tests/catalog-runtime.test.ts",
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

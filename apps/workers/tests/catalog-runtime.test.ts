import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { WORKER_CATALOG } from "../src/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workersPackageJsonPath = path.resolve(__dirname, "../package.json");
const turboJsonPath = path.resolve(__dirname, "../../../turbo.json");

describe("workers runtime taxonomy", () => {
  it("keeps worker catalog aligned with scripts and env", async () => {
    const workersPackageJson = JSON.parse(
      await readFile(workersPackageJsonPath, "utf8"),
    );
    const turboJson = JSON.parse(await readFile(turboJsonPath, "utf8"));

    const entries = [...WORKER_CATALOG];
    const entryIds = entries.map((entry) => entry.id);
    const entryEnvKeys = entries.map((entry) => entry.envKey);

    expect(entries.length).toBeGreaterThan(0);

    const scripts = workersPackageJson.scripts ?? {};
    const scriptKeys = Object.keys(scripts);
    const workerScriptIds = scriptKeys
      .filter((key) => key.startsWith("worker:") && key !== "worker:all")
      .map((key) => key.slice("worker:".length));

    for (const workerId of entryIds) {
      expect(scriptKeys).toContain(`worker:${workerId}`);
      expect(String(scripts[`worker:${workerId}`])).toContain(
        `src/main.ts ${workerId}`,
      );
    }

    for (const workerScriptId of workerScriptIds) {
      expect(entryIds).toContain(workerScriptId);
    }

    const turboEnv = new Set(turboJson.globalEnv ?? []);
    for (const envKey of entryEnvKeys) {
      expect(turboEnv.has(envKey)).toBe(true);
    }
  });
});

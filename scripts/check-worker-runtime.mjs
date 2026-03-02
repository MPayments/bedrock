import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestsPath = path.join(
  repoRoot,
  "packages/platform/src/component-runtime/manifests.ts",
);
const workersPackageJsonPath = path.join(repoRoot, "apps/workers/package.json");
const turboJsonPath = path.join(repoRoot, "turbo.json");

const manifestsSource = await readFile(manifestsPath, "utf8");
const workersPackageJson = JSON.parse(
  await readFile(workersPackageJsonPath, "utf8"),
);
const turboJson = JSON.parse(await readFile(turboJsonPath, "utf8"));

const workerEntries = [];
const workerEntryRegex =
  /\{\s*id:\s*"([^"]+)"\s*,\s*envKey:\s*"([^"]+)"\s*,\s*defaultIntervalMs:\s*([0-9_]+)\s*,\s*description:\s*"([^"]*)"/gms;

for (const match of manifestsSource.matchAll(workerEntryRegex)) {
  workerEntries.push({
    id: match[1],
    envKey: match[2],
  });
}

if (workerEntries.length === 0) {
  throw new Error("No worker capability entries found in component manifests.");
}

const workerIds = workerEntries.map((entry) => entry.id);
const workerEnvKeys = workerEntries.map((entry) => entry.envKey);

const scripts = workersPackageJson.scripts ?? {};
const workerScripts = Object.keys(scripts);
const missingWorkerScripts = workerIds.filter(
  (workerId) => !workerScripts.includes(`worker:${workerId}`),
);
if (missingWorkerScripts.length > 0) {
  throw new Error(
    `apps/workers/package.json is missing worker scripts: ${missingWorkerScripts.join(", ")}`,
  );
}

if (!workerScripts.includes("worker:all")) {
  throw new Error('apps/workers/package.json must define "worker:all" script.');
}

for (const workerId of workerIds) {
  const scriptKey = `worker:${workerId}`;
  const scriptValue = String(scripts[scriptKey] ?? "");
  if (!scriptValue.includes(`src/main.ts ${workerId}`)) {
    throw new Error(
      `Script ${scriptKey} must invoke src/main.ts ${workerId}, got: ${scriptValue}`,
    );
  }
}

const workerScriptIds = workerScripts
  .filter((key) => key.startsWith("worker:") && key !== "worker:all")
  .map((key) => key.slice("worker:".length));
const unknownWorkerScripts = workerScriptIds.filter(
  (workerId) => !workerIds.includes(workerId),
);
if (unknownWorkerScripts.length > 0) {
  throw new Error(
    `apps/workers/package.json has unknown worker scripts: ${unknownWorkerScripts.join(", ")}`,
  );
}

const turboEnv = new Set(turboJson.globalEnv ?? []);
const missingTurboEnvKeys = workerEnvKeys.filter(
  (envKey) => !turboEnv.has(envKey),
);
if (missingTurboEnvKeys.length > 0) {
  throw new Error(
    `turbo.json globalEnv is missing worker env keys: ${missingTurboEnvKeys.join(", ")}`,
  );
}

console.log(
  `[check-worker-runtime] ok: ${workerIds.length} workers, ${workerEnvKeys.length} env keys`,
);

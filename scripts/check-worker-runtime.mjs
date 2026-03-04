import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestsPaths = [
  path.join(repoRoot, "packages/core/src/module-runtime/manifests.ts"),
  path.join(repoRoot, "packages/application/src/module-runtime/manifests.ts"),
];
const workersPackageJsonPath = path.join(repoRoot, "apps/workers/package.json");
const turboJsonPath = path.join(repoRoot, "turbo.json");

const manifestsSources = await Promise.all(
  manifestsPaths.map((manifestsPath) => readFile(manifestsPath, "utf8")),
);
const workersPackageJson = JSON.parse(
  await readFile(workersPackageJsonPath, "utf8"),
);
const turboJson = JSON.parse(await readFile(turboJsonPath, "utf8"));

const workerEntries = [];
const workerEntryRegex =
  /\{\s*id:\s*"([^"]+)"\s*,\s*envKey:\s*"([^"]+)"\s*,\s*defaultIntervalMs:\s*([0-9_]+)\s*,\s*description:\s*"([^"]*)"/gms;

for (const manifestsSource of manifestsSources) {
  for (const match of manifestsSource.matchAll(workerEntryRegex)) {
    workerEntries.push({
      id: match[1],
      envKey: match[2],
    });
  }
}

if (workerEntries.length === 0) {
  throw new Error("No worker capability entries found in module manifests.");
}

const workerIds = workerEntries.map((entry) => entry.id);
const workerEnvKeys = workerEntries.map((entry) => entry.envKey);
const duplicateWorkerIds = workerIds.filter(
  (workerId, index) => workerIds.indexOf(workerId) !== index,
);
if (duplicateWorkerIds.length > 0) {
  throw new Error(
    `Duplicate worker ids in manifests: ${[...new Set(duplicateWorkerIds)].join(", ")}`,
  );
}
const duplicateWorkerEnvKeys = workerEnvKeys.filter(
  (envKey, index) => workerEnvKeys.indexOf(envKey) !== index,
);
if (duplicateWorkerEnvKeys.length > 0) {
  throw new Error(
    `Duplicate worker env keys in manifests: ${[...new Set(duplicateWorkerEnvKeys)].join(", ")}`,
  );
}

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

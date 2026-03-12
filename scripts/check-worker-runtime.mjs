import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const domainRoots = [
  path.join(repoRoot, "packages/app/src"),
];
const moduleManifestsPath = path.join(
  repoRoot,
  "packages/app/src/module-runtime/manifests.ts",
);
const workersPackageJsonPath = path.join(repoRoot, "apps/workers/package.json");
const turboJsonPath = path.join(repoRoot, "turbo.json");

const workersPackageJson = JSON.parse(
  await readFile(workersPackageJsonPath, "utf8"),
);
const turboJson = JSON.parse(await readFile(turboJsonPath, "utf8"));
const dormantModuleIds = await readDormantModuleIds(moduleManifestsPath);
const manifestFiles = (
  await Promise.all(domainRoots.map((root) => listManifestFiles(root)))
).flat();
const modules = (
  await Promise.all(manifestFiles.map((manifestFile) => readModuleManifests(manifestFile)))
).flat();

const workerEntries = modules
  .filter((manifest) => !dormantModuleIds.has(manifest.id))
  .flatMap((manifest) =>
    manifest.workers.map((worker) => ({
      ...worker,
      moduleId: manifest.id,
    })),
  );

if (workerEntries.length === 0) {
  throw new Error("No active worker capability entries found in module manifests.");
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
  `[check-worker-runtime] ok: ${workerIds.length} workers, ${workerEnvKeys.length} env keys, dormant modules ignored: ${[...dormantModuleIds].join(",") || "none"}`,
);

function getObjectLiteralProp(objectLiteral, propertyName) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const name = ts.isIdentifier(property.name)
      ? property.name.text
      : ts.isStringLiteral(property.name)
        ? property.name.text
        : null;
    if (name === propertyName) {
      return property.initializer;
    }
  }

  return null;
}

function getStringLiteralValue(initializer) {
  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.text;
  }

  return null;
}

function isModuleManifestObject(objectLiteral) {
  const idInit = getObjectLiteralProp(objectLiteral, "id");
  const versionInit = getObjectLiteralProp(objectLiteral, "version");
  const kindInit = getObjectLiteralProp(objectLiteral, "kind");
  const scopeSupportInit = getObjectLiteralProp(objectLiteral, "scopeSupport");
  const capabilitiesInit = getObjectLiteralProp(objectLiteral, "capabilities");

  return Boolean(
    idInit &&
      getStringLiteralValue(idInit) &&
      versionInit &&
      ts.isNumericLiteral(versionInit) &&
      kindInit &&
      getStringLiteralValue(kindInit) &&
      scopeSupportInit &&
      ts.isObjectLiteralExpression(scopeSupportInit) &&
      capabilitiesInit &&
      ts.isObjectLiteralExpression(capabilitiesInit),
  );
}

function extractWorkersFromCapabilities(capabilitiesObject) {
  const workersInit = getObjectLiteralProp(capabilitiesObject, "workers");
  if (!workersInit || !ts.isArrayLiteralExpression(workersInit)) {
    return [];
  }

  const workers = [];
  for (const element of workersInit.elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      continue;
    }

    const workerId = getStringLiteralValue(getObjectLiteralProp(element, "id"));
    const envKey = getStringLiteralValue(getObjectLiteralProp(element, "envKey"));
    if (!workerId || !envKey) {
      continue;
    }
    workers.push({ id: workerId, envKey });
  }

  return workers;
}

async function readModuleManifests(manifestFilePath) {
  const source = await readFile(manifestFilePath, "utf8");
  const sourceFile = ts.createSourceFile(
    manifestFilePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const manifests = [];

  function visit(node) {
    if (ts.isObjectLiteralExpression(node) && isModuleManifestObject(node)) {
      const id = getStringLiteralValue(getObjectLiteralProp(node, "id"));
      const capabilitiesInit = getObjectLiteralProp(node, "capabilities");
      const workers = ts.isObjectLiteralExpression(capabilitiesInit)
        ? extractWorkersFromCapabilities(capabilitiesInit)
        : [];
      if (id) {
        manifests.push({ id, workers });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return manifests;
}

async function readDormantModuleIds(coreManifestsFilePath) {
  const source = await readFile(coreManifestsFilePath, "utf8");
  const sourceFile = ts.createSourceFile(
    coreManifestsFilePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const dormantIds = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      if (declaration.name.text !== "DORMANT_MODULE_IDS") {
        continue;
      }

      if (
        declaration.initializer &&
        ts.isAsExpression(declaration.initializer) &&
        ts.isArrayLiteralExpression(declaration.initializer.expression)
      ) {
        for (const element of declaration.initializer.expression.elements) {
          if (ts.isStringLiteral(element)) {
            dormantIds.add(element.text);
          }
        }
      } else if (
        declaration.initializer &&
        ts.isArrayLiteralExpression(declaration.initializer)
      ) {
        for (const element of declaration.initializer.elements) {
          if (ts.isStringLiteral(element)) {
            dormantIds.add(element.text);
          }
        }
      }
    }
  }

  return dormantIds;
}

async function listManifestFiles(rootDir) {
  const results = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (entry.name === "manifest.ts") {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

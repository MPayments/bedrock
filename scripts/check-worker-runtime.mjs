import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workerCatalogPath = path.join(repoRoot, "apps/workers/src/catalog.ts");
const workersPackageJsonPath = path.join(repoRoot, "apps/workers/package.json");
const turboJsonPath = path.join(repoRoot, "turbo.json");

const workersPackageJson = JSON.parse(
  await readFile(workersPackageJsonPath, "utf8"),
);
const turboJson = JSON.parse(await readFile(turboJsonPath, "utf8"));
const workerEntries = await readWorkerCatalog(workerCatalogPath);

if (workerEntries.length === 0) {
  throw new Error("No worker entries found in apps/workers/src/catalog.ts.");
}

const workerIds = workerEntries.map((entry) => entry.id);
const workerEnvKeys = workerEntries.map((entry) => entry.envKey);
const duplicateWorkerIds = workerIds.filter(
  (workerId, index) => workerIds.indexOf(workerId) !== index,
);
if (duplicateWorkerIds.length > 0) {
  throw new Error(
    `Duplicate worker ids in catalog: ${[...new Set(duplicateWorkerIds)].join(", ")}`,
  );
}
const duplicateWorkerEnvKeys = workerEnvKeys.filter(
  (envKey, index) => workerEnvKeys.indexOf(envKey) !== index,
);
if (duplicateWorkerEnvKeys.length > 0) {
  throw new Error(
    `Duplicate worker env keys in catalog: ${[...new Set(duplicateWorkerEnvKeys)].join(", ")}`,
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
  if (
    ts.isStringLiteral(initializer) ||
    ts.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    return initializer.text;
  }

  return null;
}

async function readWorkerCatalog(catalogFilePath) {
  const source = await readFile(catalogFilePath, "utf8");
  const sourceFile = ts.createSourceFile(
    catalogFilePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }
      if (declaration.name.text !== "WORKER_CATALOG") {
        continue;
      }

      const initializer = declaration.initializer;
      const entries = unwrapCatalogEntries(initializer);
      if (!entries) {
        continue;
      }

      return entries;
    }
  }

  return [];
}

function unwrapCatalogEntries(initializer) {
  if (!initializer) {
    return null;
  }

  if (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) {
    return unwrapCatalogEntries(initializer.expression);
  }

  if (!ts.isArrayLiteralExpression(initializer)) {
    return null;
  }

  const entries = [];
  for (const element of initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      continue;
    }

    const id = getStringLiteralValue(getObjectLiteralProp(element, "id"));
    const envKey = getStringLiteralValue(getObjectLiteralProp(element, "envKey"));
    if (!id || !envKey) {
      continue;
    }
    entries.push({ id, envKey });
  }

  return entries;
}

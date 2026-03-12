import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  ROOT,
  SOURCE_EXTENSIONS,
  collectWorkspacePackages,
  findOwningPackage,
  getImports,
  listFiles,
  normalizeWorkspaceSpecifier,
  sortPackagesByDirLength,
} from "./lib/workspace-packages.mjs";

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "scripts"),
  join(ROOT, "infra"),
  join(ROOT, "tests"),
].filter((candidate) => {
  try {
    return listFiles(candidate, SOURCE_EXTENSIONS).length >= 0;
  } catch {
    return false;
  }
});

const REQUIRED_EXPORT_KINDS = new Set([
  "integration",
  "module",
  "platform",
  "plugin",
  "runtime",
]);

const workspacePackages = collectWorkspacePackages();
const packagesByName = new Map(
  workspacePackages.map((pkg) => [pkg.name, pkg]),
);
const packagesByDirLength = sortPackagesByDirLength(workspacePackages);
const packageGraph = new Map(
  workspacePackages
    .filter((pkg) => pkg.kind !== "app")
    .map((pkg) => [pkg.name, new Set()]),
);
const violations = [];

function isSchemaDefinitionFile(file) {
  return /\/src\/(?:.+\/)?schema(?:\.ts|\/.+\.ts)$/.test(file);
}

function isIntegrationTestFile(relFile) {
  return /(^|\/)tests(?:\/[^/]+)*\/integration\//.test(relFile);
}

function isDbImportAllowed(owner, relFile) {
  if (isIntegrationTestFile(relFile)) {
    return true;
  }

  if (!owner) {
    return false;
  }

  if (owner.name === "@bedrock/db" || owner.kind === "app") {
    return true;
  }

  if (
    relFile.startsWith("tests/integration/") ||
    /\/tests\/integration\//.test(relFile)
  ) {
    return true;
  }

  return false;
}

function iterateExportTargets(exportsField) {
  if (!exportsField) {
    return [];
  }

  if (typeof exportsField === "string") {
    return [exportsField];
  }

  if (Array.isArray(exportsField)) {
    return exportsField.flatMap((entry) => iterateExportTargets(entry));
  }

  return Object.values(exportsField).flatMap((entry) =>
    iterateExportTargets(entry),
  );
}

function isExportedSubpath(pkg, subpath) {
  const exportsField = pkg.packageJson.exports;
  if (!exportsField) {
    return false;
  }

  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return subpath === ".";
  }

  if (Object.prototype.hasOwnProperty.call(exportsField, subpath)) {
    return true;
  }

  for (const key of Object.keys(exportsField)) {
    if (!key.includes("*")) {
      continue;
    }

    const pattern = new RegExp(
      `^${key
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\\*/g, "(.+)")}$`,
    );

    if (pattern.test(subpath)) {
      return true;
    }
  }

  return false;
}

function getPartiesSubdomain(filePath) {
  const match = /^packages\/modules\/parties\/src\/([^/]+)\//.exec(filePath);
  if (!match || match[1] === "internal") {
    return null;
  }

  return match[1];
}

function recordViolation(rule, from, specifier, to = specifier) {
  violations.push({ rule, from, specifier, to });
}

for (const pkg of workspacePackages) {
  if (
    REQUIRED_EXPORT_KINDS.has(pkg.kind) &&
    !pkg.packageJson.exports
  ) {
    recordViolation("missing-exports", pkg.relDir, pkg.name, pkg.relDir);
    continue;
  }

  if (!pkg.packageJson.exports) {
    continue;
  }

  for (const target of iterateExportTargets(pkg.packageJson.exports)) {
    if (typeof target !== "string") {
      continue;
    }

    if (target.includes("/internal/")) {
      recordViolation(
        "internal-export",
        pkg.relDir,
        target,
        `${pkg.relDir}/package.json`,
      );
    }
  }
}

for (const root of SOURCE_ROOTS) {
  for (const filePath of listFiles(root, SOURCE_EXTENSIONS)) {
    const relFile = relative(ROOT, filePath);
    const content = readFileSync(filePath, "utf8");
    const owner = findOwningPackage(filePath, packagesByDirLength);

    if (
      owner &&
      relFile.includes("/src/") &&
      content.includes("pgTable(") &&
      !isSchemaDefinitionFile(relFile)
    ) {
      recordViolation("pgtable-outside-schema", relFile, "pgTable(", relFile);
    }

    for (const specifier of getImports(content)) {
      if (specifier.startsWith("node:")) {
        continue;
      }

      if (specifier.startsWith(".") || specifier.startsWith("..")) {
        if (!owner) {
          continue;
        }

        const targetPath = resolve(dirname(filePath), specifier);
        const targetOwner = findOwningPackage(targetPath, packagesByDirLength);

        if (targetOwner && targetOwner.name !== owner.name) {
          recordViolation(
            "cross-package-relative-import",
            relFile,
            specifier,
            relative(ROOT, targetPath),
          );
          continue;
        }

        if (owner.name === "@bedrock/parties") {
          const fromSubdomain = getPartiesSubdomain(relFile);
          const toSubdomain = getPartiesSubdomain(relative(ROOT, targetPath));

          if (
            fromSubdomain &&
            toSubdomain &&
            fromSubdomain !== toSubdomain
          ) {
            recordViolation(
              "parties-cross-subdomain-relative-import",
              relFile,
              specifier,
              relative(ROOT, targetPath),
            );
          }
        }

        continue;
      }

      if (
        specifier.startsWith("packages/") ||
        specifier.startsWith("apps/") ||
        specifier.startsWith("/")
      ) {
        recordViolation(
          "workspace-path-import",
          relFile,
          specifier,
          specifier,
        );
        continue;
      }

      const normalized = normalizeWorkspaceSpecifier(specifier);
      if (!normalized) {
        continue;
      }

      if (normalized.packageName === "@bedrock/application") {
        recordViolation("deprecated-application-import", relFile, specifier);
        continue;
      }

      const targetPkg = packagesByName.get(normalized.packageName);
      if (!targetPkg) {
        continue;
      }

      if (
        normalized.subpath === "./internal" ||
        normalized.subpath.startsWith("./internal/") ||
        normalized.subpath.includes("/internal/")
      ) {
        recordViolation("internal-import", relFile, specifier);
      }

      if (
        targetPkg.packageJson.exports &&
        !isExportedSubpath(targetPkg, normalized.subpath)
      ) {
        recordViolation(
          "non-exported-subpath",
          relFile,
          specifier,
          `${targetPkg.relDir}:${normalized.subpath}`,
        );
      }

      if (
        normalized.packageName === "@bedrock/db" &&
        !isDbImportAllowed(owner, relFile)
      ) {
        recordViolation("db-import-outside-app-or-integration", relFile, specifier);
      }

      if (
        owner?.kind === "runtime" &&
        ["module", "plugin", "integration", "db"].includes(targetPkg.kind)
      ) {
        recordViolation("runtime-imports-business", relFile, specifier);
      }

      if (
        owner?.kind === "integration" &&
        targetPkg.kind === "integration" &&
        owner.name !== targetPkg.name
      ) {
        recordViolation("integration-imports-integration", relFile, specifier);
      }

      if (
        owner?.kind === "integration" &&
        targetPkg.kind === "runtime"
      ) {
        recordViolation("integration-imports-runtime", relFile, specifier);
      }

      if (
        owner &&
        owner.kind !== "app" &&
        owner.name !== targetPkg.name &&
        packageGraph.has(owner.name) &&
        relFile.startsWith(`${owner.relDir}/src/`)
      ) {
        packageGraph.get(owner.name).add(targetPkg.name);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycleKeys = new Set();

function visitPackage(name) {
  visiting.add(name);
  stack.push(name);

  for (const dependency of packageGraph.get(name) ?? []) {
    if (!packageGraph.has(dependency)) {
      continue;
    }

    if (!visited.has(dependency) && !visiting.has(dependency)) {
      visitPackage(dependency);
      continue;
    }

    if (!visiting.has(dependency)) {
      continue;
    }

    const cycleStart = stack.indexOf(dependency);
    const cycle = [...stack.slice(cycleStart), dependency];
    const body = cycle.slice(0, -1);
    const rotations = body.map((_, index) =>
      [...body.slice(index), ...body.slice(0, index)].join(" -> "),
    );
    const normalized = rotations.sort()[0];

    if (!cycleKeys.has(normalized)) {
      cycleKeys.add(normalized);
      recordViolation("package-cycle", normalized, normalized, normalized);
    }
  }

  stack.pop();
  visiting.delete(name);
  visited.add(name);
}

for (const pkgName of packageGraph.keys()) {
  if (!visited.has(pkgName)) {
    visitPackage(pkgName);
  }
}

for (const pkg of workspacePackages) {
  if (pkg.kind !== "runtime") {
    continue;
  }

  const directWorkspaceDeps = Object.keys(pkg.packageJson.dependencies ?? {})
    .map((depName) => packagesByName.get(depName))
    .filter(Boolean);

  const disallowedDeps = directWorkspaceDeps.filter(
    (depPkg) => !["common", "platform"].includes(depPkg.kind),
  );

  for (const depPkg of disallowedDeps) {
    recordViolation(
      "runtime-depends-on-non-platform",
      `${pkg.relDir}/package.json`,
      depPkg.name,
    );
  }
}

for (const pkg of workspacePackages) {
  if (pkg.kind !== "integration") {
    continue;
  }

  const directWorkspaceDeps = Object.keys(pkg.packageJson.dependencies ?? {})
    .map((depName) => packagesByName.get(depName))
    .filter(Boolean);

  const integrationDeps = directWorkspaceDeps.filter(
    (depPkg) => depPkg.kind === "integration" && depPkg.name !== pkg.name,
  );
  for (const depPkg of integrationDeps) {
    recordViolation(
      "integration-depends-on-integration",
      `${pkg.relDir}/package.json`,
      depPkg.name,
    );
  }

  const runtimeDeps = directWorkspaceDeps.filter(
    (depPkg) => depPkg.kind === "runtime",
  );
  for (const depPkg of runtimeDeps) {
    recordViolation(
      "integration-depends-on-runtime",
      `${pkg.relDir}/package.json`,
      depPkg.name,
    );
  }

  const invalidWorkspaceDeps = directWorkspaceDeps.filter(
    (depPkg) =>
      !["common", "platform", "module", "plugin"].includes(depPkg.kind),
  );
  for (const depPkg of invalidWorkspaceDeps) {
    if (depPkg.kind === "integration" || depPkg.kind === "runtime") {
      continue;
    }

    recordViolation(
      "integration-invalid-workspace-dependency",
      `${pkg.relDir}/package.json`,
      depPkg.name,
    );
  }

  const bridgedBusinessDeps = directWorkspaceDeps.filter((depPkg) =>
    depPkg.kind === "module" || depPkg.kind === "plugin",
  );
  if (bridgedBusinessDeps.length > 2) {
    recordViolation(
      "integration-too-wide",
      `${pkg.relDir}/package.json`,
      bridgedBusinessDeps.map((depPkg) => depPkg.name).join(", "),
    );
  }
}

if (violations.length > 0) {
  console.error("Dependency boundary check failed:");
  for (const violation of violations) {
    console.error(
      `- [${violation.rule}] ${violation.from} -> ${violation.specifier} (${violation.to})`,
    );
  }
  process.exit(1);
}

console.log("Dependency boundary check passed.");

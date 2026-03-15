import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { RUNTIME_EXPORT_KINDS } from "./guardrails/policy.mjs";
import {
  collectExportTargets,
  collectWorkspacePackages,
  findOwningPackage,
  getImports,
  isExportedSubpath,
  listSourceFiles,
  normalizeWorkspaceSpecifier,
  resolveRootDir,
} from "./lib/workspace-metadata.mjs";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function addProblem(problems, type, file, detail) {
  problems.push({ type, file, detail });
}

function checkExports(pkg, problems) {
  if (RUNTIME_EXPORT_KINDS.has(pkg.kind) && !pkg.packageJson.exports) {
    addProblem(
      problems,
      "missing-exports",
      `${pkg.relDir}/package.json`,
      pkg.name,
    );
    return;
  }

  const exportsField = pkg.packageJson.exports;
  if (
    !exportsField ||
    typeof exportsField !== "object" ||
    Array.isArray(exportsField)
  ) {
    return;
  }

  for (const target of collectExportTargets(exportsField)) {
    if (typeof target === "string" && target.includes("/internal/")) {
      addProblem(
        problems,
        "internal-export",
        `${pkg.relDir}/package.json`,
        target,
      );
    }
  }
}

function collectDeclaredWorkspaceDeps(pkg, workspaceNames, problems) {
  const declared = new Set();

  for (const section of DEPENDENCY_SECTIONS) {
    for (const [dependencyName, version] of Object.entries(
      pkg.packageJson[section] ?? {},
    )) {
      if (!workspaceNames.has(dependencyName)) {
        continue;
      }

      if (version !== "workspace:*") {
        addProblem(
          problems,
          "non-workspace-protocol",
          `${pkg.relDir}/package.json`,
          `${section}: ${dependencyName} -> ${JSON.stringify(version)}`,
        );
      }

      declared.add(dependencyName);
    }
  }

  return declared;
}

export function collectManifestProblems(rootDir = resolveRootDir()) {
  const workspacePackages = collectWorkspacePackages(rootDir);
  const workspaceNames = new Set(workspacePackages.map((pkg) => pkg.name));
  const packagesByName = new Map(
    workspacePackages.map((pkg) => [pkg.name, pkg]),
  );
  const problems = [];

  for (const pkg of workspacePackages) {
    checkExports(pkg, problems);
    const declared = collectDeclaredWorkspaceDeps(
      pkg,
      workspaceNames,
      problems,
    );
    const usedWorkspaceDeps = new Set();

    for (const filePath of listSourceFiles(pkg.dir)) {
      const relFile = relative(rootDir, filePath).replaceAll("\\", "/");
      const content = readFileSync(filePath, "utf8");

      for (const specifier of getImports(content)) {
        if (specifier.startsWith(".") || specifier.startsWith("..")) {
          const targetOwner = findOwningPackage(
            resolve(dirname(filePath), specifier),
            workspacePackages,
          );

          if (targetOwner && targetOwner.name !== pkg.name) {
            addProblem(
              problems,
              "cross-package-relative-import",
              relFile,
              `${specifier} -> ${targetOwner.relDir}`,
            );
          }

          continue;
        }

        if (
          specifier.startsWith("apps/") ||
          specifier.startsWith("infra/") ||
          specifier.startsWith("packages/") ||
          specifier.startsWith("/")
        ) {
          addProblem(problems, "workspace-path-import", relFile, specifier);
          continue;
        }

        const normalized = normalizeWorkspaceSpecifier(specifier);
        if (!normalized) {
          continue;
        }

        if (
          normalized.subpath === "./internal" ||
          normalized.subpath.startsWith("./internal/") ||
          normalized.subpath.includes("/internal/")
        ) {
          addProblem(problems, "internal-import", relFile, specifier);
        }

        const targetPkg = packagesByName.get(normalized.packageName);
        if (!targetPkg) {
          continue;
        }

        if (
          normalized.packageName !== pkg.name &&
          workspaceNames.has(normalized.packageName)
        ) {
          usedWorkspaceDeps.add(normalized.packageName);
        }

        if (
          targetPkg.packageJson.exports &&
          !isExportedSubpath(targetPkg.packageJson.exports, normalized.subpath)
        ) {
          addProblem(
            problems,
            "non-exported-subpath",
            relFile,
            `${specifier} -> ${targetPkg.relDir}:${normalized.subpath}`,
          );
        }
      }
    }

    for (const dependencyName of usedWorkspaceDeps) {
      if (!declared.has(dependencyName)) {
        addProblem(
          problems,
          "undeclared-workspace-dependency",
          pkg.relDir,
          dependencyName,
        );
      }
    }
  }

  return problems.sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }

    return left.type.localeCompare(right.type);
  });
}

export function printManifestProblems(problems) {
  if (problems.length === 0) {
    console.log("Manifest guardrail check passed.");
    return;
  }

  console.error("Manifest guardrail check failed:");
  for (const problem of problems) {
    console.error(`- [${problem.type}] ${problem.file}: ${problem.detail}`);
  }
}

const problems = collectManifestProblems();
printManifestProblems(problems);

if (problems.length > 0) {
  process.exit(1);
}

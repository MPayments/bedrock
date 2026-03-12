import { readFileSync } from "node:fs";
import { relative } from "node:path";

import {
  ROOT,
  SOURCE_EXTENSIONS,
  collectWorkspacePackages,
  getImports,
  listFiles,
  normalizeWorkspaceSpecifier,
} from "./lib/workspace-packages.mjs";

const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const workspacePackages = collectWorkspacePackages();
const workspaceNames = new Set(workspacePackages.map((pkg) => pkg.name));
const problems = [];

for (const pkg of workspacePackages) {
  const declared = new Map();

  for (const section of sections) {
    const deps = pkg.packageJson[section] ?? {};
    for (const [name, version] of Object.entries(deps)) {
      if (!workspaceNames.has(name)) {
        continue;
      }

      if (version !== "workspace:*") {
        problems.push({
          type: "non-workspace-protocol",
          file: `${pkg.relDir}/package.json`,
          detail: `${section}: ${name} -> ${JSON.stringify(version)}`,
        });
      }

      declared.set(name, section);
    }
  }

  const used = new Set();

  for (const filePath of listFiles(pkg.dir, SOURCE_EXTENSIONS)) {
    const content = readFileSync(filePath, "utf8");

    for (const specifier of getImports(content)) {
      const normalized = normalizeWorkspaceSpecifier(specifier);
      if (!normalized) {
        continue;
      }

      if (
        normalized.packageName !== pkg.name &&
        workspaceNames.has(normalized.packageName)
      ) {
        used.add(normalized.packageName);
      }
    }
  }

  for (const dependencyName of used) {
    if (!declared.has(dependencyName)) {
      problems.push({
        type: "undeclared-workspace-dependency",
        file: pkg.relDir,
        detail: dependencyName,
      });
    }
  }
}

if (problems.length > 0) {
  console.error("Workspace dependency check failed:");
  for (const problem of problems) {
    console.error(`- [${problem.type}] ${problem.file}: ${problem.detail}`);
  }
  process.exit(1);
}

console.log("Workspace dependency check passed.");

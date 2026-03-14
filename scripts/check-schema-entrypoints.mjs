import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { collectWorkspacePackages } from "./lib/workspace-packages.mjs";

function collectTargets(entry) {
  if (typeof entry === "string") {
    return [entry];
  }

  if (Array.isArray(entry)) {
    return entry.flatMap((item) => collectTargets(item));
  }

  if (entry && typeof entry === "object") {
    return Object.values(entry).flatMap((item) => collectTargets(item));
  }

  return [];
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

function isTrivialReexportModule(content) {
  const lines = stripComments(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return false;
  }

  return lines.every((line) =>
    /^export\s+(?:\*\s+from|{[^}]+}\s+from|type\s+{[^}]+}\s+from)\s+["'][^"']+["'];?$/.test(
      line,
    ),
  );
}

const violations = [];

for (const pkg of collectWorkspacePackages()) {
  const exportsField = pkg.packageJson.exports;
  if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) {
    continue;
  }

  const schemaExport = exportsField["./schema"];
  if (!schemaExport) {
    continue;
  }

  for (const target of collectTargets(schemaExport)) {
    if (!target.endsWith(".ts")) {
      continue;
    }

    const targetPath = resolve(pkg.dir, target);
    const content = readFileSync(targetPath, "utf8");

    if (!isTrivialReexportModule(content)) {
      continue;
    }

    violations.push({
      packageName: pkg.name,
      target,
    });
  }
}

if (violations.length > 0) {
  console.error("Trivial ./schema entrypoint wrappers found:");
  for (const violation of violations) {
    console.error(`- ${violation.packageName}: ${violation.target}`);
  }
  process.exit(1);
}

console.log("Schema entrypoint check passed.");

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(__dirname, "../..");

export const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

export const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^"'()]*?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

export const CODE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

export const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeKind(kind) {
  switch (kind) {
    case "kernel":
      return "foundation";
    case "db":
    case "platform":
    case "runtime":
      return "adapter";
    case "plugin":
      return "extension";
    case "sdk":
      return "client";
    default:
      return kind;
  }
}

function classifyPackageKind(relDir) {
  if (relDir.startsWith("packages/foundation/")) return "foundation";
  if (relDir.startsWith("packages/modules/")) return "module";
  if (relDir.startsWith("packages/workflows/")) return "workflow";
  if (relDir.startsWith("packages/queries/")) return "query";
  if (relDir.startsWith("packages/integrations/")) return "integration";
  if (relDir.startsWith("packages/adapters/")) return "adapter";
  if (relDir.startsWith("packages/extensions/")) return "extension";
  if (relDir.startsWith("packages/clients/")) return "client";
  if (relDir.startsWith("packages/ui/")) return "ui";
  if (relDir.startsWith("packages/tooling/")) return "tooling";
  if (relDir.startsWith("ops/")) return "ops";
  if (relDir.startsWith("apps/")) return "app";
  return "unknown";
}

function expandWorkspacePattern(pattern) {
  const segments = pattern.split("/").filter(Boolean);
  const matches = [];

  function walk(currentDir, index) {
    if (index === segments.length) {
      matches.push(currentDir);
      return;
    }

    const segment = segments[index];
    if (segment === "*") {
      let names = [];
      try {
        names = readdirSync(currentDir);
      } catch {
        return;
      }

      for (const name of names) {
        const fullPath = join(currentDir, name);
        let stats;
        try {
          stats = statSync(fullPath);
        } catch {
          continue;
        }

        if (!stats.isDirectory()) {
          continue;
        }

        walk(fullPath, index + 1);
      }
      return;
    }

    walk(join(currentDir, segment), index + 1);
  }

  walk(ROOT, 0);
  return matches;
}

function listWorkspaceDirs() {
  const rootPackageJson = readJson(join(ROOT, "package.json"));
  const dirs = [];

  for (const pattern of rootPackageJson.workspaces ?? []) {
    for (const fullPath of expandWorkspacePattern(pattern)) {
      const packageJsonPath = join(fullPath, "package.json");
      try {
        if (statSync(packageJsonPath).isFile()) {
          dirs.push(fullPath);
        }
      } catch {}
    }
  }

  return [...new Set(dirs)].sort();
}

export function collectWorkspacePackages() {
  return listWorkspaceDirs()
    .map((dir) => {
      const relDir = relative(ROOT, dir);
      const packageJsonPath = join(dir, "package.json");
      const packageJson = readJson(packageJsonPath);
      const metadataKind = normalizeKind(packageJson.bedrock?.kind);

      return {
        dir,
        relDir,
        kind: metadataKind ?? classifyPackageKind(relDir),
        name: packageJson.name,
        packageJson,
      };
    })
    .sort((a, b) => a.relDir.localeCompare(b.relDir));
}

export function listFiles(root, extensions = SOURCE_EXTENSIONS) {
  const out = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const name of readdirSync(current)) {
      if (EXCLUDED_DIRS.has(name)) {
        continue;
      }

      const fullPath = join(current, name);
      let stats;
      try {
        stats = lstatSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isSymbolicLink()) {
        try {
          stats = statSync(fullPath);
        } catch {
          continue;
        }
      }

      if (stats.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (/\.d\.(ts|tsx|mts|cts)$/.test(fullPath)) {
        continue;
      }

      if (extensions.has(extname(fullPath))) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

export function getImports(content) {
  const imports = [];

  for (const pattern of IMPORT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
    pattern.lastIndex = 0;
  }

  return imports;
}

export function normalizeWorkspaceSpecifier(specifier) {
  if (!specifier.startsWith("@bedrock/")) {
    return null;
  }

  const parts = specifier.split("/");
  if (parts.length < 2) {
    return null;
  }

  const packageName = parts.slice(0, 2).join("/");
  const subpath = parts.length > 2 ? `./${parts.slice(2).join("/")}` : ".";

  return {
    packageName,
    subpath,
    specifier,
  };
}

export function findOwningPackage(filePath, workspacePackages) {
  const normalized = resolve(filePath);

  for (const pkg of workspacePackages) {
    if (normalized === pkg.dir || normalized.startsWith(`${pkg.dir}/`)) {
      return pkg;
    }
  }

  return null;
}

export function sortPackagesByDirLength(workspacePackages) {
  return [...workspacePackages].sort((a, b) => b.dir.length - a.dir.length);
}

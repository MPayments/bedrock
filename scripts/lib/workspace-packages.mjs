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

function classifyPackageKind(relDir) {
  if (relDir === "packages/common") return "common";
  if (relDir === "packages/platform/db") return "db";
  if (relDir.startsWith("packages/modules/")) return "module";
  if (relDir.startsWith("packages/platform/")) return "platform";
  if (relDir.startsWith("packages/runtime/")) return "runtime";
  if (relDir.startsWith("packages/plugins/")) return "plugin";
  if (relDir.startsWith("packages/integrations/")) return "integration";
  if (relDir.startsWith("packages/sdk/")) return "sdk";
  if (relDir.startsWith("packages/tooling/")) return "tooling";
  if (relDir.startsWith("apps/")) return "app";
  return "unknown";
}

function listWorkspaceDirs() {
  const rootPackageJson = readJson(join(ROOT, "package.json"));
  const dirs = [];

  for (const pattern of rootPackageJson.workspaces ?? []) {
    if (pattern.endsWith("/*")) {
      const baseDir = join(ROOT, pattern.slice(0, -2));
      for (const name of readdirSync(baseDir)) {
        const fullPath = join(baseDir, name);
        if (!statSync(fullPath).isDirectory()) {
          continue;
        }

        const packageJsonPath = join(fullPath, "package.json");
        try {
          if (statSync(packageJsonPath).isFile()) {
            dirs.push(fullPath);
          }
        } catch {}
      }
      continue;
    }

    const fullPath = join(ROOT, pattern);
    const packageJsonPath = join(fullPath, "package.json");
    try {
      if (statSync(packageJsonPath).isFile()) {
        dirs.push(fullPath);
      }
    } catch {}
  }

  return dirs;
}

export function collectWorkspacePackages() {
  return listWorkspaceDirs()
    .map((dir) => {
      const relDir = relative(ROOT, dir);
      const packageJsonPath = join(dir, "package.json");
      const packageJson = readJson(packageJsonPath);

      return {
        dir,
        relDir,
        kind: classifyPackageKind(relDir),
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
  const subpath =
    parts.length > 2 ? `./${parts.slice(2).join("/")}` : ".";

  return {
    packageName,
    subpath,
    specifier,
  };
}

export function findOwningPackage(filePath, workspacePackages) {
  const normalized = resolve(filePath);

  for (const pkg of workspacePackages) {
    if (
      normalized === pkg.dir ||
      normalized.startsWith(`${pkg.dir}/`)
    ) {
      return pkg;
    }
  }

  return null;
}

export function sortPackagesByDirLength(workspacePackages) {
  return [...workspacePackages].sort((a, b) => b.dir.length - a.dir.length);
}

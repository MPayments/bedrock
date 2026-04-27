import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROOT = resolve(__dirname, "../..");

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^"'()]*?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const SOURCE_TARGET_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

export function resolveRootDir(rootDir = process.env.BEDROCK_GUARDRAIL_ROOT) {
  return resolve(rootDir ?? DEFAULT_ROOT);
}

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeKind(kind) {
  switch (kind) {
    case "shared":
    case "module":
    case "workflow":
    case "platform":
    case "plugin":
    case "sdk":
    case "app":
    case "ops":
    case "tooling":
      return kind;
    default:
      return kind;
  }
}

function classifyPackageKind(relDir) {
  if (relDir === "packages/shared" || relDir.startsWith("packages/shared/")) {
    return "shared";
  }
  if (relDir.startsWith("packages/modules/")) return "module";
  if (relDir.startsWith("packages/workflows/")) return "workflow";
  if (
    relDir === "packages/platform" ||
    relDir.startsWith("packages/platform/")
  ) {
    return "platform";
  }
  if (relDir.startsWith("packages/plugins/")) return "plugin";
  if (relDir.startsWith("packages/sdk/")) return "sdk";
  if (relDir.startsWith("packages/tooling/")) return "tooling";
  if (relDir.startsWith("apps/")) return "app";
  if (relDir.startsWith("ops/")) return "ops";
  return "unknown";
}

function expandWorkspacePattern(rootDir, pattern) {
  const segments = pattern.split("/").filter(Boolean);
  const matches = [];

  function walk(currentDir, index) {
    if (index === segments.length) {
      matches.push(currentDir);
      return;
    }

    const segment = segments[index];
    if (segment === "*") {
      let entries = [];
      try {
        entries = readdirSync(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
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

  walk(rootDir, 0);
  return matches;
}

export function collectWorkspacePackages(rootDir = resolveRootDir()) {
  const normalizedRoot = resolveRootDir(rootDir);
  const rootPackageJson = readJson(join(normalizedRoot, "package.json"));
  const dirs = new Set();

  for (const pattern of rootPackageJson.workspaces ?? []) {
    for (const dir of expandWorkspacePattern(normalizedRoot, pattern)) {
      const packageJsonPath = join(dir, "package.json");
      try {
        if (statSync(packageJsonPath).isFile()) {
          dirs.add(dir);
        }
      } catch {}
    }
  }

  return [...dirs].sort().map((dir) => {
    const relDir = toPosixPath(relative(normalizedRoot, dir));
    const packageJson = readJson(join(dir, "package.json"));

    return {
      dir,
      relDir,
      name: packageJson.name,
      kind:
        normalizeKind(packageJson.bedrock?.kind) ?? classifyPackageKind(relDir),
      packageJson,
    };
  });
}

export function listSourceFiles(rootDir, extensions = SOURCE_EXTENSIONS) {
  const files = [];
  const stack = [resolve(rootDir)];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      if (EXCLUDED_DIRS.has(entry)) {
        continue;
      }

      const fullPath = join(current, entry);
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
        files.push(fullPath);
      }
    }
  }

  return files;
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

  return {
    packageName: parts.slice(0, 2).join("/"),
    subpath: parts.length > 2 ? `./${parts.slice(2).join("/")}` : ".",
    specifier,
  };
}

export function findOwningPackage(filePath, workspacePackages) {
  const normalizedPath = resolve(filePath);

  for (const pkg of workspacePackages) {
    if (
      normalizedPath === pkg.dir ||
      normalizedPath.startsWith(`${pkg.dir}/`)
    ) {
      return pkg;
    }
  }

  return null;
}

function isSourceTarget(target) {
  return SOURCE_TARGET_EXTENSIONS.has(extname(target));
}

export function collectExportTargets(entry) {
  if (typeof entry === "string") {
    return [entry];
  }

  if (Array.isArray(entry)) {
    return entry.flatMap((item) => collectExportTargets(item));
  }

  if (entry && typeof entry === "object") {
    return Object.values(entry).flatMap((item) => collectExportTargets(item));
  }

  return [];
}

function matchesExportKey(pattern, subpath) {
  if (!pattern.includes("*")) {
    return pattern === subpath;
  }

  const [prefix, suffix] = pattern.split("*");
  return (
    subpath.startsWith(prefix) &&
    subpath.endsWith(suffix) &&
    subpath.length >= prefix.length + suffix.length
  );
}

function expandExportTarget(pattern, target, subpath) {
  if (!pattern.includes("*")) {
    return target;
  }

  const [prefix, suffix] = pattern.split("*");
  const matched = subpath.slice(prefix.length, subpath.length - suffix.length);
  return target.replace("*", matched);
}

export function isExportedSubpath(exportsField, subpath) {
  if (
    !exportsField ||
    typeof exportsField !== "object" ||
    Array.isArray(exportsField)
  ) {
    return subpath === ".";
  }

  return Object.keys(exportsField).some((pattern) =>
    matchesExportKey(pattern, subpath),
  );
}

export function resolveExportSubpathTargets(
  pkg,
  subpath,
  rootDir = resolveRootDir(),
) {
  const exportsField = pkg.packageJson.exports;
  if (
    !exportsField ||
    typeof exportsField !== "object" ||
    Array.isArray(exportsField)
  ) {
    return [];
  }

  const normalizedRoot = resolveRootDir(rootDir);
  const targets = [];

  for (const [pattern, entry] of Object.entries(exportsField)) {
    if (!matchesExportKey(pattern, subpath)) {
      continue;
    }

    for (const target of collectExportTargets(entry)) {
      const expandedTarget = expandExportTarget(pattern, target, subpath);
      if (!isSourceTarget(expandedTarget)) {
        continue;
      }

      targets.push(
        toPosixPath(relative(normalizedRoot, resolve(pkg.dir, expandedTarget))),
      );
    }
  }

  return [...new Set(targets)];
}

export function buildWorkspaceTsConfig(
  rootDir = resolveRootDir(),
  workspacePackages = collectWorkspacePackages(rootDir),
) {
  const normalizedRoot = resolveRootDir(rootDir);
  const paths = {};

  for (const pkg of workspacePackages) {
    const exportsField = pkg.packageJson.exports;
    if (
      !exportsField ||
      typeof exportsField !== "object" ||
      Array.isArray(exportsField)
    ) {
      continue;
    }

    for (const [subpath, entry] of Object.entries(exportsField)) {
      if (subpath !== "." && !subpath.startsWith("./")) {
        continue;
      }

      const target = collectExportTargets(entry).find((candidate) =>
        isSourceTarget(candidate),
      );
      if (!target) {
        continue;
      }

      const alias =
        subpath === "." ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
      paths[alias] = [
        toPosixPath(relative(normalizedRoot, resolve(pkg.dir, target))),
      ];
    }
  }

  return {
    compilerOptions: {
      allowJs: true,
      baseUrl: normalizedRoot,
      module: "ESNext",
      moduleResolution: "Bundler",
      paths,
      resolveJsonModule: true,
      target: "ES2022",
    },
  };
}

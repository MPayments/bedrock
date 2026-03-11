import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function decodeLegacy(value) {
  return String.fromCharCode(...value);
}

const LEGACY_NAME = decodeLegacy([98, 101, 100, 114, 111, 99, 107]);
const REMOVED_SCOPE = `@${LEGACY_NAME}/`;
const REMOVED_PATH = `packages/${LEGACY_NAME}/`;
const REMOVED_WORKER_TYPE = `${decodeLegacy([66, 101, 100, 114, 111, 99, 107])}Worker`;
const REMOVED_WORKER_METRIC = `${LEGACY_NAME}_worker_`;
const REMOVED_WORKERS_METRIC = `${LEGACY_NAME}_workers_`;

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "scripts"),
  join(ROOT, "docs"),
];
const EXTRA_FILES = [join(ROOT, "README.md"), join(ROOT, "package.json"), join(ROOT, "vitest.config.ts")];
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
]);
const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name)) {
      continue;
    }

    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    const ext = name.slice(name.lastIndexOf("."));
    if (!INCLUDED_EXTENSIONS.has(ext)) {
      continue;
    }

    out.push(fullPath);
  }
}

const files = [];
for (const root of SOURCE_ROOTS) {
  walk(root, files);
}
files.push(...EXTRA_FILES);

const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (
    content.includes(REMOVED_SCOPE) ||
    content.includes(REMOVED_PATH) ||
    content.includes(REMOVED_WORKER_TYPE) ||
    content.includes(REMOVED_WORKER_METRIC) ||
    content.includes(REMOVED_WORKERS_METRIC)
  ) {
    violations.push(relative(ROOT, file));
  }
}

if (violations.length > 0) {
  console.error("Deprecated legacy references found:");
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Deprecated import check passed.");

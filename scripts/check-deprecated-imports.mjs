import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "scripts"),
  join(ROOT, "docs"),
];
const EXTRA_FILES = [
  join(ROOT, "README.md"),
  join(ROOT, "package.json"),
  join(ROOT, "vitest.config.ts"),
];
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
]);
const EXCLUDED_PATH_SEGMENTS = [
  "/packages/bedrock/",
];
const EXCLUDED_FILES = new Set([
  fileURLToPath(import.meta.url),
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
const DEPRECATED_PATTERNS = [
  "@hono/",
  'from "hono"',
  "from 'hono'",
  'from "hono/client"',
  "from 'hono/client'",
  "@scalar/hono-api-reference",
  "@bedrock/http-hono",
];
const DEPRECATED_REGEXES = [
  /@multihansa\/(?:identity|assets|ledger|accounting|balances|documents|parties|reporting|treasury|reconciliation)\/bedrock\b/,
];

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

    if (!INCLUDED_EXTENSIONS.has(extname(name))) {
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
  if (EXCLUDED_FILES.has(file)) {
    continue;
  }

  const content = readFileSync(file, "utf8");
  if (EXCLUDED_PATH_SEGMENTS.some((segment) => file.includes(segment))) {
    continue;
  }
  const matchedPattern = DEPRECATED_PATTERNS.find((pattern) =>
    content.includes(pattern),
  );
  const matchedRegex = DEPRECATED_REGEXES.find((pattern) =>
    pattern.test(content),
  );
  const matched = matchedPattern ?? matchedRegex?.toString();
  if (!matched) {
    continue;
  }

  violations.push({
    file: relative(ROOT, file),
    pattern: matched,
  });
}

if (violations.length > 0) {
  console.error("Deprecated Hono references found:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: contains ${violation.pattern}`);
  }
  process.exit(1);
}

console.log("Deprecated import check passed.");

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LEGACY_SPECIFIER_PATTERN =
  /@bedrock\/(foundation|platform|modules|accounting|balances|component-runtime|connectors|dimensions|documents|idempotency|ledger|orchestration|reconciliation|currencies|counterparties|customers|counterparty-accounts|accounting-reporting|fees|fx|payments)(?:\/|["'])/g;

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "scripts"),
];

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

const violations = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  LEGACY_SPECIFIER_PATTERN.lastIndex = 0;

  const match = LEGACY_SPECIFIER_PATTERN.exec(content);
  if (match) {
    violations.push({
      file: file.replace(`${ROOT}/`, ""),
      specifier: match[0].replace(/["']$/, ""),
    });
  }
}

if (violations.length > 0) {
  console.error("Deprecated runtime import specifiers found:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`);
  }
  process.exit(1);
}

console.log("Deprecated runtime import check passed.");

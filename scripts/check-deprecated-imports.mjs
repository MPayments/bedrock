import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const REMOVED_BEDROCK_SPECIFIER_PATTERN =
  /@bedrock\/(foundation|core|application|zod|sql|workers|operations|identity|registers|workflows|assets|ledger|accounting|balances|reconciliation)(?:\/|["'])/g;
const REMOVED_BEDROCK_PRODUCT_SPECIFIER_PATTERN =
  /@bedrock\/(accounting-reporting|bedrock-app|counterparties|customers|db|api-client|ui|eslint-config|typescript-config|test-utils|fees|fx|ifrs-documents|organizations|payments|requisite-providers|requisites)(?:\/|["'])/g;
const REMOVED_MULTIHANSA_SPECIFIER_PATTERN =
  /@multihansa\/(accounting-reporting|counterparties|customers|api-client|eslint-config|typescript-config|test-utils|fees|fx|ifrs-documents|organizations|payments|requisite-providers|requisites)(?:\/|["'])/g;

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
  REMOVED_BEDROCK_SPECIFIER_PATTERN.lastIndex = 0;
  REMOVED_BEDROCK_PRODUCT_SPECIFIER_PATTERN.lastIndex = 0;
  REMOVED_MULTIHANSA_SPECIFIER_PATTERN.lastIndex = 0;

  const match = REMOVED_BEDROCK_SPECIFIER_PATTERN.exec(content);
  if (match) {
    violations.push({
      file: file.replace(`${ROOT}/`, ""),
      specifier: match[0].replace(/["']$/, ""),
    });
  }

  const bedrockProductMatch =
    REMOVED_BEDROCK_PRODUCT_SPECIFIER_PATTERN.exec(content);
  if (bedrockProductMatch) {
    violations.push({
      file: file.replace(`${ROOT}/`, ""),
      specifier: bedrockProductMatch[0].replace(/["']$/, ""),
    });
  }

  const multihansaMatch = REMOVED_MULTIHANSA_SPECIFIER_PATTERN.exec(content);
  if (multihansaMatch) {
    violations.push({
      file: file.replace(`${ROOT}/`, ""),
      specifier: multihansaMatch[0].replace(/["']$/, ""),
    });
  }
}

if (violations.length > 0) {
  console.error("Disallowed import specifiers found:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`);
  }
  process.exit(1);
}

console.log("Disallowed import specifier check passed.");

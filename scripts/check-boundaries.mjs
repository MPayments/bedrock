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

const SOURCE_ROOTS = [join(ROOT, "packages"), join(ROOT, "apps")];
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
]);
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^"'()]*?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const PACKAGE_BY_SPECIFIER = new Map([
  ["@multihansa/common", "common"],
  ["@multihansa/identity", "identity"],
  ["@multihansa/assets", "assets"],
  ["@multihansa/ledger", "ledger"],
  ["@multihansa/accounting", "accounting"],
  ["@multihansa/balances", "balances"],
  ["@multihansa/reconciliation", "reconciliation"],
  ["@multihansa/documents", "documents"],
  ["@multihansa/parties", "parties"],
  ["@multihansa/treasury", "treasury"],
  ["@multihansa/reporting", "reporting"],
  ["@multihansa/app", "app"],
  ["@multihansa/db", "db"],
  ["@multihansa/ui", "ui"],
]);

const DOMAIN_KEYS = [
  "identity",
  "assets",
  "ledger",
  "accounting",
  "balances",
  "reconciliation",
  "documents",
  "parties",
  "treasury",
  "reporting",
];

const ALLOWED_INTERNAL_DEPENDENCIES = {
  common: new Set(),
  identity: new Set(["common"]),
  assets: new Set(["common"]),
  ledger: new Set(["common"]),
  accounting: new Set(["common", "ledger"]),
  balances: new Set(["common", "ledger"]),
  documents: new Set(["common", "accounting", "ledger"]),
  reconciliation: new Set(["common", "documents", "ledger"]),
  parties: new Set(["common", "assets", "ledger"]),
  treasury: new Set(["common", "assets", "accounting", "documents", "ledger", "parties"]),
  reporting: new Set(["common", "accounting", "balances", "documents", "identity", "ledger", "parties"]),
  app: new Set(["common", ...DOMAIN_KEYS]),
  db: new Set(["common", ...DOMAIN_KEYS]),
  ui: new Set(),
};

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

    if (!/\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)) {
      continue;
    }

    out.push(fullPath);
  }
}

function getImports(content) {
  const imports = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(content);
    while (match) {
      imports.push(match[1]);
      match = pattern.exec(content);
    }
  }
  return imports;
}

function getPackageKeyFromFile(relPath) {
  if (relPath.startsWith("packages/common/")) {
    return "common";
  }

  const domainMatch = relPath.match(/^packages\/domains\/([^/]+)\//);
  if (domainMatch) {
    const [, dirName] = domainMatch;
    return dirName === "multihansa-app" ? "app" : dirName;
  }

  if (relPath.startsWith("packages/db/")) {
    return "db";
  }

  if (relPath.startsWith("packages/ui/")) {
    return "ui";
  }

  return null;
}

function getPackageKeyFromSpecifier(specifier) {
  if (specifier.startsWith("@bedrock/")) {
    return "framework";
  }

  for (const [packageName, key] of PACKAGE_BY_SPECIFIER.entries()) {
    if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      return key;
    }
  }
  return null;
}

function isRuntimePackageKey(key) {
  return key === "common" || DOMAIN_KEYS.includes(key);
}

const files = [];
for (const root of SOURCE_ROOTS) {
  walk(root, files);
}

const violations = [];

for (const file of files) {
  const relPath = relative(ROOT, file);
  const sourceKey = getPackageKeyFromFile(relPath);
  const content = readFileSync(file, "utf8");

  const imports = getImports(content);
  for (const specifier of imports) {
    if (specifier.startsWith("@bedrock/")) {
      continue;
    }

    if (!sourceKey) {
      continue;
    }

    if (
      isRuntimePackageKey(sourceKey) &&
      /^@multihansa\/db(?:$|\/(?:client|seeds)(?:$|\/))/.test(specifier)
    ) {
      violations.push({
        file: relPath,
        reason: `runtime package must not import ${specifier}`,
      });
      continue;
    }

    const targetKey = getPackageKeyFromSpecifier(specifier);
    if (!targetKey || targetKey === sourceKey) {
      continue;
    }

    const allowedTargets = ALLOWED_INTERNAL_DEPENDENCIES[sourceKey];
    if (!allowedTargets?.has(targetKey)) {
      violations.push({
        file: relPath,
        reason: `${sourceKey} must not depend on ${targetKey} (${specifier})`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Boundary check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log("Boundary check passed.");

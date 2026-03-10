import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const config = require("../dependency-cruiser.cjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_ROOTS = [
  join(ROOT, "packages"),
  join(ROOT, "apps"),
  join(ROOT, "scripts"),
  join(ROOT, "infra"),
].filter((candidate) => {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
});
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^"'()]*?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function listFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const name of readdirSync(current)) {
      const fullPath = join(current, name);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (
          name === "node_modules" ||
          name === "dist" ||
          name === "coverage" ||
          name === ".next"
        ) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (
        fullPath.endsWith(".ts") ||
        fullPath.endsWith(".tsx") ||
        fullPath.endsWith(".mts") ||
        fullPath.endsWith(".cts")
      ) {
        if (/\.d\.(ts|tsx|mts|cts)$/.test(fullPath)) {
          continue;
        }
        out.push(fullPath);
      }
    }
  }
  return out;
}

function getImports(content) {
  const imports = [];
  for (const pattern of IMPORT_PATTERNS) {
    let match = pattern.exec(content);
    while (match) {
      imports.push(match[1]);
      match = pattern.exec(content);
    }
  }
  return imports;
}

function collectWorkspacePackages(root) {
  const packages = new Map();
  const stack = [join(root, "packages"), join(root, "apps")];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const name of readdirSync(current)) {
      const fullPath = join(current, name);
      const stats = statSync(fullPath);
      if (!stats.isDirectory()) {
        continue;
      }
      if (
        name === "node_modules" ||
        name === "dist" ||
        name === "coverage" ||
        name === ".next"
      ) {
        continue;
      }

      const packageJsonPath = join(fullPath, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        if (typeof pkg.name === "string" && pkg.name.length > 0) {
          packages.set(pkg.name, relative(root, fullPath));
          continue;
        }
      } catch {}

      stack.push(fullPath);
    }
  }

  return packages;
}

const packageDirsByName = collectWorkspacePackages(ROOT);
const INTERNAL_PACKAGE_SCOPES = ["@bedrock/", "@multihansa/"];

function toWorkspacePath(importPath) {
  if (INTERNAL_PACKAGE_SCOPES.some((scope) => importPath.startsWith(scope))) {
    const parts = importPath.split("/");
    const packageName = parts.slice(0, 2).join("/");
    const packageDir = packageDirsByName.get(packageName);
    if (!packageDir) return null;

    const subpath = parts.slice(2).join("/");
    if (subpath.length === 0) {
      return `${packageDir}/src`;
    }

    return `${packageDir}/src/${subpath}.ts`;
  }
  if (importPath.startsWith("apps/")) return importPath;
  if (importPath.startsWith("packages/")) return importPath;
  return null;
}

function buildForbiddenRule(rule) {
  return {
    name: rule.name,
    from: new RegExp(rule.from.path),
    to: new RegExp(rule.to.path),
  };
}

const forbiddenRules = (config.forbidden ?? []).map(buildForbiddenRule);
const violations = [];
const REMOVED_BEDROCK_SPECIFIER_PATTERNS = [
  /^@bedrock\/foundation(?:\/|$)/,
  /^@bedrock\/core(?:\/|$)/,
  /^@bedrock\/application(?:\/|$)/,
  /^@bedrock\/zod(?:\/|$)/,
  /^@bedrock\/sql(?:\/|$)/,
  /^@bedrock\/workers(?:\/|$)/,
  /^@bedrock\/operations(?:\/|$)/,
  /^@bedrock\/identity(?:\/|$)/,
  /^@bedrock\/registers(?:\/|$)/,
  /^@bedrock\/workflows(?:\/|$)/,
  /^@bedrock\/assets(?:\/|$)/,
  /^@bedrock\/ledger(?:\/|$)/,
  /^@bedrock\/accounting(?:\/|$)/,
  /^@bedrock\/balances(?:\/|$)/,
  /^@bedrock\/reconciliation(?:\/|$)/,
];
const REMOVED_PRODUCT_SPECIFIER_PATTERNS = [
  /^@bedrock\/bedrock-app(?:\/|$)/,
  /^@bedrock\/db(?:\/|$)/,
  /^@bedrock\/ui(?:\/|$)/,
  /^@bedrock\/api-client(?:\/|$)/,
  /^@bedrock\/eslint-config(?:\/|$)/,
  /^@bedrock\/typescript-config(?:\/|$)/,
  /^@bedrock\/test-utils(?:\/|$)/,
  /^@bedrock\/counterparties(?:\/|$)/,
  /^@bedrock\/customers(?:\/|$)/,
  /^@bedrock\/organizations(?:\/|$)/,
  /^@bedrock\/requisites(?:\/|$)/,
  /^@bedrock\/requisite-providers(?:\/|$)/,
  /^@bedrock\/fees(?:\/|$)/,
  /^@bedrock\/fx(?:\/|$)/,
  /^@bedrock\/payments(?:\/|$)/,
  /^@bedrock\/ifrs-documents(?:\/|$)/,
  /^@bedrock\/accounting-reporting(?:\/|$)/,
  /^@multihansa\/counterparties(?:\/|$)/,
  /^@multihansa\/customers(?:\/|$)/,
  /^@multihansa\/organizations(?:\/|$)/,
  /^@multihansa\/requisites(?:\/|$)/,
  /^@multihansa\/requisite-providers(?:\/|$)/,
  /^@multihansa\/fees(?:\/|$)/,
  /^@multihansa\/fx(?:\/|$)/,
  /^@multihansa\/payments(?:\/|$)/,
  /^@multihansa\/ifrs-documents(?:\/|$)/,
  /^@multihansa\/accounting-reporting(?:\/|$)/,
  /^@multihansa\/api-client(?:\/|$)/,
  /^@multihansa\/eslint-config(?:\/|$)/,
  /^@multihansa\/typescript-config(?:\/|$)/,
  /^@multihansa\/test-utils(?:\/|$)/,
];
const DB_TYPES_SPECIFIER = /^@multihansa\/db\/types(?:\/|$)/;
const DB_RUNTIME_BLOCKED_SPECIFIER =
  /^@multihansa\/db(?:$|\/(?:client|seeds)(?:$|\/))/;
function isRuntimePackageFile(file) {
  return /^packages\/(bedrock|domains)\/[^/]+\/src\//.test(file);
}

function isSchemaDefinitionFile(file) {
  return (
    /\/src\/[^/]+\/schema\.ts$/.test(file) ||
    /\/src\/[^/]+\/schema\/.+\.ts$/.test(file) ||
    /\/src\/schema\.ts$/.test(file) ||
    /\/src\/schema\/.+\.ts$/.test(file)
  );
}

function isAllowedContractImport(fromFile, specifier) {
  return specifier === "@bedrock/common/countries/contracts";
}

for (const root of SOURCE_ROOTS) {
  for (const filePath of listFiles(root)) {
    const relFile = relative(ROOT, filePath);
    const content = readFileSync(filePath, "utf8");

    if (content.includes("pgTable(") && !isSchemaDefinitionFile(relFile)) {
      violations.push({
        rule: "pgtable-outside-schema",
        from: relFile,
        to: relFile,
        specifier: "pgTable(",
      });
    }

    const imports = getImports(content);

    for (const specifier of imports) {
      if (specifier.startsWith(".") || specifier.startsWith("node:")) {
        continue;
      }

      if (
        REMOVED_BEDROCK_SPECIFIER_PATTERNS.some((pattern) =>
          pattern.test(specifier),
        ) &&
        !relFile.startsWith("packages/bedrock/common/")
      ) {
        violations.push({
          rule: "removed-bedrock-import",
          from: relFile,
          to: specifier,
          specifier,
        });
        continue;
      }

      if (
        REMOVED_PRODUCT_SPECIFIER_PATTERNS.some((pattern) =>
          pattern.test(specifier),
        )
      ) {
        violations.push({
          rule: "removed-product-import",
          from: relFile,
          to: specifier,
          specifier,
        });
        continue;
      }

      if (
        isRuntimePackageFile(relFile) &&
        DB_RUNTIME_BLOCKED_SPECIFIER.test(specifier) &&
        !DB_TYPES_SPECIFIER.test(specifier)
      ) {
        violations.push({
          rule: "runtime-no-db-client",
          from: relFile,
          to: specifier,
          specifier,
        });
        continue;
      }

      if (
        relFile.startsWith("apps/web/") &&
        INTERNAL_PACKAGE_SCOPES.some((scope) => specifier.startsWith(scope))
      ) {
        const allowed =
          specifier.startsWith("@multihansa/ui") ||
          specifier === "@/lib/api-client" ||
          specifier.startsWith("@/lib/api-client/") ||
          /^@multihansa\/[^/]+(?:\/[^/]+)*\/contracts$/.test(specifier) ||
          specifier.startsWith("@bedrock/common") ||
          /^@bedrock\/[^/]+(?:\/[^/]+)*\/contracts$/.test(specifier) ||
          /^@bedrock\/platform\/identity\/validation$/.test(specifier);

        if (!allowed) {
          violations.push({
            rule: "web-import-surface",
            from: relFile,
            to: specifier,
            specifier,
          });
          continue;
        }
      }

      if (isAllowedContractImport(relFile, specifier)) {
        continue;
      }

      const targetPath = toWorkspacePath(specifier);
      if (!targetPath) continue;

      for (const rule of forbiddenRules) {
        if (rule.from.test(relFile) && rule.to.test(targetPath)) {
          violations.push({
            rule: rule.name,
            from: relFile,
            to: targetPath,
            specifier,
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Dependency boundary check failed:");
  for (const violation of violations) {
    console.error(
      `- [${violation.rule}] ${violation.from} -> ${violation.specifier} (${violation.to})`,
    );
  }
  process.exit(1);
}

console.log("Dependency boundary check passed.");

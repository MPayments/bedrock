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

function toWorkspacePath(importPath) {
  if (importPath.startsWith("@bedrock/")) {
    const parts = importPath.split("/");
    const packageName = parts.slice(0, 2).join("/");
    const packageDir = packageDirsByName.get(packageName);
    if (!packageDir) return null;

    if (packageName === "@bedrock/platform" || packageName === "@bedrock/modules") {
      const domain = parts[2];
      if (!domain) {
        return `${packageDir}`;
      }

      const subpath = parts.slice(3).join("/");
      if (subpath.length === 0) {
        return `${packageDir}/src/${domain}`;
      }

      return `${packageDir}/src/${domain}/${subpath}.ts`;
    }

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
const LEGACY_SPECIFIER_PATTERNS = [
  /^@bedrock\/kernel(?:\/|$)/,
  /^@bedrock\/accounting-contracts(?:\/|$)/,
  /^@bedrock\/countries(?:\/|$)/,
  /^@bedrock\/packs-schema(?:\/|$)/,
  /^@bedrock\/pack-bedrock-core-default(?:\/|$)/,
  /^@bedrock\/db-contracts(?:\/|$)/,
  /^@bedrock\/foundation\/db-contracts(?:\/|$)/,
];
const DB_TYPES_SPECIFIER = /^@bedrock\/db\/types(?:\/|$)/;
const DB_RUNTIME_BLOCKED_SPECIFIER = /^@bedrock\/db(?:$|\/(?:client|seeds)(?:$|\/))/;
const RUNTIME_SCHEMA_SPECIFIER =
  /^@bedrock\/(?:platform|modules)\/[^/]+\/schema(?:\/|$)/;

function isRuntimePackageFile(file) {
  return /^packages\/(modules|platform)\/src\/[^/]+\//.test(file);
}

function isSchemaDefinitionFile(file) {
  return (
    /\/src\/schema\.ts$/.test(file) ||
    /\/src\/schema\/.+\.ts$/.test(file)
  );
}

function isAllowedContractImport(fromFile, specifier) {
  return (
    fromFile.startsWith("packages/platform/src/") &&
    specifier === "@bedrock/foundation/countries/contracts"
  );
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
        LEGACY_SPECIFIER_PATTERNS.some((pattern) => pattern.test(specifier)) &&
        !relFile.startsWith("packages/foundation/")
      ) {
        violations.push({
          rule: "legacy-foundation-import",
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

      if (RUNTIME_SCHEMA_SPECIFIER.test(specifier)) {
        violations.push({
          rule: "runtime-schema-import",
          from: relFile,
          to: specifier,
          specifier,
        });
        continue;
      }

      if (relFile.startsWith("apps/web/") && specifier.startsWith("@bedrock/")) {
        const allowed =
          specifier.startsWith("@bedrock/ui") ||
          specifier === "@bedrock/foundation/countries" ||
          specifier === "@bedrock/foundation/countries/contracts" ||
          specifier === "@bedrock/api-client" ||
          specifier.startsWith("@bedrock/api-client/") ||
          /^@bedrock\/(?:platform|modules)\/[^/]+\/contracts$/.test(specifier);

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

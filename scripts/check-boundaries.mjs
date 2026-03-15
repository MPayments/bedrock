import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  ROOT,
  SOURCE_EXTENSIONS,
  collectWorkspacePackages,
  findOwningPackage,
  getImports,
  listFiles,
  normalizeWorkspaceSpecifier,
  sortPackagesByDirLength,
} from "./lib/workspace-packages.mjs";

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "ops"),
  join(ROOT, "scripts"),
  join(ROOT, "tests"),
].filter((candidate) => {
  try {
    return listFiles(candidate, SOURCE_EXTENSIONS).length >= 0;
  } catch {
    return false;
  }
});

const REQUIRED_EXPORT_KINDS = new Set([
  "shared",
  "module",
  "workflow",
  "platform",
  "plugin",
  "sdk",
]);

const ALLOWED_IMPORT_KINDS = {
  shared: new Set(["shared"]),
  module: new Set(["shared", "module", "platform"]),
  workflow: new Set(["shared", "module", "platform", "workflow"]),
  platform: new Set(["shared", "platform", "module"]),
  plugin: new Set(["shared", "module", "plugin", "platform"]),
  sdk: new Set(["shared", "sdk", "app"]),
  tooling: null,
  ops: null,
  app: null,
  unknown: null,
};

const workspacePackages = collectWorkspacePackages();
const packagesByName = new Map(workspacePackages.map((pkg) => [pkg.name, pkg]));
const packagesByDirLength = sortPackagesByDirLength(workspacePackages);
const packageGraph = new Map(
  workspacePackages
    .filter((pkg) => !["app", "tooling", "ops"].includes(pkg.kind))
    .map((pkg) => [pkg.name, new Set()]),
);
const violations = [];

function isSchemaDefinitionFile(file) {
  return /\/src\/(?:.+\/)?schema(?:\.ts|\/.+\.ts)$/.test(file);
}

function isIntegrationTestFile(relFile) {
  return /(^|\/)tests(?:\/[^/]+)*\/integration\//.test(relFile);
}

function isDbRootImport(normalized) {
  return (
    normalized.packageName === "@bedrock/platform" &&
    ["./postgres", "./postgres/client"].includes(normalized.subpath)
  );
}

function isDbImportAllowed(owner, relFile) {
  if (isIntegrationTestFile(relFile)) {
    return true;
  }

  if (!owner) {
    return false;
  }

  if (
    owner.name === "@bedrock/platform" ||
    owner.kind === "app" ||
    owner.kind === "ops" ||
    owner.kind === "tooling"
  ) {
    return true;
  }

  if (
    relFile.startsWith("tests/integration/") ||
    /\/tests\/integration\//.test(relFile)
  ) {
    return true;
  }

  return false;
}

function isDocumentsSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  return false;
}

function isBalancesSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  return false;
}

function isOrganizationsSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  return false;
}

function isPartiesSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  return false;
}

function isRequisitesSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  return false;
}

function isLedgerSchemaImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (isPluginInfraFile(relFile)) {
    return true;
  }

  if (isSchemaDefinitionFile(relFile)) {
    return true;
  }

  if (relFile.startsWith("packages/modules/balances/src/infra/")) {
    return true;
  }

  return false;
}

function isLedgerIdsImportAllowed(relFile) {
  if (relFile.startsWith("apps/db/")) {
    return true;
  }

  if (/(^|\/)tests\//.test(relFile)) {
    return true;
  }

  if (relFile.startsWith("packages/modules/ledger/")) {
    return true;
  }

  return false;
}

function iterateExportTargets(exportsField) {
  if (!exportsField) {
    return [];
  }

  if (typeof exportsField === "string") {
    return [exportsField];
  }

  if (Array.isArray(exportsField)) {
    return exportsField.flatMap((entry) => iterateExportTargets(entry));
  }

  return Object.values(exportsField).flatMap((entry) =>
    iterateExportTargets(entry),
  );
}

function isExportedSubpath(pkg, subpath) {
  const exportsField = pkg.packageJson.exports;
  if (!exportsField) {
    return false;
  }

  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return subpath === ".";
  }

  if (Object.prototype.hasOwnProperty.call(exportsField, subpath)) {
    return true;
  }

  for (const key of Object.keys(exportsField)) {
    if (!key.includes("*")) {
      continue;
    }

    const pattern = new RegExp(
      `^${key
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\\*/g, "(.+)")}$`,
    );

    if (pattern.test(subpath)) {
      return true;
    }
  }

  return false;
}

function recordViolation(rule, from, specifier, to = specifier) {
  violations.push({ rule, from, specifier, to });
}

function hasRuntimeRootExportLeak(owner, relFile, content) {
  if (!owner || owner.kind !== "module") {
    return false;
  }

  if (relFile !== `${owner.relDir}/src/index.ts`) {
    return false;
  }

  return (
    /create[A-Za-z0-9]+WorkerDefinition/.test(content) ||
    /from\s+["']\.\/workers?(?:\/|["'])/.test(content)
  );
}

function isKindAllowed(ownerKind, targetKind) {
  const allowedKinds = ALLOWED_IMPORT_KINDS[ownerKind] ?? null;
  if (!allowedKinds) {
    return true;
  }

  return allowedKinds.has(targetKind);
}

function isAccountingDomainFile(relFile) {
  return /^packages\/modules\/accounting\/src\/domain\//.test(relFile);
}

function isAccountingApplicationFile(relFile) {
  return /^packages\/modules\/accounting\/src\/application\//.test(relFile);
}

function isAccountingPortsFile(relFile) {
  return /^packages\/modules\/accounting\/src\/application\/.+\/ports\.ts$/.test(
    relFile,
  );
}

function isAccountingInfraFile(relFile) {
  return /^packages\/modules\/accounting\/src\/infra\//.test(relFile);
}

function isPluginInfraFile(relFile) {
  return /^packages\/plugins\/[^/]+\/src\/infra\//.test(relFile);
}

function isAccountingRuntimeSource(relFile) {
  return /^packages\/modules\/accounting\/src\//.test(relFile);
}

for (const pkg of workspacePackages) {
  if (REQUIRED_EXPORT_KINDS.has(pkg.kind) && !pkg.packageJson.exports) {
    recordViolation("missing-exports", pkg.relDir, pkg.name, pkg.relDir);
    continue;
  }

  if (!pkg.packageJson.exports) {
    continue;
  }

  for (const target of iterateExportTargets(pkg.packageJson.exports)) {
    if (typeof target !== "string") {
      continue;
    }

    if (target.includes("/internal/")) {
      recordViolation(
        "internal-export",
        pkg.relDir,
        target,
        `${pkg.relDir}/package.json`,
      );
    }
  }
}

for (const root of SOURCE_ROOTS) {
  for (const filePath of listFiles(root, SOURCE_EXTENSIONS)) {
    const relFile = relative(ROOT, filePath);
    const content = readFileSync(filePath, "utf8");
    const owner = findOwningPackage(filePath, packagesByDirLength);
    const isRuntimeSourceFile =
      owner && relFile.startsWith(`${owner.relDir}/src/`);

    if (hasRuntimeRootExportLeak(owner, relFile, content)) {
      recordViolation("runtime-root-export", relFile, owner.name, relFile);
    }

    if (
      owner &&
      relFile.includes("/src/") &&
      content.includes("pgTable(") &&
      !isSchemaDefinitionFile(relFile)
    ) {
      recordViolation("pgtable-outside-schema", relFile, "pgTable(", relFile);
    }

    if (
      /^packages\/modules\/users\/src\/internal\//.test(relFile)
    ) {
      recordViolation("users-internal-folder", relFile, relFile);
    }

    if (
      /^packages\/modules\/users\/src\//.test(relFile) &&
      (
        content.includes("@bedrock/platform/auth-model/schema") ||
        content.includes("@bedrock/platform/auth-model/infra/") ||
        content.includes("better-auth/crypto")
      )
    ) {
      recordViolation(
        "users-bypasses-identity-ports",
        relFile,
        "@bedrock/platform/auth-model/schema|@bedrock/platform/auth-model/infra/*|better-auth/crypto",
      );
    }

    if (
      /^packages\/platform\/src\/auth-model\//.test(relFile) &&
      content.includes("@bedrock/users")
    ) {
      recordViolation("identity-imports-users", relFile, "@bedrock/users");
    }

    if (
      /^packages\/modules\/fx\/src\//.test(relFile) &&
      /\b(?:CurrenciesService|FeesService)\b/.test(content)
    ) {
      recordViolation(
        "fx-imports-full-sibling-services",
        relFile,
        "CurrenciesService|FeesService",
      );
    }

    if (
      /^packages\/modules\/documents\/src\//.test(relFile) &&
      /\b(?:AccountingRuntime|LedgerEngine|LedgerReadService)\b/.test(content)
    ) {
      recordViolation(
        "documents-imports-broad-runtime-services",
        relFile,
        "AccountingRuntime|LedgerEngine|LedgerReadService",
      );
    }

    if (
      /^packages\/modules\/(?:balances|documents|reconciliation)\/src\//.test(
        relFile,
      ) &&
      content.includes("createIdempotencyService(")
    ) {
      recordViolation(
        "module-constructs-idempotency",
        relFile,
        "createIdempotencyService(",
      );
    }

    if (
      isAccountingRuntimeSource(relFile) &&
      !isAccountingInfraFile(relFile) &&
      !isSchemaDefinitionFile(relFile) &&
      content.includes('from "drizzle-orm"')
    ) {
      recordViolation("accounting-drizzle-outside-infra", relFile, "drizzle-orm");
    }

    if (
      isAccountingPortsFile(relFile) &&
      /from\s+["'](?:\.\.\/)+schema(?:\.ts|["'/])/.test(content)
    ) {
      recordViolation("accounting-ports-import-schema", relFile, "schema");
    }

    if (
      isAccountingApplicationFile(relFile) &&
      /createDrizzleAccounting[A-Za-z]+|create(?:Balances|Counterparties|Currencies|Customers|Documents|Ledger|Organizations|Requisites)Queries\(/.test(
        content,
      )
    ) {
      recordViolation(
        "accounting-application-constructs-adapters",
        relFile,
        "createDrizzleAccounting*|create*Queries(",
      );
    }

    for (const specifier of getImports(content)) {
      if (specifier.startsWith("node:")) {
        continue;
      }

      if (specifier.startsWith(".") || specifier.startsWith("..")) {
        if (!owner) {
          continue;
        }

        const targetPath = resolve(dirname(filePath), specifier);
        const targetOwner = findOwningPackage(targetPath, packagesByDirLength);

        if (targetOwner && targetOwner.name !== owner.name) {
          recordViolation(
            "cross-package-relative-import",
            relFile,
            specifier,
            relative(ROOT, targetPath),
          );
          continue;
        }

        const relTargetPath = relative(ROOT, targetPath);

        if (
          isAccountingDomainFile(relFile) &&
          /^packages\/modules\/accounting\/src\/(?:contracts|application|infra)\//.test(
            relTargetPath,
          )
        ) {
          recordViolation("accounting-domain-layer-import", relFile, specifier);
          continue;
        }

        if (
          isAccountingApplicationFile(relFile) &&
          /^packages\/modules\/accounting\/src\/infra\//.test(relTargetPath)
        ) {
          recordViolation("accounting-application-imports-infra", relFile, specifier);
          continue;
        }

        if (
          isAccountingApplicationFile(relFile) &&
          /^packages\/modules\/accounting\/src\/schema(?:\.ts|\/)/.test(relTargetPath)
        ) {
          recordViolation("accounting-application-imports-schema", relFile, specifier);
          continue;
        }

        if (
          owner?.name !== "@bedrock/requisites" &&
          /^packages\/modules\/requisites\/src\/internal\//.test(relTargetPath)
        ) {
          recordViolation("requisites-internal-import", relFile, specifier);
          continue;
        }

        if (
          owner?.name !== "@bedrock/balances" &&
          /^packages\/modules\/balances\/src\/internal\//.test(relTargetPath)
        ) {
          recordViolation("balances-internal-import", relFile, specifier);
          continue;
        }

        if (
          owner?.name !== "@bedrock/parties" &&
          /^packages\/modules\/parties\/src\/internal\//.test(relTargetPath)
        ) {
          recordViolation("parties-internal-import", relFile, specifier);
          continue;
        }

        if (
          owner?.name !== "@bedrock/documents" &&
          /^packages\/modules\/documents\/src\/internal\//.test(relTargetPath)
        ) {
          recordViolation("documents-internal-import", relFile, specifier);
          continue;
        }

      if (
        owner?.name !== "@bedrock/organizations" &&
        /^packages\/modules\/organizations\/src\/internal\//.test(relTargetPath)
      ) {
        recordViolation("organizations-internal-import", relFile, specifier);
        continue;
      }

      if (
        owner?.name !== "@bedrock/ledger" &&
        /^packages\/modules\/ledger\/src\/internal\//.test(relTargetPath)
      ) {
          recordViolation("ledger-internal-import", relFile, specifier);
          continue;
        }

        continue;
      }

      if (
        specifier.startsWith("packages/") ||
        specifier.startsWith("apps/") ||
        specifier.startsWith("ops/") ||
        specifier.startsWith("/")
      ) {
        recordViolation(
          "workspace-path-import",
          relFile,
          specifier,
          specifier,
        );
        continue;
      }

      const normalized = normalizeWorkspaceSpecifier(specifier);
      if (!normalized) {
        continue;
      }

      const targetPkg = packagesByName.get(normalized.packageName);
      if (!targetPkg) {
        continue;
      }

      if (
        owner?.kind === "plugin" &&
        isRuntimeSourceFile &&
        targetPkg.name !== owner.name &&
        !isPluginInfraFile(relFile) &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        )
      ) {
        recordViolation("plugin-imports-foreign-schema", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/requisites" &&
        (
          normalized.subpath === "./validation" ||
          normalized.subpath.startsWith("./validation/") ||
          normalized.subpath === "./providers" ||
          normalized.subpath.startsWith("./providers/") ||
          normalized.subpath === "./providers/contracts" ||
          normalized.subpath.startsWith("./providers/contracts/") ||
          normalized.subpath === "./providers/validation" ||
          normalized.subpath.startsWith("./providers/validation/")
        )
      ) {
        recordViolation("requisites-removed-subpath", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/parties" &&
        (
          normalized.subpath === "./validation" ||
          normalized.subpath.startsWith("./validation/")
        )
      ) {
        recordViolation("parties-removed-subpath", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/organizations" &&
        (
          normalized.subpath === "./validation" ||
          normalized.subpath.startsWith("./validation/")
        )
      ) {
        recordViolation("organizations-removed-subpath", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/balances" &&
        (
          normalized.subpath === "./validation" ||
          normalized.subpath.startsWith("./validation/")
        )
      ) {
        recordViolation("balances-removed-subpath", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/documents" &&
        (
          normalized.subpath === "./module-kit" ||
          normalized.subpath.startsWith("./module-kit/") ||
          normalized.subpath === "./financial-lines" ||
          normalized.subpath.startsWith("./financial-lines/") ||
          normalized.subpath === "./validation" ||
          normalized.subpath.startsWith("./validation/") ||
          normalized.subpath === "./state-machine" ||
          normalized.subpath.startsWith("./state-machine/") ||
          normalized.subpath === "./form-types" ||
          normalized.subpath.startsWith("./form-types/")
        )
      ) {
        recordViolation("documents-removed-subpath", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/ledger" &&
        (
          normalized.subpath === "./infra/tigerbeetle" ||
          normalized.subpath.startsWith("./infra/tigerbeetle/")
        )
      ) {
        recordViolation("ledger-removed-subpath", relFile, specifier);
      }

      if (
        owner?.name === "@bedrock/reconciliation" &&
        isRuntimeSourceFile &&
        !isSchemaDefinitionFile(relFile) &&
        targetPkg.name !== owner.name &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        )
      ) {
        recordViolation(
          "strict-module-imports-foreign-schema",
          relFile,
          specifier,
        );
      }

      if (
        targetPkg.name !== owner?.name &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        (isAccountingDomainFile(relFile) || isAccountingApplicationFile(relFile))
      ) {
        recordViolation(
          "accounting-app-or-domain-imports-foreign-schema",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/requisites" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isRequisitesSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "requisites-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/parties" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isPartiesSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "parties-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/organizations" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isOrganizationsSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "organizations-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/balances" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isBalancesSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "balances-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/documents" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isDocumentsSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "documents-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        normalized.packageName === "@bedrock/ledger" &&
        (
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        ) &&
        !isLedgerSchemaImportAllowed(relFile)
      ) {
        recordViolation(
          "ledger-schema-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        owner?.name === "@bedrock/users" &&
        isRuntimeSourceFile &&
        targetPkg.name === owner.name &&
        (
          normalized.subpath === "." ||
          normalized.subpath === "./contracts" ||
          normalized.subpath.startsWith("./contracts/")
        )
      ) {
        recordViolation("users-self-import", relFile, specifier);
      }

      if (
        owner?.name === "@bedrock/requisites" &&
        isRuntimeSourceFile &&
        targetPkg.name === owner.name &&
        (
          normalized.subpath === "." ||
          normalized.subpath === "./contracts" ||
          normalized.subpath.startsWith("./contracts/") ||
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        )
      ) {
        recordViolation("requisites-self-import", relFile, specifier);
      }

      if (
        owner?.name === "@bedrock/parties" &&
        isRuntimeSourceFile &&
        targetPkg.name === owner.name &&
        (
          normalized.subpath === "." ||
          normalized.subpath === "./contracts" ||
          normalized.subpath.startsWith("./contracts/") ||
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        )
      ) {
        recordViolation("parties-self-import", relFile, specifier);
      }

      if (
        owner?.name === "@bedrock/organizations" &&
        isRuntimeSourceFile &&
        targetPkg.name === owner.name &&
        (
          normalized.subpath === "." ||
          normalized.subpath === "./contracts" ||
          normalized.subpath.startsWith("./contracts/") ||
          normalized.subpath === "./schema" ||
          normalized.subpath.startsWith("./schema/")
        )
      ) {
        recordViolation("organizations-self-import", relFile, specifier);
      }

      if (
        normalized.packageName === "@bedrock/ledger" &&
        (
          normalized.subpath === "./ids" ||
          normalized.subpath.startsWith("./ids/")
        ) &&
        !isLedgerIdsImportAllowed(relFile)
      ) {
        recordViolation(
          "ledger-ids-import-outside-allowed-zones",
          relFile,
          specifier,
        );
      }

      if (
        isAccountingDomainFile(relFile) &&
        normalized.packageName === "@bedrock/platform" &&
        normalized.subpath.startsWith("./persistence")
      ) {
        recordViolation("accounting-domain-imports-persistence", relFile, specifier);
      }

      if (
        isAccountingApplicationFile(relFile) &&
        normalized.packageName === "@bedrock/platform" &&
        normalized.subpath.startsWith("./persistence")
      ) {
        recordViolation(
          "accounting-application-imports-persistence",
          relFile,
          specifier,
        );
      }

      if (
        normalized.subpath === "./internal" ||
        normalized.subpath.startsWith("./internal/") ||
        normalized.subpath.includes("/internal/")
      ) {
        recordViolation("internal-import", relFile, specifier);
      }

      if (
        targetPkg.packageJson.exports &&
        !isExportedSubpath(targetPkg, normalized.subpath)
      ) {
        recordViolation(
          "non-exported-subpath",
          relFile,
          specifier,
          `${targetPkg.relDir}:${normalized.subpath}`,
        );
      }

      if (isDbRootImport(normalized) && !isDbImportAllowed(owner, relFile)) {
        recordViolation("db-import-outside-app-or-bootstrap", relFile, specifier);
      }

      if (
        owner &&
        targetPkg.name !== owner.name &&
        isRuntimeSourceFile &&
        !isKindAllowed(owner.kind, targetPkg.kind)
      ) {
        recordViolation(
          "kind-dependency-disallowed",
          relFile,
          specifier,
          `${owner.kind} -> ${targetPkg.kind}`,
        );
      }

      if (
        owner &&
        targetPkg.name !== owner.name &&
        isRuntimeSourceFile &&
        owner.name !== "@bedrock/platform" &&
        targetPkg.name !== "@bedrock/platform" &&
        packageGraph.has(owner.name) &&
        packageGraph.has(targetPkg.name)
      ) {
        packageGraph.get(owner.name).add(targetPkg.name);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycleKeys = new Set();

function visitPackage(name) {
  visiting.add(name);
  stack.push(name);

  for (const dependency of packageGraph.get(name) ?? []) {
    if (!packageGraph.has(dependency)) {
      continue;
    }

    if (!visited.has(dependency) && !visiting.has(dependency)) {
      visitPackage(dependency);
      continue;
    }

    if (!visiting.has(dependency)) {
      continue;
    }

    const cycleStart = stack.indexOf(dependency);
    const cycle = [...stack.slice(cycleStart), dependency];
    const body = cycle.slice(0, -1);
    const rotations = body.map((_, index) =>
      [...body.slice(index), ...body.slice(0, index)].join(" -> "),
    );
    const normalized = rotations.sort()[0];

    if (!cycleKeys.has(normalized)) {
      cycleKeys.add(normalized);
      recordViolation("package-cycle", normalized, normalized, normalized);
    }
  }

  stack.pop();
  visiting.delete(name);
  visited.add(name);
}

for (const pkgName of packageGraph.keys()) {
  if (!visited.has(pkgName)) {
    visitPackage(pkgName);
  }
}

for (const pkg of workspacePackages) {
  const allowedKinds = ALLOWED_IMPORT_KINDS[pkg.kind] ?? null;
  if (!allowedKinds) {
    continue;
  }

  const directWorkspaceDeps = Object.keys(pkg.packageJson.dependencies ?? {})
    .map((depName) => packagesByName.get(depName))
    .filter(Boolean);

  for (const depPkg of directWorkspaceDeps) {
    if (depPkg.name === pkg.name) {
      continue;
    }

    if (
      !allowedKinds.has(depPkg.kind)
    ) {
      recordViolation(
        "package-json-kind-dependency-disallowed",
        `${pkg.relDir}/package.json`,
        depPkg.name,
        `${pkg.kind} -> ${depPkg.kind}`,
      );
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

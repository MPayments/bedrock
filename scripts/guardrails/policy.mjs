export const ARCHITECTURE_CRUISE_TARGETS = [
  "apps",
  "packages",
  "scripts",
  "tests",
];

export const ARCHITECTURE_LINT_GLOBS = [
  "apps/**/src/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "apps/**/tests/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "packages/**/src/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "packages/**/tests/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "packages/**/scripts/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "scripts/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
  "tests/**/*.{ts,tsx,mts,cts,js,mjs,cjs}",
];

export const RUNTIME_EXPORT_KINDS = new Set([
  "shared",
  "module",
  "workflow",
  "platform",
  "plugin",
  "sdk",
]);

export const ALLOWED_PACKAGE_KIND_DEPENDENCIES = {
  shared: new Set(["shared"]),
  module: new Set(["shared", "module", "platform"]),
  workflow: new Set(["shared", "module", "platform", "workflow"]),
  platform: new Set(["shared", "platform"]),
  plugin: new Set(["shared", "module", "platform", "plugin"]),
  sdk: new Set(["shared", "sdk"]),
};

const COMMON_SCHEMA_ALLOW_PATTERNS = [
  "^apps/db/",
  "tests/",
  "schema/",
  "schema\\.ts$",
];

export const SCHEMA_IMPORT_ALLOW_PATTERNS = {
  "@bedrock/currencies": [
    ...COMMON_SCHEMA_ALLOW_PATTERNS,
    "^apps/api/src/composition/",
    "^packages/modules/organizations/src/infra/",
    "^packages/modules/parties/src/infra/",
  ],
  "@bedrock/documents": [...COMMON_SCHEMA_ALLOW_PATTERNS],
  "@bedrock/ledger": [
    ...COMMON_SCHEMA_ALLOW_PATTERNS,
    "^packages/plugins/[^/]+/src/infra/",
  ],
  "@bedrock/parties": [...COMMON_SCHEMA_ALLOW_PATTERNS],
  "@bedrock/reconciliation": [...COMMON_SCHEMA_ALLOW_PATTERNS],
  "@bedrock/treasury": [
    ...COMMON_SCHEMA_ALLOW_PATTERNS,
    "^packages/plugins/[^/]+/src/infra/",
  ],
};

export const DB_IMPORT_ALLOW_PATTERNS = [
  "^apps/",
  "^scripts/",
  "tests/integration/",
];

export function isKindDependencyAllowed(fromKind, toKind) {
  const allowed = ALLOWED_PACKAGE_KIND_DEPENDENCIES[fromKind];
  return !allowed || allowed.has(toKind);
}

export function isSchemaImportAllowed(packageName, relFile) {
  const patterns = SCHEMA_IMPORT_ALLOW_PATTERNS[packageName];
  if (!patterns) {
    return true;
  }

  return patterns.some((pattern) => new RegExp(pattern).test(relFile));
}

export function isDbImportAllowed(relFile) {
  return DB_IMPORT_ALLOW_PATTERNS.some((pattern) =>
    new RegExp(pattern).test(relFile),
  );
}

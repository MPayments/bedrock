export const IDEMPOTENCY_MODULE_MANIFEST = {
  id: "idempotency",
  version: 1,
  kind: "kernel",
  mutability: "immutable",
  description: "Ядро идемпотентности",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {},
  dependencies: [],
} as const;

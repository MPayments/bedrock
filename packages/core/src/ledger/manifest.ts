import type { ModuleManifest } from "../module-runtime/types";

export const LEDGER_MODULE_MANIFEST = {
  id: "ledger",
  version: 1,
  kind: "kernel",
  mutability: "immutable",
  description: "Ядро учета ledger",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    workers: [
      {
        id: "ledger",
        envKey: "LEDGER_WORKER_INTERVAL_MS",
        defaultIntervalMs: 5_000,
        description: "Проводит отложенные операции ledger в TigerBeetle.",
      },
    ],
  },
  dependencies: [],
} as const satisfies ModuleManifest;

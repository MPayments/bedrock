import type { ModuleManifest } from "@bedrock/application/module-runtime";

export const FX_MODULE_MANIFESTS = [
  {
    id: "fx",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "FX runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {},
    dependencies: [
      {
        moduleId: "fees",
        reason: "FX quotes include fee components",
      },
      {
        moduleId: "currencies",
        reason: "FX pairs require currencies",
      },
    ],
  },
  {
    id: "fx-rates",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "FX rates module and worker",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: {
        version: "v1",
        routePath: "/fx/rates",
      },
      workers: [
        {
          id: "fx-rates",
          envKey: "FX_RATES_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description: "Refreshes stale FX rate sources.",
        },
      ],
    },
    dependencies: [
      {
        moduleId: "fx",
        reason: "Rates sync is part of FX runtime",
      },
    ],
  },
] as const satisfies ModuleManifest[];

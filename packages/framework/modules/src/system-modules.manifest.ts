import type { ModuleManifest } from "./types";

export const SYSTEM_MODULES_MANIFEST = {
  id: "system-modules",
  version: 2,
  kind: "control",
  mutability: "immutable",
  description: "Панель управления runtime-модулями",
  enabledByDefault: true,
  scopeSupport: { global: true, book: false },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/system/modules",
      guarded: false,
    },
  },
  dependencies: [],
} as const satisfies ModuleManifest;

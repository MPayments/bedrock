import { beforeAll, describe, expect, it } from "vitest";

import { BEDROCK_MODULE_MANIFESTS } from "@bedrock/application/module-runtime";

interface ApiModuleRegistryEntry {
  id: string;
  routePath: string;
}

let apiApplicationModules: readonly ApiModuleRegistryEntry[] = [];

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET ??= "test-secret";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

  const { API_APPLICATION_MODULES } = await import("../../src/modules/registry");
  apiApplicationModules = API_APPLICATION_MODULES;
}, 30000);

describe("API module registry taxonomy", () => {
  it("maps every API module ID to a runtime manifest", () => {
    const manifestIds = new Set(
      BEDROCK_MODULE_MANIFESTS.map((manifest) => manifest.id),
    );

    for (const module of apiApplicationModules) {
      expect(manifestIds.has(module.id)).toBe(true);
    }
  });

  it("keeps API route paths aligned with manifest API capabilities", () => {
    const manifestsById = new Map(
      BEDROCK_MODULE_MANIFESTS.map((manifest) => [manifest.id, manifest]),
    );

    for (const module of apiApplicationModules) {
      const manifest = manifestsById.get(module.id);
      expect(manifest).toBeDefined();

      if (!manifest?.capabilities.api) {
        continue;
      }

      expect(manifest.capabilities.api.routePath).toBe(module.routePath);
    }
  });
});

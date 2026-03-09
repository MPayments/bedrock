import { describe, expect, it } from "vitest";

import { BEDROCK_ACTIVE_MODULES } from "@bedrock/bedrock-app";
import { compileModuleGraph } from "@bedrock/modules";

interface ApiModuleRegistryEntry {
  id: string;
  routePath: string;
}

process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_BASE_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

const { createApiModules, listApiModules } = await import("../../src/runtime");

const apiApplicationModules = listApiModules(
  createApiModules(BEDROCK_ACTIVE_MODULES),
)
  .map((module) => ({
    id: module.id,
    routePath: module.api.routePath,
  })) satisfies readonly ApiModuleRegistryEntry[];

describe("API module registry taxonomy", () => {
  it("maps every API module ID to a runtime manifest", () => {
    const manifests = compileModuleGraph(BEDROCK_ACTIVE_MODULES).manifests;
    const manifestIds = new Set(
      manifests.map((manifest) => manifest.id),
    );

    for (const module of apiApplicationModules) {
      expect(manifestIds.has(module.id)).toBe(true);
    }
  });

  it("keeps API route paths aligned with manifest API capabilities", () => {
    const manifests = compileModuleGraph(BEDROCK_ACTIVE_MODULES).manifests;
    const manifestsById = new Map(
      manifests.map((manifest) => [manifest.id, manifest]),
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

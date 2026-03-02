import { describe, expect, it } from "vitest";

import {
  createComponentRuntimeService,
  ComponentManifestValidationError,
  type ComponentManifest,
} from "../../src/component-runtime";

describe("createComponentRuntimeService manifest validation", () => {
  it("throws for duplicate component ids", () => {
    const manifests: ComponentManifest[] = [
      {
        id: "a",
        version: 1,
        kind: "domain",
        mutability: "mutable",
        description: "a",
        enabledByDefault: true,
        scopeSupport: { global: true, book: true },

        capabilities: {},
        dependencies: [],
      },
      {
        id: "a",
        version: 1,
        kind: "domain",
        mutability: "mutable",
        description: "duplicate",
        enabledByDefault: true,
        scopeSupport: { global: true, book: true },

        capabilities: {},
        dependencies: [],
      },
    ];

    expect(() =>
      createComponentRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ComponentManifestValidationError);
  });

  it("throws for cyclic dependencies", () => {
    const manifests: ComponentManifest[] = [
      {
        id: "a",
        version: 1,
        kind: "domain",
        mutability: "mutable",
        description: "a",
        enabledByDefault: true,
        scopeSupport: { global: true, book: true },

        capabilities: {},
        dependencies: [{ componentId: "b", reason: "depends" }],
      },
      {
        id: "b",
        version: 1,
        kind: "domain",
        mutability: "mutable",
        description: "b",
        enabledByDefault: true,
        scopeSupport: { global: true, book: true },

        capabilities: {},
        dependencies: [{ componentId: "a", reason: "depends" }],
      },
    ];

    expect(() =>
      createComponentRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ComponentManifestValidationError);
  });
});

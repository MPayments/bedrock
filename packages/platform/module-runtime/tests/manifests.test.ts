import { describe, expect, it } from "vitest";

import {
  createModuleRuntimeService,
  ModuleManifestValidationError,
  type ModuleManifest,
} from "../src";

describe("createModuleRuntimeService manifest validation", () => {
  it("throws for duplicate module ids", () => {
    const manifests: ModuleManifest[] = [
      {
        id: "a",
        version: 1,
        description: "a",
        enabledByDefault: true,
        dependencies: [],
      },
      {
        id: "a",
        version: 1,
        description: "duplicate",
        enabledByDefault: true,
        dependencies: [],
      },
    ];

    expect(() =>
      createModuleRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ModuleManifestValidationError);
  });

  it("throws for cyclic dependencies", () => {
    const manifests: ModuleManifest[] = [
      {
        id: "a",
        version: 1,
        description: "a",
        enabledByDefault: true,
        dependencies: [{ moduleId: "b", required: true, reason: "depends" }],
      },
      {
        id: "b",
        version: 1,
        description: "b",
        enabledByDefault: true,
        dependencies: [{ moduleId: "a", required: true, reason: "depends" }],
      },
    ];

    expect(() =>
      createModuleRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ModuleManifestValidationError);
  });
});

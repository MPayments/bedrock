import { describe, expect, it } from "vitest";

import {
  createModuleRuntimeService,
  ModuleManifestValidationError,
  type ModuleManifest,
} from "../../src/module-runtime";

describe("createModuleRuntimeService manifest validation", () => {
  const baseManifest: ModuleManifest = {
    id: "a",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "a",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {},
    dependencies: [],
  };

  it("throws for duplicate module ids", () => {
    const manifests: ModuleManifest[] = [
      baseManifest,
      {
        ...baseManifest,
        description: "duplicate",
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
        ...baseManifest,
        capabilities: {},
        dependencies: [{ moduleId: "b", reason: "depends" }],
      },
      {
        ...baseManifest,
        id: "b",
        description: "b",
        capabilities: {},
        dependencies: [{ moduleId: "a", reason: "depends" }],
      },
    ];

    expect(() =>
      createModuleRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ModuleManifestValidationError);
  });

  it("throws for duplicate worker ids across modules", () => {
    const manifests: ModuleManifest[] = [
      {
        ...baseManifest,
        id: "comp-1",
        capabilities: {
          workers: [
            {
              id: "worker-1",
              envKey: "WORKER_1_INTERVAL_MS",
              defaultIntervalMs: 1_000,
              description: "worker 1",
            },
          ],
        },
      },
      {
        ...baseManifest,
        id: "comp-2",
        capabilities: {
          workers: [
            {
              id: "worker-1",
              envKey: "WORKER_2_INTERVAL_MS",
              defaultIntervalMs: 1_000,
              description: "worker 2",
            },
          ],
        },
      },
    ];

    expect(() =>
      createModuleRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ModuleManifestValidationError);
  });

  it("throws for duplicate worker env keys across modules", () => {
    const manifests: ModuleManifest[] = [
      {
        ...baseManifest,
        id: "comp-1",
        capabilities: {
          workers: [
            {
              id: "worker-1",
              envKey: "WORKER_INTERVAL_MS",
              defaultIntervalMs: 1_000,
              description: "worker 1",
            },
          ],
        },
      },
      {
        ...baseManifest,
        id: "comp-2",
        capabilities: {
          workers: [
            {
              id: "worker-2",
              envKey: "WORKER_INTERVAL_MS",
              defaultIntervalMs: 1_000,
              description: "worker 2",
            },
          ],
        },
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

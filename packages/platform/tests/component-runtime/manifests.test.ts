import { describe, expect, it } from "vitest";

import {
  createComponentRuntimeService,
  ComponentManifestValidationError,
  type ComponentManifest,
} from "../../src/component-runtime";

describe("createComponentRuntimeService manifest validation", () => {
  const baseManifest: ComponentManifest = {
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

  it("throws for duplicate component ids", () => {
    const manifests: ComponentManifest[] = [
      baseManifest,
      {
        ...baseManifest,
        description: "duplicate",
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
        ...baseManifest,
        capabilities: {},
        dependencies: [{ componentId: "b", reason: "depends" }],
      },
      {
        ...baseManifest,
        id: "b",
        description: "b",
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

  it("throws for duplicate worker ids across components", () => {
    const manifests: ComponentManifest[] = [
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
      createComponentRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ComponentManifestValidationError);
  });

  it("throws for duplicate worker env keys across components", () => {
    const manifests: ComponentManifest[] = [
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
      createComponentRuntimeService({
        db: {} as any,
        manifests,
      }),
    ).toThrow(ComponentManifestValidationError);
  });
});

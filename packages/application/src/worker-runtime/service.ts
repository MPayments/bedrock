import { runWorkerLoop } from "@bedrock/common";

import type {
  BedrockWorker,
  StartedWorkerFleet,
  WorkerCatalogEntry,
  WorkerFleetBuildInput,
  WorkerFleetStartInput,
} from "./types";

function listWorkerCatalogEntries(
  manifests: WorkerFleetBuildInput["manifests"],
) {
  const entries: WorkerCatalogEntry[] = [];

  for (const manifest of manifests) {
    for (const capability of manifest.capabilities.workers ?? []) {
      entries.push({
        id: capability.id,
        moduleId: manifest.id,
        envKey: capability.envKey,
        defaultIntervalMs: capability.defaultIntervalMs,
        description: capability.description,
      });
    }
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export function createWorkerFleet(
  input: WorkerFleetBuildInput,
): BedrockWorker[] {
  const catalog = listWorkerCatalogEntries(input.manifests);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const implementationIds = Object.keys(input.workerImplementations).sort();
  const catalogIds = catalog.map((entry) => entry.id);

  const missing = catalogIds.filter(
    (workerId) => !(workerId in input.workerImplementations),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing worker implementations for manifest workers: ${missing.join(", ")}`,
    );
  }

  const extras = implementationIds.filter(
    (workerId) => !catalogById.has(workerId),
  );
  if (extras.length > 0) {
    throw new Error(
      `Worker implementations exist for unknown worker ids: ${extras.join(", ")}`,
    );
  }

  for (const [workerId, worker] of Object.entries(
    input.workerImplementations,
  )) {
    const entry = catalogById.get(workerId);
    if (!entry) {
      continue;
    }

    if (worker.id !== entry.id) {
      throw new Error(
        `Worker implementation id mismatch for ${workerId}: expected ${entry.id}, got ${worker.id}`,
      );
    }

    if (worker.moduleId !== entry.moduleId) {
      throw new Error(
        `Worker implementation module mismatch for ${workerId}: expected ${entry.moduleId}, got ${worker.moduleId}`,
      );
    }
  }

  const selectedIds = input.selectedWorkerIds
    ? [
        ...new Set(
          input.selectedWorkerIds.map((id) => id.trim()).filter(Boolean),
        ),
      ]
    : catalogIds;

  const unknownSelected = selectedIds.filter(
    (workerId) => !catalogById.has(workerId),
  );
  if (unknownSelected.length > 0) {
    throw new Error(
      `Unknown worker ids requested: ${unknownSelected.join(", ")}. Available: ${catalogIds.join(", ")}`,
    );
  }

  return selectedIds
    .map((workerId) => input.workerImplementations[workerId]!)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function startWorkerFleet(
  input: WorkerFleetStartInput,
): StartedWorkerFleet {
  const controllersByWorkerId = new Map<string, AbortController>();
  const loops = input.workers.map((worker) => {
    const controller = new AbortController();
    controllersByWorkerId.set(worker.id, controller);

    return runWorkerLoop({
      appName: input.appName,
      workerName: worker.id,
      processFn: async () => {
        const enabled = await input.moduleRuntime.isModuleEnabled({
          moduleId: worker.moduleId,
        });
        if (!enabled) {
          return 0;
        }

        const result = await worker.runOnce({
          now: new Date(),
          signal: controller.signal,
        });
        return result.processed;
      },
      options: {
        intervalMs: worker.intervalMs,
        observer: input.createObserver?.(worker),
      },
    });
  });

  return {
    workers: input.workers,
    stop: () => {
      for (const controller of controllersByWorkerId.values()) {
        controller.abort();
      }
      for (const loop of loops) {
        loop.stop();
      }
    },
    promise: Promise.all(loops.map((loop) => loop.promise)).then(() => {}),
  };
}

export { listWorkerCatalogEntries };

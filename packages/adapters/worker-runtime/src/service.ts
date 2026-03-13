import { runWorkerLoop } from "./worker-loop";

import type {
  BedrockWorker,
  StartedWorkerFleet,
  WorkerFleetBuildInput,
  WorkerFleetStartInput,
} from "./types";

export function createWorkerFleet(
  input: WorkerFleetBuildInput,
): BedrockWorker[] {
  const catalog = [...input.catalog].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const implementationIds = Object.keys(input.workerImplementations).sort();
  const catalogIds = catalog.map((entry) => entry.id);

  const missing = catalogIds.filter(
    (workerId) => !(workerId in input.workerImplementations),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing worker implementations for configured workers: ${missing.join(", ")}`,
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

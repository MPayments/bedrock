import { runWorkerLoop } from "@bedrock/common";

import type {
  BedrockWorker,
  CreateWorkerFleetInput,
  StartedWorkerFleet,
  StartWorkerFleetInput,
} from "./types";

export function createWorkerFleet(
  input: CreateWorkerFleetInput,
): BedrockWorker[] {
  const availableWorkerIds = Object.keys(input.workers).sort();
  const selectedWorkerIds = input.selectedWorkerIds
    ? [...new Set(input.selectedWorkerIds.map((id) => id.trim()).filter(Boolean))]
    : availableWorkerIds;

  const unknownWorkerIds = selectedWorkerIds.filter(
    (workerId) => !(workerId in input.workers),
  );
  if (unknownWorkerIds.length > 0) {
    throw new Error(
      `Unknown worker ids requested: ${unknownWorkerIds.join(", ")}. Available: ${availableWorkerIds.join(", ")}`,
    );
  }

  return selectedWorkerIds
    .map((workerId) => {
      const worker = input.workers[workerId];
      if (!worker) {
        throw new Error(`Missing worker implementation for ${workerId}`);
      }

      if (worker.id !== workerId) {
        throw new Error(
          `Worker implementation id mismatch for ${workerId}: got ${worker.id}`,
        );
      }

      return worker;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function startWorkerFleet(
  input: StartWorkerFleetInput,
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

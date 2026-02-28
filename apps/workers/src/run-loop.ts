import { createConsoleLogger } from "@bedrock/kernel";

import type { RunLoopObserver } from "./monitoring";

interface RunLoopOptions {
  intervalMs: number;
}

export function runLoop(
  name: string,
  processFn: () => Promise<unknown>,
  options: RunLoopOptions,
  observer?: RunLoopObserver,
): { promise: Promise<void>; stop: () => void } {
  const logger = createConsoleLogger({ app: "bedrock-workers", worker: name });
  const { intervalMs } = options;
  let stopped = false;

  function stop() {
    stopped = true;
  }

  async function loop() {
    logger.info(`${name} worker started`, { intervalMs });
    observer?.onLoopStarted?.();

    while (!stopped) {
      const startedAt = Date.now();
      try {
        observer?.onTickStarted?.();
        const result = await processFn();
        const processed =
          typeof result === "number" ? result : result != null ? 1 : 0;
        const durationMs = Date.now() - startedAt;
        observer?.onTickSucceeded?.({ durationMs, processed, result });
        if (processed > 0) {
          logger.debug(`${name} worker tick`, { result });
        }
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        observer?.onTickFailed?.({ durationMs, error });
        logger.error(`${name} worker tick failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(intervalMs);
    }

    logger.info(`${name} worker stopped`);
    observer?.onLoopStopped?.();
  }

  return { promise: loop(), stop };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function installShutdownHandlers(stopFn: () => void) {
  process.on("SIGINT", stopFn);
  process.on("SIGTERM", stopFn);
}

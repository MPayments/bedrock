import { createConsoleLogger } from "@bedrock/kernel";

import type { RunLoopObserver } from "./monitoring";

interface RunLoopOptions {
  intervalMs: number;
}

const MAX_BACKOFF_MS = 60_000;

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

    let consecutiveFailures = 0;

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
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        const durationMs = Date.now() - startedAt;
        observer?.onTickFailed?.({ durationMs, error });
        logger.error(`${name} worker tick failed`, {
          error: error instanceof Error ? error.message : String(error),
          consecutiveFailures,
        });
      }

      const backoffMs =
        consecutiveFailures > 0
          ? Math.min(
              MAX_BACKOFF_MS,
              intervalMs * Math.pow(2, consecutiveFailures - 1),
            )
          : intervalMs;

      // Add jitter (up to 20% of backoff) to avoid thundering herd
      const jitter = Math.floor(backoffMs * 0.2 * Math.random());
      await sleep(backoffMs + jitter);
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
  let called = false;
  const handler = () => {
    if (called) return;
    called = true;
    stopFn();
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

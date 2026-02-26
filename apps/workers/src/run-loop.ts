import { createConsoleLogger } from "@bedrock/kernel";

export interface RunLoopOptions {
  intervalMs: number;
}

export function runLoop(
  name: string,
  processFn: () => Promise<unknown>,
  options: RunLoopOptions,
): { promise: Promise<void>; stop: () => void } {
  const logger = createConsoleLogger({ app: "bedrock-workers", worker: name });
  const { intervalMs } = options;
  let stopped = false;

  function stop() {
    stopped = true;
  }

  async function loop() {
    logger.info(`${name} worker started`, { intervalMs });

    while (!stopped) {
      try {
        const result = await processFn();
        const processed =
          typeof result === "number" ? result : result != null ? 1 : 0;
        if (processed > 0) {
          logger.debug(`${name} worker tick`, { result });
        }
      } catch (error) {
        logger.error(`${name} worker tick failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(intervalMs);
    }

    logger.info(`${name} worker stopped`);
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

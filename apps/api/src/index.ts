import "./load-env";
import { LoggerToken } from "@bedrock/core";

import { createApiApp } from "./app";

const { app, config } = await createApiApp();
await app.start();

const logger = app.get(LoggerToken);
logger.info("multihansa.api.started", {
  host: config.server.host,
  port: config.server.port,
});

let stopping = false;

async function stop(signal: string) {
  if (stopping) {
    return;
  }

  stopping = true;

  try {
    logger.info("multihansa.api.stopping", { signal });
    await app.stop();
    process.exitCode = 0;
  } catch (error) {
    logger.error("multihansa.api.stop_failed", { signal, error });
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

process.on("SIGINT", () => {
  void stop("SIGINT");
});

process.on("SIGTERM", () => {
  void stop("SIGTERM");
});

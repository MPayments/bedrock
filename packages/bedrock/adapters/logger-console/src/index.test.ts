import { expect, test } from "bun:test";

import { LoggerToken, createApp, defineModule } from "@bedrock/core";

import {
  createConsoleLogger,
  createConsoleLoggerProvider,
  type ConsoleLoggerSink,
} from "./index";

test("createConsoleLogger filters levels and merges child bindings", () => {
  const calls: Array<{
    method: string;
    message: string;
    fields?: unknown;
  }> = [];
  const sink: ConsoleLoggerSink = {
    debug(message, fields) {
      calls.push({ method: "debug", message, fields });
    },
    info(message, fields) {
      calls.push({ method: "info", message, fields });
    },
    warn(message, fields) {
      calls.push({ method: "warn", message, fields });
    },
    error(message, fields) {
      calls.push({ method: "error", message, fields });
    },
  };

  const logger = createConsoleLogger({
    level: "warn",
    timestamp: false,
    prefix: "blog",
    colors: false,
    baseFields: {
      app: "bedrock",
    },
    sink,
  });

  logger.debug("skip");
  logger.info("skip");
  logger.warn("warn");
  logger.child?.({
    requestId: "req-1",
  }).error("boom", {
    code: "ERR",
  });

  expect(calls).toEqual([
    {
      method: "warn",
      message: "WARN [blog] warn { app: 'bedrock' }",
      fields: undefined,
    },
    {
      method: "error",
      message:
        "ERROR [blog] boom { app: 'bedrock', requestId: 'req-1', code: 'ERR' }",
      fields: undefined,
    },
  ]);
});

test("createConsoleLoggerProvider binds the Bedrock logger token as a singleton", async () => {
  const app = createApp({
    modules: [defineModule("console-logger", {})],
    providers: [
      createConsoleLoggerProvider({
        config: {
          timestamp: false,
        },
      }),
    ],
  });

  await app.start();

  const logger = app.get(LoggerToken);

  expect(typeof logger.info).toBe("function");
  expect(typeof logger.warn).toBe("function");

  await app.stop();
});

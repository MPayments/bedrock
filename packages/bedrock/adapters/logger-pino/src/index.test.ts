import { expect, test } from "bun:test";

import { LoggerToken, createApp, defineModule } from "@bedrock/core";

import { createPinoLogger, createPinoLoggerProvider } from "./index";

test("createPinoLogger exposes the Bedrock logger contract and child loggers", () => {
  const logger = createPinoLogger({
    level: "debug",
    name: "blog",
    baseFields: {
      app: "bedrock",
    },
  });

  expect(typeof logger.debug).toBe("function");
  expect(typeof logger.info).toBe("function");
  expect(typeof logger.warn).toBe("function");
  expect(typeof logger.error).toBe("function");
  expect(typeof logger.child).toBe("function");

  const child = logger.child?.({
    requestId: "req-1",
  });

  expect(typeof child?.info).toBe("function");
});

test("createPinoLoggerProvider binds the Bedrock logger token as a singleton", async () => {
  const app = createApp({
    modules: [defineModule("pino-logger", {})],
    providers: [
      createPinoLoggerProvider({
        config: {
          name: "blog",
        },
      }),
    ],
  });

  await app.start();

  const logger = app.get(LoggerToken);

  expect(typeof logger.info).toBe("function");
  expect(typeof logger.child).toBe("function");

  await app.stop();
});

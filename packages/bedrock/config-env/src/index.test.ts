import { expect, test } from "bun:test";
import { BedrockError, createApp, defineModule, token } from "@bedrock/core";
import { z } from "zod";

import {
  createConfigProvider,
  createEnvConfigLoader,
  defineConfig,
} from "./index";

test("defineConfig returns a frozen descriptor with a generated token", () => {
  const AppConfig = defineConfig("app", {
    schema: z.object({
      port: z.coerce.number().int().positive(),
    }),
    load: () => ({
      port: 3000,
    }),
  });

  expect(Object.isFrozen(AppConfig)).toBe(true);
  expect(AppConfig.kind).toBe("config");
  expect(AppConfig.token.key).toBe("config:app");
});

test("provider loads once and injects parsed config", async () => {
  let loadCount = 0;

  const AppConfig = defineConfig("app", {
    schema: z.object({
      port: z.coerce.number().int().positive(),
    }),
    load: async () => {
      loadCount += 1;
      return {
        port: "3000",
      };
    },
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [AppConfig.provider()],
      }),
    ],
  });

  await app.start();

  expect(app.get(AppConfig.token)).toEqual({
    port: 3000,
  });
  expect(app.get(AppConfig.token)).toEqual({
    port: 3000,
  });
  expect(loadCount).toBe(1);

  await app.stop();
});

test("createConfigProvider respects a custom token", async () => {
  const CustomToken = token<{ region: string }>("custom-config");
  const AppConfig = defineConfig("app", {
    schema: z.object({
      region: z.string().min(1),
    }),
    token: CustomToken,
    load: () => ({
      region: "eu-central-1",
    }),
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [createConfigProvider(AppConfig)],
      }),
    ],
  });

  await app.start();

  expect(app.get(CustomToken)).toEqual({
    region: "eu-central-1",
  });

  await app.stop();
});

test("env loader infers names, applies prefixes, aliases, and defaults", async () => {
  const AppConfig = defineConfig("app", {
    schema: z.object({
      port: z.coerce.number().int().positive(),
      logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
      databaseUrl: z.string().min(1),
      redis: z.object({
        url: z.string().optional(),
      }),
    }),
    load: createEnvConfigLoader({
      prefix: "APP_",
      env: {
        APP_PORT: "3100",
        DATABASE_URL: "postgres://db",
        REDIS_URL: "redis://cache",
      },
      fields: {
        databaseUrl: {
          name: "DATABASE_URL",
        },
        "redis.url": {
          aliases: ["REDIS_URL"],
        },
      },
    }),
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [AppConfig.provider()],
      }),
    ],
  });

  await app.start();

  expect(app.get(AppConfig.token)).toEqual({
    port: 3100,
    logLevel: "info",
    databaseUrl: "postgres://db",
    redis: {
      url: "redis://cache",
    },
  });

  await app.stop();
});

test("env loader redacts secret values in validation errors", async () => {
  const AppConfig = defineConfig("app", {
    schema: z.object({
      databaseUrl: z.string().url(),
    }),
    load: createEnvConfigLoader({
      env: {
        DATABASE_URL: "not-a-url",
      },
      fields: {
        databaseUrl: {
          secret: true,
        },
      },
    }),
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [AppConfig.provider()],
      }),
    ],
  });

  await expect(app.start()).rejects.toMatchObject({
    code: "BEDROCK_CONFIG_VALIDATION_ERROR",
  });

  await app.stop();

  try {
    await app.start();
    throw new Error("expected config validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(BedrockError);
    const bedrockError = error as BedrockError;
    const fields =
      (bedrockError.details as {
        fields?: Array<{
          path: string;
          envNames: string[];
          resolvedEnvName?: string;
          value?: string;
          provided: boolean;
          secret: boolean;
        }>;
      }).fields ?? [];

    expect(fields).toContainEqual({
      path: "databaseUrl",
      envNames: ["DATABASE_URL"],
      resolvedEnvName: "DATABASE_URL",
      provided: true,
      value: "[redacted]",
      secret: true,
    });
  }
});

test("env loader rejects unknown override paths", async () => {
  const AppConfig = defineConfig("app", {
    schema: z.object({
      port: z.coerce.number().int().positive(),
    }),
    load: createEnvConfigLoader({
      env: {
        PORT: "3000",
      },
      fields: {
        missing: {
          name: "MISSING",
        },
      },
    }),
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [AppConfig.provider()],
      }),
    ],
  });

  await expect(app.start()).rejects.toMatchObject({
    code: "BEDROCK_CONFIG_LOAD_ERROR",
  });
});

test("env loader requires an object root schema", async () => {
  const ScalarConfig = defineConfig("scalar", {
    schema: z.string(),
    load: createEnvConfigLoader({
      env: {
        SCALAR: "value",
      },
    }),
  });

  const app = createApp({
    modules: [
      defineModule("app", {
        providers: [ScalarConfig.provider()],
      }),
    ],
  });

  await expect(app.start()).rejects.toMatchObject({
    code: "BEDROCK_CONFIG_LOAD_ERROR",
  });
});

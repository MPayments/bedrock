import {
  createEnvConfigLoader,
  defineConfig,
  type EnvBag,
  type InferConfig,
} from "@bedrock/config-env";
import type { Token } from "@bedrock/core";
import { z } from "zod";

import { resolveWorkerIntervals } from "@multihansa/common/workers";

import { MULTIHANSA_WORKER_DESCRIPTORS } from "./workers";

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const TrustedOriginsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.string().url()).min(1));

const ServerConfigSchema = z.object({
  host: z.string().min(1).default("0.0.0.0"),
  port: z.coerce.number().int().positive().default(3002),
});

const TigerBeetleConfigSchema = z.object({
  address: z.string().min(1).default("127.0.0.1:3000"),
  clusterId: z.coerce.bigint().default(0n),
});

const MonitoringConfigSchema = z.object({
  host: z.string().min(1).default("0.0.0.0"),
  port: z.coerce.number().int().nonnegative().default(8081),
});

const ApiConfigSchema = z.object({
  appName: z.string().min(1).default("multihansa-api"),
  server: ServerConfigSchema,
  logLevel: LogLevelSchema.default("info"),
  auth: z.object({
    secret: z.string().min(1),
    url: z.string().url(),
    trustedOrigins: TrustedOriginsSchema,
  }),
});

const WorkerConfigBaseSchema = z.object({
  appName: z.string().min(1).default("multihansa-workers"),
  logLevel: LogLevelSchema.default("info"),
  tb: TigerBeetleConfigSchema,
  monitoring: MonitoringConfigSchema,
});

const WorkerConfigSchema = WorkerConfigBaseSchema.extend({
  workerIntervals: z.record(z.string(), z.number().int().positive()),
});

const apiEnvFields = {
  appName: {
    name: "APP_NAME",
  },
  "server.host": {
    name: "HOST",
  },
  "server.port": {
    name: "PORT",
  },
  logLevel: {
    name: "LOG_LEVEL",
  },
  "auth.secret": {
    name: "BETTER_AUTH_SECRET",
    secret: true,
  },
  "auth.url": {
    name: "BETTER_AUTH_URL",
  },
  "auth.trustedOrigins": {
    name: "BETTER_AUTH_TRUSTED_ORIGINS",
  },
} as const;

const workerBaseEnvFields = {
  appName: {
    name: "APP_NAME",
  },
  logLevel: {
    name: "LOG_LEVEL",
  },
  "tb.address": {
    name: "TB_ADDRESS",
  },
  "tb.clusterId": {
    name: "TB_CLUSTER_ID",
  },
  "monitoring.host": {
    name: "WORKERS_MONITORING_HOST",
  },
  "monitoring.port": {
    name: "WORKERS_MONITORING_PORT",
  },
} as const;

function withApiDefaults(input: z.input<typeof ApiConfigSchema>) {
  return {
    ...input,
    server: {
      ...(input.server ?? {}),
    },
  } satisfies z.input<typeof ApiConfigSchema>;
}

function withWorkerBaseDefaults(input: z.input<typeof WorkerConfigBaseSchema>) {
  return {
    ...input,
    tb: {
      ...(input.tb ?? {}),
    },
    monitoring: {
      ...(input.monitoring ?? {}),
    },
  } satisfies z.input<typeof WorkerConfigBaseSchema>;
}

type ApiEnvLoadContext = {
  name: string;
  token: Token<z.output<typeof ApiConfigSchema>>;
  schema: typeof ApiConfigSchema;
};

type WorkerBaseEnvLoadContext = {
  name: string;
  token: Token<z.output<typeof WorkerConfigBaseSchema>>;
  schema: typeof WorkerConfigBaseSchema;
};

const loadApiEnv = async (
  ctx: ApiEnvLoadContext,
): Promise<z.input<typeof ApiConfigSchema>> =>
  withApiDefaults(
    await createEnvConfigLoader<typeof ApiConfigSchema>({
      fields: {
        ...apiEnvFields,
      },
    })(ctx),
  );

const loadWorkerBaseEnv = async (
  ctx: WorkerBaseEnvLoadContext,
): Promise<z.input<typeof WorkerConfigBaseSchema>> =>
  withWorkerBaseDefaults(
    await createEnvConfigLoader<typeof WorkerConfigBaseSchema>({
      fields: {
        ...workerBaseEnvFields,
      },
    })(ctx),
  );

export const MultihansaApiConfig = defineConfig("multihansa-api", {
  schema: ApiConfigSchema,
  load: loadApiEnv,
});

export const MultihansaWorkerConfig = defineConfig("multihansa-workers", {
  schema: WorkerConfigSchema,
  load: async ({ name, token }) => {
    const env = process.env as EnvBag;
    const base = await loadWorkerBaseEnv({
      name,
      token,
      schema: WorkerConfigBaseSchema,
    });

    return {
      ...base,
      workerIntervals: resolveWorkerIntervals({
        descriptors: MULTIHANSA_WORKER_DESCRIPTORS,
        env,
      }),
    };
  },
});

export async function loadMultihansaApiConfig(
  env: EnvBag = process.env as EnvBag,
): Promise<MultihansaApiConfigValue> {
  const loaded = await withApiDefaults(
    await createEnvConfigLoader<typeof ApiConfigSchema>({
      env,
      fields: {
        ...apiEnvFields,
      },
    })({
      name: MultihansaApiConfig.name,
      token: MultihansaApiConfig.token,
      schema: ApiConfigSchema,
    }),
  );
  return ApiConfigSchema.parseAsync(loaded);
}

export async function loadMultihansaWorkerConfig(
  env: EnvBag = process.env as EnvBag,
): Promise<MultihansaWorkerConfigValue> {
  const base = await withWorkerBaseDefaults(
    await createEnvConfigLoader<typeof WorkerConfigBaseSchema>({
      env,
      fields: {
        ...workerBaseEnvFields,
      },
    })({
      name: MultihansaWorkerConfig.name,
      token: MultihansaWorkerConfig.token,
      schema: WorkerConfigBaseSchema,
    }),
  );

  return WorkerConfigSchema.parseAsync({
    ...base,
    workerIntervals: resolveWorkerIntervals({
      descriptors: MULTIHANSA_WORKER_DESCRIPTORS,
      env,
    }),
  });
}

export type MultihansaApiConfigValue = InferConfig<typeof MultihansaApiConfig>;
export type MultihansaWorkerConfigValue = InferConfig<typeof MultihansaWorkerConfig>;

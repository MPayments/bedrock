import { z } from "zod";

import type { MultihansaDomainServices } from "@multihansa/app";
import type { Logger } from "@multihansa/common";

import { createApiRuntime, type ApiRuntime } from "./runtime";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TB_ADDRESS: z.string().min(1, "TB_ADDRESS is required"),
  TB_CLUSTER_ID: z.coerce.number().int().nonnegative(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .min(1, "BETTER_AUTH_TRUSTED_ORIGINS is required"),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(): Env {
  const result = EnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    TB_ADDRESS: process.env.TB_ADDRESS,
    TB_CLUSTER_ID: process.env.TB_CLUSTER_ID,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  return result.data;
}

export interface AppContext extends MultihansaDomainServices {
  env: Env;
  app: ApiRuntime;
  logger: Logger;
}

export function createAppContext(env: Env): AppContext {
  const app = createApiRuntime();

  return {
    env,
    app,
    logger: app.logger,
    ...app.services,
  };
}

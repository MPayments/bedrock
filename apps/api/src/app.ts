import { createApp, type AppRuntime } from "@bedrock/core";

import {
  createMultihansaApiDescriptor,
  createMultihansaBetterAuth,
  loadMultihansaApiConfig,
  type MultihansaApiConfigValue,
} from "@multihansa/app";

export interface ApiApp {
  app: AppRuntime;
  config: MultihansaApiConfigValue;
}

export async function createApiApp(): Promise<ApiApp> {
  const config = await loadMultihansaApiConfig();
  const { db } = await import("@multihansa/db/client");

  const auth = createMultihansaBetterAuth({
    db,
    secret: config.auth.secret,
    url: config.auth.url,
    trustedOrigins: config.auth.trustedOrigins,
  });

  const app = createApp(
    createMultihansaApiDescriptor({
      appName: config.appName,
      auth,
      db,
      host: config.server.host,
      logLevel: config.logLevel,
      port: config.server.port,
      trustedOrigins: config.auth.trustedOrigins,
    }),
  );

  return {
    app,
    config,
  };
}

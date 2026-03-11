import { createBetterAuthModule } from "@bedrock/auth-better";
import type { AppDescriptor } from "@bedrock/core";
import { createFastifyHttpAdapter } from "@bedrock/http-fastify";

import { createMultihansaActor } from "./auth/better-auth";
import { MultihansaApiConfig } from "./config";
import { createMultihansaApiModules } from "./modules";
import { createApiProviders } from "./providers";

export interface CreateMultihansaApiDescriptorInput {
  appName?: string;
  auth: unknown;
  db: unknown;
  host?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  port?: number;
  trustedOrigins: readonly string[];
}

export function createMultihansaApiDescriptor(
  input: CreateMultihansaApiDescriptorInput,
): AppDescriptor {
  const descriptor: AppDescriptor = {
    modules: [
      createBetterAuthModule("auth", {
        auth: input.auth as never,
        mount: {
          basePath: "/api/auth",
        },
        actor: {
          fromSession: ({ requestContext }) =>
            createMultihansaActor({
              user: requestContext.user as never,
              session: requestContext.session as never,
            }),
        },
      }),
      ...createMultihansaApiModules({
        getContract: () => descriptor,
      }),
    ],
    providers: [
      MultihansaApiConfig.provider(),
      ...createApiProviders({
        appName: input.appName,
        db: input.db,
        logLevel: input.logLevel,
      }),
    ],
    http: createFastifyHttpAdapter({
      listen: {
        host: input.host,
        port: input.port,
      },
      cors: {
        credentials: true,
        allowHeaders: [
          "Authorization",
          "Content-Type",
          "Idempotency-Key",
          "X-Book-Id",
          "X-Correlation-Id",
          "X-Request-Id",
          "X-Trace-Id",
        ],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        exposeHeaders: ["Retry-After", "Set-Cookie"],
        origins: [...input.trustedOrigins],
      },
      csrf: {
        trustedOrigins: [...input.trustedOrigins],
      },
    }),
    logger: {
      source: {
        type: "provider",
      },
      http: {
        enabled: true,
        includeQuery: true,
        includeHeaders: ["origin", "x-correlation-id", "x-request-id", "idempotency-key"],
      },
    },
  };

  return descriptor;
}

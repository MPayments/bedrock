import { z } from "zod";

import type { AppDescriptor } from "@bedrock/core";
import { defineService } from "@bedrock/core";
import { generateOpenApiDocument } from "@bedrock/openapi";

import { schema as assetsSchema } from "@multihansa/assets/schema";
import { AppNameToken, DbToken } from "@multihansa/common/bedrock";

import { renderDocsPage } from "./docs";

const RootStatusSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});

const HealthCheckSchema = z.object({
  status: z.string(),
  latencyMs: z.number().int().optional(),
  error: z.string().optional(),
});

const HealthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  checks: z.record(z.string(), HealthCheckSchema),
});

const OpenApiRequestSchema = z.object({
  origin: z.string().url(),
});

const OpenApiDocumentSchema = z.record(z.string(), z.unknown());

const DocsPageSchema = z.string();

export function createPlatformService(options: {
  getContract: () => AppDescriptor;
  openApiInfo: {
    title: string;
    version: string;
    description?: string;
  };
}) {
  return defineService("platform", {
    deps: {
      appName: AppNameToken,
      db: DbToken,
    },
    actions: ({ action }) => ({
      root: action({
        output: RootStatusSchema,
        handler: async ({ ctx }) => ({
          status: "ok" as const,
          service: ctx.appName,
        }),
      }),
      health: action({
        output: HealthResponseSchema,
        handler: async ({ ctx }) => {
          const checks: Record<string, z.infer<typeof HealthCheckSchema>> = {};
          let healthy = true;
          const startedAt = Date.now();

          try {
            await ctx.db
              .select({ id: assetsSchema.currencies.id })
              .from(assetsSchema.currencies)
              .limit(1);
            checks.postgres = {
              status: "up",
              latencyMs: Date.now() - startedAt,
            };
          } catch (cause) {
            healthy = false;
            checks.postgres = {
              status: "down",
              latencyMs: Date.now() - startedAt,
              error: cause instanceof Error ? cause.message : String(cause),
            };
          }

          return {
            status: healthy ? ("healthy" as const) : ("degraded" as const),
            checks,
          };
        },
      }),
      openApi: action({
        input: OpenApiRequestSchema,
        output: OpenApiDocumentSchema,
        handler: async ({ input }) =>
          generateOpenApiDocument(options.getContract(), {
            info: options.openApiInfo,
            openapi: "3.1.0",
            servers: [
              {
                url: input.origin,
                description: "Current environment",
              },
            ],
          }),
      }),
      docs: action({
        output: DocsPageSchema,
        handler: async () =>
          renderDocsPage({
            title: options.openApiInfo.title,
            specUrl: "/api/open-api",
          }),
      }),
    }),
  });
}

export {
  DocsPageSchema,
  HealthResponseSchema,
  OpenApiDocumentSchema,
  OpenApiRequestSchema,
  RootStatusSchema,
};

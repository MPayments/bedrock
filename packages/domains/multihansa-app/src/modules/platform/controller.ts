import {
  defineController,
  ExecutionContextToken,
  http,
  type HttpRawResponseDescriptor,
  type HttpRawOutput,
} from "@bedrock/core";

import {
  createPlatformService,
  DocsPageSchema,
  HealthResponseSchema,
  OpenApiDocumentSchema,
  RootStatusSchema,
} from "./service";
import type { AppDescriptor } from "@bedrock/core";

const DocsPageResponse: HttpRawResponseDescriptor = http.response.raw({
  contentType: "text/html; charset=utf-8",
});

export function createPlatformController(input: {
  getContract: () => AppDescriptor;
  openApiInfo: {
    title: string;
    version: string;
    description?: string;
  };
  service: ReturnType<typeof createPlatformService>;
}) {
  const platformService = input.service;

  return defineController("platform-http", {
    deps: {
      executionContext: ExecutionContextToken,
    },
    ctx: ({ executionContext }) => ({
      executionContext,
    }),
    routes: ({ route }) => ({
      root: route.get({
        path: "/",
        responses: {
          200: RootStatusSchema,
        },
        handler: platformService.actions.root,
      }),
      health: route.get({
        path: "/health",
        responses: {
          200: HealthResponseSchema,
        },
        handler: platformService.actions.health,
      }),
      openApi: route.get({
        path: "/api/open-api",
        responses: {
          200: OpenApiDocumentSchema,
        },
        handler: ({ ctx, call }) =>
          call(platformService.actions.openApi, {
            origin: new URL(
              ctx.executionContext.http?.request.url ?? "http://localhost",
            ).origin,
          }),
      }),
      docs: route.get({
        path: "/docs",
        responses: {
          200: DocsPageResponse,
        },
        handler: async ({ call }) =>
          http.reply.raw(await call(platformService.actions.docs), {
            status: 200,
            contentType: "text/html; charset=utf-8",
          }) as HttpRawOutput<200>,
      }),
    }),
  });
}

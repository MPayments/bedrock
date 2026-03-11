import { createServer } from "node:net";

import { describe, expect, test } from "bun:test";
import { conflictError, bedrockError, notFoundError } from "@bedrock/common";
import {
  createApp,
  defineController,
  defineHttpError,
  defineHttpMount,
  defineModule,
  http,
} from "@bedrock/core";
import { z } from "zod";

import { createFastifyHttpAdapter } from "./index";

describe("@bedrock/http-fastify", () => {
  test("parses JSON bodies, query strings, and lower-cased headers", async () => {
    const http = createFastifyHttpAdapter();
    const controller = defineController("echo-http", {
      basePath: "/echo",
      routes: ({ route }) => ({
        create: route.post({
          path: "/",
          request: {
            body: z.object({
              name: z.string().min(1),
            }),
            headers: z.object({
              "x-request-id": z.string().min(1),
            }),
          },
          responses: {
            200: z.object({
              name: z.string(),
              requestId: z.string(),
            }),
          },
          handler: async ({ request }) => ({
            name: request.body.name,
            requestId: request.headers["x-request-id"],
          }),
        }),
        list: route.get({
          path: "/",
          request: {
            query: z.object({
              tag: z.union([z.string(), z.array(z.string())]),
            }),
          },
          responses: {
            200: z.object({
              tag: z.union([z.string(), z.array(z.string())]),
            }),
          },
          handler: async ({ request }) => ({
            tag: request.query.tag,
          }),
        }),
      }),
    });

    const app = createApp({
      modules: [
        defineModule("echo", {
          controllers: [controller],
        }),
      ],
      http,
    });

    await app.start();

    const createResponse = await app.fetch(
      new Request("http://test.local/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Request-Id": "req-1",
        },
        body: JSON.stringify({
          name: "Ada",
        }),
      }),
    );

    expect(createResponse.status).toBe(200);
    expect(await createResponse.json()).toEqual({
      name: "Ada",
      requestId: "req-1",
    });

    const listResponse = await app.fetch(
      new Request("http://test.local/echo?tag=core&tag=http", {
        method: "GET",
      }),
    );

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      tag: ["core", "http"],
    });

    await app.stop();
  });

  test("dispatches raw HTTP mounts before validated routes", async () => {
    const app = createApp({
      modules: [
        defineModule("auth", {
          httpMounts: [
            defineHttpMount("auth", {
              basePath: "/auth",
              handle: async (request) => ({
                kind: "json",
                status: 202,
                body: JSON.stringify({
                  mounted: true,
                  pathname: request.path,
                }),
                headers: {
                  "content-type": "application/json",
                },
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/auth/session"),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      mounted: true,
      pathname: "/auth/session",
    });

    await app.stop();
  });

  test("supports path params", async () => {
    const app = createApp({
      modules: [
        defineModule("posts", {
          controllers: [
            defineController("posts-http", {
              basePath: "/posts",
              routes: ({ route }) => ({
                detail: route.get({
                  path: "/:id",
                  request: {
                    params: z.object({
                      id: z.string().min(1),
                    }),
                  },
                  responses: {
                    200: z.object({
                      id: z.string(),
                    }),
                  },
                  handler: async ({ request }) => ({
                    id: request.params.id,
                  }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/posts/post-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "post-1",
    });

    await app.stop();
  });

  test("returns 415 for non-json request bodies", async () => {
    const app = createApp({
      modules: [
        defineModule("echo", {
          controllers: [
            defineController("echo-http", {
              basePath: "/echo",
              routes: ({ route }) => ({
                create: route.post({
                  path: "/",
                  request: {
                    body: z.object({
                      name: z.string(),
                    }),
                  },
                  responses: {
                    200: z.object({
                      ok: z.literal(true),
                    }),
                  },
                  handler: async () => ({ ok: true as const }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/echo", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
        body: "hello",
      }),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: {
        code: "BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE",
        message: "Unsupported media type.",
        details: {
          contentType: "text/plain",
        },
      },
    });

    await app.stop();
  });

  test("maps Bedrock and unknown errors to JSON responses", async () => {
    const httpAdapter = createFastifyHttpAdapter();
    const NotFoundResponse = defineHttpError("BEDROCK_NOT_FOUND_ERROR", {
      status: 404,
    });
    const ConflictResponse = defineHttpError("BEDROCK_CONFLICT_ERROR", {
      status: 409,
    });
    const MappedResponse = defineHttpError("CUSTOM_MAPPED", {
      status: 418,
      description: "mapped",
    });
    const controller = defineController("errors-http", {
      basePath: "/errors",
      routes: ({ route }) => ({
        notFound: route.get({
          path: "/not-found",
          responses: {
            204: http.response.empty(),
          },
          errors: {
            BEDROCK_NOT_FOUND_ERROR: NotFoundResponse,
          },
          handler: async () => {
            throw notFoundError("missing");
          },
        }),
        conflict: route.get({
          path: "/conflict",
          responses: {
            204: http.response.empty(),
          },
          errors: {
            BEDROCK_CONFLICT_ERROR: ConflictResponse,
          },
          handler: async () => {
            throw conflictError("duplicate");
          },
        }),
        mapped: route.get({
          path: "/mapped",
          responses: {
            204: http.response.empty(),
          },
          errors: {
            CUSTOM_MAPPED: MappedResponse,
          },
          handler: async ({ error }) => error(MappedResponse),
        }),
        undeclared: route.get({
          path: "/undeclared",
          responses: {
            204: http.response.empty(),
          },
          handler: async () => {
            throw bedrockError({
              message: "teapot",
              code: "CUSTOM",
              status: 418,
            });
          },
        }),
        unknown: route.get({
          path: "/unknown",
          responses: {
            204: http.response.empty(),
          },
          handler: async () => {
            throw new Error("boom");
          },
        }),
      }),
    });

    const app = createApp({
      modules: [
        defineModule("errors", {
          controllers: [controller],
        }),
      ],
      http: httpAdapter,
    });

    await app.start();

    const notFoundResponse = await app.fetch(
      new Request("http://test.local/errors/not-found"),
    );
    expect(notFoundResponse.status).toBe(404);
    expect(await notFoundResponse.json()).toEqual({
      error: {
        code: "BEDROCK_NOT_FOUND_ERROR",
        message: "missing",
        details: undefined,
      },
    });

    const conflictResponse = await app.fetch(
      new Request("http://test.local/errors/conflict"),
    );
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toEqual({
      error: {
        code: "BEDROCK_CONFLICT_ERROR",
        message: "duplicate",
        details: undefined,
      },
    });

    const mappedResponse = await app.fetch(
      new Request("http://test.local/errors/mapped"),
    );
    expect(mappedResponse.status).toBe(418);
    expect(await mappedResponse.json()).toEqual({
      error: {
        code: "CUSTOM_MAPPED",
        message: "mapped",
        details: undefined,
      },
    });

    const undeclaredResponse = await app.fetch(
      new Request("http://test.local/errors/undeclared"),
    );
    expect(undeclaredResponse.status).toBe(500);
    expect(await undeclaredResponse.json()).toEqual({
      error: {
        code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
        message: "Route error contract violated.",
        details: undefined,
      },
    });

    const unknownResponse = await app.fetch(
      new Request("http://test.local/errors/unknown"),
    );
    expect(unknownResponse.status).toBe(500);
    expect(await unknownResponse.json()).toEqual({
      error: {
        code: "BEDROCK_HTTP_INTERNAL_ERROR",
        message: "Internal server error.",
        details: undefined,
      },
    });

    await app.stop();
  });

  test("returns JSON 404s for unmatched routes and allows custom error mappers", async () => {
    const app = createApp({
      modules: [
        defineModule("errors", {
          httpMounts: [
            defineHttpMount("errors", {
              basePath: "/errors",
              handle: async () => {
                throw bedrockError({
                  message: "teapot",
                  code: "CUSTOM",
                  status: 418,
                });
              },
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter({
        onError: ({ error }) => {
          if (!("status" in Object(error))) {
            return undefined;
          }

          return {
            kind: "json",
            status: 418,
            body: JSON.stringify({
              handled: true,
            }),
            headers: {
              "content-type": "application/json; charset=utf-8",
            },
          };
        },
      }),
    });

    await app.start();

    const customResponse = await app.fetch(
      new Request("http://test.local/errors/custom"),
    );
    expect(customResponse.status).toBe(418);
    expect(await customResponse.json()).toEqual({
      handled: true,
    });

    const missingResponse = await app.fetch(
      new Request("http://test.local/missing"),
    );
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({
      error: {
        code: "BEDROCK_NOT_FOUND_ERROR",
        message: 'Route "GET /missing" was not found.',
        details: {
          method: "GET",
          path: "/missing",
        },
      },
    });

    await app.stop();
  });

  test("uses the app base path when matching routes and listening on a real port", async () => {
    const port = await findAvailablePort();
    const app = createApp({
      modules: [
        defineModule("health", {
          controllers: [
            defineController("health-http", {
              basePath: "/health",
              routes: ({ route }) => ({
                status: route.get({
                  path: "/",
                  responses: {
                    200: z.object({
                      ok: z.literal(true),
                    }),
                  },
                  handler: async () => ({ ok: true as const }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter({
        basePath: "/api",
        listen: {
          port,
          host: "127.0.0.1",
        },
      }),
    });

    await app.start();

    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
    });

    await app.stop();
  });

  test("handles CORS preflight requests and exposes CORS headers on responses", async () => {
    const app = createApp({
      modules: [
        defineModule("echo", {
          controllers: [
            defineController("echo-http", {
              basePath: "/echo",
              routes: ({ route }) => ({
                create: route.post({
                  path: "/",
                  request: {
                    body: z.object({
                      name: z.string(),
                    }),
                  },
                  responses: {
                    200: z.object({
                      ok: z.literal(true),
                    }),
                  },
                  handler: async () => ({ ok: true as const }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter({
        cors: {
          origins: ["https://app.multihansa.local"],
          allowHeaders: ["content-type", "idempotency-key"],
          allowMethods: ["GET", "POST", "OPTIONS"],
          exposeHeaders: ["retry-after"],
          credentials: true,
        },
      }),
    });

    await app.start();

    const preflight = await app.fetch(
      new Request("http://test.local/echo", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.multihansa.local",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,idempotency-key",
        },
      }),
    );

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "https://app.multihansa.local",
    );
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(preflight.headers.get("access-control-allow-headers")).toBe(
      "content-type, idempotency-key",
    );
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");
    expect(preflight.headers.get("vary")).toBe("Origin");

    const createResponse = await app.fetch(
      new Request("http://test.local/echo", {
        method: "POST",
        headers: {
          origin: "https://app.multihansa.local",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Ada",
        }),
      }),
    );

    expect(createResponse.status).toBe(200);
    expect(createResponse.headers.get("access-control-allow-origin")).toBe(
      "https://app.multihansa.local",
    );
    expect(createResponse.headers.get("access-control-expose-headers")).toBe(
      "retry-after",
    );

    await app.stop();
  });

  test("rejects unsafe requests from untrusted origins when CSRF protection is enabled", async () => {
    const app = createApp({
      modules: [
        defineModule("mutations", {
          controllers: [
            defineController("mutations-http", {
              basePath: "/mutations",
              routes: ({ route }) => ({
                create: route.post({
                  path: "/",
                  request: {
                    body: z.object({
                      value: z.string(),
                    }),
                  },
                  responses: {
                    200: z.object({
                      ok: z.literal(true),
                    }),
                  },
                  handler: async () => ({ ok: true as const }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createFastifyHttpAdapter({
        csrf: {
          trustedOrigins: ["https://app.multihansa.local"],
        },
      }),
    });

    await app.start();

    const trustedResponse = await app.fetch(
      new Request("http://test.local/mutations", {
        method: "POST",
        headers: {
          origin: "https://app.multihansa.local",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          value: "safe",
        }),
      }),
    );
    expect(trustedResponse.status).toBe(200);

    const blockedResponse = await app.fetch(
      new Request("http://test.local/mutations", {
        method: "POST",
        headers: {
          origin: "https://evil.local",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          value: "unsafe",
        }),
      }),
    );

    expect(blockedResponse.status).toBe(403);
    expect(await blockedResponse.json()).toEqual({
      error: {
        code: "BEDROCK_HTTP_CSRF_FORBIDDEN",
        message: "Cross-site request blocked.",
        details: {
          origin: "https://evil.local",
        },
      },
    });

    await app.stop();
  });

  test("rejects route registration while running", async () => {
    const http = createFastifyHttpAdapter();
    http.registerRoutes([]);

    await http.start();

    expect(() => http.registerRoutes([])).toThrow(
      'Cannot register routes while the HTTP adapter is running.',
    );

    await http.stop();
  });
});

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a test port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

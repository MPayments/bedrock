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

import { createBunHttpAdapter } from "./index";

describe("@bedrock/http-bun", () => {
  test("parses JSON bodies, query strings, and lower-cased headers", async () => {
    const http = createBunHttpAdapter();
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
      http: createBunHttpAdapter(),
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

  test("dispatches raw HTTP mounts before exact static routes", async () => {
    const app = createApp({
      modules: [
        defineModule("auth", {
          httpMounts: [
            defineHttpMount("auth", {
              basePath: "/auth",
              handle: async () => ({
                kind: "json",
                status: 202,
                body: JSON.stringify({
                  source: "mount",
                }),
                headers: {
                  "content-type": "application/json",
                },
              }),
            }),
          ],
          controllers: [
            defineController("auth-http", {
              basePath: "/auth",
              routes: ({ route }) => ({
                session: route.get({
                  path: "/session",
                  responses: {
                    200: z.object({
                      source: z.literal("route"),
                    }),
                  },
                  handler: async () => ({
                    source: "route" as const,
                  }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createBunHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/auth/session"),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      source: "mount",
    });

    await app.stop();
  });

  test("preserves raw web requests when mounts parse the body", async () => {
    const app = createApp({
      modules: [
        defineModule("echo", {
          httpMounts: [
            defineHttpMount("echo", {
              basePath: "/echo",
              handle: async (request) => {
                const rawRequest = request.raw;
                const parsed = await request.readBody?.(
                  http.body.json(
                    z.object({
                      name: z.string(),
                    }),
                  ),
                );
                const replayed =
                  rawRequest instanceof Request ? await rawRequest.json() : null;

                return {
                  kind: "json",
                  status: 200,
                  body: JSON.stringify({
                    parsed,
                    replayed,
                  }),
                  headers: {
                    "content-type": "application/json",
                  },
                };
              },
            }),
          ],
        }),
      ],
      http: createBunHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Ada",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      parsed: {
        name: "Ada",
      },
      replayed: {
        name: "Ada",
      },
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
      http: createBunHttpAdapter(),
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

  test("prefers exact static routes over param routes", async () => {
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
                      source: z.literal("param"),
                      id: z.string(),
                    }),
                  },
                  handler: async ({ request }) => ({
                    source: "param" as const,
                    id: request.params.id,
                  }),
                }),
                latest: route.get({
                  path: "/latest",
                  responses: {
                    200: z.object({
                      source: z.literal("static"),
                    }),
                  },
                  handler: async () => ({
                    source: "static" as const,
                  }),
                }),
              }),
            }),
          ],
        }),
      ],
      http: createBunHttpAdapter(),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/posts/latest"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      source: "static",
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
      http: createBunHttpAdapter(),
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
    const httpAdapter = createBunHttpAdapter();
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
      http: createBunHttpAdapter({
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

  test("uses the app base path when matching routes", async () => {
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
      http: createBunHttpAdapter({
        basePath: "/api",
      }),
    });

    await app.start();

    const response = await app.fetch(
      new Request("http://test.local/api/health"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
    });

    await app.stop();
  });

  test("starts Bun.serve and stops the returned server handle", async () => {
    const bunObject = Bun as unknown as {
      serve: typeof Bun.serve;
    };
    const originalServe = bunObject.serve;
    const calls: Array<{
      fetch: (request: Request) => Promise<Response>;
      hostname?: string;
      port?: number;
    }> = [];
    const stops: number[] = [];

    bunObject.serve = ((config) => {
      calls.push({
        fetch: config.fetch as (request: Request) => Promise<Response>,
        hostname: typeof config.hostname === "string" ? config.hostname : undefined,
        port: typeof config.port === "number" ? config.port : undefined,
      });

      return {
        stop() {
          stops.push(stops.length + 1);
        },
      } as ReturnType<typeof Bun.serve>;
    }) as typeof Bun.serve;

    try {
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
        http: createBunHttpAdapter({
          listen: {
            port: 3100,
            hostname: "127.0.0.1",
          },
        }),
      });

      await app.start();

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        hostname: "127.0.0.1",
        port: 3100,
      });

      const directResponse = await app.fetch(
        new Request("http://test.local/health"),
      );
      const servedResponse = await calls[0]!.fetch(
        new Request("http://test.local/health"),
      );

      expect(await directResponse.json()).toEqual({
        ok: true,
      });
      expect(await servedResponse.json()).toEqual({
        ok: true,
      });

      await app.stop();

      expect(stops).toHaveLength(1);
    } finally {
      bunObject.serve = originalServe;
    }
  });

  test("rejects route registration while running", async () => {
    const http = createBunHttpAdapter();
    http.registerRoutes([]);

    await http.start();

    expect(() => http.registerRoutes([])).toThrow(
      'Cannot register routes while the HTTP adapter is running.',
    );

    await http.stop();
  });
});

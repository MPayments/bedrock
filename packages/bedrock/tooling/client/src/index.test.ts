import { afterEach, describe, expect, test } from "bun:test";
import {
  createApp,
  defineController,
  defineHttpError,
  defineModule,
  type AppDescriptor,
} from "@bedrock/core";
import { createFastifyHttpAdapter } from "@bedrock/http-fastify";
import { z } from "zod";

import {
  createApiClient,
  DetailedError,
  parseResponse,
  type ApiClientConfig,
  type ApiContract,
} from "./index";

const UserExistsError = defineHttpError("USER_EXISTS", {
  status: 409,
  description: "User already exists",
  details: z.object({
    email: z.string().email(),
  }),
});

function createClientTestHarness(args: {
  client?: Omit<ApiClientConfig, "baseUrl" | "fetch"> & {
    baseUrl?: ApiClientConfig["baseUrl"];
  };
  onRequest?: (request: Request) => void;
} = {}) {
  const usersController = defineController("users-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      getById: route.get({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
          }),
          query: z.object({
            tag: z.union([z.string(), z.array(z.string())]).optional(),
          }),
          headers: z.object({
            "content-type": z.string().optional(),
            "x-optional": z.string().optional(),
          }),
        },
        responses: {
          200: z.object({
            id: z.string(),
            tag: z.union([z.string(), z.array(z.string())]).optional(),
            contentType: z.string().optional(),
            optionalHeader: z.string().optional(),
          }),
        },
        handler: async ({ request }) => ({
          id: request.params.id,
          tag: request.query.tag,
          contentType: request.headers["content-type"],
          optionalHeader: request.headers["x-optional"],
        }),
      }),
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            name: z.string().min(1),
          }),
          headers: z.object({
            "x-client-id": z.string().optional(),
            "x-trace-id": z.string().optional(),
            "content-type": z.string().optional(),
          }),
        },
        responses: {
          200: z.object({
            name: z.string(),
            clientId: z.string().optional(),
            traceId: z.string().optional(),
            contentType: z.string().optional(),
          }),
        },
        errors: {
          USER_EXISTS: UserExistsError,
        },
        handler: async ({ request, error }) => {
          if (request.body.name === "taken") {
            return error(UserExistsError, {
              email: "taken@example.com",
            });
          }

          return {
            name: request.body.name,
            clientId: request.headers["x-client-id"],
            traceId: request.headers["x-trace-id"],
            contentType: request.headers["content-type"],
          };
        },
      }),
      update: route.patch({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
          }),
          body: z.object({
            name: z.string().min(1),
          }),
        },
        responses: {
          200: z.object({
            method: z.literal("PATCH"),
            id: z.string(),
            name: z.string(),
          }),
        },
        handler: async ({ request }) => ({
          method: "PATCH" as const,
          id: request.params.id,
          name: request.body.name,
        }),
      }),
    }),
  });

  const healthController = defineController("health-http", {
    routes: ({ route }) => ({
      read: route.get({
        path: "/$health",
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () => ({
          ok: true as const,
        }),
      }),
    }),
  });

  const appDefinition = {
    modules: [
      defineModule("client-test", {
        controllers: [usersController, healthController],
      }),
    ],
  } satisfies AppDescriptor;

  type TestApi = ApiContract<typeof appDefinition>;

  const app = createApp({
    ...appDefinition,
    http: createFastifyHttpAdapter({
      basePath: "/api",
    }),
  });
  const client = createApiClient<TestApi>({
    baseUrl: args.client?.baseUrl ?? "http://test.local/api",
    fetch: ((input, init) => {
      const request =
        input instanceof Request
          ? input
          : new Request(
              input instanceof URL ? input.toString() : String(input),
              init,
            );

      args.onRequest?.(request);
      return app.fetch(request);
    }) as typeof fetch,
    init: args.client?.init,
    headers:
      args.client?.headers ??
      (async () => ({
        "x-client-id": "client-default",
        "x-trace-id": "trace-default",
      })),
    buildSearchParams: args.client?.buildSearchParams,
  });

  return {
    app,
    client,
  };
}

describe("@bedrock/client", () => {
  const startedApps = new Set<ReturnType<typeof createClientTestHarness>["app"]>();

  afterEach(async () => {
    await Promise.all(
      [...startedApps].map(async (app) => {
        startedApps.delete(app);
        await app.stop();
      }),
    );
  });

  test("executes GET requests with params and query and returns a native Response", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$get({
      params: {
        id: "user-1",
      },
      query: {
        tag: ["core", "http"],
      },
    });

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-1",
      tag: ["core", "http"],
    });
  });

  test("merges default and request headers and auto-sets JSON content type for body requests", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users.$post({
      json: {
        name: "Ada",
      },
      headers: {
        "x-trace-id": "trace-override",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "Ada",
      clientId: "client-default",
      traceId: "trace-override",
      contentType: "application/json; charset=utf-8",
    });
  });

  test("does not set a content type header when no JSON body is sent", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$get({
      params: {
        id: "user-2",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-2",
    });
  });

  test("omits undefined header values instead of sending the string literal undefined", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$get({
      params: {
        id: "user-optional",
      },
      headers: {
        "x-optional": undefined,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-optional",
    });
  });

  test("$url builds encoded URLs with repeated query keys", () => {
    const { client } = createClientTestHarness();

    const url = client.users[":id"].$url({
      params: {
        id: "user/value",
      },
      query: {
        tag: ["core", "http"],
      },
    });

    expect(url.toString()).toBe(
      "http://test.local/api/users/user%2Fvalue?tag=core&tag=http",
    );
  });

  test("$url rejects nested object query values", () => {
    const { client } = createClientTestHarness();

    expect(() =>
      client.users[":id"].$url({
        params: {
          id: "user-value",
        },
        query: {
          tag: { nested: true } as never,
        },
      }),
    ).toThrow('Query parameter "tag" must be a primitive or array of primitives.');
  });

  test("uses the correct HTTP verb for patch helpers", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$patch({
      params: {
        id: "user-3",
      },
      json: {
        name: "Grace",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      method: "PATCH",
      id: "user-3",
      name: "Grace",
    });
  });

  test("resolves escaped literal path segments", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client["$$health"].$get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
    });
  });

  test("$path builds a path string without the origin", () => {
    const { client } = createClientTestHarness();

    const path = client.users[":id"].$path({
      param: {
        id: "user/value",
      },
      query: {
        tag: ["core", "http"],
      },
    });

    expect(path).toBe("/api/users/user%2Fvalue?tag=core&tag=http");
  });

  test("uses custom query serialization when buildSearchParams is configured", async () => {
    const { app, client } = createClientTestHarness({
      client: {
        buildSearchParams(query) {
          const searchParams = new URLSearchParams();

          for (const [key, value] of Object.entries(query)) {
            if (Array.isArray(value)) {
              searchParams.set(key, value.map((entry) => String(entry)).join("|"));
              continue;
            }

            if (value !== undefined) {
              searchParams.append(key, String(value));
            }
          }

          return searchParams;
        },
      },
    });
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$get({
      param: {
        id: "user-serializer",
      },
      query: {
        tag: ["core", "http"],
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-serializer",
      tag: "core|http",
    });
    expect(
      client.users[":id"].$path({
        param: {
          id: "user-serializer",
        },
        query: {
          tag: ["core", "http"],
        },
      }),
    ).toBe("/api/users/user-serializer?tag=core%7Chttp");
  });

  test("accepts the param alias for path parameters", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const response = await client.users[":id"].$get({
      param: {
        id: "user-param-alias",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-param-alias",
    });
  });

  test("applies second-argument overrides after request options and client defaults", async () => {
    let capturedRequest: Request | undefined;
    const { app, client } = createClientTestHarness({
      client: {
        init: {
          credentials: "same-origin",
        },
      },
      onRequest(request) {
        capturedRequest = request;
      },
    });
    startedApps.add(app);
    await app.start();

    const response = await client.users.$post(
      {
        json: {
          name: "Ada",
        },
        headers: {
          "x-trace-id": "trace-request",
        },
        init: {
          credentials: "omit",
        },
      },
      {
        headers: {
          "x-trace-id": "trace-override",
        },
        init: {
          credentials: "include",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "Ada",
      clientId: "client-default",
      traceId: "trace-override",
      contentType: "application/json; charset=utf-8",
    });
    expect(capturedRequest?.credentials).toBe("include");
  });

  test("parseResponse returns the parsed success body", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    const body = await parseResponse(
      client.users.$post({
        json: {
          name: "Ada",
        },
      }),
    );

    expect(body).toEqual({
      name: "Ada",
      clientId: "client-default",
      traceId: "trace-default",
      contentType: "application/json; charset=utf-8",
    });
  });

  test("parseResponse throws DetailedError with the parsed error body", async () => {
    const { app, client } = createClientTestHarness();
    startedApps.add(app);
    await app.start();

    try {
      await parseResponse(
        client.users.$post({
          json: {
            name: "taken",
          },
        }),
      );
      throw new Error("Expected parseResponse to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(DetailedError);
      expect((error as DetailedError).status).toBe(409);
      expect((error as DetailedError).message).toBe("User already exists");
      expect((error as DetailedError).body).toEqual({
        error: {
          code: "USER_EXISTS",
          message: "User already exists",
          details: {
            email: "taken@example.com",
          },
        },
      });
    }
  });
});

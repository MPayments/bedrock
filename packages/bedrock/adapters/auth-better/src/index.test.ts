import { expect, test } from "bun:test";
import {
  createApp,
  defineController,
  defineModule,
  defineService,
  type HttpAdapter,
} from "@bedrock/core";
import { createFastifyHttpAdapter } from "@bedrock/http-fastify";
import { AuthContextToken } from "@bedrock/security";
import { betterAuth, type Auth } from "better-auth";
import { z } from "zod";

import {
  BetterAuthRequestContextToken,
  createBetterAuthMount,
  createBetterAuthModule,
  createBetterAuthProviders,
  type BetterAuthResolvedGrants,
} from "./index";

test("accepts concrete betterAuth instances without casts", () => {
  const auth = betterAuth({
    baseURL: "http://typed.local/api/auth",
    trustedOrigins: ["http://typed.local"],
    secret: "better-auth-secret-that-is-long-enough-for-typed-test",
    emailAndPassword: {
      enabled: true,
    },
    rateLimit: {
      enabled: false,
    },
  });

  const providers = createBetterAuthProviders({
    auth,
  });
  const mount = createBetterAuthMount({
    auth,
  });
  const module = createBetterAuthModule("typed-auth", {
    auth,
    mount: false,
  });

  expect(auth.options.emailAndPassword?.enabled).toBe(true);
  expect(providers.length).toBeGreaterThan(0);
  expect(mount.basePath).toBe("/api/auth");
  expect(module.name).toBe("typed-auth");
});

test("request-scoped session lookup is cached once per request and builds a default actor", async () => {
  const fakeAuth = createFakeAuth({
    getSession: ({ headers }) =>
      headers.get("authorization") === "Bearer session"
        ? {
            session: {
              id: "session_123",
            },
            user: {
              id: "user_123",
              email: "ada@example.com",
              emailVerified: true,
              name: "Ada Lovelace",
            },
          }
        : null,
  });

  const reader = defineService("reader", {
    deps: {
      auth: AuthContextToken,
      requestContext: BetterAuthRequestContextToken,
    },
    ctx: ({ auth, requestContext }) => ({
      auth,
      requestContext,
    }),
    actions: ({ action }) => ({
      read: action({
        output: z.object({
          actorKind: z.string().nullable(),
          subjectId: z.string().nullable(),
          email: z.string().nullable(),
        }),
        handler: async ({ ctx }) => {
          const actor = ctx.auth.actor();
          return {
            actorKind: actor?.kind ?? null,
            subjectId: actor?.subject.id ?? null,
            email:
              typeof actor?.claims.email === "string" ? actor.claims.email : null,
          };
        },
      }),
      readRaw: action({
        output: z.object({
          hasUser: z.boolean(),
        }),
        handler: async ({ ctx }) => ({
          hasUser: ctx.requestContext.user !== null,
        }),
      }),
    }),
  });

  const controller = defineController("session-http", {
    basePath: "/session",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: z.object({
            first: z.object({
              actorKind: z.string().nullable(),
              subjectId: z.string().nullable(),
              email: z.string().nullable(),
            }),
            second: z.object({
              actorKind: z.string().nullable(),
              subjectId: z.string().nullable(),
              email: z.string().nullable(),
            }),
            raw: z.object({
              hasUser: z.boolean(),
            }),
          }),
        },
        handler: async ({ call }) => ({
          first: await call(reader.actions.read),
          second: await call(reader.actions.read),
          raw: await call(reader.actions.readRaw),
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("session", {
        providers: createBetterAuthProviders({
          auth: fakeAuth,
        }),
        services: {
          reader,
        },
        controllers: [controller],
      }),
    ],
    http: createFastifyHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/session", {
      headers: {
        authorization: "Bearer session",
      },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    first: {
      actorKind: "user",
      subjectId: "user_123",
      email: "ada@example.com",
    },
    second: {
      actorKind: "user",
      subjectId: "user_123",
      email: "ada@example.com",
    },
    raw: {
      hasUser: true,
    },
  });
  expect(fakeAuth.sessionCalls).toBe(1);

  await app.stop();
});

test("grant enrichment runs once per request and merges into the actor", async () => {
  const fakeAuth = createFakeAuth({
    getSession: () => ({
      session: {
        id: "session_123",
      },
      user: {
        id: "user_123",
        email: "ada@example.com",
        emailVerified: true,
        name: "Ada Lovelace",
      },
    }),
  });

  let grantCalls = 0;

  const service = defineService("grant-reader", {
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    actions: ({ action }) => ({
      inspect: action({
        output: z.object({
          activeScope: z.object({
            type: z.string(),
            id: z.string(),
          }),
          roles: z.array(z.string()),
          permissions: z.array(z.string()),
          plan: z.string(),
        }),
        handler: async ({ ctx }) => {
          const actor = ctx.auth.actor();
          if (!actor || !actor.activeScope) {
            throw new Error("actor scope missing");
          }

          return {
            activeScope: actor.activeScope,
            roles: actor.roles.map((entry) => entry.role),
            permissions: actor.permissions.map((entry) => entry.permission),
            plan: String(actor.claims.plan),
          };
        },
      }),
    }),
  });

  const controller = defineController("grants-http", {
    basePath: "/grants",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: service.actions.inspect.output,
        },
        handler: service.actions.inspect,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("grants", {
        providers: createBetterAuthProviders({
          auth: fakeAuth,
          grants: {
            resolve: async () => {
              grantCalls += 1;
              return {
                activeScope: {
                  type: "organization",
                  id: "org_123",
                },
                roles: [
                  {
                    role: "admin",
                  },
                ],
                permissions: [
                  {
                    permission: "posts:write",
                  },
                ],
                claims: {
                  plan: "pro",
                },
              } satisfies BetterAuthResolvedGrants;
            },
          },
        }),
        services: {
          "grant-reader": service,
        },
        controllers: [controller],
      }),
    ],
    http: createFastifyHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(new Request("http://test.local/grants"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    activeScope: {
      type: "organization",
      id: "org_123",
    },
    roles: ["admin"],
    permissions: ["posts:write"],
    plan: "pro",
  });
  expect(grantCalls).toBe(1);

  await app.stop();
});

test("raw Better Auth mounts serve the full subtree", async () => {
  const fakeAuth = createFakeAuth({
    getSession: () => null,
    handler: async (request) =>
      new Response(`mounted:${new URL(request.url).pathname}`, {
        status: 202,
        headers: {
          "x-mounted": "true",
        },
      }),
  });

  const app = createApp({
    modules: [
      createBetterAuthModule("auth", {
        auth: fakeAuth,
      }),
    ],
    http: createFastifyHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/auth/session"),
  );

  expect(response.status).toBe(202);
  expect(response.headers.get("x-mounted")).toBe("true");
  expect(await response.text()).toBe("mounted:/api/auth/session");

  await app.stop();
});

test("API keys do not become user actors by default, but explicit API-key actors work", async () => {
  const fakeAuth = createFakeAuth({
    getSession: ({ headers }) =>
      headers.get("x-api-key")
        ? {
            session: {
              id: "session_123",
            },
            user: {
              id: "user_123",
              email: "ada@example.com",
              emailVerified: true,
              name: "Ada Lovelace",
            },
          }
        : null,
  });

  const reader = defineService("api-key-reader", {
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    actions: ({ action }) => ({
      inspect: action({
        output: z.object({
          actorKind: z.string().nullable(),
          ownerType: z.string().nullable(),
        }),
        handler: async ({ ctx }) => {
          const actor = ctx.auth.actor();
          return {
            actorKind: actor?.kind ?? null,
            ownerType: actor?.apiKey?.ownerType ?? null,
          };
        },
      }),
    }),
  });

  const controller = defineController("api-key-http", {
    basePath: "/api-key",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: reader.actions.inspect.output,
        },
        handler: reader.actions.inspect,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("api-key", {
        providers: createBetterAuthProviders({
          auth: fakeAuth,
          apiKeys: {
            resolve: ({ headers }) => {
              const value = headers.get("x-api-key");
              return value
                ? {
                    id: value,
                    ownerType: "organization",
                    ownerId: "org_123",
                  }
                : null;
            },
          },
          actor: {
            fromApiKey: ({ apiKeyContext }) => {
              if (
                !isApiKeyRecord(apiKeyContext.apiKey) ||
                typeof apiKeyContext.apiKey.id !== "string"
              ) {
                return null;
              }

              return {
                kind: "api-key",
                subject: {
                  id: apiKeyContext.apiKey.id,
                },
                roles: [],
                permissions: [],
                claims: {},
                apiKey: {
                  id: apiKeyContext.apiKey.id,
                  ownerType:
                    apiKeyContext.apiKey.ownerType === "organization"
                      ? "organization"
                      : "user",
                  ownerId: String(apiKeyContext.apiKey.ownerId),
                },
              };
            },
          },
        }),
        services: {
          "api-key-reader": reader,
        },
        controllers: [controller],
      }),
    ],
    http: createFastifyHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api-key", {
      headers: {
        "x-api-key": "key_123",
      },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    actorKind: "api-key",
    ownerType: "organization",
  });

  await app.stop();
});

test("session mocking opt-in only affects user-owned keys", async () => {
  const fakeAuth = createFakeAuth({
    getSession: ({ headers }) =>
      headers.get("x-api-key")
        ? {
            session: {
              id: "session_123",
            },
            user: {
              id: "user_123",
              email: "ada@example.com",
              emailVerified: true,
              name: "Ada Lovelace",
            },
          }
        : null,
  });

  const controller = defineController("session-mocking-http", {
    basePath: "/session-mocking",
    deps: {
      auth: AuthContextToken,
    },
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: z.object({
            actorKind: z.string().nullable(),
            subjectId: z.string().nullable(),
          }),
        },
        handler: async ({ ctx }) => ({
          actorKind: ctx.auth.actor()?.kind ?? null,
          subjectId: ctx.auth.actor()?.subject.id ?? null,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("session-mocking", {
        providers: createBetterAuthProviders({
          auth: fakeAuth,
          apiKeys: {
            sessionMocking: "user-owned-only",
            resolve: ({ headers }) => {
              const key = headers.get("x-api-key");
              if (key === "user-key") {
                return {
                  id: key,
                  ownerType: "user",
                  ownerId: "user_123",
                };
              }

              if (key === "org-key") {
                return {
                  id: key,
                  ownerType: "organization",
                  ownerId: "org_123",
                };
              }

              return null;
            },
          },
          actor: {
            fromApiKey: ({ apiKeyContext }) => {
              if (!isApiKeyRecord(apiKeyContext.apiKey)) {
                return null;
              }

              return {
                kind: "api-key",
                subject: {
                  id: String(apiKeyContext.apiKey.id),
                },
                roles: [],
                permissions: [],
                claims: {},
                apiKey: {
                  id: String(apiKeyContext.apiKey.id),
                  ownerType:
                    apiKeyContext.apiKey.ownerType === "organization"
                      ? "organization"
                      : "user",
                  ownerId: String(apiKeyContext.apiKey.ownerId),
                },
              };
            },
          },
        }),
        controllers: [controller],
      }),
    ],
    http: createFastifyHttpAdapter(),
  });

  await app.start();

  const userOwned = await app.fetch(
    new Request("http://test.local/session-mocking", {
      headers: {
        "x-api-key": "user-key",
      },
    }),
  );
  const orgOwned = await app.fetch(
    new Request("http://test.local/session-mocking", {
      headers: {
        "x-api-key": "org-key",
      },
    }),
  );

  expect(await userOwned.json()).toEqual({
    actorKind: "user",
    subjectId: "user_123",
  });
  expect(await orgOwned.json()).toEqual({
    actorKind: "api-key",
    subjectId: "org-key",
  });

  await app.stop();
});

function createFakeAuth(args: {
  getSession(args: {
    headers: Headers;
  }): { session: Record<string, unknown>; user: Record<string, unknown> } | null;
  handler?: (request: Request) => Promise<Response> | Response;
}): Auth & {
  sessionCalls: number;
} {
  let sessionCalls = 0;

  const auth = {
    handler:
      args.handler ??
      (async () =>
        new Response("ok", {
          status: 200,
        })),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        sessionCalls += 1;
        return args.getSession({ headers });
      },
    },
    options: {},
    $ERROR_CODES: {},
    $context: Promise.resolve({}),
    $Infer: {},
  } as unknown as Auth & {
    sessionCalls: number;
  };

  Object.defineProperty(auth, "sessionCalls", {
    enumerable: true,
    get: () => sessionCalls,
  });

  return auth;
}

function isApiKeyRecord(
  value: unknown,
): value is Record<string, string | number | boolean | null> {
  return typeof value === "object" && value !== null;
}

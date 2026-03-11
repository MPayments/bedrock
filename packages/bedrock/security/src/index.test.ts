import { expect, test } from "bun:test";
import {
  ExecutionContextToken,
  createApp,
  createRuntimeHttpRequestFromWebRequest,
  defineController,
  defineModule,
  defineProvider,
  runtimeHttpResultToResponse,
  type BoundHttpRoute,
  type HttpAdapter,
} from "@bedrock/core";
import { z } from "zod";

import {
  AuthContextToken,
  ForbiddenHttpError,
  type AuthContext,
  OptionalActorToken,
  SecurityForbidden,
  SecurityUnauthenticated,
  UnauthorizedHttpError,
  createAuthContext,
  definePolicy,
  requirePermissionMiddleware,
  type Actor,
} from "./index";

const authenticatedActor: Actor = {
  kind: "user",
  subject: {
    id: "user_123",
  },
  sessionId: "session_123",
  roles: [
    {
      role: "member",
    },
  ],
  permissions: [
    {
      permission: "posts:read",
      scope: {
        type: "organization",
        id: "org_123",
      },
    },
  ],
  claims: {
    email: "ada@example.com",
    emailVerified: true,
  },
};

test("createAuthContext returns typed unauthenticated and forbidden results", () => {
  const auth = createAuthContext(null);

  const actorResult = auth.requireActor();
  expect(actorResult.ok).toBe(false);
  if (!actorResult.ok) {
    expect(actorResult.error.code).toBe(SecurityUnauthenticated.code);
  }

  const permissionResult = auth.requirePermission("posts:write");
  expect(permissionResult.ok).toBe(false);
  if (!permissionResult.ok) {
    expect(permissionResult.error.code).toBe(SecurityUnauthenticated.code);
  }
});

test("AuthContext applies scope-aware permission checks", () => {
  const auth = createAuthContext(authenticatedActor);

  expect(auth.hasPermission("posts:read")).toBe(true);
  expect(
    auth.hasPermission("posts:read", {
      type: "organization",
      id: "org_123",
    }),
  ).toBe(true);
  expect(
    auth.hasPermission("posts:read", {
      type: "organization",
      id: "org_456",
    }),
  ).toBe(false);
});

test("definePolicy composes through AuthContext.check()", async () => {
  const policy = definePolicy<
    AuthContext,
    {
      permission: string;
      scope: {
        type: string;
        id: string;
      };
    },
    readonly [typeof SecurityForbidden]
  >("posts.write", {
    errors: [SecurityForbidden] as const,
    check: async ({ ctx, input, deny }) => {
      if (ctx.hasPermission(input.permission, input.scope)) {
        return {
          ok: true as const,
          value: undefined,
        };
      }

      return deny(SecurityForbidden, {
        kind: "policy",
        policy: "posts.write",
        permission: input.permission,
        scope: input.scope,
      });
    },
  });

  const auth = createAuthContext(authenticatedActor);
  const allowed = await auth.check(policy, {
    permission: "posts:read",
    scope: {
      type: "organization",
      id: "org_123",
    },
  });
  const denied = await auth.check(policy, {
    permission: "posts:write",
    scope: {
      type: "organization",
      id: "org_123",
    },
  });

  expect(allowed).toEqual({
    ok: true,
    value: undefined,
  });
  expect(denied.ok).toBe(false);
  if (!denied.ok) {
    expect(denied.error.code).toBe(SecurityForbidden.code);
    expect(denied.error.details.policy).toBe("posts.write");
  }
});

test("controller middleware helpers emit 401 and 403 HTTP errors", async () => {
  const http = createTestHttpAdapter();
  const controller = defineController("secure-http", {
    basePath: "/secure",
    deps: {
      auth: AuthContextToken,
    },
    routes: ({ route }) => ({
      read: route.get({
        path: "/",
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        middleware: [
          requirePermissionMiddleware("posts:read", {
            scope: {
              type: "organization",
              id: "org_123",
            },
          }),
        ],
        errors: {
          SECURITY_UNAUTHENTICATED: UnauthorizedHttpError,
          SECURITY_FORBIDDEN: ForbiddenHttpError,
        },
        handler: async () => ({
          ok: true as const,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("secure", {
        providers: [
          defineProvider({
            provide: OptionalActorToken,
            scope: "request",
            deps: {
              executionContext: ExecutionContextToken,
            },
            useFactory: ({ executionContext }) =>
              executionContext.kind === "http" &&
              executionContext.http?.request.headers["authorization"] === "Bearer member"
                ? authenticatedActor
                : null,
          }),
          defineProvider({
            provide: AuthContextToken,
            scope: "request",
            deps: {
              actor: OptionalActorToken,
            },
            useFactory: ({ actor }) => createAuthContext(actor),
          }),
        ],
        controllers: [controller],
      }),
    ],
    http,
  });

  await app.start();
  const unauthenticatedResponse = await app.fetch(
    new Request("http://test.local/api/secure"),
  );
  const authorizedResponse = await app.fetch(
    new Request("http://test.local/api/secure", {
      headers: {
        authorization: "Bearer member",
      },
    }),
  );

  expect(unauthenticatedResponse.status).toBe(401);
  expect(authorizedResponse.status).toBe(200);
  await app.stop();
});

function createTestHttpAdapter(): HttpAdapter {
  let routes: readonly BoundHttpRoute[] = [];

  return {
    basePath: "/api",
    registerRoutes(nextRoutes) {
      routes = [...nextRoutes];
    },
    async fetch(request) {
      const url = new URL(request.url);
      const route = routes.find(
        (entry) =>
          entry.method.toUpperCase() === request.method.toUpperCase() &&
          entry.fullPath === url.pathname,
      );

      if (!route) {
        return new Response("not found", { status: 404 });
      }

      try {
        return runtimeHttpResultToResponse(
          await route.execute({
            request: createRuntimeHttpRequestFromWebRequest(request),
          }),
        );
      } catch (error) {
        const bedrockError = error as {
          code: string;
          message: string;
          status?: number;
        };
        return new Response(
          JSON.stringify({
            error: {
              code: bedrockError.code,
              message: bedrockError.message,
            },
          }),
          {
            status: bedrockError.status ?? 500,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }
    },
    async start() {},
    async stop() {},
  };
}

import { expect, test } from "bun:test";
import { z } from "zod";

import {
  type BoundHttpRoute,
  createApp,
  createRuntimeHttpRequestFromWebRequest,
  defineController,
  defineDomainError,
  defineHttpError,
  defineModule,
  defineService,
  http,
  isBedrockError,
  runtimeHttpResultToResponse,
  type BedrockError,
} from "./index";

function createTestHttpAdapter() {
  let routes: readonly BoundHttpRoute[] = [];

  return {
    registerRoutes(nextRoutes: typeof routes) {
      routes = [...nextRoutes];
    },
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const route = routes.find(
        (entry) =>
          entry.fullPath === url.pathname &&
          entry.method.toUpperCase() === request.method.toUpperCase(),
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
        if (!isBedrockError(error)) {
          throw error;
        }

        return new Response(
          JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          }),
          {
            status: error.status ?? 500,
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

test("app.call returns Result for success and declared domain failure", async () => {
  const EmailTaken = defineDomainError("EMAIL_TAKEN", {
    details: z.object({
      email: z.string().email(),
    }),
  });

  const usersService = defineService("users", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
        errors: [EmailTaken],
        handler: async ({ input, error }) => {
          if (input.email === "taken@example.com") {
            return error(EmailTaken, { email: input.email });
          }

          return {
            id: "user-1",
            email: input.email,
          };
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("users", {
        services: {
          users: usersService,
        },
      }),
    ],
  });

  await app.start();

  const created = await app.call(usersService.actions.create, {
    email: "ada@example.com",
  });
  const rejected = await app.call(usersService.actions.create, {
    email: "taken@example.com",
  });

  expect(created).toEqual({
    ok: true,
    value: {
      id: "user-1",
      email: "ada@example.com",
    },
  });
  expect(rejected).toEqual({
    ok: false,
    error: {
      kind: "domain-error",
      code: "EMAIL_TAKEN",
      details: {
        email: "taken@example.com",
      },
    },
  });

  await app.stop();
});

test("action-backed routes map domain errors to public HTTP errors", async () => {
  const AuthorNotFound = defineDomainError("AUTHOR_NOT_FOUND", {
    details: z.object({
      authorId: z.string(),
    }),
  });
  const BlogAuthorNotFound = defineHttpError("BLOG_AUTHOR_NOT_FOUND", {
    status: 404,
    description: "Author was not found",
    details: z.object({
      authorId: z.string(),
    }),
  });

  const postsService = defineService("posts", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          authorId: z.string(),
        }),
        output: z.object({
          id: z.string(),
        }),
        errors: [AuthorNotFound],
        handler: async ({ input, error }) => {
          if (input.authorId !== "author-1") {
            return error(AuthorNotFound, { authorId: input.authorId });
          }

          return { id: "post-1" };
        },
      }),
    }),
  });

  const postsController = defineController("posts-http", {
    basePath: "/posts",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            authorId: z.string(),
          }),
        },
        responses: {
          200: postsService.actions.create.output,
        },
        handler: postsService.actions.create,
        errors: {
          AUTHOR_NOT_FOUND: BlogAuthorNotFound,
        },
      }),
    }),
  });

  const httpAdapter = createTestHttpAdapter();
  const app = createApp({
    modules: [
      defineModule("posts", {
        services: {
          posts: postsService,
        },
        controllers: [postsController],
      }),
    ],
    http: httpAdapter,
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://example.test/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        authorId: "missing-author",
      }),
    }),
  );

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: {
      code: "BLOG_AUTHOR_NOT_FOUND",
      message: "Author was not found",
      details: {
        authorId: "missing-author",
      },
    },
  });

  await app.stop();
});

test("custom routes can expose typed public HTTP errors", async () => {
  const Unauthorized = defineHttpError("AUTH_UNAUTHORIZED", {
    status: 401,
    description: "Authentication is required",
  });

  const authController = defineController("auth-http", {
    basePath: "/auth",
    routes: ({ route }) => ({
      me: route.get({
        path: "/me",
        responses: {
          204: http.response.empty(),
        },
        errors: {
          AUTH_UNAUTHORIZED: Unauthorized,
        },
        handler: async ({ error }) => error(Unauthorized),
      }),
    }),
  });

  const httpAdapter = createTestHttpAdapter();
  const app = createApp({
    modules: [
      defineModule("auth", {
        controllers: [authController],
      }),
    ],
    http: httpAdapter,
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://example.test/auth/me", {
      method: "GET",
    }),
  );

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: {
      code: "AUTH_UNAUTHORIZED",
      message: "Authentication is required",
      details: undefined,
    },
  });

  await app.stop();
});

test("service actions that return malformed error results fail with a Bedrock contract error", async () => {
  const service = defineService("broken", {
    actions: ({ action }) => ({
      broken: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () =>
          ({
            [Symbol.for("@bedrock/error-result")]: true,
            error: {
              kind: "domain-error",
              code: "BROKEN",
            },
          }) as any,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("broken", {
        services: {
          broken: service,
        },
      }),
    ],
  });

  await app.start();

  await expect(app.call(service.actions.broken)).rejects.toMatchObject({
    code: "BEDROCK_ACTION_CONTRACT_ERROR",
  } satisfies Partial<BedrockError>);

  await app.stop();
});

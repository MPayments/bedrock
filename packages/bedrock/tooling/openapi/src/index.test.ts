import { expect, test } from "bun:test";
import {
  BedrockError,
  defineController,
  defineDomainError,
  defineHttpError,
  defineModule,
  defineService,
  type AppDescriptor,
  type HttpAdapter,
} from "@bedrock/core";
import { z } from "zod";

import { generateOpenApiDocument } from "./index";

test("generates an OpenAPI document from controller routes", () => {
  const CreateUserInput = z.object({
    email: z.email(),
    name: z.string().min(1),
  });
  const UserSchema = z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().min(1),
  });

  const usersService = defineService("users", {
    actions: ({ action }) => ({
      create: action({
        input: CreateUserInput,
        output: UserSchema,
        handler: async ({ input }) => ({
          id: "user-1",
          ...input,
        }),
      }),
      getById: action({
        input: z.object({
          id: z.string(),
        }),
        output: UserSchema,
        handler: async ({ input }) => ({
          id: input.id,
          email: "ada@example.com",
          name: "Ada",
        }),
      }),
    }),
  });

  const usersController = defineController("users-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: CreateUserInput,
        },
        responses: {
          200: usersService.actions.create.output,
        },
        handler: usersService.actions.create,
        summary: "Create a user",
        tags: ["users"],
      }),
      getById: route.get({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string().describe("User identifier"),
          }),
          query: z.object({
            expand: z.enum(["posts"]).optional(),
          }),
          headers: z.object({
            "x-request-id": z.uuid().optional(),
          }),
        },
        responses: {
          200: usersService.actions.getById.output,
        },
        handler: usersService.actions.getById,
        select: (request) => ({
          id: request.params.id,
        }),
        summary: "Get a user",
        tags: ["users"],
      }),
    }),
  });

  const document = generateOpenApiDocument(
    {
      modules: [
        defineModule("users", {
          services: {
            users: usersService,
          },
          controllers: [usersController],
        }),
      ],
      http: createFakeHttpAdapter(),
    },
    {
      info: {
        title: "Users API",
        version: "1.0.0",
      },
      servers: [
        {
          url: "https://api.example.com",
        },
      ],
    },
  );

  expect(document).toMatchObject({
    openapi: "3.0.3",
    info: {
      title: "Users API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "https://api.example.com",
      },
    ],
    tags: [
      {
        name: "users",
      },
    ],
  });

  expect(document.paths["/api/users"]?.post).toMatchObject({
    operationId: "route:users/users-http/create",
    summary: "Create a user",
    tags: ["users"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "name"],
            properties: {
              email: {
                type: "string",
                format: "email",
              },
              name: {
                type: "string",
                minLength: 1,
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["id", "email", "name"],
              properties: {
                id: {
                  type: "string",
                },
                email: {
                  type: "string",
                  format: "email",
                },
                name: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
          },
        },
      },
    },
  });

  expect(document.paths["/api/users/{id}"]?.get).toMatchObject({
    operationId: "route:users/users-http/getById",
    summary: "Get a user",
    tags: ["users"],
  });
  expect(document.paths["/api/users/{id}"]?.get?.parameters).toHaveLength(3);
  expect(document.paths["/api/users/{id}"]?.get?.parameters?.[0]).toMatchObject(
    {
      name: "id",
      in: "path",
      required: true,
      description: "User identifier",
      schema: {
        type: "string",
        description: "User identifier",
      },
    },
  );
  expect(document.paths["/api/users/{id}"]?.get?.parameters?.[1]).toMatchObject(
    {
      name: "expand",
      in: "query",
      required: false,
      schema: {
        enum: ["posts"],
        type: "string",
      },
    },
  );
  expect(document.paths["/api/users/{id}"]?.get?.parameters?.[2]).toMatchObject(
    {
      name: "x-request-id",
      in: "header",
      required: false,
      schema: {
        type: "string",
        format: "uuid",
      },
    },
  );
  expect(
    document.paths["/api/users/{id}"]?.get?.responses["415"],
  ).toBeUndefined();
});

test("fails when a route schema cannot be represented in OpenAPI", () => {
  const controller = defineController("clock-http", {
    basePath: "/clock",
    routes: ({ route }) => ({
      read: route.get({
        path: "/",
        responses: {
          200: z.date(),
        },
        handler: async () => new Date(),
      }),
    }),
  });

  const app: AppDescriptor = {
    modules: [
      defineModule("clock", {
        controllers: [controller],
      }),
    ],
  };

  expect(() =>
    generateOpenApiDocument(app, {
      info: {
        title: "Clock API",
        version: "1.0.0",
      },
    }),
  ).toThrow(BedrockError);
});

test("generates implicit and explicit error responses per route", () => {
  const UserAlreadyExists = defineDomainError("USER_ALREADY_EXISTS", {
    details: z.object({
      email: z.email(),
    }),
  });
  const UserReservedDomain = defineDomainError("USER_RESERVED_DOMAIN");
  const ValidationOverride = defineHttpError("BEDROCK_VALIDATION_ERROR", {
    status: 400,
    description: "Invalid create payload",
  });
  const UserExists = defineHttpError("USER_EXISTS", {
    status: 409,
    description: "User already exists",
    details: z.object({
      email: z.email(),
    }),
  });
  const UserReserved = defineHttpError("USER_RESERVED", {
    status: 409,
    description: "User is reserved",
  });
  const usersService = defineService("users", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        errors: [UserAlreadyExists, UserReservedDomain],
        handler: async () => ({ ok: true as const }),
      }),
    }),
  });

  const controller = defineController("users-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.email(),
          }),
        },
        responses: {
          200: usersService.actions.create.output,
        },
        errors: {
          USER_ALREADY_EXISTS: UserExists,
          USER_RESERVED_DOMAIN: UserReserved,
          BEDROCK_VALIDATION_ERROR: ValidationOverride,
        },
        handler: usersService.actions.create,
      }),
    }),
  });

  const document = generateOpenApiDocument(
    {
      modules: [
        defineModule("users", {
          services: {
            users: usersService,
          },
          controllers: [controller],
        }),
      ],
      http: createFakeHttpAdapter(),
    },
    {
      info: {
        title: "Users API",
        version: "1.0.0",
      },
    },
  );

  const operation = document.paths["/api/users"]?.post;

  expect(operation?.responses["400"]).toMatchObject({
    description: "Invalid create payload",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: {
                  enum: ["BEDROCK_VALIDATION_ERROR"],
                },
              },
            },
          },
        },
      },
    },
  });
  expect(operation?.responses["409"]).toMatchObject({
    description: "Possible error codes: USER_EXISTS, USER_RESERVED",
    content: {
      "application/json": {
        schema: {
          oneOf: [
            {
              properties: {
                error: {
                  properties: {
                    code: {
                      enum: ["USER_EXISTS"],
                    },
                    details: {
                      type: "object",
                      required: ["email"],
                      properties: {
                        email: {
                          type: "string",
                          format: "email",
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              properties: {
                error: {
                  properties: {
                    code: {
                      enum: ["USER_RESERVED"],
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
  expect(operation?.responses["415"]).toMatchObject({
    description: "Unsupported media type",
  });
  expect(operation?.responses["500"]).toMatchObject({
    description:
      "Possible error codes: BEDROCK_HTTP_INTERNAL_ERROR, BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
    content: {
      "application/json": {
        schema: {
          oneOf: [
            {
              properties: {
                error: {
                  properties: {
                    code: {
                      enum: ["BEDROCK_HTTP_INTERNAL_ERROR"],
                    },
                  },
                },
              },
            },
            {
              properties: {
                error: {
                  properties: {
                    code: {
                      enum: ["BEDROCK_HTTP_ROUTE_CONTRACT_ERROR"],
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
});

test("excludes routes by OpenAPI path and tag", () => {
  const publicController = defineController("public-http", {
    basePath: "/public",
    routes: ({ route }) => ({
      list: route.get({
        path: "/",
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        summary: "List public items",
        tags: ["public"],
        handler: async () => ({ ok: true }) as const,
      }),
    }),
  });

  const docsController = defineController("docs-http", {
    basePath: "/docs",
    routes: ({ route }) => ({
      openapi: route.get({
        path: "/",
        responses: {
          200: z.object({
            version: z.string(),
          }),
        },
        tags: ["docs"],
        handler: async () => ({
          version: "1.0.0",
        }),
      }),
    }),
  });

  const document = generateOpenApiDocument(
    {
      modules: [
        defineModule("feature", {
          controllers: [publicController, docsController],
        }),
      ],
      http: createFakeHttpAdapter(),
    },
    {
      info: {
        title: "Feature API",
        version: "1.0.0",
      },
      excludePaths: ["/api/docs"],
      excludeTags: ["internal"],
    },
  );

  expect(Object.keys(document.paths)).toEqual(["/api/public"]);

  const byTag = generateOpenApiDocument(
    {
      modules: [
        defineModule("feature", {
          controllers: [publicController, docsController],
        }),
      ],
      http: createFakeHttpAdapter(),
    },
    {
      info: {
        title: "Feature API",
        version: "1.0.0",
      },
      excludeTags: ["docs"],
    },
  );

  expect(Object.keys(byTag.paths)).toEqual(["/api/public"]);
});

function createFakeHttpAdapter(): HttpAdapter {
  return {
    basePath: "/api",
    registerRoutes() {},
    async fetch() {
      return new Response("not implemented", {
        status: 500,
      });
    },
    async start() {},
    async stop() {},
  };
}

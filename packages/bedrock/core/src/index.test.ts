import { expect, test } from "bun:test";
import { z } from "zod";

import {
  BedrockError,
  LoggerToken,
  createApp,
  defineController,
  defineDomainError,
  defineHttpError,
  defineHttpMount,
  defineMiddleware,
  defineModule,
  defineProvider,
  defineService,
  defineWorker,
  defineWorkerTrigger,
  ExecutionContextToken,
  createRuntimeHttpRequestFromWebRequest,
  bedrockError,
  http,
  HttpRequestDataToken,
  HttpRouteMetaToken,
  inspectHttpRoutes,
  runtimeHttpResultToResponse,
  token,
  unwrapResult,
  webResponseToRuntimeHttpResult,
  type BoundHttpMount,
  type BoundHttpRoute,
  type HttpAdapter,
  type Logger,
  type RegisteredWorkerTrigger,
  type WorkerAdapter,
  type WorkerAdapterCapabilities,
  type WorkerAdapterDelivery,
  type WorkerDispatchOptions,
  type WorkerDispatchReceipt,
  type WorkerExecutionResult,
  type WorkerRuntimeBridge,
  type WorkerSourceDescriptor,
} from "./index";
import { createHttpExecutionContext } from "./execution-context";

type Clock = {
  now(): Date;
};

type UserRepo = {
  create(input: {
    email: string;
    createdAt: Date;
  }): Promise<{ id: string; email: string }>;
};

const ClockToken = token<Clock>("clock");
const RepoToken = token<UserRepo>("repo");
const LifecycleLoggerToken = token<Logger>("lifecycle-logger");
const ExampleLoggerToken = token<Logger>("example-logger");

function createTestLogger(onInfo?: (message: string) => void): Logger {
  return {
    debug() {},
    info(message) {
      onInfo?.(message);
    },
    warn() {},
    error() {},
  };
}

test("rejects duplicate module names", () => {
  const first = defineModule("user", {});
  const second = defineModule("user", {});

  expect(() =>
    createApp({
      modules: [first, second],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("rejects duplicate controller routes with the same method and full path", () => {
  const firstController = defineController("users-http-a", {
    basePath: "/users",
    routes: ({ route }) => ({
      getById: route.get({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
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
  });
  const secondController = defineController("users-http-b", {
    basePath: "/users",
    routes: ({ route }) => ({
      getById: route.get({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
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
  });

  expect(() =>
    createApp({
      modules: [
        defineModule("user", {
          controllers: [firstController, secondController],
        }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("allows duplicate full paths when HTTP methods differ", () => {
  const controller = defineController("users-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      read: route.get({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
          }),
        },
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () => ({ ok: true as const }),
      }),
      update: route.patch({
        path: "/:id",
        request: {
          params: z.object({
            id: z.string(),
          }),
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
  });

  const graph = createApp({
    modules: [
      defineModule("user", {
        controllers: [controller],
      }),
    ],
  }).inspect();

  expect(
    graph.routes.map((route) => ({
      method: route.method,
      fullPath: route.fullPath,
    })),
  ).toEqual([
    {
      method: "GET",
      fullPath: "/users/:id",
    },
    {
      method: "PATCH",
      fullPath: "/users/:id",
    },
  ]);
});

test("rejects module cycles", () => {
  const first = {
    kind: "module",
    name: "first",
    imports: [] as any[],
  };
  const second = {
    kind: "module",
    name: "second",
    imports: [first],
  };
  first.imports = [second];

  expect(() =>
    createApp({
      modules: [first as any],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("freezes tokens and Bedrock descriptors", () => {
  const TestToken = token<string>("value");
  const dispatchSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: "queue",
    input: z.object({
      userId: z.string(),
    }),
    config: {
      topic: "welcome-email",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ userId: z.ZodString }>,
    { topic: string }
  >;
  const ControllerPassThroughMiddleware = defineMiddleware<any, any, any>(
    "controller-pass-through",
    {
      run: async ({ next }) => next(),
    },
  );
  const provider = defineProvider({
    provide: TestToken,
    deps: {
      logger: LoggerToken,
    },
    useFactory: () => "value",
  });
  const service = defineService("user", {
    hooks: {
      onInit: ({ ctx: _ctx }) => {},
    },
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx: _ctx }) => ({ ok: true } as const),
      }),
    }),
  });
  const controller = defineController("user-http", {
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.string().email(),
          }),
        },
        responses: {
          200: service.actions.create.output,
        },
        handler: service.actions.create,
        tags: ["users"],
        middleware: [ControllerPassThroughMiddleware],
      }),
    }),
  });
  const worker = defineWorker("send-email", {
    payload: z.object({
      userId: z.string(),
    }),
    retry: {
      attempts: 3,
    },
    handler: async ({ ctx: _ctx, payload: _payload }) => {},
  });
  const workerTrigger = defineWorkerTrigger("send-email-dispatch", {
    source: dispatchSource,
    worker,
    retry: {
      attempts: 5,
    },
    tags: ["email"],
  });
  const module = defineModule("user", {
    imports: [defineModule("shared", {})],
    providers: [provider],
    services: {
      user: service,
    },
    controllers: [controller],
    workers: [worker],
    workerTriggers: [workerTrigger],
    exports: {
      user: service,
    },
    hooks: {
      onInit: () => {},
    },
  });

  expect(Object.isFrozen(TestToken)).toBe(true);
  expect(Object.isFrozen(provider)).toBe(true);
  expect(Object.isFrozen(provider.deps!)).toBe(true);
  expect(Object.isFrozen(service)).toBe(true);
  expect(Object.isFrozen(service.actions)).toBe(true);
  expect(Object.isFrozen(service.actions.create)).toBe(true);
  expect(Object.isFrozen(ControllerPassThroughMiddleware)).toBe(true);
  expect(Object.isFrozen(controller)).toBe(true);
  expect(Object.isFrozen(controller.routes)).toBe(true);
  expect(Object.isFrozen(controller.routes.create)).toBe(true);
  expect(Object.isFrozen(controller.routes.create!.tags!)).toBe(true);
  expect(Object.isFrozen(controller.routes.create!.middleware!)).toBe(true);
  expect(Object.isFrozen(worker)).toBe(true);
  expect(Object.isFrozen(worker.deps!)).toBe(true);
  expect(Object.isFrozen(worker.retry!)).toBe(true);
  expect(Object.isFrozen(workerTrigger)).toBe(true);
  expect(Object.isFrozen(workerTrigger.retry!)).toBe(true);
  expect(Object.isFrozen(workerTrigger.tags!)).toBe(true);
  expect(Object.isFrozen(module)).toBe(true);
  expect(Object.isFrozen(module.imports!)).toBe(true);
  expect(Object.isFrozen(module.providers!)).toBe(true);
  expect(Object.isFrozen(module.services!)).toBe(true);
  expect(Object.isFrozen(module.controllers!)).toBe(true);
  expect(Object.isFrozen(module.workers!)).toBe(true);
  expect(Object.isFrozen(module.workerTriggers!)).toBe(true);
  expect(Object.isFrozen(module.exports!)).toBe(true);
  expect(Object.isFrozen(module.hooks!)).toBe(true);
});

test("rejects unresolved provider dependencies", () => {
  const MissingToken = token<{ value: string }>("missing");
  const ValueToken = token<{ value: string }>("value");

  const app = createApp({
    modules: [
      defineModule("value", {
        providers: [
          defineProvider({
            provide: ValueToken,
            deps: {
              missing: MissingToken,
            },
            useFactory: ({ missing }) => missing,
          }),
        ],
      }),
    ],
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("rejects duplicate provider bindings", () => {
  const ValueToken = token<string>("value");

  const app = createApp({
    modules: [
      defineModule("value", {
        providers: [
          defineProvider({
            provide: ValueToken,
            useValue: "a",
          }),
        ],
      }),
    ],
    providers: [
      defineProvider({
        provide: ValueToken,
        useValue: "b",
      }),
    ],
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("resolves provider aliases and async factories", async () => {
  const BaseToken = token<{ value: string }>("base");
  const AliasToken = token<{ value: string }>("alias");
  const AsyncToken = token<{ result: string }>("async");

  const app = createApp({
    modules: [
      defineModule("providers", {
        providers: [
          defineProvider({
            provide: BaseToken,
            useValue: { value: "base" },
          }),
          defineProvider({
            provide: AliasToken,
            useExisting: BaseToken,
          }),
          defineProvider({
            provide: AsyncToken,
            deps: {
              alias: AliasToken,
            },
            useFactory: async ({ alias }) => ({
              result: `${alias.value}:async`,
            }),
          }),
        ],
      }),
    ],
  });

  await app.start();

  expect(app.get(AliasToken)).toBe(app.get(BaseToken));
  expect(app.get(AsyncToken)).toEqual({ result: "base:async" });
});

test("rejects provider alias cycles", () => {
  const FirstToken = token<string>("first");
  const SecondToken = token<string>("second");

  const app = createApp({
    modules: [
      defineModule("providers", {
        providers: [
          defineProvider({
            provide: FirstToken,
            useExisting: SecondToken,
          }),
          defineProvider({
            provide: SecondToken,
            useExisting: FirstToken,
          }),
        ],
      }),
    ],
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("disposes providers in reverse resolution order", async () => {
  const events: string[] = [];
  const FirstToken = token<{ name: string }>("first");
  const SecondToken = token<{ name: string }>("second");

  const app = createApp({
    modules: [
      defineModule("providers", {
        providers: [
          defineProvider({
            provide: FirstToken,
            useFactory: () => ({ name: "first" }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
          defineProvider({
            provide: SecondToken,
            deps: {
              first: FirstToken,
            },
            useFactory: ({ first }) => ({ name: `${first.name}-second` }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
        ],
      }),
    ],
  });

  await app.start();
  await app.stop();

  expect(events).toEqual(["dispose:first-second", "dispose:first"]);
});

test("rejects invalid provider scope capture rules", () => {
  const SingletonToken = token<string>("scope-singleton");
  const RequestToken = token<string>("scope-request");
  const TransientToken = token<string>("scope-transient");

  expect(() =>
    createApp({
      modules: [
        defineModule("invalid-singleton-request", {
          providers: [
            defineProvider({
              provide: RequestToken,
              scope: "request",
              useFactory: () => "request",
            }),
            defineProvider({
              provide: SingletonToken,
              scope: "singleton",
              deps: {
                request: RequestToken,
              },
              useFactory: ({ request }) => request,
            }),
          ],
        }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);

  expect(() =>
    createApp({
      modules: [
        defineModule("invalid-singleton-transient", {
          providers: [
            defineProvider({
              provide: TransientToken,
              scope: "transient",
              useFactory: () => "transient",
            }),
            defineProvider({
              provide: SingletonToken,
              scope: "singleton",
              deps: {
                transient: TransientToken,
              },
              useFactory: ({ transient }) => transient,
            }),
          ],
        }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);

  expect(() =>
    createApp({
      modules: [
        defineModule("invalid-request-transient", {
          providers: [
            defineProvider({
              provide: TransientToken,
              scope: "transient",
              useFactory: () => "transient",
            }),
            defineProvider({
              provide: RequestToken,
              scope: "request",
              deps: {
                transient: TransientToken,
              },
              useFactory: ({ transient }) => transient,
            }),
          ],
        }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("reuses request-scoped providers within one app.call and isolates them across calls", async () => {
  let nextId = 0;
  const RequestStateToken = token<{ id: number }>("request-state");

  const service = defineService("request-scope", {
    deps: {
      left: RequestStateToken,
      right: RequestStateToken,
    },
    ctx: ({ left, right }) => ({
      left,
      right,
    }),
    actions: ({ action }) => ({
      snapshot: action({
        output: z.object({
          left: z.number().int(),
          right: z.number().int(),
        }),
        handler: async ({ ctx }) => ({
          left: ctx.left.id,
          right: ctx.right.id,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("request-scope", {
        providers: [
          defineProvider({
            provide: RequestStateToken,
            scope: "request",
            useFactory: () => ({
              id: ++nextId,
            }),
          }),
        ],
        services: {
          "request-scope": service,
        },
      }),
    ],
  });

  await app.start();

  expect(unwrapResult(await app.call(service.actions.snapshot))).toEqual({
    left: 1,
    right: 1,
  });
  expect(unwrapResult(await app.call(service.actions.snapshot))).toEqual({
    left: 2,
    right: 2,
  });

  await app.stop();
});

test("reuses request-scoped providers across nested controller calls in one HTTP request", async () => {
  let nextId = 0;
  const RequestStateToken = token<{ id: number }>("http-request-state");

  const service = defineService("request-reader", {
    deps: {
      state: RequestStateToken,
    },
    ctx: ({ state }) => ({
      state,
    }),
    actions: ({ action }) => ({
      read: action({
        output: z.object({
          id: z.number().int(),
        }),
        handler: async ({ ctx }) => ({
          id: ctx.state.id,
        }),
      }),
    }),
  });

  const controller = defineController("request-http", {
    basePath: "/request",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: z.object({
            first: z.number().int(),
            second: z.number().int(),
          }),
        },
        handler: async ({ call }) => {
          const first = await call(service.actions.read);
          const second = await call(service.actions.read);

          return {
            first: first.id,
            second: second.id,
          };
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("request-http", {
        providers: [
          defineProvider({
            provide: RequestStateToken,
            scope: "request",
            useFactory: () => ({
              id: ++nextId,
            }),
          }),
        ],
        services: {
          "request-reader": service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const firstResponse = await app.fetch(new Request("http://test.local/api/request"));
  expect(await firstResponse.json()).toEqual({
    first: 1,
    second: 1,
  });

  const secondResponse = await app.fetch(new Request("http://test.local/api/request"));
  expect(await secondResponse.json()).toEqual({
    first: 2,
    second: 2,
  });

  await app.stop();
});

test("lazily creates request scope for controller ctx calls during HTTP requests", async () => {
  let nextId = 0;
  const RequestStateToken = token<{ id: number }>("http-request-state-ctx");

  const service = defineService("request-reader-from-ctx", {
    deps: {
      state: RequestStateToken,
    },
    ctx: ({ state }) => ({
      state,
    }),
    actions: ({ action }) => ({
      read: action({
        output: z.object({
          id: z.number().int(),
        }),
        handler: async ({ ctx }) => ({
          id: ctx.state.id,
        }),
      }),
    }),
  });

  const controller = defineController("request-http-ctx", {
    basePath: "/request-ctx",
    ctx: (_deps, { call }) => ({
      reads: (async () => {
        const first = await call(service.actions.read);
        const second = await call(service.actions.read);

        return [first, second] as const;
      })(),
    }),
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: z.object({
            first: z.number().int(),
            second: z.number().int(),
          }),
        },
        handler: async ({ ctx }) => {
          const [first, second] = await ctx.reads;

          return {
            first: first.id,
            second: second.id,
          };
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("request-http-ctx", {
        providers: [
          defineProvider({
            provide: RequestStateToken,
            scope: "request",
            useFactory: () => ({
              id: ++nextId,
            }),
          }),
        ],
        services: {
          "request-reader-from-ctx": service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const firstResponse = await app.fetch(new Request("http://test.local/api/request-ctx"));
  expect(await firstResponse.json()).toEqual({
    first: 1,
    second: 1,
  });

  const secondResponse = await app.fetch(new Request("http://test.local/api/request-ctx"));
  expect(await secondResponse.json()).toEqual({
    first: 2,
    second: 2,
  });

  await app.stop();
});

test("lazily materializes request data inside HTTP execution contexts", () => {
  const request = createRuntimeHttpRequestFromWebRequest(
    new Request("http://test.local/hello?tag=first", {
      headers: {
        "x-request-id": "req-1",
      },
    }),
  );
  const requestData = {
    params: {},
    query: {
      tag: "first",
    },
    headers: {
      "x-request-id": "req-1",
    },
    cookies: {},
    body: undefined,
  };
  let getRequestDataCalls = 0;
  const context = createHttpExecutionContext({
    request,
    getRequestData: () => {
      getRequestDataCalls += 1;
      return requestData;
    },
    route: {
      id: "route:test/http",
      controllerId: "controller:test/http",
      method: "GET",
      fullPath: "/hello",
      tags: [],
    },
  });

  expect(context.kind).toBe("http");
  expect(getRequestDataCalls).toBe(0);
  expect(context.http?.request.path).toBe("/hello");
  expect(context.http?.route.fullPath).toBe("/hello");
  expect(getRequestDataCalls).toBe(0);
  expect(context.http?.requestData).toBe(requestData);
  expect(context.http?.requestData).toBe(requestData);
  expect(getRequestDataCalls).toBe(1);
});

test("exposes execution-context tokens during HTTP requests and rejects HTTP-only tokens outside HTTP", async () => {
  const contextService = defineService("context-reader", {
    deps: {
      executionContext: ExecutionContextToken,
      requestData: HttpRequestDataToken,
      route: HttpRouteMetaToken,
    },
    ctx: ({ executionContext, requestData, route }) => ({
      executionContext,
      request:
        executionContext.kind === "http" && executionContext.http
          ? executionContext.http.request
          : undefined,
      requestData,
      route,
    }),
    actions: ({ action }) => ({
      inspect: action({
        output: z.object({
          kind: z.literal("http"),
          pathname: z.string(),
          method: z.string(),
          fullPath: z.string(),
          requestId: z.string(),
        }),
        handler: async ({ ctx }) => {
	          if (ctx.executionContext.kind !== "http") {
	            throw new Error("expected HTTP execution context");
	          }

	          if (!ctx.request) {
	            throw new Error("expected HTTP request");
	          }

	          return {
	            kind: "http" as const,
	            pathname: ctx.request.path,
	            method: ctx.route.method,
	            fullPath: ctx.route.fullPath,
	            requestId: ctx.requestData.headers["x-request-id"]!,
          };
        },
      }),
    }),
  });

  const controller = defineController("context-http", {
    basePath: "/context",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        request: {
          headers: z.object({
            "x-request-id": z.string().min(1),
          }),
        },
        responses: {
          200: z.object({
            kind: z.literal("http"),
            pathname: z.string(),
            method: z.string(),
            fullPath: z.string(),
            requestId: z.string(),
          }),
        },
        handler: async ({ call }) => call(contextService.actions.inspect),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("context", {
        services: {
          "context-reader": contextService,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/context", {
      headers: {
        "x-request-id": "req-123",
      },
    }),
  );

  expect(await response.json()).toEqual({
    kind: "http",
    pathname: "/api/context",
    method: "GET",
    fullPath: "/api/context",
    requestId: "req-123",
  });

  await expect(app.call(contextService.actions.inspect)).rejects.toMatchObject({
    code: "BEDROCK_EXECUTION_CONTEXT_UNAVAILABLE",
  });

  await app.stop();
});

test("preserves raw request data for execution-context tokens when route input is omitted", async () => {
  const contextService = defineService("raw-context-reader", {
    deps: {
      requestData: HttpRequestDataToken,
    },
    ctx: ({ requestData }) => ({
      requestData,
    }),
    actions: ({ action }) => ({
      inspect: action({
        output: z.object({
          queryTag: z.string(),
          requestId: z.string(),
          theme: z.string(),
          body: z.undefined(),
        }),
        handler: async ({ ctx }) => ({
          queryTag: ctx.requestData.query.tag as string,
          requestId: ctx.requestData.headers["x-request-id"]!,
          theme: ctx.requestData.cookies.theme!,
          body: ctx.requestData.body as undefined,
        }),
      }),
    }),
  });

  const controller = defineController("raw-context-http", {
    basePath: "/raw-context",
    routes: ({ route }) => ({
      inspect: route.get({
        path: "/",
        responses: {
          200: z.object({
            queryTag: z.string(),
            requestId: z.string(),
            theme: z.string(),
            body: z.undefined(),
          }),
        },
        handler: async ({ call }) => call(contextService.actions.inspect),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("raw-context", {
        services: {
          "raw-context-reader": contextService,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/raw-context?tag=core", {
      headers: {
        "x-request-id": "req-456",
        cookie: "theme=dark",
      },
    }),
  );

  expect(await response.json()).toEqual({
    queryTag: "core",
    requestId: "req-456",
    theme: "dark",
    body: undefined,
  });

  await app.stop();
});

test("reads web request bodies without cloning unless raw replay is requested", async () => {
  const payload = {
    name: "Ada",
  };
  const payloadJson = JSON.stringify(payload);
  let cloneCount = 0;

  const createHeaders = () => {
    const values = new Map([
      ["content-type", "application/json"],
      ["content-length", String(payloadJson.length)],
    ]);

    return {
      get(name: string) {
        return values.get(name.toLowerCase()) ?? null;
      },
      entries() {
        return values.entries();
      },
    };
  };

  const createRequest = (): Request & {
    bodyUsed: boolean;
    clone(): Request;
  } => {
    let bodyUsed = false;

    return {
      method: "POST",
      url: "http://test.local/items",
      headers: createHeaders(),
      get bodyUsed() {
        return bodyUsed;
      },
      clone() {
        cloneCount += 1;
        return createRequest();
      },
      async json() {
        bodyUsed = true;
        return payload;
      },
      async text() {
        bodyUsed = true;
        return payloadJson;
      },
      async arrayBuffer() {
        bodyUsed = true;
        return new TextEncoder().encode(payloadJson).buffer;
      },
      async formData() {
        throw new Error("form data is not used in this test");
      },
    } as never;
  };

  const runtimeRequest = createRuntimeHttpRequestFromWebRequest(createRequest() as never);
  const parsed = await runtimeRequest.readBody?.(
    http.body.json(
      z.object({
        name: z.string(),
      }),
    ),
  );

  expect(parsed).toEqual(payload);
  expect(cloneCount).toBe(0);
});

test("body-only routes do not normalize other request sections unless accessed", async () => {
  const registeredRoutes: BoundHttpRoute[] = [];
  const app = createApp({
    modules: [
      defineModule("body-only", {
        controllers: [
          defineController("body-only-http", {
            routes: ({ route }) => ({
              create: route.post({
                path: "/items",
                request: {
                  body: z.object({
                    name: z.string(),
                  }),
                },
                responses: {
                  200: z.object({
                    name: z.string(),
                  }),
                },
                handler: async ({ body }) => body,
              }),
            }),
          }),
        ],
      }),
    ],
    http: createFakeHttpAdapter({
      onRegister({ routes }) {
        registeredRoutes.push(...routes);
      },
    }),
  });

  await app.start();

  let queryReads = 0;
  let headersReads = 0;
  let cookiesReads = 0;
  const response = runtimeHttpResultToResponse(
    await registeredRoutes[0]!.execute({
      request: {
        method: "POST",
        url: "http://test.local/api/items",
        path: "/api/items",
        params: {},
        get query() {
          queryReads += 1;
          return {};
        },
        get headers() {
          headersReads += 1;
          return {};
        },
        get cookies() {
          cookiesReads += 1;
          return {};
        },
        readBody: async () => ({
          name: "Ada",
        }),
      },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    name: "Ada",
  });
  expect(queryReads).toBe(0);
  expect(headersReads).toBe(0);
  expect(cookiesReads).toBe(0);

  await app.stop();
});

test("registers raw HTTP mounts and dispatches them before validated routes", async () => {
  const registeredMounts: BoundHttpMount[] = [];
  const registeredRoutes: BoundHttpRoute[] = [];

  const app = createApp({
    modules: [
      defineModule("auth", {
        httpMounts: [
          defineHttpMount("better-auth", {
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
    http: createFakeHttpAdapter({
      onRegister({ routes, mounts }) {
        registeredRoutes.push(...routes);
        registeredMounts.push(...mounts);
      },
    }),
  });

  await app.start();

  expect(registeredRoutes).toHaveLength(0);
  expect(registeredMounts[0]?.fullPath).toBe("/api/auth");
  expect(app.inspect().routes).toEqual([]);

  const response = await app.fetch(
    new Request("http://test.local/api/auth/session"),
  );

  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({
    mounted: true,
    pathname: "/api/auth/session",
  });

  await app.stop();
});

test("preserves Set-Cookie headers when raw web mounts return a Response", async () => {
  const app = createApp({
    modules: [
      defineModule("auth", {
        httpMounts: [
          defineHttpMount("better-auth", {
            basePath: "/auth",
            handle: async () =>
              webResponseToRuntimeHttpResult(
                new Response(
                  JSON.stringify({
                    ok: true,
                  }),
                  {
                    status: 200,
                    headers: {
                      "content-type": "application/json",
                      "set-cookie": "session=abc123; Path=/; HttpOnly; SameSite=Lax",
                    },
                  },
                ),
              ),
          }),
        ],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/auth/session"),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("session=abc123");
  expect(response.headers.get("set-cookie")).not.toContain("set-cookie=");
  expect(await response.json()).toEqual({
    ok: true,
  });

  await app.stop();
});

test("creates fresh transient providers for each resolution", async () => {
  let nextId = 0;
  const TransientToken = token<{ id: number }>("transient-state");

  const service = defineService("transient-scope", {
    deps: {
      left: TransientToken,
      right: TransientToken,
    },
    ctx: ({ left, right }) => ({
      left,
      right,
    }),
    actions: ({ action }) => ({
      snapshot: action({
        output: z.object({
          left: z.number().int(),
          right: z.number().int(),
        }),
        handler: async ({ ctx }) => ({
          left: ctx.left.id,
          right: ctx.right.id,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("transient-scope", {
        providers: [
          defineProvider({
            provide: TransientToken,
            scope: "transient",
            useFactory: () => ({
              id: ++nextId,
            }),
          }),
        ],
        services: {
          "transient-scope": service,
        },
      }),
    ],
  });

  await app.start();

  expect(unwrapResult(await app.call(service.actions.snapshot))).toEqual({
    left: 1,
    right: 2,
  });

  await app.stop();
});

test("disposes transient providers at scope end in reverse order", async () => {
  const events: string[] = [];
  const FirstToken = token<{ name: string }>("transient-first");
  const SecondToken = token<{ name: string }>("transient-second");

  const service = defineService("transient-dispose", {
    deps: {
      second: SecondToken,
    },
    ctx: ({ second }) => ({
      second,
    }),
    actions: ({ action }) => ({
      run: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () => ({
          ok: true as const,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("transient-dispose", {
        providers: [
          defineProvider({
            provide: FirstToken,
            scope: "transient",
            useFactory: () => ({ name: "first" }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
          defineProvider({
            provide: SecondToken,
            scope: "transient",
            deps: {
              first: FirstToken,
            },
            useFactory: ({ first }) => ({ name: `${first.name}-second` }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
        ],
        services: {
          "transient-dispose": service,
        },
      }),
    ],
  });

  await app.start();
  await app.call(service.actions.run);
  await app.stop();

  expect(events).toEqual(["dispose:first-second", "dispose:first"]);
});

test("disposes request-scoped providers at scope end in reverse order", async () => {
  const events: string[] = [];
  const FirstToken = token<{ name: string }>("request-first");
  const SecondToken = token<{ name: string }>("request-second");

  const service = defineService("request-dispose", {
    deps: {
      second: SecondToken,
    },
    ctx: ({ second }) => ({
      second,
    }),
    actions: ({ action }) => ({
      run: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () => ({
          ok: true as const,
        }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("request-dispose", {
        providers: [
          defineProvider({
            provide: FirstToken,
            scope: "request",
            useFactory: () => ({ name: "first" }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
          defineProvider({
            provide: SecondToken,
            scope: "request",
            deps: {
              first: FirstToken,
            },
            useFactory: ({ first }) => ({ name: `${first.name}-second` }),
            dispose: (value) => {
              events.push(`dispose:${value.name}`);
            },
          }),
        ],
        services: {
          "request-dispose": service,
        },
      }),
    ],
  });

  await app.start();
  await app.call(service.actions.run);
  await app.stop();

  expect(events).toEqual(["dispose:first-second", "dispose:first"]);
});

test("rejects app.get() for non-singleton providers", async () => {
  const RequestToken = token<string>("request-get");
  const TransientToken = token<string>("transient-get");

  const app = createApp({
    modules: [
      defineModule("scoped-get", {
        providers: [
          defineProvider({
            provide: RequestToken,
            scope: "request",
            useFactory: () => "request",
          }),
          defineProvider({
            provide: TransientToken,
            scope: "transient",
            useFactory: () => "transient",
          }),
        ],
      }),
    ],
  });

  await app.start();

  expect(() => app.get(RequestToken)).toThrow(BedrockError);
  expect(() => app.get(TransientToken)).toThrow(BedrockError);

  await app.stop();
});

test("rejects service lifecycle hooks for services with non-singleton dependencies", () => {
  const RequestToken = token<{ id: number }>("hook-request");

  const service = defineService("hooked", {
    deps: {
      state: RequestToken,
    },
    hooks: {
      onInit: ({ ctx: _ctx }) => {},
    },
    actions: ({ action }) => ({
      ping: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx: _ctx }) => ({ ok: true } as const),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("hooked", {
        providers: [
          defineProvider({
            provide: RequestToken,
            scope: "request",
            useFactory: () => ({ id: 1 }),
          }),
        ],
        services: {
          hooked: service,
        },
      }),
    ],
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("validates action input and output", async () => {
  const service = defineService("math", {
    actions: ({ action }) => ({
      double: action({
        input: z.object({
          value: z.number().int(),
        }),
        output: z.object({
          value: z.number().int(),
        }),
        handler: async ({ input }) => ({
          value: input.value * 2,
        }),
      }),
      invalid: action({
        input: z.object({}),
        output: z.object({
          value: z.number().int(),
        }),
        handler: async () =>
          ({
            value: "not-a-number",
          } as unknown as { value: number }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("math", {
        services: {
          math: service,
        },
      }),
    ],
  });

  await app.start();

  const doubled = await app.call(service.actions.double, {
    value: 2,
  });

  expect(unwrapResult(doubled)).toEqual({ value: 4 });

  await expect(
    app.call(service.actions.double, {
      value: 2.5,
    }),
  ).rejects.toBeInstanceOf(BedrockError);

  await expect(app.call(service.actions.invalid, {})).rejects.toBeInstanceOf(
    BedrockError,
  );
});

test("runs controller middleware in order", async () => {
  const events: string[] = [];

  const service = defineService("math", {
    actions: ({ action }) => ({
      double: action({
        input: z.object({
          value: z.number().int(),
        }),
        output: z.object({
          value: z.number().int(),
        }),
        handler: async ({ input }) => ({
          value: input.value * 2,
        }),
      }),
    }),
  });

  const DoubleBody = z.object({
    value: z.number().int(),
  });
  const DoubleResponse = z.object({
    value: z.number().int(),
  });

  const Middleware = defineMiddleware<
    any,
    {
      body: typeof DoubleBody;
    },
    {
      200: typeof DoubleResponse;
    }
  >("math-audit", {
    run: async ({ request, next }) => {
      events.push(`before:${request.body.value}`);
      const result = await next();
      if (!("value" in result)) {
        throw new Error("expected a plain route result");
      }
      events.push(`after:${result.value}`);
      return result;
    },
  });

  const controller = defineController("math-http", {
    basePath: "/math",
    routes: ({ route }) => ({
      double: route.post({
        path: "/double",
        request: {
          body: DoubleBody,
        },
        responses: {
          200: DoubleResponse,
        },
        handler: service.actions.double,
        middleware: [Middleware],
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("math", {
        services: {
          math: service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/math/double", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: 2,
      }),
    }),
  );

  expect(await response.json()).toEqual({ value: 4 });
  expect(events).toEqual(["before:2", "after:4"]);

  await app.stop();
});

test("applies response header and cookie mutations without changing route results", async () => {
  const controller = defineController("response-http", {
    basePath: "/response",
    routes: ({ route }) => ({
      create: route.get({
        path: "/",
        responses: {
          201: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () =>
          http.reply.status(201, {
            ok: true as const,
          }, {
            headers: {
              "x-test": "1",
              "x-multi": ["a", "b"],
            },
            cookies: [
              {
                kind: "set" as const,
                name: "session",
                value: "abc",
                options: {
                  httpOnly: true,
                  path: "/",
                },
              },
            ],
          }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("response", {
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/response"),
  );

  expect(response.status).toBe(201);
  expect(response.headers.get("x-test")).toBe("1");
  expect(response.headers.get("x-multi")).toContain("a");
  expect(response.headers.get("x-multi")).toContain("b");
  expect(response.headers.get("set-cookie")).toContain("session=abc");
  expect(await response.json()).toEqual({
    ok: true,
  });

  await app.stop();
});

test("supports raw HTTP responses", async () => {
  const controller = defineController("raw-http", {
    basePath: "/raw",
    routes: ({ route }) => ({
      docs: route.get({
        path: "/docs",
        responses: {
          200: http.response.raw({
            contentType: "text/html; charset=utf-8",
          }),
        },
        handler: async () =>
          http.reply.raw("<html>ok</html>", {
            status: 200,
            contentType: "text/html; charset=utf-8",
            headers: {
              "x-test": "1",
            },
          }),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("raw", {
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  const response = await app.fetch(
    new Request("http://test.local/api/raw/docs"),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("x-test")).toBe("1");
  expect(await response.text()).toBe("<html>ok</html>");

  await app.stop();
});

test("supports omitted action inputs and controller call helpers", async () => {
  const events: string[] = [];

  const service = defineService("utility", {
    actions: ({ action }) => ({
      ping: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () => ({
          ok: true as const,
        }),
      }),
      explicitPing: action({
        input: z.undefined(),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () => ({
          ok: true as const,
        }),
      }),
      flush: action({
        handler: async () => {
          events.push("flush");
          return undefined;
        },
      }),
      log: action({
        input: z.object({
          value: z.string().min(1),
        }),
        handler: async ({ input }) => {
          events.push(`log:${input.value}`);
          return undefined;
        },
      }),
    }),
  });

  const controller = defineController("utility-http", {
    routes: ({ route }) => ({
      health: route.get({
        path: "/health",
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async ({ ctx: _ctx, call }) => call(service.actions.ping),
      }),
      relay: route.post({
        path: "/relay",
        request: {
          body: z.object({
            value: z.string().min(1),
          }),
        },
        responses: {
          204: http.response.empty(),
        },
        handler: async ({ request, call }) => {
          await call(service.actions.log, {
            value: request.body.value,
          });

          return undefined;
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("utility", {
        services: {
          utility: service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  await app.start();

  expect(unwrapResult(await app.call(service.actions.ping))).toEqual({ ok: true });
  expect(unwrapResult(await app.call(service.actions.explicitPing))).toEqual({
    ok: true,
  });
  expect(unwrapResult(await app.call(service.actions.flush))).toBeUndefined();
  expect(unwrapResult(await app.call(service.actions.log, { value: "hello" }))).toBeUndefined();
  expect(events).toEqual(["flush", "log:hello"]);

  const response = await app.fetch(new Request("http://test.local/api/health"));
  expect(await response.json()).toEqual({ ok: true });

  const relayResponse = await app.fetch(
    new Request("http://test.local/api/relay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "from-route",
      }),
    }),
  );
  expect(relayResponse.status).toBe(204);
  expect(await relayResponse.text()).toBe("");
  expect(events).toEqual(["flush", "log:hello", "log:from-route"]);
});

test("derives service context and runs service and module lifecycle hooks", async () => {
  const lifecycle: string[] = [];

  const service = defineService("user", {
    deps: {
      clock: ClockToken,
    },
    ctx: ({ clock }) => ({
      now: () => clock.now(),
    }),
    hooks: {
      onInit: ({ ctx }) => {
        lifecycle.push(`service:init:${ctx.now().toISOString()}`);
      },
      onDispose: ({ ctx }) => {
        lifecycle.push(`service:dispose:${ctx.now().toISOString()}`);
      },
    },
    actions: ({ action }) => ({
      log: action({
        input: z.object({
          message: z.string().min(1),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx, input }) => {
          ctx.logger.info(input.message);
          return { ok: true as const };
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("user", {
        services: {
          user: service,
        },
        hooks: {
          onInit: () => {
            lifecycle.push("module:init");
          },
          onDispose: () => {
            lifecycle.push("module:dispose");
          },
        },
      }),
    ],
    logger: {
      source: {
        type: "provider",
        token: LifecycleLoggerToken,
      },
    },
    providers: [
      defineProvider({
        provide: LifecycleLoggerToken,
        useValue: createTestLogger((message) => {
          lifecycle.push(`log:${message}`);
        }),
      }),
      defineProvider({
        provide: ClockToken,
        useValue: {
          now: () => new Date("2026-03-09T12:00:00.000Z"),
        },
      }),
    ],
  });

  await app.start();
  await app.call(service.actions.log, { message: "hello" });
  await app.stop();

  expect(lifecycle).toEqual([
    "log:bedrock.app.start.begin",
    "service:init:2026-03-09T12:00:00.000Z",
    "module:init",
    "log:bedrock.app.start.success",
    "log:hello",
    "log:bedrock.app.stop.begin",
    "module:dispose",
    "service:dispose:2026-03-09T12:00:00.000Z",
    "log:bedrock.app.stop.success",
  ]);
});

test("rejects worker triggers without configured worker adapters", () => {
  const worker = defineWorker("welcome-email", {
    payload: z.object({
      userId: z.string(),
    }),
    handler: async ({ ctx: _ctx, payload: _payload }) => {},
  });
  const workerTrigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: {
      kind: "worker-source",
      trigger: "dispatch",
      adapter: "missing",
      input: z.object({
        userId: z.string(),
      }),
      config: {
        topic: "welcome-email",
      },
    },
    worker,
  });

  expect(() =>
    createApp({
      modules: [
        defineModule("user", {
          workers: [worker],
          workerTriggers: [workerTrigger],
        }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("rejects duplicate worker adapters", () => {
  expect(() =>
    createApp({
      modules: [],
      workerAdapters: [
        createFakeWorkerAdapter({ name: "queue" }),
        createFakeWorkerAdapter({ name: "queue" }),
      ],
    }).inspect(),
  ).toThrow(BedrockError);
});

test("dispatches worker triggers and executes worker deliveries", async () => {
  const AuditToken = token<{ write(message: string): void }>("audit");
  const lifecycle: string[] = [];
  const workerAdapter = createFakeWorkerAdapter({
    onDispatch({ triggerId, options }) {
      lifecycle.push(`dispatch:${triggerId}:${options?.messageId ?? "auto"}`);
    },
  });
  const workerSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: workerAdapter.name,
    input: z.object({
      value: z.string(),
    }),
    config: {
      topic: "audit",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ value: z.ZodString }>,
    { topic: string }
  >;

  const auditService = defineService("audit", {
    deps: {
      audit: AuditToken,
    },
    ctx: ({ audit }) => ({ audit }),
    actions: ({ action }) => ({
      write: action({
        input: z.object({
          value: z.string(),
        }),
        handler: async ({ ctx, input }) => {
          ctx.audit.write(`service:${input.value}`);
          return undefined;
        },
      }),
    }),
  });

  const auditWorker = defineWorker("audit-worker", {
    deps: {
      audit: AuditToken,
    },
    ctx: ({ audit }, { call, dispatch }) => ({
      audit,
      call,
      dispatch,
    }),
    payload: z.object({
      value: z.string(),
    }),
    handler: async ({ ctx, payload, delivery, heartbeat }) => {
      await heartbeat();
      ctx.audit.write(`worker:${payload.value}:${delivery.messageId}`);
      await ctx.call(auditService.actions.write, {
        value: payload.value,
      });
      await ctx.dispatch(auditDispatchTrigger, {
        value: `${payload.value}:fanout`,
      }, {
        messageId: "fanout-1",
      });
    },
  });

  const auditDispatchTrigger = defineWorkerTrigger("audit-dispatch", {
    source: workerSource,
    worker: auditWorker,
    tags: ["audit"],
  });

  const app = createApp({
    modules: [
      defineModule("audit", {
        providers: [
          defineProvider({
            provide: AuditToken,
            useValue: {
              write(message: string) {
                lifecycle.push(message);
              },
            },
          }),
        ],
        services: {
          audit: auditService,
        },
        workers: [auditWorker],
        workerTriggers: [auditDispatchTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  expect(app.resolveWorkerTrigger(auditDispatchTrigger)).toMatchObject({
    id: "worker-trigger:audit/audit-dispatch",
    name: "audit-dispatch",
    adapter: workerAdapter.name,
    trigger: "dispatch",
  });

  await app.start();

  expect(workerAdapter.getRegisteredTriggers()).toHaveLength(1);
  expect(workerAdapter.getRegisteredTriggers()[0]?.id).toBe(
    "worker-trigger:audit/audit-dispatch",
  );

  const receipt = await app.dispatch(
    auditDispatchTrigger,
    { value: "alpha" },
    { messageId: "dispatch-1" },
  );
  expect(receipt).toMatchObject({
    triggerId: "worker-trigger:audit/audit-dispatch",
    messageId: "dispatch-1",
    adapter: workerAdapter.name,
  });

  const result = await workerAdapter.deliver({
    triggerId: receipt.triggerId,
    input: {
      value: "alpha",
    },
    messageId: "delivery-1",
    attempt: 1,
    heartbeat: async () => {
      lifecycle.push("heartbeat");
    },
  });

  expect(result).toEqual({ disposition: "ack" });
  expect(lifecycle).toEqual([
    "dispatch:worker-trigger:audit/audit-dispatch:dispatch-1",
    "heartbeat",
    "worker:alpha:delivery-1",
    "service:alpha",
    "dispatch:worker-trigger:audit/audit-dispatch:fanout-1",
  ]);

  await app.stop();
});

test("rejects invalid worker deliveries and retries failed handlers until attempts are exhausted", async () => {
  const workerAdapter = createFakeWorkerAdapter();
  const workerSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: workerAdapter.name,
    input: z.object({
      value: z.string(),
    }),
    config: {
      topic: "flaky",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ value: z.ZodString }>,
    { topic: string }
  >;
  const worker = defineWorker("flaky-worker", {
    payload: z.object({
      value: z.string(),
    }),
    retry: {
      attempts: 3,
      backoffMs: 25,
    },
    handler: async ({ payload }) => {
      if (payload.value !== "ok") {
        throw new Error("boom");
      }
    },
  });
  const workerTrigger = defineWorkerTrigger("flaky-dispatch", {
    source: workerSource,
    worker,
  });
  const app = createApp({
    modules: [
      defineModule("flaky", {
        workers: [worker],
        workerTriggers: [workerTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await expect(
    workerAdapter.deliver({
      triggerId: "worker-trigger:flaky/flaky-dispatch",
      input: {
        value: 1,
      },
      messageId: "invalid-1",
      attempt: 1,
    }),
  ).resolves.toEqual({
    disposition: "reject",
  });

  await expect(
    workerAdapter.deliver({
      triggerId: "worker-trigger:flaky/flaky-dispatch",
      input: {
        value: "boom",
      },
      messageId: "retry-1",
      attempt: 1,
    }),
  ).resolves.toEqual({
    disposition: "retry",
    delayMs: 25,
  });

  await expect(
    workerAdapter.deliver({
      triggerId: "worker-trigger:flaky/flaky-dispatch",
      input: {
        value: "boom",
      },
      messageId: "retry-3",
      attempt: 3,
    }),
  ).resolves.toEqual({
    disposition: "reject",
  });

  await app.stop();
});

test("creates and disposes request-scoped providers for worker deliveries", async () => {
  const lifecycle: string[] = [];
  const RequestToken = token<{ id: string }>("request-value");
  let counter = 0;
  const workerAdapter = createFakeWorkerAdapter();
  const workerSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: workerAdapter.name,
    input: z.object({
      value: z.string(),
    }),
    config: {
      topic: "request",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ value: z.ZodString }>,
    { topic: string }
  >;
  const worker = defineWorker("request-worker", {
    deps: {
      request: RequestToken,
    },
    ctx: ({ request }) => ({ request }),
    payload: z.object({
      value: z.string(),
    }),
    handler: async ({ ctx, payload }) => {
      lifecycle.push(`worker:${payload.value}:${ctx.request.id}`);
    },
  });
  const workerTrigger = defineWorkerTrigger("request-dispatch", {
    source: workerSource,
    worker,
  });
  const app = createApp({
    modules: [
      defineModule("request", {
        providers: [
          defineProvider({
            provide: RequestToken,
            scope: "request",
            useFactory: () => {
              counter += 1;
              return { id: `request-${counter}` };
            },
            dispose: (value) => {
              lifecycle.push(`dispose:${value.id}`);
            },
          }),
        ],
        workers: [worker],
        workerTriggers: [workerTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await expect(
    workerAdapter.deliver({
      triggerId: "worker-trigger:request/request-dispatch",
      input: {
        value: "first",
      },
      messageId: "request-1",
      attempt: 1,
    }),
  ).resolves.toEqual({
    disposition: "ack",
  });

  await expect(
    workerAdapter.deliver({
      triggerId: "worker-trigger:request/request-dispatch",
      input: {
        value: "second",
      },
      messageId: "request-2",
      attempt: 1,
    }),
  ).resolves.toEqual({
    disposition: "ack",
  });

  expect(lifecycle).toEqual([
    "worker:first:request-1",
    "dispose:request-1",
    "worker:second:request-2",
    "dispose:request-2",
  ]);

  await app.stop();
});

test("inspects stable graph ids for modules, providers, services, controllers, routes, and workers", () => {
  const AuditToken = token<{ write(message: string): void }>("audit");
  const workerAdapter = createFakeWorkerAdapter();
  const workerSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: workerAdapter.name,
    input: z.object({
      userId: z.string(),
    }),
    config: {
      topic: "welcome-email",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ userId: z.ZodString }>,
    { topic: string }
  >;

  const service = defineService("user", {
    deps: {
      audit: AuditToken,
    },
    ctx: ({ audit }) => ({ audit }),
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx, input }) => {
          ctx.audit.write(input.email);
          return { ok: true as const };
        },
      }),
    }),
  });

  const controller = defineController("user-http", {
    basePath: "/users",
    deps: {
      audit: AuditToken,
    },
    ctx: ({ audit }, { call }) => ({
      audit,
      create: (input: { email: string }) => call(service.actions.create, input),
    }),
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.string().email(),
          }),
        },
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async ({ ctx, request }) => {
          ctx.audit.write(request.body.email);
          return ctx.create(request.body);
        },
      }),
    }),
  });

  const worker = defineWorker("welcome-email", {
    deps: {
      audit: AuditToken,
    },
    ctx: ({ audit }) => ({ audit }),
    payload: z.object({
      userId: z.string(),
    }),
    handler: async ({ ctx, payload }) => {
      ctx.audit.write(payload.userId);
    },
  });
  const workerTrigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: workerSource,
    worker,
    tags: ["email"],
  });

  const graph = createApp({
    modules: [
      defineModule("user", {
        providers: [
          defineProvider({
            provide: AuditToken,
            useValue: {
              write() {},
            },
          }),
        ],
        services: {
          user: service,
        },
        controllers: [controller],
        workers: [worker],
        workerTriggers: [workerTrigger],
        exports: {
          userService: service,
        },
      }),
    ],
    workerAdapters: [workerAdapter],
  }).inspect();

  expect(graph.modules[0]).toEqual({
    id: "module:user",
    name: "user",
    importIds: [],
    providerIds: ["token:audit"],
    serviceIds: ["service:user/user"],
    controllerIds: ["controller:user/user-http"],
    workerIds: ["worker:user/welcome-email"],
    workerTriggerIds: ["worker-trigger:user/welcome-email-dispatch"],
    exportKeys: ["userService"],
  });
  expect(graph.providers[0]?.id).toBe("token:audit");
  expect(graph.services[0]?.id).toBe("service:user/user");
  expect(graph.actions[0]?.id).toBe("action:user/user/create");
  expect(graph.controllers[0]?.id).toBe("controller:user/user-http");
  expect(graph.routes[0]?.id).toBe("route:user/user-http/create");
  expect(graph.routes[0]?.fullPath).toBe("/users");
  expect(graph.routes[0]?.tags).toEqual([]);
  expect(graph.workers[0]?.id).toBe("worker:user/welcome-email");
  expect(graph.workerTriggers[0]?.id).toBe("worker-trigger:user/welcome-email-dispatch");
  expect(graph.workerTriggers[0]?.workerId).toBe("worker:user/welcome-email");
});

test("adds adapter base paths to inspected HTTP routes", () => {
  const http = createFakeHttpAdapter();
  const controller = defineController("user-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.string().email(),
          }),
        },
        responses: {
          200: z.object({
            ok: z.boolean(),
          }),
        },
        tags: ["users"],
        handler: async ({ request }) => ({
          ok: request.body.email === "ada@example.com",
        }),
      }),
    }),
  });

  const graph = createApp({
    modules: [
      defineModule("user", {
        controllers: [controller],
      }),
    ],
    http,
  }).inspect();

  expect(graph.routes[0]).toMatchObject({
    fullPath: "/api/users",
    tags: ["users"],
  });
});

test("inspects HTTP routes with schemas and adapter base paths", () => {
  const GetUserRouteRequest = {
    params: z.object({
      id: z.string(),
    }),
    query: z.object({
      expand: z.string().optional(),
    }),
    headers: z.object({
      "x-request-id": z.string().optional(),
    }),
  };
  const GetUserRouteOutput = z.object({
    id: z.string(),
    email: z.string().email(),
  });

  const controller = defineController("user-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      getById: route.get({
        path: "/:id",
        request: GetUserRouteRequest,
        responses: {
          200: GetUserRouteOutput,
        },
        summary: "Get a user",
        tags: ["users"],
        handler: async ({ ctx: _ctx, request }) => ({
          id: request.params.id,
          email: "ada@example.com",
        }),
      }),
    }),
  });

  const routes = inspectHttpRoutes({
    modules: [
      defineModule("user", {
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  expect(routes).toHaveLength(1);
  expect(routes[0]).toMatchObject({
    id: "route:user/user-http/getById",
    moduleId: "module:user",
    moduleName: "user",
    controllerId: "controller:user/user-http",
    controllerName: "user-http",
    routeName: "getById",
    method: "GET",
    path: "/:id",
    fullPath: "/api/users/:id",
    summary: "Get a user",
    tags: ["users"],
  });
  expect(routes[0]?.request).toMatchObject({
    params: GetUserRouteRequest.params,
    query: GetUserRouteRequest.query,
    headers: GetUserRouteRequest.headers,
  });
  expect(routes[0]?.responses[200]?.schema).toBe(GetUserRouteOutput);
});

test("inspects normalized route error contracts", () => {
  const DuplicateUserDetails = z.object({
    email: z.string().email(),
  });
  const DuplicateUser = defineDomainError("DUPLICATE_USER", {
    details: DuplicateUserDetails,
  });
  const UserExists = defineHttpError("USER_EXISTS", {
    status: 409,
    description: "User already exists",
    details: DuplicateUserDetails,
  });
  const ValidationOverride = defineHttpError("BEDROCK_VALIDATION_ERROR", {
    status: 400,
    description: "Bad create request",
  });
  const service = defineService("user", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        errors: [DuplicateUser],
        handler: async () => ({ ok: true as const }),
      }),
    }),
  });

  const controller = defineController("user-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.string().email(),
          }),
        },
        responses: {
          200: service.actions.create.output,
        },
        errors: {
          DUPLICATE_USER: UserExists,
          BEDROCK_VALIDATION_ERROR: ValidationOverride,
        },
        handler: service.actions.create,
      }),
    }),
  });

  const routes = inspectHttpRoutes({
    modules: [
      defineModule("user", {
        services: {
          user: service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  expect(routes[0]?.errors.map((error) => ({
    code: error.code,
    status: error.status,
    source: error.source,
  }))).toEqual([
    {
      code: "USER_EXISTS",
      status: 409,
      source: "declared",
    },
    {
      code: "BEDROCK_VALIDATION_ERROR",
      status: 400,
      source: "declared",
    },
    {
      code: "BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE",
      status: 415,
      source: "implicit",
    },
    {
      code: "BEDROCK_HTTP_INTERNAL_ERROR",
      status: 500,
      source: "implicit",
    },
    {
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      status: 500,
      source: "implicit",
    },
  ]);
  expect(routes[0]?.errors[0]?.details).toBe(DuplicateUserDetails);
  expect(routes[0]?.errors[1]?.description).toBe("Bad create request");
});

test("rejects reserved route errors with invalid status overrides", () => {
  const InvalidValidationError = defineHttpError("BEDROCK_VALIDATION_ERROR", {
    status: 422,
  });

  const controller = defineController("user-http", {
    routes: ({ route }) => ({
      create: route.get({
        path: "/",
        responses: {
          200: z.object({}),
        },
        errors: {
          BEDROCK_VALIDATION_ERROR: InvalidValidationError,
        },
        handler: async () => ({}),
      }),
    }),
  });

  expect(() =>
    inspectHttpRoutes({
      modules: [
        defineModule("user", {
          controllers: [controller],
        }),
      ],
    }),
  ).toThrow(BedrockError);
});

test("rejects reserved route errors with declared details schemas", () => {
  const InvalidInternalError = defineHttpError("BEDROCK_HTTP_INTERNAL_ERROR", {
    status: 500,
    details: z.object({
      reason: z.string(),
    }),
  });

  const controller = defineController("user-http", {
    routes: ({ route }) => ({
      create: route.get({
        path: "/",
        responses: {
          200: z.object({}),
        },
        errors: {
          BEDROCK_HTTP_INTERNAL_ERROR: InvalidInternalError,
        },
        handler: async () => ({}),
      }),
    }),
  });

  expect(() =>
    inspectHttpRoutes({
      modules: [
        defineModule("user", {
          controllers: [controller],
        }),
      ],
    }),
  ).toThrow(BedrockError);
});

test("rejects conflicting route error contracts for the same public code", () => {
  const UserExists = defineHttpError("USER_EXISTS", {
    status: 409,
  });
  const UserExistsGone = defineHttpError("USER_EXISTS", {
    status: 410,
  });

  const controller = defineController("user-http", {
    routes: ({ route }) => ({
      create: route.get({
        path: "/",
        responses: {
          200: z.object({}),
        },
        errors: {
          FIRST: UserExists,
          SECOND: UserExistsGone,
        },
        handler: async () => ({}),
      }),
    }),
  });

  expect(() =>
    inspectHttpRoutes({
      modules: [
        defineModule("user", {
          controllers: [controller],
        }),
      ],
    }),
  ).toThrow(BedrockError);
});

test("normalizes plain request body schemas during HTTP route inspection", () => {
  const CreateBody = z.object({
    email: z.string().email(),
  });
  const controller = defineController("bad-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: CreateBody,
        },
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () => ({ ok: true } as const),
      }),
    }),
  });

  const routes = inspectHttpRoutes({
    modules: [
      defineModule("user", {
        controllers: [controller],
      }),
    ],
  });

  expect(routes[0]?.request.body).toMatchObject({
    kind: "json",
    schema: CreateBody,
  });
});

test("rejects invalid request body descriptors when HTTP is configured", () => {
  const controller = defineController("bad-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: {
            kind: "invalid",
          } as never,
        },
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () => ({ ok: true } as const),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("user", {
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("rejects action-bound routes without select when the HTTP envelope is ambiguous", () => {
  const service = defineService("users", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.boolean(),
        }),
        handler: async ({ input }) => ({
          ok: input.email === "ada@example.com",
        }),
      }),
    }),
  });

  const controller = defineController("user-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post(
        {
          path: "/",
          request: {
            query: z.object({
              email: z.string().email().optional(),
            }),
            body: z.object({
              email: z.string().email(),
            }),
          },
          responses: {
            200: service.actions.create.output,
          },
          handler: service.actions.create,
        } as never,
      ),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("user", {
        services: {
          users: service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter(),
  });

  expect(() => app.inspect()).toThrow(BedrockError);
});

test("registers action-bound HTTP routes and stops the adapter before teardown", async () => {
  const lifecycle: string[] = [];
  const registeredRoutes: BoundHttpRoute[] = [];

  const service = defineService("users", {
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.boolean(),
        }),
        handler: async ({ input }) => ({
          ok: input.email === "ada@example.com",
        }),
      }),
    }),
  });

  const http = createFakeHttpAdapter({
    onRegister({ routes }) {
      lifecycle.push("adapter:register");
      registeredRoutes.push(...routes);
    },
    onStart() {
      lifecycle.push("adapter:start");
    },
    onStop() {
      lifecycle.push("adapter:stop");
    },
  });

  const controller = defineController("user-http", {
    basePath: "/users",
    routes: ({ route }) => ({
      create: route.post({
        path: "/",
        request: {
          body: z.object({
            email: z.string().email(),
          }),
        },
        responses: {
          200: service.actions.create.output,
        },
        handler: service.actions.create,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("user", {
        services: {
          users: service,
        },
        controllers: [controller],
        hooks: {
          onInit: () => {
            lifecycle.push("module:init");
          },
          onDispose: () => {
            lifecycle.push("module:dispose");
          },
        },
      }),
    ],
    http,
  });

  await app.start();
  expect(lifecycle).toEqual(["module:init", "adapter:register", "adapter:start"]);
  expect(registeredRoutes[0]?.fullPath).toBe("/api/users");

  const response = await app.fetch(
    new Request("http://test.local/api/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "ada@example.com",
      }),
    }),
  );

  expect(await response.json()).toEqual({ ok: true });

  await app.stop();
  expect(lifecycle).toEqual([
    "module:init",
    "adapter:register",
    "adapter:start",
    "adapter:stop",
    "module:dispose",
  ]);
});

test("enforces route error contracts during HTTP route execution", async () => {
  const registeredRoutes: BoundHttpRoute[] = [];
  const DeclaredError = defineHttpError("CUSTOM_DECLARED", {
    status: 418,
    description: "declared",
  });
  const MismatchedError = defineHttpError("CUSTOM_MISMATCH", {
    status: 409,
    description: "mismatched",
  });

  const service = defineService("errors", {
    actions: ({ action }) => ({
      invalidOutput: action({
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async () =>
          ({
            ok: false,
          } as unknown as { ok: true }),
      }),
    }),
  });

  const controller = defineController("errors-http", {
    basePath: "/errors",
    routes: ({ route }) => ({
      declared: route.get({
        path: "/declared",
        responses: {
          204: http.response.empty(),
        },
        errors: {
          CUSTOM_DECLARED: DeclaredError,
        },
        handler: async ({ error }) => error(DeclaredError),
      }),
      undeclared: route.get({
        path: "/undeclared",
        responses: {
          204: http.response.empty(),
        },
        handler: async () => {
          throw bedrockError({
            message: "undeclared",
            code: "CUSTOM_UNDECLARED",
            status: 418,
          });
        },
      }),
      mismatched: route.get({
        path: "/mismatched",
        responses: {
          204: http.response.empty(),
        },
        errors: {
          CUSTOM_MISMATCH: MismatchedError,
        },
        handler: async () => {
          throw bedrockError({
            message: "mismatched",
            code: "CUSTOM_MISMATCH",
            status: 418,
          });
        },
      }),
      invalidInput: route.post({
        path: "/invalid-input",
        request: {
          body: z.object({
            value: z.number().int(),
          }),
        },
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () => ({ ok: true as const }),
      }),
      invalidOutput: route.get({
        path: "/invalid-output",
        responses: {
          200: z.object({
            ok: z.literal(true),
          }),
        },
        handler: async () =>
          ({
            ok: false,
          } as unknown as { ok: true }),
      }),
      actionInvalidOutput: route.get({
        path: "/action-invalid-output",
        responses: {
          200: service.actions.invalidOutput.output,
        },
        handler: service.actions.invalidOutput,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("errors", {
        services: {
          errors: service,
        },
        controllers: [controller],
      }),
    ],
    http: createFakeHttpAdapter({
      onRegister({ routes }) {
        registeredRoutes.push(...routes);
      },
    }),
  });

  await app.start();

  const createRouteRequest = (path: string, body?: unknown) =>
    createRuntimeHttpRequestFromWebRequest(
      new Request(`http://test.local${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? undefined
            : {
                "content-type": "application/json",
              },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const getRoute = (fullPath: string) =>
    registeredRoutes.find((route) => route.fullPath === fullPath);

  const declaredResponse = await getRoute("/api/errors/declared")!.execute({
    request: createRouteRequest("/api/errors/declared"),
  });
  expect(declaredResponse.status).toBe(418);
  expect(JSON.parse((declaredResponse as { body: string }).body)).toEqual({
    error: {
      code: "CUSTOM_DECLARED",
      message: "declared",
      details: undefined,
    },
  });

  const undeclaredResponse = await getRoute("/api/errors/undeclared")!.execute({
    request: createRouteRequest("/api/errors/undeclared"),
  });
  expect(undeclaredResponse.status).toBe(500);
  expect(JSON.parse((undeclaredResponse as { body: string }).body)).toEqual({
    error: {
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      message: "Route error contract violated.",
      details: undefined,
    },
  });

  const mismatchedResponse = await getRoute("/api/errors/mismatched")!.execute({
    request: createRouteRequest("/api/errors/mismatched"),
  });
  expect(mismatchedResponse.status).toBe(500);
  expect(JSON.parse((mismatchedResponse as { body: string }).body)).toEqual({
    error: {
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      message: "Route error contract violated.",
      details: undefined,
    },
  });

  const invalidInputResponse = await getRoute("/api/errors/invalid-input")!.execute({
    request: createRouteRequest("/api/errors/invalid-input", {
      value: 2.5,
    }),
  });
  expect(invalidInputResponse.status).toBe(400);
  expect(JSON.parse((invalidInputResponse as { body: string }).body)).toMatchObject({
    error: {
      code: "BEDROCK_VALIDATION_ERROR",
    },
  });

  const invalidOutputResponse = await getRoute("/api/errors/invalid-output")!.execute({
    request: createRouteRequest("/api/errors/invalid-output"),
  });
  expect(invalidOutputResponse.status).toBe(500);
  expect(JSON.parse((invalidOutputResponse as { body: string }).body)).toEqual({
    error: {
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      message: "Route error contract violated.",
      details: undefined,
    },
  });

  const actionInvalidOutputResponse = await getRoute(
    "/api/errors/action-invalid-output",
  )!.execute({
    request: createRouteRequest("/api/errors/action-invalid-output"),
  });
  expect(actionInvalidOutputResponse.status).toBe(500);
  expect(
    JSON.parse((actionInvalidOutputResponse as { body: string }).body),
  ).toEqual({
    error: {
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      message: "Route error contract violated.",
      details: undefined,
    },
  });

  await app.stop();
});

test("cleans up initialized services and providers when adapter startup fails", async () => {
  const lifecycle: string[] = [];
  const ValueToken = token<{ name: string }>("value");

  const service = defineService("cleanup", {
    hooks: {
      onInit: ({ ctx: _ctx }) => {
        lifecycle.push("service:init");
      },
      onDispose: ({ ctx: _ctx }) => {
        lifecycle.push("service:dispose");
      },
    },
    actions: ({ action }) => ({
      noop: action({
        input: z.object({}),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx: _ctx }) => ({ ok: true } as const),
      }),
    }),
  });

  const controller = defineController("cleanup-http", {
    routes: ({ route }) => ({
      create: route.get({
        path: "/",
        responses: {
          200: service.actions.noop.output,
        },
        handler: service.actions.noop,
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("cleanup", {
        services: {
          cleanup: service,
        },
        controllers: [controller],
        hooks: {
          onInit: () => {
            lifecycle.push("module:init");
          },
          onDispose: () => {
            lifecycle.push("module:dispose");
          },
        },
      }),
    ],
    providers: [
      defineProvider({
        provide: ValueToken,
        useFactory: () => ({ name: "value" }),
        dispose: () => {
          lifecycle.push("provider:dispose");
        },
      }),
    ],
    http: createFakeHttpAdapter({
      onRegister() {
        lifecycle.push("adapter:register");
      },
      async onStart() {
        lifecycle.push("adapter:start");
        throw new Error("boom");
      },
      onStop() {
        lifecycle.push("adapter:stop");
      },
    }),
  });

  await expect(app.start()).rejects.toBeInstanceOf(BedrockError);
  expect(lifecycle).toEqual([
    "service:init",
    "module:init",
    "adapter:register",
    "adapter:start",
    "adapter:stop",
    "module:dispose",
    "service:dispose",
    "provider:dispose",
  ]);
});

test("boots and executes the RFC user example end to end", async () => {
  const CreateUserInput = z.object({
    email: z.string().email(),
  });

  const CreateUserOutput = z.object({
    id: z.string(),
    email: z.string().email(),
  });

  const logs: string[] = [];

  const userService = defineService("user", {
    deps: {
      clock: ClockToken,
      repo: RepoToken,
    },
    ctx: ({ clock, repo }) => ({
      repo,
      now: () => clock.now(),
    }),
    actions: ({ action }) => ({
      create: action({
        input: CreateUserInput,
        output: CreateUserOutput,
        handler: async ({ ctx, input }) => {
          ctx.logger.info(`creating user ${input.email}`);
          return ctx.repo.create({
            email: input.email,
            createdAt: ctx.now(),
          });
        },
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("user", {
        services: {
          user: userService,
        },
      }),
    ],
    logger: {
      source: {
        type: "provider",
        token: ExampleLoggerToken,
      },
    },
    providers: [
      defineProvider({
        provide: ExampleLoggerToken,
        useValue: createTestLogger((message) => {
          logs.push(message);
        }),
      }),
      defineProvider({
        provide: ClockToken,
        useValue: {
          now: () => new Date("2026-03-09T12:00:00.000Z"),
        },
      }),
      defineProvider({
        provide: RepoToken,
        useFactory: () => ({
          async create(input: { email: string; createdAt: Date }) {
            return {
              id: "user-1",
              email: input.email,
            };
          },
        }),
      }),
    ],
  });

  await app.start();

  const result = await app.call(userService.actions.create, {
    email: "alexey@example.com",
  });

  expect(unwrapResult(result)).toEqual({
    id: "user-1",
    email: "alexey@example.com",
  });
  expect(logs).toEqual([
    "bedrock.app.start.begin",
    "bedrock.app.start.success",
    "creating user alexey@example.com",
  ]);

  await app.stop();
});

function createFakeHttpAdapter(args: {
  onRegister?: (args: {
    routes: readonly BoundHttpRoute[];
    mounts: readonly BoundHttpMount[];
  }) => void;
  onStart?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onFetch?: (request: Request) => Promise<Response> | Response;
} = {}): HttpAdapter {
  let fetchImpl: ((request: Request) => Promise<Response>) | null = null;

  return {
    basePath: "/api",
    registerRoutes(routes, options) {
      const mounts = [...(options?.mounts ?? [])];
      args.onRegister?.({
        routes,
        mounts,
      });
      fetchImpl = async (request) => {
        if (args.onFetch) {
          return Promise.resolve(args.onFetch(request));
        }

        const url = new URL(request.url);
        const matchedMount = mounts.find((mount) =>
          mount.fullPath === "/"
            ? true
            : url.pathname === mount.fullPath ||
              url.pathname.startsWith(`${mount.fullPath}/`),
        );

        if (matchedMount) {
          return runtimeHttpResultToResponse(
            await matchedMount.handle(createRuntimeHttpRequestFromWebRequest(request)),
          );
        }

        const routeMatch = routes
          .filter((route) => route.method.toUpperCase() === request.method.toUpperCase())
          .map((route) => ({
            route,
            params: matchRoutePath(route.fullPath, url.pathname),
          }))
          .find((entry) => entry.params !== null);

        if (!routeMatch) {
          return new Response("not found", { status: 404 });
        }

        return runtimeHttpResultToResponse(
          await routeMatch.route.execute({
            request: createRuntimeHttpRequestFromWebRequest(request, {
              params: routeMatch.params ?? {},
            }),
          }),
        );
      };
    },
    async fetch(request) {
      if (!fetchImpl) {
        throw new Error("Routes were not registered.");
      }

      return fetchImpl(request);
    },
    async start() {
      await args.onStart?.();
    },
    async stop() {
      await args.onStop?.();
    },
  };
}

function matchRoutePath(
  routePath: string,
  pathname: string,
): Record<string, string> | null {
  const routeSegments = routePath.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, segment] of routeSegments.entries()) {
    const value = pathSegments[index];

    if (value === undefined) {
      return null;
    }

    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(value);
      continue;
    }

    if (segment !== value) {
      return null;
    }
  }

  return params;
}

function createFakeWorkerAdapter(args: {
  name?: string;
  capabilities?: Partial<WorkerAdapterCapabilities>;
  onRegister?: (
    bindings: readonly RegisteredWorkerTrigger[],
    bridge: WorkerRuntimeBridge,
  ) => Promise<void> | void;
  onStart?: () => Promise<void> | void;
  onStop?: (options?: { drain?: boolean }) => Promise<void> | void;
  onDispatch?: (args: {
    triggerId: string;
    input: unknown;
    options?: WorkerDispatchOptions;
  }) => Promise<WorkerDispatchReceipt | void> | WorkerDispatchReceipt | void;
} = {}): WorkerAdapter & {
  deliver(delivery: WorkerAdapterDelivery): Promise<WorkerExecutionResult>;
  getRegisteredTriggers(): readonly RegisteredWorkerTrigger[];
} {
  const registeredTriggers: RegisteredWorkerTrigger[] = [];
  let bridge: WorkerRuntimeBridge | null = null;
  let dispatchCount = 0;

  return {
    name: args.name ?? "queue",
    capabilities: {
      dispatch: true,
      subscription: true,
      schedule: true,
      delay: true,
      heartbeat: true,
      drain: true,
      ...args.capabilities,
    },
    async registerTriggers(bindings, nextBridge) {
      registeredTriggers.splice(0, registeredTriggers.length, ...bindings);
      bridge = nextBridge;
      await args.onRegister?.(bindings, nextBridge);
    },
    async dispatch(triggerId, input, options) {
      const receipt = await args.onDispatch?.({
        triggerId,
        input,
        options,
      });

      if (receipt) {
        return receipt;
      }

      dispatchCount += 1;
      return {
        triggerId,
        messageId: options?.messageId ?? `dispatch-${dispatchCount}`,
        adapter: args.name ?? "queue",
        acceptedAt: new Date("2026-03-09T12:00:00.000Z"),
        scheduledAt: options?.scheduleAt,
      };
    },
    async start() {
      await args.onStart?.();
    },
    async stop(options) {
      await args.onStop?.(options);
    },
    async deliver(delivery) {
      if (!bridge) {
        throw new Error("Worker triggers were not registered.");
      }

      return bridge.executeDelivery(delivery);
    },
    getRegisteredTriggers() {
      return [...registeredTriggers];
    },
  };
}

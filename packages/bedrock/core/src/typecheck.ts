import { z } from "zod";

import {
  defineController,
  defineDomainError,
  defineHttpError,
  defineMiddleware,
  defineModule,
  defineService,
  defineWorker,
  defineWorkerTrigger,
  createConsoleLogger,
  http,
  token,
  type AppRuntime,
  type ControllerCall,
  type WorkerDispatch,
  type WorkerSourceDescriptor,
} from "./index";

const RepoToken = token<{
  insert(input: { email: string }): Promise<{ id: string; email: string }>;
}>("repo");

const CreateUserInput = z.object({
  email: z.string().email(),
});

const CreateUserOutput = z.object({
  id: z.string(),
  email: z.string().email(),
});

const PingOutput = z.object({
  ok: z.literal(true),
});

const DuplicateEmail = defineDomainError("DUPLICATE_EMAIL", {
  details: z.object({
    email: z.string().email(),
  }),
});

const UserExists = defineHttpError("USER_EXISTS", {
  status: 409,
  description: "User already exists",
  details: z.object({
    email: z.string().email(),
  }),
});

const Unauthorized = defineHttpError("AUTH_UNAUTHORIZED", {
  status: 401,
  description: "Authentication is required",
});

const CreateUserRouteRequest = {
  body: CreateUserInput,
};

const PingRouteRequest = {
  query: z.object({
    email: z.string().email().optional(),
  }),
};

const AmbiguousRouteRequest = {
  query: z.object({
    email: z.string().email().optional(),
  }),
  body: CreateUserInput,
};

const UserService = defineService("users", {
  deps: {
    repo: RepoToken,
  },
  ctx: ({ repo }) => ({
    repo,
  }),
  actions: ({ action }) => ({
    create: action({
      input: CreateUserInput,
      output: CreateUserOutput,
      errors: [DuplicateEmail],
      handler: async (args) => {
        const { ctx, input, error } = args;
        ctx.logger.info(input.email);

        // @ts-expect-error service handlers do not expose ok()
        args.ok;
        // @ts-expect-error service handlers do not expose fail()
        args.fail;

        if (input.email === "taken@example.com") {
          return error(DuplicateEmail, { email: input.email });
        }

        const created = await ctx.repo.insert(input);
        return created;
      },
    }),
    ping: action({
      output: PingOutput,
      handler: async () => ({ ok: true as const }),
    }),
    flush: action({
      handler: async () => undefined,
    }),
  }),
});

defineService("invalid-logger-dep", {
  // @ts-expect-error services must not declare logger in deps
  deps: {
    logger: token("logger"),
  },
  actions: ({ action }) => ({
    invalid: action({
      handler: async ({ ctx }) => {
        ctx.logger.info("ok");
      },
    }),
  }),
});

// @ts-expect-error service ctx must not define reserved logger field
defineService("invalid-logger-context", {
  ctx: () => ({
    logger: createConsoleLogger(),
  }),
  actions: ({ action }) => ({
    invalid: action({
      handler: async ({ ctx }) => {
        ctx.logger.info("ok");
      },
    }),
  }),
});

// @ts-expect-error named descriptor factories require the two-argument form
defineService({
  name: "legacy-users",
  actions: () => ({}),
});

defineService("invalid-users", {
  actions: ({ action }) => ({
    // @ts-expect-error service actions must not accept route metadata
    invalid: action({ input: CreateUserInput, output: CreateUserOutput, summary: "Create a user", handler: async () => ({ id: "user-1", email: "ada@example.com" }) }),
  }),
});

defineService("invalid-action-error", {
  actions: ({ action }) => ({
    // @ts-expect-error service actions may only return declared domain errors
    invalid: action({
      input: CreateUserInput,
      output: CreateUserOutput,
      handler: async ({ error }) => {
        // @ts-expect-error service actions may only return declared domain errors
        return error(DuplicateEmail, { email: "ada@example.com" });
      },
    }),
  }),
});

defineService("invalid-service-middleware", {
  actions: ({ action }) => ({
    // @ts-expect-error service actions must not accept middleware
    invalid: action({ input: CreateUserInput, output: CreateUserOutput, middleware: [], handler: async () => ({ id: "user-1", email: "ada@example.com" }) }),
  }),
});

const AuditMiddleware = defineMiddleware<
  unknown,
  typeof CreateUserRouteRequest,
  {
    200: typeof CreateUserOutput;
  }
>("audit", {
  run: async ({ next }) => next(),
});

defineController("users-http", {
  routes: ({ route }) => ({
    create: route.post({
      path: "/",
      request: CreateUserRouteRequest,
      responses: {
        200: CreateUserOutput,
      },
      handler: UserService.actions.create,
      middleware: [AuditMiddleware],
      errors: {
        DUPLICATE_EMAIL: UserExists,
      },
      summary: "Create a user",
      tags: ["users"],
    }),
    me: route.get({
      path: "/me",
      responses: {
        200: CreateUserOutput,
      },
      errors: {
        AUTH_UNAUTHORIZED: Unauthorized,
      },
      handler: async ({ error }) => error(Unauthorized),
    }),
    ping: route.get({
      path: "/ping",
      request: PingRouteRequest,
      responses: {
        200: z.object({
          ok: z.boolean(),
        }),
      },
      errors: {
        DUPLICATE_EMAIL: UserExists,
      },
      handler: async (args) => {
        const { request, call } = args;
        const created = await call(UserService.actions.create, {
          email: request.query.email ?? "ada@example.com",
        });

        // @ts-expect-error controller handlers do not expose expect()
        args.expect;
        // @ts-expect-error controller handlers do not expose ok()
        args.ok;
        // @ts-expect-error controller handlers do not expose fail()
        args.fail;

        return {
          ok: created.email.length > 0,
        };
      },
    }),
    flush: route.post({
      path: "/flush",
      responses: {
        204: http.response.empty(),
      },
      handler: UserService.actions.flush,
    }),
    health: route.get({
      path: "/health",
      responses: {
        204: http.response.empty(),
      },
      handler: async () => undefined,
    }),
  }),
});

// @ts-expect-error named descriptor factories require the two-argument form
defineController({
  name: "legacy-http",
  routes: ({ route }: any) => ({
    create: route.post({
      path: "/",
      request: CreateUserRouteRequest,
      responses: {
        200: CreateUserOutput,
      },
      handler: UserService.actions.create,
      errors: {
        DUPLICATE_EMAIL: UserExists,
      },
    }),
  }),
});

defineController("invalid-select", {
  routes: ({ route }) => ({
    create: route.post({
      path: "/",
      request: CreateUserRouteRequest,
      responses: {
        200: CreateUserOutput,
      },
      handler: UserService.actions.create,
      errors: {
        DUPLICATE_EMAIL: UserExists,
      },
      // @ts-expect-error select must return the action input shape
      select: (request) => request.params,
    }),
  }),
});

defineController("invalid-controller-logger-dep", {
  // @ts-expect-error controllers must not declare logger in deps
  deps: {
    logger: token("logger"),
  },
  routes: ({ route }) => ({
    ping: route.get({
      path: "/ping",
      responses: {
        204: http.response.empty(),
      },
      handler: async ({ ctx }) => {
        ctx.logger.info("ok");
        return undefined;
      },
    }),
  }),
});

// @ts-expect-error controller ctx must not define reserved logger field
defineController("invalid-controller-logger-context", {
  ctx: () => ({
    logger: createConsoleLogger(),
  }),
  routes: ({ route }) => ({
    ping: route.get({
      path: "/ping",
      responses: {
        204: http.response.empty(),
      },
      handler: async ({ ctx }) => {
        ctx.logger.info("ok");
        return undefined;
      },
    }),
  }),
});

defineController("invalid-controller-dispatch-context", {
  ctx: (_deps, tools) => {
    // @ts-expect-error controller ctx tools must not expose worker dispatch
    void tools.dispatch;
    return {};
  },
  routes: ({ route }) => ({
    ping: route.get({
      path: "/ping",
      responses: {
        204: http.response.empty(),
      },
      handler: async () => undefined,
    }),
  }),
});

defineController("invalid-action-errors", {
  routes: ({ route }) => ({
    // @ts-expect-error action-backed routes must map declared domain errors
    create: route.post({
      path: "/",
      request: CreateUserRouteRequest,
      responses: {
        200: CreateUserOutput,
      },
      handler: UserService.actions.create,
    }),
  }),
});

defineController("ambiguous-action-route", {
  routes: ({ route }) => ({
    // @ts-expect-error ambiguous action routes must provide select explicitly
    create: route.post({
      path: "/",
      request: AmbiguousRouteRequest,
      responses: {
        200: CreateUserOutput,
      },
      handler: UserService.actions.create,
      errors: {
        DUPLICATE_EMAIL: UserExists,
      },
    }),
  }),
});

defineController("invalid-output", {
  routes: ({ route }) => ({
    // @ts-expect-error custom route handlers must return the declared success shape
    ping: route.get({
      path: "/ping",
      request: PingRouteRequest,
      responses: {
        200: z.object({ ok: z.boolean() }),
      },
      handler: async () => ({ ok: "nope" }),
    }),
  }),
});

defineController("invalid-custom-error", {
  routes: ({ route }) => ({
    me: route.get({
      path: "/me",
      responses: {
        200: CreateUserOutput,
      },
      errors: {
        AUTH_UNAUTHORIZED: Unauthorized,
      },
      handler: async ({ error }) => {
        return error(UserExists, { email: "ada@example.com" });
      },
    }),
  }),
});

const WorkerPayload = z.object({
  userId: z.string(),
});

const DispatchWorkerSource = {
  kind: "worker-source",
  trigger: "dispatch",
  adapter: "queue",
  input: WorkerPayload,
  config: {
    topic: "send-email",
  },
} satisfies WorkerSourceDescriptor<
  "dispatch",
  typeof WorkerPayload,
  { topic: string }
>;

const WrappedWorkerSource = {
  kind: "worker-source",
  trigger: "dispatch",
  adapter: "queue",
  input: z.object({
    body: WorkerPayload,
  }),
  config: {
    topic: "wrapped-email",
  },
} satisfies WorkerSourceDescriptor<
  "dispatch",
  z.ZodObject<{ body: typeof WorkerPayload }>,
  { topic: string }
>;

const EmptyWorkerSource = {
  kind: "worker-source",
  trigger: "dispatch",
  adapter: "queue",
  input: z.undefined(),
  config: {
    topic: "tick",
  },
} satisfies WorkerSourceDescriptor<
  "dispatch",
  z.ZodUndefined,
  { topic: string }
>;

const SendEmailWorker = defineWorker("send-email", {
  ctx: (_deps, { call, dispatch }) => ({
    call,
    dispatch,
  }),
  payload: WorkerPayload,
  handler: async ({ ctx, payload, call, dispatch, delivery, heartbeat }) => {
    await heartbeat();
    const ping = await call(UserService.actions.ping);
    if (ping.ok) {
      await dispatch(SendEmailDispatchTrigger, {
        userId: payload.userId,
      });
    }
    void delivery.messageId;
    void ctx.call;
  },
});

defineWorker("invalid-worker-logger-dep", {
  // @ts-expect-error workers must not declare logger in deps
  deps: {
    logger: token("logger"),
  },
  payload: WorkerPayload,
  handler: async ({ ctx }) => {
    ctx.logger.info("ok");
  },
});

const SendEmailDispatchTrigger = defineWorkerTrigger("send-email-dispatch", {
  source: DispatchWorkerSource,
  worker: SendEmailWorker,
});

defineWorkerTrigger("send-email-wrapped", {
  source: WrappedWorkerSource,
  worker: SendEmailWorker,
  select: (input) => input.body,
});

const EmptyWorker = defineWorker("tick", {
  payload: z.undefined(),
  handler: async ({ heartbeat }) => {
    await heartbeat();
  },
});

const EmptyWorkerTrigger = defineWorkerTrigger("tick-dispatch", {
  source: EmptyWorkerSource,
  worker: EmptyWorker,
});

// @ts-expect-error select is required when the source input does not match the worker payload
defineWorkerTrigger("invalid-missing-select", {
  source: WrappedWorkerSource,
  worker: SendEmailWorker,
});

defineModule("users", {
  services: {
    users: UserService,
  },
});

declare const call: ControllerCall;
// @ts-expect-error controller call must know the route error contract
call(UserService.actions.create, { email: "ada@example.com" });
call(UserService.actions.ping);

declare const mappedCall: ControllerCall<{
  DUPLICATE_EMAIL: typeof UserExists;
}>;
mappedCall(UserService.actions.create, {
  email: "ada@example.com",
});

declare const app: AppRuntime;
app.call(UserService.actions.create, {
  email: "ada@example.com",
});
// @ts-expect-error app.call must receive the action input shape
app.call(UserService.actions.create, { wrong: true });
app.call(UserService.actions.ping);

declare const dispatch: WorkerDispatch;
dispatch(SendEmailDispatchTrigger, {
  userId: "user-1",
});
dispatch(EmptyWorkerTrigger);
dispatch(EmptyWorkerTrigger, {
  messageId: "message-1",
});
// @ts-expect-error dispatch triggers must receive the source input shape
dispatch(SendEmailDispatchTrigger, { wrong: true });

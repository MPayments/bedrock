import { expect, test } from "bun:test";
import {
  defineModule,
  defineProvider,
  defineService,
  defineWorker,
  defineWorkerTrigger,
  token,
  unwrapResult,
  type Logger,
  type WorkerSourceDescriptor,
} from "@bedrock/core";
import { AuthContextToken, type Actor } from "@bedrock/security";
import { z } from "zod";

import {
  asActor,
  createInMemoryWorkerAdapter,
  createTestApp,
  value,
} from "./index";

const ClockToken = token<{ now(): string }>("clock");
const FeatureSinkToken = token<{ info(message: string): void }>("feature-sink");

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

test("overrides root providers by token key", async () => {
  const service = defineService("clock", {
    deps: {
      clock: ClockToken,
    },
    ctx: ({ clock }) => clock,
    actions: ({ action }) => ({
      now: action({
        input: z.object({}),
        output: z.object({
          now: z.string(),
        }),
        handler: async ({ ctx }) => ({
          now: ctx.now(),
        }),
      }),
    }),
  });

  const app = createTestApp({
    modules: [
      defineModule("clock", {
        services: {
          clock: service,
        },
      }),
    ],
    providers: [
      value(ClockToken, {
        now: () => "root",
      }),
    ],
    overrides: [
      value(ClockToken, {
        now: () => "override",
      }),
    ],
  });

  await app.start();

  expect(unwrapResult(await app.call(service.actions.now, {}))).toEqual({
    now: "override",
  });

  await app.stop();
});

test("asActor installs request-scoped auth overrides for test apps", async () => {
  const actor: Actor = {
    kind: "user",
    subject: {
      id: "user_123",
    },
    sessionId: "session_123",
    roles: [],
    permissions: [],
    claims: {
      email: "ada@example.com",
    },
  };

  const service = defineService("auth", {
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    actions: ({ action }) => ({
      whoAmI: action({
        output: z.object({
          subjectId: z.string().nullable(),
          email: z.string().nullable(),
        }),
        handler: async ({ ctx }) => {
          const actor = ctx.auth.actor();

          return {
            subjectId: actor?.subject.id ?? null,
            email: typeof actor?.claims.email === "string" ? actor.claims.email : null,
          };
        },
      }),
    }),
  });

  const app = createTestApp({
    modules: [
      defineModule("auth", {
        services: {
          auth: service,
        },
      }),
    ],
    overrides: [...asActor(actor)],
  });

  await app.start();

  expect(unwrapResult(await app.call(service.actions.whoAmI))).toEqual({
    subjectId: "user_123",
    email: "ada@example.com",
  });

  await app.stop();
});

test("overrides module-local providers recursively", async () => {
  const events: string[] = [];

  const service = defineService("logger", {
    deps: {
      sink: FeatureSinkToken,
    },
    ctx: ({ sink }) => ({ sink }),
    actions: ({ action }) => ({
      log: action({
        input: z.object({
          message: z.string(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx, input }) => {
          ctx.sink.info(input.message);
          return { ok: true } as const;
        },
      }),
    }),
  });

  const featureModule = defineModule("feature", {
    providers: [
      defineProvider({
        provide: FeatureSinkToken,
        useValue: createTestLogger((message) => {
          events.push(`module:${message}`);
        }),
      }),
    ],
    services: {
      logger: service,
    },
  });

  const rootModule = defineModule("root", {
    imports: [featureModule],
  });

  const app = createTestApp({
    modules: [rootModule],
    overrides: [
      value(FeatureSinkToken, {
        info(message: string) {
          events.push(`override:${message}`);
        },
      }),
    ],
  });

  await app.start();
  await app.call(service.actions.log, {
    message: "hello",
  });
  await app.stop();

  expect(events).toEqual(["override:hello"]);
});

test("createTestApp passes worker adapters through and the in-memory adapter drains on stop", async () => {
  const sent: string[] = [];
  const workerAdapter = createInMemoryWorkerAdapter();
  const dispatchSource = {
    kind: "worker-source",
    trigger: "dispatch",
    adapter: workerAdapter.name,
    input: z.object({
      email: z.string().email(),
    }),
    config: {
      topic: "welcome-email",
    },
  } satisfies WorkerSourceDescriptor<
    "dispatch",
    z.ZodObject<{ email: z.ZodString }>,
    { topic: string }
  >;

  const welcomeWorker = defineWorker("welcome-email", {
    payload: z.object({
      email: z.string().email(),
    }),
    handler: async ({ payload }) => {
      sent.push(payload.email);
    },
  });

  const welcomeTrigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: dispatchSource,
    worker: welcomeWorker,
  });

  const app = createTestApp({
    modules: [
      defineModule("notifications", {
        workers: [welcomeWorker],
        workerTriggers: [welcomeTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await app.dispatch(welcomeTrigger, {
    email: "ada@example.com",
  });

  expect(workerAdapter.getPendingDeliveries()).toHaveLength(1);

  await app.stop();

  expect(sent).toEqual(["ada@example.com"]);
  expect(workerAdapter.getPendingDeliveries()).toHaveLength(0);
});

test("the in-memory worker adapter respects delayed dispatches and retries", async () => {
  let currentTime = new Date("2026-03-10T09:00:00.000Z");
  let attempts = 0;
  const workerAdapter = createInMemoryWorkerAdapter({
    now: () => currentTime,
  });
  const dispatchSource = {
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

  const auditWorker = defineWorker("audit", {
    payload: z.object({
      value: z.string(),
    }),
    retry: {
      attempts: 2,
      backoffMs: 30_000,
    },
    handler: async ({ payload }) => {
      attempts += 1;

      if (payload.value === "retry" && attempts === 1) {
        throw new Error("retry");
      }
    },
  });

  const auditTrigger = defineWorkerTrigger("audit-dispatch", {
    source: dispatchSource,
    worker: auditWorker,
  });

  const app = createTestApp({
    modules: [
      defineModule("audit", {
        workers: [auditWorker],
        workerTriggers: [auditTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await app.dispatch(
    auditTrigger,
    {
      value: "retry",
    },
    {
      delayMs: 60_000,
      messageId: "retry-1",
    },
  );

  expect(await workerAdapter.deliverNext()).toBeNull();

  currentTime = new Date("2026-03-10T09:01:00.000Z");

  const first = await workerAdapter.deliverNext();
  expect(first).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:audit/audit-dispatch",
      messageId: "retry-1",
      attempt: 1,
    }),
    result: {
      disposition: "retry",
      delayMs: 30_000,
    },
  });

  expect(await workerAdapter.deliverNext()).toBeNull();

  currentTime = new Date("2026-03-10T09:01:30.000Z");

  const second = await workerAdapter.deliverNext();
  expect(second).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:audit/audit-dispatch",
      messageId: "retry-1",
      attempt: 2,
    }),
    result: {
      disposition: "ack",
    },
  });

  await app.stop();
});

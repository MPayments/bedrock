import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  createApp,
  defineModule,
  defineProvider,
  defineService,
  defineWorker,
  defineWorkerTrigger,
  token,
  unwrapResult,
  type WorkerSourceDescriptor,
} from "@bedrock/core";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import {
  createDrizzleOutboxWorkerAdapter,
  createDrizzleProvider,
  createDrizzleWorkerAdapter,
  enqueueTriggerInTx,
} from "./index";

const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
});

const workerQueueTable = sqliteTable("worker_queue", {
  id: text("id").primaryKey(),
  triggerId: text("trigger_id").notNull(),
  messageId: text("message_id").notNull(),
  payload: text("payload").notNull(),
  headers: text("headers"),
  attempt: integer("attempt").notNull(),
  enqueuedAt: text("enqueued_at").notNull(),
  availableAt: text("available_at").notNull(),
});

const workerOutboxTable = sqliteTable("worker_outbox", {
  id: text("id").primaryKey(),
  triggerId: text("trigger_id").notNull(),
  messageId: text("message_id").notNull(),
  payload: text("payload").notNull(),
  headers: text("headers"),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull(),
  availableAt: text("available_at").notNull(),
  lockedAt: text("locked_at"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

test("createDrizzleProvider exposes the provided db as a singleton", async () => {
  type FakeDb = {
    transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T>;
  };

  const db: FakeDb = {
    transaction: async <T>(fn: (tx: FakeDb) => Promise<T>) => fn(db),
  };
  const DbToken = token<typeof db>("db");

  const app = createApp({
    modules: [defineModule("db", {})],
    providers: [createDrizzleProvider({ db, provide: DbToken })],
  });

  await app.start();

  expect(app.get(DbToken)).toBe(db);

  await app.stop();
});

test("request-scoped services can consume the provided db token", async () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("create table users (id text primary key, email text not null)");

  const db = drizzle(sqlite);
  const DbToken = token<typeof db>("db");
  const UserRepoToken = token<{
    create(input: { id: string; email: string }): Promise<void>;
    list(): Promise<Array<{ id: string; email: string }>>;
  }>("user-repo");

  const userService = defineService("users", {
    deps: {
      repo: UserRepoToken,
    },
    ctx: ({ repo }) => repo,
    actions: ({ action }) => ({
      create: action({
        input: z.object({
          id: z.string().min(1),
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx, input }) => {
          await ctx.create(input);
          return { ok: true } as const;
        },
      }),
      list: action({
        output: z.array(
          z.object({
            id: z.string(),
            email: z.string().email(),
          }),
        ),
        handler: async ({ ctx }) => ctx.list(),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("users", {
        providers: [
          defineProvider({
            provide: UserRepoToken,
            scope: "request",
            deps: {
              db: DbToken,
            },
            useFactory: ({ db: currentDb }) => ({
              async create(input) {
                await currentDb.insert(usersTable).values(input);
              },
              async list() {
                return currentDb.select().from(usersTable);
              },
            }),
          }),
        ],
        services: {
          users: userService,
        },
      }),
    ],
    providers: [createDrizzleProvider({ db, provide: DbToken })],
  });

  await app.start();

  await app.call(userService.actions.create, {
    id: "user-1",
    email: "ada@example.com",
  });

  expect(unwrapResult(await app.call(userService.actions.list))).toEqual([
    {
      id: "user-1",
      email: "ada@example.com",
    },
  ]);

  await app.stop();
  sqlite.close();
});

test("explicit service transactions work inside service handlers", async () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("create table users (id text primary key, email text not null)");

  const db = drizzle(sqlite);
  const DbToken = token<typeof db>("db");

  const userService = defineService("users", {
    deps: {
      db: DbToken,
    },
    ctx: ({ db: currentDb }) => ({
      db: currentDb,
    }),
    actions: ({ action }) => ({
      createInTransaction: action({
        input: z.object({
          id: z.string().min(1),
          email: z.string().email(),
        }),
        output: z.object({
          ok: z.literal(true),
        }),
        handler: async ({ ctx, input }) =>
          ctx.db.transaction(async (tx) => {
            await tx.insert(usersTable).values(input);
            return { ok: true } as const;
          }),
      }),
      list: action({
        output: z.array(
          z.object({
            id: z.string(),
            email: z.string().email(),
          }),
        ),
        handler: async ({ ctx }) => ctx.db.select().from(usersTable),
      }),
    }),
  });

  const app = createApp({
    modules: [
      defineModule("users", {
        services: {
          users: userService,
        },
      }),
    ],
    providers: [createDrizzleProvider({ db, provide: DbToken })],
  });

  await app.start();

  expect(
    unwrapResult(await app.call(userService.actions.createInTransaction, {
      id: "user-1",
      email: "ada@example.com",
    })),
  ).toEqual({ ok: true });

  expect(unwrapResult(await app.call(userService.actions.list))).toEqual([
    {
      id: "user-1",
      email: "ada@example.com",
    },
  ]);

  await app.stop();
  sqlite.close();
});

test("createDrizzleWorkerAdapter drains queued worker triggers on app stop", async () => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    create table worker_queue (
      id text primary key,
      trigger_id text not null,
      message_id text not null,
      payload text not null,
      headers text,
      attempt integer not null,
      enqueued_at text not null,
      available_at text not null
    )
  `);

  const db = drizzle(sqlite);
  const workerAdapter = createDrizzleWorkerAdapter({
    db,
    queueTable: workerQueueTable,
    name: "sql-queue",
  });
  const delivered: string[] = [];
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
      delivered.push(payload.email);
    },
  });

  const welcomeTrigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: dispatchSource,
    worker: welcomeWorker,
  });

  const app = createApp({
    modules: [
      defineModule("notifications", {
        workers: [welcomeWorker],
        workerTriggers: [welcomeTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  const receipt = await app.dispatch(
    welcomeTrigger,
    {
      email: "ada@example.com",
    },
    {
      messageId: "welcome-1",
    },
  );

  expect(receipt).toMatchObject({
    triggerId: "worker-trigger:notifications/welcome-email-dispatch",
    adapter: workerAdapter.name,
    messageId: "welcome-1",
  });
  expect(await db.select().from(workerQueueTable)).toHaveLength(1);

  await app.stop();

  expect(delivered).toEqual(["ada@example.com"]);
  expect(await db.select().from(workerQueueTable)).toEqual([]);

  sqlite.close();
});

test("createDrizzleWorkerAdapter respects delayed availability and retries", async () => {
  let currentTime = new Date("2026-03-10T09:00:00.000Z");
  let attempts = 0;
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    create table worker_queue (
      id text primary key,
      trigger_id text not null,
      message_id text not null,
      payload text not null,
      headers text,
      attempt integer not null,
      enqueued_at text not null,
      available_at text not null
    )
  `);

  const db = drizzle(sqlite);
  const workerAdapter = createDrizzleWorkerAdapter({
    db,
    queueTable: workerQueueTable,
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

  const retryWorker = defineWorker("retry-worker", {
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

  const retryTrigger = defineWorkerTrigger("retry-dispatch", {
    source: dispatchSource,
    worker: retryWorker,
  });

  const app = createApp({
    modules: [
      defineModule("retry", {
        workers: [retryWorker],
        workerTriggers: [retryTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await app.dispatch(
    retryTrigger,
    {
      value: "retry",
    },
    {
      delayMs: 60_000,
      messageId: "retry-1",
    },
  );

  expect(await workerAdapter.drainNext()).toBeNull();

  currentTime = new Date("2026-03-10T09:01:00.000Z");

  const first = await workerAdapter.drainNext();
  expect(first).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:retry/retry-dispatch",
      messageId: "retry-1",
      attempt: 1,
    }),
    result: {
      disposition: "retry",
      delayMs: 30_000,
    },
  });

  expect(await db.select().from(workerQueueTable)).toEqual([
    expect.objectContaining({
      messageId: "retry-1",
      attempt: 2,
      availableAt: "2026-03-10T09:01:30.000Z",
    }),
  ]);
  expect(await workerAdapter.drainNext()).toBeNull();

  currentTime = new Date("2026-03-10T09:01:30.000Z");

  const second = await workerAdapter.drainNext();
  expect(second).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:retry/retry-dispatch",
      messageId: "retry-1",
      attempt: 2,
    }),
    result: {
      disposition: "ack",
    },
  });
  expect(await db.select().from(workerQueueTable)).toEqual([]);

  await app.stop();
  sqlite.close();
});

test("enqueueTriggerInTx writes outbox rows transactionally and the outbox adapter drains them", async () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("create table users (id text primary key, email text not null)");
  sqlite.exec(`
    create table worker_outbox (
      id text primary key,
      trigger_id text not null,
      message_id text not null,
      payload text not null,
      headers text,
      status text not null,
      attempt integer not null,
      available_at text not null,
      locked_at text,
      error text,
      created_at text not null
    )
  `);

  const db = drizzle(sqlite);
  const workerAdapter = createDrizzleOutboxWorkerAdapter({
    db,
    outboxTable: workerOutboxTable,
    name: "sql-outbox",
  });
  const delivered: string[] = [];
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
      delivered.push(payload.email);
    },
  });

  const welcomeTrigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: dispatchSource,
    worker: welcomeWorker,
  });

  const app = createApp({
    modules: [
      defineModule("notifications", {
        workers: [welcomeWorker],
        workerTriggers: [welcomeTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  const receipt = await db.transaction(async (tx) => {
    await tx.insert(usersTable).values({
      id: "user-1",
      email: "ada@example.com",
    });

    return enqueueTriggerInTx({
      app,
      tx,
      outboxTable: workerOutboxTable,
      trigger: welcomeTrigger,
      input: {
        email: "ada@example.com",
      },
      dispatch: {
        messageId: "welcome-1",
      },
    });
  });

  expect(receipt).toMatchObject({
    outboxId: expect.any(String),
    triggerId: "worker-trigger:notifications/welcome-email-dispatch",
    messageId: "welcome-1",
    status: "pending",
  });
  expect(await db.select().from(usersTable)).toEqual([
    {
      id: "user-1",
      email: "ada@example.com",
    },
  ]);
  expect(await db.select().from(workerOutboxTable)).toEqual([
    expect.objectContaining({
      triggerId: "worker-trigger:notifications/welcome-email-dispatch",
      messageId: "welcome-1",
      status: "pending",
      attempt: 0,
      lockedAt: null,
      error: null,
    }),
  ]);

  await app.start();

  const drained = await workerAdapter.drainNext();
  expect(drained).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:notifications/welcome-email-dispatch",
      messageId: "welcome-1",
      attempt: 1,
    }),
    result: {
      disposition: "ack",
    },
  });
  expect(delivered).toEqual(["ada@example.com"]);
  expect(await db.select().from(workerOutboxTable)).toEqual([
    expect.objectContaining({
      messageId: "welcome-1",
      status: "done",
      attempt: 1,
      lockedAt: null,
      error: null,
    }),
  ]);

  await app.stop();
  sqlite.close();
});

test("createDrizzleOutboxWorkerAdapter reclaims expired leases and fails after max attempts", async () => {
  let currentTime = new Date("2026-03-10T10:00:00.000Z");
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    create table worker_outbox (
      id text primary key,
      trigger_id text not null,
      message_id text not null,
      payload text not null,
      headers text,
      status text not null,
      attempt integer not null,
      available_at text not null,
      locked_at text,
      error text,
      created_at text not null
    )
  `);

  const db = drizzle(sqlite);
  const workerAdapter = createDrizzleOutboxWorkerAdapter({
    db,
    outboxTable: workerOutboxTable,
    name: "sql-outbox",
    now: () => currentTime,
    leaseMs: 30_000,
    maxAttempts: 2,
  });
  const seen: string[] = [];
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

  const flakyWorker = defineWorker("flaky", {
    payload: z.object({
      value: z.string(),
    }),
    retry: {
      attempts: 5,
      backoffMs: 15_000,
    },
    handler: async ({ payload }) => {
      seen.push(payload.value);
      throw new Error("boom");
    },
  });

  const flakyTrigger = defineWorkerTrigger("flaky-dispatch", {
    source: dispatchSource,
    worker: flakyWorker,
  });

  const app = createApp({
    modules: [
      defineModule("flaky", {
        workers: [flakyWorker],
        workerTriggers: [flakyTrigger],
      }),
    ],
    workerAdapters: [workerAdapter],
  });

  await app.start();

  await db.insert(workerOutboxTable).values({
    id: "stale-1",
    triggerId: "flaky-dispatch",
    messageId: "stale-1",
    payload: JSON.stringify({ value: "stale" }),
    headers: null,
    status: "processing",
    attempt: 0,
    availableAt: "2026-03-10T10:00:00.000Z",
    lockedAt: "2026-03-10T09:59:00.000Z",
    error: null,
    createdAt: "2026-03-10T09:58:00.000Z",
  });

  const first = await workerAdapter.drainNext();
  expect(first).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:flaky/flaky-dispatch",
      messageId: "stale-1",
      attempt: 1,
    }),
    result: {
      disposition: "retry",
      delayMs: 15_000,
    },
  });
  expect(seen).toEqual(["stale"]);
  expect(await db.select().from(workerOutboxTable)).toEqual([
    expect.objectContaining({
      id: "stale-1",
      status: "pending",
      attempt: 1,
      error: "Worker trigger requested retry.",
      availableAt: "2026-03-10T10:00:15.000Z",
      lockedAt: null,
    }),
  ]);

  currentTime = new Date("2026-03-10T10:00:15.000Z");

  const second = await workerAdapter.drainNext();
  expect(second).toEqual({
    delivery: expect.objectContaining({
      triggerId: "worker-trigger:flaky/flaky-dispatch",
      messageId: "stale-1",
      attempt: 2,
    }),
    result: {
      disposition: "retry",
      delayMs: 15_000,
    },
  });
  expect(seen).toEqual(["stale", "stale"]);
  expect(await db.select().from(workerOutboxTable)).toEqual([
    expect.objectContaining({
      id: "stale-1",
      status: "failed",
      attempt: 2,
      error: "Worker trigger exceeded max attempts.",
      lockedAt: null,
    }),
  ]);

  await app.stop();
  sqlite.close();
});

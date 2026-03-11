import { expect, test } from "bun:test";
import {
  createApp,
  defineModule,
  defineWorker,
  defineWorkerTrigger,
  type RegisteredWorkerTrigger,
  type WorkerAdapterDelivery,
  type WorkerExecutionResult,
} from "@bedrock/core";
import { z } from "zod";

import {
  createBullmqWorkerAdapterFromFactories,
  type BullmqWorkerAdapterOptions,
} from "./adapter";
import { bullmqDispatchSource } from "./source";

type FakeJob = {
  id?: string | number | null;
  data: {
    triggerId: string;
    input: unknown;
    attempt: number;
    headers?: Record<string, string>;
    enqueuedAt: string;
    scheduledAt?: string;
  };
};

test("bullmqDispatchSource creates a dispatch worker source descriptor", () => {
  const source = bullmqDispatchSource({
    queue: "emails",
    input: z.object({
      email: z.string().email(),
    }),
  });

  expect(source).toMatchObject({
    kind: "worker-source",
    trigger: "dispatch",
    adapter: "bullmq",
    config: {
      queue: "emails",
    },
  });
});

test("adapter dispatches, dedupes, and re-enqueues retries without Redis", async () => {
  const deliveries: WorkerAdapterDelivery[] = [];
  const registeredTriggers: RegisteredWorkerTrigger[] = [];
  const jobsById = new Map<string, FakeJob>();
  const queuedJobs: FakeJob[] = [];
  const workerProcessors = new Map<string, (job: FakeJob) => Promise<void>>();

  const adapter = createBullmqWorkerAdapterFromFactories(
    {
      connection: {} as BullmqWorkerAdapterOptions["connection"],
      duplicateBehavior: "ack-existing",
    },
    {
      createQueue() {
        return {
          async add(_jobName, data, options) {
            const jobId = String(options?.jobId);
            const job: FakeJob = {
              id: jobId,
              data,
            };
            jobsById.set(jobId, job);
            queuedJobs.push(job);
            return job;
          },
          async getJob(id) {
            return jobsById.get(id) ?? null;
          },
          async close() {},
        };
      },
      createWorker({ queueName, process }) {
        workerProcessors.set(queueName, process);
        return {
          async close() {},
        };
      },
    },
  );

  const payload = z.object({
    userId: z.string().min(1),
  });
  const worker = defineWorker("welcome-email", {
    payload,
    retry: {
      attempts: 2,
      backoffMs: 25,
    },
    handler: async () => undefined,
  });
  const trigger = defineWorkerTrigger("welcome-email-dispatch", {
    source: bullmqDispatchSource({
      queue: "emails",
      input: payload,
    }),
    worker,
  });

  await adapter.registerTriggers(
    [
      {
        id: "worker-trigger:blog/welcome-email-dispatch",
        moduleId: "module:blog",
        name: "welcome-email-dispatch",
        workerId: "worker:blog/welcome-email",
        workerName: "welcome-email",
        trigger: "dispatch",
        adapter: "bullmq",
        source: trigger.source,
        worker,
        retry: {
          attempts: 2,
          backoffMs: 25,
        },
        concurrency: undefined,
        timeoutMs: undefined,
        summary: undefined,
        description: undefined,
        tags: [],
      },
    ],
    {
      async executeDelivery(delivery) {
        deliveries.push(delivery);

        if (delivery.attempt === 1) {
          return {
            disposition: "retry",
            delayMs: 25,
          } satisfies WorkerExecutionResult;
        }

        return {
          disposition: "ack",
        } satisfies WorkerExecutionResult;
      },
    },
  );

  await adapter.start();

  const dispatch = adapter.dispatch;
  expect(dispatch).toBeDefined();

  const first = await dispatch!(
    "worker-trigger:blog/welcome-email-dispatch",
    {
      userId: "user-1",
    },
  );

  const duplicate = await dispatch!(
    "worker-trigger:blog/welcome-email-dispatch",
    {
      userId: "user-1",
    },
    {
      messageId: first.messageId,
    },
  );

  expect(duplicate.messageId).toBe(first.messageId);
  expect(queuedJobs).toHaveLength(1);

  const process = workerProcessors.get("emails");
  expect(process).toBeDefined();

  await process?.(queuedJobs[0]!);

  expect(queuedJobs).toHaveLength(2);
  expect(deliveries[0]).toMatchObject({
    attempt: 1,
    messageId: first.messageId,
  });

  await process?.(queuedJobs[1]!);

  expect(deliveries[1]).toMatchObject({
    attempt: 2,
  });

  await adapter.stop({
    drain: true,
  });
});

test("app compile still rejects unsupported schedule triggers for BullMQ", async () => {
  const worker = defineWorker("welcome-email", {
    payload: z.object({
      userId: z.string().min(1),
    }),
    handler: async () => undefined,
  });
  const trigger = defineWorkerTrigger("scheduled", {
    source: {
      kind: "worker-source",
      trigger: "schedule" as const,
      adapter: "bullmq",
      input: z.undefined(),
      config: {
        cron: "* * * * *",
      },
    },
    worker,
    select: () => ({
      userId: "scheduled-user",
    }),
  });
  const app = createApp({
    modules: [
      defineModule("blog", {
        workers: [worker],
        workerTriggers: [trigger],
      }),
    ],
    workerAdapters: [
      createBullmqWorkerAdapterFromFactories(
        {
          connection: {} as BullmqWorkerAdapterOptions["connection"],
        },
        {
          createQueue() {
            throw new Error("not reached");
          },
          createWorker() {
            throw new Error("not reached");
          },
        },
      ),
    ],
  });

  await expect(app.start()).rejects.toThrow(
    'Worker trigger "worker-trigger:blog/scheduled" uses schedule trigger but adapter "bullmq" does not support schedules.',
  );
});

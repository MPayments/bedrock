import { bedrockError } from "@bedrock/common";
import type {
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerAdapterDelivery,
  WorkerDispatchOptions,
  WorkerDispatchReceipt,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
} from "@bedrock/core";
import {
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
} from "bullmq";

export type BullmqDispatchJobOptions = Omit<
  JobsOptions,
  "jobId" | "delay" | "repeat" | "attempts" | "backoff"
>;

export type BullmqDispatchSourceConfig = {
  queue: string;
  jobName?: string;
  jobOptions?: BullmqDispatchJobOptions;
};

export type BullmqWorkerAdapterOptions = {
  name?: string;
  connection: ConnectionOptions;
  prefix?: string;
  defaultJobOptions?: BullmqDispatchJobOptions;
  duplicateBehavior?: "ack-existing" | "reject";
};

export type BullmqWorkerAdapter = WorkerAdapter;

type DispatchJobData = {
  triggerId: string;
  input: unknown;
  attempt: number;
  headers?: Record<string, string>;
  enqueuedAt: string;
  scheduledAt?: string;
};

type QueueLike = {
  add(
    name: string,
    data: DispatchJobData,
    options?: JobsOptions,
  ): Promise<{ id?: string | number | null; data: DispatchJobData }>;
  getJob(
    id: string,
  ): Promise<{ id?: string | number | null; data: DispatchJobData } | null>;
  close(): Promise<void>;
};

type WorkerLike = {
  close(): Promise<void>;
};

type Factories = {
  createQueue(args: {
    queueName: string;
    options: BullmqWorkerAdapterOptions;
  }): QueueLike;
  createWorker(args: {
    queueName: string;
    options: BullmqWorkerAdapterOptions;
    process: (job: {
      id?: string | number | null;
      data: DispatchJobData;
    }) => Promise<void>;
  }): WorkerLike;
};

type QueueState = {
  queue: QueueLike;
  worker: WorkerLike;
};

const DEFAULT_ADAPTER_NAME = "bullmq";

export function createBullmqWorkerAdapter(
  options: BullmqWorkerAdapterOptions,
): BullmqWorkerAdapter {
  return createBullmqWorkerAdapterFromFactories(
    options,
    createBullmqFactories(),
  );
}

export function createBullmqWorkerAdapterFromFactories(
  options: BullmqWorkerAdapterOptions,
  factories: Factories,
): BullmqWorkerAdapter {
  const adapterName = options.name ?? DEFAULT_ADAPTER_NAME;
  const duplicateBehavior = options.duplicateBehavior ?? "ack-existing";
  const registeredTriggers = new Map<string, RegisteredWorkerTrigger>();
  const queueStates = new Map<string, QueueState>();
  let bridge: WorkerRuntimeBridge | null = null;
  let generatedMessageCount = 0;
  let started = false;

  const ensureBridge = (): WorkerRuntimeBridge => {
    if (!bridge) {
      throw new Error("Worker runtime bridge has not been registered.");
    }

    return bridge;
  };

  const ensureQueueState = (queueName: string): QueueState => {
    const existing = queueStates.get(queueName);

    if (existing) {
      return existing;
    }

    const process = async (job: {
      id?: string | number | null;
      data: DispatchJobData;
    }) => {
      const result = await ensureBridge().executeDelivery({
        triggerId: job.data.triggerId,
        input: job.data.input,
        messageId: String(job.id ?? job.data.triggerId),
        attempt: job.data.attempt,
        headers: job.data.headers,
        enqueuedAt: new Date(job.data.enqueuedAt),
        scheduledAt: job.data.scheduledAt
          ? new Date(job.data.scheduledAt)
          : undefined,
      });

      if (result.disposition !== "retry") {
        return;
      }

      const retryScheduledAt = computeRetryScheduledAt(job.data, result);
      const retryQueueState = ensureQueueState(queueName);
      const retryJobId = `${String(job.id ?? job.data.triggerId)}:retry:${job.data.attempt + 1}`;

      await retryQueueState.queue.add(
        resolveJobName(registeredTriggers.get(job.data.triggerId)),
        {
          ...job.data,
          attempt: job.data.attempt + 1,
          enqueuedAt: new Date().toISOString(),
          scheduledAt: retryScheduledAt?.toISOString(),
        },
        buildBullmqJobOptions({
          adapterOptions: options,
          trigger: registeredTriggers.get(job.data.triggerId),
          scheduledAt: retryScheduledAt,
          jobId: retryJobId,
        }),
      );
    };

    const state: QueueState = {
      queue: factories.createQueue({
        queueName,
        options,
      }),
      worker: factories.createWorker({
        queueName,
        options,
        process,
      }),
    };

    queueStates.set(queueName, state);
    return state;
  };

  return {
    name: adapterName,
    capabilities: {
      dispatch: true,
      subscription: false,
      schedule: false,
      delay: true,
      heartbeat: false,
      drain: true,
    },
    async registerTriggers(triggers, nextBridge) {
      if (started) {
        throw bedrockError({
          message: `Cannot register triggers for "${adapterName}" after the adapter has started.`,
          code: "BEDROCK_WORKER_ADAPTER_RUNNING",
        });
      }

      bridge = nextBridge;
      registeredTriggers.clear();

      for (const trigger of triggers) {
        registeredTriggers.set(trigger.id, trigger);
      }
    },
    async dispatch(triggerId, input, dispatchOptions) {
      const trigger = registeredTriggers.get(triggerId);

      if (!trigger) {
        throw bedrockError({
          message: `Worker trigger "${triggerId}" is not registered in adapter "${adapterName}".`,
          code: "BEDROCK_WORKER_TRIGGER_UNREGISTERED",
        });
      }

      const queueName = getQueueName(trigger);
      const queueState = ensureQueueState(queueName);
      const acceptedAt = new Date();
      const scheduledAt = computeScheduledAt(acceptedAt, dispatchOptions);
      const computedIdempotencyKey = resolveComputedIdempotencyKey(
        trigger,
        input,
      );

      if (
        dispatchOptions?.messageId &&
        computedIdempotencyKey &&
        dispatchOptions.messageId !== computedIdempotencyKey
      ) {
        throw bedrockError({
          message: `Dispatch for "${triggerId}" specifies messageId "${dispatchOptions.messageId}" but computed idempotency key "${computedIdempotencyKey}".`,
          code: "BEDROCK_WORKER_MESSAGE_ID_CONFLICT",
        });
      }

      const jobId =
        dispatchOptions?.messageId ??
        computedIdempotencyKey ??
        createGeneratedMessageId(adapterName, () => {
          generatedMessageCount += 1;
          return generatedMessageCount;
        });

      const existingJob = await queueState.queue.getJob(jobId);

      if (existingJob) {
        if (duplicateBehavior === "reject") {
          throw bedrockError({
            message: `Duplicate dispatch for worker trigger "${triggerId}" and job id "${jobId}".`,
            code: "BEDROCK_WORKER_DUPLICATE_DISPATCH",
          });
        }

        return {
          triggerId,
          messageId: jobId,
          adapter: adapterName,
          acceptedAt,
          scheduledAt: existingJob.data.scheduledAt
            ? new Date(existingJob.data.scheduledAt)
            : undefined,
        } satisfies WorkerDispatchReceipt;
      }

      await queueState.queue.add(
        resolveJobName(trigger),
        {
          triggerId,
          input,
          attempt: 1,
          headers: dispatchOptions?.headers,
          enqueuedAt: acceptedAt.toISOString(),
          scheduledAt: scheduledAt?.toISOString(),
        },
        buildBullmqJobOptions({
          adapterOptions: options,
          trigger,
          scheduledAt,
          jobId,
        }),
      );

      return {
        triggerId,
        messageId: jobId,
        adapter: adapterName,
        acceptedAt,
        scheduledAt,
      } satisfies WorkerDispatchReceipt;
    },
    async start() {
      started = true;

      for (const trigger of registeredTriggers.values()) {
        ensureQueueState(getQueueName(trigger));
      }
    },
    async stop() {
      started = false;

      for (const state of queueStates.values()) {
        await state.worker.close();
      }

      for (const state of queueStates.values()) {
        await state.queue.close();
      }

      queueStates.clear();
    },
  };
}

function buildBullmqJobOptions(args: {
  adapterOptions: BullmqWorkerAdapterOptions;
  trigger: RegisteredWorkerTrigger | undefined;
  scheduledAt: Date | undefined;
  jobId: string;
}): JobsOptions {
  const queueOptions = readDispatchSourceConfig(args.trigger).jobOptions ?? {};
  const mergedOptions: JobsOptions = {
    ...(args.adapterOptions.defaultJobOptions ?? {}),
    ...queueOptions,
    jobId: args.jobId,
  };

  const delay = args.scheduledAt
    ? Math.max(args.scheduledAt.getTime() - Date.now(), 0)
    : undefined;

  if (delay !== undefined && delay > 0) {
    mergedOptions.delay = delay;
  }

  return mergedOptions;
}

function getQueueName(trigger: RegisteredWorkerTrigger): string {
  const queue = readDispatchSourceConfig(trigger).queue;

  if (!queue || typeof queue !== "string") {
    throw bedrockError({
      message: `Worker trigger "${trigger.id}" is missing a BullMQ queue name.`,
      code: "BEDROCK_WORKER_BULLMQ_QUEUE_MISSING",
    });
  }

  return queue;
}

function resolveJobName(trigger: RegisteredWorkerTrigger | undefined): string {
  if (!trigger) {
    return "bedrock-worker";
  }

  return readDispatchSourceConfig(trigger).jobName ?? trigger.name;
}

function readDispatchSourceConfig(
  trigger: RegisteredWorkerTrigger | undefined,
): BullmqDispatchSourceConfig {
  return (trigger?.source.config ?? {}) as BullmqDispatchSourceConfig;
}

function resolveComputedIdempotencyKey(
  trigger: RegisteredWorkerTrigger,
  input: unknown,
): string | undefined {
  return trigger.idempotencyKey?.(input as never);
}

function computeScheduledAt(
  acceptedAt: Date,
  options: WorkerDispatchOptions | undefined,
): Date | undefined {
  if (options?.scheduleAt) {
    return options.scheduleAt;
  }

  if (options?.delayMs !== undefined) {
    return new Date(acceptedAt.getTime() + options.delayMs);
  }

  return undefined;
}

function computeRetryScheduledAt(
  data: DispatchJobData,
  result: Extract<WorkerExecutionResult, { disposition: "retry" }>,
): Date | undefined {
  if (result.delayMs === undefined) {
    return data.scheduledAt ? new Date(data.scheduledAt) : undefined;
  }

  return new Date(Date.now() + result.delayMs);
}

function createGeneratedMessageId(
  adapterName: string,
  next: () => number,
): string {
  return `${adapterName}-message-${next()}`;
}

function createBullmqFactories(): Factories {
  return {
    createQueue({ queueName, options }) {
      const queue = new Queue(queueName, {
        connection: options.connection,
        prefix: options.prefix,
        defaultJobOptions: options.defaultJobOptions,
      });

      return {
        async add(name, data, jobOptions) {
          const job = await queue.add(name, data, jobOptions);
          return {
            id: job.id,
            data: job.data as DispatchJobData,
          };
        },
        async getJob(id) {
          const job = await queue.getJob(id);

          if (!job) {
            return null;
          }

          return {
            id: job.id,
            data: job.data as DispatchJobData,
          };
        },
        async close() {
          await queue.close();
        },
      };
    },
    createWorker({ queueName, options, process }) {
      const worker = new Worker(queueName, async (job) =>
        process({
          id: job.id,
          data: job.data as DispatchJobData,
        }), {
        connection: options.connection,
        prefix: options.prefix,
      });

      return {
        async close() {
          await worker.close();
        },
      };
    },
  };
}

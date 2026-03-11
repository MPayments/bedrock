import { bedrockError } from "@bedrock/common";
import type {
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerAdapterDelivery,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
  WorkerSourceDescriptor,
} from "@bedrock/core";
import { z } from "zod";

export type IntervalSourceConfig<TInput> = {
  everyMs: number;
  input: TInput;
  runOnStart?: boolean;
};

export type IntervalAdapterOptions = {
  name?: string;
  now?: () => Date;
};

type IntervalTrigger = RegisteredWorkerTrigger<
  WorkerSourceDescriptor<"schedule", z.ZodTypeAny, IntervalSourceConfig<unknown>>
>;

const DEFAULT_ADAPTER_NAME = "interval";

export function intervalSource(options: {
  everyMs: number;
  runOnStart?: boolean;
}): WorkerSourceDescriptor<
  "schedule",
  z.ZodUndefined,
  IntervalSourceConfig<undefined>
>;

export function intervalSource<TInputSchema extends z.ZodTypeAny>(options: {
  everyMs: number;
  input: {
    schema: TInputSchema;
    value: z.input<TInputSchema>;
  };
  runOnStart?: boolean;
}): WorkerSourceDescriptor<
  "schedule",
  TInputSchema,
  IntervalSourceConfig<z.output<TInputSchema>>
>;

export function intervalSource<TInputSchema extends z.ZodTypeAny>(options: {
  everyMs: number;
  input?: {
    schema: TInputSchema;
    value: z.input<TInputSchema>;
  };
  runOnStart?: boolean;
}): WorkerSourceDescriptor<
  "schedule",
  z.ZodTypeAny,
  IntervalSourceConfig<unknown>
> {
  const inputSchema = options.input?.schema ?? z.undefined();
  const parsedInput =
    options.input === undefined
      ? undefined
      : inputSchema.parse(options.input.value);

  return Object.freeze({
    kind: "worker-source" as const,
    trigger: "schedule" as const,
    adapter: DEFAULT_ADAPTER_NAME,
    input: inputSchema,
    config: Object.freeze({
      everyMs: options.everyMs,
      input: parsedInput,
      runOnStart: options.runOnStart ?? true,
    }),
  });
}

export function createIntervalWorkerAdapter(
  options: IntervalAdapterOptions = {},
): WorkerAdapter {
  const adapterName = options.name ?? DEFAULT_ADAPTER_NAME;
  const now = options.now ?? (() => new Date());
  const triggers = new Map<string, IntervalTrigger>();
  const intervalHandles = new Map<string, ReturnType<typeof setInterval>>();
  const timeoutHandles = new Set<ReturnType<typeof setTimeout>>();
  let bridge: WorkerRuntimeBridge | null = null;
  let started = false;

  const enqueueRetry = (trigger: IntervalTrigger, delayMs: number | undefined) => {
    const handle = setTimeout(() => {
      timeoutHandles.delete(handle);
      void executeTrigger(trigger, 2);
    }, Math.max(delayMs ?? 0, 0));
    timeoutHandles.add(handle);
  };

  const executeTrigger = async (
    trigger: IntervalTrigger,
    attempt: number,
  ): Promise<void> => {
    if (!bridge) {
      throw new Error("Worker runtime bridge has not been registered.");
    }

    const firedAt = now();
    const delivery: WorkerAdapterDelivery = {
      triggerId: trigger.id,
      input: trigger.source.config.input,
      messageId: `${trigger.id}:${firedAt.getTime()}:${attempt}`,
      attempt,
      enqueuedAt: firedAt,
      scheduledAt: firedAt,
    };

    const result = await bridge.executeDelivery(delivery);
    if (result.disposition === "retry") {
      enqueueRetry(trigger, result.delayMs);
    }
  };

  return {
    name: adapterName,
    capabilities: {
      dispatch: false,
      subscription: false,
      schedule: true,
      delay: true,
      heartbeat: false,
      drain: true,
    },
    async registerTriggers(nextTriggers, nextBridge) {
      if (started) {
        throw bedrockError({
          message: `Cannot register triggers for "${adapterName}" after the adapter has started.`,
          code: "BEDROCK_WORKER_ADAPTER_RUNNING",
        });
      }

      bridge = nextBridge;
      triggers.clear();

      for (const trigger of nextTriggers) {
        triggers.set(trigger.id, trigger as IntervalTrigger);
      }
    },
    async start() {
      if (started) {
        return;
      }

      started = true;
      for (const trigger of triggers.values()) {
        const everyMs = trigger.source.config.everyMs;
        if (!Number.isInteger(everyMs) || everyMs <= 0) {
          throw bedrockError({
            message: `Interval worker trigger "${trigger.id}" has invalid everyMs "${everyMs}".`,
            code: "BEDROCK_WORKER_TRIGGER_INVALID",
            details: {
              triggerId: trigger.id,
              everyMs,
            },
          });
        }

        if (trigger.source.config.runOnStart) {
          void executeTrigger(trigger, 1);
        }

        const handle = setInterval(() => {
          void executeTrigger(trigger, 1);
        }, everyMs);
        intervalHandles.set(trigger.id, handle);
      }
    },
    async stop() {
      for (const handle of intervalHandles.values()) {
        clearInterval(handle);
      }
      intervalHandles.clear();

      for (const handle of timeoutHandles) {
        clearTimeout(handle);
      }
      timeoutHandles.clear();
      started = false;
    },
  };
}

export type { WorkerExecutionResult };

import type { z } from "zod";

import {
  cloneReadonlyArray,
  cloneReadonlyRecord,
  freezeObject,
} from "./immutability";
import type { WorkerDescriptor, WorkerRetryPolicy } from "./worker";

export type WorkerTriggerKind = "dispatch" | "subscription" | "schedule";

export type WorkerSourceDescriptor<
  TKind extends WorkerTriggerKind = WorkerTriggerKind,
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TConfig = unknown,
> = {
  kind: "worker-source";
  trigger: TKind;
  adapter: string;
  input: TInputSchema;
  config: TConfig;
};

export type InferWorkerPayload<
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = z.output<TWorker["payload"]>;

export type InferWorkerTriggerInput<
  TTrigger extends WorkerTriggerDescriptor<any, any, any>,
> = z.input<TTrigger["source"]["input"]>;

type WorkerTriggerPayloadSelector<
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = (input: z.output<TSource["input"]>) => z.input<TWorker["payload"]>;

type WorkerTriggerDefinitionBase<
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = {
  source: TSource;
  worker: TWorker;
  retry?: WorkerRetryPolicy;
  concurrency?: number;
  timeoutMs?: number;
  partitionBy?: (input: z.output<TSource["input"]>) => string;
  idempotencyKey?: (input: z.output<TSource["input"]>) => string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
};

type WorkerTriggerDefinitionWithImplicitSelect<
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = WorkerTriggerDefinitionBase<TSource, TWorker> & {
  select?: WorkerTriggerPayloadSelector<TSource, TWorker>;
};

type WorkerTriggerDefinitionWithRequiredSelect<
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = WorkerTriggerDefinitionBase<TSource, TWorker> & {
  select: WorkerTriggerPayloadSelector<TSource, TWorker>;
};

export type WorkerTriggerDescriptor<
  TName extends string,
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = {
  kind: "worker-trigger";
  name: TName;
  source: TSource;
  worker: TWorker;
  select?: WorkerTriggerPayloadSelector<TSource, TWorker>;
  retry?: WorkerRetryPolicy;
  concurrency?: number;
  timeoutMs?: number;
  partitionBy?: (input: z.output<TSource["input"]>) => string;
  idempotencyKey?: (input: z.output<TSource["input"]>) => string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
};

export type DispatchWorkerTriggerDescriptor<
  TName extends string = string,
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TWorker extends WorkerDescriptor<any, any, any, any> = WorkerDescriptor<
    any,
    any,
    any,
    any
  >,
> = WorkerTriggerDescriptor<
  TName,
  WorkerSourceDescriptor<"dispatch", TInputSchema, any>,
  TWorker
>;

export type RegisteredWorkerTrigger<
  TSource extends WorkerSourceDescriptor<any, any, any> = WorkerSourceDescriptor<
    any,
    any,
    any
  >,
  TWorker extends WorkerDescriptor<any, any, any, any> = WorkerDescriptor<
    any,
    any,
    any,
    any
  >,
> = {
  id: string;
  moduleId: string;
  name: string;
  workerId: string;
  workerName: string;
  trigger: TSource["trigger"];
  adapter: string;
  source: TSource;
  worker: TWorker;
  retry?: WorkerRetryPolicy;
  concurrency?: number;
  timeoutMs?: number;
  partitionBy?: (input: z.output<TSource["input"]>) => string;
  idempotencyKey?: (input: z.output<TSource["input"]>) => string;
  summary?: string;
  description?: string;
  tags: readonly string[];
};

export type WorkerDelivery = {
  triggerId: string;
  workerId: string;
  trigger: WorkerTriggerKind;
  adapter: string;
  messageId: string;
  attempt: number;
  headers: Readonly<Record<string, string>>;
  enqueuedAt?: Date;
  scheduledAt?: Date;
  startedAt: Date;
  partitionKey?: string;
  idempotencyKey?: string;
};

export type WorkerDispatchOptions = {
  messageId?: string;
  headers?: Record<string, string>;
  delayMs?: number;
  scheduleAt?: Date;
};

export type WorkerDispatchReceipt = {
  triggerId: string;
  messageId: string;
  adapter: string;
  acceptedAt: Date;
  scheduledAt?: Date;
};

export type WorkerDispatch = {
  <TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>>(
    trigger: TTrigger,
  ): Promise<WorkerDispatchReceipt>;
  <TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>>(
    trigger: TTrigger,
    options: WorkerDispatchOptions,
  ): Promise<WorkerDispatchReceipt>;
  <TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>>(
    trigger: TTrigger,
    input: InferWorkerTriggerInput<TTrigger>,
    options?: WorkerDispatchOptions,
  ): Promise<WorkerDispatchReceipt>;
};

export type WorkerAdapterCapabilities = {
  dispatch: boolean;
  subscription: boolean;
  schedule: boolean;
  delay: boolean;
  heartbeat: boolean;
  drain: boolean;
};

export type WorkerAdapterDelivery = {
  triggerId: string;
  input: unknown;
  messageId: string;
  attempt: number;
  headers?: Record<string, string>;
  enqueuedAt?: Date;
  scheduledAt?: Date;
  heartbeat?: () => Promise<void>;
};

export type WorkerExecutionResult =
  | { disposition: "ack" }
  | { disposition: "retry"; delayMs?: number }
  | { disposition: "reject" };

export type WorkerRuntimeBridge = {
  executeDelivery(delivery: WorkerAdapterDelivery): Promise<WorkerExecutionResult>;
};

export type WorkerAdapter = {
  name: string;
  capabilities: WorkerAdapterCapabilities;
  registerTriggers(
    triggers: readonly RegisteredWorkerTrigger[],
    bridge: WorkerRuntimeBridge,
  ): Promise<void> | void;
  dispatch?: (
    triggerId: string,
    input: unknown,
    options?: WorkerDispatchOptions,
  ) => Promise<WorkerDispatchReceipt>;
  start(): Promise<void>;
  stop(options?: { drain?: boolean }): Promise<void>;
};

type WorkerTriggerDefinition<
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
> = z.output<TSource["input"]> extends z.input<TWorker["payload"]>
  ? WorkerTriggerDefinitionWithImplicitSelect<TSource, TWorker>
  : WorkerTriggerDefinitionWithRequiredSelect<TSource, TWorker>;

export function defineWorkerTrigger<
  TName extends string,
  TSource extends WorkerSourceDescriptor<any, any, any>,
  TWorker extends WorkerDescriptor<any, any, any, any>,
>(
  name: TName,
  def: WorkerTriggerDefinition<TSource, TWorker>,
): WorkerTriggerDescriptor<TName, TSource, TWorker> {
  return freezeObject({
    kind: "worker-trigger",
    name,
    source: def.source,
    worker: def.worker,
    select: def.select,
    retry: cloneReadonlyRecord(def.retry),
    concurrency: def.concurrency,
    timeoutMs: def.timeoutMs,
    partitionBy: def.partitionBy,
    idempotencyKey: def.idempotencyKey,
    summary: def.summary,
    description: def.description,
    tags: cloneReadonlyArray(def.tags) ?? [],
  });
}

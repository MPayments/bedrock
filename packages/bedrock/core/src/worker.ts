import type { BivariantCallback } from "@bedrock/common";
import type { z } from "zod";

import { cloneReadonlyRecord, freezeObject } from "./immutability";
import type {
  ReservedLoggerContextGuard,
  ReservedLoggerDepGuard,
  WithAmbientLogger,
} from "./descriptor-types";
import type { ResolveTokenMap, TokenMap } from "./kernel";
import type { ServiceCall } from "./service";
import type {
  WorkerDelivery,
  WorkerDispatch,
} from "./worker-trigger";

export type WorkerRetryPolicy = {
  attempts: number;
  backoffMs?: number;
};

export type WorkerContextTools = {
  call: ServiceCall;
  dispatch: WorkerDispatch;
};

export type WorkerHandlerArgs<TCtx, TPayload> = {
  ctx: WithAmbientLogger<TCtx>;
  payload: TPayload;
  call: ServiceCall;
  dispatch: WorkerDispatch;
  delivery: WorkerDelivery;
  heartbeat: () => Promise<void>;
};

export type WorkerDescriptor<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TPayloadSchema extends z.ZodTypeAny,
> = {
  kind: "worker";
  name: TName;
  deps?: TDeps;
  ctx?: (
    deps: ResolveTokenMap<TDeps>,
    tools: WorkerContextTools,
  ) => TCtx & ReservedLoggerContextGuard;
  payload: TPayloadSchema;
  retry?: WorkerRetryPolicy;
  concurrency?: number;
  timeoutMs?: number;
  partitionBy?: (payload: z.output<TPayloadSchema>) => string;
  idempotencyKey?: (payload: z.output<TPayloadSchema>) => string;
  handler: BivariantCallback<
    WorkerHandlerArgs<TCtx, z.output<TPayloadSchema>>,
    Promise<void> | void
  >;
};

export type WorkerDefinition<
  TDeps extends TokenMap,
  TCtx,
  TPayloadSchema extends z.ZodTypeAny,
> = Omit<
  WorkerDescriptor<string, TDeps & ReservedLoggerDepGuard, TCtx, TPayloadSchema>,
  "kind" | "name"
>;

export function defineWorker<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TPayloadSchema extends z.ZodTypeAny,
>(
  name: TName,
  def: WorkerDefinition<TDeps, TCtx, TPayloadSchema>,
) {
  return freezeObject({
    kind: "worker",
    name,
    deps: cloneReadonlyRecord(def.deps),
    ctx: def.ctx,
    payload: def.payload,
    retry: cloneReadonlyRecord(def.retry),
    concurrency: def.concurrency,
    timeoutMs: def.timeoutMs,
    partitionBy: def.partitionBy,
    idempotencyKey: def.idempotencyKey,
    handler: def.handler,
  } satisfies WorkerDescriptor<TName, TDeps, TCtx, TPayloadSchema>);
}

import { z } from "zod";

import { bootError, dependencyResolutionError } from "@bedrock/common";

import { createWorkerExecutionContext } from "../execution-context";
import { freezeObject } from "../immutability";
import type { WorkerContextTools } from "../worker";
import type {
  DispatchWorkerTriggerDescriptor,
  InferWorkerTriggerInput,
  RegisteredWorkerTrigger,
  WorkerAdapterDelivery,
  WorkerDispatch,
  WorkerDispatchOptions,
  WorkerDispatchReceipt,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
  WorkerTriggerDescriptor,
} from "../worker-trigger";
import { createServiceCall } from "./actions";
import {
  createExecutionScope,
  disposeExecutionScope,
  resolveTokenMapInScope,
} from "./scope";
import { deriveDescriptorContext, parseWithSchema } from "./support";
import type {
  CompiledApp,
  StartedApp,
  WorkerTriggerRecord,
} from "./types";
import { createChildLogger } from "./logger";

const NOOP_HEARTBEAT = async (): Promise<void> => {};

export function createWorkerDispatch(
  compiled: CompiledApp,
  started: StartedApp,
): WorkerDispatch {
  return (async (
    trigger: DispatchWorkerTriggerDescriptor<any, any, any>,
    inputOrOptions?: unknown,
    options?: WorkerDispatchOptions,
  ) => {
    const record = resolveWorkerTriggerRecord(compiled, trigger);

    if (record.trigger !== "dispatch") {
      throw bootError(
        `Worker trigger "${record.id}" cannot be dispatched because it uses "${record.trigger}" trigger.`,
        {
          workerTriggerId: record.id,
          trigger: record.trigger,
        },
      );
    }

    const normalized = normalizeDispatchArgs(record, inputOrOptions, options);
    const receipt = await dispatchWorkerTriggerRecord(
      compiled,
      record,
      normalized.input,
      normalized.options,
    );
    createChildLogger(started.bedrockLogger, {
      workerTriggerId: record.id,
      workerTriggerName: record.name,
      workerId: record.workerRecord.id,
      adapter: record.adapterName,
    })?.info("bedrock.worker.dispatch.accepted", {
      messageId: receipt.messageId,
      acceptedAt: receipt.acceptedAt,
      scheduledAt: receipt.scheduledAt,
    });
    return receipt;
  }) as WorkerDispatch;
}

export function createWorkerRuntimeBridge(
  compiled: CompiledApp,
  started: StartedApp,
): WorkerRuntimeBridge {
  return freezeObject({
    executeDelivery: (delivery) =>
      trackWorkerExecution(started, executeWorkerAdapterDelivery(compiled, started, delivery)),
  });
}

export function resolveWorkerTriggerRecord<
  TTrigger extends WorkerTriggerDescriptor<any, any, any>,
>(
  compiled: CompiledApp,
  trigger: TTrigger,
): WorkerTriggerRecord {
  const record = compiled.workerTriggerRecordByDescriptor.get(trigger as object);

  if (!record) {
    throw dependencyResolutionError(
      `Worker trigger "${trigger.name}" is not registered in this app.`,
      {
        workerTriggerName: trigger.name,
      },
    );
  }

  return record;
}

export function resolveRegisteredWorkerTrigger<
  TTrigger extends WorkerTriggerDescriptor<any, any, any>,
>(
  compiled: CompiledApp,
  trigger: TTrigger,
): RegisteredWorkerTrigger<TTrigger["source"], TTrigger["worker"]> {
  return resolveWorkerTriggerRecord(compiled, trigger)
    .registeredTrigger as RegisteredWorkerTrigger<
    TTrigger["source"],
    TTrigger["worker"]
  >;
}

function normalizeDispatchArgs(
  record: WorkerTriggerRecord,
  inputOrOptions: unknown,
  options: WorkerDispatchOptions | undefined,
): {
  input: unknown;
  options: WorkerDispatchOptions | undefined;
} {
  if (record.descriptor.source.input instanceof z.ZodUndefined && options === undefined) {
    return {
      input: undefined,
      options: inputOrOptions as WorkerDispatchOptions | undefined,
    };
  }

  return {
    input: inputOrOptions,
    options,
  };
}

async function dispatchWorkerTriggerRecord(
  compiled: CompiledApp,
  record: WorkerTriggerRecord,
  input: unknown,
  options: WorkerDispatchOptions | undefined,
): Promise<WorkerDispatchReceipt> {
  const workerAdapter = compiled.workerAdapterByName.get(record.adapterName);

  if (!workerAdapter) {
    throw dependencyResolutionError(
      `Worker adapter "${record.adapterName}" is not registered in this app.`,
      {
        workerTriggerId: record.id,
        adapterName: record.adapterName,
      },
    );
  }

  if (!workerAdapter.capabilities.dispatch || !workerAdapter.dispatch) {
    throw bootError(
      `Worker adapter "${workerAdapter.name}" does not support dispatch.`,
      {
        workerTriggerId: record.id,
        adapterName: workerAdapter.name,
      },
    );
  }

  await parseWithSchema(
    record.descriptor.source.input,
    input,
    `Invalid input for "${record.id}".`,
    {
      workerTriggerId: record.id,
      stage: "input",
    },
  );

  validateDispatchOptions(workerAdapter.name, workerAdapter.capabilities.delay, options);

  return workerAdapter.dispatch(record.id, input, options);
}

async function executeWorkerAdapterDelivery(
  compiled: CompiledApp,
  started: StartedApp,
  delivery: WorkerAdapterDelivery,
): Promise<WorkerExecutionResult> {
  const triggerRecord = compiled.workerTriggerRecordById.get(delivery.triggerId);
  const logger = createChildLogger(started.bedrockLogger, {
    workerTriggerId: delivery.triggerId,
    messageId: delivery.messageId,
    adapter: triggerRecord?.adapterName ?? "unknown",
  });

  if (!triggerRecord) {
    logger?.warn("bedrock.worker.delivery.reject", {
      reason: "missing-trigger",
      attempt: delivery.attempt,
    });
    return { disposition: "reject" };
  }

  const parsedInput = await tryParseWorkerTriggerInput(triggerRecord, delivery.input);

  if (parsedInput.ok === false) {
    logger?.warn("bedrock.worker.delivery.reject", {
      reason: "invalid-trigger-input",
      attempt: delivery.attempt,
    });
    return { disposition: "reject" };
  }

  const selectedPayload = trySelectWorkerPayload(triggerRecord, parsedInput.value);
  if (selectedPayload.ok === false) {
    logger?.warn("bedrock.worker.delivery.reject", {
      reason: "payload-selection-failed",
      attempt: delivery.attempt,
    });
    return { disposition: "reject" };
  }

  const parsedPayload = await tryParseWorkerPayload(triggerRecord, selectedPayload.value);
  if (parsedPayload.ok === false) {
    logger?.warn("bedrock.worker.delivery.reject", {
      reason: "invalid-worker-payload",
      attempt: delivery.attempt,
    });
    return { disposition: "reject" };
  }

  const partitionKey =
    triggerRecord.descriptor.partitionBy?.(parsedInput.value) ??
    triggerRecord.workerRecord.descriptor.partitionBy?.(parsedPayload.value);
  const idempotencyKey =
    triggerRecord.descriptor.idempotencyKey?.(parsedInput.value) ??
    triggerRecord.workerRecord.descriptor.idempotencyKey?.(parsedPayload.value);
  const deliveryArgs = freezeObject({
    triggerId: triggerRecord.id,
    workerId: triggerRecord.workerRecord.id,
    trigger: triggerRecord.trigger,
    adapter: triggerRecord.adapterName,
    messageId: delivery.messageId,
    attempt: delivery.attempt,
    headers: freezeObject({ ...(delivery.headers ?? {}) }),
    enqueuedAt: delivery.enqueuedAt,
    scheduledAt: delivery.scheduledAt,
    startedAt: new Date(),
    partitionKey,
    idempotencyKey,
  });
  const scope = createExecutionScope(
    compiled,
    started,
    createWorkerExecutionContext({
      delivery: deliveryArgs,
      triggerId: triggerRecord.id,
      workerId: triggerRecord.workerRecord.id,
    }),
  );
  let executionFailed = false;
  let executionError: unknown;
  let scopeDisposeError: unknown;

  try {
    const workerTools = createWorkerContextTools(compiled, started, scope);
    const deps = await resolveTokenMapInScope(
      triggerRecord.workerRecord.descriptor.deps,
      compiled,
      started,
      scope,
      triggerRecord.workerRecord.id,
    );
    const context = deriveDescriptorContext(
      triggerRecord.workerRecord.descriptor.ctx,
      deps,
      triggerRecord.workerRecord.id,
      createChildLogger(started.bedrockLogger, {
        moduleName: triggerRecord.workerRecord.moduleName,
        contextKind: "worker",
        contextName: triggerRecord.workerRecord.descriptor.name,
      }),
      workerTools,
    );

    await triggerRecord.workerRecord.descriptor.handler({
      ctx: context,
      payload: parsedPayload.value,
      call: workerTools.call,
      dispatch: workerTools.dispatch,
      delivery: deliveryArgs,
      heartbeat: delivery.heartbeat ?? NOOP_HEARTBEAT,
    });
  } catch (error) {
    executionFailed = true;
    executionError = error;
  }

  try {
    await disposeExecutionScope(scope);
  } catch (error) {
    executionFailed = true;
    scopeDisposeError = error;
  }

  if (!executionFailed) {
    logger?.info("bedrock.worker.delivery.ack", {
      attempt: delivery.attempt,
      workerId: triggerRecord.workerRecord.id,
    });
    return { disposition: "ack" };
  }

  const disposition = getWorkerFailureDisposition(
    triggerRecord.registeredTrigger.retry,
    delivery.attempt,
  );

  if (disposition.disposition === "retry") {
    logger?.warn("bedrock.worker.delivery.retry", {
      attempt: delivery.attempt,
      workerId: triggerRecord.workerRecord.id,
      delayMs: disposition.delayMs,
      executionError,
      scopeDisposeError,
    });
    return disposition;
  }

  logger?.error("bedrock.worker.delivery.reject", {
    attempt: delivery.attempt,
    workerId: triggerRecord.workerRecord.id,
    executionError,
    scopeDisposeError,
  });
  return disposition;
}

function createWorkerContextTools(
  compiled: CompiledApp,
  started: StartedApp,
  scope: ReturnType<typeof createExecutionScope>,
): WorkerContextTools {
  return {
    call: createServiceCall(compiled, started, scope),
    dispatch: createWorkerDispatch(compiled, started),
  };
}

function trackWorkerExecution(
  started: StartedApp,
  execution: Promise<WorkerExecutionResult>,
): Promise<WorkerExecutionResult> {
  started.inFlightWorkerExecutions.add(execution);

  return execution.finally(() => {
    started.inFlightWorkerExecutions.delete(execution);
  });
}

async function tryParseWorkerTriggerInput(
  triggerRecord: WorkerTriggerRecord,
  input: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return {
      ok: true,
      value: await parseWithSchema(
        triggerRecord.descriptor.source.input,
        input,
        `Invalid input for "${triggerRecord.id}".`,
        {
          workerTriggerId: triggerRecord.id,
          stage: "input",
        },
      ),
    };
  } catch {
    return { ok: false };
  }
}

function trySelectWorkerPayload(
  triggerRecord: WorkerTriggerRecord,
  input: unknown,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return {
      ok: true,
      value: triggerRecord.descriptor.select
        ? triggerRecord.descriptor.select(input as never)
        : input,
    };
  } catch {
    return { ok: false };
  }
}

async function tryParseWorkerPayload(
  triggerRecord: WorkerTriggerRecord,
  input: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return {
      ok: true,
      value: await parseWithSchema(
        triggerRecord.workerRecord.descriptor.payload,
        input,
        `Invalid payload for "${triggerRecord.id}".`,
        {
          workerTriggerId: triggerRecord.id,
          workerId: triggerRecord.workerRecord.id,
          stage: "payload",
        },
      ),
    };
  } catch {
    return { ok: false };
  }
}

function getWorkerFailureDisposition(
  retry: WorkerTriggerRecord["registeredTrigger"]["retry"],
  attempt: number,
): WorkerExecutionResult {
  if (!retry || retry.attempts <= 1 || attempt >= retry.attempts) {
    return { disposition: "reject" };
  }

  return {
    disposition: "retry",
    delayMs: retry.backoffMs,
  };
}

function validateDispatchOptions(
  adapterName: string,
  supportsDelay: boolean,
  options: WorkerDispatchOptions | undefined,
): void {
  if (!options) {
    return;
  }

  if (options.delayMs !== undefined && options.scheduleAt !== undefined) {
    throw bootError(
      `Dispatch for worker adapter "${adapterName}" cannot specify both delayMs and scheduleAt.`,
      { adapterName },
    );
  }

  if (
    (options.delayMs !== undefined || options.scheduleAt !== undefined) &&
    !supportsDelay
  ) {
    throw bootError(
      `Worker adapter "${adapterName}" does not support delayed or scheduled dispatch.`,
      { adapterName },
    );
  }
}

export async function dispatchWorkerTrigger<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  trigger: TTrigger,
): Promise<WorkerDispatchReceipt>;

export async function dispatchWorkerTrigger<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  trigger: TTrigger,
  options: WorkerDispatchOptions,
): Promise<WorkerDispatchReceipt>;

export async function dispatchWorkerTrigger<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  trigger: TTrigger,
  input: InferWorkerTriggerInput<TTrigger>,
  options?: WorkerDispatchOptions,
): Promise<WorkerDispatchReceipt>;

export async function dispatchWorkerTrigger<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  trigger: TTrigger,
  inputOrOptions?: InferWorkerTriggerInput<TTrigger> | WorkerDispatchOptions,
  options?: WorkerDispatchOptions,
): Promise<WorkerDispatchReceipt> {
  return createWorkerDispatch(compiled, started)(
    trigger,
    inputOrOptions as never,
    options,
  );
}

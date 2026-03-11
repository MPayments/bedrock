import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import type {
  AppRuntime,
  DispatchWorkerTriggerDescriptor,
  InferWorkerTriggerInput,
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerAdapterDelivery,
  WorkerDispatchOptions,
  WorkerDispatchReceipt,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
} from "@bedrock/core";
import { z } from "zod";

export type DrizzleWorkerOutboxStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed";

export type DrizzleWorkerOutboxTable = {
  id: unknown;
  triggerId: unknown;
  messageId: unknown;
  payload: unknown;
  headers: unknown;
  status: unknown;
  attempt: unknown;
  availableAt: unknown;
  lockedAt: unknown;
  error: unknown;
  createdAt: unknown;
};

type DrizzleOutboxRow = {
  id: string;
  triggerId: string;
  messageId: string;
  payload: unknown;
  headers: unknown;
  status: DrizzleWorkerOutboxStatus;
  attempt: number;
  availableAt: unknown;
  lockedAt: unknown;
  error: unknown;
  createdAt: unknown;
};

type DrizzleOutboxMutationResult = unknown;

type DrizzleOutboxInsertDatabase = {
  insert(table: unknown): {
    values(values: Record<string, unknown>): Promise<unknown>;
  };
};

type DrizzleOutboxDatabase = DrizzleOutboxInsertDatabase & {
  transaction<T>(fn: (tx: DrizzleOutboxDatabase) => Promise<T>): Promise<T>;
  select(): {
    from(table: unknown): {
      where(condition: unknown): {
        orderBy(...fields: unknown[]): {
          limit(count: number): Promise<unknown>;
        };
      };
    };
  };
  update(table: unknown): {
    set(values: Record<string, unknown>): {
      where(condition: unknown): Promise<unknown>;
    };
  };
};

type OutboxCodecOptions = {
  now?: () => Date;
  createId?: () => string;
  serializeDate?: (value: Date) => string | number | Date;
  parseDate?: (value: unknown) => Date;
  serializePayload?: (value: unknown) => string;
  parsePayload?: (value: unknown) => unknown;
  serializeHeaders?: (
    value: Record<string, string> | undefined,
  ) => string | null | undefined;
  parseHeaders?: (value: unknown) => Record<string, string> | undefined;
};

type WorkerTriggerResolutionApp = Pick<AppRuntime, "resolveWorkerTrigger">;

export type EnqueueTriggerInTxReceipt = {
  outboxId: string;
  triggerId: string;
  messageId: string;
  acceptedAt: Date;
  scheduledAt?: Date;
  status: "pending";
};

export type EnqueueTriggerInTxOptions<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>,
  TOutboxTable extends DrizzleWorkerOutboxTable,
> = OutboxCodecOptions & {
  app?: WorkerTriggerResolutionApp;
  tx: DrizzleOutboxInsertDatabase;
  outboxTable: TOutboxTable;
  trigger: TTrigger;
  input: InferWorkerTriggerInput<TTrigger>;
  dispatch?: WorkerDispatchOptions;
  triggerId?: string;
};

export type EnqueueTriggerInTxNoInputOptions<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>,
  TOutboxTable extends DrizzleWorkerOutboxTable,
> = OutboxCodecOptions & {
  app?: WorkerTriggerResolutionApp;
  tx: DrizzleOutboxInsertDatabase;
  outboxTable: TOutboxTable;
  trigger: TTrigger;
  dispatch?: WorkerDispatchOptions;
  triggerId?: string;
};

export type DrizzleOutboxWorkerAdapterOptions<
  TOutboxTable extends DrizzleWorkerOutboxTable,
> = OutboxCodecOptions & {
  db: DrizzleOutboxDatabase;
  outboxTable: TOutboxTable;
  name?: string;
  batchSize?: number;
  maxAttempts?: number;
  leaseMs?: number;
  pollIntervalMs?: number;
};

export type DrizzleOutboxDrainResult = {
  delivery: WorkerAdapterDelivery;
  result: WorkerExecutionResult;
};

export type DrizzleOutboxWorkerAdapter<
  TOutboxTable extends DrizzleWorkerOutboxTable = DrizzleWorkerOutboxTable,
> = WorkerAdapter & {
  drainNext(): Promise<DrizzleOutboxDrainResult | null>;
  drainAll(): Promise<DrizzleOutboxDrainResult[]>;
  getRegisteredTriggers(): readonly RegisteredWorkerTrigger[];
};

function defaultNow(): Date {
  return new Date();
}

function defaultCreateIdFactory(prefix: string): () => string {
  let count = 0;

  return () => {
    count += 1;
    return `${prefix}-${count}`;
  };
}

function defaultSerializeDate(value: Date): string {
  return value.toISOString();
}

function defaultParseDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    return new Date(value);
  }

  throw new TypeError(`Unsupported worker outbox date value: ${String(value)}`);
}

function defaultSerializePayload(value: unknown): string {
  return JSON.stringify(value);
}

function defaultParsePayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return JSON.parse(value);
}

function defaultSerializeHeaders(
  value: Record<string, string> | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return JSON.stringify(value);
}

function defaultParseHeaders(
  value: unknown,
): Record<string, string> | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value as Record<string, string>;
  }

  return JSON.parse(value) as Record<string, string>;
}

function validateDispatchOptions(
  dispatchOptions: WorkerDispatchOptions | undefined,
): void {
  if (!dispatchOptions) {
    return;
  }

  if (
    dispatchOptions.delayMs !== undefined &&
    dispatchOptions.scheduleAt !== undefined
  ) {
    throw new Error(
      "Outbox enqueue cannot specify both delayMs and scheduleAt.",
    );
  }
}

function resolveScheduledAt(
  acceptedAt: Date,
  dispatchOptions: WorkerDispatchOptions | undefined,
): Date | undefined {
  if (dispatchOptions?.scheduleAt) {
    return dispatchOptions.scheduleAt;
  }

  if (dispatchOptions?.delayMs !== undefined) {
    return new Date(acceptedAt.getTime() + dispatchOptions.delayMs);
  }

  return undefined;
}

function createCodec(options: OutboxCodecOptions) {
  return {
    now: options.now ?? defaultNow,
    createId:
      options.createId ?? defaultCreateIdFactory("worker-outbox"),
    serializeDate: options.serializeDate ?? defaultSerializeDate,
    parseDate: options.parseDate ?? defaultParseDate,
    serializePayload: options.serializePayload ?? defaultSerializePayload,
    parsePayload: options.parsePayload ?? defaultParsePayload,
    serializeHeaders: options.serializeHeaders ?? defaultSerializeHeaders,
    parseHeaders: options.parseHeaders ?? defaultParseHeaders,
  };
}

async function insertOutboxRecord<
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(args: {
  tx: DrizzleOutboxInsertDatabase;
  outboxTable: TOutboxTable;
  triggerId: string;
  inputSchema: z.ZodTypeAny;
  input: unknown;
  dispatchOptions?: WorkerDispatchOptions;
} & ReturnType<typeof createCodec>): Promise<EnqueueTriggerInTxReceipt> {
  validateDispatchOptions(args.dispatchOptions);

  const parsedInput = await args.inputSchema.parseAsync(args.input);
  const acceptedAt = args.now();
  const scheduledAt = resolveScheduledAt(acceptedAt, args.dispatchOptions);
  const outboxId = args.createId();
  const messageId = args.dispatchOptions?.messageId ?? outboxId;

  await args.tx.insert(args.outboxTable).values({
    id: outboxId,
    triggerId: args.triggerId,
    messageId,
    payload: args.serializePayload(parsedInput),
    headers: args.serializeHeaders(args.dispatchOptions?.headers),
    status: "pending",
    attempt: 0,
    availableAt: args.serializeDate(scheduledAt ?? acceptedAt),
    lockedAt: null,
    error: null,
    createdAt: args.serializeDate(acceptedAt),
  });

  return {
    outboxId,
    triggerId: args.triggerId,
    messageId,
    acceptedAt,
    scheduledAt,
    status: "pending",
  };
}

export async function enqueueTriggerInTx<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, z.ZodUndefined, any>,
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(
  options: EnqueueTriggerInTxNoInputOptions<TTrigger, TOutboxTable>,
): Promise<EnqueueTriggerInTxReceipt>;

export async function enqueueTriggerInTx<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>,
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(
  options: EnqueueTriggerInTxOptions<TTrigger, TOutboxTable>,
): Promise<EnqueueTriggerInTxReceipt>;

export async function enqueueTriggerInTx<
  TTrigger extends DispatchWorkerTriggerDescriptor<any, any, any>,
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(
  options:
    | EnqueueTriggerInTxOptions<TTrigger, TOutboxTable>
    | EnqueueTriggerInTxNoInputOptions<any, TOutboxTable>,
): Promise<EnqueueTriggerInTxReceipt> {
  const codec = createCodec(options);
  const rawInput =
    options.trigger.source.input instanceof z.ZodUndefined
      ? undefined
      : (options as EnqueueTriggerInTxOptions<TTrigger, TOutboxTable>).input;
  const triggerId =
    options.app?.resolveWorkerTrigger(options.trigger).id ??
    options.triggerId ??
    options.trigger.name;

  return insertOutboxRecord({
    ...codec,
    tx: options.tx,
    outboxTable: options.outboxTable,
    triggerId,
    inputSchema: options.trigger.source.input,
    input: rawInput,
    dispatchOptions: options.dispatch,
  });
}

function getMutationCount(result: DrizzleOutboxMutationResult): number | undefined {
  if (typeof result === "number") {
    return result;
  }

  if (result && typeof result === "object") {
    if (
      "rowsAffected" in result &&
      typeof result.rowsAffected === "number"
    ) {
      return result.rowsAffected;
    }

    if ("changes" in result && typeof result.changes === "number") {
      return result.changes;
    }
  }

  return undefined;
}

function didMutate(result: DrizzleOutboxMutationResult): boolean {
  const count = getMutationCount(result);
  return count === undefined ? true : count > 0;
}

function buildClaimableCondition<TOutboxTable extends DrizzleWorkerOutboxTable>(
  outboxTable: TOutboxTable,
  readyAt: string | number | Date,
  leaseCutoff: string | number | Date,
): unknown {
  return or(
    and(
      eq(outboxTable.status as never, "pending" as never),
      lte(outboxTable.availableAt as never, readyAt as never),
    ),
    and(
      eq(outboxTable.status as never, "processing" as never),
      lte(outboxTable.lockedAt as never, leaseCutoff as never),
    ),
  );
}

async function markExhaustedTriggers<
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(
  tx: DrizzleOutboxDatabase,
  outboxTable: TOutboxTable,
  readyAt: string | number | Date,
  leaseCutoff: string | number | Date,
  maxAttempts: number,
): Promise<void> {
  await tx
    .update(outboxTable)
    .set({
      status: "failed",
      lockedAt: null,
      error: "Worker trigger exceeded max attempts.",
    })
    .where(
      and(
        buildClaimableCondition(outboxTable, readyAt, leaseCutoff) as never,
        gte(outboxTable.attempt as never, maxAttempts as never),
      ),
    );
}

function normalizeScheduledAt(
  createdAt: Date,
  availableAt: Date,
): Date | undefined {
  if (availableAt.getTime() === createdAt.getTime()) {
    return undefined;
  }

  return availableAt;
}

export function createDrizzleOutboxWorkerAdapter<
  TOutboxTable extends DrizzleWorkerOutboxTable,
>(
  options: DrizzleOutboxWorkerAdapterOptions<TOutboxTable>,
): DrizzleOutboxWorkerAdapter<TOutboxTable> {
  const name = options.name ?? "sql-drizzle-outbox";
  const batchSize = Math.max(options.batchSize ?? 32, 1);
  const maxAttempts = Math.max(options.maxAttempts ?? 25, 1);
  const leaseMs = Math.max(options.leaseMs ?? 60_000, 1);
  const codec = createCodec(options);
  const registeredTriggers: RegisteredWorkerTrigger[] = [];
  let bridge: WorkerRuntimeBridge | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let drainRun: Promise<void> | null = null;

  const resolveStoredTriggerId = (storedTriggerId: string): string => {
    const exact = registeredTriggers.find((trigger) => trigger.id === storedTriggerId);
    if (exact) {
      return exact.id;
    }

    const byName = registeredTriggers.filter(
      (trigger) => trigger.name === storedTriggerId,
    );

    if (byName.length === 1) {
      return byName[0]!.id;
    }

    return storedTriggerId;
  };

  const executeDelivery = async (
    delivery: WorkerAdapterDelivery,
  ): Promise<WorkerExecutionResult> => {
    if (!bridge) {
      throw new Error("Worker triggers were not registered.");
    }

    return bridge.executeDelivery(delivery);
  };

  const runDrainLoop = async (): Promise<void> => {
    if (drainRun) {
      await drainRun;
      return;
    }

    drainRun = (async () => {
      await adapter.drainAll();
    })().finally(() => {
      drainRun = null;
    });

    await drainRun;
  };

  const claimNext = async (): Promise<DrizzleOutboxRow | null> =>
    options.db.transaction(async (tx) => {
      const currentTime = codec.now();
      const readyAt = codec.serializeDate(currentTime);
      const leaseCutoff = codec.serializeDate(
        new Date(currentTime.getTime() - leaseMs),
      );

      await markExhaustedTriggers(
        tx,
        options.outboxTable,
        readyAt,
        leaseCutoff,
        maxAttempts,
      );

      const candidates = (await tx
        .select()
        .from(options.outboxTable)
        .where(
          and(
            buildClaimableCondition(
              options.outboxTable,
              readyAt,
              leaseCutoff,
            ) as never,
            lte(options.outboxTable.attempt as never, (maxAttempts - 1) as never),
          ),
        )
        .orderBy(
          asc(options.outboxTable.availableAt as never),
          asc(options.outboxTable.createdAt as never),
          asc(options.outboxTable.id as never),
        )
        .limit(batchSize)) as DrizzleOutboxRow[];

      for (const candidate of candidates) {
        const nextAttempt = candidate.attempt + 1;
        const claimedAt = codec.now();
        const claimResult = await tx
          .update(options.outboxTable)
          .set({
            status: "processing",
            attempt: nextAttempt,
            lockedAt: codec.serializeDate(claimedAt),
            error: null,
          })
          .where(
            and(
              eq(options.outboxTable.id as never, candidate.id as never),
              eq(options.outboxTable.attempt as never, candidate.attempt as never),
              buildClaimableCondition(
                options.outboxTable,
                readyAt,
                leaseCutoff,
              ) as never,
            ),
          );

        if (!didMutate(claimResult)) {
          continue;
        }

        return {
          ...candidate,
          attempt: nextAttempt,
          lockedAt: codec.serializeDate(claimedAt),
          error: null,
          status: "processing",
        };
      }

      return null;
    });

  const adapter: DrizzleOutboxWorkerAdapter<TOutboxTable> = {
    name,
    capabilities: {
      dispatch: true,
      subscription: false,
      schedule: false,
      delay: true,
      heartbeat: false,
      drain: true,
    },
    async registerTriggers(triggers, nextBridge) {
      registeredTriggers.splice(0, registeredTriggers.length, ...triggers);
      bridge = nextBridge;
    },
    async dispatch(triggerId, input, dispatchOptions) {
      const registeredTrigger = registeredTriggers.find(
        (trigger) => trigger.id === triggerId,
      );

      if (!registeredTrigger) {
        throw new Error(`Worker trigger "${triggerId}" is not registered.`);
      }

      const receipt = await insertOutboxRecord({
        ...codec,
        tx: options.db,
        outboxTable: options.outboxTable,
        triggerId,
        inputSchema: registeredTrigger.source.input,
        input,
        dispatchOptions,
      });

      return {
        triggerId: receipt.triggerId,
        messageId: receipt.messageId,
        adapter: name,
        acceptedAt: receipt.acceptedAt,
        scheduledAt: receipt.scheduledAt,
      } satisfies WorkerDispatchReceipt;
    },
    async start() {
      if (!options.pollIntervalMs || options.pollIntervalMs <= 0) {
        return;
      }

      pollTimer = setInterval(() => {
        void runDrainLoop();
      }, options.pollIntervalMs);
    },
    async stop(stopOptions) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      if (stopOptions?.drain) {
        await runDrainLoop();
        return;
      }

      if (drainRun) {
        await drainRun;
      }
    },
    async drainNext() {
      const claimed = await claimNext();

      if (!claimed) {
        return null;
      }

      const createdAt = codec.parseDate(claimed.createdAt);
      const availableAt = codec.parseDate(claimed.availableAt);
      const delivery: WorkerAdapterDelivery = {
        triggerId: resolveStoredTriggerId(claimed.triggerId),
        input: codec.parsePayload(claimed.payload),
        messageId: claimed.messageId,
        attempt: claimed.attempt,
        headers: codec.parseHeaders(claimed.headers),
        enqueuedAt: createdAt,
        scheduledAt: normalizeScheduledAt(createdAt, availableAt),
      };

      const result = await executeDelivery(delivery);

      if (result.disposition === "ack") {
        await options.db
          .update(options.outboxTable)
          .set({
            status: "done",
            lockedAt: null,
            error: null,
          })
          .where(eq(options.outboxTable.id as never, claimed.id as never));
      } else if (
        result.disposition === "retry" &&
        claimed.attempt < maxAttempts
      ) {
        const retryAt =
          result.delayMs === undefined
            ? codec.now()
            : new Date(codec.now().getTime() + result.delayMs);

        await options.db
          .update(options.outboxTable)
          .set({
            status: "pending",
            lockedAt: null,
            error: "Worker trigger requested retry.",
            availableAt: codec.serializeDate(retryAt),
          })
          .where(eq(options.outboxTable.id as never, claimed.id as never));
      } else {
        const error =
          result.disposition === "retry"
            ? "Worker trigger exceeded max attempts."
            : "Worker trigger rejected delivery.";

        await options.db
          .update(options.outboxTable)
          .set({
            status: "failed",
            lockedAt: null,
            error,
          })
          .where(eq(options.outboxTable.id as never, claimed.id as never));
      }

      return {
        delivery,
        result,
      };
    },
    async drainAll() {
      const results: DrizzleOutboxDrainResult[] = [];

      while (true) {
        const next = await adapter.drainNext();

        if (!next) {
          break;
        }

        results.push(next);
      }

      return results;
    },
    getRegisteredTriggers() {
      return [...registeredTriggers];
    },
  };

  return adapter;
}

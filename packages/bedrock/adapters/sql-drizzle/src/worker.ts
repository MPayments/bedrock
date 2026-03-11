import { asc, eq, lte } from "drizzle-orm";
import type {
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerAdapterDelivery,
  WorkerDispatchOptions,
  WorkerDispatchReceipt,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
} from "@bedrock/core";

export type DrizzleWorkerQueueTable = {
  id: unknown;
  triggerId: unknown;
  messageId: unknown;
  payload: unknown;
  headers: unknown;
  attempt: unknown;
  enqueuedAt: unknown;
  availableAt: unknown;
};

type DrizzleWorkerRow = {
  id: string;
  triggerId: string;
  messageId: string;
  payload: unknown;
  headers: unknown;
  attempt: number;
  enqueuedAt: unknown;
  availableAt: unknown;
};

type DrizzleWorkerDatabase = {
  insert(table: unknown): {
    values(values: Record<string, unknown>): Promise<unknown>;
  };
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
  delete(table: unknown): {
    where(condition: unknown): Promise<unknown>;
  };
};

export type DrizzleWorkerAdapterOptions<
  TQueueTable extends DrizzleWorkerQueueTable,
> = {
  db: DrizzleWorkerDatabase;
  queueTable: TQueueTable;
  name?: string;
  batchSize?: number;
  pollIntervalMs?: number;
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

export type DrizzleWorkerDrainResult = {
  delivery: WorkerAdapterDelivery;
  result: WorkerExecutionResult;
};

export type DrizzleWorkerAdapter<
  TQueueTable extends DrizzleWorkerQueueTable = DrizzleWorkerQueueTable,
> = WorkerAdapter & {
  drainNext(): Promise<DrizzleWorkerDrainResult | null>;
  drainAll(): Promise<DrizzleWorkerDrainResult[]>;
  getRegisteredTriggers(): readonly RegisteredWorkerTrigger[];
};

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

  throw new TypeError(`Unsupported worker queue date value: ${String(value)}`);
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

export function createDrizzleWorkerAdapter<
  TQueueTable extends DrizzleWorkerQueueTable,
>(
  options: DrizzleWorkerAdapterOptions<TQueueTable>,
): DrizzleWorkerAdapter<TQueueTable> {
  const name = options.name ?? "sql-drizzle";
  const now = options.now ?? (() => new Date());
  const batchSize = Math.max(options.batchSize ?? 32, 1);
  const serializeDate = options.serializeDate ?? defaultSerializeDate;
  const parseDate = options.parseDate ?? defaultParseDate;
  const serializePayload = options.serializePayload ?? defaultSerializePayload;
  const parsePayload = options.parsePayload ?? defaultParsePayload;
  const serializeHeaders = options.serializeHeaders ?? defaultSerializeHeaders;
  const parseHeaders = options.parseHeaders ?? defaultParseHeaders;
  const registeredTriggers: RegisteredWorkerTrigger[] = [];
  let bridge: WorkerRuntimeBridge | null = null;
  let generatedIdCount = 0;
  let messageCount = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let drainRun: Promise<void> | null = null;

  const createId =
    options.createId ??
    (() => {
      generatedIdCount += 1;
      return `${name}-${generatedIdCount}`;
    });

  const computeScheduledAt = (
    acceptedAt: Date,
    dispatchOptions: WorkerDispatchOptions | undefined,
  ): Date | undefined => {
    if (dispatchOptions?.scheduleAt) {
      return dispatchOptions.scheduleAt;
    }

    if (dispatchOptions?.delayMs !== undefined) {
      return new Date(acceptedAt.getTime() + dispatchOptions.delayMs);
    }

    return undefined;
  };

  const executeDelivery = async (
    delivery: WorkerAdapterDelivery,
  ): Promise<WorkerExecutionResult> => {
    if (!bridge) {
      throw new Error("Worker triggers were not registered.");
    }

    return bridge.executeDelivery(delivery);
  };

  const selectAvailableRows = async (): Promise<DrizzleWorkerRow[]> =>
    (await options.db
      .select()
      .from(options.queueTable)
      .where(
        lte(
          options.queueTable.availableAt as never,
          serializeDate(now()) as never,
        ),
      )
      .orderBy(
        asc(options.queueTable.availableAt as never),
        asc(options.queueTable.enqueuedAt as never),
        asc(options.queueTable.id as never),
      )
      .limit(batchSize)) as DrizzleWorkerRow[];

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

  const adapter: DrizzleWorkerAdapter<TQueueTable> = {
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
      const triggerRegistered = registeredTriggers.some(
        (trigger) => trigger.id === triggerId,
      );

      if (!triggerRegistered) {
        throw new Error(`Worker trigger "${triggerId}" is not registered.`);
      }

      const acceptedAt = now();
      const scheduledAt = computeScheduledAt(acceptedAt, dispatchOptions);
      messageCount += 1;
      const messageId =
        dispatchOptions?.messageId ?? `${name}-message-${messageCount}`;

      await options.db.insert(options.queueTable).values({
        id: createId(),
        triggerId,
        messageId,
        payload: serializePayload(input),
        headers: serializeHeaders(dispatchOptions?.headers),
        attempt: 1,
        enqueuedAt: serializeDate(acceptedAt),
        availableAt: serializeDate(scheduledAt ?? acceptedAt),
      });

      return {
        triggerId,
        messageId,
        adapter: name,
        acceptedAt,
        scheduledAt,
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
      const rows = await selectAvailableRows();
      const row = rows[0];

      if (!row) {
        return null;
      }

      const delivery: WorkerAdapterDelivery = {
        triggerId: row.triggerId,
        input: parsePayload(row.payload),
        messageId: row.messageId,
        attempt: row.attempt,
        headers: parseHeaders(row.headers),
        enqueuedAt: parseDate(row.enqueuedAt),
        scheduledAt:
          parseDate(row.availableAt).getTime() ===
          parseDate(row.enqueuedAt).getTime()
            ? undefined
            : parseDate(row.availableAt),
      };

      const result = await executeDelivery(delivery);

      if (result.disposition === "retry") {
        const availableAt =
          result.delayMs === undefined
            ? delivery.scheduledAt ?? now()
            : new Date(now().getTime() + result.delayMs);

        await options.db
          .update(options.queueTable)
          .set({
            attempt: row.attempt + 1,
            availableAt: serializeDate(availableAt),
          })
          .where(eq(options.queueTable.id as never, row.id as never));
      } else {
        await options.db
          .delete(options.queueTable)
          .where(eq(options.queueTable.id as never, row.id as never));
      }

      return {
        delivery,
        result,
      };
    },
    async drainAll() {
      const results: DrizzleWorkerDrainResult[] = [];

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

import { defineProvider, type Provider, type Token } from "@bedrock/core";

export type DrizzleDatabase<TSchema = any> = {
  transaction<T>(fn: (tx: DrizzleDatabase<TSchema>) => Promise<T>): Promise<T>;
};

export {
  createDrizzleWorkerAdapter,
  type DrizzleWorkerAdapter,
  type DrizzleWorkerAdapterOptions,
  type DrizzleWorkerDrainResult,
  type DrizzleWorkerQueueTable,
} from "./worker";
export {
  createDrizzleOutboxWorkerAdapter,
  enqueueTriggerInTx,
  type DrizzleOutboxDrainResult,
  type DrizzleOutboxWorkerAdapter,
  type DrizzleOutboxWorkerAdapterOptions,
  type DrizzleWorkerOutboxStatus,
  type DrizzleWorkerOutboxTable,
  type EnqueueTriggerInTxReceipt,
} from "./outbox";

export function createDrizzleProvider<TDb>(options: {
  db: TDb;
  provide: Token<TDb>;
}): Provider<TDb> {
  return defineProvider({
    provide: options.provide,
    useValue: options.db,
    scope: "singleton",
  });
}

import type {
  Database as DrizzleDatabase,
  Transaction as DrizzleTransaction,
} from "./drizzle";

export type Database = DrizzleDatabase;
export type Transaction = DrizzleTransaction;

export interface TransactionRunner {
  runInTransaction<TResult>(
    callback: (tx: Transaction) => Promise<TResult>,
  ): Promise<TResult>;
}

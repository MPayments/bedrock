import type {
  Database as DrizzleDatabase,
  Transaction as DrizzleTransaction,
} from "./drizzle";

export type Database = DrizzleDatabase;
export type Transaction = DrizzleTransaction;
export type Queryable = Database | Transaction;

export interface TransactionRunner {
  runInTransaction<TResult>(
    callback: (tx: Transaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface PersistenceContext extends TransactionRunner {
  db: Queryable;
}

export interface TransactionalPort<TPort> {
  bind: (tx: Transaction) => TPort;
  withTransaction<TResult>(
    callback: (port: TPort, tx: Transaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export function createPersistenceContext(db: Database): PersistenceContext {
  return {
    db,
    runInTransaction(callback) {
      return db.transaction((tx: Transaction) => callback(tx));
    },
  };
}

export function bindPersistenceSession(tx: Transaction): PersistenceContext {
  return {
    db: tx,
    runInTransaction(callback) {
      return callback(tx);
    },
  };
}

export function createTransactionalPort<TPort>(
  persistence: PersistenceContext,
  bind: (tx: Transaction) => TPort,
): TransactionalPort<TPort> {
  return {
    bind,
    withTransaction(callback) {
      return persistence.runInTransaction((tx) => callback(bind(tx), tx));
    },
  };
}

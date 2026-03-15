import type {
  AccountingCompiledPackCache,
  AccountingPacksCommandRepository,
  AccountingPacksQueryRepository,
  AccountingPacksCommandTransaction,
} from "./ports";
import type { CompiledPack } from "../../domain/packs";

export const PACK_SCOPE_TYPE_BOOK = "book";

export interface AccountingPacksContext {
  queries?: AccountingPacksQueryRepository;
  commands?: AccountingPacksCommandRepository;
  cache?: AccountingCompiledPackCache;
  runInTransaction?: <T>(
    run: (tx: AccountingPacksCommandTransaction) => Promise<T>,
  ) => Promise<T>;
  assertBooksBelongToInternalLedgerOrganizations?: (
    bookIds: string[],
  ) => Promise<void>;
  defaultCompiledPack: CompiledPack;
  now: () => Date;
}

export function readCachedPack(context: AccountingPacksContext, key: string) {
  return context.cache?.read(key);
}

export function writeCachedPack(
  context: AccountingPacksContext,
  key: string,
  value: CompiledPack | null,
) {
  context.cache?.write(key, value);
}

export function requirePacksQueryRepository(context: AccountingPacksContext) {
  if (!context.queries) {
    throw new Error("Accounting packs service requires a query repository");
  }

  return context.queries;
}

export function requirePacksCommandRepository(context: AccountingPacksContext) {
  if (!context.commands) {
    throw new Error("Accounting packs service requires a command repository");
  }

  return context.commands;
}

export function requirePacksTransactionRunner(context: AccountingPacksContext) {
  if (!context.runInTransaction) {
    throw new Error("Accounting packs service requires transaction support");
  }

  return context.runInTransaction;
}

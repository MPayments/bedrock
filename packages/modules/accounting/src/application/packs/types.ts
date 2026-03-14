import type {
  AccountingPacksRepository,
  AccountingPacksServicePorts,
} from "./ports";
import type { CompiledPack } from "../../domain/packs";

export const PACK_SCOPE_TYPE_BOOK = "book";

export interface AccountingPacksContext extends AccountingPacksServicePorts {
  defaultCompiledPack: CompiledPack;
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

export function requireRepository(context: AccountingPacksContext) {
  if (!context.repository) {
    throw new Error("Accounting packs service requires db for pack persistence");
  }

  return context.repository;
}

export function requireTransactionRunner(context: AccountingPacksContext) {
  if (!context.withTransaction) {
    throw new Error("Accounting packs service requires db for pack persistence");
  }

  return context.withTransaction;
}

export type TransactionalAccountingPacksRepository = AccountingPacksRepository;

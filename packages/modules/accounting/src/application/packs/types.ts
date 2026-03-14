import type {
  AccountingPacksRepository,
  AccountingPacksServicePorts,
} from "./ports";
import type { CompiledPack } from "../../domain/packs";

export const PACK_SCOPE_TYPE_BOOK = "book";

const PACK_CACHE_TTL_MS = 60_000;

interface CachedPackEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

export interface AccountingPacksContext extends AccountingPacksServicePorts {
  defaultCompiledPack: CompiledPack;
  packCache: Map<string, CachedPackEntry>;
}

export function readCachedPack(context: AccountingPacksContext, key: string) {
  const cached = context.packCache.get(key);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt < Date.now()) {
    context.packCache.delete(key);
    return undefined;
  }

  return cached.value;
}

export function writeCachedPack(
  context: AccountingPacksContext,
  key: string,
  value: CompiledPack | null,
) {
  context.packCache.set(key, {
    value,
    expiresAt: Date.now() + PACK_CACHE_TTL_MS,
  });
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

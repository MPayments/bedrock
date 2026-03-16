import type { AccountingCompiledPackCache } from "../../application/packs/ports";
import type { CompiledPack } from "../../domain/packs";

interface CacheEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

export function createInMemoryAccountingCompiledPackCache(input?: {
  ttlMs?: number;
  now?: () => number;
}): AccountingCompiledPackCache {
  const ttlMs = input?.ttlMs ?? 60_000;
  const now = input?.now ?? Date.now;
  const cache = new Map<string, CacheEntry>();

  return {
    read(key) {
      const entry = cache.get(key);
      if (!entry) {
        return undefined;
      }

      if (entry.expiresAt < now()) {
        cache.delete(key);
        return undefined;
      }

      return entry.value;
    },
    write(key, value) {
      cache.set(key, {
        value,
        expiresAt: now() + ttlMs,
      });
    },
  };
}

import type { CompiledPackCache } from "../../application/ports/compiled-pack.cache";
import type { CompiledPack } from "../../domain";

interface CacheEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

export class InMemoryCompiledPackCache implements CompiledPackCache {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(input?: {
    ttlMs?: number;
    now?: () => number;
  }) {
    this.ttlMs = input?.ttlMs ?? 60_000;
    this.now = input?.now ?? Date.now;
  }

  read(key: string) {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < this.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  write(key: string, value: CompiledPack | null) {
    this.cache.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }
}

export function createInMemoryCompiledPackCache(input?: {
  ttlMs?: number;
  now?: () => number;
}): CompiledPackCache {
  return new InMemoryCompiledPackCache(input);
}

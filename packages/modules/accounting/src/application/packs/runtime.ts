import {
  AccountingPackNotFoundError,
  AccountingPackVersionConflictError,
  AccountingPostingPlanValidationError,
} from "../../errors";
import {
  compilePack,
  hydrateCompiledPack,
  serializeCompiledPack,
  validatePackDefinition,
} from "../../domain/packs/compilation";
import {
  readRequiredBookId,
  resolveBookIdContext,
  resolvePostingPlan as resolveDomainPostingPlan,
} from "../../domain/packs/posting-plan";
import type {
  CompiledPack,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
} from "../../domain/packs/types";
import { createDrizzleAccountingPacksRepository } from "../../infra/drizzle/repositories/accounting-repository";
import {
  assertAccountingBooksBelongToInternalOrganizations,
} from "../../infra/organizations/internal-ledger";
import { type AccountingRuntimeDeps } from "../shared/context";

export interface AccountingRuntime {
  compilePack: typeof compilePack;
  getDefaultCompiledPack: () => CompiledPack;
  activatePackForScope: (input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) => Promise<{
    packChecksum: string;
    scopeId: string;
    scopeType: string;
    effectiveAt: Date;
  }>;
  loadActiveCompiledPackForBook: (input?: {
    bookId?: string;
    at?: Date;
  }) => Promise<CompiledPack>;
  storeCompiledPackVersion: (input: {
    definition?: AccountingRuntimeDeps["defaultPackDefinition"];
    pack?: CompiledPack;
  }) => Promise<CompiledPack>;
  resolvePostingPlan: (
    input: ResolvePostingPlanInput,
  ) => Promise<ResolvePostingPlanResult>;
  validatePackDefinition: typeof validatePackDefinition;
}

const PACK_CACHE_TTL_MS = 60_000;
const PACK_SCOPE_TYPE_BOOK = "book";

interface CachedPackEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

export { compilePack, validatePackDefinition };

export function createAccountingRuntime(
  deps: AccountingRuntimeDeps,
): AccountingRuntime {
  const { db } = deps;
  const defaultCompiledPack = compilePack(deps.defaultPackDefinition);
  const packCache = new Map<string, CachedPackEntry>();

  function readCachedPack(key: string) {
    const cached = packCache.get(key);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt < Date.now()) {
      packCache.delete(key);
      return undefined;
    }

    return cached.value;
  }

  function writeCachedPack(key: string, value: CompiledPack | null) {
    packCache.set(key, {
      value,
      expiresAt: Date.now() + PACK_CACHE_TTL_MS,
    });
  }

  function requireDb() {
    if (!db) {
      throw new Error("Accounting runtime requires db for pack persistence");
    }

    return db;
  }

  async function storeCompiledPackVersion(input: {
    definition?: AccountingRuntimeDeps["defaultPackDefinition"];
    pack?: CompiledPack;
  }) {
    const runtimeDb = requireDb();
    const compiled =
      input.pack ??
      (input.definition ? compilePack(input.definition) : defaultCompiledPack);
    const { compiledJson } = serializeCompiledPack(compiled);
    let replacedChecksum: string | null = null;

    const stored = await runtimeDb.transaction(async (tx) => {
      const repository = createDrizzleAccountingPacksRepository(tx);
      const existing = await repository.findPackVersion({
        packKey: compiled.packKey,
        version: compiled.version,
      });

      if (!existing) {
        await repository.insertPackVersion({
          packKey: compiled.packKey,
          version: compiled.version,
          checksum: compiled.checksum,
          compiledJson,
        });
        return compiled;
      }

      const existingPack = hydrateCompiledPack(existing.compiledJson);
      const checksumMatches = existing.checksum === compiled.checksum;
      const payloadMatches = existingPack.checksum === compiled.checksum;

      if (checksumMatches && payloadMatches) {
        return existingPack;
      }

      if (!checksumMatches) {
        const checksumAssigned = await repository.hasAssignmentsForPackChecksum(
          existing.checksum,
        );
        if (checksumAssigned) {
          throw new AccountingPackVersionConflictError(
            compiled.packKey,
            compiled.version,
            existing.checksum,
            compiled.checksum,
          );
        }
      }

      await repository.updatePackVersion({
        packKey: compiled.packKey,
        version: compiled.version,
        checksum: compiled.checksum,
        compiledJson,
        compiledAt: new Date(),
      });

      if (existing.checksum !== compiled.checksum) {
        replacedChecksum = existing.checksum;
      }

      return compiled;
    });

    if (replacedChecksum) {
      writeCachedPack(replacedChecksum, null);
    }
    writeCachedPack(stored.checksum, stored);
    return stored;
  }

  async function loadCompiledPackByChecksum(checksum: string) {
    const runtimeDb = requireDb();
    const repository = createDrizzleAccountingPacksRepository(runtimeDb);
    const cached = readCachedPack(checksum);
    if (typeof cached !== "undefined") {
      return cached;
    }

    const row = await repository.findPackByChecksum(checksum);
    if (!row) {
      writeCachedPack(checksum, null);
      return null;
    }

    const pack = hydrateCompiledPack(row.compiledJson);
    writeCachedPack(checksum, pack);
    if (pack.checksum !== checksum) {
      writeCachedPack(pack.checksum, pack);
    }
    return pack;
  }

  async function activatePackForScope(input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) {
    const runtimeDb = requireDb();
    const repository = createDrizzleAccountingPacksRepository(runtimeDb);
    const pack = await loadCompiledPackByChecksum(input.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(input.packChecksum);
    }

    const scopeType = input.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = input.effectiveAt ?? new Date();

    await repository.insertPackAssignment({
      scopeType,
      scopeId: input.scopeId,
      packChecksum: input.packChecksum,
      effectiveAt,
    });

    writeCachedPack(
      `scope:${scopeType}:${input.scopeId}:${effectiveAt.toISOString()}`,
      pack,
    );

    return {
      packChecksum: input.packChecksum,
      scopeId: input.scopeId,
      scopeType,
      effectiveAt,
    };
  }

  async function loadActiveCompiledPackForBook(input?: {
    bookId?: string;
    at?: Date;
  }) {
    if (!input?.bookId) {
      throw new AccountingPostingPlanValidationError(
        "Active pack lookup requires bookId",
      );
    }

    if (!db) {
      return defaultCompiledPack;
    }

    const at = input.at ?? new Date();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${input.bookId}:${at.toISOString()}`;
    const cached = readCachedPack(scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const repository = createDrizzleAccountingPacksRepository(db);
    const assignment = await repository.findActivePackAssignment({
      scopeType: PACK_SCOPE_TYPE_BOOK,
      scopeId: input.bookId,
      effectiveAt: at,
    });

    if (!assignment) {
      writeCachedPack(scopeCacheKey, defaultCompiledPack);
      return defaultCompiledPack;
    }

    const pack = await loadCompiledPackByChecksum(assignment.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(assignment.packChecksum);
    }

    writeCachedPack(scopeCacheKey, pack);
    return pack;
  }

  async function resolvePostingPlan(input: ResolvePostingPlanInput) {
    const bookId = resolveBookIdContext(input);

    if (db) {
      const requestBookIds = Array.from(
        new Set(input.plan.requests.map((request) => readRequiredBookId(request))),
      );
      await assertAccountingBooksBelongToInternalOrganizations({
        db,
        bookIds: requestBookIds,
      });
    }

    const pack =
      input.pack ??
      (await loadActiveCompiledPackForBook({
        bookId,
        at: input.at ?? input.postingDate,
      }));
    return resolveDomainPostingPlan(input, pack);
  }

  return {
    compilePack,
    activatePackForScope,
    getDefaultCompiledPack: () => defaultCompiledPack,
    loadActiveCompiledPackForBook,
    storeCompiledPackVersion,
    resolvePostingPlan,
    validatePackDefinition,
  };
}

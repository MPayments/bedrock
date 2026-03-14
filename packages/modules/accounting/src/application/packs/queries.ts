import {
  PACK_SCOPE_TYPE_BOOK,
  readCachedPack,
  requireRepository,
  writeCachedPack,
  type AccountingPacksContext,
} from "./types";
import {
  AccountingPackNotFoundError,
  AccountingPostingPlanValidationError,
} from "../../domain/errors";
import {
  hydrateCompiledPack,
  readRequiredBookId,
  resolveBookIdContext,
  resolvePostingPlan as resolveDomainPostingPlan,
  type CompiledPack,
  type ResolvePostingPlanInput,
} from "../../domain/packs";

export function createLoadCompiledPackByChecksumQuery(input: {
  context: AccountingPacksContext;
}) {
  const { context } = input;

  return async function loadCompiledPackByChecksum(checksum: string) {
    const runtimeRepository = requireRepository(context);
    const cached = readCachedPack(context, checksum);
    if (typeof cached !== "undefined") {
      return cached;
    }

    const row = await runtimeRepository.findPackByChecksum(checksum);
    if (!row) {
      writeCachedPack(context, checksum, null);
      return null;
    }

    const pack = hydrateCompiledPack(row.compiledJson);
    writeCachedPack(context, checksum, pack);
    if (pack.checksum !== checksum) {
      writeCachedPack(context, pack.checksum, pack);
    }
    return pack;
  };
}

export function createLoadActiveCompiledPackForBookQuery(input: {
  context: AccountingPacksContext;
  loadCompiledPackByChecksum: (checksum: string) => Promise<CompiledPack | null>;
}) {
  const { context, loadCompiledPackByChecksum } = input;

  return async function loadActiveCompiledPackForBook(query?: {
    bookId?: string;
    at?: Date;
  }) {
    if (!query?.bookId) {
      throw new AccountingPostingPlanValidationError(
        "Active pack lookup requires bookId",
      );
    }

    if (!context.repository) {
      return context.defaultCompiledPack;
    }

    const at = query.at ?? new Date();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${query.bookId}:${at.toISOString()}`;
    const cached = readCachedPack(context, scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const assignment = await context.repository.findActivePackAssignment({
      scopeType: PACK_SCOPE_TYPE_BOOK,
      scopeId: query.bookId,
      effectiveAt: at,
    });

    if (!assignment) {
      writeCachedPack(context, scopeCacheKey, context.defaultCompiledPack);
      return context.defaultCompiledPack;
    }

    const pack = await loadCompiledPackByChecksum(assignment.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(assignment.packChecksum);
    }

    writeCachedPack(context, scopeCacheKey, pack);
    return pack;
  };
}

export function createResolvePostingPlanQuery(input: {
  context: AccountingPacksContext;
  loadActiveCompiledPackForBook: (query?: {
    bookId?: string;
    at?: Date;
  }) => Promise<CompiledPack>;
}) {
  const { context, loadActiveCompiledPackForBook } = input;

  return async function resolvePostingPlan(query: ResolvePostingPlanInput) {
    const bookId = resolveBookIdContext(query);

    if (context.assertBooksBelongToInternalLedgerOrganizations) {
      const requestBookIds = Array.from(
        new Set(query.plan.requests.map((request) => readRequiredBookId(request))),
      );
      await context.assertBooksBelongToInternalLedgerOrganizations(
        requestBookIds,
      );
    }

    const pack =
      query.pack ??
      (await loadActiveCompiledPackForBook({
        bookId,
        at: query.at ?? query.postingDate,
      }));
    return resolveDomainPostingPlan(query, pack);
  };
}

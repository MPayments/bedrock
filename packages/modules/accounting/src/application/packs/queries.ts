import {
  PACK_SCOPE_TYPE_BOOK,
  readCachedPack,
  requirePacksQueryRepository,
  writeCachedPack,
  type AccountingPacksContext,
} from "./context";
import { rethrowAccountingPacksDomainError } from "./map-domain-error";
import {
  hydrateCompiledPack,
  readRequiredBookId,
  resolveBookIdContext,
  resolvePostingPlan as resolveDomainPostingPlan,
  type CompiledPack,
  type ResolvePostingPlanInput,
} from "../../domain/packs";
import {
  AccountingPackNotFoundError,
  AccountingPostingPlanValidationError,
} from "../../errors";

export function createLoadCompiledPackByChecksumQuery(input: {
  context: AccountingPacksContext;
}) {
  const { context } = input;

  return async function loadCompiledPackByChecksum(checksum: string) {
    try {
      const repository = requirePacksQueryRepository(context);
      const cached = readCachedPack(context, checksum);
      if (typeof cached !== "undefined") {
        return cached;
      }

      const row = await repository.findPackByChecksum(checksum);
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
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
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

    if (!context.queries) {
      return context.defaultCompiledPack;
    }

    const at = query.at ?? context.now();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${query.bookId}:${at.toISOString()}`;
    const cached = readCachedPack(context, scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const assignment = await context.queries.findActivePackAssignment({
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
    try {
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
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
  };
}

import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  AccountingReportsContext,
  LiquidityRow,
} from "./types";
import {
  normalizeReportCurrency,
} from "../../../../domain/reports";
import {
  LiquidityQuerySchema,
  type LiquidityQuery,
} from "../reports-validation";

export function createListLiquidityHandler(context: AccountingReportsContext) {
  return async function listLiquidity(
    input?: LiquidityQuery,
  ): Promise<PaginatedList<LiquidityRow> & {
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = LiquidityQuerySchema.parse(input ?? {});
    const limit = query.limit;
    const offset = query.offset;

    const scope = await context.resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    if (
      (scope.scopeType === "counterparty" || scope.scopeType === "group") &&
      scope.resolvedCounterpartyIds.length === 0
    ) {
      return {
        data: [],
        total: 0,
        limit,
        offset,
        scopeMeta: context.buildScopeMeta({
          scope,
          attributionMode: query.attributionMode,
          hasUnattributedData: false,
        }),
      };
    }

    const mapped: LiquidityRow[] = await context.fetchLiquidityRows({
      scope,
      attributionMode: query.attributionMode,
      currency: normalizeReportCurrency(query.currency),
    });

    const sorted = sortInMemory(mapped, {
      sortMap: {
        book: (row: LiquidityRow) => row.bookLabel,
      },
      sortBy: "book",
      sortOrder: "asc",
    });

    const paginated = paginateInMemory(sorted, {
      limit,
      offset,
    });

    return {
      ...paginated,
      scopeMeta: context.buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: false,
      }),
    };
  };
}

import {
  paginateInMemory,
  resolveSortOrder,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  AccountingReportsContext,
  FinancialResultStatus,
  TrialBalanceRow,
  TrialBalanceSummaryByCurrency,
} from "./types";
import { normalizeCurrency } from "../../../../domain/reports/normalization";
import {
  TrialBalanceQuerySchema,
  type TrialBalanceQuery,
} from "../reports-validation";

export function createListTrialBalanceHandler(context: AccountingReportsContext) {
  return async function listTrialBalance(
    input?: TrialBalanceQuery,
  ): Promise<PaginatedList<TrialBalanceRow> & {
    summaryByCurrency: TrialBalanceSummaryByCurrency[];
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = TrialBalanceQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);
    const scope = await context.resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await context.fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const totals = new Map<
      string,
      {
        accountNo: string;
        currency: string;
        openingDebitMinor: bigint;
        openingCreditMinor: bigint;
        periodDebitMinor: bigint;
        periodCreditMinor: bigint;
      }
    >();

    for (const posting of postings) {
      const isOpening = posting.postingDate < from;
      const isPeriod = posting.postingDate >= from && posting.postingDate <= to;

      if (!isOpening && !isPeriod) {
        continue;
      }

      const debitKey = context.keyByParts(posting.debitAccountNo, posting.currency);
      const debitBucket = totals.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
      };
      if (isOpening) {
        debitBucket.openingDebitMinor += posting.amountMinor;
      }
      if (isPeriod) {
        debitBucket.periodDebitMinor += posting.amountMinor;
      }
      totals.set(debitKey, debitBucket);

      const creditKey = context.keyByParts(posting.creditAccountNo, posting.currency);
      const creditBucket = totals.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
      };
      if (isOpening) {
        creditBucket.openingCreditMinor += posting.amountMinor;
      }
      if (isPeriod) {
        creditBucket.periodCreditMinor += posting.amountMinor;
      }
      totals.set(creditKey, creditBucket);
    }

    const accountMeta = await context.fetchAccountMeta(
      Array.from(new Set(Array.from(totals.values()).map((row) => row.accountNo))),
    );

    const rows: TrialBalanceRow[] = Array.from(totals.values()).map((row) => {
      const closingNetMinor =
        row.openingDebitMinor -
        row.openingCreditMinor +
        row.periodDebitMinor -
        row.periodCreditMinor;

      return {
        accountNo: row.accountNo,
        accountName: accountMeta.get(row.accountNo)?.name ?? null,
        accountKind: accountMeta.get(row.accountNo)?.kind ?? null,
        currency: row.currency,
        openingDebitMinor: row.openingDebitMinor,
        openingCreditMinor: row.openingCreditMinor,
        periodDebitMinor: row.periodDebitMinor,
        periodCreditMinor: row.periodCreditMinor,
        closingDebitMinor: closingNetMinor >= 0n ? closingNetMinor : 0n,
        closingCreditMinor: closingNetMinor < 0n ? -closingNetMinor : 0n,
      };
    });

    const sortMap = {
      accountNo: (row: TrialBalanceRow) => row.accountNo,
      accountName: (row: TrialBalanceRow) => row.accountName ?? "",
      currency: (row: TrialBalanceRow) => row.currency,
      openingDebitMinor: (row: TrialBalanceRow) => row.openingDebitMinor,
      openingCreditMinor: (row: TrialBalanceRow) => row.openingCreditMinor,
      periodDebitMinor: (row: TrialBalanceRow) => row.periodDebitMinor,
      periodCreditMinor: (row: TrialBalanceRow) => row.periodCreditMinor,
      closingDebitMinor: (row: TrialBalanceRow) => row.closingDebitMinor,
      closingCreditMinor: (row: TrialBalanceRow) => row.closingCreditMinor,
    };

    const sortedRows = sortInMemory(rows, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    });
    const paginated = paginateInMemory(sortedRows, {
      limit: query.limit,
      offset: query.offset,
    });

    const summaryByCurrencyMap = new Map<string, TrialBalanceSummaryByCurrency>();
    for (const row of rows) {
      const existing = summaryByCurrencyMap.get(row.currency) ?? {
        currency: row.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
        closingDebitMinor: 0n,
        closingCreditMinor: 0n,
      };
      existing.openingDebitMinor += row.openingDebitMinor;
      existing.openingCreditMinor += row.openingCreditMinor;
      existing.periodDebitMinor += row.periodDebitMinor;
      existing.periodCreditMinor += row.periodCreditMinor;
      existing.closingDebitMinor += row.closingDebitMinor;
      existing.closingCreditMinor += row.closingCreditMinor;
      summaryByCurrencyMap.set(row.currency, existing);
    }

    return {
      ...paginated,
      summaryByCurrency: Array.from(summaryByCurrencyMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: context.buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((row) => row.analyticCounterpartyId === null),
      }),
    };
  };
}

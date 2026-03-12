import type {
  AccountingReportsContext,
  FinancialResultStatus,
  FxRevaluationRow,
  FxRevaluationSummaryByCurrency,
} from "./types";
import { normalizeCurrency } from "../internal/normalization";
import {
  FxRevaluationQuerySchema,
  type FxRevaluationQuery,
} from "../reports-validation";

export function createListFxRevaluationHandler(context: AccountingReportsContext) {
  return async function listFxRevaluation(
    input?: FxRevaluationQuery,
  ): Promise<{
    data: FxRevaluationRow[];
    summaryByCurrency: FxRevaluationSummaryByCurrency[];
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = FxRevaluationQuerySchema.parse(input ?? {});
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
      from,
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const accountSet = Array.from(
      new Set(postings.flatMap((item) => [item.debitAccountNo, item.creditAccountNo])),
    );
    const accountMeta = await context.fetchAccountMeta(accountSet);

    const rowsByBucket = new Map<string, FxRevaluationRow>();

    for (const posting of postings) {
      const bucket: "realized" | "unrealized" =
        posting.documentType === "revaluation_adjustment" ? "unrealized" : "realized";
      const key = context.keyByParts(bucket, posting.currency);
      const current = rowsByBucket.get(key) ?? {
        bucket,
        currency: posting.currency,
        revenueMinor: 0n,
        expenseMinor: 0n,
        netMinor: 0n,
      };

      const debitKind = accountMeta.get(posting.debitAccountNo)?.kind;
      const creditKind = accountMeta.get(posting.creditAccountNo)?.kind;

      if (debitKind === "revenue") {
        current.revenueMinor -= posting.amountMinor;
      } else if (debitKind === "expense") {
        current.expenseMinor += posting.amountMinor;
      }

      if (creditKind === "revenue") {
        current.revenueMinor += posting.amountMinor;
      } else if (creditKind === "expense") {
        current.expenseMinor -= posting.amountMinor;
      }

      current.netMinor = current.revenueMinor - current.expenseMinor;
      rowsByBucket.set(key, current);
    }

    const rows = Array.from(rowsByBucket.values()).sort((a, b) =>
      context.keyByParts(a.currency, a.bucket).localeCompare(context.keyByParts(b.currency, b.bucket)),
    );

    const summaryMap = new Map<string, FxRevaluationSummaryByCurrency>();
    for (const row of rows) {
      const summary = summaryMap.get(row.currency) ?? {
        currency: row.currency,
        realizedNetMinor: 0n,
        unrealizedNetMinor: 0n,
        totalNetMinor: 0n,
      };

      if (row.bucket === "realized") {
        summary.realizedNetMinor += row.netMinor;
      } else {
        summary.unrealizedNetMinor += row.netMinor;
      }

      summary.totalNetMinor = summary.realizedNetMinor + summary.unrealizedNetMinor;
      summaryMap.set(row.currency, summary);
    }

    return {
      data: rows,
      summaryByCurrency: Array.from(summaryMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: context.buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
    };
  };
}

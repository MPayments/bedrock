import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  AccountingReportsContext,
  FeeRevenueRow,
  FeeRevenueSummaryByCurrency,
  ReportScopeMeta,
} from "./types";
import {
  FeeRevenueQuerySchema,
  type FeeRevenueQuery,
} from "../reports-validation";
import { fetchScopedReportPostings } from "./shared";

export class ListFeeRevenueReportQuery {
  constructor(private readonly context: AccountingReportsContext) {}

  async execute(input?: FeeRevenueQuery): Promise<
    PaginatedList<FeeRevenueRow> & {
      summaryByCurrency: FeeRevenueSummaryByCurrency[];
      scopeMeta: ReportScopeMeta;
    }
  > {
    const context = this.context;
    const query = FeeRevenueQuerySchema.parse(input ?? {});
    const limit = query.limit;
    const offset = query.offset;
    const from = new Date(query.from);
    const to = new Date(query.to);
    const { postings, scopeMeta } = await fetchScopedReportPostings(context, {
      query,
      from,
      to,
    });

    const byDimension = new Map<string, FeeRevenueRow>();
    const counterpartyIds = new Set<string>();

    for (const posting of postings) {
      const counterpartyId =
        query.attributionMode === "analytic_counterparty"
          ? posting.analyticCounterpartyId
          : posting.bookCounterpartyId;

      if (!query.includeUnattributed && !counterpartyId) {
        continue;
      }

      if (counterpartyId) {
        counterpartyIds.add(counterpartyId);
      }

      const product = posting.documentType ?? "unknown";
      const channel = posting.channel ?? "unknown";
      const key = context.keyByParts(
        product,
        channel,
        counterpartyId,
        posting.currency,
      );
      const row = byDimension.get(key) ?? {
        product,
        channel,
        counterpartyId,
        counterpartyName: null,
        currency: posting.currency,
        feeRevenueMinor: 0n,
        spreadRevenueMinor: 0n,
        providerFeeExpenseMinor: 0n,
        netMinor: 0n,
      };

      if (posting.debitAccountNo === "4110") {
        row.feeRevenueMinor -= posting.amountMinor;
      }
      if (posting.creditAccountNo === "4110") {
        row.feeRevenueMinor += posting.amountMinor;
      }

      if (posting.debitAccountNo === "4120") {
        row.spreadRevenueMinor -= posting.amountMinor;
      }
      if (posting.creditAccountNo === "4120") {
        row.spreadRevenueMinor += posting.amountMinor;
      }

      if (posting.debitAccountNo === "5120") {
        row.providerFeeExpenseMinor += posting.amountMinor;
      }
      if (posting.creditAccountNo === "5120") {
        row.providerFeeExpenseMinor -= posting.amountMinor;
      }

      row.netMinor =
        row.feeRevenueMinor +
        row.spreadRevenueMinor -
        row.providerFeeExpenseMinor;
      byDimension.set(key, row);
    }

    const counterpartyNames = await context.fetchCounterpartyNames(
      Array.from(counterpartyIds),
    );

    const rows = Array.from(byDimension.values()).map((row) => ({
      ...row,
      counterpartyName: row.counterpartyId
        ? (counterpartyNames.get(row.counterpartyId) ?? null)
        : null,
    }));

    const sorted = sortInMemory(rows, {
      sortBy: "net",
      sortOrder: "desc",
      sortMap: {
        net: (row: FeeRevenueRow) => row.netMinor,
      },
    });

    const paginated = paginateInMemory(sorted, {
      limit,
      offset,
    });

    const summaryMap = new Map<string, FeeRevenueSummaryByCurrency>();
    for (const row of rows) {
      const summary = summaryMap.get(row.currency) ?? {
        currency: row.currency,
        feeRevenueMinor: 0n,
        spreadRevenueMinor: 0n,
        providerFeeExpenseMinor: 0n,
        netMinor: 0n,
      };

      summary.feeRevenueMinor += row.feeRevenueMinor;
      summary.spreadRevenueMinor += row.spreadRevenueMinor;
      summary.providerFeeExpenseMinor += row.providerFeeExpenseMinor;
      summary.netMinor += row.netMinor;
      summaryMap.set(row.currency, summary);
    }

    return {
      ...paginated,
      summaryByCurrency: Array.from(summaryMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta,
    };
  }
}

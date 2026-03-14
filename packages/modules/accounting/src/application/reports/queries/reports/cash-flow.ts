import type {
  AccountingReportsContext,
  CashFlowRow,
  CashFlowSummaryByCurrency,
} from "./types";
import {
  CashFlowQuerySchema,
  type IncomeStatementQuery,
  type CashFlowQuery,
} from "../reports-validation";
import type { createComputeIncomeStatementCoreHandler } from "./income-statement";
import { fetchScopedReportPostings, sortRowsByContextParts } from "./shared";

export function createListCashFlowHandler(input: {
  context: AccountingReportsContext;
  computeIncomeStatementCore: ReturnType<
    typeof createComputeIncomeStatementCoreHandler
  >;
}) {
  const { context, computeIncomeStatementCore } = input;

  return async function listCashFlow(inputQuery?: CashFlowQuery): Promise<{
    method: "direct" | "indirect";
    data: CashFlowRow[];
    summaryByCurrency: CashFlowSummaryByCurrency[];
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = CashFlowQuerySchema.parse(inputQuery ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);
    const { postings, scopeMeta } = await fetchScopedReportPostings(context, {
      query,
      from,
      to,
    });

    const movements = context.computeAccountNetMovements(postings);
    const reportKind =
      query.method === "direct" ? "cash_flow_direct" : "cash_flow_indirect";
    const mappings = await context.fetchLineMappings(reportKind, to);

    const rowsByLine = new Map<string, CashFlowRow>();
    const summaryByCurrency = new Map<string, CashFlowSummaryByCurrency>();

    if (query.method === "indirect") {
      const income = await computeIncomeStatementCore({
        query: {
          ...query,
          from: query.from,
          to: query.to,
        } as IncomeStatementQuery,
      });

      for (const summary of income.summaryByCurrency) {
        const key = context.keyByParts(
          "indirect",
          "CFI.NET_PROFIT",
          summary.currency,
        );
        rowsByLine.set(key, {
          section: "indirect",
          lineCode: "CFI.NET_PROFIT",
          lineLabel: "Net profit",
          currency: summary.currency,
          amountMinor: summary.netMinor,
        });

        summaryByCurrency.set(summary.currency, {
          currency: summary.currency,
          netCashFlowMinor: summary.netMinor,
        });
      }
    }

    for (const movement of movements.values()) {
      const targets = mappings.get(movement.accountNo) ?? [];
      if (targets.length === 0) {
        continue;
      }

      for (const mapping of targets) {
        const key = context.keyByParts(
          mapping.section,
          mapping.lineCode,
          movement.currency,
        );
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: movement.currency,
          amountMinor: 0n,
        };
        existing.amountMinor +=
          movement.netMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);

        const summary = summaryByCurrency.get(movement.currency) ?? {
          currency: movement.currency,
          netCashFlowMinor: 0n,
        };
        summary.netCashFlowMinor +=
          movement.netMinor * BigInt(mapping.signMultiplier);
        summaryByCurrency.set(movement.currency, summary);
      }
    }

    return {
      method: query.method,
      data: sortRowsByContextParts(context, rowsByLine.values(), (row) => [
        row.section,
        row.lineCode,
        row.currency,
      ]),
      summaryByCurrency: Array.from(summaryByCurrency.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta,
    };
  };
}

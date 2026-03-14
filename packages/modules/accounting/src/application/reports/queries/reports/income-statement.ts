import type {
  AccountingReportsContext,
  FinancialResultStatus,
  IncomeStatementRow,
  IncomeStatementSummaryByCurrency,
  ScopedPosting,
} from "./types";
import { normalizeReportCurrency } from "../../../../domain/reports";
import {
  IncomeStatementQuerySchema,
  type IncomeStatementQuery,
} from "../reports-validation";

export function createComputeIncomeStatementCoreHandler(
  context: AccountingReportsContext,
) {
  return async function computeIncomeStatementCore(input: {
    query: IncomeStatementQuery;
  }): Promise<{
    rows: IncomeStatementRow[];
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
    postings: ScopedPosting[];
  }> {
    const query = input.query;
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
      currency: normalizeReportCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const accountSet = new Set<string>();
    for (const posting of postings) {
      accountSet.add(posting.debitAccountNo);
      accountSet.add(posting.creditAccountNo);
    }

    const accountMeta = await context.fetchAccountMeta(Array.from(accountSet));
    const mappings = await context.fetchLineMappings("income_statement", to);

    const amountByAccountCurrency = new Map<
      string,
      { accountNo: string; currency: string; amountMinor: bigint; kind: string }
    >();

    for (const posting of postings) {
      const debitKind = accountMeta.get(posting.debitAccountNo)?.kind;
      const creditKind = accountMeta.get(posting.creditAccountNo)?.kind;

      if (debitKind === "revenue" || debitKind === "expense") {
        const key = context.keyByParts(posting.debitAccountNo, posting.currency);
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.debitAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: debitKind,
        };
        if (debitKind === "revenue") {
          current.amountMinor -= posting.amountMinor;
        } else {
          current.amountMinor += posting.amountMinor;
        }
        amountByAccountCurrency.set(key, current);
      }

      if (creditKind === "revenue" || creditKind === "expense") {
        const key = context.keyByParts(posting.creditAccountNo, posting.currency);
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.creditAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: creditKind,
        };
        if (creditKind === "revenue") {
          current.amountMinor += posting.amountMinor;
        } else {
          current.amountMinor -= posting.amountMinor;
        }
        amountByAccountCurrency.set(key, current);
      }
    }

    const rowsByLine = new Map<string, IncomeStatementRow>();
    const summaryByCurrencyMap = new Map<string, IncomeStatementSummaryByCurrency>();

    for (const row of amountByAccountCurrency.values()) {
      const defaults = mappings.get(row.accountNo) ?? [
        {
          lineCode: row.accountNo,
          lineLabel: accountMeta.get(row.accountNo)?.name ?? row.accountNo,
          section: row.kind === "revenue" ? "revenue" : "expense",
          accountNo: row.accountNo,
          signMultiplier: 1,
        },
      ];

      for (const mapping of defaults) {
        const key = context.keyByParts(mapping.section, mapping.lineCode, row.currency);
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: row.currency,
          amountMinor: 0n,
        };
        existing.amountMinor += row.amountMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);
      }

      const summary = summaryByCurrencyMap.get(row.currency) ?? {
        currency: row.currency,
        revenueMinor: 0n,
        expenseMinor: 0n,
        netMinor: 0n,
      };
      if (row.kind === "revenue") {
        summary.revenueMinor += row.amountMinor;
      } else {
        summary.expenseMinor += row.amountMinor;
      }
      summary.netMinor = summary.revenueMinor - summary.expenseMinor;
      summaryByCurrencyMap.set(row.currency, summary);
    }

    return {
      rows: Array.from(rowsByLine.values()).sort((a, b) =>
        context
          .keyByParts(a.section, a.lineCode, a.currency)
          .localeCompare(context.keyByParts(b.section, b.lineCode, b.currency)),
      ),
      summaryByCurrency: Array.from(summaryByCurrencyMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: context.buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
      postings,
    };
  };
}

export function createListIncomeStatementHandler(input: {
  computeIncomeStatementCore: ReturnType<typeof createComputeIncomeStatementCoreHandler>;
}) {
  return async function listIncomeStatement(
    inputQuery?: IncomeStatementQuery,
  ): Promise<{
    data: IncomeStatementRow[];
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
    scopeMeta: Awaited<
      ReturnType<ReturnType<typeof createComputeIncomeStatementCoreHandler>>
    >["scopeMeta"];
  }> {
    const query = IncomeStatementQuerySchema.parse(inputQuery ?? {});
    const result = await input.computeIncomeStatementCore({ query });

    return {
      data: result.rows,
      summaryByCurrency: result.summaryByCurrency,
      scopeMeta: result.scopeMeta,
    };
  };
}

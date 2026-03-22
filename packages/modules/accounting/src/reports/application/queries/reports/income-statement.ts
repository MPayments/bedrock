import type {
  AccountingReportsContext,
  IncomeStatementRow,
  IncomeStatementSummaryByCurrency,
  ReportScopeMeta,
  ScopedPosting,
} from "./types";
import { resolveRevenueExpenseEffect } from "../../../domain";
import {
  IncomeStatementQuerySchema,
  type IncomeStatementQuery,
} from "../reports-validation";
import { fetchScopedReportPostings, sortRowsByContextParts } from "./shared";

export interface IncomeStatementCoreResult {
  rows: IncomeStatementRow[];
  summaryByCurrency: IncomeStatementSummaryByCurrency[];
  scopeMeta: ReportScopeMeta;
  postings: ScopedPosting[];
}

export class ComputeIncomeStatementCoreQuery {
  constructor(private readonly context: AccountingReportsContext) {}

  async execute(input: {
    query: IncomeStatementQuery;
  }): Promise<IncomeStatementCoreResult> {
    const context = this.context;
    const { query } = input;
    const from = new Date(query.from);
    const to = new Date(query.to);
    const { postings, scopeMeta } = await fetchScopedReportPostings(context, {
      query,
      from,
      to,
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

      const debitEffect = resolveRevenueExpenseEffect({
        kind: debitKind,
        side: "debit",
        amountMinor: posting.amountMinor,
      });
      if (debitEffect) {
        const key = context.keyByParts(
          posting.debitAccountNo,
          posting.currency,
        );
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.debitAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: debitEffect.kind,
        };
        current.amountMinor += debitEffect.amountMinor;
        amountByAccountCurrency.set(key, current);
      }

      const creditEffect = resolveRevenueExpenseEffect({
        kind: creditKind,
        side: "credit",
        amountMinor: posting.amountMinor,
      });
      if (creditEffect) {
        const key = context.keyByParts(
          posting.creditAccountNo,
          posting.currency,
        );
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.creditAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: creditEffect.kind,
        };
        current.amountMinor += creditEffect.amountMinor;
        amountByAccountCurrency.set(key, current);
      }
    }

    const rowsByLine = new Map<string, IncomeStatementRow>();
    const summaryByCurrencyMap = new Map<
      string,
      IncomeStatementSummaryByCurrency
    >();

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
        const key = context.keyByParts(
          mapping.section,
          mapping.lineCode,
          row.currency,
        );
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: row.currency,
          amountMinor: 0n,
        };
        existing.amountMinor +=
          row.amountMinor * BigInt(mapping.signMultiplier);
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
      rows: sortRowsByContextParts(context, rowsByLine.values(), (row) => [
        row.section,
        row.lineCode,
        row.currency,
      ]),
      summaryByCurrency: Array.from(summaryByCurrencyMap.values()).sort(
        (a, b) => a.currency.localeCompare(b.currency),
      ),
      scopeMeta,
      postings,
    };
  }
}

export class ListIncomeStatementReportQuery {
  constructor(
    private readonly computeIncomeStatementCore: ComputeIncomeStatementCoreQuery,
  ) {}

  async execute(inputQuery?: IncomeStatementQuery): Promise<{
    data: IncomeStatementRow[];
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
    scopeMeta: IncomeStatementCoreResult["scopeMeta"];
  }> {
    const query = IncomeStatementQuerySchema.parse(inputQuery ?? {});
    const result = await this.computeIncomeStatementCore.execute({ query });

    return {
      data: result.rows,
      summaryByCurrency: result.summaryByCurrency,
      scopeMeta: result.scopeMeta,
    };
  }
}

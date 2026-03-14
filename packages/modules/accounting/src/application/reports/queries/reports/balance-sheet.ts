import type {
  AccountingReportsContext,
  BalanceSheetCheck,
  BalanceSheetRow,
} from "./types";
import {
  BalanceSheetQuerySchema,
  type BalanceSheetQuery,
} from "../reports-validation";
import { fetchScopedReportPostings, sortRowsByContextParts } from "./shared";

export function createListBalanceSheetHandler(
  context: AccountingReportsContext,
) {
  return async function listBalanceSheet(input?: BalanceSheetQuery): Promise<{
    data: BalanceSheetRow[];
    checks: BalanceSheetCheck[];
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = BalanceSheetQuerySchema.parse(input ?? {});
    const asOf = new Date(query.asOf);
    const { postings, scopeMeta } = await fetchScopedReportPostings(context, {
      query,
      asOf,
    });

    const netByAccountCurrency = new Map<
      string,
      { accountNo: string; currency: string; netMinor: bigint }
    >();

    for (const posting of postings) {
      const debitKey = context.keyByParts(
        posting.debitAccountNo,
        posting.currency,
      );
      const debit = netByAccountCurrency.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      debit.netMinor += posting.amountMinor;
      netByAccountCurrency.set(debitKey, debit);

      const creditKey = context.keyByParts(
        posting.creditAccountNo,
        posting.currency,
      );
      const credit = netByAccountCurrency.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      credit.netMinor -= posting.amountMinor;
      netByAccountCurrency.set(creditKey, credit);
    }

    const accountMeta = await context.fetchAccountMeta(
      Array.from(
        new Set(
          Array.from(netByAccountCurrency.values()).map((row) => row.accountNo),
        ),
      ),
    );
    const lineMappings = await context.fetchLineMappings("balance_sheet", asOf);

    const rowsByLine = new Map<string, BalanceSheetRow>();

    for (const row of netByAccountCurrency.values()) {
      const meta = accountMeta.get(row.accountNo);
      const kind = meta?.kind;

      if (!kind) {
        continue;
      }

      let presentedMinor = row.netMinor;
      if (kind === "liability" || kind === "equity") {
        presentedMinor = -presentedMinor;
      }

      const mappings = lineMappings.get(row.accountNo) ?? [
        {
          lineCode: row.accountNo,
          lineLabel: meta.name,
          section:
            kind === "liability"
              ? "liabilities"
              : kind === "equity"
                ? "equity"
                : "assets",
          accountNo: row.accountNo,
          signMultiplier: 1,
        },
      ];

      for (const mapping of mappings) {
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
        existing.amountMinor += presentedMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);
      }
    }

    const rows = sortRowsByContextParts(context, rowsByLine.values(), (row) => [
      row.section,
      row.lineCode,
      row.currency,
    ]);

    const checksByCurrency = new Map<
      string,
      { assetsMinor: bigint; liabilitiesMinor: bigint; equityMinor: bigint }
    >();
    for (const row of rows) {
      const existing = checksByCurrency.get(row.currency) ?? {
        assetsMinor: 0n,
        liabilitiesMinor: 0n,
        equityMinor: 0n,
      };

      if (row.section === "assets") {
        existing.assetsMinor += row.amountMinor;
      } else if (row.section === "liabilities") {
        existing.liabilitiesMinor += row.amountMinor;
      } else if (row.section === "equity") {
        existing.equityMinor += row.amountMinor;
      }

      checksByCurrency.set(row.currency, existing);
    }

    const checks: BalanceSheetCheck[] = Array.from(checksByCurrency.entries())
      .map(([currency, value]) => ({
        currency,
        assetsMinor: value.assetsMinor,
        liabilitiesMinor: value.liabilitiesMinor,
        equityMinor: value.equityMinor,
        imbalanceMinor:
          value.assetsMinor - (value.liabilitiesMinor + value.equityMinor),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    return {
      data: rows,
      checks,
      scopeMeta,
    };
  };
}

import { and, eq, inArray, sql } from "drizzle-orm";

import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as accountingCloseSchema } from "@bedrock/accounting-close/schema";
import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as counterpartiesSchema } from "@bedrock/parties/counterparties/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as organizationsSchema } from "@bedrock/parties/organizations/schema";
import { schema as requisitesSchema } from "@bedrock/parties/requisites/schema";
import type { Database } from "@bedrock/adapter-db-drizzle/db/types";

import type { LineMapping, ScopedPosting } from "../reports/types";
import { schema as reportingSchema } from "../schema";

type ReportingQuerySchema = typeof accountingSchema &
  typeof accountingCloseSchema &
  typeof counterpartiesSchema &
  typeof documentsSchema &
  typeof ledgerSchema &
  typeof organizationsSchema &
  typeof requisitesSchema &
  typeof balancesSchema &
  typeof reportingSchema;

export const schema: ReportingQuerySchema = {
  ...accountingSchema,
  ...accountingCloseSchema,
  ...counterpartiesSchema,
  ...documentsSchema,
  ...ledgerSchema,
  ...organizationsSchema,
  ...requisitesSchema,
  ...balancesSchema,
  ...reportingSchema,
};

export function keyByParts(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => part ?? "").join("::");
}

export function createReportsSharedHelpers(db: Database) {
  async function fetchCounterpartyNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        id: schema.counterparties.id,
        shortName: schema.counterparties.shortName,
      })
      .from(schema.counterparties)
      .where(inArray(schema.counterparties.id, ids));

    return new Map(rows.map((row) => [row.id, row.shortName]));
  }

  async function fetchAccountMeta(
    accountNos: string[],
  ): Promise<Map<string, { name: string; kind: string }>> {
    if (accountNos.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        accountNo: schema.chartTemplateAccounts.accountNo,
        name: schema.chartTemplateAccounts.name,
        kind: schema.chartTemplateAccounts.kind,
      })
      .from(schema.chartTemplateAccounts)
      .where(inArray(schema.chartTemplateAccounts.accountNo, accountNos));

    return new Map(
      rows.map((row) => [row.accountNo, { name: row.name, kind: row.kind }]),
    );
  }

  async function fetchLineMappings(
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ): Promise<Map<string, LineMapping[]>> {
    const rows = await db
      .select({
        lineCode: schema.accountingReportLineMappings.lineCode,
        lineLabel: schema.accountingReportLineMappings.lineLabel,
        section: schema.accountingReportLineMappings.section,
        accountNo: schema.accountingReportLineMappings.accountNo,
        signMultiplier: schema.accountingReportLineMappings.signMultiplier,
      })
      .from(schema.accountingReportLineMappings)
      .where(
        and(
          eq(schema.accountingReportLineMappings.standard, "ifrs"),
          eq(schema.accountingReportLineMappings.reportKind, reportKind),
          sql`${schema.accountingReportLineMappings.effectiveFrom} <= ${asOf}`,
          sql`(${schema.accountingReportLineMappings.effectiveTo} IS NULL OR ${schema.accountingReportLineMappings.effectiveTo} > ${asOf})`,
        ),
      );

    const byAccount = new Map<string, LineMapping[]>();
    for (const row of rows) {
      const existing = byAccount.get(row.accountNo);
      const mapped = {
        lineCode: row.lineCode,
        lineLabel: row.lineLabel,
        section: row.section,
        accountNo: row.accountNo,
        signMultiplier: row.signMultiplier,
      };
      if (existing) {
        existing.push(mapped);
      } else {
        byAccount.set(row.accountNo, [mapped]);
      }
    }

    return byAccount;
  }

  function computeAccountNetMovements(
    postings: ScopedPosting[],
  ): Map<string, { accountNo: string; currency: string; netMinor: bigint }> {
    const movements = new Map<
      string,
      { accountNo: string; currency: string; netMinor: bigint }
    >();

    for (const posting of postings) {
      const debitKey = keyByParts(posting.debitAccountNo, posting.currency);
      const debit = movements.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      debit.netMinor += posting.amountMinor;
      movements.set(debitKey, debit);

      const creditKey = keyByParts(posting.creditAccountNo, posting.currency);
      const credit = movements.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      credit.netMinor -= posting.amountMinor;
      movements.set(creditKey, credit);
    }

    return movements;
  }

  return {
    fetchCounterpartyNames,
    fetchAccountMeta,
    fetchLineMappings,
    keyByParts,
    computeAccountNetMovements,
  };
}

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  AccountingClosePackageRecord,
} from "../../../domain/periods";
import type { LineMapping } from "../../../domain/reports";
import { schema } from "../schema";

type Queryable = Database | Transaction;

export interface AccountingReportsRepository {
  fetchAccountMeta: (
    accountNos: string[],
  ) => Promise<Map<string, { name: string; kind: string }>>;
  fetchLineMappings: (
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ) => Promise<Map<string, LineMapping[]>>;
  findLatestClosePackage: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<AccountingClosePackageRecord | null>;
}

export function createDrizzleAccountingReportsRepository(
  db: Queryable,
): AccountingReportsRepository {
  return {
    async fetchAccountMeta(accountNos) {
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
    },
    async fetchLineMappings(reportKind, asOf) {
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
    },
    async findLatestClosePackage({ organizationId, periodStart }) {
      const [row] = await db
        .select()
        .from(schema.accountingClosePackages)
        .where(
          and(
            eq(schema.accountingClosePackages.organizationId, organizationId),
            eq(schema.accountingClosePackages.periodStart, periodStart),
          ),
        )
        .orderBy(desc(schema.accountingClosePackages.revision))
        .limit(1);

      return (row as AccountingClosePackageRecord | undefined) ?? null;
    },
  };
}

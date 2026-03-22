import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { AccountingClosePackageRecord } from "../../../periods/domain";
import { schema } from "../../../schema";
import type { LineMapping } from "../../domain";

export class DrizzleReportsRepository {
  constructor(private readonly db: Queryable) {}

  async fetchAccountMeta(accountNos: string[]) {
    if (accountNos.length === 0) {
      return new Map();
    }

    const rows = await this.db
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

  async fetchLineMappings(
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ) {
    const rows = await this.db
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

  async findLatestClosePackage(input: {
    organizationId: string;
    periodStart: Date;
  }) {
    const [row] = await this.db
      .select()
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(
            schema.accountingClosePackages.organizationId,
            input.organizationId,
          ),
          eq(schema.accountingClosePackages.periodStart, input.periodStart),
        ),
      )
      .orderBy(desc(schema.accountingClosePackages.revision))
      .limit(1);

    if (!row) return null;

    return row as AccountingClosePackageRecord;
  }
}

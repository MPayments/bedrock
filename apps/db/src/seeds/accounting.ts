import {
  DEFAULT_ACCOUNT_DIMENSION_POLICIES,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
  DEFAULT_POSTING_CODE_DIMENSION_POLICIES,
  DEFAULT_REPORT_LINE_MAPPINGS,
  DEFAULT_REPORT_LINE_MAPPINGS_EFFECTIVE_FROM,
} from "@bedrock/accounting";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";

export async function seedAccounting(db: Database | Transaction) {
  for (const {
    accountNo,
    name,
    kind,
    normalSide,
    postingAllowed,
    enabled,
    parentAccountNo,
  } of DEFAULT_CHART_TEMPLATE_ACCOUNTS) {
    await db
      .insert(schema.chartTemplateAccounts)
      .values({
        accountNo,
        name,
        kind,
        normalSide,
        postingAllowed,
        enabled,
        parentAccountNo,
      })
      .onConflictDoUpdate({
        target: schema.chartTemplateAccounts.accountNo,
        set: {
          name,
          kind,
          normalSide,
          postingAllowed,
          enabled,
          parentAccountNo,
        },
      });
  }

  for (const rule of DEFAULT_GLOBAL_CORRESPONDENCE_RULES) {
    await db
      .insert(schema.correspondenceRules)
      .values({
        postingCode: rule.postingCode,
        debitAccountNo: rule.debitAccountNo,
        creditAccountNo: rule.creditAccountNo,
        enabled: rule.enabled,
      })
      .onConflictDoUpdate({
        target: [
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ],
        set: { enabled: rule.enabled },
      });
  }

  for (const policy of DEFAULT_ACCOUNT_DIMENSION_POLICIES) {
    await db
      .insert(schema.chartAccountDimensionPolicy)
      .values({
        accountNo: policy.accountNo,
        dimensionKey: policy.dimensionKey,
        mode: policy.mode,
      })
      .onConflictDoUpdate({
        target: [
          schema.chartAccountDimensionPolicy.accountNo,
          schema.chartAccountDimensionPolicy.dimensionKey,
        ],
        set: { mode: policy.mode },
      });
  }

  for (const policy of DEFAULT_POSTING_CODE_DIMENSION_POLICIES) {
    await db
      .insert(schema.postingCodeDimensionPolicy)
      .values({
        postingCode: policy.postingCode,
        dimensionKey: policy.dimensionKey,
        required: policy.required,
        scope: policy.scope,
      })
      .onConflictDoUpdate({
        target: [
          schema.postingCodeDimensionPolicy.postingCode,
          schema.postingCodeDimensionPolicy.dimensionKey,
        ],
        set: {
          required: policy.required,
          scope: policy.scope,
        },
      });
  }

  for (const mapping of DEFAULT_REPORT_LINE_MAPPINGS) {
    await db
      .insert(schema.accountingReportLineMappings)
      .values({
        standard: mapping.standard,
        reportKind: mapping.reportKind,
        lineCode: mapping.lineCode,
        lineLabel: mapping.lineLabel,
        section: mapping.section,
        accountNo: mapping.accountNo,
        signMultiplier: mapping.signMultiplier,
        effectiveFrom: DEFAULT_REPORT_LINE_MAPPINGS_EFFECTIVE_FROM,
        effectiveTo: null,
      })
      .onConflictDoUpdate({
        target: [
          schema.accountingReportLineMappings.standard,
          schema.accountingReportLineMappings.reportKind,
          schema.accountingReportLineMappings.lineCode,
          schema.accountingReportLineMappings.accountNo,
          schema.accountingReportLineMappings.effectiveFrom,
        ],
        set: {
          lineLabel: mapping.lineLabel,
          section: mapping.section,
          signMultiplier: mapping.signMultiplier,
          effectiveTo: null,
        },
      });
  }
}

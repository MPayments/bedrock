import { eq } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import type { AccountingChartRepository } from "../../../application/chart/ports";
import { schema } from "../../../schema";

export function createDrizzleAccountingChartRepository(
  db: Database,
): AccountingChartRepository {
  return {
    listTemplateAccounts: async () =>
      db
        .select()
        .from(schema.chartTemplateAccounts)
        .orderBy(schema.chartTemplateAccounts.accountNo),
    listCorrespondenceRules: async () =>
      db
        .select()
        .from(schema.correspondenceRules)
        .orderBy(
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ),
    replaceCorrespondenceRules: async (rules) =>
      db.transaction(async (tx) => {
        await tx.delete(schema.correspondenceRules);

        if (rules.length === 0) {
          return [];
        }

        return tx
          .insert(schema.correspondenceRules)
          .values(
            rules.map((rule) => ({
              postingCode: rule.postingCode,
              debitAccountNo: rule.debitAccountNo,
              creditAccountNo: rule.creditAccountNo,
              enabled: rule.enabled,
            })),
          )
          .returning();
      }),
    readPostingMatrixValidationInput: async () => {
      const [rules, accounts, accountDimPolicies, postingCodeDimPolicies] =
        await Promise.all([
          db
            .select()
            .from(schema.correspondenceRules)
            .where(eq(schema.correspondenceRules.enabled, true)),
          db.select().from(schema.chartTemplateAccounts),
          db.select().from(schema.chartAccountDimensionPolicy),
          db
            .select()
            .from(schema.postingCodeDimensionPolicy)
            .where(eq(schema.postingCodeDimensionPolicy.required, true)),
        ]);

      return {
        rules,
        accounts,
        accountDimPolicies,
        postingCodeDimPolicies,
      };
    },
  };
}

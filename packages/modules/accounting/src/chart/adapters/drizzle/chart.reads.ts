import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { ChartReads } from "../../application/ports/chart.reads";

export class DrizzleChartReads implements ChartReads {
  constructor(private readonly db: Queryable) {}

  async listTemplateAccounts() {
    return this.db
      .select()
      .from(schema.chartTemplateAccounts)
      .orderBy(schema.chartTemplateAccounts.accountNo);
  }

  async listCorrespondenceRules() {
    return this.db
      .select()
      .from(schema.correspondenceRules)
      .orderBy(
        schema.correspondenceRules.postingCode,
        schema.correspondenceRules.debitAccountNo,
        schema.correspondenceRules.creditAccountNo,
      );
  }

  async readPostingMatrix() {
    const [rules, accounts, accountDimPolicies, postingCodeDimPolicies] =
      await Promise.all([
        this.db
          .select()
          .from(schema.correspondenceRules)
          .where(eq(schema.correspondenceRules.enabled, true)),
        this.db.select().from(schema.chartTemplateAccounts),
        this.db.select().from(schema.chartAccountDimensionPolicy),
        this.db
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
  }
}

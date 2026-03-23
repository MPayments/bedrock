import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { ChartStore } from "../../application/ports/chart.store";

export class DrizzleChartStore implements ChartStore {
  constructor(private readonly db: Queryable) {}

  async replaceCorrespondenceRules(
    rules: {
      postingCode: string;
      debitAccountNo: string;
      creditAccountNo: string;
      enabled: boolean;
    }[],
  ) {
    await this.db.delete(schema.correspondenceRules);

    if (rules.length === 0) {
      return [];
    }

    return this.db
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
  }
}

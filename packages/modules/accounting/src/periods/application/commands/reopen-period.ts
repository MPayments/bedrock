import type { ModuleRuntime } from "@bedrock/shared/core";

import { AccountingPeriod, CalendarMonth } from "../../domain";
import {
  ReopenPeriodInputSchema,
  type ReopenPeriodInput,
} from "../contracts/commands";
import type { PeriodsCommandUnitOfWork } from "../ports/periods.uow";

export class ReopenPeriodCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: PeriodsCommandUnitOfWork,
  ) {}

  async execute(input: ReopenPeriodInput) {
    const validated = ReopenPeriodInputSchema.parse(input);
    const month = CalendarMonth.fromDate(validated.periodStart);

    return this.unitOfWork.run(async (tx) => {
      const latestClosePackage = await tx.periods.findLatestClosePackage({
        organizationId: validated.organizationId,
        periodStart: month.start,
      });
      const period = AccountingPeriod.fromSnapshot({
        organizationId: validated.organizationId,
        month,
        lock: null,
        latestClosePackage,
      });
      const reopenPlan = period.planReopen({
        reopenedBy: validated.reopenedBy,
        reopenReason: validated.reopenReason,
        reopenedAt: this.runtime.now(),
        reopenDocumentId: validated.reopenDocumentId,
      });

      const lock = await tx.periods.upsertReopenedPeriodLock({
        ...reopenPlan.lock,
      });

      if (reopenPlan.supersededClosePackage) {
        await tx.periods.markClosePackageSuperseded({
          id: reopenPlan.supersededClosePackage.id,
          reopenDocumentId:
            reopenPlan.supersededClosePackage.reopenDocumentId ?? null,
        });
      }

      return lock;
    });
  }
}

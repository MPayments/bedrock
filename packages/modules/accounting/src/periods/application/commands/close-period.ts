import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ClosePeriodInputSchema,
  type ClosePeriodInput,
} from "../contracts/commands";
import type { ClosePackageSnapshotPort } from "../ports/close-package-snapshot.port";
import type { PeriodsCommandUnitOfWork } from "../ports/periods.uow";
import { AccountingPeriod, CalendarMonth } from "../../domain";

export class ClosePeriodCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: PeriodsCommandUnitOfWork,
    private readonly closePackageSnapshotPort: ClosePackageSnapshotPort,
  ) {}

  async execute(input: ClosePeriodInput) {
    const validated = ClosePeriodInputSchema.parse(input);
    const month = CalendarMonth.fromDate(validated.periodStart);
    const period = AccountingPeriod.fromSnapshot({
      organizationId: validated.organizationId,
      month,
      lock: null,
      latestClosePackage: null,
    });
    const closePlan = period.planClose({
      closeDocumentId: validated.closeDocumentId,
      closeReason: validated.closeReason,
      closedBy: validated.closedBy,
      closedAt: this.runtime.now(),
    });

    return this.unitOfWork.run(async (tx) => {
      const lock = await tx.periods.upsertClosedPeriodLock({
        ...closePlan,
      });
      const closePackage =
        await this.closePackageSnapshotPort.generateClosePackageSnapshot({
          organizationId: closePlan.organizationId,
          periodStart: closePlan.periodStart,
          periodEnd: closePlan.periodEnd,
          closeDocumentId: validated.closeDocumentId,
        });

      return {
        lock,
        closePackage,
      };
    });
  }
}

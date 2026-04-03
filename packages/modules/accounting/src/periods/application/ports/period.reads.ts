import type { AccountingPeriodLockRecord } from "../../domain";

export interface PeriodReads {
  findClosedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
  }): Promise<Pick<AccountingPeriodLockRecord, "id"> | null>;
  listClosedOrganizationIdsForPeriod(input: {
    organizationIds: string[];
    periodStart: Date;
  }): Promise<string[]>;
}

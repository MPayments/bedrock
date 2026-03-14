import type { AccountingPeriodsRepository } from "./ports";
import { normalizeMonthStart } from "../../domain/periods";

export function createIsOrganizationPeriodClosedQuery(input: {
  repository: AccountingPeriodsRepository;
}) {
  const { repository } = input;

  return async function isOrganizationPeriodClosed(query: {
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean> {
    const periodStart = normalizeMonthStart(query.occurredAt);
    return Boolean(
      await repository.findClosedPeriodLock({
        organizationId: query.organizationId,
        periodStart,
      }),
    );
  };
}

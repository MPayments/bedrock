import type { AccountingPeriodsQueryRepository } from "./ports";
import { normalizeMonthStart } from "../../domain/periods";

export function createIsOrganizationPeriodClosedQuery(input: {
  repository: AccountingPeriodsQueryRepository;
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

export function createListClosedOrganizationIdsForPeriodQuery(input: {
  repository: AccountingPeriodsQueryRepository;
}) {
  const { repository } = input;

  return async function listClosedOrganizationIdsForPeriod(query: {
    organizationIds: string[];
    occurredAt: Date;
  }): Promise<string[]> {
    if (query.organizationIds.length === 0) {
      return [];
    }

    const periodStart = normalizeMonthStart(query.occurredAt);
    return repository.listClosedOrganizationIdsForPeriod({
      organizationIds: query.organizationIds,
      periodStart,
    });
  };
}

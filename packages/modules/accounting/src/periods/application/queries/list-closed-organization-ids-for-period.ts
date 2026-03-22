import {
  ListClosedOrganizationIdsForPeriodInputSchema,
  type ListClosedOrganizationIdsForPeriodInput,
} from "../contracts/queries";
import type { PeriodReads } from "../ports/period.reads";
import { normalizeMonthStart } from "../../domain";

export class ListClosedOrganizationIdsForPeriodQuery {
  constructor(private readonly reads: PeriodReads) {}

  async execute(input: ListClosedOrganizationIdsForPeriodInput) {
    const validated = ListClosedOrganizationIdsForPeriodInputSchema.parse(input);

    if (validated.organizationIds.length === 0) {
      return [];
    }

    return this.reads.listClosedOrganizationIdsForPeriod({
      organizationIds: validated.organizationIds,
      periodStart: normalizeMonthStart(validated.occurredAt),
    });
  }
}

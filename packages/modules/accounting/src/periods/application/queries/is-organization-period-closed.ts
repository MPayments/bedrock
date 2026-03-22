import { normalizeMonthStart } from "../../domain";
import {
  IsOrganizationPeriodClosedInputSchema,
  type IsOrganizationPeriodClosedInput,
} from "../contracts/queries";
import type { PeriodReads } from "../ports/period.reads";

export class IsOrganizationPeriodClosedQuery {
  constructor(private readonly reads: PeriodReads) {}

  async execute(input: IsOrganizationPeriodClosedInput) {
    const validated = IsOrganizationPeriodClosedInputSchema.parse(input);
    const periodStart = normalizeMonthStart(validated.occurredAt);
    return Boolean(
      await this.reads.findClosedPeriodLock({
        organizationId: validated.organizationId,
        periodStart,
      }),
    );
  }
}

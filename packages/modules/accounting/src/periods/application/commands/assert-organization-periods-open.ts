import { ValidationError } from "@bedrock/shared/core/errors";

import {
  AssertOrganizationPeriodsOpenInputSchema,
  type AssertOrganizationPeriodsOpenInput,
} from "../contracts/commands";
import { formatPeriodLabel, normalizeMonthStart } from "../../domain";

export class AssertOrganizationPeriodsOpenCommand {
  constructor(
    private readonly isOrganizationPeriodClosed: (input: {
      organizationId: string;
      occurredAt: Date;
    }) => Promise<boolean>,
  ) {}

  async execute(input: AssertOrganizationPeriodsOpenInput): Promise<void> {
    const validated = AssertOrganizationPeriodsOpenInputSchema.parse(input);

    if (validated.organizationIds.length === 0) {
      return;
    }

    const periodStart = normalizeMonthStart(validated.occurredAt);
    const periodLabel = formatPeriodLabel(periodStart);

    for (const organizationId of validated.organizationIds) {
      const closed = await this.isOrganizationPeriodClosed({
        organizationId,
        occurredAt: validated.occurredAt,
      });
      if (!closed) {
        continue;
      }

      throw new ValidationError(
        `Accounting period ${periodLabel} is closed for organization ${organizationId}; ${validated.docType} cannot be mutated`,
      );
    }
  }
}

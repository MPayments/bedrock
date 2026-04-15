import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { validateDealRouteDefinition } from "../../domain/route-validation";
import { DealNotFoundError, DealRouteValidationError } from "../../errors";
import {
  ReplaceDealRouteVersionInputSchema,
  type ReplaceDealRouteVersionInput,
} from "../contracts/commands";
import type { DealRouteVersion } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  validateDealRouteReferences,
  writeDealRouteVersion,
} from "../shared/route-version-write";

const ReplaceDealRouteVersionCommandInputSchema =
  ReplaceDealRouteVersionInputSchema.extend({
    dealId: z.uuid(),
  });

type ReplaceDealRouteVersionCommandInput = ReplaceDealRouteVersionInput & {
  dealId: string;
};

export class ReplaceDealRouteVersionCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: ReplaceDealRouteVersionCommandInput,
  ): Promise<DealRouteVersion> {
    const validated = ReplaceDealRouteVersionCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findById(validated.dealId);
      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      await validateDealRouteReferences({
        dealCustomerId: deal.customerId,
        references: this.references,
        route: validated,
      });

      const validationIssues = validateDealRouteDefinition({
        costComponents: validated.costComponents,
        dealType: deal.type,
        legs: validated.legs,
        participants: validated.participants,
      });
      const blockingIssues = validationIssues.filter(
        (issue) => issue.severity === "error",
      );

      if (blockingIssues.length > 0) {
        throw new DealRouteValidationError(validated.dealId, blockingIssues);
      }

      return writeDealRouteVersion({
        dealId: validated.dealId,
        route: validated,
        runtime: this.runtime,
        tx,
        validationIssues,
      });
    });
  }
}

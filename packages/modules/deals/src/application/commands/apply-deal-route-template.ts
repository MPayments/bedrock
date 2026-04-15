import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { validateDealRouteDefinition } from "../../domain/route-validation";
import {
  DealNotFoundError,
  DealRouteTemplateNotFoundError,
  DealRouteTemplateStateError,
  DealRouteValidationError,
} from "../../errors";
import {
  ApplyDealRouteTemplateInputSchema,
  type ApplyDealRouteTemplateInput,
} from "../contracts/commands";
import type { DealRouteVersion } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import { resolveRouteTemplateForDeal } from "../shared/route-template";
import {
  validateDealRouteReferences,
  writeDealRouteVersion,
} from "../shared/route-version-write";

const ApplyDealRouteTemplateCommandInputSchema =
  ApplyDealRouteTemplateInputSchema.extend({
    dealId: z.uuid(),
  });

type ApplyDealRouteTemplateCommandInput = ApplyDealRouteTemplateInput & {
  dealId: string;
};

export class ApplyDealRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: ApplyDealRouteTemplateCommandInput,
  ): Promise<DealRouteVersion> {
    const validated = ApplyDealRouteTemplateCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const template = await tx.dealReads.findRouteTemplateById(validated.templateId);

      if (!template) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      if (template.status !== "published") {
        throw new DealRouteTemplateStateError(
          validated.templateId,
          template.status,
          "be applied",
        );
      }

      const route = resolveRouteTemplateForDeal({
        deal,
        template,
      });
      const dealCustomerId =
        route.participants.find((participant) => participant.partyKind === "customer")
          ?.partyId ?? null;

      if (!dealCustomerId) {
        throw new DealNotFoundError(validated.dealId);
      }

      await validateDealRouteReferences({
        dealCustomerId,
        references: this.references,
        route,
      });

      const validationIssues = validateDealRouteDefinition({
        costComponents: route.costComponents,
        dealType: deal.summary.type,
        legs: route.legs,
        participants: route.participants,
      });
      const blockingIssues = validationIssues.filter(
        (issue) => issue.severity === "error",
      );

      if (blockingIssues.length > 0) {
        throw new DealRouteValidationError(validated.dealId, blockingIssues);
      }

      return writeDealRouteVersion({
        dealId: validated.dealId,
        route,
        runtime: this.runtime,
        tx,
        validationIssues,
      });
    });
  }
}

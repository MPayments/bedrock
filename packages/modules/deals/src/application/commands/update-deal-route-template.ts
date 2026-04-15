import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { validateDealRouteTemplateDefinition } from "../../domain/route-template-validation";
import {
  DealRouteTemplateNotFoundError,
  DealRouteTemplateStateError,
  DealRouteValidationError,
} from "../../errors";
import {
  UpdateDealRouteTemplateInputSchema,
  type UpdateDealRouteTemplateInput,
} from "../contracts/commands";
import type { DealRouteTemplate } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  replaceRouteTemplateBody,
  validateDealRouteTemplateReferences,
} from "../shared/route-template";

const UpdateDealRouteTemplateCommandInputSchema =
  UpdateDealRouteTemplateInputSchema.extend({
    templateId: z.uuid(),
  });

type UpdateDealRouteTemplateCommandInput = UpdateDealRouteTemplateInput & {
  templateId: string;
};

export class UpdateDealRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: UpdateDealRouteTemplateCommandInput,
  ): Promise<DealRouteTemplate> {
    const validated = UpdateDealRouteTemplateCommandInputSchema.parse(raw);

    await validateDealRouteTemplateReferences({
      references: this.references,
      template: validated,
    });

    const validationIssues = validateDealRouteTemplateDefinition(validated);
    const blockingIssues = validationIssues.filter(
      (issue) => issue.severity === "error",
    );

    if (blockingIssues.length > 0) {
      throw new DealRouteValidationError(validated.templateId, blockingIssues);
    }

    return this.commandUow.run(async (tx) => {
      const current = await tx.dealReads.findRouteTemplateById(validated.templateId);

      if (!current) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      if (current.status !== "draft") {
        throw new DealRouteTemplateStateError(
          validated.templateId,
          current.status,
          "be updated",
        );
      }

      await tx.dealStore.setDealRouteTemplate({
        code: validated.code,
        dealType: validated.dealType,
        description: validated.description,
        name: validated.name,
        templateId: validated.templateId,
      });
      await replaceRouteTemplateBody({
        routeTemplateId: validated.templateId,
        runtime: this.runtime,
        template: validated,
        tx,
      });

      const template = await tx.dealReads.findRouteTemplateById(validated.templateId);
      if (!template) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      return template;
    });
  }
}
